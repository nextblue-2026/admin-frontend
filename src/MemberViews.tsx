import { useEffect, useState } from 'react'
import { api } from './api'
import type { Member, MemberDetail, Page } from './api'
import { AppLink, detailPath, filterValues, listPath, navigate, pageNumber, returnPath } from './navigation'
import { date, Empty, ErrorState, eventName, InfoRow, isUuid, Loading, memberStatus, number, Pager, Status } from './ui'

const empty = { query: '', status: '', from: '', to: '' }
export function MembersView({ search }: { search: string }) {
  const filters = filterValues(empty, search)
  const [draft, setDraft] = useState(filters)
  const page = pageNumber(search)
  const [data, setData] = useState<Page<Member> | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { setDraft(filterValues(empty, search)) }, [search])
  useEffect(() => {
    let live = true
    setData(null); setError('')
    api<Page<Member>>(`/members${listPath('', filterValues(empty, search), pageNumber(search))}`)
      .then(value => { if (live) setData(value) }).catch(cause => { if (live) setError(String(cause)) })
    return () => { live = false }
  }, [search])
  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (draft.from && draft.to && draft.from > draft.to) { setError('가입 시작일이 종료일보다 늦습니다.'); return }
    setError('')
    navigate(listPath('/members', draft))
  }
  return <>
    <div className="page-head"><div><span className="eyebrow">MEMBERS</span><h1>회원 관리</h1><p>회원 상태와 최근 주요 활동을 조회합니다.</p></div></div>
    <section className="panel table-panel"><form className="table-tools" onSubmit={submit}>
      <label className="search-input"><span aria-hidden="true">⌕</span><input aria-label="회원 검색" value={draft.query} onChange={e => setDraft({ ...draft, query: e.target.value })} placeholder="이름 · 아이디 · 회원 UUID" maxLength={80} /></label>
      <select aria-label="회원 상태" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}><option value="">전체 상태</option><option value="ACTIVE">활성</option><option value="WITHDRAWAL_PENDING">탈퇴 대기</option><option value="WITHDRAWN">탈퇴 완료</option></select>
      <label className="date-filter">가입 시작일<input type="date" value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value })} /></label>
      <label className="date-filter">가입 종료일<input type="date" value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })} /></label>
      <button className="outline-button">검색</button><button type="button" className="reset-button" onClick={() => { setDraft(empty); setError(''); navigate('/members') }}>초기화</button>
    </form>
    {error && <ErrorState message={error} />}{!data && !error && <Loading />}
    {data && <><div className="table-count">총 <strong>{number(data.total)}</strong>명</div><div className="table-wrap"><table><thead><tr><th>회원</th><th>상태</th><th>동네 코드</th><th>가입일</th><th>상세</th></tr></thead><tbody>{data.items.map(member => <tr key={member.id}>
      <td><AppLink className="member-name-link" href={detailPath('/members', member.id, search)}><b>{member.name}</b></AppLink><small>@{member.username}</small></td>
      <td><Status value={member.status} label={memberStatus[member.status] || member.status} /></td><td>{member.neighborhoodCode || '—'}</td><td>{date(member.createdAt)}</td><td><AppLink className="row-link" href={detailPath('/members', member.id, search)} aria-label={`${member.name} 회원 상세`}>상세 보기 →</AppLink></td>
    </tr>)}</tbody></table></div>{!data.items.length && <Empty label="조건에 맞는 회원이 없습니다." />}<Pager page={page} total={data.total} size={data.size} onPage={value => navigate(listPath('/members', filters, value))} /></>}
    </section>
  </>
}

export function MemberDetailView({ id, search }: { id: string; search: string }) {
  const [data, setData] = useState<MemberDetail | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    if (!isUuid(id)) { setError('회원 ID 형식이 올바르지 않습니다.'); return }
    api<MemberDetail>(`/members/${id}`).then(value => { if (live) setData(value) }).catch(cause => { if (live) setError(String(cause)) })
    return () => { live = false }
  }, [id])
  return <>
    <AppLink className="back-link" href={returnPath(search, '/members')}>← 회원 목록으로</AppLink>
    <div className="page-head"><div><span className="eyebrow">MEMBER DETAIL</span><h1>회원 상세</h1><p>{data ? `${data.member.name} · @${data.member.username}` : '회원 정보와 활동 기록을 확인합니다.'}</p></div>{data && <Status value={data.member.status} label={memberStatus[data.member.status] || data.member.status} />}</div>
    {error && <ErrorState message={error} />}{!data && !error && <Loading />}
    {data && <>
      <div className="detail-grid">
        <section className="panel detail-panel"><h2>기본 정보</h2><dl>
          <InfoRow label="이름">{data.member.name}</InfoRow><InfoRow label="아이디">@{data.member.username}</InfoRow>
          <InfoRow label="회원 ID"><code>{data.member.id}</code></InfoRow><InfoRow label="가입일">{date(data.member.createdAt)}</InfoRow>
        </dl></section>
        <section className="panel detail-panel"><h2>이용 정보</h2><dl>
          <InfoRow label="계정 상태"><Status value={data.member.status} label={memberStatus[data.member.status] || data.member.status} /></InfoRow>
          <InfoRow label="선택 동네 코드">{data.member.neighborhoodCode || '미설정'}</InfoRow>
          <InfoRow label="작성한 콘텐츠"><div className="inline-links"><AppLink href={`/posts/services?authorId=${id}`}>금손 공고 →</AppLink><AppLink href={`/posts/requests?authorId=${id}`}>꾸알못 요청 →</AppLink><AppLink href={`/posts/feeds?authorId=${id}`}>피드 →</AppLink></div></InfoRow>
        </dl></section>
      </div>
      <section className="panel table-panel detail-activity"><div className="section-heading"><h2>최근 주요 활동</h2><span>최근 최대 30건</span></div>
        {data.recentActivity.length ? <div className="table-wrap"><table><thead><tr><th>발생 시각</th><th>행동</th><th>대상 유형</th><th>대상 ID</th></tr></thead><tbody>{data.recentActivity.map(event => <tr key={event.id}><td>{date(event.occurredAt)}</td><td>{eventName[event.eventType] || event.eventType}</td><td>{event.resourceType || '—'}</td><td><code>{event.resourceId || '—'}</code></td></tr>)}</tbody></table></div> : <Empty label="기록된 주요 활동이 없습니다." />}
      </section>
    </>}
  </>
}
