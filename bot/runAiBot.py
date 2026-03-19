# Imports
from typing import Literal, Optional
from modules.validator import validate_config
from modules.clickers_and_finders import *
from modules.helpers import *
from modules.open_chrome import *
from modules.external_apply.adapters import ExternalApplyContext, ExternalApplyResult, detect_adapter
from modules.visual_cursor import ensure_visual_cursor, show_cursor_click, show_cursor_scroll, show_cursor_typing
from config.settings import *
from config.secrets import use_AI, username, password, ai_provider
from config.search import *
from config.questions import *
from config.personals import *
from config.outreach import *
from selenium.common.exceptions import NoSuchElementException, ElementClickInterceptedException, NoSuchWindowException, ElementNotInteractableException, WebDriverException
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support.select import Select
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from datetime import datetime
from random import choice, shuffle, randint
import os
import csv
import re
import time
import pyautogui
import json
from urllib.parse import quote

# Use a fallback when Tkinter is missing (e.g. Homebrew Python on macOS without python-tk)


BOT_STOP_FILE = os.getenv("BOT_STOP_FILE", "")
BOT_CONFIG_PATH = os.getenv("BOT_CONFIG_PATH", "")
BOT_DISABLE_DIALOGS = bool(os.getenv("BOT_DISABLE_DIALOGS") or run_in_background)

# Load context AI page-context cache (pre-loaded by backend at run start)
try:
    from config._runtime import load_runtime_config as _load_runtime_config
    _runtime_cfg = _load_runtime_config()
    _context_ai_cache: dict = _runtime_cfg.get("context_ai_cache") or {}
except Exception:
    _context_ai_cache = {}


def should_stop() -> bool:
    return bool(BOT_STOP_FILE) and os.path.exists(BOT_STOP_FILE)


class StopRequested(Exception):
    pass


def _dialog_text(args, kwargs) -> tuple[str, str]:
    msg = kwargs.get("text", args[0] if args else "")
    title_arg = args[1] if len(args) > 1 and isinstance(args[1], str) else "Alert"
    title = kwargs.get("title", title_arg)
    return str(msg), str(title)


def _dialog_buttons(args, kwargs) -> list[str]:
    if len(args) >= 3 and isinstance(args[2], (list, tuple)):
        return list(args[2])
    if len(args) >= 3 and isinstance(args[2], str):
        return [args[2]]
    if len(args) >= 2 and isinstance(args[1], (list, tuple)):
        return list(args[1])
    buttons = kwargs.get("buttons")
    if isinstance(buttons, (list, tuple)):
        return list(buttons)
    button = kwargs.get("button")
    if button:
        return [str(button)]
    return ["OK"]


def _safe_alert(*args, **kwargs):
    msg, title = _dialog_text(args, kwargs)
    button = _dialog_buttons(args, kwargs)[-1]
    if BOT_DISABLE_DIALOGS or should_stop():
        print(f"\n[{title}] {msg}\n(No dialog shown; continuing with: {button})\n")
        return button
    try:
        return pyautogui._original_alert(*args, **kwargs)
    except Exception:
        print(f"\n[{title}] {msg}\n(No dialog available; continuing with: {button})\n")
        return button


def _safe_confirm(*args, **kwargs):
    msg, title = _dialog_text(args, kwargs)
    buttons = _dialog_buttons(args, kwargs)
    default = buttons[-1] if buttons else "OK"
    if BOT_DISABLE_DIALOGS or should_stop():
        print(f"\n[{title}] {msg}\n(No dialog shown; continuing with: {default})\n")
        return default
    try:
        return pyautogui._original_confirm(*args, **kwargs)
    except Exception:
        print(f"\n[{title}] {msg}\n(No dialog available; continuing with: {default})\n")
        return default


pyautogui._original_alert = pyautogui.alert
pyautogui.alert = _safe_alert
pyautogui._original_confirm = pyautogui.confirm
pyautogui.confirm = _safe_confirm

def ensure_not_stopping(context: str | None = None) -> None:
    if not should_stop():
        return
    if context:
        print_step("Stop requested", context)
    else:
        print_lg("Stop requested. Exiting current flow.")
    raise StopRequested(context or "Stop requested")


def sleep_with_stop(seconds: float, interval: float = 0.25) -> None:
    deadline = time.monotonic() + max(seconds, 0)
    while time.monotonic() < deadline:
        ensure_not_stopping()
        remaining = deadline - time.monotonic()
        time.sleep(min(interval, max(remaining, 0)))


# Set CSV field size limit to prevent field size errors
csv.field_size_limit(1000000)  # Set to 1MB instead of default 131KB


ai_create_openai_client = ai_extract_skills = ai_answer_question = ai_close_openai_client = None
deepseek_create_client = deepseek_extract_skills = deepseek_answer_question = None
gemini_create_client = gemini_extract_skills = gemini_answer_question = None

if use_AI:
    selected_ai_provider = str(ai_provider).lower()
    if selected_ai_provider in ["openai", "groq"]:
        from modules.ai.openaiConnections import ai_create_openai_client, ai_extract_skills, ai_answer_question, ai_close_openai_client
    elif selected_ai_provider == "deepseek":
        from modules.ai.deepseekConnections import deepseek_create_client, deepseek_extract_skills, deepseek_answer_question
    elif selected_ai_provider == "gemini":
        from modules.ai.geminiConnections import gemini_create_client, gemini_extract_skills, gemini_answer_question


pyautogui.FAILSAFE = False
# if use_resume_generator:    from resume_generator import is_logged_in_GPT, login_GPT, open_resume_chat, create_custom_resume


# < Global Variables and logics

if run_in_background == True:
    pause_at_failed_question = False
    pause_before_submit = False
    run_non_stop = False

first_name = first_name.strip()
middle_name = middle_name.strip()
last_name = last_name.strip()
full_name = first_name + " " + middle_name + " " + \
    last_name if middle_name else first_name + " " + last_name

useNewResume = True
randomly_answered_questions = set()

tabs_count = 1
easy_applied_count = 0
external_jobs_count = 0
failed_count = 0
skip_count = 0
outreach_count = 0
dailyEasyApplyLimitReached = False

re_experience = re.compile(
    r'[(]?\s*(\d+)\s*[)]?\s*[-to]*\s*\d*[+]*\s*year[s]?', re.IGNORECASE)

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


desired_salary_lakhs, desired_salary_monthly, desired_salary = _normalize_currency_answers(desired_salary)
current_ctc_lakhs, current_ctc_monthly, current_ctc = _normalize_currency_answers(current_ctc)
notice_period_months, notice_period_weeks, notice_period = _normalize_duration_answers(notice_period)

aiClient = None
about_company_for_ai = None  # TODO extract about company for AI

# >


# < Login Functions
def is_logged_in_LN() -> bool:
    '''
    Function to check if user is logged-in in LinkedIn
    * Returns: `True` if user is logged-in or `False` if not
    '''
    if driver.current_url == "https://www.linkedin.com/feed/":
        return True
    if try_linkText(driver, "Sign in"):
        return False
    if try_xp(driver, '//button[@type="submit" and contains(text(), "Sign in")]'):
        return False
    if try_linkText(driver, "Join now"):
        return False
    print_lg("Didn't find Sign in link, so assuming user is logged in!")
    return True


def login_LN() -> None:
    '''
    Function to login for LinkedIn
    * Tries to login using given `username` and `password` from `secrets.py`
    * If failed, tries to login using saved LinkedIn profile button if available
    * If both failed, asks user to login manually
    '''
    print_step("Opening LinkedIn login")
    # Find the username and password fields and fill them with user credentials
    driver.get("https://www.linkedin.com/login")
    if username == "username@example.com" and password == "example_password":
        pyautogui.alert(
            "User did not configure username and password in secrets.py, hence can't login automatically! Please login manually!", "Login Manually", "Okay")
        print_lg("User did not configure username and password in secrets.py, hence can't login automatically! Please login manually!")
        manual_login_retry(is_logged_in_LN, 2)
        return
    try:
        wait.until(EC.presence_of_element_located(
            (By.LINK_TEXT, "Forgot password?")))
        try:
            text_input_by_ID(driver, "username", username, 1)
        except Exception as e:
            print_lg("Couldn't find username field.")
            # print_lg(e)
        try:
            text_input_by_ID(driver, "password", password, 1)
        except Exception as e:
            print_lg("Couldn't find password field.")
            # print_lg(e)
        # Find the login submit button and click it
        driver.find_element(
            By.XPATH, '//button[@type="submit" and contains(text(), "Sign in")]').click()
    except Exception as e1:
        try:
            profile_button = find_by_class(driver, "profile__details")
            profile_button.click()
        except Exception as e2:
            # print_lg(e1, e2)
            print_lg("Couldn't Login!")

    try:
        # Wait until successful redirect, indicating successful login
        # wait.until(EC.presence_of_element_located((By.XPATH, '//button[normalize-space(.)="Start a post"]')))
        wait.until(EC.url_to_be("https://www.linkedin.com/feed/"))
        return print_lg("Login successful!")
    except Exception as e:
        print_lg("Seems like login attempt failed! Possibly due to wrong credentials or already logged in! Try logging in manually!")
        # print_lg(e)
        manual_login_retry(is_logged_in_LN, 2)
# >


def get_applied_job_ids() -> set[str]:
    '''
    Function to get a `set` of applied job's Job IDs
    * Returns a set of Job IDs from existing applied jobs history csv file
    '''
    job_ids: set[str] = set()
    try:
        with open(file_name, 'r', encoding='utf-8') as file:
            reader = csv.reader(file)
            for row in reader:
                job_ids.add(row[0])
    except FileNotFoundError:
        print_lg(f"The CSV file '{file_name}' does not exist.")
    return job_ids


def set_search_location() -> None:
    '''
    Function to set search location
    '''
    if search_location.strip():
        print_step("Setting search location", search_location.strip())
        try:
            print_lg(
                f'Setting search location as: "{search_location.strip()}"')
            # and not(@aria-hidden='true')]")
            search_location_ele = try_xp(
                driver, ".//input[@aria-label='City, state, or zip code'and not(@disabled)]", False)
            text_input(actions, search_location_ele,
                       search_location, "Search Location")
        except ElementNotInteractableException:
            try_xp(
                driver, ".//label[@class='jobs-search-box__input-icon jobs-search-box__keywords-label']")
            actions.send_keys(Keys.TAB, Keys.TAB).perform()
            actions.key_down(Keys.CONTROL).send_keys(
                "a").key_up(Keys.CONTROL).perform()
            actions.send_keys(search_location.strip()).perform()
            sleep_with_stop(2)
            actions.send_keys(Keys.ENTER).perform()
            try_xp(driver, ".//button[@aria-label='Cancel']")
        except Exception as e:
            try_xp(driver, ".//button[@aria-label='Cancel']")
            print_lg(
                "Failed to update search location, continuing with default location!", e)


def apply_filters() -> None:
    '''
    Function to apply job search filters
    '''
    print_step("Applying LinkedIn filters",
               f"sort={sort_by}, date={date_posted}")
    ensure_not_stopping("before applying LinkedIn filters")
    set_search_location()

    try:
        recommended_wait = 1 if click_gap < 1 else 0

        wait.until(EC.presence_of_element_located(
            (By.XPATH, '//button[normalize-space()="All filters"]'))).click()
        buffer(recommended_wait)

        wait_span_click(driver, sort_by)
        wait_span_click(driver, date_posted)
        buffer(recommended_wait)

        multi_sel_noWait(driver, experience_level)
        multi_sel_noWait(driver, companies, actions)
        if experience_level or companies:
            buffer(recommended_wait)

        multi_sel_noWait(driver, job_type)
        multi_sel_noWait(driver, on_site)
        if job_type or on_site:
            buffer(recommended_wait)

        if easy_apply_only:
            boolean_button_click(driver, actions, "Easy Apply")

        multi_sel_noWait(driver, location)
        multi_sel_noWait(driver, industry)
        if location or industry:
            buffer(recommended_wait)

        multi_sel_noWait(driver, job_function)
        multi_sel_noWait(driver, job_titles)
        if job_function or job_titles:
            buffer(recommended_wait)

        if under_10_applicants:
            boolean_button_click(driver, actions, "Under 10 applicants")
        if in_your_network:
            boolean_button_click(driver, actions, "In your network")
        if fair_chance_employer:
            boolean_button_click(driver, actions, "Fair Chance Employer")

        wait_span_click(driver, salary)
        buffer(recommended_wait)

        multi_sel_noWait(driver, benefits)
        multi_sel_noWait(driver, commitments)
        if benefits or commitments:
            buffer(recommended_wait)

        show_results_button: WebElement = driver.find_element(
            By.XPATH, '//button[contains(translate(@aria-label, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "apply current filters to show")]')
        show_results_button.click()

        global pause_after_filters
        ensure_not_stopping("after applying LinkedIn filters")
        if pause_after_filters and "Turn off Pause after search" == pyautogui.confirm("These are your configured search results and filter. It is safe to change them while this dialog is open, any changes later could result in errors and skipping this search run.", "Please check your results", ["Turn off Pause after search", "Look's good, Continue"]):
            pause_after_filters = False

    except StopRequested:
        raise
    except Exception as e:
        print_lg("Setting the preferences failed!")
        pyautogui.confirm(f"Faced error while applying filters. Please make sure correct filters are selected, click on show results and click on any button of this dialog, I know it sucks. Can't turn off Pause after search when error occurs! ERROR: {e}", [
                          "Doesn't look good, but Continue XD", "Look's good, Continue"])
        # print_lg(e)


def get_page_info() -> tuple[WebElement | None, int | None]:
    '''
    Function to get pagination element and current page number
    '''
    try:
        pagination_element = try_find_by_classes(
            driver, ["jobs-search-pagination__pages", "artdeco-pagination", "artdeco-pagination__pages"])
        scroll_to_view(driver, pagination_element)
        current_page = int(pagination_element.find_element(
            By.XPATH, "//button[contains(@class, 'active')]").text)
    except Exception as e:
        print_lg("Failed to find Pagination element, hence couldn't scroll till end!")
        pagination_element = None
        current_page = None
        print_lg(e)
    return pagination_element, current_page


def _clean_job_card_text(value: str | None) -> str:
    return " ".join((value or "").replace("\xa0", " ").split())


def _find_first_text_by_class(root: WebElement, class_names: list[str]) -> str:
    for class_name in class_names:
        try:
            elements = root.find_elements(By.CLASS_NAME, class_name)
        except Exception:
            elements = []
        for element in elements:
            text = _clean_job_card_text(element.text)
            if text:
                return text
    return ""


def _extract_location_and_style(raw_text: str) -> tuple[str, str]:
    text = _clean_job_card_text(raw_text)
    if not text:
        return "", ""

    work_style = ""
    trailing_style = re.search(r"\(([^()]+)\)\s*$", text)
    if trailing_style:
        work_style = _clean_job_card_text(trailing_style.group(1))
        text = text[:trailing_style.start()].strip(" -|·•")

    style_aliases = {"remote", "hybrid", "on-site", "onsite", "on site"}
    for separator in (" · ", " • ", " | ", " - "):
        if separator not in text:
            continue
        parts = [part.strip()
                 for part in text.split(separator) if part.strip()]
        if len(parts) < 2:
            continue
        if parts[-1].lower() in style_aliases and not work_style:
            work_style = parts[-1]
            text = separator.join(parts[:-1]).strip()
        break

    if text.lower() in style_aliases and not work_style:
        return "", text
    return text, work_style


def _parse_company_and_location(subtitle_text: str, caption_text: str) -> tuple[str, str, str]:
    subtitle = _clean_job_card_text(subtitle_text)
    caption = _clean_job_card_text(caption_text)

    company = subtitle
    fallback_location = ""
    fallback_style = ""

    for separator in (" · ", " • ", " | ", " - "):
        if separator not in subtitle:
            continue
        parts = [part.strip()
                 for part in subtitle.split(separator) if part.strip()]
        if len(parts) >= 2:
            company = parts[0]
            fallback_location, fallback_style = _extract_location_and_style(
                separator.join(parts[1:]))
            break

    work_location, work_style = _extract_location_and_style(caption)
    if not work_location:
        work_location = fallback_location
    if not work_style:
        work_style = fallback_style

    return company, work_location, work_style


def get_job_main_details(job: WebElement, blacklisted_companies: set, rejected_jobs: set) -> tuple[str, str, str, str, str, bool]:
    '''
    # Function to get job main details.
    Returns a tuple of (job_id, title, company, work_location, work_style, skip)
    * job_id: Job ID
    * title: Job title
    * company: Company name
    * work_location: Work location of this job
    * work_style: Work style of this job (Remote, On-site, Hybrid)
    * skip: A boolean flag to skip this job
    '''
    skip = False
    # job.find_element(By.CLASS_NAME, "job-card-list__title")  # Problem in India
    job_details_button = job.find_element(By.TAG_NAME, 'a')
    scroll_to_view(driver, job_details_button, True)
    job_id = job.get_dom_attribute('data-occludable-job-id')
    title = job_details_button.text
    title = title[:title.find("\n")]
    company = _find_first_text_by_class(
        job, ["job-card-container__primary-description"])
    subtitle_text = _find_first_text_by_class(
        job, ["artdeco-entity-lockup__subtitle"])
    caption_text = _find_first_text_by_class(
        job,
        [
            "artdeco-entity-lockup__caption",
            "job-card-container__metadata-item",
            "job-card-container__metadata-wrapper",
        ],
    )
    parsed_company, work_location, work_style = _parse_company_and_location(
        subtitle_text, caption_text)
    if not company:
        company = parsed_company

    # Skip if previously rejected due to blacklist or already applied
    if company in blacklisted_companies:
        print_lg(
            f'Skipping "{title} | {company}" job (Blacklisted Company). Job ID: {job_id}!')
        skip = True
    elif job_id in rejected_jobs:
        print_lg(
            f'Skipping previously rejected "{title} | {company}" job. Job ID: {job_id}!')
        skip = True
    try:
        if job.find_element(By.CLASS_NAME, "job-card-container__footer-job-state").text == "Applied":
            skip = True
            print_lg(
                f'Already applied to "{title} | {company}" job. Job ID: {job_id}!')
    except:
        pass
    try:
        if not skip:
            job_details_button.click()
    except Exception as e:
        print_lg(
            f'Failed to click "{title} | {company}" job on details button. Job ID: {job_id}!')
        # print_lg(e)
        discard_job()
        job_details_button.click()  # To pass the error outside
    buffer(click_gap)
    return (job_id, title, company, work_location, work_style, skip)


# Function to check for Blacklisted words in About Company
def check_blacklist(rejected_jobs: set, job_id: str, company: str, blacklisted_companies: set) -> tuple[set, set, WebElement] | ValueError:
    jobs_top_card = try_find_by_classes(driver, ["job-details-jobs-unified-top-card__primary-description-container",
                                        "job-details-jobs-unified-top-card__primary-description", "jobs-unified-top-card__primary-description", "jobs-details__main-content"])
    about_company_org = find_by_class(driver, "jobs-company__box")
    scroll_to_view(driver, about_company_org)
    about_company_org = about_company_org.text
    about_company = about_company_org.lower()
    skip_checking = False
    for word in about_company_good_words:
        if word.lower() in about_company:
            print_lg(
                f'Found the word "{word}". So, skipped checking for blacklist words.')
            skip_checking = True
            break
    if not skip_checking:
        for word in about_company_bad_words:
            if word.lower() in about_company:
                rejected_jobs.add(job_id)
                blacklisted_companies.add(company)
                raise ValueError(
                    f'\n"{about_company_org}"\n\nContains "{word}".')
    buffer(click_gap)
    scroll_to_view(driver, jobs_top_card)
    return rejected_jobs, blacklisted_companies, jobs_top_card


# Function to extract years of experience required from About Job
def extract_years_of_experience(text: str) -> int:
    # Extract all patterns like '10+ years', '5 years', '3-5 years', etc.
    matches = re.findall(re_experience, text)
    if len(matches) == 0:
        print_lg(
            f'\n{text}\n\nCouldn\'t find experience requirement in About the Job!')
        return 0
    return max([int(match) for match in matches if int(match) <= 12])


def get_job_description(
) -> tuple[
    str | Literal['Unknown'],
    int | Literal['Unknown'],
    bool,
    str | None,
    str | None
]:
    '''
    # Job Description
    Function to extract job description from About the Job.
    ### Returns:
    - `jobDescription: str | 'Unknown'`
    - `experience_required: int | 'Unknown'`
    - `skip: bool`
    - `skipReason: str | None`
    - `skipMessage: str | None`
    '''
    try:
        jobDescription = "Unknown"
        experience_required = "Unknown"
        found_masters = 0
        jobDescription = find_by_class(driver, "jobs-box__html-content").text
        jobDescriptionLow = jobDescription.lower()
        skip = False
        skipReason = None
        skipMessage = None
        for word in bad_words:
            if word.lower() in jobDescriptionLow:
                skipMessage = f'\n{jobDescription}\n\nContains bad word "{word}". Skipping this job!\n'
                skipReason = "Found a Bad Word in About Job"
                skip = True
                break
        if not skip and security_clearance == False and ('polygraph' in jobDescriptionLow or 'clearance' in jobDescriptionLow or 'secret' in jobDescriptionLow):
            skipMessage = f'\n{jobDescription}\n\nFound "Clearance" or "Polygraph". Skipping this job!\n'
            skipReason = "Asking for Security clearance"
            skip = True
        if not skip:
            if did_masters and 'master' in jobDescriptionLow:
                print_lg(f'Found the word "master" in \n{jobDescription}')
                found_masters = 2
            experience_required = extract_years_of_experience(jobDescription)
            if current_experience > -1 and experience_required > current_experience + found_masters:
                skipMessage = f'\n{jobDescription}\n\nExperience required {experience_required} > Current Experience {current_experience + found_masters}. Skipping this job!\n'
                skipReason = "Required experience is high"
                skip = True
    except Exception as e:
        if jobDescription == "Unknown":
            print_lg("Unable to extract job description!")
        else:
            experience_required = "Error in extraction"
            print_lg("Unable to extract years of experience required!")
            # print_lg(e)
    finally:
        return jobDescription, experience_required, skip, skipReason, skipMessage


# Function to upload resume
def upload_resume(modal: WebElement, resume: str) -> tuple[bool, str]:
    try:
        modal.find_element(By.NAME, "file").send_keys(os.path.abspath(resume))
        return True, os.path.basename(resume)
    except:
        return False, "Previous resume"

# Function to answer common questions for Easy Apply


def answer_common_questions(label: str, answer: str) -> str:
    if 'sponsorship' in label or 'visa' in label:
        answer = require_visa
    return answer


# Function to answer the questions for Easy Apply
def answer_questions(modal: WebElement, questions_list: set, work_location: str, job_description: str | None = None) -> set:
    # Get all questions from the page

    all_questions = modal.find_elements(
        By.XPATH, ".//div[@data-test-form-element]")
    # all_questions = modal.find_elements(By.CLASS_NAME, "jobs-easy-apply-form-element")
    # all_list_questions = modal.find_elements(By.XPATH, ".//div[@data-test-text-entity-list-form-component]")
    # all_single_line_questions = modal.find_elements(By.XPATH, ".//div[@data-test-single-line-text-form-component]")
    # all_questions = all_questions + all_list_questions + all_single_line_questions

    for Question in all_questions:
        ensure_not_stopping("while answering Easy Apply questions")
        # Check if it's a select Question
        select = try_xp(Question, ".//select", False)
        if select:
            label_org = "Unknown"
            try:
                label = Question.find_element(By.TAG_NAME, "label")
                label_org = label.find_element(By.TAG_NAME, "span").text
            except:
                pass
            answer = 'Yes'
            label = label_org.lower()
            select = Select(select)
            selected_option = select.first_selected_option.text
            optionsText = []
            options = '"List of phone country codes"'
            if label != "phone country code":
                optionsText = [option.text for option in select.options]
                options = "".join([f' "{option}",' for option in optionsText])
            prev_answer = selected_option
            if overwrite_previous_answers or selected_option == "Select an option":
                if 'email' in label or 'phone' in label:
                    answer = prev_answer
                elif 'gender' in label or 'sex' in label:
                    answer = gender
                elif 'disability' in label:
                    answer = disability_status
                elif 'proficiency' in label:
                    answer = 'Professional'
                # Add location handling
                elif any(loc_word in label for loc_word in ['location', 'city', 'state', 'country']):
                    if 'country' in label:
                        answer = country
                    elif 'state' in label:
                        answer = state
                    elif 'city' in label:
                        answer = current_city if current_city else work_location
                    else:
                        answer = work_location
                else:
                    answer = answer_common_questions(label, answer)
                try:
                    select.select_by_visible_text(answer)
                except NoSuchElementException as e:
                    # Define similar phrases for common answers
                    possible_answer_phrases = []
                    if answer == 'Decline':
                        possible_answer_phrases = [
                            "Decline", "not wish", "don't wish", "Prefer not", "not want"]
                    elif 'yes' in answer.lower():
                        possible_answer_phrases = [
                            "Yes", "Agree", "I do", "I have"]
                    elif 'no' in answer.lower():
                        possible_answer_phrases = [
                            "No", "Disagree", "I don't", "I do not"]
                    else:
                        # Try partial matching for any answer
                        possible_answer_phrases = [answer]
                        # Add lowercase and uppercase variants
                        possible_answer_phrases.append(answer.lower())
                        possible_answer_phrases.append(answer.upper())
                        # Try without special characters
                        possible_answer_phrases.append(
                            ''.join(c for c in answer if c.isalnum()))
                    # <
                    foundOption = False
                    for phrase in possible_answer_phrases:
                        for option in optionsText:
                            # Check if phrase is in option or option is in phrase (bidirectional matching)
                            if phrase.lower() in option.lower() or option.lower() in phrase.lower():
                                select.select_by_visible_text(option)
                                answer = option
                                foundOption = True
                                break
                    if not foundOption:
                        # TODO: Use AI to answer the question need to be implemented logic to extract the options for the question
                        print_lg(
                            f'Failed to find an option with text "{answer}" for question labelled "{label_org}", answering randomly!')
                        select.select_by_index(
                            randint(1, len(select.options)-1))
                        answer = select.first_selected_option.text
                        randomly_answered_questions.add(
                            (f'{label_org} [ {options} ]', "select"))
            questions_list.add(
                (f'{label_org} [ {options} ]', answer, "select", prev_answer))
            continue

        # Check if it's a radio Question
        radio = try_xp(
            Question, './/fieldset[@data-test-form-builder-radio-button-form-component="true"]', False)
        if radio:
            prev_answer = None
            label = try_xp(
                radio, './/span[@data-test-form-builder-radio-button-form-component__title]', False)
            try:
                label = find_by_class(label, "visually-hidden", 2.0)
            except:
                pass
            label_org = label.text if label else "Unknown"
            answer = 'Yes'
            label = label_org.lower()

            label_org += ' [ '
            options = radio.find_elements(By.TAG_NAME, 'input')
            options_labels = []

            for option in options:
                id = option.get_attribute("id")
                option_label = try_xp(radio, f'.//label[@for="{id}"]', False)
                # Saving option as "label <value>"
                options_labels.append(
                    f'"{option_label.text if option_label else "Unknown"}"<{option.get_attribute("value")}>')
                if option.is_selected():
                    prev_answer = options_labels[-1]
                label_org += f' {options_labels[-1]},'

            if overwrite_previous_answers or prev_answer is None:
                if 'citizenship' in label or 'employment eligibility' in label:
                    answer = us_citizenship
                elif 'veteran' in label or 'protected' in label:
                    answer = veteran_status
                elif 'disability' in label or 'handicapped' in label:
                    answer = disability_status
                else:
                    answer = answer_common_questions(label, answer)
                foundOption = try_xp(
                    radio, f".//label[normalize-space()='{answer}']", False)
                if foundOption:
                    actions.move_to_element(foundOption).click().perform()
                else:
                    possible_answer_phrases = ["Decline", "not wish", "don't wish",
                                               "Prefer not", "not want"] if answer == 'Decline' else [answer]
                    ele = options[0]
                    answer = options_labels[0]
                    for phrase in possible_answer_phrases:
                        for i, option_label in enumerate(options_labels):
                            if phrase in option_label:
                                foundOption = options[i]
                                ele = foundOption
                                answer = f'Decline ({option_label})' if len(
                                    possible_answer_phrases) > 1 else option_label
                                break
                        if foundOption:
                            break
                    # if answer == 'Decline':
                    #     answer = options_labels[0]
                    #     for phrase in ["Prefer not", "not want", "not wish"]:
                    #         foundOption = try_xp(radio, f".//label[normalize-space()='{phrase}']", False)
                    #         if foundOption:
                    #             answer = f'Decline ({phrase})'
                    #             ele = foundOption
                    #             break
                    actions.move_to_element(ele).click().perform()
                    if not foundOption:
                        randomly_answered_questions.add(
                            (f'{label_org} ]', "radio"))
            else:
                answer = prev_answer
            questions_list.add((label_org+" ]", answer, "radio", prev_answer))
            continue

        # Check if it's a text question
        text = try_xp(Question, ".//input[@type='text']", False)
        if text:
            do_actions = False
            label = try_xp(Question, ".//label[@for]", False)
            try:
                label = label.find_element(By.CLASS_NAME, 'visually-hidden')
            except:
                pass
            label_org = label.text if label else "Unknown"
            answer = ""  # years_of_experience
            label = label_org.lower()
            allow_answer_fallback = True

            prev_answer = text.get_attribute("value")
            if not prev_answer or overwrite_previous_answers:
                if 'experience' in label or 'years' in label:
                    answer = years_of_experience
                elif 'phone' in label or 'mobile' in label:
                    answer = phone_number
                elif 'street' in label:
                    answer = street
                elif 'city' in label or 'location' in label or 'address' in label:
                    answer = current_city if current_city else work_location
                    do_actions = True
                elif 'signature' in label:
                    answer = full_name  # 'signature' in label or 'legal name' in label or 'your name' in label or 'full name' in label: answer = full_name     # What if question is 'name of the city or university you attend, name of referral etc?'
                elif 'name' in label:
                    if 'full' in label:
                        answer = full_name
                    elif 'first' in label and 'last' not in label:
                        answer = first_name
                    elif 'middle' in label and 'last' not in label:
                        answer = middle_name
                    elif 'last' in label and 'first' not in label:
                        answer = last_name
                    elif 'employer' in label:
                        answer = recent_employer
                    else:
                        answer = full_name
                elif 'notice' in label:
                    if 'month' in label:
                        answer = notice_period_months
                    elif 'week' in label:
                        answer = notice_period_weeks
                    else:
                        answer = notice_period
                    allow_answer_fallback = bool(answer)
                elif 'salary' in label or 'compensation' in label or 'ctc' in label or 'pay' in label:
                    if 'current' in label or 'present' in label:
                        if 'month' in label:
                            answer = current_ctc_monthly
                        elif 'lakh' in label:
                            answer = current_ctc_lakhs
                        else:
                            answer = current_ctc
                    else:
                        if 'month' in label:
                            answer = desired_salary_monthly
                        elif 'lakh' in label:
                            answer = desired_salary_lakhs
                        else:
                            answer = desired_salary
                    allow_answer_fallback = bool(answer)
                elif 'linkedin' in label:
                    answer = linkedIn
                elif 'website' in label or 'blog' in label or 'portfolio' in label or 'link' in label:
                    answer = website
                elif 'scale of 1-10' in label:
                    answer = confidence_level
                elif 'headline' in label:
                    answer = linkedin_headline
                elif ('hear' in label or 'come across' in label) and 'this' in label and ('job' in label or 'position' in label):
                    answer = ""
                elif 'state' in label or 'province' in label:
                    answer = state
                elif 'zip' in label or 'postal' in label or 'code' in label:
                    answer = zipcode
                elif 'country' in label:
                    answer = country
                else:
                    answer = answer_common_questions(label, answer)
                if answer == "" and allow_answer_fallback:
                    if use_AI and aiClient:
                        try:
                            provider = ai_provider.lower()
                            if provider in ["openai", "groq"]:
                                answer = ai_answer_question(
                                    aiClient, label_org, question_type="text", job_description=job_description, user_information_all=user_information_all)
                            elif provider == "deepseek":
                                answer = deepseek_answer_question(aiClient, label_org, options=None, question_type="text",
                                                                  job_description=job_description, about_company=None, user_information_all=user_information_all)
                            elif provider == "gemini":
                                answer = gemini_answer_question(aiClient, label_org, options=None, question_type="text",
                                                                job_description=job_description, about_company=None, user_information_all=user_information_all)
                            else:
                                randomly_answered_questions.add(
                                    (label_org, "text"))
                                answer = years_of_experience
                            if answer and isinstance(answer, str) and len(answer) > 0:
                                print_lg(
                                    f'AI Answered received for question "{label_org}" \nhere is answer: "{answer}"')
                            else:
                                randomly_answered_questions.add(
                                    (label_org, "text"))
                                answer = years_of_experience
                        except Exception as e:
                            print_lg("Failed to get AI answer!", e)
                            randomly_answered_questions.add(
                                (label_org, "text"))
                            answer = years_of_experience
                    else:
                        randomly_answered_questions.add((label_org, "text"))
                        answer = years_of_experience
                # <
                if answer != "":
                    text.clear()
                    text.send_keys(answer)
                if do_actions and answer != "":
                    sleep_with_stop(2)
                    actions.send_keys(Keys.ARROW_DOWN)
                    actions.send_keys(Keys.ENTER).perform()
            questions_list.add(
                (label, text.get_attribute("value"), "text", prev_answer))
            continue

        # Check if it's a textarea question
        text_area = try_xp(Question, ".//textarea", False)
        if text_area:
            label = try_xp(Question, ".//label[@for]", False)
            label_org = label.text if label else "Unknown"
            label = label_org.lower()
            answer = ""
            prev_answer = text_area.get_attribute("value")
            if not prev_answer or overwrite_previous_answers:
                if 'summary' in label:
                    answer = linkedin_summary
                elif 'cover' in label:
                    answer = cover_letter
                if answer == "":
                    if use_AI and aiClient:
                        try:
                            provider = ai_provider.lower()
                            if provider in ["openai", "groq"]:
                                answer = ai_answer_question(
                                    aiClient, label_org, question_type="textarea", job_description=job_description, user_information_all=user_information_all)
                            elif provider == "deepseek":
                                answer = deepseek_answer_question(aiClient, label_org, options=None, question_type="textarea",
                                                                  job_description=job_description, about_company=None, user_information_all=user_information_all)
                            elif provider == "gemini":
                                answer = gemini_answer_question(aiClient, label_org, options=None, question_type="textarea",
                                                                job_description=job_description, about_company=None, user_information_all=user_information_all)
                            else:
                                randomly_answered_questions.add(
                                    (label_org, "textarea"))
                                answer = ""
                            if answer and isinstance(answer, str) and len(answer) > 0:
                                print_lg(
                                    f'AI Answered received for question "{label_org}" \nhere is answer: "{answer}"')
                            else:
                                randomly_answered_questions.add(
                                    (label_org, "textarea"))
                                answer = ""
                        except Exception as e:
                            print_lg("Failed to get AI answer!", e)
                            randomly_answered_questions.add(
                                (label_org, "textarea"))
                            answer = ""
                    else:
                        randomly_answered_questions.add(
                            (label_org, "textarea"))
            text_area.clear()
            text_area.send_keys(answer)
            if do_actions:
                sleep_with_stop(2)
                actions.send_keys(Keys.ARROW_DOWN)
                actions.send_keys(Keys.ENTER).perform()
            questions_list.add(
                (label, text_area.get_attribute("value"), "textarea", prev_answer))
            # <
            continue

        # Check if it's a checkbox question
        checkbox = try_xp(Question, ".//input[@type='checkbox']", False)
        if checkbox:
            label = try_xp(
                Question, ".//span[@class='visually-hidden']", False)
            label_org = label.text if label else "Unknown"
            label = label_org.lower()
            # Sometimes multiple checkboxes are given for 1 question, Not accounted for that yet
            answer = try_xp(Question, ".//label[@for]", False)
            answer = answer.text if answer else "Unknown"
            prev_answer = checkbox.is_selected()
            checked = prev_answer
            if not prev_answer:
                try:
                    actions.move_to_element(checkbox).click().perform()
                    checked = True
                except Exception as e:
                    print_lg("Checkbox click failed!", e)
                    pass
            questions_list.add(
                (f'{label} ([X] {answer})', checked, "checkbox", prev_answer))
            continue

    # Select todays date
    try_xp(driver, "//button[contains(@aria-label, 'This is today')]")

    # Collect important skills
    # if 'do you have' in label and 'experience' in label and ' in ' in label -> Get word (skill) after ' in ' from label
    # if 'how many years of experience do you have in ' in label -> Get word (skill) after ' in '

    return questions_list


def emit_job_event(event_name: str, payload: dict) -> None:
    try:
        event_payload = {"event": event_name, **payload}
        print("EVENT:" + json.dumps(event_payload, ensure_ascii=False))
    except Exception:
        pass


def emit_job_progress(
    *,
    job_id: str,
    title: str,
    company: str,
    work_location: str,
    work_style: str,
    job_link: str,
    application_link: str,
    application_provider: str,
    application_stage: str,
    review_required: bool = False,
    reason: str | None = None,
) -> None:
    emit_job_event(
        "job_review_required" if review_required else "job_progress",
        {
            "job_id": job_id,
            "title": title,
            "company": company,
            "location": work_location,
            "work_style": work_style,
            "job_link": job_link,
            "external_link": application_link,
            "application_provider": application_provider,
            "application_stage": application_stage,
            "review_required": review_required,
            "reason": reason,
        },
    )


def emit_outreach_event(event_name: str, payload: dict) -> None:
    emit_job_event(event_name, payload)


def _extract_first_email(text: str) -> Optional[str]:
    match = re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text or "", re.IGNORECASE)
    return match.group(0) if match else None


def _normalize_linkedin_profile_url(profile_url: str) -> str:
    cleaned = (profile_url or "").strip()
    if not cleaned:
        return ""
    cleaned = cleaned.split("?", 1)[0].split("#", 1)[0].strip()
    if cleaned.endswith("/"):
        cleaned = cleaned[:-1]
    return cleaned.lower()


def _extract_linkedin_profile_id(profile_url: str) -> str:
    normalized = _normalize_linkedin_profile_url(profile_url)
    match = re.search(r"/in/([^/]+)", normalized)
    return match.group(1).strip().lower() if match else ""


def _linkedin_people_search_url(role: str, company_filter: str, recruiter_search_context: str) -> str:
    parts = [role.strip()]
    if company_filter.strip():
        parts.append(company_filter.strip())
    if recruiter_search_context.strip():
        parts.append(recruiter_search_context.strip())
    parts.append("recruiter")
    query = " ".join(part for part in parts if part)
    return f"https://www.linkedin.com/search/results/people/?keywords={quote(query)}"


def _collect_recruiter_candidates(limit: int) -> list[str]:
    _close_open_message_overlays()
    wait.until(lambda d: d.find_elements(By.XPATH, "//a[contains(@href,'/in/')]"))
    anchors = driver.find_elements(By.XPATH, "//a[contains(@href,'/in/')]")
    candidates: list[str] = []
    seen: set[str] = set()
    for anchor in anchors:
        href = (anchor.get_attribute("href") or "").split("?")[0].strip()
        if not href or "/in/" not in href:
            continue
        if href in seen:
            continue
        seen.add(href)
        candidates.append(href)
        if len(candidates) >= limit:
            break
    return candidates


def _profile_text(xpath: str) -> str:
    try:
        return driver.find_element(By.XPATH, xpath).text.strip()
    except Exception:
        return ""


def _compose_outreach_message(
    *,
    recruiter_name: str,
    recruiter_company: str,
    role_value: str,
    company_value: str,
    recruiter_search_value: str,
    message_content_value: str,
    use_ai_value: bool,
) -> str:
    base_message = message_content_value.strip()
    if not use_ai_value or not use_AI or not aiClient:
        return base_message

    prompt = (
        f"Write a concise LinkedIn outreach message to a recruiter.\n\n"
        f"Target role: {role_value or 'Unknown'}\n"
        f"Target company: {company_value or recruiter_company or 'Unknown'}\n"
        f"Recruiter name: {recruiter_name or 'there'}\n"
        f"Recruiter context: {recruiter_search_value or 'N/A'}\n"
        f"Message brief from the user:\n{base_message}\n\n"
        f"Constraints:\n"
        f"- Keep it professional and under 550 characters.\n"
        f"- Do not invent facts.\n"
        f"- Do not mention referrals unless the user explicitly said so.\n"
        f"- Return only the final message.\n"
    )
    try:
        if ai_provider in ["openai", "groq"]:
            response = ai_answer_question(aiClient, prompt, question_type="textarea", user_information_all=user_information_all)
        elif ai_provider == "deepseek":
            response = deepseek_answer_question(aiClient, prompt, question_type="textarea", user_information_all=user_information_all)
        elif ai_provider == "gemini":
            response = gemini_answer_question(aiClient, prompt, question_type="textarea", user_information_all=user_information_all)
        else:
            response = base_message
        return str(response or base_message).strip() or base_message
    except Exception as exc:
        print_lg("AI outreach generation failed, using exact content.", exc)
        return base_message


def _fill_message_box(message: str) -> None:
    textbox = None
    selectors = [
        "//div[@role='textbox']",
        "//textarea",
        "//div[contains(@class,'msg-form__contenteditable')]",
    ]
    for xpath in selectors:
        try:
            textbox = WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.XPATH, xpath)))
            if textbox:
                break
        except Exception:
            continue
    if textbox is None:
        raise NoSuchElementException("Could not find LinkedIn message input.")

    try:
        show_cursor_click(driver, textbox, "Opening message")
        textbox.click()
        show_cursor_typing(driver, textbox, "Typing message")
        textbox.send_keys(Keys.CONTROL + "a")
        textbox.send_keys(message)
    except Exception:
        try:
            textbox.clear()
            show_cursor_typing(driver, textbox, "Typing message")
            textbox.send_keys(message)
        except Exception as exc:
            raise NoSuchElementException("Could not fill LinkedIn message input.") from exc


def _find_primary_profile_action_button(preferred_label: str):
    containers = [
        "(//main//section[@data-member-id][1]//*[contains(@class,'pv-top-card-v2-ctas__custom')])[1]",
        "(//main//section[@data-member-id][1]//*[contains(@class,'pvs-profile-actions__custom')])[1]",
        "(//main//section[@data-member-id][1])[1]",
    ]
    normalized_label = preferred_label.strip()
    for container_xpath in containers:
        try:
            container = driver.find_element(By.XPATH, container_xpath)
        except Exception:
            continue

        button_xpaths = [
            f".//button[contains(@aria-label,'{normalized_label}')]",
            f".//a[contains(@aria-label,'{normalized_label}')]",
            f".//button[.//span[normalize-space()='{normalized_label}']]",
            f".//a[.//span[normalize-space()='{normalized_label}']]",
            f".//*[self::button or self::a][contains(normalize-space(.), '{normalized_label}')]",
        ]
        for button_xpath in button_xpaths:
            try:
                button = container.find_element(By.XPATH, button_xpath)
                if button.is_displayed():
                    return button
            except Exception:
                continue
    return None


def _click_message_send_button() -> bool:
    selectors = [
        "//div[contains(@class,'msg-overlay-conversation-bubble')]//button[contains(@class,'msg-form__send-btn') and @type='submit']",
        "//div[contains(@class,'msg-overlay-conversation-bubble')]//form[contains(@class,'msg-form')]//button[@type='submit']",
        "//div[contains(@class,'msg-overlay-conversation-bubble')]//button[contains(@aria-label,'Send')]",
    ]
    for xpath in selectors:
        try:
            button = WebDriverWait(driver, 5).until(EC.element_to_be_clickable((By.XPATH, xpath)))
            show_cursor_scroll(driver, button, "Preparing to send")
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", button)
            show_cursor_click(driver, button, "Sending outreach")
            button.click()
            return True
        except Exception:
            continue
    return False


def _dismiss_message_modal() -> None:
    for xpath in [
        "//div[contains(@class,'msg-overlay-conversation-bubble')]//button[contains(@class,'msg-overlay-bubble-header__control') and .//*[contains(@data-test-icon,'close-small')]]",
        "//div[contains(@class,'msg-overlay-conversation-bubble')]//button[contains(@aria-label,'Close')]",
        "//button[contains(@aria-label,'Dismiss')]",
    ]:
        try:
            button = driver.find_element(By.XPATH, xpath)
            show_cursor_click(driver, button, "Closing message")
            button.click()
            return
        except Exception:
            continue


def _close_open_message_overlays(max_overlays: int = 5) -> None:
    close_selectors = [
        "//div[contains(@class,'msg-overlay-conversation-bubble')]//button[contains(@class,'msg-overlay-bubble-header__control') and .//*[contains(@data-test-icon,'close-small')]]",
        "//div[contains(@class,'msg-overlay-conversation-bubble')]//button[contains(@aria-label,'Close')]",
        "//button[contains(@aria-label,'Dismiss')]",
    ]
    for _ in range(max_overlays):
        closed = False
        for xpath in close_selectors:
            try:
                buttons = driver.find_elements(By.XPATH, xpath)
            except Exception:
                buttons = []
            for button in buttons:
                try:
                    if not button.is_displayed():
                        continue
                    show_cursor_click(driver, button, "Closing message")
                    button.click()
                    sleep_with_stop(0.5)
                    closed = True
                    break
                except Exception:
                    continue
            if closed:
                break
        if not closed:
            return


def _attach_outreach_resume_if_needed() -> bool:
    if not attach_default_resume:
        return False
    if not default_resume_path or not os.path.exists(default_resume_path):
        print_lg("Default resume attachment requested, but no valid resume path was available.")
        return False

    selectors = [
        "//div[contains(@class,'msg-overlay-conversation-bubble')]//input[contains(@class,'msg-form__attachment-upload-input') and contains(@accept,'.pdf')]",
        "//div[contains(@class,'msg-overlay-conversation-bubble')]//input[contains(@class,'msg-form__attachment-upload-input') and contains(@accept,'.docx')]",
        "//div[contains(@class,'msg-overlay-conversation-bubble')]//input[contains(@class,'msg-form__attachment-upload-input')][not(contains(@accept,'image/*') and string-length(@accept) < 20)]",
    ]
    for xpath in selectors:
        try:
            file_input = WebDriverWait(driver, 3).until(EC.presence_of_element_located((By.XPATH, xpath)))
            driver.execute_script("arguments[0].classList.remove('hidden'); arguments[0].style.display='block';", file_input)
            show_cursor_typing(driver, file_input, "Attaching resume")
            file_input.send_keys(os.path.abspath(default_resume_path))
            sleep_with_stop(2)
            print_step("Attached resume to outreach", os.path.basename(default_resume_path))
            return True
        except Exception:
            continue
    print_lg("Could not find the LinkedIn file attachment input for outreach.")
    return False


def _send_recruiter_outreach(
    *,
    profile_url: str,
    search_url: str,
    role_value: str,
    company_value: str,
    recruiter_search_value: str,
    message_content_value: str,
    use_ai_value: bool,
) -> bool:
    global outreach_count, failed_count
    driver.get(profile_url)
    sleep_with_stop(2)
    ensure_visual_cursor(driver)
    ensure_not_stopping("during recruiter outreach profile review")
    _close_open_message_overlays()

    recruiter_name = _profile_text("//h1")
    recruiter_headline = _profile_text("(//div[contains(@class,'text-body-medium')])[1]")
    recruiter_location = _profile_text("(//span[contains(@class,'text-body-small')])[1]")
    recruiter_company = company_value.strip() or _profile_text("(//section//span[contains(.,'Current company')]/following::span)[1]")
    recruiter_email = _extract_first_email(driver.page_source) if collect_recruiter_email_if_available else None
    recruiter_member_id = _extract_linkedin_profile_id(profile_url)

    emit_outreach_event(
        "outreach_discovered",
        {
            "recruiter_name": recruiter_name,
            "recruiter_headline": recruiter_headline,
            "recruiter_company": recruiter_company,
            "recruiter_location": recruiter_location,
            "recruiter_email": recruiter_email,
            "recruiter_profile_url": profile_url,
            "recruiter_member_id": recruiter_member_id,
            "role": role_value,
            "company_filter": company_value,
            "search_context": recruiter_search_value,
            "message_input": message_content_value,
            "used_ai": use_ai_value,
            "status": "drafted",
        },
    )

    message_text = _compose_outreach_message(
        recruiter_name=recruiter_name,
        recruiter_company=recruiter_company,
        role_value=role_value,
        company_value=company_value,
        recruiter_search_value=recruiter_search_value,
        message_content_value=message_content_value,
        use_ai_value=use_ai_value,
    )

    message_opened = False
    action_type = "message"
    message_button = _find_primary_profile_action_button("Message")
    if message_button is not None:
        try:
            show_cursor_scroll(driver, message_button, "Opening message")
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", message_button)
            WebDriverWait(driver, 4).until(lambda _driver: message_button.is_displayed() and message_button.is_enabled())
            show_cursor_click(driver, message_button, "Opening message")
            message_button.click()
            message_opened = True
        except Exception:
            message_opened = False

    if not message_opened:
        for xpath in [
            "//main//*[not(ancestor::aside)]//button[.//span[normalize-space()='Message']]",
            "//main//*[not(ancestor::aside)]//a[.//span[normalize-space()='Message']]",
        ]:
            try:
                button = WebDriverWait(driver, 2).until(EC.element_to_be_clickable((By.XPATH, xpath)))
                show_cursor_click(driver, button, "Opening message")
                button.click()
                message_opened = True
                break
            except Exception:
                continue

    if not message_opened:
        connect_button = _find_primary_profile_action_button("Connect")
        if connect_button is not None:
            try:
                show_cursor_scroll(driver, connect_button, "Opening connect note")
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", connect_button)
                WebDriverWait(driver, 3).until(lambda _driver: connect_button.is_displayed() and connect_button.is_enabled())
                show_cursor_click(driver, connect_button, "Opening connect note")
                connect_button.click()
                sleep_with_stop(1)
                try:
                    add_note = WebDriverWait(driver, 3).until(
                        EC.element_to_be_clickable((By.XPATH, "//button[.//span[contains(normalize-space(),'Add a note')]]"))
                    )
                    show_cursor_click(driver, add_note, "Adding note")
                    add_note.click()
                except Exception:
                    pass
                action_type = "connect_with_note"
                message_opened = True
            except Exception:
                message_opened = False

    if not message_opened:
        failed_count += 1
        emit_outreach_event(
            "outreach_failed",
            {
                "recruiter_name": recruiter_name,
                "recruiter_headline": recruiter_headline,
                "recruiter_company": recruiter_company,
                "recruiter_location": recruiter_location,
                "recruiter_email": recruiter_email,
                "recruiter_profile_url": profile_url,
                "recruiter_member_id": recruiter_member_id,
                "role": role_value,
                "company_filter": company_value,
                "search_context": recruiter_search_value,
                "message_input": message_content_value,
                "message_sent": message_text,
                "used_ai": use_ai_value,
                "action_type": action_type,
                "status": "failed",
                "reason": "No message or connect option available on profile",
            },
        )
        return False

    resume_attached = _attach_outreach_resume_if_needed()
    _fill_message_box(message_text[:290] if action_type == "connect_with_note" else message_text)

    if require_review_before_send:
        decision = pyautogui.confirm(
            f"Review the outreach prepared for {recruiter_name or 'this recruiter'}.\n\n"
            f"You can inspect the browser first, then choose whether to send or skip.",
            "Review outreach",
            ["Skip outreach", "Send outreach", "Disable review & auto send"],
        )
        if decision == "Disable review & auto send":
            emit_outreach_event(
                "outreach_settings_update",
                {
                    "updates": {
                        "require_review_before_send": False,
                    }
                },
            )
        elif decision != "Send outreach":
            emit_outreach_event(
                "outreach_review_required",
                {
                    "recruiter_name": recruiter_name,
                    "recruiter_headline": recruiter_headline,
                    "recruiter_company": recruiter_company,
                    "recruiter_location": recruiter_location,
                    "recruiter_email": recruiter_email,
                    "recruiter_profile_url": profile_url,
                    "recruiter_member_id": recruiter_member_id,
                    "role": role_value,
                    "company_filter": company_value,
                    "search_context": recruiter_search_value,
                    "message_input": message_content_value,
                    "message_sent": message_text,
                    "used_ai": use_ai_value,
                    "reason": "User skipped during outreach review",
                    "action_type": action_type,
                    "status": "skipped",
                    "recruiter_email": recruiter_email,
                },
            )
            _dismiss_message_modal()
            driver.get(search_url)
            sleep_with_stop(2)
            return False

    if not _click_message_send_button():
        failed_count += 1
        emit_outreach_event(
            "outreach_failed",
            {
                "recruiter_name": recruiter_name,
                "recruiter_headline": recruiter_headline,
                "recruiter_company": recruiter_company,
                "recruiter_location": recruiter_location,
                "recruiter_email": recruiter_email,
                "recruiter_profile_url": profile_url,
                "recruiter_member_id": recruiter_member_id,
                "role": role_value,
                "company_filter": company_value,
                "search_context": recruiter_search_value,
                "message_input": message_content_value,
                "message_sent": message_text,
                "used_ai": use_ai_value,
                "action_type": action_type,
                "status": "failed",
                "reason": "Could not click the LinkedIn send button",
            },
        )
        return False

    outreach_count += 1
    sleep_with_stop(2)
    emit_outreach_event(
        "outreach_sent",
        {
            "recruiter_name": recruiter_name,
            "recruiter_headline": recruiter_headline,
            "recruiter_company": recruiter_company,
            "recruiter_location": recruiter_location,
            "recruiter_email": recruiter_email,
            "recruiter_profile_url": profile_url,
            "recruiter_member_id": recruiter_member_id,
            "role": role_value,
            "company_filter": company_value,
            "search_context": recruiter_search_value,
            "message_input": message_content_value,
            "message_sent": message_text,
            "used_ai": use_ai_value,
            "action_type": action_type,
            "status": "sent",
            "sent_at": datetime.utcnow().isoformat(),
            "reason": "resume_attached" if resume_attached else None,
        },
    )
    _dismiss_message_modal()
    sleep_with_stop(1)
    driver.get(search_url)
    sleep_with_stop(2)
    return True


def run_outreach(total_runs: int) -> int:
    global failed_count
    print_step("Starting outreach workflow")
    role_value = default_role.strip()
    company_value = default_company.strip()
    recruiter_search_value = default_recruiter_search_context.strip()
    message_content_value = default_message_content.strip()
    use_ai_value = bool(use_ai_for_outreach)
    if not role_value:
        raise ValueError("Outreach role is required to start an outreach run.")
    if not message_content_value:
        raise ValueError("Outreach message content is required to start an outreach run.")

    search_url = _linkedin_people_search_url(role_value, company_value, recruiter_search_value)
    sent_profile_urls = {
        _normalize_linkedin_profile_url(url)
        for url in (globals().get("sent_recruiter_profile_urls") or [])
        if str(url).strip()
    }
    sent_member_ids = {
        str(value).strip().lower()
        for value in (globals().get("sent_recruiter_member_ids") or [])
        if str(value).strip()
    }
    print_step("Opening recruiter search", search_url)
    driver.get(search_url)
    sleep_with_stop(3)
    ensure_visual_cursor(driver)
    _close_open_message_overlays()
    limit = max_outreaches_per_run or 5
    candidates = _collect_recruiter_candidates(max(limit * 3, limit))
    print_lg(f"Found {len(candidates)} recruiter candidates for outreach.")

    for profile_url in candidates:
        if outreach_count >= limit:
            break
        ensure_not_stopping("during outreach loop")
        normalized_profile_url = _normalize_linkedin_profile_url(profile_url)
        recruiter_member_id = _extract_linkedin_profile_id(profile_url)
        if normalized_profile_url in sent_profile_urls or (recruiter_member_id and recruiter_member_id in sent_member_ids):
            print_step("Skipping recruiter", f"Already contacted {profile_url}")
            emit_outreach_event(
                "outreach_skipped",
                {
                    "recruiter_profile_url": profile_url,
                    "recruiter_member_id": recruiter_member_id,
                    "role": role_value,
                    "company_filter": company_value,
                    "search_context": recruiter_search_value,
                    "message_input": message_content_value,
                    "used_ai": use_ai_value,
                    "status": "skipped",
                    "reason": "Recruiter already contacted in a previous outreach",
                },
            )
            continue
        try:
            _send_recruiter_outreach(
                profile_url=profile_url,
                search_url=search_url,
                role_value=role_value,
                company_value=company_value,
                recruiter_search_value=recruiter_search_value,
                message_content_value=message_content_value,
                use_ai_value=use_ai_value,
            )
        except StopRequested:
            raise
        except Exception as exc:
            failed_count += 1
            emit_outreach_event(
                "outreach_failed",
                {
                    "recruiter_profile_url": profile_url,
                    "role": role_value,
                    "company_filter": company_value,
                    "search_context": recruiter_search_value,
                    "message_input": message_content_value,
                    "used_ai": use_ai_value,
                    "status": "failed",
                    "reason": str(exc),
                },
            )
            print_lg("Failed recruiter outreach attempt:", exc)
        sleep_with_stop(2)

    print_lg("########################################################################################################################\n")
    buffer(3)
    return total_runs + 1


def _external_submission_detected(provider: str, current_url: str, page_text: str) -> bool:
    url = (current_url or "").lower()
    text = (page_text or "").lower()
    common_markers = (
        "thank you for applying",
        "application submitted",
        "your application has been submitted",
        "thanks for applying",
        "we have received your application",
        "application received",
    )
    provider_markers = {
        "greenhouse": ("applications/thanks", "thank you for applying", "application submitted"),
        "lever": ("application submitted", "thank you for applying", "thanks for applying"),
        "ashby": ("application submitted", "thank you", "thanks for applying"),
    }
    markers = common_markers + provider_markers.get(provider, ())
    return any(marker in url or marker in text for marker in markers)


def _store_external_answers_for_future(adapter, driver, provider: str) -> int:
    try:
        form = adapter._find_form(driver)
    except Exception:
        form = None
    if form is None:
        return 0

    try:
        answered_fields = adapter._collect_answered_fields(form)
    except Exception as exc:
        print_lg(f"Could not capture external answers for storage: {exc}")
        return 0

    stored = 0
    seen: set[tuple[str, str]] = set()
    for item in answered_fields:
        question = str(item.get("question") or "").strip()
        question_type = str(item.get("question_type") or "text").strip()
        answer = str(item.get("answer") or "").strip()
        options = item.get("options") or []
        if not question or not answer:
            continue
        key = (question.lower(), question_type.lower())
        if key in seen:
            continue
        seen.add(key)
        emit_job_event(
            "learned_answer",
            {
                "provider": provider,
                "question": question,
                "question_type": question_type,
                "answer": answer,
                "options": options if isinstance(options, list) else [],
            },
        )
        stored += 1
    if stored:
        print_step("Stored external answers", f"{provider} | saved {stored} answers for future applications")
    return stored


def review_external_application(
    provider: str,
    adapter,
    driver,
    application_link: str,
    unresolved_fields: list[str],
    title: str,
    company: str,
    timeout_seconds: int = 180,
) -> bool:
    ensure_not_stopping(f"before reviewing {provider} application")
    if run_in_background:
        print_lg(
            f"{provider.title()} application for {title} | {company} needs manual review, but background mode is enabled."
        )
        return False

    review_lines = []
    if unresolved_fields:
        review_lines.append("The bot left some fields for manual review:")
        review_lines.extend(f"- {field}" for field in unresolved_fields[:10])
        review_lines.append("")
    review_lines.append("The external application is open in your browser.")
    review_lines.append("Review the form, submit it manually, then click the first button below.")
    review_lines.append("Choose store before submit to save the visible answers for future matching.")
    review_lines.append("Choose skip if you do not want to continue with this application.")
    decision = pyautogui.confirm(
        "\n".join(review_lines),
        f"{provider.title()} review required",
        ["I will review and submit", "Store before submit", "Skip this application"],
    )
    if decision == "Skip this application":
        print_lg(f"Manual {provider} review skipped for {title} | {company}.")
        return False
    if decision == "Store before submit":
        _store_external_answers_for_future(adapter, driver, provider)

    print_step("Waiting for manual external review", f"{provider} | {title} | {company}")
    print_lg(
        f"External application requires manual review. Leaving the browser on {provider.title()} for {title} | {company}."
    )
    if unresolved_fields:
        print_lg("The bot could not confidently complete these fields:")
        for field in unresolved_fields[:10]:
            print_lg(f"- {field}")
    print_lg(
        f"Complete and submit the application in the browser tab at {application_link}. The bot will keep watching for a submission confirmation for up to {timeout_seconds} seconds."
    )

    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        ensure_not_stopping(f"while waiting for manual {provider} review")
        try:
            if driver.current_url and _external_submission_detected(provider, driver.current_url, driver.page_source):
                print_step("External application submitted", f"{provider} | {title} | {company}")
                return True
        except NoSuchWindowException:
            print_lg(f"The external application window for {title} was closed before submission was detected.")
            return False
        except Exception as exc:
            print_lg(f"Waiting for {provider} submission confirmation: {exc}")
        time.sleep(1)

    print_lg(
        f"Timed out waiting for manual {provider} submission confirmation for {title} | {company}."
    )
    return False


def external_apply(
    pagination_element: WebElement,
    job_id: str,
    title: str,
    company: str,
    work_location: str,
    work_style: str,
    job_link: str,
    resume: str,
    date_listed,
    application_link: str,
    job_description: str | None = None,
) -> tuple[ExternalApplyResult, int]:
    '''
    Function to open new tab and automate supported external job portals.
    '''
    global tabs_count, dailyEasyApplyLimitReached
    if easy_apply_only:
        try:
            if "exceeded the daily application limit" in driver.find_element(By.CLASS_NAME, "artdeco-inline-feedback__message").text:
                dailyEasyApplyLimitReached = True
        except Exception:
            pass
        print_lg("Skipping job: no Easy Apply button (external/company site only). easy_apply_only is True.")
        return ExternalApplyResult(
            provider="external",
            application_link=application_link,
            stage="skipped",
            skipped=True,
            reason="Easy Apply only is enabled",
        ), tabs_count

    starting_window = driver.current_window_handle
    original_windows = list(driver.window_handles)
    original_count = len(original_windows)

    def report_progress(stage: str, detail: str | None, review_required: bool, reason: str | None) -> None:
        ensure_not_stopping(f"during external apply for {title}")
        if detail:
            print_step(f"{title} [{detail}]", f"provider={detail}, stage={stage}")
        else:
            print_step("External apply progress", f"{title} | stage={stage}")
        emit_job_progress(
            job_id=job_id,
            title=title,
            company=company,
            work_location=work_location,
            work_style=work_style,
            job_link=job_link,
            application_link=application_link,
            application_provider=detail or "external",
            application_stage=stage,
            review_required=review_required,
            reason=reason,
        )

    try:
        ensure_not_stopping(f"before external apply for {title}")
        wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, ".//button[contains(@class,'jobs-apply-button') and contains(@class, 'artdeco-button--3')]")
            )
        ).click()
        wait_span_click(driver, "Continue", 1, True, False)
        deadline = time.time() + 10
        external_handle = starting_window
        while time.time() < deadline:
            windows = driver.window_handles
            if len(windows) > original_count:
                external_handle = windows[-1]
                break
            if driver.current_url != job_link and "linkedin.com" not in driver.current_url.lower():
                external_handle = driver.current_window_handle
                break
            sleep_with_stop(0.25)

        tabs_count = len(driver.window_handles)
        driver.switch_to.window(external_handle)
        try:
            wait.until(lambda d: d.current_url and d.current_url != "about:blank")
        except TimeoutException:
            pass
        application_link = driver.current_url
        print_lg('Got the external application link "{}"'.format(application_link))

        adapter = detect_adapter(driver)
        print_step("Provider detected", f"{adapter.provider} | {title} | {company}")
        emit_job_progress(
            job_id=job_id,
            title=title,
            company=company,
            work_location=work_location,
            work_style=work_style,
            job_link=job_link,
            application_link=application_link,
            application_provider=adapter.provider,
            application_stage="detected",
            review_required=False,
            reason=None,
        )

        ctx = ExternalApplyContext(
            driver=driver,
            wait=wait,
            actions=actions,
            ai_client=aiClient,
            title=title,
            company=company,
            job_description=job_description,
            work_location=work_location,
            resume_path=os.path.abspath(default_resume_path) if default_resume_path else "",
            click_gap=click_gap,
            progress=lambda stage, detail, review_required, reason: emit_job_progress(
                job_id=job_id,
                title=title,
                company=company,
                work_location=work_location,
                work_style=work_style,
                job_link=job_link,
                application_link=driver.current_url,
                application_provider=adapter.provider,
                application_stage=stage,
                review_required=review_required,
                reason=reason,
            ),
            emit_event=lambda event_name, payload: emit_job_event(event_name, payload),
            use_context_ai=bool(use_context_ai),
            page_context_cache=_context_ai_cache,
            user_profile={
                "personals": _runtime_cfg.get("personals") or {},
                "questions": _runtime_cfg.get("questions") or {},
            },
        )
        result = adapter.run(ctx)
        ensure_not_stopping(f"after filling {adapter.provider} application")
        result.application_link = driver.current_url
        print_step(
            "External apply analysis",
            f"{adapter.provider} | filled_fields={result.filled_fields} | unresolved={len(result.unresolved_fields)}",
        )

        if result.review_required:
            emit_job_progress(
                job_id=job_id,
                title=title,
                company=company,
                work_location=work_location,
                work_style=work_style,
                job_link=job_link,
                application_link=result.application_link,
                application_provider=result.provider,
                application_stage=result.stage,
                review_required=True,
                reason=result.reason,
            )
            print_step("External review required", f"{result.provider} | {title} | {company}")
            if review_external_application(
                result.provider,
                adapter,
                driver,
                result.application_link,
                result.unresolved_fields,
                title,
                company,
            ):
                result.submitted = True
                result.review_required = False
                result.stage = "submitted"
            else:
                result.reason = result.reason or "Manual external application review was not completed"
                result.stage = "failed"
        return result, tabs_count
    except StopRequested:
        raise
    except Exception as e:
        print_lg("Failed to apply externally!", e)
        return ExternalApplyResult(
            provider="external",
            application_link=application_link,
            stage="failed",
            reason="Probably didn't find Apply button or unable to switch tabs.",
        ), tabs_count
    finally:
        try:
            current_handle = driver.current_window_handle
            if current_handle != linkedIn_tab:
                if close_tabs:
                    driver.close()
                driver.switch_to.window(linkedIn_tab)
        except Exception:
            try:
                driver.switch_to.window(linkedIn_tab)
            except Exception:
                pass


def follow_company(modal: WebDriver = driver) -> None:
    '''
    Function to follow or un-follow easy applied companies based om `follow_companies`
    '''
    try:
        follow_checkbox_input = try_xp(
            modal, ".//input[@id='follow-company-checkbox' and @type='checkbox']", False)
        if follow_checkbox_input and follow_checkbox_input.is_selected() != follow_companies:
            try_xp(modal, ".//label[@for='follow-company-checkbox']")
    except Exception as e:
        print_lg("Failed to update follow companies checkbox!", e)


# < Failed attempts logging
def failed_job(
    job_id: str,
    title: str,
    company: str,
    work_location: str,
    work_style: str,
    job_link: str,
    resume: str,
    date_listed,
    error: str,
    exception: Exception,
    application_link: str,
    application_provider: str | None = None,
    application_stage: str | None = None,
    review_required: bool = False,
) -> None:
    '''
    Function to update failed jobs list in excel
    '''
    try:
        with open(failed_file_name, 'a', newline='', encoding='utf-8') as file:
            fieldnames = ['Job ID', 'Job Link', 'Resume Tried', 'Date listed',
                          'Date Tried', 'Assumed Reason', 'Stack Trace', 'External Job link']
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            if file.tell() == 0:
                writer.writeheader()
            writer.writerow({'Job ID': truncate_for_csv(job_id), 'Job Link': truncate_for_csv(job_link), 'Resume Tried': truncate_for_csv(resume), 'Date listed': truncate_for_csv(
                date_listed), 'Date Tried': datetime.now(), 'Assumed Reason': truncate_for_csv(error), 'Stack Trace': truncate_for_csv(exception), 'External Job link': truncate_for_csv(application_link)})
            file.close()
    except Exception as e:
        print_lg("Failed to update failed jobs list!", e)
        pyautogui.alert("Failed to update the excel of failed jobs!\nProbably because of 1 of the following reasons:\n1. The file is currently open or in use by another program\n2. Permission denied to write to the file\n3. Failed to find the file", "Failed Logging")
    finally:
        try:
            payload = {
                "job_id": job_id,
                "title": title,
                "company": company,
                "location": work_location,
                "work_style": work_style,
                "job_link": job_link,
                "resume": resume,
                "date_listed": str(date_listed),
                "reason": error,
                "external_link": application_link,
                "application_provider": application_provider or ("linkedin_easy_apply" if application_link in {"Easy Applied", "Skipped"} else "external"),
                "application_stage": application_stage or "failed",
                "review_required": review_required,
            }
            emit_job_event("job_failed", payload)
        except Exception:
            pass
# >


def submitted_jobs(job_id: str, title: str, company: str, work_location: str, work_style: str, description: str, experience_required: int | Literal['Unknown', 'Error in extraction'],
                   skills: list[str] | Literal['In Development'], hr_name: str | Literal['Unknown'], hr_link: str | Literal['Unknown'], resume: str,
                   reposted: bool, date_listed: datetime | Literal['Unknown'], date_applied:  datetime | Literal['Pending'], job_link: str, application_link: str,
                   questions_list: set | None, connect_request: Literal['In Development'],
                   application_provider: str | None = None, application_stage: str | None = None, review_required: bool = False) -> None:
    '''
    Function to create or update the Applied jobs CSV file, once the application is submitted successfully
    '''
    print_step("Saving applied job", f"{title} | {company} | {job_id}")
    try:
        with open(file_name, mode='a', newline='', encoding='utf-8') as csv_file:
            fieldnames = ['Job ID', 'Title', 'Company', 'Work Location', 'Work Style', 'About Job', 'Experience required', 'Skills required', 'HR Name',
                          'HR Link', 'Resume', 'Re-posted', 'Date Posted', 'Date Applied', 'Job Link', 'External Job link', 'Questions Found', 'Connect Request']
            writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
            if csv_file.tell() == 0:
                writer.writeheader()
            writer.writerow({'Job ID': truncate_for_csv(job_id), 'Title': truncate_for_csv(title), 'Company': truncate_for_csv(company), 'Work Location': truncate_for_csv(work_location), 'Work Style': truncate_for_csv(work_style),
                            'About Job': truncate_for_csv(description), 'Experience required': truncate_for_csv(experience_required), 'Skills required': truncate_for_csv(skills),
                             'HR Name': truncate_for_csv(hr_name), 'HR Link': truncate_for_csv(hr_link), 'Resume': truncate_for_csv(resume), 'Re-posted': truncate_for_csv(reposted),
                             'Date Posted': truncate_for_csv(date_listed), 'Date Applied': truncate_for_csv(date_applied), 'Job Link': truncate_for_csv(job_link),
                             'External Job link': truncate_for_csv(application_link), 'Questions Found': truncate_for_csv(questions_list), 'Connect Request': truncate_for_csv(connect_request)})
        csv_file.close()
    except Exception as e:
        print_lg("Failed to update submitted jobs list!", e)
        pyautogui.alert("Failed to update the excel of applied jobs!\nProbably because of 1 of the following reasons:\n1. The file is currently open or in use by another program\n2. Permission denied to write to the file\n3. Failed to find the file", "Failed Logging")
    finally:
        try:
            payload = {
                "job_id": job_id,
                "title": title,
                "company": company,
                "location": work_location,
                "work_style": work_style,
                "date_posted": str(date_listed),
                "date_applied": str(date_applied),
                "application_link": application_link,
                "job_link": job_link,
                "application_provider": application_provider or ("linkedin_easy_apply" if application_link == "Easy Applied" else "external"),
                "application_stage": application_stage or "submitted",
                "review_required": review_required,
            }
            emit_job_event("job_applied", payload)
        except Exception:
            pass


# Function to discard the job application
def discard_job() -> None:
    actions.send_keys(Keys.ESCAPE).perform()
    wait_span_click(driver, 'Discard', 2)


# Function to apply to jobs
def apply_to_jobs(search_terms: list[str]) -> None:
    applied_jobs = get_applied_job_ids()
    rejected_jobs = set()
    blacklisted_companies = set()
    global current_city, failed_count, skip_count, easy_applied_count, external_jobs_count, tabs_count, pause_before_submit, pause_at_failed_question, useNewResume
    current_city = current_city.strip()

    if randomize_search_order:
        shuffle(search_terms)
    for searchTerm in search_terms:
        ensure_not_stopping("before starting a new search term")
        print_step("Opening job search", searchTerm)
        driver.get(
            f"https://www.linkedin.com/jobs/search/?keywords={searchTerm}")
        print_lg("\n________________________________________________________________________________________________________________________\n")
        print_lg(f'\n>>>> Now searching for "{searchTerm}" <<<<\n\n')

        apply_filters()

        current_count = 0
        try:
            while current_count < switch_number:
                ensure_not_stopping("during the LinkedIn search loop")
                # Wait until job listings are loaded
                wait.until(EC.presence_of_all_elements_located(
                    (By.XPATH, "//li[@data-occludable-job-id]")))

                pagination_element, current_page = get_page_info()

                # Find all job listings in current page
                buffer(3)
                job_listings = driver.find_elements(
                    By.XPATH, "//li[@data-occludable-job-id]")

                for job in job_listings:
                    ensure_not_stopping("while processing LinkedIn job cards")
                    if keep_screen_awake:
                        pyautogui.press('shiftright')
                    if current_count >= switch_number:
                        break
                    print_lg("\n-@-\n")

                    job_id, title, company, work_location, work_style, skip = get_job_main_details(
                        job, blacklisted_companies, rejected_jobs)

                    if skip:
                        continue
                    print_step("Reviewing job",
                               f"{title} | {company} | {job_id}")
                    # Redundant fail safe check for applied jobs!
                    try:
                        if job_id in applied_jobs or find_by_class(driver, "jobs-s-apply__application-link", 2):
                            print_lg(
                                f'Already applied to "{title} | {company}" job. Job ID: {job_id}!')
                            continue
                    except Exception as e:
                        print_lg(
                            f'Trying to Apply to "{title} | {company}" job. Job ID: {job_id}')

                    job_link = "https://www.linkedin.com/jobs/view/"+job_id
                    application_link = "Easy Applied"
                    application_provider = "linkedin_easy_apply"
                    application_stage = "submitted"
                    review_required = False
                    date_applied = "Pending"
                    hr_link = "Unknown"
                    hr_name = "Unknown"
                    connect_request = "In Development"  # Still in development
                    date_listed = "Unknown"
                    skills = "Needs an AI"  # Still in development
                    resume = "Pending"
                    reposted = False
                    questions_list = None
                    external_result: ExternalApplyResult | None = None
                    try:
                        rejected_jobs, blacklisted_companies, jobs_top_card = check_blacklist(
                            rejected_jobs, job_id, company, blacklisted_companies)
                    except ValueError as e:
                        print_lg(e, 'Skipping this job!\n')
                        failed_job(job_id, title, company, work_location, work_style, job_link, resume,
                                   date_listed, "Found Blacklisted words in About Company", e, "Skipped")
                        skip_count += 1
                        continue
                    except Exception as e:
                        print_lg("Failed to scroll to About Company!")
                        # print_lg(e)

                    # Hiring Manager info
                    try:
                        hr_info_card = WebDriverWait(driver, 2).until(EC.presence_of_element_located(
                            (By.CLASS_NAME, "hirer-card__hirer-information")))
                        hr_link = hr_info_card.find_element(
                            By.TAG_NAME, "a").get_attribute("href")
                        hr_name = hr_info_card.find_element(
                            By.TAG_NAME, "span").text
                        # if connect_hr:
                        #     driver.switch_to.new_window('tab')
                        #     driver.get(hr_link)
                        #     wait_span_click("More")
                        #     wait_span_click("Connect")
                        #     wait_span_click("Add a note")
                        #     message_box = driver.find_element(By.XPATH, "//textarea")
                        #     message_box.send_keys(connect_request_message)
                        #     if close_tabs: driver.close()
                        #     driver.switch_to.window(linkedIn_tab)
                        # def message_hr(hr_info_card):
                        #     if not hr_info_card: return False
                        #     hr_info_card.find_element(By.XPATH, ".//span[normalize-space()='Message']").click()
                        #     message_box = driver.find_element(By.XPATH, "//div[@aria-label='Write a message…']")
                        #     message_box.send_keys()
                        #     try_xp(driver, "//button[normalize-space()='Send']")
                    except Exception as e:
                        print_lg(
                            f'HR info was not given for "{title}" with Job ID: {job_id}!')
                        # print_lg(e)

                    # Calculation of date posted
                    try:
                        # try: time_posted_text = find_by_class(driver, "jobs-unified-top-card__posted-date", 2).text
                        # except:
                        time_posted_text = jobs_top_card.find_element(
                            By.XPATH, './/span[contains(normalize-space(), " ago")]').text
                        print("Time Posted: " + time_posted_text)
                        if time_posted_text.__contains__("Reposted"):
                            reposted = True
                            time_posted_text = time_posted_text.replace(
                                "Reposted", "")
                        date_listed = calculate_date_posted(
                            time_posted_text.strip())
                    except Exception as e:
                        print_lg("Failed to calculate the date posted!", e)

                    description, experience_required, skip, reason, message = get_job_description()
                    if skip:
                        print_lg(message)
                        failed_job(job_id, title, company, work_location, work_style,
                                   job_link, resume, date_listed, reason, message, "Skipped")
                        rejected_jobs.add(job_id)
                        skip_count += 1
                        continue

                    print_step("Analyzing job details", f"{title} | {company}")

                    if use_AI and description != "Unknown":
                        try:
                            provider = ai_provider.lower()
                            if provider in ["openai", "groq"]:
                                skills = ai_extract_skills(
                                    aiClient, description)
                            elif provider == "deepseek":
                                skills = deepseek_extract_skills(
                                    aiClient, description)
                            elif provider == "gemini":
                                skills = gemini_extract_skills(
                                    aiClient, description)
                            else:
                                skills = "In Development"
                            print_lg(
                                f"Extracted skills using {ai_provider} AI")
                        except Exception as e:
                            print_lg("Failed to extract skills:", e)
                            skills = "Error extracting skills"

                    uploaded = False
                    # Case 1: Easy Apply (button or LinkedIn in-page apply link)
                    # Old UI: button with aria-label containing "Easy"
                    # LinkedIn rebrand UI: button with aria-label containing "LinkedIn Apply"
                    # New UI: <a aria-label="LinkedIn Apply to this job" href=".../apply/?openSDUIApplyFlow=true">
                    easy_apply_elem = try_xp(
                        driver, ".//button[contains(@class,'jobs-apply-button') and contains(@class, 'artdeco-button--3') and (contains(@aria-label, 'Easy') or contains(@aria-label, 'LinkedIn Apply'))]", click=False)
                    if not easy_apply_elem:
                        easy_apply_elem = try_xp(
                            driver, ".//a[contains(@aria-label, 'LinkedIn Apply') and contains(@href, 'openSDUIApplyFlow')]", click=False)
                    if not easy_apply_elem:
                        easy_apply_elem = try_xp(
                            driver, ".//a[contains(@href, '/apply/') and contains(@href, 'openSDUIApplyFlow')]", click=False)
                    if easy_apply_elem:
                        try:
                            easy_apply_elem.click()
                            buffer(1)
                        except Exception:
                            pass
                    if easy_apply_elem:
                        print_step("Starting Easy Apply",
                                   f"{title} | {company}")
                        try:
                            try:
                                errored = ""
                                modal = find_by_class(
                                    driver, "jobs-easy-apply-modal")
                                wait_span_click(modal, "Next", 1)
                                # if description != "Unknown":
                                #     resume = create_custom_resume(description)
                                resume = "Previous resume"
                                next_button = True
                                questions_list = set()
                                next_counter = 0
                                while next_button:
                                    ensure_not_stopping(f"during Easy Apply for {title}")
                                    next_counter += 1
                                    if next_counter >= 15:
                                        if pause_at_failed_question:
                                            pyautogui.alert(
                                                "Couldn't answer one or more questions.\nPlease click \"Continue\" once done.\nDO NOT CLICK Back, Next or Review button in LinkedIn.\n\n\n\n\nYou can turn off \"Pause at failed question\" setting in config.py", "Help Needed", "Continue")
                                            next_counter = 1
                                            continue
                                        if questions_list:
                                            print_lg(
                                                "Stuck for one or some of the following questions...", questions_list)
                                        errored = "stuck"
                                        raise Exception(
                                            "Seems like stuck in a continuous loop of next, probably because of new questions.")
                                    print_step(
                                        "Answering application questions", f"{title} | {company}")
                                    questions_list = answer_questions(
                                        modal, questions_list, work_location, job_description=description)
                                    if useNewResume and not uploaded:
                                        uploaded, resume = upload_resume(
                                            modal, default_resume_path)
                                    try:
                                        next_button = modal.find_element(
                                            By.XPATH, './/span[normalize-space(.)="Review"]')
                                    except NoSuchElementException:
                                        next_button = modal.find_element(
                                            By.XPATH, './/button[contains(span, "Next")]')
                                    try:
                                        next_button.click()
                                    except ElementClickInterceptedException:
                                        break    # Happens when it tries to click Next button in About Company photos section
                                    buffer(click_gap)

                            except NoSuchElementException:
                                errored = "nose"
                            finally:
                                if questions_list and errored != "stuck":
                                    print_lg(
                                        "Answered the following questions...", questions_list)
                                    print("\n\n" + "\n".join(str(question)
                                          for question in questions_list) + "\n\n")
                                ensure_not_stopping(f"before reviewing Easy Apply for {title}")
                                wait_span_click(
                                    driver, "Review", 1, scrollTop=True)
                                cur_pause_before_submit = pause_before_submit
                                if errored != "stuck" and cur_pause_before_submit:
                                    decision = pyautogui.confirm('1. Please verify your information.\n2. If you edited something, please return to this final screen.\n3. DO NOT CLICK "Submit Application".\n\n\n\n\nYou can turn off "Pause before submit" setting in config.py\nTo TEMPORARILY disable pausing, click "Disable Pause"', "Confirm your information", [
                                                                 "Disable Pause", "Discard Application", "Submit Application"])
                                    if decision == "Discard Application":
                                        raise Exception(
                                            "Job application discarded by user!")
                                    pause_before_submit = False if "Disable Pause" == decision else True
                                    # try_xp(modal, ".//span[normalize-space(.)='Review']")
                                follow_company(modal)
                                print_step("Submitting application",
                                           f"{title} | {company}")
                                if wait_span_click(driver, "Submit application", 2, scrollTop=True):
                                    date_applied = datetime.now()
                                    if not wait_span_click(driver, "Done", 2):
                                        actions.send_keys(
                                            Keys.ESCAPE).perform()
                                elif errored != "stuck" and cur_pause_before_submit and "Yes" in pyautogui.confirm("You submitted the application, didn't you 😒?", "Failed to find Submit Application!", ["Yes", "No"]):
                                    date_applied = datetime.now()
                                    wait_span_click(driver, "Done", 2)
                                else:
                                    print_lg(
                                        "Since, Submit Application failed, discarding the job application...")
                                    if errored == "nose":
                                        raise Exception(
                                            "Failed to click Submit application 😑")

                        except StopRequested:
                            try:
                                discard_job()
                            except Exception:
                                pass
                            raise
                        except Exception as e:
                            print_lg("Failed to Easy apply!")
                            # print_lg(e)
                            critical_error_log(
                                "Somewhere in Easy Apply process", e)
                            failed_job(job_id, title, company, work_location, work_style, job_link,
                                       resume, date_listed, "Problem in Easy Applying", e, application_link,
                                       application_provider="linkedin_easy_apply", application_stage="failed")
                            failed_count += 1
                            discard_job()
                            continue
                    else:
                        # Case 2: Apply externally
                        print_step("Opening external application",
                                   f"{title} | {company}")
                        external_result, tabs_count = external_apply(
                            pagination_element,
                            job_id,
                            title,
                            company,
                            work_location,
                            work_style,
                            job_link,
                            resume,
                            date_listed,
                            application_link,
                            job_description=description,
                        )
                        if dailyEasyApplyLimitReached:
                            print_lg(
                                "\n###############  Daily application limit for Easy Apply is reached!  ###############\n")
                            return
                        if external_result.skipped:
                            continue
                        application_link = external_result.application_link
                        application_provider = external_result.provider
                        application_stage = external_result.stage
                        review_required = external_result.review_required
                        resume = external_result.resume_label or resume
                        if not external_result.submitted:
                            failed_job(
                                job_id,
                                title,
                                company,
                                work_location,
                                work_style,
                                job_link,
                                resume,
                                date_listed,
                                external_result.reason or "External application was not submitted",
                                Exception(external_result.reason or "External application was not submitted"),
                                application_link,
                                application_provider=application_provider,
                                application_stage=application_stage,
                                review_required=review_required,
                            )
                            if external_result.unsupported:
                                skip_count += 1
                            else:
                                failed_count += 1
                            continue
                        date_applied = datetime.now()

                    submitted_jobs(job_id, title, company, work_location, work_style, description, experience_required, skills, hr_name,
                                   hr_link, resume, reposted, date_listed, date_applied, job_link, application_link, questions_list, connect_request,
                                   application_provider=application_provider, application_stage=application_stage, review_required=review_required)
                    if uploaded:
                        useNewResume = False
                    if external_result and external_result.resume_label != "Previous resume":
                        useNewResume = False

                    print_lg(
                        f'Successfully saved "{title} | {company}" job. Job ID: {job_id} info')
                    current_count += 1
                    if application_link == "Easy Applied":
                        easy_applied_count += 1
                    else:
                        external_jobs_count += 1
                    applied_jobs.add(job_id)

                # Switching to next page
                if pagination_element == None:
                    print_lg(
                        "Couldn't find pagination element, probably at the end page of results!")
                    break
                try:
                    pagination_element.find_element(
                        By.XPATH, f"//button[@aria-label='Page {current_page+1}']").click()
                    print_lg(f"\n>-> Now on Page {current_page+1} \n")
                except NoSuchElementException:
                    print_lg(
                        f"\n>-> Didn't find Page {current_page+1}. Probably at the end page of results!\n")
                    break

        except StopRequested:
            raise
        except (NoSuchWindowException, WebDriverException) as e:
            print_lg(
                "Browser window closed or session is invalid. Ending application process.", e)
            raise e  # Re-raise to be caught by main
        except Exception as e:
            print_lg("Failed to find Job listings!")
            critical_error_log("In Applier", e)
            try:
                print_lg(driver.page_source, pretty=True)
            except Exception as page_source_error:
                print_lg(
                    f"Failed to get page source, browser might have crashed. {page_source_error}")
            # print_lg(e)


def run(total_runs: int) -> int:
    if dailyEasyApplyLimitReached:
        return total_runs
    ensure_not_stopping("before starting a run cycle")
    print_step("Starting run cycle", str(total_runs))
    print_lg("\n########################################################################################################################\n")
    print_lg(f"Date and Time: {datetime.now()}")
    print_lg(f"Cycle number: {total_runs}")
    print_lg(
        f"Currently looking for jobs posted within '{date_posted}' and sorting them by '{sort_by}'")
    apply_to_jobs(search_terms)
    print_lg("########################################################################################################################\n")
    if not dailyEasyApplyLimitReached:
        print_lg("Sleeping for 10 min...")
        sleep_with_stop(300)
        print_lg("Few more min... Gonna start with in next 5 min...")
        sleep_with_stop(300)
    buffer(3)
    return total_runs + 1


chatGPT_tab = False
linkedIn_tab = False


def main() -> None:
    total_runs = 1
    try:
        global linkedIn_tab, tabs_count, useNewResume, aiClient, date_posted, sort_by
        alert_title = "Error Occurred. Closing Browser!"
        print_step("Booting bot")
        validate_config()
        print_step("Configuration validated")
        print_step(
            "Runtime config loaded",
            f"path={BOT_CONFIG_PATH}, run_type={run_type}, search_terms={search_terms}, search_location={search_location}, date={date_posted}, sort={sort_by}",
        )

        if not default_resume_path:
            print_lg("No default resume is selected for this run. The bot will keep using the previously uploaded LinkedIn resume.")
            useNewResume = False
        elif not os.path.exists(default_resume_path):
            pyautogui.alert(text='Your selected resume "{}" is missing on disk.\n\nFor now the bot will continue using your previous upload from LinkedIn!'.format(
                default_resume_path), title="Missing Resume", button="OK")
            useNewResume = False

        # Login to LinkedIn
        tabs_count = len(driver.window_handles)
        driver.get("https://www.linkedin.com/login")
        print_step("Preparing LinkedIn session")
        if not is_logged_in_LN():
            login_LN()

        linkedIn_tab = driver.current_window_handle

        # # Login to ChatGPT in a new tab for resume customization
        # if use_resume_generator:
        #     try:
        #         driver.switch_to.new_window('tab')
        #         driver.get("https://chat.openai.com/")
        #         if not is_logged_in_GPT(): login_GPT()
        #         open_resume_chat()
        #         global chatGPT_tab
        #         chatGPT_tab = driver.current_window_handle
        #     except Exception as e:
        #         print_lg("Opening OpenAI chatGPT tab failed!")
        if use_AI:
            print_step("Initializing AI client", ai_provider)
            # Note: Groq exposes an OpenAI-compatible API, so we reuse the OpenAI client
            if ai_provider in ["openai", "groq"]:
                aiClient = ai_create_openai_client()
            # Create DeepSeek client
            elif ai_provider == "deepseek":
                aiClient = deepseek_create_client()
            elif ai_provider == "gemini":
                aiClient = gemini_create_client()

            try:
                about_company_for_ai = " ".join(
                    [word for word in (first_name+" "+last_name).split() if len(word) > 3])
                print_lg(
                    f"Extracted about company info for AI: '{about_company_for_ai}'")
            except Exception as e:
                print_lg("Failed to extract about company info!", e)

        # Start applying to jobs
        print_step("Bot is ready")
        driver.switch_to.window(linkedIn_tab)
        if run_type == "outreach":
            total_runs = run_outreach(total_runs)
        else:
            total_runs = run(total_runs)
        while (run_non_stop):
            if run_type == "outreach":
                total_runs = run_outreach(total_runs)
                continue
            if cycle_date_posted:
                date_options = ["Any time", "Past month",
                                "Past week", "Past 24 hours"]
                date_posted = date_options[date_options.index(date_posted)+1 if date_options.index(date_posted)+1 > len(
                    date_options) else -1] if stop_date_cycle_at_24hr else date_options[0 if date_options.index(date_posted)+1 >= len(date_options) else date_options.index(date_posted)+1]
            if alternate_sortby:
                sort_by = "Most recent" if sort_by == "Most relevant" else "Most relevant"
                total_runs = run(total_runs)
                sort_by = "Most recent" if sort_by == "Most relevant" else "Most relevant"
            total_runs = run(total_runs)
            if dailyEasyApplyLimitReached:
                break

    except (NoSuchWindowException, WebDriverException) as e:
        print_lg("Browser window closed or session is invalid. Exiting.", e)
    except StopRequested:
        print_lg("Stop requested. Shutting down the bot gracefully.")
    except Exception as e:
        critical_error_log("In Applier Main", e)
        pyautogui.alert(e, alert_title)
    finally:
        summary = "Total runs: {}\nJobs Easy Applied: {}\nExternal job links collected: {}\nRecruiter outreaches sent: {}\nTotal applied or collected: {}\nFailed jobs: {}\nIrrelevant jobs skipped: {}\n".format(
            total_runs, easy_applied_count, external_jobs_count, outreach_count, easy_applied_count + external_jobs_count + outreach_count, failed_count, skip_count)
        print_lg(summary)
        print_lg("\n\nTotal runs:                     {}".format(total_runs))
        print_lg("Jobs Easy Applied:              {}".format(easy_applied_count))
        print_lg("External job links collected:   {}".format(external_jobs_count))
        print_lg("Recruiter outreaches sent:      {}".format(outreach_count))
        print_lg("                              ----------")
        print_lg("Total applied or collected:     {}".format(
            easy_applied_count + external_jobs_count + outreach_count))
        print_lg("\nFailed jobs:                    {}".format(failed_count))
        print_lg("Irrelevant jobs skipped:        {}\n".format(skip_count))
        if randomly_answered_questions:
            print_lg("\n\nQuestions randomly answered:\n  {}  \n\n".format(
                ";\n".join(str(question) for question in randomly_answered_questions)))
        msg = f"Summary:\n{summary}"
        if not should_stop():
            pyautogui.alert(msg, "Exiting..")
        print_lg(msg, "Closing the browser...")
        if tabs_count >= 10:
            msg = "NOTE: IF YOU HAVE MORE THAN 10 TABS OPENED, PLEASE CLOSE OR BOOKMARK THEM!\n\nOr it's highly likely that application will just open browser and not do anything next time!"
            if not should_stop():
                pyautogui.alert(msg, "Info")
            print_lg("\n"+msg)
        if use_AI and aiClient:
            try:
                provider = ai_provider.lower()
                if provider in ["openai", "groq", "deepseek"]:
                    ai_close_openai_client(aiClient)
                elif provider == "gemini":
                    # Gemini client does not need to be closed explicitly
                    pass
                print_lg(f"Closed {ai_provider} AI client.")
            except Exception as e:
                print_lg("Failed to close AI client:", e)
        try:
            if driver:
                driver.quit()
        except WebDriverException as e:
            print_lg("Browser already closed.", e)
        except Exception as e:
            critical_error_log("When quitting...", e)


if __name__ == "__main__":
    main()
