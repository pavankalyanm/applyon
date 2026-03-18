from __future__ import annotations

from typing import Literal
from difflib import SequenceMatcher
import re

from config._runtime import get_section
from config.personals import (
    current_city,
    disability_status,
    ethnicity,
    first_name,
    gender,
    last_name,
    middle_name,
    phone_number,
    state,
    street,
    veteran_status,
    zipcode,
    country,
)
from config.questions import (
    confidence_level,
    cover_letter,
    current_ctc,
    desired_salary,
    linkedIn,
    linkedin_headline,
    linkedin_summary,
    notice_period,
    recent_employer,
    require_visa,
    us_citizenship,
    user_information_all,
    website,
    years_of_experience,
)
from config.search import current_experience
from config.secrets import ai_provider, use_AI, username

from modules.helpers import print_lg


QuestionType = Literal["text", "textarea", "single_select", "multiple_select"]


RISKY_LABEL_PARTS = (
    "citizenship",
    "authorization",
    "visa",
    "sponsorship",
    "veteran",
    "disability",
    "ethnicity",
    "race",
    "gender",
    "sex",
    "salary",
    "compensation",
    "pay",
    "ctc",
    "notice",
    "clearance",
    "felony",
    "conviction",
    "criminal",
    "dob",
    "date of birth",
    "social security",
)


def normalize_label(label: str | None) -> str:
    return " ".join((label or "").replace("\xa0", " ").strip().lower().split())


def _learned_answers() -> list[dict]:
    try:
        section = get_section("other")
    except Exception:
        return []
    items = section.get("learned_answers")
    if not isinstance(items, list):
        return []
    return [item for item in items if isinstance(item, dict)]


def _full_name() -> str:
    parts = [first_name.strip(), middle_name.strip(), last_name.strip()]
    return " ".join(part for part in parts if part)


def _normalize_currency_answers(value):
    if value is None:
        return "", "", ""
    numeric = float(value)
    whole = str(int(numeric)) if numeric.is_integer() else str(numeric)
    lakhs = str(round(numeric / 100000, 2))
    monthly = str(round(numeric / 12, 2))
    return lakhs, monthly, whole


def _normalize_duration_answers(value):
    if value is None:
        return "", "", ""
    numeric = int(value)
    return str(numeric // 30), str(numeric // 7), str(numeric)


DESIRED_SALARY_LAKHS, DESIRED_SALARY_MONTHLY, DESIRED_SALARY = _normalize_currency_answers(desired_salary)
CURRENT_CTC_LAKHS, CURRENT_CTC_MONTHLY, CURRENT_CTC = _normalize_currency_answers(current_ctc)
NOTICE_PERIOD_MONTHS, NOTICE_PERIOD_WEEKS, NOTICE_PERIOD = _normalize_duration_answers(notice_period)


def is_risky_label(label: str | None) -> bool:
    normalized = normalize_label(label)
    return any(part in normalized for part in RISKY_LABEL_PARTS)


def _match_option_text(desired: str, options: list[str]) -> str | None:
    if not desired:
        return None

    normalized_desired = normalize_label(desired)
    if not normalized_desired:
        return None

    synonyms = [normalized_desired]
    if normalized_desired == "decline":
        synonyms.extend(["prefer not to say", "prefer not", "decline to answer", "i don't wish"])
    elif normalized_desired in {"yes", "true"}:
        synonyms.extend(["agree", "i do", "authorized", "eligible"])
    elif normalized_desired in {"no", "false"}:
        synonyms.extend(["disagree", "i do not", "not authorized", "ineligible"])

    normalized_options = [(option, normalize_label(option)) for option in options]

    for option, normalized_option in normalized_options:
        if normalized_option == normalized_desired:
            return option
    for synonym in synonyms:
        for option, normalized_option in normalized_options:
            if synonym and (synonym in normalized_option or normalized_option in synonym):
                return option
    return None


def _find_learned_answer(
    label: str,
    *,
    question_type: QuestionType,
    provider: str | None = None,
    options: list[str] | None = None,
) -> str | None:
    normalized_label = normalize_label(label)
    if not normalized_label:
        return None

    provider_key = normalize_label(provider or "")
    best_match: tuple[float, str] | None = None
    for item in _learned_answers():
        stored_question = normalize_label(item.get("normalized_question") or item.get("question"))
        stored_type = normalize_label(item.get("question_type") or "text") or "text"
        stored_provider = normalize_label(item.get("provider") or "")
        if stored_type != normalize_label(question_type):
            continue

        if stored_question == normalized_label:
            score = 1.0
        else:
            score = SequenceMatcher(None, stored_question, normalized_label).ratio()
        if score < 0.84:
            continue
        if provider_key and stored_provider == provider_key:
            score += 0.05
        elif provider_key and stored_provider and stored_provider != provider_key:
            score -= 0.04

        raw_answer = str(item.get("answer") or "").strip()
        if not raw_answer:
            continue
        resolved_answer = raw_answer
        if options:
            resolved_answer = _match_option_text(raw_answer, options) or ""
            if not resolved_answer:
                continue
            if isinstance(item.get("options"), list):
                overlap = len(
                    {
                        normalize_label(option)
                        for option in item.get("options")
                        if isinstance(option, str)
                    }
                    & {normalize_label(option) for option in options}
                )
                if overlap:
                    score += 0.03

        if best_match is None or score > best_match[0]:
            best_match = (score, resolved_answer)

    if best_match is not None:
        print_lg(f'Using learned answer for "{label}"')
        return best_match[1]
    return None


def _known_text_answer(label: str, work_location: str) -> str:
    normalized = normalize_label(label)
    email = username.strip() if "@" in username else ""

    if "experience" in normalized or "years" in normalized:
        return years_of_experience or (str(current_experience) if current_experience is not None else "")
    if "email" in normalized:
        return email
    if "phone" in normalized or "mobile" in normalized:
        return phone_number
    if "street" in normalized:
        return street
    if "city" in normalized or "location" in normalized or "address" in normalized:
        return current_city or work_location
    if "signature" in normalized:
        return _full_name()
    if "name" in normalized:
        if "full" in normalized:
            return _full_name()
        if "first" in normalized and "last" not in normalized:
            return first_name
        if "middle" in normalized and "last" not in normalized:
            return middle_name
        if "last" in normalized and "first" not in normalized:
            return last_name
        if "employer" in normalized:
            return recent_employer
        return _full_name()
    if "notice" in normalized:
        if "month" in normalized:
            return NOTICE_PERIOD_MONTHS
        if "week" in normalized:
            return NOTICE_PERIOD_WEEKS
        return NOTICE_PERIOD
    if "salary" in normalized or "compensation" in normalized or "ctc" in normalized or "pay" in normalized:
        if "current" in normalized or "present" in normalized:
            if "month" in normalized:
                return CURRENT_CTC_MONTHLY
            if "lakh" in normalized:
                return CURRENT_CTC_LAKHS
            return CURRENT_CTC
        if "month" in normalized:
            return DESIRED_SALARY_MONTHLY
        if "lakh" in normalized:
            return DESIRED_SALARY_LAKHS
        return DESIRED_SALARY
    if "linkedin" in normalized:
        return linkedIn
    if "website" in normalized or "blog" in normalized or "portfolio" in normalized or "link" in normalized:
        return website
    if "scale of 1-10" in normalized:
        return confidence_level
    if "headline" in normalized:
        return linkedin_headline
    if ("hear" in normalized or "come across" in normalized) and "this" in normalized and ("job" in normalized or "position" in normalized):
        return ""
    if "state" in normalized or "province" in normalized:
        return state
    if "zip" in normalized or "postal" in normalized or "code" in normalized:
        return zipcode
    if "country" in normalized:
        return country
    return ""


def _known_textarea_answer(label: str) -> str:
    normalized = normalize_label(label)
    if "summary" in normalized:
        return linkedin_summary
    if "cover" in normalized:
        return cover_letter
    return ""


def _known_choice_answer(label: str, options: list[str], work_location: str) -> str | None:
    normalized = normalize_label(label)
    desired = ""

    if "email" in normalized or "phone" in normalized:
        return None
    if "gender" in normalized or "sex" in normalized:
        desired = gender
    elif "ethnicity" in normalized or "race" in normalized:
        desired = ethnicity
    elif "disability" in normalized:
        desired = disability_status
    elif "veteran" in normalized or "protected" in normalized:
        desired = veteran_status
    elif "citizenship" in normalized or "employment eligibility" in normalized:
        desired = us_citizenship
    elif "sponsorship" in normalized or "visa" in normalized or "authorization" in normalized:
        desired = require_visa
    elif "country" in normalized:
        desired = country
    elif "state" in normalized or "province" in normalized:
        desired = state
    elif "city" in normalized or "location" in normalized:
        desired = current_city or work_location
    elif "proficiency" in normalized:
        desired = "Professional"

    if not desired:
        return None
    return _match_option_text(desired, options)


def _should_use_ai(label: str, answer: str) -> bool:
    return use_AI and not answer and not is_risky_label(label)


def _ask_ai_question(
    client,
    label: str,
    *,
    question_type: QuestionType,
    options: list[str] | None = None,
    job_description: str | None = None,
) -> str:
    if not client or not use_AI:
        return ""

    provider = str(ai_provider).lower()
    try:
        if provider in ["openai", "groq"]:
            from modules.ai.openaiConnections import ai_answer_question

            return str(
                ai_answer_question(
                    client,
                    label,
                    options=options,
                    question_type=question_type,
                    job_description=job_description,
                    user_information_all=user_information_all,
                )
                or ""
            ).strip()
        if provider == "deepseek":
            from modules.ai.deepseekConnections import deepseek_answer_question

            return str(
                deepseek_answer_question(
                    client,
                    label,
                    options=options,
                    question_type=question_type,
                    job_description=job_description,
                    about_company=None,
                    user_information_all=user_information_all,
                )
                or ""
            ).strip()
        if provider == "gemini":
            from modules.ai.geminiConnections import gemini_answer_question

            return str(
                gemini_answer_question(
                    client,
                    label,
                    options=options,
                    question_type=question_type,
                    job_description=job_description,
                    about_company=None,
                    user_information_all=user_information_all,
                )
                or ""
            ).strip()
    except Exception as exc:
        print_lg(f'AI failed to answer "{label}": {exc}')
    return ""


def resolve_text_answer(
    label: str,
    *,
    work_location: str,
    question_type: Literal["text", "textarea"],
    provider: str | None = None,
    ai_client=None,
    job_description: str | None = None,
) -> tuple[str, bool, bool]:
    answer = _known_textarea_answer(label) if question_type == "textarea" else _known_text_answer(label, work_location)
    used_ai = False

    if not answer:
        learned_answer = _find_learned_answer(
            label,
            question_type=question_type,
            provider=provider,
        )
        if learned_answer:
            answer = learned_answer

    if _should_use_ai(label, answer):
        ai_answer = _ask_ai_question(
            ai_client,
            label,
            question_type=question_type,
            job_description=job_description,
        )
        if ai_answer:
            answer = ai_answer
            used_ai = True

    unresolved = not bool(str(answer).strip())
    return str(answer).strip(), used_ai, unresolved


def resolve_choice_answer(
    label: str,
    options: list[str],
    *,
    work_location: str,
    question_type: Literal["single_select", "multiple_select"] = "single_select",
    provider: str | None = None,
    ai_client=None,
    job_description: str | None = None,
) -> tuple[str | None, bool, bool]:
    answer = _known_choice_answer(label, options, work_location)
    used_ai = False

    if answer is None:
        answer = _find_learned_answer(
            label,
            question_type=question_type,
            provider=provider,
            options=options,
        )

    if answer is None and _should_use_ai(label, ""):
        ai_answer = _ask_ai_question(
            ai_client,
            label,
            question_type=question_type,
            options=options,
            job_description=job_description,
        )
        answer = _match_option_text(ai_answer, options)
        used_ai = bool(answer)

    unresolved = answer is None
    return answer, used_ai, unresolved


def resolve_checkbox_answer(label: str) -> tuple[bool | None, bool]:
    normalized = normalize_label(label)
    if any(keyword in normalized for keyword in ("privacy", "terms", "consent", "authorize", "acknowledge", "agreement")):
        return True, False
    if "veteran" in normalized or "disability" in normalized or "citizenship" in normalized:
        return None, True
    return None, False


def is_resume_upload_label(label: str) -> bool:
    normalized = normalize_label(label)
    return any(keyword in normalized for keyword in ("resume", "cv", "curriculum vitae"))


def coerce_text_value(value: str) -> str:
    cleaned = re.sub(r"\s+", " ", value or "").strip()
    return cleaned
