import { useEffect, useState } from 'react'
import { AppLink, useLocation } from './navigation'
import { MembersView, MemberDetailView } from './MemberViews'
import { PostsView, PostDetailView, postSections } from './PostViews'
import type { PostSection } from './PostViews'
import { number, date, isUuid, eventName, Status, Loading, ErrorState, Empty, Pager } from './ui'
import { ApiRequestError, api, clearSmsChallenge, logout, pendingSmsChallenge, requestSms, resumeSession, verifySms } from './api'
import type { Audit, Dashboard, Page, Report, UserActivity } from './api'

const percent = (value: number | null | undefined) => value == null ? '—' : `${value.toFixed(1)}%`
const queryString = (filters: Record<string, string>, page: number) => {
  const params = new URLSearchParams({ page: String(page) })
  Object.entries(filters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()) })
  return params.toString()
}
const icon = (name: string) => <span className="nav-icon" aria-hidden="true">{name}</span>

function Login({ onLogin }: { onLogin: () => void }) {
  const [phone, setPhone] = useState(() => pendingSmsChallenge()?.phoneNumber ?? '')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState(() => pendingSmsChallenge()?.challengeId ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      if (!challenge) {
        const requested = await requestSms(phone.replace(/[\s-]/g, ''))
        setChallenge(requested.challengeId)
      } else {
        await verifySms(challenge, code)
        clearSmsChallenge()
        setChallenge('')
        await api('/dashboard?days=7')
        onLogin()
      }
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.status === 429
          && cause.message === '인증문자는 30초 후 다시 요청할 수 있습니다.') {
        const previous = pendingSmsChallenge(phone.replace(/[\s-]/g, ''))
        if (previous) setChallenge(previous.challengeId)
      }
      if (challenge && cause instanceof ApiRequestError
          && (cause.status === 404 || cause.message === '만료되었거나 사용할 수 없는 인증 요청입니다.')) {
        clearSmsChallenge()
        setChallenge('')
      }
      setError(cause instanceof Error ? cause.message : '요청을 처리하지 못했습니다.')
    } finally { setBusy(false) }
  }
  return <main className="login-page">
    <div className="login-art"><img src="/hankkt-logo.png" alt="한끗" /><div><span>HANKKT ADMIN</span><h1>한끗의 오늘을<br />한눈에 살펴보세요.</h1><p>우리 동네 스타일링 서비스 운영 콘솔</p></div><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /></div>
    <div className="login-content"><form className="login-card" onSubmit={submit}>
      <span className="eyebrow">운영자 전용</span><h2>관리자 로그인</h2><p>등록된 관리자 계정으로 전화번호 인증을 진행해 주세요.</p>
      <label htmlFor="phone">휴대전화 번호</label><input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" value={phone} onChange={e => setPhone(e.target.value)} disabled={!!challenge || busy} required />
      {challenge && <><label htmlFor="code">인증번호</label><input id="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4}" maxLength={4} placeholder="4자리 인증번호" value={code} onChange={e => setCode(e.target.value)} required /></>}
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="primary-button" disabled={busy}>{busy ? '처리 중…' : challenge ? '로그인' : '인증문자 받기'} <span aria-hidden="true">→</span></button>
      {challenge && <button className="text-button" type="button" onClick={() => { setChallenge(''); setCode('') }}>번호 다시 입력</button>}
      <small>관리자 권한은 서버에 등록된 계정에만 부여됩니다.</small>
    </form></div>
  </main>
}

function Metric({ label, value, hint, accent = false }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return <div className={`metric-card ${accent ? 'accent' : ''}`}><span className="metric-label">{label}</span><strong>{value}</strong><small>{hint}</small></div>
}

function DashboardView({ days, onDays }: { days: number; onDays: (days: number) => void }) {
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { let live = true; setData(null); setError(''); api<Dashboard>(`/dashboard?days=${days}`).then(value => { if (live) setData(value) }).catch(cause => { if (live) setError(String(cause)) }); return () => { live = false } }, [days])
  return <>
    <div className="page-head"><div><span className="eyebrow">OVERVIEW</span><h1>운영 대시보드</h1><p>한끗 서비스의 주요 이용 현황을 확인합니다.</p></div><div className="segmented" aria-label="집계 기간">{[7, 30, 90].map(value => <button key={value} className={days === value ? 'selected' : ''} onClick={() => onDays(value)}>{value}일</button>)}</div></div>
    {error && <ErrorState message={error} />}
    {!data && !error && <Loading />}
    {data && <>
      <div className="period-note">{data.from} – {data.to} · 한국시간 기준 <span>마지막 갱신: {date(new Date().toISOString())}</span></div>
      <div className="metrics-grid lead-grid">
        <Metric label="전체 회원" value={number(data.totalMembers)} hint={`현재 활성 ${number(data.activeMembers)}명`} accent />
        <Metric label="신규 가입" value={number(data.newMembers)} hint={`최근 ${days}일`} />
        <Metric label="매칭 신청" value={number(data.matchingApplications)} hint={`${number(data.matchingSuccesses)}건 성사`} />
        <Metric label="매칭 성사율" value={percent(data.matchingSuccessRate)} hint="신청 생성일 기준" />
      </div>
      <div className="content-grid">
        <section className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">ACTIVITY</span><h2>활성 사용자</h2></div><span className="soft-badge">실제 이용 기준</span></div>
          <div className="activity-figures"><div><span>DAU</span><strong>{number(data.dau)}</strong><small>오늘</small></div><div><span>WAU</span><strong>{number(data.wau)}</strong><small>최근 7일</small></div><div><span>MAU</span><strong>{number(data.mau)}</strong><small>최근 30일</small></div></div>
          <div className="info-line">활동일 기록 시작: {data.activityTrackingSince || '아직 기록 없음'}<br />기록 시작 전 기간은 소급 추정하지 않습니다.</div>
        </section>
        <section className="panel progress-panel"><div className="panel-heading"><div><span className="eyebrow">MATCHING</span><h2>거래 진행 현황</h2></div></div>
          <div className="progress-row"><div><span>거래 완료율</span><strong>{percent(data.completionRate)}</strong></div><div className="progress-bar"><span style={{ width: `${Math.min(data.completionRate || 0, 100)}%` }} /></div><small>기간 내 개설한 매칭방 {number(data.matchingRooms)}건 중 {number(data.completedRooms)}건 완료</small></div>
          <div className="mini-stat-row"><div><span>약속 취소율</span><b>{percent(data.cancellationRate)}</b><small>{number(data.cancelledAppointments)} / {number(data.appointments)}건</small></div><div><span>재이용률</span><b>{percent(data.returningRate)}</b><small>완료 거래 참여자 전체 기간</small></div></div>
        </section>
      </div>
      <div className="content-grid lower-grid">
        <section className="panel"><div className="panel-heading"><div><span className="eyebrow">CATEGORIES</span><h2>서비스별 이용 비중</h2></div><span className="panel-sub">완료 거래 기준</span></div>
          {data.categoryShares.length ? <div className="category-list">{data.categoryShares.map(row => { const total = data.categoryShares.reduce((sum, item) => sum + item.count, 0); return <div key={row.category}><div><span>{row.category}</span><b>{total ? Math.round(row.count / total * 100) : 0}%</b></div><div className="category-track"><span style={{ width: `${total ? row.count / total * 100 : 0}%` }} /></div></div> })}</div> : <Empty label="완료 거래가 아직 없습니다." />}
        </section>
        <section className="panel"><div className="panel-heading"><div><span className="eyebrow">SAFETY & REVIEWS</span><h2>신고와 후기</h2></div></div>
          <div className="safety-grid"><div><span>기간 내 신고</span><strong>{number(data.reports)}<small>건</small></strong></div><div><span>미처리 신고</span><strong>{number(data.pendingReports)}<small>건</small></strong></div><div><span>평균 평점</span><strong>{data.averageRating == null ? '—' : data.averageRating.toFixed(1)}<small> / 5</small></strong></div><div><span>리뷰</span><strong>{number(data.reviews)}<small>건</small></strong></div></div>
        </section>
      </div>
      <section className="unavailable"><div><span className="eyebrow">NEXT PHASE</span><h2>현재 집계할 수 없는 지표</h2><p>원천 데이터와 운영 정책이 준비되면 연결됩니다.</p></div><div className="unavailable-tags"><span>노쇼율</span><span>실거래 평균 금액</span><span>문의 처리 시간</span><span>분쟁·신고 발생률</span></div></section>
    </>}
  </>
}

function ReportsView() {
  const empty = { query: '', reporterId: '', status: '', targetType: '', from: '', to: '' }
  const [draft, setDraft] = useState(empty)
  const [filters, setFilters] = useState(empty)
  const [page, setPage] = useState(0)
  const [data, setData] = useState<Page<Report> | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    setData(null); setError('')
    api<Page<Report>>(`/reports?${queryString(filters, page)}`)
      .then(value => { if (live) setData(value) })
      .catch(cause => { if (live) setError(String(cause)) })
    return () => { live = false }
  }, [filters, page])
  function search(event: React.FormEvent) {
    event.preventDefault()
    if (draft.from && draft.to && draft.from > draft.to) { setError('접수 시작일이 종료일보다 늦습니다.'); return }
    if (draft.reporterId.trim() && !isUuid(draft.reporterId)) { setError('신고자 UUID 형식을 확인해 주세요.'); return }
    setPage(0); setFilters({ ...draft })
  }
  return <><div className="page-head"><div><span className="eyebrow">SAFETY</span><h1>신고 현황</h1><p>신고 접수 메타데이터를 확인합니다. 조사·조치는 후속 단계입니다.</p></div></div>
    <section className="panel table-panel">
      <form className="table-tools" onSubmit={search}>
        <label className="search-input"><span aria-hidden="true">⌕</span><input value={draft.query} onChange={event => setDraft({ ...draft, query: event.target.value })} placeholder="신고자 · 사유 · 신고/대상 UUID" maxLength={80} /></label>
        <input className="id-filter" aria-label="신고자 UUID" placeholder="신고자 UUID" value={draft.reporterId} onChange={event => setDraft({ ...draft, reporterId: event.target.value })} />
        <select aria-label="신고 상태" value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}><option value="">전체 상태</option><option value="RECEIVED">접수</option><option value="IN_REVIEW">검토 중</option><option value="RESOLVED">처리 완료</option><option value="REJECTED">반려</option></select>
        <select aria-label="신고 대상 유형" value={draft.targetType} onChange={event => setDraft({ ...draft, targetType: event.target.value })}><option value="">전체 대상</option><option value="POST">게시글</option><option value="PROFILE">프로필</option><option value="CHAT">채팅</option></select>
        <label className="date-filter">접수 시작일<input type="date" value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} /></label>
        <label className="date-filter">접수 종료일<input type="date" value={draft.to} onChange={event => setDraft({ ...draft, to: event.target.value })} /></label>
        <button className="outline-button">검색</button><button type="button" className="reset-button" onClick={() => { setDraft(empty); setFilters({ ...empty }); setPage(0) }}>초기화</button>
      </form>
      {error && <ErrorState message={error} />}{!data && !error && <Loading />}
      {data && <><div className="table-count">총 <strong>{number(data.total)}</strong>건</div><div className="table-wrap"><table><thead><tr><th>접수 시각</th><th>신고자</th><th>대상 유형</th><th>사유</th><th>상태</th><th>신고 ID</th></tr></thead><tbody>{data.items.map(report => <tr key={report.id}><td>{date(report.createdAt)}</td><td><b>{report.reporterName}</b><small>@{report.reporterUsername} · {report.reporterId.slice(0, 8)}…</small></td><td>{report.targetType}</td><td>{report.reason}</td><td><Status value={report.status} label={report.status === 'RECEIVED' ? '접수' : report.status} /></td><td><code title={report.id}>{report.id.slice(0, 8)}…</code></td></tr>)}</tbody></table></div>{!data.items.length && <Empty label="조건에 맞는 신고가 없습니다." />}<Pager page={page} total={data.total} size={data.size} onPage={setPage} /></>}
    </section>
  </>
}

function AuditView() {
  const empty = { query: '', userId: '', from: '', to: '' }
  const [scope, setScope] = useState<'ADMIN' | 'USER'>('ADMIN')
  const [draft, setDraft] = useState(empty)
  const [filters, setFilters] = useState(empty)
  const [page, setPage] = useState(0)
  const [data, setData] = useState<{ scope: 'ADMIN' | 'USER'; result: Page<Audit | UserActivity> } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    setData(null); setError('')
    const { userId, ...common } = filters
    const params = queryString({ ...common, [scope === 'ADMIN' ? 'actorId' : 'memberId']: userId }, page)
    const path = scope === 'ADMIN' ? 'audit-events' : 'activity-events'
    api<Page<Audit | UserActivity>>(`/${path}?${params}`)
      .then(value => { if (live) setData({ scope, result: value }) })
      .catch(cause => { if (live) setError(String(cause)) })
    return () => { live = false }
  }, [scope, filters, page])
  function search(event: React.FormEvent) {
    event.preventDefault()
    if (draft.from && draft.to && draft.from > draft.to) { setError('조회 시작일이 종료일보다 늦습니다.'); return }
    if (draft.userId.trim() && !isUuid(draft.userId)) { setError('회원 UUID 형식을 확인해 주세요.'); return }
    setPage(0); setFilters({ ...draft })
  }
  const visibleData = data?.scope === scope ? data.result : null
  return <><div className="page-head"><div><span className="eyebrow">ACTIVITY LOG</span><h1>활동 로그</h1><p>운영자 감사 기록과 일반 회원의 주요 활동을 구분해 조회합니다.</p></div></div>
    <section className="panel table-panel">
      <div className="log-tabs" role="group" aria-label="로그 유형"><button className={scope === 'ADMIN' ? 'selected' : ''} onClick={() => { setScope('ADMIN'); setPage(0) }}>관리자 로그</button><button className={scope === 'USER' ? 'selected' : ''} onClick={() => { setScope('USER'); setPage(0) }}>일반 사용자 로그</button></div>
      <form className="table-tools" onSubmit={search}>
        <label className="search-input"><span aria-hidden="true">⌕</span><input value={draft.query} onChange={event => setDraft({ ...draft, query: event.target.value })} placeholder="이름 · 아이디 · 행동 · 대상 UUID" maxLength={80} /></label>
        <input className="id-filter" aria-label="행위자 UUID" placeholder={scope === 'ADMIN' ? '운영자 UUID' : '회원 UUID'} value={draft.userId} onChange={event => setDraft({ ...draft, userId: event.target.value })} />
        <label className="date-filter">시작일<input type="date" value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} /></label>
        <label className="date-filter">종료일<input type="date" value={draft.to} onChange={event => setDraft({ ...draft, to: event.target.value })} /></label>
        <button className="outline-button">검색</button><button type="button" className="reset-button" onClick={() => { setDraft(empty); setFilters({ ...empty }); setPage(0) }}>초기화</button>
      </form>
      {error && <ErrorState message={error} />}{!visibleData && !error && <Loading />}
      {visibleData && <><div className="table-count">총 <strong>{number(visibleData.total)}</strong>건 · {scope === 'ADMIN' ? '관리자 감사 기록' : '일반 회원 주요 활동'}</div>
        <div className="table-wrap"><table><thead><tr><th>발생 시각</th><th>행동</th><th>{scope === 'ADMIN' ? '운영자' : '회원'}</th><th>대상</th></tr></thead><tbody>{scope === 'ADMIN'
          ? visibleData.items.map(item => { const row = item as Audit; return <tr key={row.id}><td>{date(row.occurredAt)}</td><td>{eventName[row.action] || row.action}</td><td><b>{row.actorName}</b><small>@{row.actorUsername} · {row.actorId.slice(0, 8)}…</small></td><td><code title={row.targetId}>{row.targetType} / {row.targetId.slice(0, 8)}…</code></td></tr> })
          : visibleData.items.map(item => { const row = item as UserActivity; return <tr key={row.id}><td>{date(row.occurredAt)}</td><td>{eventName[row.eventType] || row.eventType}</td><td><b>{row.memberName}</b><small>@{row.memberUsername} · {row.memberId.slice(0, 8)}…</small></td><td><code title={row.resourceId || ''}>{row.resourceType || '—'}{row.resourceId ? ` / ${row.resourceId.slice(0, 8)}…` : ''}</code></td></tr> })}</tbody></table></div>
        {!visibleData.items.length && <Empty label="조건에 맞는 로그가 없습니다." />}<Pager page={page} total={visibleData.total} size={visibleData.size} onPage={setPage} /></>}
    </section>
  </>
}

export default function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const route = useLocation()
  const parts = route.pathname.split('/').filter(Boolean)
  const postSection = parts[0] === 'posts' && Object.hasOwn(postSections, parts[1] || '') ? parts[1] as PostSection : null
  const section = postSection || (parts[0] || 'dashboard')
  const detail = (parts[0] === 'members' && parts.length === 2) || (!!postSection && parts.length === 3)
  useEffect(() => {
    document.title = `${postSection ? postSections[postSection].label : ({ members: '회원 관리', reports: '신고 현황', audit: '활동 로그' } as Record<string, string>)[section] || '운영 대시보드'}${detail ? ' 상세' : ''} · 한끗 관리자`
    const heading = document.querySelector<HTMLElement>('main h1')
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }) }
  }, [route.pathname, section, detail, postSection])
  const [days, setDays] = useState(30)
  const [menu, setMenu] = useState(false)
  useEffect(() => {
    let live = true
    resumeSession().then(value => { if (live) setSignedIn(value) })
    return () => { live = false }
  }, [])
  useEffect(() => {
    const expired = () => setSignedIn(false)
    window.addEventListener('hankkt-admin-session-expired', expired)
    return () => window.removeEventListener('hankkt-admin-session-expired', expired)
  }, [])
  async function signOut() { await logout(); setSignedIn(false) }
  if (signedIn === null) return <div className="loading-screen" role="status"><img src="/hankkt-logo.png" alt="한끗" /><p>운영자 세션을 확인하고 있습니다…</p></div>
  if (!signedIn) return <Login onLogin={() => setSignedIn(true)} />
  const nav = [
    { id: 'dashboard', href: '/', label: '대시보드', symbol: '▦' }, { id: 'members', href: '/members', label: '회원 관리', symbol: '♙' },
    { id: 'services', href: '/posts/services', label: '금손 공고', symbol: '✦' }, { id: 'requests', href: '/posts/requests', label: '꾸알못 요청', symbol: '◇' },
    { id: 'feeds', href: '/posts/feeds', label: '피드', symbol: '▤' },
    { id: 'reports', href: '/reports', label: '신고 현황', symbol: '⚑' }, { id: 'audit', href: '/audit', label: '활동 로그', symbol: '≡' },
  ]
  let content
  if ((route.pathname === '/' || route.pathname === '/dashboard')) content = <DashboardView days={days} onDays={setDays} />
  else if (section === 'members' && parts.length === 1) content = <MembersView search={route.search} />
  else if (section === 'members' && detail) content = <MemberDetailView id={parts[1]} search={route.search} />
  else if (postSection && parts.length === 2) content = <PostsView section={postSection} search={route.search} />
  else if (postSection && detail) content = <PostDetailView section={postSection} id={parts[2]} search={route.search} />
  else if (route.pathname === '/reports') content = <ReportsView />
  else if (route.pathname === '/audit') content = <AuditView />
  else content = <><div className="page-head"><h1>페이지를 찾을 수 없습니다.</h1></div><AppLink className="outline-button" href="/">대시보드로</AppLink></>
  return <div className="app-shell"><aside className={`sidebar ${menu ? 'open' : ''}`}><div className="brand"><img src="/hankkt-logo.png" alt="한끗" /><span>운영 콘솔</span></div><div className="nav-heading">WORKSPACE</div><nav aria-label="관리자 메뉴">{nav.map(item => <AppLink key={item.id} href={item.href} aria-current={section === item.id ? 'page' : undefined} className={section === item.id ? 'active' : ''} onClick={() => setMenu(false)}>{icon(item.symbol)}{item.label}</AppLink>)}</nav><div className="sidebar-bottom"><span className="online-dot" /> 운영 시스템 <small>읽기 전용</small></div></aside>
    <div className="workspace"><header className="topbar"><button className="menu-toggle" aria-label="메뉴 열기" aria-expanded={menu} onClick={() => setMenu(!menu)}>☰</button><div className="topbar-title">한끗 <span>/</span> {nav.find(item => item.id === section)?.label || '운영 콘솔'}{detail && <><span>/</span>상세</>}</div><div className="topbar-right"><span className="today">{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeZone: 'Asia/Seoul' }).format(new Date())}</span><span className="avatar">운</span><button className="logout-button" onClick={signOut}>로그아웃</button></div></header><main key={route.pathname} className="main-content">{content}</main><footer>© {new Date().getFullYear()} hankkt · 운영자 전용</footer></div>{menu && <button className="mobile-backdrop" aria-label="메뉴 닫기" onClick={() => setMenu(false)} />}</div>
}
