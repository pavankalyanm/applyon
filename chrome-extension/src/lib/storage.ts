import type { AuthState } from './types'

const AUTH_KEY = 'applyflowai_auth'
const BACKEND_URL_KEY = 'applyflowai_backend_url'

export async function getAuth(): Promise<AuthState | null> {
  const result = await chrome.storage.local.get(AUTH_KEY)
  return result[AUTH_KEY] ?? null
}

export async function setAuth(auth: AuthState): Promise<void> {
  await chrome.storage.local.set({ [AUTH_KEY]: auth })
}

export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove(AUTH_KEY)
}

/** User-configured backend URL override (persists across sessions) */
export async function getSavedBackendUrl(): Promise<string | null> {
  const result = await chrome.storage.local.get(BACKEND_URL_KEY)
  return result[BACKEND_URL_KEY] ?? null
}

export async function setSavedBackendUrl(url: string): Promise<void> {
  await chrome.storage.local.set({ [BACKEND_URL_KEY]: url.replace(/\/$/, '') })
}

export function deriveBackendUrl(frontendOrigin: string): string {
  try {
    const url = new URL(frontendOrigin)
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      url.port = '8000'
      return url.origin
    }
    // Cloud: same origin (nginx reverse proxy handles /api routing)
    return frontendOrigin
  } catch {
    return frontendOrigin
  }
}

export function deriveFrontendUrl(backendUrl: string): string {
  try {
    const url = new URL(backendUrl)
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      url.port = '5173'
      return url.origin
    }
    return backendUrl
  } catch {
    return backendUrl
  }
}
