import { useSyncExternalStore } from 'react'
import type { AnchorHTMLAttributes } from 'react'

const subscribe = (listener: () => void) => {
  window.addEventListener('popstate', listener)
  return () => window.removeEventListener('popstate', listener)
}
const snapshot = () => window.location.pathname + window.location.search
export function useLocation() {
  const current = useSyncExternalStore(subscribe, snapshot)
  const split = current.indexOf('?')
  return { pathname: split < 0 ? current : current.slice(0, split), search: split < 0 ? '' : current.slice(split) }
}
export function navigate(to: string) {
  if (to === snapshot()) return
  window.history.pushState(null, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0 })
}
export function AppLink({ href = '/', onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} href={href} onClick={event => {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target === '_blank') return
    if (new URL(href, window.location.origin).origin !== window.location.origin) return
    event.preventDefault()
    navigate(href)
  }} />
}
export function returnPath(search: string, base: string) {
  const value = new URLSearchParams(search).get('returnTo') || base
  return value === base || value.startsWith(`${base}?`) ? value : base
}
export function detailPath(base: string, id: string, search: string) {
  return `${base}/${id}?returnTo=${encodeURIComponent(base + search)}`
}
export function pageNumber(search: string) {
  const value = Number(new URLSearchParams(search).get('page') || 0)
  return Number.isInteger(value) && value >= 0 && value <= 10000 ? value : 0
}
export function filterValues<T extends Record<string, string>>(defaults: T, search: string): T {
  const params = new URLSearchParams(search)
  return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, params.get(key) ?? value])) as T
}
export function listPath(base: string, filters: Record<string, string>, page = 0) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()) })
  if (page) params.set('page', String(page))
  return base + (params.size ? `?${params}` : '')
}
