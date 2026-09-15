// Every /v1/marketing operation this app calls, named once. Shapes follow
// cloud/apps/marketing: times are unix SECONDS, money is USD CENTS.

import { useCallback, useEffect, useState } from 'react'
import type { HttpClient } from '@hanzo/ai'

export interface Summary {
  campaigns: number
  active: number
  budget: number
  /** Summed from what campaigns report; nothing meters it. */
  spend: number
}

export interface Campaign {
  id: string
  name: string
  channel: string
  status: string
  objective: string
  budget: number
  spend: number
  scheduledAt: number
  createdAt: number
  updatedAt: number
}

export interface Sequence {
  id: string
  name: string
  status: string
  createdAt: number
  updatedAt: number
}

export interface Step {
  id: string
  sequenceId: string
  idx: number
  /** From enrollment for the first step, from the previous step after. */
  delaySeconds: number
  subject: string
  body: string
  createdAt: number
}

export interface Enrollment {
  id: string
  sequenceId: string
  address: string
  channel: string
  /** Index of the next step to send. */
  currentStep: number
  status: string
  nextRunAt: number
  enrolledAt: number
  updatedAt: number
}

export interface EnrollResult {
  resolved: number
  enrolled: number
  alreadyEnrolled: number
  enrollmentId?: string
}

export interface Audience {
  id: string
  name: string
  /** Empty means everyone in the organization. */
  event: string
  windowDays: number
  createdAt: number
  updatedAt: number
}

export interface Preview {
  /** False when nothing could be measured; `reason` says why. */
  available: boolean
  reason?: string
  count: number
  deliverable: number
  unmatched: number
  sample: string[]
  source: string
}

export interface Post {
  id: string
  title: string
  body: string
  channel: string
  scheduledAt: number
  status: string
  publishedAt: number
  error?: string
  createdAt: number
  updatedAt: number
}

export interface Promo {
  code: string
  description: string
  percentOff: number
  maxRedemptions: number
  teamSeatCap: number
  /** Comma-separated plan ids. */
  plans: string
  active: boolean
  createdAt: number
}

export interface PromoStatus {
  promo: Promo
  redeemed: number
  remaining: number
}

export interface Quote {
  code: string
  plan: string
  seats: number
  eligible: boolean
  reason?: string
  listCents: number
  chargeCents: number
  discountCents: number
  remaining: number
}

export interface Redemption {
  code: string
  plan: string
  seats: number
  discountCents: number
  redeemedAt: number
}

export interface Redeemed {
  redemption: Redemption
  chargeCents: number
  discountCents: number
  alreadyRedeemed: boolean
}

export interface Suppression {
  channel: string
  address: string
  reason: string
  createdAt: number
}

export const CHANNELS = ['email', 'sms', 'social', 'meta', 'google', 'tiktok'] as const
export const NETWORKS = ['x', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'threads'] as const
export const CAMPAIGN_STATES = ['draft', 'scheduled', 'active', 'paused', 'completed'] as const
export const SEQUENCE_STATES = ['draft', 'active', 'archived'] as const
export const POST_STATES = ['draft', 'scheduled', 'published', 'failed', 'canceled'] as const

export const usd = (cents: number): string =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

/** The platform's own sentence: problem+json `detail`, else the SDK's message. */
export function why(e: unknown): string {
  const detail = (e as { body?: { detail?: unknown } } | null)?.body?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  return e instanceof Error ? e.message : String(e)
}

const at = (...seg: string[]) => ['/v1/marketing', ...seg.map(encodeURIComponent)].join('/')

// ── reads ────────────────────────────────────────────────────────────────────

export interface Read<T> {
  /** Null until the first answer. */
  it: T | null
  failed: string | null
  again: () => void
}

/** One read; re-runs when the client (the org) or `deps` change. */
function useRead<T>(http: HttpClient | null, get: (h: HttpClient) => Promise<T>, deps: unknown[]): Read<T> {
  const [it, setIt] = useState<T | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [turn, setTurn] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(get, deps)

  useEffect(() => {
    if (!http) return
    let live = true
    setFailed(null)
    run(http)
      .then((got) => live && setIt(got))
      .catch((e: unknown) => live && setFailed(why(e)))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [http, run, turn])

  return { it, failed, again: () => setTurn((t) => t + 1) }
}

const list = <T,>(h: HttpClient, path: string, query: Record<string, string> = {}) =>
  h.collection<T>('data', { path, query })

/** GET /v1/marketing/summary */
export const useSummary = (http: HttpClient | null) =>
  useRead(http, (h) => h.json<Summary>({ path: at('summary') }), [])

/** GET /v1/marketing/campaigns */
export const useCampaigns = (http: HttpClient | null, status: string) =>
  useRead(http, (h) => list<Campaign>(h, at('campaigns'), status ? { status } : {}), [status])

/** GET /v1/marketing/sequences */
export const useSequences = (http: HttpClient | null) =>
  useRead(http, (h) => list<Sequence>(h, at('sequences')), [])

/** GET /v1/marketing/sequences/{id} — the sequence and its steps in send order. */
export const useSequence = (http: HttpClient | null, id: string) =>
  useRead(http, (h) => h.json<{ sequence: Sequence; steps: Step[] }>({ path: at('sequences', id) }), [id])

/** GET /v1/marketing/sequences/{id}/enrollments */
export const useEnrollments = (http: HttpClient | null, id: string) =>
  useRead(http, (h) => list<Enrollment>(h, at('sequences', id, 'enrollments')), [id])

/** GET /v1/marketing/audiences */
export const useAudiences = (http: HttpClient | null) =>
  useRead(http, (h) => list<Audience>(h, at('audiences')), [])

/** GET /v1/marketing/audiences/{id}/preview — measured live. */
export const usePreview = (http: HttpClient | null, id: string) =>
  useRead(http, (h) => h.json<Preview>({ path: at('audiences', id, 'preview') }), [id])

/** GET /v1/marketing/calendar */
export const usePosts = (http: HttpClient | null, status: string) =>
  useRead(http, (h) => list<Post>(h, at('calendar'), status ? { status } : {}), [status])

/** GET /v1/marketing/promos */
export const usePromos = (http: HttpClient | null) =>
  useRead(http, (h) => list<PromoStatus>(h, at('promos')), [])

/** GET /v1/marketing/promos/{code}/redemption — false when this org has none. */
export const useRedemption = (http: HttpClient | null, code: string) =>
  useRead<Redemption | false>(
    http,
    (h) =>
      h.json<Redemption>({ path: at('promos', code, 'redemption') }).catch((e: unknown) => {
        if ((e as { status?: number }).status === 404) return false
        throw e
      }),
    [code],
  )

/** GET /v1/marketing/suppressions */
export const useSuppressions = (http: HttpClient | null) =>
  useRead(http, (h) => list<Suppression>(h, at('suppressions')), [])

// ── writes ───────────────────────────────────────────────────────────────────

const send = <T,>(h: HttpClient, method: string, path: string, body?: unknown, query?: Record<string, string>) =>
  h.json<T>({ method, path, body, query })

/** An operation that answers 204: no body to parse. Refusals still throw. */
const done = (h: HttpClient, method: string, path: string, query?: Record<string, string>) =>
  h.raw({ method, path, query }).then(() => undefined)

export const createCampaign = (h: HttpClient, c: Pick<Campaign, 'name' | 'channel' | 'objective' | 'budget'>) =>
  send<Campaign>(h, 'POST', at('campaigns'), c)

/** PUT is a full write; send the whole campaign. */
export const updateCampaign = (h: HttpClient, c: Campaign) =>
  send<Campaign>(h, 'PUT', at('campaigns', c.id), c)

/** 0 clears the send time. */
export const scheduleCampaign = (h: HttpClient, id: string, scheduledAt: number) =>
  send<Campaign>(h, 'POST', at('campaigns', id, 'schedule'), { scheduledAt })

export const dropCampaign = (h: HttpClient, id: string) => done(h, 'DELETE', at('campaigns', id))

export const createSequence = (h: HttpClient, name: string) =>
  send<Sequence>(h, 'POST', at('sequences'), { name })

export const setSequenceStatus = (h: HttpClient, id: string, status: string) =>
  send<{ id: string; status: string }>(h, 'POST', at('sequences', id, 'status'), { status })

export const addStep = (h: HttpClient, id: string, s: Pick<Step, 'delaySeconds' | 'subject' | 'body'>) =>
  send<Step>(h, 'POST', at('sequences', id, 'steps'), s)

/** Exactly one of address or audienceId. */
export const enroll = (h: HttpClient, id: string, who: { address: string } | { audienceId: string }) =>
  send<EnrollResult>(h, 'POST', at('sequences', id, 'enroll'), who)

export const cancelEnrollment = (h: HttpClient, id: string, eid: string) =>
  done(h, 'POST', at('sequences', id, 'enrollments', eid, 'cancel'))

export const createAudience = (h: HttpClient, a: Pick<Audience, 'name' | 'event' | 'windowDays'>) =>
  send<Audience>(h, 'POST', at('audiences'), a)

export const dropAudience = (h: HttpClient, id: string) => done(h, 'DELETE', at('audiences', id))

export const createPost = (h: HttpClient, p: Pick<Post, 'title' | 'body' | 'channel' | 'scheduledAt'>) =>
  send<Post>(h, 'POST', at('calendar'), p)

export const publishPost = (h: HttpClient, id: string) => send<Post>(h, 'POST', at('calendar', id, 'publish'))

export const dropPost = (h: HttpClient, id: string) => done(h, 'DELETE', at('calendar', id))

/** Pure pricing; nothing is redeemed. */
export const quote = (h: HttpClient, code: string, plan: string, seats: number) =>
  send<Quote>(h, 'GET', at('promos', code, 'eligibility'), undefined, { plan, seats: String(seats) })

export const redeem = (h: HttpClient, code: string, instrument: string) =>
  send<Redeemed>(h, 'POST', at('promos', code, 'redeem'), { instrument })

export const suppress = (h: HttpClient, s: Pick<Suppression, 'channel' | 'address' | 'reason'>) =>
  send<Suppression>(h, 'POST', at('suppressions'), s)

/** DELETE carries no body; the tuple goes in the query. */
export const unsuppress = (h: HttpClient, s: Pick<Suppression, 'channel' | 'address'>) =>
  done(h, 'DELETE', at('suppressions'), { channel: s.channel, address: s.address })
