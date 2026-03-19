from config.settings import click_gap, smooth_scroll
from modules.helpers import buffer, print_lg, sleep
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.common.action_chains import ActionChains
from modules.visual_cursor import show_cursor_click, show_cursor_scroll, show_cursor_typing

# Click Functions


def wait_span_click(driver: WebDriver, text: str, time: float = 5.0, click: bool = True, scroll: bool = True, scrollTop: bool = False) -> WebElement | bool:
    '''
    Finds the span element with the given `text`.
    - Returns `WebElement` if found, else `False` if not found.
    - Clicks on it if `click = True`.
    - Will spend a max of `time` seconds in searching for each element.
    - Will scroll to the element if `scroll = True`.
    - Will scroll to the top if `scrollTop = True`.
    '''
    if text:
        try:
            button = WebDriverWait(driver, time).until(EC.presence_of_element_located(
                (By.XPATH, './/span[normalize-space(.)="'+text+'"]')))
            if scroll:
                scroll_to_view(driver, button, scrollTop)
            if click:
                show_cursor_click(driver, button, f'Clicking {text}')
                button.click()
                buffer(click_gap)
            return button
        except Exception as e:
            print_lg("Click Failed! Didn't find '"+text+"'")
            # print_lg(e)
            return False


def multi_sel(driver: WebDriver, texts: list, time: float = 5.0) -> None:
    '''
    - For each text in the `texts`, tries to find and click `span` element with that text.
    - Will spend a max of `time` seconds in searching for each element.
    '''
    for text in texts:
        wait_span_click(driver, text, time, False)
        try:
            button = WebDriverWait(driver, time).until(EC.presence_of_element_located(
                (By.XPATH, './/span[normalize-space(.)="'+text+'"]')))
            scroll_to_view(driver, button)
            show_cursor_click(driver, button, f'Clicking {text}')
            button.click()
            buffer(click_gap)
        except Exception as e:
            print_lg("Click Failed! Didn't find '"+text+"'")
            # print_lg(e)


def multi_sel_noWait(driver: WebDriver, texts: list, actions: ActionChains = None) -> None:
    '''
    - For each text in the `texts`, tries to find and click `span` element with that class.
    - If `actions` is provided, bot tries to search and Add the `text` to this filters list section.
    - Won't wait to search for each element, assumes that element is rendered.
    '''
    for text in texts:
        try:
            button = driver.find_element(
                By.XPATH, './/span[normalize-space(.)="'+text+'"]')
            scroll_to_view(driver, button)
            show_cursor_click(driver, button, f'Clicking {text}')
            button.click()
            buffer(click_gap)
        except Exception as e:
            if actions:
                company_search_click(driver, actions, text)
            else:
                print_lg("Click Failed! Didn't find '"+text+"'")
            # print_lg(e)


def boolean_button_click(driver: WebDriver, actions: ActionChains, text: str) -> None:
    '''
    Tries to click on the boolean button (toggle/switch) with the given `text` label.
    Tries multiple selectors for LinkedIn filter panel compatibility.
    '''
    strategies = [
        # Original: h3 label -> fieldset -> switch
        ('.//h3[normalize-space()="' + text + '"]/ancestor::fieldset',
         './/input[@role="switch"]'),
        # Label in span -> ancestor fieldset -> switch
        ('.//*[self::h3 or self::span or self::label][normalize-space(.)="' +
         text + '"]/ancestor::fieldset', './/input[@role="switch"]'),
        # Any element with exact text -> ancestor with switch
        ('.//*[normalize-space(.)="' + text +
         '"]/ancestor::*[.//input[@role="switch"]]', './/input[@role="switch"]'),
        # Switch with aria-label (e.g. "Easy Apply")
        (None, './/input[@role="switch" and contains(translate(@aria-label, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "' + text.lower().split()[0] + '")]'),
        # Click label/span that toggles (some UIs use the text as click target)
        ('.//*[normalize-space(.)="' + text + '"]', None),
    ]
    for container_xpath, control_xpath in strategies:
        try:
            if container_xpath and control_xpath:
                list_container = driver.find_element(By.XPATH, container_xpath)
                button = list_container.find_element(By.XPATH, control_xpath)
            elif control_xpath:
                button = driver.find_element(By.XPATH, control_xpath)
            elif container_xpath:
                button = driver.find_element(By.XPATH, container_xpath)
            else:
                continue
            scroll_to_view(driver, button)
            try:
                show_cursor_click(driver, button, f'Toggling {text}')
                button.click()
            except Exception:
                show_cursor_click(driver, button, f'Toggling {text}')
                actions.move_to_element(button).click().perform()
            buffer(click_gap)
            return
        except Exception:
            continue
    print_lg("Click Failed! Didn't find '" + text + "'")

# Find functions


def find_by_class(driver: WebDriver, class_name: str, time: float = 5.0) -> WebElement | Exception:
    '''
    Waits for a max of `time` seconds for element to be found, and returns `WebElement` if found, else `Exception` if not found.
    '''
    return WebDriverWait(driver, time).until(EC.presence_of_element_located((By.CLASS_NAME, class_name)))

# Scroll functions


def scroll_to_view(driver: WebDriver, element: WebElement, top: bool = False, smooth_scroll: bool = smooth_scroll) -> None:
    '''
    Scrolls the `element` to view.
    - `smooth_scroll` will scroll with smooth behavior.
    - `top` will scroll to the `element` to top of the view.
    '''
    if top:
        show_cursor_scroll(driver, element, "Jumping to section")
        return driver.execute_script('arguments[0].scrollIntoView();', element)
    behavior = "smooth" if smooth_scroll else "instant"
    show_cursor_scroll(driver, element, "Scrolling")
    return driver.execute_script('arguments[0].scrollIntoView({block: "center", behavior: "'+behavior+'" });', element)

# Enter input text functions


def text_input_by_ID(driver: WebDriver, id: str, value: str, time: float = 5.0) -> None | Exception:
    '''
    Enters `value` into the input field with the given `id` if found, else throws NotFoundException.
    - `time` is the max time to wait for the element to be found.
    '''
    username_field = WebDriverWait(driver, time).until(
        EC.presence_of_element_located((By.ID, id)))
    show_cursor_typing(driver, username_field, f"Typing into {id}")
    username_field.send_keys(Keys.CONTROL + "a")
    username_field.send_keys(value)


def try_xp(driver: WebDriver, xpath: str, click: bool = True) -> WebElement | bool:
    try:
        if click:
            driver.find_element(By.XPATH, xpath).click()
            return True
        else:
            return driver.find_element(By.XPATH, xpath)
    except:
        return False


def try_linkText(driver: WebDriver, linkText: str) -> WebElement | bool:
    try:
        return driver.find_element(By.LINK_TEXT, linkText)
    except:
        return False


def try_find_by_classes(driver: WebDriver, classes: list[str]) -> WebElement | ValueError:
    for cla in classes:
        try:
            return driver.find_element(By.CLASS_NAME, cla)
        except:
            pass
    raise ValueError("Failed to find an element with given classes")


def company_search_click(driver: WebDriver, actions: ActionChains, companyName: str) -> None:
    '''
    Tries to search and Add the company to company filters list.
    '''
    wait_span_click(driver, "Add a company", 1)
    search = driver.find_element(
        By.XPATH, "(.//input[@placeholder='Add a company'])[1]")
    show_cursor_typing(driver, search, f'Searching {companyName}')
    search.send_keys(Keys.CONTROL + "a")
    search.send_keys(companyName)
    buffer(3)
    actions.send_keys(Keys.DOWN).perform()
    actions.send_keys(Keys.ENTER).perform()
    print_lg(f'Tried searching and adding "{companyName}"')


def text_input(actions: ActionChains, textInputEle: WebElement | bool, value: str, textFieldName: str = "Text") -> None | Exception:
    if textInputEle:
        sleep(1)
        # actions.key_down(Keys.CONTROL).send_keys("a").key_up(Keys.CONTROL).perform()
        textInputEle.clear()
        show_cursor_typing(getattr(textInputEle, "parent", None), textInputEle, f'Typing {textFieldName}')
        textInputEle.send_keys(value.strip())
        sleep(2)
        actions.send_keys(Keys.ENTER).perform()
    else:
        print_lg(f'{textFieldName} input was not given!')
