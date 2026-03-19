from __future__ import annotations

from dataclasses import dataclass, field
import time
from typing import Callable
from urllib.parse import urljoin, urlparse

from selenium.common.exceptions import NoSuchElementException, StaleElementReferenceException, TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.remote.webelement import WebElement

from modules.helpers import buffer, print_lg, print_step, show_confirm
from modules.visual_cursor import ensure_visual_cursor, show_cursor_click, show_cursor_scroll, show_cursor_typing
from modules.external_apply.context_ai_engine import ContextAIEngine
from modules.external_apply.answer_engine import (
    coerce_text_value,
    is_resume_upload_label,
    normalize_label,
    resolve_checkbox_answer,
    resolve_choice_answer,
    resolve_text_answer,
)


ProgressCallback = Callable[[str, str | None, bool, str | None], None]
EventCallback = Callable[[str, dict], None]


@dataclass
class ExternalApplyContext:
    driver: object
    wait: object
    actions: object
    ai_client: object
    title: str
    company: str
    job_description: str | None
    work_location: str
    resume_path: str
    click_gap: int
    progress: ProgressCallback
    emit_event: EventCallback | None = None
    use_context_ai: bool = False
    page_context_cache: dict = field(default_factory=dict)
    user_profile: dict = field(default_factory=dict)


@dataclass
class ExternalApplyResult:
    provider: str
    application_link: str
    stage: str
    review_required: bool = False
    submitted: bool = False
    unsupported: bool = False
    skipped: bool = False
    reason: str | None = None
    unresolved_fields: list[str] = field(default_factory=list)
    resume_label: str = "Previous resume"
    filled_fields: int = 0


def _safe_text(element: WebElement | None) -> str:
    if element is None:
        return ""
    try:
        return " ".join((element.text or "").replace("\xa0", " ").split())
    except Exception:
        return ""


def _is_visible(element: WebElement) -> bool:
    try:
        return element.is_displayed() and element.is_enabled()
    except Exception:
        return False


def _first_visible(elements: list[WebElement]) -> WebElement | None:
    for element in elements:
        if _is_visible(element):
            return element
    return None


class BaseExternalApplyAdapter:
    provider = "external"
    host_markers: tuple[str, ...] = ()
    dom_markers: tuple[str, ...] = ()
    preferred_form_selectors: tuple[str, ...] = ()

    def detect(self, driver) -> bool:
        current_url = (driver.current_url or "").lower()
        hostname = urlparse(current_url).netloc.lower()
        return any(marker in hostname or marker in current_url for marker in self.host_markers)

    def open_or_attach_context(self, driver) -> None:
        return None

    def fill_contact_fields(self, form: WebElement, ctx: ExternalApplyContext) -> list[str]:
        return self._fill_form_fields(form, ctx)

    def upload_resume(self, form: WebElement, ctx: ExternalApplyContext) -> str:
        if not ctx.resume_path:
            return "Previous resume"

        file_inputs = []
        try:
            file_inputs = form.find_elements(By.XPATH, ".//input[@type='file']")
        except Exception:
            file_inputs = []
        for file_input in file_inputs:
            label = self._extract_label(file_input) or self._extract_group_label(file_input)
            input_name = normalize_label(file_input.get_attribute("name") or "")
            input_id = normalize_label(file_input.get_attribute("id") or "")
            if label and not is_resume_upload_label(label) and "resume" not in input_name and "resume" not in input_id and "cv" not in input_name and "cv" not in input_id:
                continue
            try:
                show_cursor_typing(ctx.driver, file_input, "Uploading resume")
                file_input.send_keys(ctx.resume_path)
                buffer(ctx.click_gap)
                return ctx.resume_path.split("/")[-1]
            except Exception as exc:
                print_lg(f"Resume upload failed for {self.provider}: {exc}")
        return "Previous resume"

    def fill_standard_fields(self, form: WebElement, ctx: ExternalApplyContext) -> list[str]:
        return self._fill_form_fields(form, ctx)

    def fill_custom_questions(self, form: WebElement, ctx: ExternalApplyContext) -> list[str]:
        return []

    def advance_to_review(self, driver, form: WebElement) -> WebElement | None:
        return self._find_submit_button(form) or self._find_submit_button(driver)

    def pause_before_submit(self, driver, result: ExternalApplyResult) -> ExternalApplyResult:
        return result

    def collect_result(self, driver, unresolved_fields: list[str], resume_label: str) -> ExternalApplyResult:
        form = self._find_form(driver)
        submit_button = self.advance_to_review(driver, form) if form is not None else None
        if submit_button is None:
            return ExternalApplyResult(
                provider=self.provider,
                application_link=driver.current_url,
                stage="failed",
                reason="Unable to find the external application submit/review step.",
                unresolved_fields=unresolved_fields,
                resume_label=resume_label,
            )
        return ExternalApplyResult(
            provider=self.provider,
            application_link=driver.current_url,
            stage="review_pending",
            review_required=True,
            unresolved_fields=unresolved_fields,
            resume_label=resume_label,
        )

    def run(self, ctx: ExternalApplyContext) -> ExternalApplyResult:
        driver = ctx.driver
        self.open_or_attach_context(driver)

        # ── Context AI Engine ──────────────────────────────────────────────
        if ctx.use_context_ai:
            engine = ContextAIEngine()

            # Auth detection (always first)
            requires_auth, auth_reason = engine.check_requires_auth(driver)
            if requires_auth:
                print_lg(f"[ContextAI] Auth page detected: {auth_reason}")
                return ExternalApplyResult(
                    provider=self.provider,
                    application_link=driver.current_url,
                    stage="skipped",
                    skipped=True,
                    reason=auth_reason,
                )

            try:
                snapshot = engine.extract_dom_snapshot(driver)
                fingerprint = engine.compute_fingerprint(snapshot)
                cache_key = f"{snapshot['domain']}:{fingerprint}"
                cached = ctx.page_context_cache.get(cache_key)

                if cached:
                    print_step("Context AI", f"cache hit for {snapshot['domain']} ({fingerprint}) — skipping AI call")
                    instructions = cached["ai_instructions"]
                    used_cache = True
                    if ctx.emit_event:
                        ctx.emit_event("page_context", {
                            "event": "page_context",
                            "domain": snapshot["domain"],
                            "fingerprint": fingerprint,
                            "dom_snapshot": cached.get("dom_snapshot") or snapshot,
                            "ai_instructions": instructions,
                        })
                else:
                    print_step("Context AI", f"new layout on {snapshot['domain']} ({fingerprint}) — calling AI")
                    instructions = engine.get_ai_instructions(
                        snapshot, ctx.user_profile, ctx.ai_client
                    )
                    used_cache = False

                    if instructions and ctx.emit_event:
                        ctx.emit_event("page_context", {
                            "event": "page_context",
                            "domain": snapshot["domain"],
                            "fingerprint": fingerprint,
                            "dom_snapshot": snapshot,
                            "ai_instructions": [i for i in instructions if not i.get("__requires_auth")],
                        })

                if instructions:
                    ai_result = engine.execute_instructions(driver, instructions)
                    if ai_result.requires_auth:
                        return ExternalApplyResult(
                            provider=self.provider,
                            application_link=driver.current_url,
                            stage="skipped",
                            skipped=True,
                            reason=ai_result.skip_reason,
                        )
                    print_step(
                        "Context AI result",
                        f"filled={ai_result.filled_count}  skipped={ai_result.skipped_count}  "
                        f"failed={len(ai_result.failed_fields)}  cached={'yes' if used_cache else 'no'}"
                    )
            except Exception as exc:
                print_lg(f"[ContextAI] Engine error — falling through to standard logic: {exc}")
        elif self.provider != "unsupported_external":
            # Auth check even without context AI — no point waiting on a login page
            try:
                engine = ContextAIEngine()
                requires_auth, auth_reason = engine.check_requires_auth(driver)
                if requires_auth:
                    print_lg(f"[AuthCheck] Auth page detected: {auth_reason}")
                    return ExternalApplyResult(
                        provider=self.provider,
                        application_link=driver.current_url,
                        stage="skipped",
                        skipped=True,
                        reason=auth_reason,
                    )
            except Exception:
                pass
        # ── End Context AI ─────────────────────────────────────────────────
        form = self._find_form(driver)
        if form is None:
            diagnostics = self._application_diagnostics(driver)
            print_lg(f"Failed to locate {self.provider} application form. {diagnostics}")
            return ExternalApplyResult(
                provider=self.provider,
                application_link=driver.current_url,
                stage="failed",
                reason=f"Could not locate the {self.provider} application form. {diagnostics}",
            )

        ctx.progress("filling", f"{self.provider} contact fields", False, None)
        filled_before = self._count_completed_fields(form)
        unresolved = self.fill_contact_fields(form, ctx)

        ctx.progress("uploading_resume", f"{self.provider} resume upload", False, None)
        resume_label = self.upload_resume(form, ctx)

        ctx.progress("answering_questions", f"{self.provider} application questions", False, None)
        unresolved.extend(self.fill_standard_fields(form, ctx))
        unresolved.extend(self.fill_custom_questions(form, ctx))
        unresolved.extend(self._find_remaining_required_fields(form))
        unresolved = [item for item in dict.fromkeys(unresolved) if item]
        if unresolved:
            manual_completed = self._request_manual_completion(form, ctx, unresolved)
            if manual_completed:
                self._capture_learned_answers(form, ctx, unresolved)
                unresolved = self._find_remaining_required_fields(form)
            else:
                return ExternalApplyResult(
                    provider=self.provider,
                    application_link=driver.current_url,
                    stage="failed",
                    reason=f"Manual {self.provider} question review was not completed.",
                    unresolved_fields=unresolved,
                    resume_label=resume_label,
                )
        result = self.collect_result(driver, unresolved, resume_label)
        result.filled_fields = max(self._count_completed_fields(form) - filled_before, 0)
        if result.review_required and result.filled_fields == 0 and resume_label == "Previous resume":
            result.stage = "failed"
            result.review_required = False
            result.reason = (
                f"{self.provider.title()} application page opened, but the bot could not identify any fillable fields."
            )
        return result

    def _find_form(self, driver) -> WebElement | None:
        for selector in self.preferred_form_selectors:
            try:
                forms = driver.find_elements(By.CSS_SELECTOR, selector)
            except Exception:
                forms = []
            form = _first_visible(forms)
            if form is not None:
                return form
        try:
            forms = driver.find_elements(By.TAG_NAME, "form")
        except Exception:
            forms = []
        candidates: list[tuple[int, WebElement]] = []
        for form in forms:
            try:
                fields = form.find_elements(By.XPATH, ".//input|.//textarea|.//select")
                score = len([field for field in fields if _is_visible(field)])
            except Exception:
                score = 0
            if score > 0:
                candidates.append((score, form))
        if candidates:
            candidates.sort(key=lambda item: item[0], reverse=True)
            return candidates[0][1]
        return None

    def _fillable_field_xpath(self) -> str:
        return (
            ".//input[not(@type='hidden')]"
            "|.//textarea"
            "|.//select"
            "|.//input[@role='combobox']"
            "|.//*[@role='combobox' and @contenteditable='true']"
        )

    def _collect_fillable_fields(self, root: WebElement) -> list[WebElement]:
        try:
            return root.find_elements(By.XPATH, self._fillable_field_xpath())
        except Exception:
            return []

    def _find_fillable_container(
        self,
        driver,
        *,
        selectors: tuple[str, ...],
        minimum_fields: int = 1,
    ) -> WebElement | None:
        best_candidate: tuple[int, WebElement] | None = None
        for selector in selectors:
            try:
                candidates = driver.find_elements(By.CSS_SELECTOR, selector)
            except Exception:
                candidates = []
            for candidate in candidates:
                try:
                    fields = self._collect_fillable_fields(candidate)
                    visible_fields = [field for field in fields if _is_visible(field)]
                    file_inputs = candidate.find_elements(By.XPATH, ".//input[@type='file']")
                    submit_buttons = candidate.find_elements(
                        By.XPATH,
                        ".//button[@type='submit']|.//input[@type='submit']|.//button[contains(., 'Submit')]|.//button[contains(., 'Apply')]",
                    )
                    score = len(visible_fields) + len(file_inputs) + len([btn for btn in submit_buttons if _is_visible(btn)])
                    if score < minimum_fields:
                        continue
                    if best_candidate is None or score > best_candidate[0]:
                        best_candidate = (score, candidate)
                except Exception:
                    continue
        return best_candidate[1] if best_candidate is not None else None

    def _application_diagnostics(self, driver) -> str:
        absolute_fillable_xpath = self._fillable_field_xpath().replace(".//", "//")
        try:
            forms = len(driver.find_elements(By.TAG_NAME, "form"))
        except Exception:
            forms = 0
        try:
            fillable = len(driver.find_elements(By.XPATH, absolute_fillable_xpath))
        except Exception:
            fillable = 0
        try:
            file_inputs = len(driver.find_elements(By.XPATH, "//input[@type='file']"))
        except Exception:
            file_inputs = 0
        try:
            submit_buttons = len(
                driver.find_elements(
                    By.XPATH,
                    "//button[@type='submit']|//input[@type='submit']|//button[contains(., 'Submit')]|//button[contains(., 'Apply')]",
                )
            )
        except Exception:
            submit_buttons = 0
        return (
            f"url={driver.current_url} | forms={forms} | fillable={fillable} | "
            f"file_inputs={file_inputs} | submit_buttons={submit_buttons}"
        )

    def _count_completed_fields(self, form: WebElement) -> int:
        completed = 0
        fields = self._collect_fillable_fields(form)
        for field in fields:
            if not _is_visible(field):
                continue
            try:
                tag_name = (field.tag_name or "").lower()
                field_type = (field.get_attribute("type") or "").lower()
                if tag_name == "select":
                    selected_value = normalize_label(field.get_attribute("value") or "")
                    if selected_value and selected_value not in {"", "select", "select an option"}:
                        completed += 1
                elif field_type in {"checkbox", "radio"}:
                    if field.is_selected():
                        completed += 1
                else:
                    if coerce_text_value(field.get_attribute("value") or ""):
                        completed += 1
            except Exception:
                continue
        return completed

    def _field_key(self, element: WebElement) -> str:
        try:
            return "|".join(
                [
                    element.get_attribute("id") or "",
                    element.get_attribute("name") or "",
                    element.get_attribute("type") or "",
                ]
            )
        except Exception:
            return str(id(element))

    def _fill_form_fields(self, form: WebElement, ctx: ExternalApplyContext) -> list[str]:
        unresolved: list[str] = []
        visited: set[str] = set()

        unresolved.extend(self._fill_provider_specific_fields(form, ctx, visited))
        unresolved.extend(self._fill_comboboxes(form, ctx, visited))
        unresolved.extend(self._fill_text_inputs(form, ctx, visited))
        unresolved.extend(self._fill_textareas(form, ctx, visited))
        unresolved.extend(self._fill_selects(form, ctx, visited))
        unresolved.extend(self._fill_radio_groups(form, ctx))
        unresolved.extend(self._fill_checkboxes(form))
        return unresolved

    def _fill_provider_specific_fields(
        self, form: WebElement, ctx: ExternalApplyContext, visited: set[str]
    ) -> list[str]:
        return []

    def _fill_text_inputs(self, form: WebElement, ctx: ExternalApplyContext, visited: set[str]) -> list[str]:
        unresolved: list[str] = []
        try:
            fields = form.find_elements(By.XPATH, ".//input[not(@type='hidden') and not(@type='file') and not(@type='radio') and not(@type='checkbox')]")
        except Exception:
            fields = []
        for field in fields:
            key = self._field_key(field)
            if key in visited or not _is_visible(field):
                continue
            visited.add(key)

            label = self._extract_label(field) or self._extract_group_label(field)
            previous_value = coerce_text_value(field.get_attribute("value") or "")
            if previous_value:
                continue
            answer, used_ai, needs_review = resolve_text_answer(
                label,
                work_location=ctx.work_location,
                question_type="text",
                provider=self.provider,
                ai_client=ctx.ai_client,
                job_description=ctx.job_description,
            )
            if answer:
                self._write_text(field, answer)
                if used_ai:
                    print_lg(f'AI answered external field "{label}" with "{answer}"')
            elif self._is_required(field):
                unresolved.append(label or "Unknown field")
            if needs_review and self._is_required(field):
                unresolved.append(label or "Unknown field")
        return unresolved

    def _fill_textareas(self, form: WebElement, ctx: ExternalApplyContext, visited: set[str]) -> list[str]:
        unresolved: list[str] = []
        try:
            fields = form.find_elements(By.TAG_NAME, "textarea")
        except Exception:
            fields = []
        for field in fields:
            key = self._field_key(field)
            if key in visited or not _is_visible(field):
                continue
            visited.add(key)
            label = self._extract_label(field) or self._extract_group_label(field)
            previous_value = coerce_text_value(field.get_attribute("value") or "")
            if previous_value:
                continue
            answer, used_ai, needs_review = resolve_text_answer(
                label,
                work_location=ctx.work_location,
                question_type="textarea",
                provider=self.provider,
                ai_client=ctx.ai_client,
                job_description=ctx.job_description,
            )
            if answer:
                self._write_text(field, answer)
                if used_ai:
                    print_lg(f'AI answered external textarea "{label}"')
            elif self._is_required(field):
                unresolved.append(label or "Unknown field")
            if needs_review and self._is_required(field):
                unresolved.append(label or "Unknown field")
        return unresolved

    def _fill_selects(self, form: WebElement, ctx: ExternalApplyContext, visited: set[str]) -> list[str]:
        unresolved: list[str] = []
        try:
            selects = form.find_elements(By.TAG_NAME, "select")
        except Exception:
            selects = []
        for select in selects:
            key = self._field_key(select)
            if key in visited or not _is_visible(select):
                continue
            visited.add(key)
            label = self._extract_label(select) or self._extract_group_label(select)
            options = self._option_texts(select)
            if not options:
                continue
            current_value = normalize_label(select.get_attribute("value") or "")
            if current_value:
                continue
            answer, used_ai, needs_review = resolve_choice_answer(
                label,
                options,
                work_location=ctx.work_location,
                question_type="single_select",
                provider=self.provider,
                ai_client=ctx.ai_client,
                job_description=ctx.job_description,
            )
            if answer:
                self._select_option(select, answer)
                if used_ai:
                    print_lg(f'AI selected external option "{answer}" for "{label}"')
            elif self._is_required(select):
                unresolved.append(label or "Unknown select")
            if needs_review and self._is_required(select):
                unresolved.append(label or "Unknown select")
        return unresolved

    def _fill_radio_groups(self, form: WebElement, ctx: ExternalApplyContext) -> list[str]:
        unresolved: list[str] = []
        try:
            radios = [radio for radio in form.find_elements(By.XPATH, ".//input[@type='radio']") if _is_visible(radio)]
        except Exception:
            radios = []
        grouped: dict[str, list[WebElement]] = {}
        for radio in radios:
            name = radio.get_attribute("name") or radio.get_attribute("id") or str(id(radio))
            grouped.setdefault(name, []).append(radio)
        for group in grouped.values():
            if any(radio.is_selected() for radio in group):
                continue
            sample = group[0]
            label = self._extract_group_label(sample) or self._extract_label(sample)
            options = []
            radio_by_option: dict[str, WebElement] = {}
            for radio in group:
                option_label = self._extract_option_label(radio) or radio.get_attribute("value") or "Unknown"
                options.append(option_label)
                radio_by_option[option_label] = radio
            answer, used_ai, needs_review = resolve_choice_answer(
                label,
                options,
                work_location=ctx.work_location,
                question_type="single_select",
                provider=self.provider,
                ai_client=ctx.ai_client,
                job_description=ctx.job_description,
            )
            if answer and answer in radio_by_option:
                self._click_with_label_fallback(radio_by_option[answer])
                if used_ai:
                    print_lg(f'AI selected external radio "{answer}" for "{label}"')
            elif self._is_required(sample):
                unresolved.append(label or "Unknown radio group")
            if needs_review and self._is_required(sample):
                unresolved.append(label or "Unknown radio group")
        return unresolved

    def _fill_checkboxes(self, form: WebElement) -> list[str]:
        unresolved: list[str] = []
        try:
            checkboxes = [checkbox for checkbox in form.find_elements(By.XPATH, ".//input[@type='checkbox']") if _is_visible(checkbox)]
        except Exception:
            checkboxes = []
        for checkbox in checkboxes:
            if checkbox.is_selected():
                continue
            label = self._extract_option_label(checkbox) or self._extract_group_label(checkbox)
            should_check, needs_review = resolve_checkbox_answer(label)
            if should_check is True:
                self._click_with_label_fallback(checkbox)
            elif needs_review and self._is_required(checkbox):
                unresolved.append(label or "Unknown checkbox")
        return unresolved

    def _extract_label(self, element: WebElement) -> str:
        try:
            aria_label = element.get_attribute("aria-label") or ""
            if aria_label.strip():
                return aria_label.strip()
        except Exception:
            pass
        try:
            element_id = element.get_attribute("id")
            if element_id:
                labels = element.find_elements(By.XPATH, f"//label[@for='{element_id}']")
                label = _first_visible(labels)
                text = _safe_text(label)
                if text:
                    return text
        except Exception:
            pass
        try:
            label = element.find_element(By.XPATH, "./ancestor::label[1]")
            text = _safe_text(label)
            if text:
                return text
        except Exception:
            pass
        try:
            placeholder = element.get_attribute("placeholder") or ""
            if placeholder.strip():
                return placeholder.strip()
        except Exception:
            pass
        return ""

    def _fill_comboboxes(self, form: WebElement, ctx: ExternalApplyContext, visited: set[str]) -> list[str]:
        unresolved: list[str] = []
        try:
            combos = form.find_elements(
                By.XPATH,
                ".//input[@role='combobox'] | .//*[@role='combobox' and @contenteditable='true']",
            )
        except Exception:
            combos = []
        for combo in combos:
            key = self._field_key(combo)
            if key in visited or not _is_visible(combo):
                continue
            visited.add(key)

            label = self._extract_label(combo) or self._extract_group_label(combo)
            current_value = coerce_text_value(combo.get_attribute("value") or "")
            if current_value:
                continue

            options = self._open_combobox_options(ctx.driver, combo)
            if options:
                answer, used_ai, needs_review = resolve_choice_answer(
                    label,
                    options,
                    work_location=ctx.work_location,
                    question_type="single_select",
                    provider=self.provider,
                    ai_client=ctx.ai_client,
                    job_description=ctx.job_description,
                )
            else:
                resolved, used_ai, needs_review = resolve_text_answer(
                    label,
                    work_location=ctx.work_location,
                    question_type="text",
                    provider=self.provider,
                    ai_client=ctx.ai_client,
                    job_description=ctx.job_description,
                )
                answer = resolved or None

            if answer and self._select_combobox_value(ctx.driver, combo, answer):
                if used_ai:
                    print_lg(f'AI selected external combobox "{answer}" for "{label}"')
                continue
            if self._is_required(combo):
                unresolved.append(label or "Unknown combobox")
            if needs_review and self._is_required(combo):
                unresolved.append(label or "Unknown combobox")
        return unresolved

    def _extract_group_label(self, element: WebElement) -> str:
        try:
            legend = element.find_element(By.XPATH, "./ancestor::fieldset[1]//legend")
            text = _safe_text(legend)
            if text:
                return text
        except Exception:
            pass
        try:
            container = element.find_element(
                By.XPATH,
                "./ancestor::*[self::div or self::section][.//label or .//legend or .//p][1]",
            )
            candidates = container.find_elements(By.XPATH, ".//label|.//legend|.//p|.//span")
            for candidate in candidates:
                text = _safe_text(candidate)
                if text and len(text) < 200:
                    return text
        except Exception:
            pass
        return ""

    def _extract_option_label(self, element: WebElement) -> str:
        try:
            element_id = element.get_attribute("id")
            if element_id:
                label = element.find_element(By.XPATH, f"//label[@for='{element_id}']")
                text = _safe_text(label)
                if text:
                    return text
        except Exception:
            pass
        try:
            label = element.find_element(By.XPATH, "./ancestor::label[1]")
            text = _safe_text(label)
            if text:
                return text
        except Exception:
            pass
        return ""

    def _option_texts(self, select: WebElement) -> list[str]:
        try:
            options = select.find_elements(By.TAG_NAME, "option")
        except Exception:
            return []
        return [
            option.text.strip()
            for option in options
            if option.text and normalize_label(option.text) not in {"", "select", "select an option"}
        ]

    def _open_combobox_options(self, driver, combo: WebElement) -> list[str]:
        try:
            show_cursor_scroll(driver, combo, "Opening options")
            driver.execute_script("arguments[0].scrollIntoView({block:'center'});", combo)
        except Exception:
            pass
        try:
            show_cursor_click(driver, combo, "Opening options")
            combo.click()
            buffer(1)
        except Exception:
            pass

        listbox_id = combo.get_attribute("aria-controls") or ""
        options = self._find_visible_options(driver, listbox_id)
        return [option.text.strip() for option in options if option.text and option.text.strip()]

    def _find_visible_options(self, driver, listbox_id: str = "") -> list[WebElement]:
        selectors = []
        if listbox_id:
            selectors.extend(
                [
                    f"//*[@id='{listbox_id}']//*[@role='option']",
                    f"//*[@id='{listbox_id}']//div[contains(@class,'option')]",
                    f"//*[@id='{listbox_id}']//li",
                ]
            )
        selectors.extend(
            [
                "//*[@role='option']",
                "//div[contains(@class,'dropdown-results')]//*[self::div or self::li or self::button]",
            ]
        )
        for selector in selectors:
            try:
                elements = driver.find_elements(By.XPATH, selector)
            except Exception:
                elements = []
            visible = [element for element in elements if _is_visible(element) and _safe_text(element)]
            if visible:
                return visible
        return []

    def _select_combobox_value(self, driver, combo: WebElement, answer: str) -> bool:
        normalized_answer = normalize_label(answer)
        try:
            show_cursor_scroll(driver, combo, "Scrolling to field")
            driver.execute_script("arguments[0].scrollIntoView({block:'center'});", combo)
        except Exception:
            pass
        try:
            show_cursor_click(driver, combo, f"Selecting {answer}")
            combo.click()
            buffer(1)
        except Exception:
            pass
        try:
            combo.send_keys(Keys.COMMAND, "a")
        except Exception:
            try:
                combo.send_keys(Keys.CONTROL, "a")
            except Exception:
                pass
        try:
            combo.send_keys(Keys.BACKSPACE)
        except Exception:
            pass
        try:
            show_cursor_typing(driver, combo, f"Typing {answer}")
            combo.send_keys(answer)
            buffer(1)
        except Exception:
            return False

        options = self._find_visible_options(driver, combo.get_attribute("aria-controls") or "")
        for option in options:
            option_text = normalize_label(_safe_text(option))
            if option_text == normalized_answer or normalized_answer in option_text or option_text in normalized_answer:
                try:
                    show_cursor_click(driver, option, f"Choosing {answer}")
                    option.click()
                    buffer(1)
                    return True
                except Exception:
                    continue

        try:
            combo.send_keys(Keys.ARROW_DOWN)
            combo.send_keys(Keys.ENTER)
            buffer(1)
            current_value = coerce_text_value(combo.get_attribute("value") or "")
            if current_value:
                return True
        except Exception:
            pass
        return False

    def _select_option(self, select: WebElement, answer: str) -> None:
        options = select.find_elements(By.TAG_NAME, "option")
        normalized_answer = normalize_label(answer)
        for option in options:
            if normalize_label(option.text) == normalized_answer:
                show_cursor_click(getattr(select, "parent", None), option, f"Selecting {answer}")
                option.click()
                buffer(1)
                return
        for option in options:
            option_text = normalize_label(option.text)
            if normalized_answer in option_text or option_text in normalized_answer:
                show_cursor_click(getattr(select, "parent", None), option, f"Selecting {answer}")
                option.click()
                buffer(1)
                return

    def _write_text(self, field: WebElement, answer: str) -> None:
        try:
            field.clear()
        except Exception:
            pass
        show_cursor_typing(getattr(field, "parent", None), field, "Typing answer")
        field.send_keys(answer)
        buffer(1)

    def _click_with_label_fallback(self, element: WebElement) -> None:
        try:
            show_cursor_click(getattr(element, "parent", None), element, "Selecting option")
            element.click()
            buffer(1)
            return
        except Exception:
            pass
        label = self._extract_option_label(element)
        if label:
            try:
                label_element = element.find_element(By.XPATH, f"//label[normalize-space()='{label}']")
                show_cursor_click(getattr(label_element, "parent", None), label_element, "Selecting option")
                label_element.click()
                buffer(1)
                return
            except Exception:
                pass
        element.send_keys(Keys.SPACE)
        buffer(1)

    def _is_required(self, element: WebElement) -> bool:
        try:
            required_attr = element.get_attribute("required")
            aria_required = element.get_attribute("aria-required")
            return bool(required_attr) or str(aria_required).lower() == "true"
        except Exception:
            return False

    def _find_remaining_required_fields(self, form: WebElement) -> list[str]:
        unresolved: list[str] = []
        fields = self._collect_fillable_fields(form)

        seen: set[str] = set()
        for field in fields:
            key = self._field_key(field)
            if key in seen:
                continue
            seen.add(key)

            tag_name = normalize_label(getattr(field, "tag_name", ""))
            field_type = normalize_label(field.get_attribute("type") or "")
            label = self._extract_label(field) or self._extract_group_label(field)
            if field_type == "file":
                value = coerce_text_value(field.get_attribute("value") or "")
                if (self._is_required(field) or is_resume_upload_label(label)) and not value:
                    unresolved.append(label or "Resume/CV")
                continue
            if not _is_visible(field):
                continue
            if not self._is_required(field):
                continue
            if field_type == "checkbox":
                try:
                    if not field.is_selected():
                        unresolved.append(label or "Unknown checkbox")
                except Exception:
                    unresolved.append(label or "Unknown checkbox")
                continue
            if field_type == "radio":
                try:
                    group_name = field.get_attribute("name") or field.get_attribute("id") or ""
                    radios = form.find_elements(By.XPATH, f".//input[@type='radio' and @name='{group_name}']")
                    if not any(radio.is_selected() for radio in radios):
                        unresolved.append(label or "Unknown radio group")
                except Exception:
                    unresolved.append(label or "Unknown radio group")
                continue
            if tag_name == "select":
                value = normalize_label(field.get_attribute("value") or "")
                if not value:
                    unresolved.append(label or "Unknown select")
                continue
            value = coerce_text_value(field.get_attribute("value") or "")
            if not value:
                unresolved.append(label or "Unknown field")
        return [item for item in dict.fromkeys(unresolved) if item]

    def _request_manual_completion(self, form: WebElement, ctx: ExternalApplyContext, unresolved: list[str]) -> bool:
        ctx.progress("human_assist", f"{self.provider} requires help", False, None)
        lines = [
            f"The bot needs help with this {self.provider.title()} application:",
            "",
        ]
        lines.extend(f"- {field}" for field in unresolved[:10])
        lines.extend(
            [
                "",
                "Fill the missing fields in the browser tab, then click \"Continue auto apply\".",
                "Choose \"Skip application\" to stop this application.",
            ]
        )
        decision = show_confirm(
            "\n".join(lines),
            f"{self.provider.title()} help needed",
            ["Continue auto apply", "Skip application"],
        )
        return decision == "Continue auto apply"

    def _capture_learned_answers(self, form: WebElement, ctx: ExternalApplyContext, unresolved: list[str]) -> None:
        if ctx.emit_event is None:
            return
        unresolved_labels = {normalize_label(label) for label in unresolved if normalize_label(label)}
        for item in self._collect_answered_fields(form):
            normalized_question = normalize_label(item["question"])
            if normalized_question not in unresolved_labels:
                continue
            if not item["answer"]:
                continue
            try:
                ctx.emit_event(
                    "learned_answer",
                    {
                        "provider": self.provider,
                        "question": item["question"],
                        "question_type": item["question_type"],
                        "answer": item["answer"],
                        "options": item.get("options") or [],
                    },
                )
            except Exception as exc:
                print_lg(f"Failed to store learned answer for {item['question']}: {exc}")

    def _collect_answered_fields(self, form: WebElement) -> list[dict[str, object]]:
        captured: list[dict[str, object]] = []
        fields = [field for field in self._collect_fillable_fields(form) if normalize_label(field.get_attribute("type") or "") != "file"]
        seen: set[str] = set()
        for field in fields:
            key = self._field_key(field)
            if key in seen:
                continue
            seen.add(key)
            label = self._extract_label(field) or self._extract_group_label(field)
            if not label:
                continue

            tag_name = normalize_label(getattr(field, "tag_name", ""))
            field_type = normalize_label(field.get_attribute("type") or "")
            if tag_name == "select":
                options = self._option_texts(field)
                value = next(
                    (
                        option.text.strip()
                        for option in field.find_elements(By.TAG_NAME, "option")
                        if option.is_selected() and normalize_label(option.text) not in {"", "select", "select an option"}
                    ),
                    "",
                )
                if value:
                    captured.append({"question": label, "question_type": "single_select", "answer": value, "options": options})
                continue
            if field.get_attribute("role") == "combobox":
                value = coerce_text_value(field.get_attribute("value") or "")
                if value and normalize_label(value) != normalize_label(label):
                    captured.append({"question": label, "question_type": "single_select", "answer": value, "options": []})
                continue
            if field_type == "radio":
                group_name = field.get_attribute("name") or field.get_attribute("id") or ""
                try:
                    radios = form.find_elements(By.XPATH, f".//input[@type='radio' and @name='{group_name}']")
                except Exception:
                    radios = []
                for radio in radios:
                    try:
                        if radio.is_selected():
                            option_label = self._extract_option_label(radio) or radio.get_attribute("value") or ""
                            if option_label:
                                captured.append({"question": label, "question_type": "single_select", "answer": option_label, "options": []})
                            break
                    except Exception:
                        continue
                continue
            if field_type == "checkbox":
                continue
            value = coerce_text_value(field.get_attribute("value") or "")
            if value:
                question_type = "textarea" if tag_name == "textarea" else "text"
                captured.append({"question": label, "question_type": question_type, "answer": value, "options": []})
        return captured

    def _find_submit_button(self, root: WebElement) -> WebElement | None:
        selectors = [
            ".//button[@type='submit']",
            ".//input[@type='submit']",
            ".//button[contains(translate(normalize-space(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'submit')]",
            ".//button[contains(translate(normalize-space(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'apply')]",
        ]
        for selector in selectors:
            try:
                elements = root.find_elements(By.XPATH, selector)
            except Exception:
                elements = []
            button = _first_visible(elements)
            if button is not None:
                return button
        return None


class GreenhouseAdapter(BaseExternalApplyAdapter):
    provider = "greenhouse"
    host_markers = ("greenhouse.io", "greenhouse-job-board")
    dom_markers = ("application_form", "greenhouse", "submit application")
    preferred_form_selectors = ("form#application-form", "form#application_form", "form.application--form", "form")


class LeverAdapter(BaseExternalApplyAdapter):
    provider = "lever"
    host_markers = ("jobs.lever.co", "lever.co")
    dom_markers = ("lever", "application-form", "submit application")
    preferred_form_selectors = ("form#application-form", "form#application_form", "form.application-form", "form")

    def _fill_provider_specific_fields(
        self, form: WebElement, ctx: ExternalApplyContext, visited: set[str]
    ) -> list[str]:
        unresolved: list[str] = []
        try:
            location_field = form.find_element(By.CSS_SELECTOR, "input#location-input")
        except Exception:
            location_field = None
        if location_field is None:
            return unresolved

        key = self._field_key(location_field)
        if key in visited:
            return unresolved
        visited.add(key)

        label = self._extract_label(location_field) or self._extract_group_label(location_field) or "Current location"
        answer, used_ai, needs_review = resolve_text_answer(
            label,
            work_location=ctx.work_location,
            question_type="text",
            provider=self.provider,
            ai_client=ctx.ai_client,
            job_description=ctx.job_description,
        )
        if answer:
            try:
                self._write_text(location_field, answer)
                dropdown_options = self._find_visible_options(ctx.driver)
                normalized_answer = normalize_label(answer)
                for option in dropdown_options:
                    option_text = normalize_label(_safe_text(option))
                    if option_text == normalized_answer or normalized_answer in option_text or option_text in normalized_answer:
                        option.click()
                        buffer(1)
                        break
                else:
                    location_field.send_keys(Keys.ARROW_DOWN)
                    location_field.send_keys(Keys.ENTER)
                    buffer(1)
                try:
                    hidden = form.find_element(By.CSS_SELECTOR, "input#selected-location")
                    if not coerce_text_value(hidden.get_attribute("value") or "") and self._is_required(location_field):
                        unresolved.append(label)
                except Exception:
                    pass
            except Exception as exc:
                print_lg(f"Failed to set Lever location for {ctx.title}: {exc}")
                if self._is_required(location_field):
                    unresolved.append(label)
        elif self._is_required(location_field):
            unresolved.append(label)
        if used_ai:
            print_lg(f'AI answered external Lever field "{label}" with "{answer}"')
        if needs_review and self._is_required(location_field):
            unresolved.append(label)
        return unresolved

    def _find_remaining_required_fields(self, form: WebElement) -> list[str]:
        unresolved = super()._find_remaining_required_fields(form)
        try:
            location_field = form.find_element(By.CSS_SELECTOR, "input#location-input")
            hidden = form.find_element(By.CSS_SELECTOR, "input#selected-location")
            if (
                _is_visible(location_field)
                and self._is_required(location_field)
                and not coerce_text_value(hidden.get_attribute("value") or "")
            ):
                unresolved.append(self._extract_label(location_field) or self._extract_group_label(location_field) or "Current location")
        except Exception:
            pass
        return [item for item in dict.fromkeys(unresolved) if item]


class AshbyAdapter(BaseExternalApplyAdapter):
    provider = "ashby"
    host_markers = ("ashbyhq.com",)
    dom_markers = ("ashby", "submit application", "application")
    preferred_form_selectors = ("form[data-testid='application-form']", "form",)

    def open_or_attach_context(self, driver) -> None:
        current_url = driver.current_url or ""
        if "/application" in current_url:
            self._wait_for_application_content(driver)
            return

        candidates = []
        for selector in (
            "a#job-application-form",
            "a.ashby-job-posting-right-pane-application-tab",
            "a[href*='/application']",
            "a[href*='application?']",
        ):
            try:
                candidates.extend(driver.find_elements(By.CSS_SELECTOR, selector))
            except Exception:
                continue

        target_url = ""
        for candidate in candidates:
            href = candidate.get_attribute("href") or ""
            if "/application" in href:
                target_url = urljoin(current_url, href)
                break

        if not target_url:
            try:
                apply_link = driver.find_element(
                    By.XPATH,
                    "//a[contains(normalize-space(), 'Apply for this Job') or contains(@href, '/application')]",
                )
                target_url = urljoin(current_url, apply_link.get_attribute("href") or "")
            except Exception:
                target_url = ""

        if not target_url:
            return

        driver.get(target_url)
        deadline = time.time() + 10
        while time.time() < deadline:
            if "/application" in (driver.current_url or ""):
                self._wait_for_application_content(driver)
                return
            buffer(1)

    def _wait_for_application_content(self, driver, timeout_seconds: int = 12) -> None:
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            form = super()._find_form(driver)
            if form is not None:
                return
            container = self._find_fillable_container(
                driver,
                selectors=(
                    "[role='tabpanel'][aria-labelledby='job-application-form']",
                    "[data-testid*='application']",
                    "[id='form']",
                    "main",
                    "body",
                ),
                minimum_fields=1,
            )
            if container is not None:
                return
            buffer(1)

    def _find_form(self, driver) -> WebElement | None:
        form = super()._find_form(driver)
        if form is not None:
            return form
        container = self._find_fillable_container(
            driver,
            selectors=(
                "[role='tabpanel'][aria-labelledby='job-application-form']",
                "[data-testid*='application']",
                "[id='form']",
                "main",
                "body",
            ),
            minimum_fields=1,
        )
        if container is not None:
            print_lg("Ashby fallback container selected for application parsing.")
            return container
        return None


class UnsupportedExternalAdapter(BaseExternalApplyAdapter):
    provider = "unsupported_external"

    def detect(self, driver) -> bool:
        return True

    def run(self, ctx: ExternalApplyContext) -> ExternalApplyResult:
        driver = ctx.driver
        engine = ContextAIEngine()

        # Always check for auth — no point waiting on a login page
        try:
            requires_auth, auth_reason = engine.check_requires_auth(driver)
            if requires_auth:
                print_lg(f"[AuthCheck] Unsupported portal auth page: {auth_reason}")
                return ExternalApplyResult(
                    provider=self.provider,
                    application_link=driver.current_url,
                    stage="skipped",
                    skipped=True,
                    reason=auth_reason,
                )
        except Exception:
            pass

        result = super().run(ctx)
        if result.stage == "failed" and not result.review_required and not result.filled_fields:
            result.stage = "unsupported"
            result.unsupported = True
            result.reason = result.reason or "The bot could not automate this unsupported external portal."
        return result


ADAPTERS = [GreenhouseAdapter(), LeverAdapter(), AshbyAdapter()]


def detect_adapter(driver) -> BaseExternalApplyAdapter:
    for adapter in ADAPTERS:
        try:
            if adapter.detect(driver):
                return adapter
        except Exception as exc:
            print_lg(f"Provider detection failed for {adapter.provider}: {exc}")
    return UnsupportedExternalAdapter()
