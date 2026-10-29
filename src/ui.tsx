export const number = (value: number) => new Intl.NumberFormat('ko-KR').format(value)
export const date = (value?: string | null) => value ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(value)) : '—'
export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
export const memberStatus: Record<string, string> = { ACTIVE: '활성', WITHDRAWAL_PENDING: '탈퇴 대기', WITHDRAWN: '탈퇴 완료' }
export const eventName: Record<string, string> = {
  MEMBER_REGISTERED: '회원가입', LOGIN_SUCCEEDED: '로그인', WITHDRAWAL_REQUESTED: '탈퇴 요청',
  WITHDRAWAL_CANCELLED: '탈퇴 취소', MATCH_REQUESTED: '매칭 신청', MATCH_ACCEPTED: '매칭 수락',
  APPOINTMENT_CREATED: '약속 생성', APPOINTMENT_CANCELLED: '약속 취소',
  TRANSACTION_COMPLETED: '거래 완료', REVIEW_CREATED: '리뷰 등록', REPORT_CREATED: '신고 접수',
  MEMBER_DETAIL_VIEWED: '회원 상세 조회', POST_DETAIL_VIEWED: '게시물 상세 조회', REPORT_LIST_VIEWED: '신고 목록 조회',
}
export function Status({ value, label }: { value: string; label: string }) { return <span className={`status status-${value.toLowerCase()}`}>{label}</span> }
export function Loading() { return <div className="loading" role="status">데이터를 불러오는 중입니다…</div> }
export function ErrorState({ message }: { message: string }) { return <div className="error-state" role="alert">{message}</div> }
export function Empty({ label }: { label: string }) { return <div className="empty-state">{label}</div> }
export function Pager({ page, total, size, onPage }: { page: number; total: number; size: number; onPage: (page: number) => void }) {
  return <div className="pager"><span>{number(total)}건 · {page + 1} / {Math.max(1, Math.ceil(total / size))} 페이지</span><div><button disabled={page === 0} onClick={() => onPage(page - 1)}>이전</button><button disabled={(page + 1) * size >= total} onClick={() => onPage(page + 1)}>다음</button></div></div>
}
export function InfoRow({ label, children }: { label: string; children?: React.ReactNode }) {
  return <div className="info-row"><dt>{label}</dt><dd>{children ?? '—'}</dd></div>
}
