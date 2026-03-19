from __future__ import annotations

import time

from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement

from config.settings import run_in_background, show_bot_cursor


OVERLAY_BOOTSTRAP_JS = r"""
(() => {
  if (window.__jobcookBotCursor && window.__jobcookBotCursor.version === 1) {
    return true;
  }

  const existing = document.getElementById('jobcook-bot-overlay');
  if (existing) {
    existing.remove();
  }

  const root = document.createElement('div');
  root.id = 'jobcook-bot-overlay';
  root.style.position = 'fixed';
  root.style.inset = '0';
  root.style.pointerEvents = 'none';
  root.style.zIndex = '2147483647';
  root.style.fontFamily = 'Inter, system-ui, sans-serif';

  const cursor = document.createElement('div');
  cursor.style.position = 'fixed';
  cursor.style.left = '0';
  cursor.style.top = '0';
  cursor.style.width = '14px';
  cursor.style.height = '14px';
  cursor.style.borderRadius = '999px';
  cursor.style.background = 'linear-gradient(135deg, #86efac, #22c55e)';
  cursor.style.boxShadow = '0 0 0 3px rgba(34, 197, 94, 0.18), 0 8px 24px rgba(15, 23, 42, 0.24)';
  cursor.style.transform = 'translate(-9999px, -9999px)';
  cursor.style.transition = 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 140ms ease';
  cursor.style.opacity = '0';

  const ring = document.createElement('div');
  ring.style.position = 'fixed';
  ring.style.left = '0';
  ring.style.top = '0';
  ring.style.width = '42px';
  ring.style.height = '42px';
  ring.style.borderRadius = '999px';
  ring.style.border = '2px solid rgba(245, 158, 11, 0.95)';
  ring.style.background = 'rgba(245, 158, 11, 0.08)';
  ring.style.transform = 'translate(-9999px, -9999px) scale(0.55)';
  ring.style.transformOrigin = 'center';
  ring.style.transition = 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease, border-color 160ms ease';
  ring.style.opacity = '0';

  const label = document.createElement('div');
  label.style.position = 'fixed';
  label.style.left = '0';
  label.style.top = '0';
  label.style.padding = '7px 10px';
  label.style.borderRadius = '999px';
  label.style.background = 'rgba(15, 23, 42, 0.92)';
  label.style.color = '#f8fafc';
  label.style.fontSize = '12px';
  label.style.fontWeight = '700';
  label.style.letterSpacing = '0.02em';
  label.style.transform = 'translate(-9999px, -9999px)';
  label.style.transition = 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 140ms ease';
  label.style.opacity = '0';
  label.style.whiteSpace = 'nowrap';
  label.style.boxShadow = '0 10px 24px rgba(15, 23, 42, 0.25)';

  root.appendChild(ring);
  root.appendChild(cursor);
  root.appendChild(label);
  document.documentElement.appendChild(root);

  const api = {
    version: 1,
    root,
    cursor,
    ring,
    label,
    lastX: 48,
    lastY: 48,
    lastPulseTimer: null,
    lastLabelTimer: null,
    setLabel(text, x, y) {
      if (!text) {
        label.style.opacity = '0';
        return;
      }
      label.textContent = String(text);
      label.style.transform = `translate(${Math.round(x + 18)}px, ${Math.round(y - 16)}px)`;
      label.style.opacity = '1';
      if (api.lastLabelTimer) {
        clearTimeout(api.lastLabelTimer);
      }
      api.lastLabelTimer = setTimeout(() => {
        label.style.opacity = '0';
      }, 850);
    },
    pulse(kind) {
      const color = kind === 'typing'
        ? 'rgba(59, 130, 246, 0.95)'
        : kind === 'scroll'
          ? 'rgba(168, 85, 247, 0.95)'
          : 'rgba(245, 158, 11, 0.95)';
      ring.style.borderColor = color;
      ring.style.opacity = '1';
      ring.style.transform = `translate(${Math.round(api.lastX - 14)}px, ${Math.round(api.lastY - 14)}px) scale(1)`;
      if (api.lastPulseTimer) {
        clearTimeout(api.lastPulseTimer);
      }
      api.lastPulseTimer = setTimeout(() => {
        ring.style.opacity = '0';
        ring.style.transform = `translate(${Math.round(api.lastX - 14)}px, ${Math.round(api.lastY - 14)}px) scale(1.45)`;
      }, 170);
    },
    moveToRect(rect, text, kind) {
      if (!rect) {
        return false;
      }
      const x = Math.max(14, Math.min(window.innerWidth - 14, rect.left + Math.max(Math.min(rect.width * 0.45, rect.width - 8), 8)));
      const y = Math.max(14, Math.min(window.innerHeight - 14, rect.top + Math.max(Math.min(rect.height * 0.5, rect.height - 8), 8)));
      api.lastX = x;
      api.lastY = y;
      cursor.style.transform = `translate(${Math.round(x - 7)}px, ${Math.round(y - 7)}px)`;
      cursor.style.opacity = '1';
      ring.style.transform = `translate(${Math.round(x - 14)}px, ${Math.round(y - 14)}px) scale(0.82)`;
      ring.style.opacity = '0.82';
      api.setLabel(text, x, y);
      if (kind) {
        api.pulse(kind);
      }
      return true;
    },
    moveToElement(el, text, kind) {
      if (!el || !el.getBoundingClientRect) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      if (!rect || (!rect.width && !rect.height)) {
        return false;
      }
      return api.moveToRect(rect, text, kind);
    },
  };

  window.__jobcookBotCursor = api;
  return true;
})();
"""


def cursor_enabled() -> bool:
    return bool(show_bot_cursor) and not bool(run_in_background)


def ensure_visual_cursor(driver: WebDriver | None) -> bool:
    if not cursor_enabled() or driver is None:
        return False
    try:
        driver.execute_script(OVERLAY_BOOTSTRAP_JS)
        return True
    except Exception:
        return False


def _animate_element(driver: WebDriver | None, element: WebElement | None, label: str, kind: str, pause: float) -> None:
    if not cursor_enabled() or driver is None or element is None:
        return
    try:
        ensure_visual_cursor(driver)
        driver.execute_script(
            """
            if (window.__jobcookBotCursor) {
              window.__jobcookBotCursor.moveToElement(arguments[0], arguments[1], arguments[2]);
            }
            """,
            element,
            label,
            kind,
        )
        if pause > 0:
            time.sleep(pause)
    except Exception:
        return


def show_cursor_click(driver: WebDriver | None, element: WebElement | None, label: str = "Clicking") -> None:
    _animate_element(driver, element, label, "click", 0.09)


def show_cursor_scroll(driver: WebDriver | None, element: WebElement | None, label: str = "Scrolling") -> None:
    _animate_element(driver, element, label, "scroll", 0.05)


def show_cursor_typing(driver: WebDriver | None, element: WebElement | None, label: str = "Typing") -> None:
    _animate_element(driver, element, label, "typing", 0.06)
