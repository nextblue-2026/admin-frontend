export type Dashboard = {
  days: number; from: string; to: string; totalMembers: number; activeMembers: number; newMembers: number;
  dau: number; wau: number; mau: number; activityTrackingSince?: string | null;
  matchingApplications: number; matchingSuccesses: number; matchingSuccessRate?: number | null;
  appointments: number; cancelledAppointments: number; cancellationRate?: number | null;
  matchingRooms: number; completedRooms: number; completionRate?: number | null;
  returningBaseMembers: number; returningMembers: number; returningRate?: number | null;
  reports: number; pendingReports: number; reviews: number; averageRating?: number | null;
  categoryShares: { category: string; count: number }[];
}
export type Page<T> = { items: T[]; total: number; page: number; size: number }
export type Member = { id: string; name: string; username: string; status: string; neighborhoodCode: string | null; createdAt: string }
export type Activity = { id: string; eventType: string; resourceType: string | null; resourceId: string | null; occurredAt: string }
export type MemberDetail = { member: Member; recentActivity: Activity[] }
export type Report = { id: string; reporterId: string; reporterName: string; reporterUsername: string; targetType: string; targetId: string; reason: string; status: string; createdAt: string }
export type Audit = { id: string; actorId: string; actorName: string; actorUsername: string; action: string; targetType: string; targetId: string; occurredAt: string }
export type UserActivity = { id: string; memberId: string; memberName: string; memberUsername: string; eventType: string; resourceType?: string; resourceId?: string; occurredAt: string }
type Envelope<T> = { code: string; data: T; message?: string }
type Tokens = { accessToken: string; refreshToken: string; accessTokenExpiresAt: string }
type BrowserToken = { accessToken: string; accessTokenExpiresAt: string }
type SmsChallenge = { challengeId: string; expiresAt: string }
type PendingSmsChallenge = SmsChallenge & { phoneNumber: string }
const LEGACY_KEY = 'hankkt.admin.session'
const SMS_CHALLENGE_KEY = 'hankkt.admin.sms-challenge'
const SESSION_URL = '/api/v1/admin/browser-sessions'
let access: BrowserToken | null = null
let renewal: Promise<boolean> | null = null

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

export function pendingSmsChallenge(phoneNumber?: string): PendingSmsChallenge | null {
  try {
    const saved = sessionStorage.getItem(SMS_CHALLENGE_KEY)
    if (!saved) return null
    const pending = JSON.parse(saved) as PendingSmsChallenge
    if (!pending.challengeId || !pending.phoneNumber || !Number.isFinite(Date.parse(pending.expiresAt))
        || Date.parse(pending.expiresAt) <= Date.now()) {
      clearSmsChallenge()
      return null
    }
    return phoneNumber === undefined || pending.phoneNumber === phoneNumber ? pending : null
  } catch {
    clearSmsChallenge()
    return null
  }
}

export function clearSmsChallenge() {
  try { sessionStorage.removeItem(SMS_CHALLENGE_KEY) } catch { /* Storage may be disabled. */ }
}

async function read<T>(response: Response): Promise<T> {
  let body: Envelope<T>
  try {
    body = await response.json() as Envelope<T>
  } catch {
    if (!response.ok) {
      throw new Error(`API 서버 연결에 실패했습니다 (${response.status}). 잠시 후 다시 시도해 주세요.`)
    }
    throw new Error('API 서버 응답 형식이 올바르지 않습니다.')
  }
  if (!response.ok) throw new ApiRequestError(body.message || `요청 실패 (${response.status})`, response.status)
  return body.data
}

async function createBrowserSession(tokens: Tokens) {
  const response = await fetch(SESSION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.accessToken}` },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  })
  access = await read<BrowserToken>(response)
}

async function refresh() {
  if (!renewal) {
    renewal = (async () => {
      try {
        const rotate = async () => {
          const response = await fetch(`${SESSION_URL}/refresh`, {
            method: 'POST', headers: { 'X-Admin-Request': '1' }, cache: 'no-store',
          })
          access = await read<BrowserToken>(response)
          return true
        }
        // The cookie is shared by tabs. Serialize rotation so another tab uses its latest value.
        return 'locks' in navigator
          ? await navigator.locks.request('hankkt-admin-refresh', rotate)
          : await rotate()
      } catch { access = null; return false }
    })()
  }
  try { return await renewal } finally { renewal = null }
}

export async function resumeSession() {
  sessionStorage.removeItem(LEGACY_KEY)
  const resumed = await refresh()
  if (resumed) clearSmsChallenge()
  return resumed
}

export async function api<T>(path: string): Promise<T> {
  const expired = () => {
    access = null
    window.dispatchEvent(new Event('hankkt-admin-session-expired'))
    throw new Error('관리자 인증이 만료됐습니다. 다시 로그인해 주세요.')
  }
  if (!access && !await refresh()) expired()
  const send = () => fetch(`/api/v1/admin${path}`, {
    headers: { Authorization: `Bearer ${access!.accessToken}` }, cache: 'no-store',
  })
  let response = await send()
  if (response.status === 401) {
    if (!await refresh()) expired()
    response = await send()
    if (response.status === 401) expired()
  }
  if (response.status === 403) { await logout(); expired() }
  return read<T>(response)
}

export async function requestSms(phoneNumber: string): Promise<SmsChallenge> {
  const response = await fetch('/api/v1/auth/sms/requests', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumber }),
  })
  const challenge = await read<SmsChallenge>(response)
  try { sessionStorage.setItem(SMS_CHALLENGE_KEY, JSON.stringify({ phoneNumber, ...challenge })) }
  catch { /* The current page can still verify this challenge. */ }
  return challenge
}

export async function verifySms(challengeId: string, code: string) {
  const response = await fetch('/api/v1/auth/sms/verifications', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challengeId, code }),
  })
  const result = await read<{ registered: boolean; tokens: Tokens | null }>(response)
  if (!result.registered || !result.tokens) throw new Error('등록된 관리자 계정이 아닙니다.')
  try { await createBrowserSession(result.tokens) }
  catch (error) {
    await fetch('/api/v1/auth/logout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: result.tokens.refreshToken }),
    }).catch(() => {})
    throw error
  }
}

export async function logout() {
  try {
    await fetch(`${SESSION_URL}/logout`, {
      method: 'POST', headers: { 'X-Admin-Request': '1' }, cache: 'no-store',
    })
  } catch {
    // Local access is discarded even if the server cannot be reached.
  } finally { access = null; sessionStorage.removeItem(LEGACY_KEY) }
}
