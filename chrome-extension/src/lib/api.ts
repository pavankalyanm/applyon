import type { Run, RunType } from './types'

export class ApiClient {
  constructor(private backendUrl: string, private token: string) {}

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
    }
  }

  async getRuns(limit = 5): Promise<Run[]> {
    const res = await fetch(`${this.backendUrl}/runs?limit=${limit}`, {
      headers: this.headers(),
    })
    if (!res.ok) throw new Error(`Failed to fetch runs: ${res.status}`)
    return res.json()
  }

  async getActiveRun(): Promise<Run | null> {
    const runs = await this.getRuns(10)
    return (
      runs.find((r) => r.status === 'running' || r.status === 'pending') ?? null
    )
  }

  async startRun(type: RunType): Promise<Run> {
    const url =
      type === 'outreach'
        ? `${this.backendUrl}/runs/outreach`
        : `${this.backendUrl}/runs`
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({}),
    })
    if (!res.ok) throw new Error(`Failed to start run: ${res.status}`)
    return res.json()
  }

  async stopRun(runId: number): Promise<void> {
    const res = await fetch(`${this.backendUrl}/runs/${runId}/stop`, {
      method: 'POST',
      headers: this.headers(),
    })
    if (!res.ok) throw new Error(`Failed to stop run: ${res.status}`)
  }

  sseUrl(): string {
    return `${this.backendUrl}/runs/stream?token=${this.token}`
  }
}
