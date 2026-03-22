/**
 * ApplyOn LinkedIn Bot — content script injected into a LinkedIn jobs tab.
 * Reads run context from chrome.storage.session, applies to Easy Apply jobs,
 * and sends logs back to the background service worker.
 */

interface BotContext {
  runId: number
  config: Record<string, unknown>
  token: string
  backendUrl: string
}

interface JobRecord {
  title: string
  company: string
  url: string
  status: 'applied' | 'skipped' | 'error'
}

// ─── Context validity guard ─────────────────────────────────────────────────
function isCtxValid(): boolean {
  try { return !!chrome.runtime?.id } catch { return false }
}

// ─── Guard: only run once per tab ──────────────────────────────────────────
if ((window as Window & { _applyonBotRunning?: boolean })._applyonBotRunning) {
  throw new Error('Bot already running')
}
;(window as Window & { _applyonBotRunning?: boolean })._applyonBotRunning = true

// ─── Globals ────────────────────────────────────────────────────────────────
let ctx: BotContext | null = null
let stopFlag = false
let appliedCount = 0

// Listen for stop signal from background
try {
  chrome.runtime.onMessage.addListener((msg: { type: string }) => {
    if (msg.type === 'STOP_BOT') {
      stopFlag = true
      log('Stop signal received — finishing current job and halting.')
    }
  })
} catch { /* context already invalid at inject time */ }

// ─── Entry point ────────────────────────────────────────────────────────────
;(async () => {
  // Bail immediately if extension context is gone (e.g. reloaded)
  if (!isCtxValid()) return

  // Wait briefly for background to set context (handles race condition on page load)
  let stored: Record<string, unknown> = {}
  try {
    stored = await chrome.storage.session.get('applyon_bot_context')
    if (!stored.applyon_bot_context) {
      await sleep(800)
      if (!isCtxValid()) return
      stored = await chrome.storage.session.get('applyon_bot_context')
    }
  } catch {
    return // storage not accessible — context invalid
  }

  ctx = stored.applyon_bot_context as BotContext | null
  // Silently exit if this is not a bot-initiated navigation
  if (!ctx) return

  const search = (ctx.config.search ?? {}) as Record<string, unknown>
  const settings = (ctx.config.settings ?? {}) as Record<string, unknown>
  const maxApply = Number(settings.max_jobs_per_run ?? 10)

  log(`Bot started — looking for Easy Apply jobs (max ${maxApply})`)
  log(`Search: "${search.keywords}" in "${search.location}"`)

  // Wait for LinkedIn to finish loading
  await waitFor(() => !!document.querySelector('.jobs-search-results-list, .scaffold-layout__list'), 8000)
  await sleep(1500)

  await runApplyLoop(maxApply)

  log(`Bot finished — applied to ${appliedCount} jobs`)
  if (isCtxValid()) {
    try { chrome.runtime.sendMessage({ type: 'BOT_FINISHED', success: true }) } catch { /* context gone */ }
  }
})()

// ─── Main loop ────────────────────────────────────────────────────────────────
async function runApplyLoop(maxApply: number) {
  let page = 0
  while (appliedCount < maxApply && !stopFlag) {
    const jobs = collectJobCards()
    if (jobs.length === 0) { log('No job cards found on this page'); break }

    log(`Page ${page + 1}: found ${jobs.length} job cards`)

    for (const card of jobs) {
      if (stopFlag || appliedCount >= maxApply) break
      await processJobCard(card)
      await sleep(800 + Math.random() * 600)
    }

    // Try to go to next page
    const moved = await goToNextPage()
    if (!moved) break
    page++
    await sleep(2000)
  }
}

function collectJobCards(): HTMLElement[] {
  const selectors = [
    '.jobs-search-results-list .job-card-container',
    '.jobs-search-results__list-item',
    '.scaffold-layout__list-item',
  ]
  for (const sel of selectors) {
    const els = Array.from(document.querySelectorAll<HTMLElement>(sel))
    if (els.length > 0) return els
  }
  return []
}

async function processJobCard(card: HTMLElement) {
  // Extract job info from card
  const titleEl = card.querySelector<HTMLElement>('.job-card-list__title, .job-card-container__link')
  const companyEl = card.querySelector<HTMLElement>('.job-card-container__company-name, .artdeco-entity-lockup__subtitle')
  const title = titleEl?.innerText?.trim() ?? 'Unknown Role'
  const company = companyEl?.innerText?.trim() ?? 'Unknown Company'

  // Click the card to open job detail
  titleEl?.click()
  await sleep(1200)

  // Check if Easy Apply button exists
  const applyBtn = await findEasyApplyButton()
  if (!applyBtn) {
    log(`Skipped: ${title} @ ${company} (no Easy Apply)`)
    return
  }

  log(`Applying: ${title} @ ${company}`)
  applyBtn.click()
  await sleep(1500)

  const success = await handleApplicationModal(title, company)
  if (success) {
    appliedCount++
    log(`Applied (${appliedCount}): ${title} @ ${company}`)
    await reportJob({ title, company, url: window.location.href, status: 'applied' })
  } else {
    log(`Error applying to: ${title} @ ${company}`)
  }

  // Close modal if still open
  closeModal()
  await sleep(600)
}

async function findEasyApplyButton(): Promise<HTMLElement | null> {
  const selectors = [
    'button[aria-label*="Easy Apply"]',
    '.jobs-apply-button--top-card button',
    '.jobs-s-apply button',
    'button.jobs-apply-button',
  ]
  for (let i = 0; i < 3; i++) {
    for (const sel of selectors) {
      const btn = document.querySelector<HTMLElement>(sel)
      if (btn && btn.offsetParent !== null) return btn
    }
    await sleep(500)
  }
  return null
}

// ─── Application modal handler ───────────────────────────────────────────────
async function handleApplicationModal(title: string, company: string): Promise<boolean> {
  const modalSel = '.jobs-easy-apply-modal, .artdeco-modal'
  const modal = await waitFor(() => document.querySelector<HTMLElement>(modalSel), 5000)
  if (!modal) { log('Modal did not open'); return false }

  const maxSteps = 10
  let step = 0

  while (step < maxSteps && !stopFlag) {
    await sleep(800)

    // Fill all visible form fields
    await fillFormFields(modal)
    await sleep(500)

    // Find action button: Submit > Review > Next > Continue
    const submitted = await clickNextOrSubmit(modal)
    if (submitted === 'submitted') return true
    if (submitted === 'error') return false
    step++
  }

  return false
}

type StepResult = 'next' | 'submitted' | 'error'

async function clickNextOrSubmit(modal: HTMLElement): Promise<StepResult> {
  const submitSel = 'button[aria-label="Submit application"]'
  const reviewSel = 'button[aria-label="Review your application"]'
  const nextSel = [
    'button[aria-label="Continue to next step"]',
    'button[aria-label="Next"]',
    'button[data-easy-apply-next-button]',
  ]

  const submitBtn = modal.querySelector<HTMLButtonElement>(submitSel)
  if (submitBtn && !submitBtn.disabled) {
    submitBtn.click()
    await sleep(1500)
    // Check for confirmation
    const confirmed = await waitFor(
      () => document.querySelector('.artdeco-modal__confirm-dialog-btn, [data-test-modal-close-btn]'),
      3000,
    )
    if (confirmed) (confirmed as HTMLElement).click()
    return 'submitted'
  }

  const reviewBtn = modal.querySelector<HTMLButtonElement>(reviewSel)
  if (reviewBtn && !reviewBtn.disabled) {
    reviewBtn.click()
    return 'next'
  }

  for (const sel of nextSel) {
    const btn = modal.querySelector<HTMLButtonElement>(sel)
    if (btn && !btn.disabled) {
      btn.click()
      return 'next'
    }
  }

  // Check if there's an error message
  const errorEl = modal.querySelector('.artdeco-inline-feedback--error, [data-test-form-element-error-message]')
  if (errorEl) {
    log(`Form error: ${errorEl.textContent?.trim()}`)
    return 'error'
  }

  return 'error'
}

// ─── Form filling ────────────────────────────────────────────────────────────
async function fillFormFields(modal: HTMLElement) {
  if (!ctx) return
  const personals = (ctx.config.personals ?? {}) as Record<string, unknown>
  const questions = (ctx.config.questions ?? []) as Array<Record<string, string>>

  // Fill text inputs
  const textInputs = modal.querySelectorAll<HTMLInputElement>(
    'input[type="text"]:not([disabled]), input[type="number"]:not([disabled])',
  )
  for (const input of textInputs) {
    if (input.value.trim()) continue // already filled
    const label = getLabelFor(input, modal)
    const answer = resolveAnswer(label, personals, questions, input.type)
    if (answer) setInputValue(input, answer)
  }

  // Fill textareas (cover letter, additional info)
  const textareas = modal.querySelectorAll<HTMLTextAreaElement>('textarea:not([disabled])')
  for (const ta of textareas) {
    if (ta.value.trim()) continue
    const label = getLabelFor(ta, modal)
    const answer = resolveAnswer(label, personals, questions, 'textarea')
    if (answer) setInputValue(ta, answer)
  }

  // Fill selects
  const selects = modal.querySelectorAll<HTMLSelectElement>('select:not([disabled])')
  for (const sel of selects) {
    if (sel.value && sel.value !== '' && sel.selectedIndex > 0) continue
    const label = getLabelFor(sel, modal)
    const answer = resolveAnswer(label, personals, questions, 'select')
    if (answer) {
      selectOption(sel, answer)
    } else if (sel.options.length > 1) {
      sel.selectedIndex = 1 // pick first non-empty option
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }

  // Handle radio groups (Yes/No questions)
  const radioGroups = getRadioGroups(modal)
  for (const [name, radios] of Object.entries(radioGroups)) {
    if (radios.some((r) => r.checked)) continue
    const label = getFieldsetLabel(radios[0], modal)
    const answer = resolveAnswer(label, personals, questions, 'radio')
    const target = answer
      ? radios.find((r) => r.value.toLowerCase().includes(answer.toLowerCase())) ?? radios[0]
      : pickDefaultRadio(radios, label)
    if (target) {
      target.click()
      target.dispatchEvent(new Event('change', { bubbles: true }))
    }
    void name
  }
}

function resolveAnswer(
  label: string,
  personals: Record<string, unknown>,
  questions: Array<Record<string, string>>,
  fieldType: string,
): string {
  const lbl = label.toLowerCase()

  // Check pre-configured Q&A
  for (const qa of questions) {
    const q = (qa.question ?? '').toLowerCase()
    if (q && lbl.includes(q.slice(0, 20))) return qa.answer ?? ''
  }

  // Smart defaults from personals
  if (lbl.includes('phone') || lbl.includes('mobile')) return String(personals.phone ?? '')
  if (lbl.includes('city') || lbl.includes('location')) return String(personals.city ?? '')
  if (lbl.includes('linkedin')) return String(personals.linkedin_url ?? '')
  if (lbl.includes('website') || lbl.includes('portfolio')) return String(personals.website ?? '')
  if (lbl.includes('first name') || lbl.includes('first_name')) return String(personals.first_name ?? '')
  if (lbl.includes('last name') || lbl.includes('last_name')) return String(personals.last_name ?? '')
  if (lbl.includes('name') && !lbl.includes('company')) {
    const fn = String(personals.first_name ?? '')
    const ln = String(personals.last_name ?? '')
    return fn && ln ? `${fn} ${ln}` : fn || ln
  }
  if (lbl.includes('email')) return String(personals.email ?? '')
  if (lbl.includes('years') || lbl.includes('experience')) return '3' // default experience
  if (lbl.includes('salary') || lbl.includes('expected')) return String(personals.expected_salary ?? '80000')
  if (lbl.includes('notice') || lbl.includes('availability')) return '2 weeks'

  // Radio defaults
  if (fieldType === 'radio') {
    if (lbl.includes('authorized') || lbl.includes('eligible') || lbl.includes('citizen')) return 'yes'
    if (lbl.includes('require sponsor') || lbl.includes('visa')) return 'no'
    return 'yes' // safe default
  }

  if (fieldType === 'textarea') {
    if (lbl.includes('cover') || lbl.includes('why')) return 'I am excited about this opportunity and believe my skills are a strong match for this role.'
    return ''
  }

  return ''
}

// ─── DOM helpers ─────────────────────────────────────────────────────────────
function getLabelFor(el: HTMLElement, container: HTMLElement): string {
  // Try aria-label
  if (el.getAttribute('aria-label')) return el.getAttribute('aria-label')!

  // Try id → label
  if (el.id) {
    const lbl = container.querySelector<HTMLLabelElement>(`label[for="${el.id}"]`)
    if (lbl) return lbl.innerText.trim()
  }

  // Walk up to find label sibling or legend
  let node: HTMLElement | null = el.parentElement
  while (node && node !== container) {
    const lbl = node.querySelector<HTMLElement>('label, legend, .artdeco-text-input--label, [data-test-text-input-label]')
    if (lbl && !lbl.contains(el)) return lbl.innerText.trim()
    node = node.parentElement
  }

  return el.getAttribute('placeholder') ?? el.getAttribute('name') ?? ''
}

function getFieldsetLabel(radio: HTMLInputElement, container: HTMLElement): string {
  let node: HTMLElement | null = radio.parentElement
  while (node && node !== container) {
    const legend = node.querySelector<HTMLElement>('legend, .fb-dash-form-element__label')
    if (legend) return legend.innerText.trim()
    if (node.tagName === 'FIELDSET') {
      const leg = node.querySelector('legend')
      if (leg) return leg.innerText.trim()
    }
    node = node.parentElement
  }
  return radio.name
}

function getRadioGroups(modal: HTMLElement): Record<string, HTMLInputElement[]> {
  const radios = modal.querySelectorAll<HTMLInputElement>('input[type="radio"]')
  const groups: Record<string, HTMLInputElement[]> = {}
  for (const r of radios) {
    const name = r.name || r.getAttribute('data-test-radio-input') || String(Math.random())
    if (!groups[name]) groups[name] = []
    groups[name].push(r)
  }
  return groups
}

function pickDefaultRadio(radios: HTMLInputElement[], label: string): HTMLInputElement {
  const lbl = label.toLowerCase()
  // Prefer "yes" for authorization questions
  if (lbl.includes('authorized') || lbl.includes('eligible') || lbl.includes('require') === false) {
    return radios.find((r) => r.value.toLowerCase() === 'yes') ?? radios[0]
  }
  return radios[0]
}

function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value',
  )?.set
  nativeInputValueSetter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function selectOption(sel: HTMLSelectElement, value: string) {
  const lv = value.toLowerCase()
  const opt = Array.from(sel.options).find(
    (o) => o.value.toLowerCase().includes(lv) || o.text.toLowerCase().includes(lv),
  )
  if (opt) {
    sel.value = opt.value
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  }
}

function closeModal() {
  const closeBtn = document.querySelector<HTMLElement>(
    '[aria-label="Dismiss"], [aria-label="Close"], .artdeco-modal__dismiss',
  )
  closeBtn?.click()
}

// ─── Pagination ──────────────────────────────────────────────────────────────
async function goToNextPage(): Promise<boolean> {
  const nextBtn = document.querySelector<HTMLElement>(
    '[aria-label="Page 2"], [aria-label="Next"], .artdeco-pagination__button--next',
  )
  if (!nextBtn || nextBtn.hasAttribute('disabled')) return false
  nextBtn.click()
  await sleep(2500)
  return true
}

// ─── Report job to backend ────────────────────────────────────────────────────
async function reportJob(job: JobRecord) {
  if (!ctx) return
  try {
    await fetch(`${ctx.backendUrl}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.token}`,
      },
      body: JSON.stringify({
        title: job.title,
        company: job.company,
        url: job.url,
        status: job.status,
        provider: 'linkedin',
        pipeline_status: 'applied',
      }),
    })
  } catch {
    // Non-fatal — job tracking failure shouldn't stop the bot
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function log(line: string) {
  const ts = new Date().toISOString().slice(11, 19)
  const msg = `[${ts}] ${line}`
  console.log('[ApplyOn Bot]', msg)
  if (!isCtxValid()) return
  try { chrome.runtime.sendMessage({ type: 'BOT_LOG', line: msg }) } catch { /* context gone */ }
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms))
}

function waitFor<T>(
  check: () => T | null | undefined | false,
  timeout = 5000,
  interval = 250,
): Promise<T | null> {
  return new Promise((resolve) => {
    const start = Date.now()
    const id = setInterval(() => {
      const result = check()
      if (result) { clearInterval(id); resolve(result as T) }
      else if (Date.now() - start > timeout) { clearInterval(id); resolve(null) }
    }, interval)
  })
}
