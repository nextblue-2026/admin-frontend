import { useEffect, useState } from 'react'
import { api, apiImage } from './api'
import type { Page, Post, PostDetail, PostType } from './api'
import { AppLink, detailPath, filterValues, listPath, navigate, pageNumber, returnPath } from './navigation'
import { date, Empty, ErrorState, InfoRow, isUuid, Loading, memberStatus, number, Pager, Status } from './ui'

export const postSections = {
  services: { type: 'SERVICE' as PostType, label: '금손 공고', eyebrow: 'SERVICE OFFERS' },
  requests: { type: 'REQUEST' as PostType, label: '꾸알못 요청', eyebrow: 'HELP REQUESTS' },
  feeds: { type: 'FEED' as PostType, label: '피드', eyebrow: 'COMMUNITY FEED' },
}
export type PostSection = keyof typeof postSections
const categories: Record<string, string> = { MAKEUP: '메이크업', STYLE: '스타일링', HAIR: '헤어', NAIL: '네일', OTHERS: '기타' }
const statuses: Record<string, string> = { RECRUITING: '모집 중', PUBLISHED: '게시 중', CLOSED: '마감', HIDDEN: '숨김', DELETED: '삭제' }
const purposes: Record<string, string> = { DAILY: '일상', DATE: '데이트', BLIND_DATE: '소개팅', INTERVIEW: '면접', SPECIAL_DAY: '특별한 날', PROFILE_PHOTO: '프로필 촬영', SCHOOL: '학교', OTHER: '기타' }
const feedTypes: Record<string, string> = { INFORMATION: '정보', REVIEW: '후기', QUESTION: '질문' }
const empty = { query: '', status: '', category: '', authorId: '', from: '', to: '' }
function amount(post: Post) {
  if (post.postType === 'FEED') return '—'
  const value = post.postType === 'REQUEST' ? post.budgetAmount : post.priceAmount
  return value == null ? '금액 협의' : `${number(value)}원${post.negotiable ? ' · 협의 가능' : ''}`
}

export function PostsView({ section, search }: { section: PostSection; search: string }) {
  const config = postSections[section]
  const base = `/posts/${section}`
  const filters = filterValues(empty, search)
  const page = pageNumber(search)
  const [draft, setDraft] = useState(filters)
  const [data, setData] = useState<Page<Post> | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { setDraft(filterValues(empty, search)) }, [search])
  useEffect(() => {
    let live = true
    setData(null); setError('')
    const active = filterValues(empty, search)
    if (active.authorId && !isUuid(active.authorId)) { setError('작성자 UUID 형식을 확인해 주세요.'); return }
    api<Page<Post>>(`/posts${listPath('', { type: config.type, ...active }, pageNumber(search))}`)
      .then(value => { if (live) setData(value) }).catch(cause => { if (live) setError(String(cause)) })
    return () => { live = false }
  }, [search, config.type])
  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (draft.from && draft.to && draft.from > draft.to) { setError('등록 시작일이 종료일보다 늦습니다.'); return }
    if (draft.authorId.trim() && !isUuid(draft.authorId)) { setError('작성자 UUID 형식을 확인해 주세요.'); return }
    setError('')
    navigate(listPath(base, draft))
  }
  return <>
    <div className="page-head"><div><span className="eyebrow">{config.eyebrow}</span><h1>{config.label}</h1><p>등록된 {config.label}의 내용과 게시 상태를 확인합니다.</p></div><span className="soft-badge">전체 게시 상태 조회</span></div>
    <section className="panel table-panel"><form className="table-tools" onSubmit={submit}>
      <label className="search-input"><span aria-hidden="true">⌕</span><input aria-label="게시물 검색" value={draft.query} onChange={e => setDraft({ ...draft, query: e.target.value })} placeholder="제목 · 작성자 이름/아이디 · 게시물 UUID" maxLength={80} /></label>
      <select aria-label="게시 상태" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}><option value="">전체 상태</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select aria-label="카테고리" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}><option value="">전체 카테고리</option>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <input className="id-filter" aria-label="작성자 UUID" placeholder="작성자 UUID" value={draft.authorId} onChange={e => setDraft({ ...draft, authorId: e.target.value })} />
      <label className="date-filter">등록 시작일<input type="date" value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value })} /></label>
      <label className="date-filter">등록 종료일<input type="date" value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })} /></label>
      <button className="outline-button">검색</button><button type="button" className="reset-button" onClick={() => { setDraft(empty); setError(''); navigate(base) }}>초기화</button>
    </form>
    {error && <ErrorState message={error} />}{!data && !error && <Loading />}
    {data && <><div className="table-count">총 <strong>{number(data.total)}</strong>건</div><div className="table-wrap"><table><thead><tr><th>게시물</th><th>작성자</th><th>상태</th><th>카테고리</th>{section !== 'feeds' && <th>{section === 'requests' ? '희망 예산' : '금액'}</th>}<th>등록일</th><th>상세</th></tr></thead><tbody>{data.items.map(post => <tr key={post.id}>
      <td className="post-title-cell"><AppLink href={detailPath(base, post.id, search)} className="post-title-link">{post.title}</AppLink><small>{post.neighborhoodName || post.neighborhoodCode || '동네 미설정'} · 이미지 {post.imageCount}장</small></td>
      <td><AppLink className="member-name-link" href={`/members/${post.authorId}`}><b>{post.authorName}</b></AppLink><small>@{post.authorUsername}</small></td>
      <td><Status value={post.status} label={statuses[post.status] || post.status} /></td><td>{categories[post.category] || post.category}</td>{section !== 'feeds' && <td>{amount(post)}</td>}<td>{date(post.createdAt)}</td><td><AppLink className="row-link" href={detailPath(base, post.id, search)} aria-label={`${post.title} 상세`}>상세 보기 →</AppLink></td>
    </tr>)}</tbody></table></div>{!data.items.length && <Empty label="조건에 맞는 게시물이 없습니다." />}<Pager page={page} total={data.total} size={data.size} onPage={value => navigate(listPath(base, filters, value))} /></>}
    </section>
  </>
}

function ProtectedImage({ postId, objectKey, order }: { postId: string; objectKey: string; order: number }) {
  const [src, setSrc] = useState('')
  const [error, setError] = useState(false)
  useEffect(() => {
    let live = true
    let url = ''
    apiImage(`/posts/${postId}/images?key=${encodeURIComponent(objectKey)}`).then(blob => {
      if (!live) return
      url = URL.createObjectURL(blob)
      setSrc(url)
    }).catch(() => { if (live) setError(true) })
    return () => { live = false; if (url) URL.revokeObjectURL(url) }
  }, [postId, objectKey])
  return <figure className="post-image">{src ? <a href={src} target="_blank" rel="noreferrer"><img src={src} alt={`게시물 이미지 ${order + 1}`} /></a> : <div className="image-placeholder">{error ? '이미지를 불러올 수 없습니다.' : '이미지 불러오는 중…'}</div>}<figcaption>이미지 {order + 1}{src && ' · 클릭해서 크게 보기'}</figcaption></figure>
}
function tags(value?: string) {
  if (!value) return '—'
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').join(', ') || '—' : value } catch { return value.split('\n').filter(Boolean).join(', ') }
}

export function PostDetailView({ section, id, search }: { section: PostSection; id: string; search: string }) {
  const [data, setData] = useState<PostDetail | null>(null)
  const [error, setError] = useState('')
  const config = postSections[section]
  const base = `/posts/${section}`
  useEffect(() => {
    let live = true
    if (!isUuid(id)) { setError('게시물 ID 형식이 올바르지 않습니다.'); return }
    api<PostDetail>(`/posts/${id}`).then(value => {
      if (!live) return
      if (value.post.postType !== config.type) { setError('현재 메뉴에 해당하는 게시물이 아닙니다.'); return }
      setData(value)
    }).catch(cause => { if (live) setError(String(cause)) })
    return () => { live = false }
  }, [id, config.type])
  const post = data?.post
  return <>
    <AppLink className="back-link" href={returnPath(search, base)}>← {config.label} 목록으로</AppLink>
    <div className="page-head"><div><span className="eyebrow">CONTENT DETAIL</span><h1>{config.label} 상세</h1><p>{post?.title || '게시물 내용과 등록 정보를 확인합니다.'}</p></div>{post && <Status value={post.status} label={statuses[post.status] || post.status} />}</div>
    {error && <ErrorState message={error} />}{!data && !error && <Loading />}
    {data && post && <>
      <div className="detail-grid">
        <section className="panel detail-panel"><h2>게시물 정보</h2><dl>
          <InfoRow label="제목">{post.title}</InfoRow><InfoRow label="게시물 ID"><code>{post.id}</code></InfoRow>
          <InfoRow label="작성자"><AppLink className="row-link" href={`/members/${post.authorId}`}>{post.authorName} · @{post.authorUsername} →</AppLink></InfoRow>
          <InfoRow label="작성자 상태"><Status value={post.authorStatus} label={memberStatus[post.authorStatus] || post.authorStatus} /></InfoRow>
          <InfoRow label="카테고리">{categories[post.category] || post.category}</InfoRow>
          <InfoRow label={section === 'feeds' ? '피드 유형' : '이용 목적'}>{section === 'feeds' ? feedTypes[post.feedType || ''] || post.feedType || '—' : purposes[post.purpose || ''] || post.purpose || '—'}</InfoRow>
          <InfoRow label="동네">{post.neighborhoodName || post.neighborhoodCode || '미설정'}</InfoRow>
        </dl></section>
        <section className="panel detail-panel"><h2>게시 현황</h2><dl>
          <InfoRow label="상태"><Status value={post.status} label={statuses[post.status] || post.status} /></InfoRow>
          <InfoRow label="등록일">{date(post.createdAt)}</InfoRow><InfoRow label="수정일">{date(post.updatedAt)}</InfoRow>{post.deletedAt && <InfoRow label="삭제일">{date(post.deletedAt)}</InfoRow>}
          {section !== 'feeds' && <InfoRow label={section === 'requests' ? '희망 예산' : '금액'}>{amount(post)}</InfoRow>}
          {section === 'requests' && <InfoRow label="희망 일시">{date(post.desiredAt)} · {data.content.desiredTimezone || 'Asia/Seoul'}</InfoRow>}
          <InfoRow label={section === 'feeds' ? '스크랩' : '찜'}>{number(post.saveCount)}건</InfoRow><InfoRow label="첨부 이미지">{post.imageCount}장</InfoRow>
        </dl></section>
      </div>
      <section className="panel detail-panel content-section"><h2>게시물 내용</h2><div className="post-body">{data.content.description || '작성된 내용이 없습니다.'}</div>
        {data.images.length > 0 && <div className="post-images">{data.images.map((image, index) => <ProtectedImage key={image.objectKey} postId={id} objectKey={image.objectKey} order={index} />)}</div>}
      </section>
      {section === 'services' && <section className="panel detail-panel content-section"><h2>서비스 추가 정보</h2><dl>
        <InfoRow label="콘셉트">{data.content.concept || '—'}</InfoRow><InfoRow label="소요 시간">{data.content.durationMinutes == null ? '—' : `${data.content.durationMinutes}분`}</InfoRow>
        <InfoRow label="추천 대상">{data.content.recommendedFor || '—'}</InfoRow><InfoRow label="준비물">{({ BRING_OWN: '직접 준비', PROVIDED: '제공', DISCUSS: '협의' } as Record<string, string>)[data.content.preparationType || ''] || data.content.preparationType || '—'}</InfoRow>
        <InfoRow label="본인 제품 사용">{data.content.useOwnProducts == null ? '—' : data.content.useOwnProducts ? '사용' : '사용 안 함'}</InfoRow>
      </dl></section>}
      {section === 'feeds' && <section className="panel detail-panel content-section"><h2>태그와 사용 제품</h2><dl><InfoRow label="해시태그">{tags(data.content.hashtags)}</InfoRow><InfoRow label="제품명">{tags(data.content.productNames)}</InfoRow></dl></section>}
      {data.plans.length > 0 && <section className="panel table-panel content-section"><div className="section-heading"><h2>서비스 구성</h2><span>{data.plans.length}개</span></div><div className="table-wrap"><table><thead><tr><th>순서</th><th>내용</th><th>금액</th></tr></thead><tbody>{data.plans.map(plan => <tr key={plan.sequence}><td>{plan.sequence}</td><td className="plan-content">{plan.content}</td><td>{plan.priceAmount == null ? '금액 협의' : `${number(plan.priceAmount)}원`}{plan.negotiable && ' · 협의 가능'}</td></tr>)}</tbody></table></div></section>}
    </>}
  </>
}
