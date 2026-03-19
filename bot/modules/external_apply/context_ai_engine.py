"""Context AI Engine for external job application forms.

Responsibilities:
1. Detect auth-gated pages (login/signup/OTP) and skip them early.
2. Extract a structured DOM snapshot of form fields via JS injection.
3. Fingerprint the snapshot so the same portal layout is never AI-queried twice.
4. Call the AI to get per-field fill instructions for new page layouts.
5. Execute those instructions via Selenium.
6. Cache hits / new contexts are emitted back to bot_runner via EVENT: stdout.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any
from config.secrets import ai_provider
from modules.external_apply.answer_engine import (
    resolve_checkbox_answer,
    resolve_choice_answer,
    resolve_text_answer,
)

try:
    from modules.helpers import print_lg, print_step
except ImportError:
    def print_lg(*args, **kwargs): print(*args)
    def print_step(step, detail=None): print(f"[STEP] {step}" + (f": {detail}" if detail else ""))

try:
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import (
        NoSuchElementException,
        StaleElementReferenceException,
        TimeoutException,
    )
    from selenium.webdriver.support.ui import Select as SeleniumSelect
except ImportError:
    pass

# ── Helpers ───────────────────────────────────────────────────────────────────

_AUTH_KEYWORDS = [
    "sign in",
    "signin",
    "log in",
    "login",
    "create account",
    "register",
    "sign up",
    "signup",
    "verify otp",
    "one-time password",
    "enter password",
    "forgot password",
    "reset password",
    "verify your email",
    "two-factor",
    "2fa",
]

_DOM_EXTRACTOR_JS = """
(function() {
  var domain = window.location.hostname;
  var pageTitle = document.title || '';
  var fields = [];

  function getLabel(el) {
    // 1. aria-label
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    // 2. associated <label>
    var id = el.id;
    if (id) {
      var lbl = document.querySelector('label[for="' + id + '"]');
      if (lbl) return lbl.innerText.trim();
    }
    // 3. placeholder
    if (el.placeholder) return el.placeholder.trim();
    // 4. nearest ancestor label text
    var p = el.parentElement;
    for (var i = 0; i < 4; i++) {
      if (!p) break;
      var lbl2 = p.querySelector('label');
      if (lbl2 && lbl2.innerText.trim()) return lbl2.innerText.trim();
      p = p.parentElement;
    }
    // 5. name attribute
    if (el.name) return el.name.trim();
    return '';
  }

  function getSelector(el) {
    if (el.id) return '#' + el.id;
    if (el.name) return '[name="' + el.name + '"]';
    if (el.getAttribute('data-automation-id')) return '[data-automation-id="' + el.getAttribute('data-automation-id') + '"]';
    return '';
  }

  function getOptions(el) {
    var opts = [];
    if (el.tagName === 'SELECT') {
      for (var i = 0; i < el.options.length; i++) {
        var t = el.options[i].text.trim();
        if (t) opts.push(t);
      }
    }
    // combobox / listbox
    if (el.getAttribute('role') === 'combobox' || el.getAttribute('role') === 'listbox') {
      var listId = el.getAttribute('aria-controls') || el.getAttribute('aria-owns') || '';
      if (listId) {
        var list = document.getElementById(listId);
        if (list) {
          list.querySelectorAll('[role="option"]').forEach(function(o) {
            var t2 = o.innerText.trim();
            if (t2) opts.push(t2);
          });
        }
      }
    }
    return opts;
  }

  // Collect inputs
  var inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([disabled])');
  inputs.forEach(function(el) {
    var sel = getSelector(el);
    if (!sel) return;
    var lbl = getLabel(el);
    if (!lbl) return;
    fields.push({
      selector: sel,
      tag: 'input',
      type: el.type || 'text',
      label: lbl,
      placeholder: el.placeholder || '',
      required: el.required || el.getAttribute('aria-required') === 'true',
      options: [],
      value: el.value || ''
    });
  });

  // Collect textareas
  var textareas = document.querySelectorAll('textarea:not([disabled])');
  textareas.forEach(function(el) {
    var sel = getSelector(el);
    if (!sel) return;
    var lbl = getLabel(el);
    if (!lbl) return;
    fields.push({
      selector: sel,
      tag: 'textarea',
      type: 'textarea',
      label: lbl,
      placeholder: el.placeholder || '',
      required: el.required || el.getAttribute('aria-required') === 'true',
      options: [],
      value: el.value || ''
    });
  });

  // Collect selects
  var selects = document.querySelectorAll('select:not([disabled])');
  selects.forEach(function(el) {
    var sel = getSelector(el);
    if (!sel) return;
    var lbl = getLabel(el);
    if (!lbl) return;
    fields.push({
      selector: sel,
      tag: 'select',
      type: 'select',
      label: lbl,
      placeholder: '',
      required: el.required || el.getAttribute('aria-required') === 'true',
      options: getOptions(el),
      value: el.value || ''
    });
  });

  return {domain: domain, page_title: pageTitle, fields: fields};
})();
"""


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class ContextAIResult:
    requires_auth: bool = False
    skip_reason: str | None = None
    filled_count: int = 0
    skipped_count: int = 0
    failed_fields: list[str] = field(default_factory=list)
    used_cache: bool = False


# ── Engine ────────────────────────────────────────────────────────────────────

class ContextAIEngine:
    """Analyses external application pages and fills fields using AI instructions."""

    # ── Auth detection ────────────────────────────────────────────────────────

    def check_requires_auth(self, driver) -> tuple[bool, str]:
        """Return (True, reason) if the current page appears to require auth."""
        print_lg("[ContextAI] Checking for auth gate...")
        try:
            # Strong signal: password input present
            password_inputs = driver.find_elements(By.CSS_SELECTOR, 'input[type="password"]')
            if password_inputs:
                reason = "Page contains a password input — login/auth required"
                print_lg(f"[ContextAI] Auth gate detected: {reason}")
                return True, reason

            body_text = driver.find_element(By.TAG_NAME, "body").text.lower()
            for kw in _AUTH_KEYWORDS:
                if kw in body_text:
                    reason = f"Auth keyword detected on page: '{kw}'"
                    print_lg(f"[ContextAI] Auth gate detected: {reason}")
                    return True, reason
        except Exception as exc:
            print_lg(f"[ContextAI] Auth check error (continuing): {exc}")
        print_lg("[ContextAI] No auth gate detected — page looks clean")
        return False, ""

    # ── DOM snapshot ──────────────────────────────────────────────────────────

    def extract_dom_snapshot(self, driver) -> dict:
        """Return a structured JSON description of the current page's form fields."""
        print_lg("[ContextAI] Extracting DOM snapshot...")
        try:
            result = driver.execute_script(_DOM_EXTRACTOR_JS)
            if not isinstance(result, dict):
                result = {}
        except Exception as exc:
            print_lg(f"[ContextAI] DOM extraction error: {exc}")
            result = {}

        result.setdefault("domain", "")
        result.setdefault("page_title", "")
        result.setdefault("fields", [])
        field_count = len(result["fields"])
        print_lg(f"[ContextAI] DOM snapshot: domain={result['domain']!r}  fields found={field_count}  page={result['page_title']!r}")
        return result

    # ── Fingerprint ───────────────────────────────────────────────────────────

    def compute_fingerprint(self, dom_snapshot: dict) -> str:
        """SHA256 of sorted (label, type) pairs — same portal layout → same fingerprint."""
        fields = dom_snapshot.get("fields", [])
        key_parts = sorted(
            f"{f.get('label', '').strip().lower()}:{f.get('type', '').lower()}"
            for f in fields
            if f.get("label")
        )
        raw = "|".join(key_parts)
        fp = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
        print_lg(f"[ContextAI] Page fingerprint: {fp}  (from {len(key_parts)} labelled fields)")
        return fp

    # ── AI instructions ───────────────────────────────────────────────────────

    def get_ai_instructions(
        self,
        dom_snapshot: dict,
        user_profile: dict,
        ai_client: Any,
    ) -> list[dict]:
        """Ask the AI how to fill each field. Returns a list of instruction dicts."""
        # Build a trimmed snapshot (drop already-filled and empty-label fields)
        fillable_fields = [
            {k: v for k, v in f.items() if k != "value"}
            for f in dom_snapshot.get("fields", [])
            if f.get("label") and not f.get("value")
        ]
        if not fillable_fields:
            print_lg("[ContextAI] No unfilled fields to send to AI")
            return []

        config_backed = self._instructions_from_config(
            fillable_fields,
            user_profile,
            provider=dom_snapshot.get("domain"),
        )
        resolved_selectors = {
            str(item.get("selector") or "").strip()
            for item in config_backed
            if isinstance(item, dict) and str(item.get("selector") or "").strip()
        }
        remaining_fields = [
            field for field in fillable_fields
            if str(field.get("selector") or "").strip() not in resolved_selectors
        ]
        if config_backed and not remaining_fields:
            print_lg(f"[ContextAI] Resolved all {len(config_backed)} fields from config/learned answers")
            return config_backed

        if not ai_client:
            print_lg("[ContextAI] No AI client available — using only config/learned answers")
            return config_backed

        print_step("Context AI", f"querying AI for {len(remaining_fields)} fields on {dom_snapshot.get('domain', 'unknown')}")

        profile_summary = self._build_profile_summary(user_profile)

        prompt = (
            "You are helping a job application bot fill an online form.\n\n"
            "FORM STRUCTURE (JSON):\n"
            f"{json.dumps(remaining_fields, indent=2)}\n\n"
            "APPLICANT PROFILE:\n"
            f"{profile_summary}\n\n"
            "Return valid JSON only.\n"
            "Preferred shape:\n"
            '  {"instructions": [{"selector": "<css_selector>", "value": "<value_to_fill>", "action": "type|select|click", "skip": false}]}\n\n'
            "Rules:\n"
            "- Use the exact selector from the form structure.\n"
            '- For select fields, set action to "select" and value to one of the listed options.\n'
            '- For checkboxes/radios that should be checked, set action to "click" and value to "".\n'
            '- If a field cannot be determined from the profile, set skip to true.\n'
            "- If the page requires login/auth/OTP/signup, return "
            '{"requires_auth": true, "reason": "<reason>"} instead of an array.\n'
            "- Return ONLY valid JSON. No markdown, no explanation."
        )

        try:
            provider = str(ai_provider or "").lower()
            if provider in {"openai", "groq"}:
                from modules.ai.openaiConnections import ai_completion

                messages = [{"role": "user", "content": prompt}]
                raw = ai_completion(ai_client, messages, response_format={"type": "json_object"})
            elif provider == "deepseek":
                from modules.ai.deepseekConnections import deepseek_completion

                messages = [{"role": "user", "content": prompt}]
                raw = deepseek_completion(ai_client, messages, response_format={"type": "json_object"})
            elif provider == "gemini":
                from modules.ai.geminiConnections import gemini_completion

                raw = gemini_completion(ai_client, prompt, is_json=True)
            else:
                print_lg(f"[ContextAI] Unsupported AI provider for context engine: {provider}")
                return []

            if isinstance(raw, str):
                raw = raw.strip()
                # strip markdown code fences if present
                if raw.startswith("```"):
                    raw = raw.split("```")[1]
                    if raw.startswith("json"):
                        raw = raw[4:]
                raw = raw.strip()
                parsed = json.loads(raw)
            elif isinstance(raw, (dict, list)):
                parsed = raw
            else:
                print_lg("[ContextAI] AI returned unexpected response type — no instructions")
                return []

            if isinstance(parsed, dict) and parsed.get("requires_auth"):
                reason = str(parsed.get("reason", ""))
                print_lg(f"[ContextAI] AI detected auth requirement: {reason}")
                # Signal auth back as a special sentinel value
                return [{"__requires_auth": True, "reason": reason}]
            if isinstance(parsed, dict):
                instructions = parsed.get("instructions")
                if isinstance(instructions, list):
                    fillable = sum(1 for i in instructions if isinstance(i, dict) and not i.get("skip"))
                    skipped = len(instructions) - fillable
                    print_lg(
                        f"[ContextAI] AI returned {len(instructions)} instructions — fillable={fillable}  skip={skipped}"
                    )
                    return config_backed + instructions
            if isinstance(parsed, list):
                fillable = sum(1 for i in parsed if not i.get("skip"))
                skipped = len(parsed) - fillable
                print_lg(f"[ContextAI] AI returned {len(parsed)} instructions — fillable={fillable}  skip={skipped}")
                return config_backed + parsed
        except Exception as exc:
            print_lg(f"[ContextAI] AI instruction parse error: {exc}")
        return config_backed

    def _instructions_from_config(
        self,
        fields: list[dict],
        user_profile: dict,
        *,
        provider: str | None = None,
    ) -> list[dict]:
        instructions: list[dict] = []
        personals = user_profile.get("personals", {}) if isinstance(user_profile, dict) else {}
        work_location = str(personals.get("current_city") or personals.get("city") or "").strip()

        for field in fields:
            selector = str(field.get("selector") or "").strip()
            label = str(field.get("label") or "").strip()
            tag = str(field.get("tag") or "").strip().lower()
            field_type = str(field.get("type") or "").strip().lower()
            options = [str(option).strip() for option in (field.get("options") or []) if str(option).strip()]
            if not selector or not label:
                continue

            if tag == "select" or options:
                answer, _used_ai, unresolved = resolve_choice_answer(
                    label,
                    options,
                    work_location=work_location,
                    provider=provider,
                    ai_client=None,
                )
                if answer and not unresolved:
                    instructions.append({"selector": selector, "value": answer, "action": "select", "skip": False})
                continue

            if field_type == "checkbox":
                answer, _risky = resolve_checkbox_answer(label)
                if answer is True:
                    instructions.append({"selector": selector, "value": "", "action": "click", "skip": False})
                continue

            if tag == "textarea":
                answer, _used_ai, unresolved = resolve_text_answer(
                    label,
                    work_location=work_location,
                    question_type="textarea",
                    provider=provider,
                    ai_client=None,
                )
            else:
                answer, _used_ai, unresolved = resolve_text_answer(
                    label,
                    work_location=work_location,
                    question_type="text",
                    provider=provider,
                    ai_client=None,
                )
            if answer and not unresolved:
                instructions.append({"selector": selector, "value": answer, "action": "type", "skip": False})

        if instructions:
            print_lg(f"[ContextAI] Resolved {len(instructions)} fields from config/learned answers before AI")
        return instructions

    # ── Execute instructions ──────────────────────────────────────────────────

    def execute_instructions(self, driver, instructions: list[dict]) -> ContextAIResult:
        """Execute Selenium actions for each instruction. Returns a ContextAIResult."""
        result = ContextAIResult()

        if not instructions:
            print_lg("[ContextAI] No instructions to execute")
            return result

        # Check for auth sentinel
        if len(instructions) == 1 and instructions[0].get("__requires_auth"):
            result.requires_auth = True
            result.skip_reason = instructions[0].get("reason", "Auth required")
            return result

        actionable = [i for i in instructions if isinstance(i, dict) and not i.get("skip") and i.get("selector")]
        print_step("Context AI", f"executing {len(actionable)} fill instructions")

        for instr in instructions:
            if not isinstance(instr, dict):
                continue
            if instr.get("skip"):
                result.skipped_count += 1
                continue

            selector = str(instr.get("selector") or "").strip()
            value = str(instr.get("value") or "")
            action = str(instr.get("action") or "type").lower()

            if not selector:
                result.skipped_count += 1
                continue

            try:
                el = driver.find_element(By.CSS_SELECTOR, selector)
                if not el.is_displayed() or not el.is_enabled():
                    print_lg(f"[ContextAI]   skip (not visible/enabled): {selector}")
                    result.skipped_count += 1
                    continue

                if action == "select":
                    sel = SeleniumSelect(el)
                    try:
                        sel.select_by_visible_text(value)
                        print_lg(f"[ContextAI]   select {selector!r} = {value!r}")
                    except Exception:
                        # Try partial match
                        for option in sel.options:
                            if value.lower() in option.text.lower():
                                sel.select_by_visible_text(option.text)
                                print_lg(f"[ContextAI]   select (partial) {selector!r} = {option.text!r}")
                                break
                        else:
                            print_lg(f"[ContextAI]   FAILED select {selector!r} — option {value!r} not found")
                            result.failed_fields.append(selector)
                            continue
                elif action == "click":
                    if not el.is_selected():
                        el.click()
                        print_lg(f"[ContextAI]   click {selector!r}")
                    else:
                        print_lg(f"[ContextAI]   skip click (already selected): {selector!r}")
                else:
                    # type / clear + send_keys
                    tag = el.tag_name.lower()
                    if tag in ("input", "textarea"):
                        el.clear()
                        el.send_keys(value)
                        display_value = value[:40] + "…" if len(value) > 40 else value
                        print_lg(f"[ContextAI]   type {selector!r} = {display_value!r}")
                    else:
                        el.click()
                        print_lg(f"[ContextAI]   click-type {selector!r}")

                result.filled_count += 1

            except (NoSuchElementException, StaleElementReferenceException):
                print_lg(f"[ContextAI]   FAILED (element not found): {selector}")
                result.failed_fields.append(selector)
            except Exception as exc:
                print_lg(f"[ContextAI]   FAILED ({exc}): {selector}")
                result.failed_fields.append(selector)

        print_lg(
            f"[ContextAI] Execution complete — "
            f"filled={result.filled_count}  skipped={result.skipped_count}  failed={len(result.failed_fields)}"
        )
        if result.failed_fields:
            print_lg(f"[ContextAI] Failed selectors: {result.failed_fields}")
        return result

    # ── Private helpers ───────────────────────────────────────────────────────

    def _build_profile_summary(self, user_profile: dict) -> str:
        personals = user_profile.get("personals", {})
        questions = user_profile.get("questions", {})
        lines = []

        def _add(label: str, keys: list[str], source: dict) -> None:
            for k in keys:
                v = source.get(k)
                if v:
                    lines.append(f"{label}: {v}")
                    return

        _add("Full name", ["name", "full_name", "first_last_name"], personals)
        _add("First name", ["first_name", "firstname"], personals)
        _add("Last name", ["last_name", "lastname", "surname"], personals)
        _add("Email", ["email"], personals)
        _add("Phone", ["phone", "phone_number", "mobile"], personals)
        _add("City", ["city"], personals)
        _add("State", ["state", "province"], personals)
        _add("Country", ["country"], personals)
        _add("LinkedIn", ["linkedin", "linkedin_url"], personals)
        _add("GitHub", ["github", "github_url"], personals)
        _add("Portfolio", ["portfolio", "website", "portfolio_url"], personals)
        _add("Years of experience", ["years_of_experience", "experience_years"], questions)
        _add("Current company", ["current_company", "company"], personals)
        _add("Current title", ["current_title", "title", "job_title"], personals)

        return "\n".join(lines) if lines else "No profile data available."
