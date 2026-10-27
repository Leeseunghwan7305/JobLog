// web ↔ api 가 주고받는 공유 타입. (api는 생산자로서 자체 DTO도 가짐)

export type StageStatus = 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'FAILED';
export type AppStatus = 'IN_PROGRESS' | 'OFFER' | 'REJECTED' | 'CLOSED';

export interface UserDto {
  id: string;
  nickname: string;
  email: string | null;
  profileImage: string | null;
}

export interface StageDto {
  id: string;
  name: string;
  order: number;
  status: StageStatus;
  scheduledAt: string | null;
  completedAt: string | null;
}

export interface ApplicationDto {
  id: string;
  companyName: string;
  position: string;
  jobUrl: string | null;
  location: string | null;
  employmentType: string | null;
  deadline: string | null;
  appliedAt: string | null;
  memo: string | null;
  status: AppStatus;
  stages: StageDto[];
  createdAt: string;
  updatedAt: string;
}

/** 공고 파싱 결과(초안). Claude가 이 스키마로만 출력하도록 강제. */
export interface ParsedPosting {
  companyName: string;
  position: string;
  location?: string | null;
  employmentType?: string | null;
  deadline?: string | null; // ISO date
  stages: { name: string; order: number }[];
  confidence: 'high' | 'low';
}

export interface ParseResponse {
  draft: ParsedPosting;
  /** 링크 수집 실패 등으로 본문 붙여넣기가 필요한 경우 true */
  needsManualInput: boolean;
  /** 사용자에게 보여줄 안내 메시지 (폴백/저신뢰 상황) */
  notice?: string;
}

export interface CompanyReviewDto {
  companyName: string; // 정규화된 키
  rating: number | null;
  summary: string | null;
  sourceUrl: string; // 잡플래닛 딥링크 (항상 존재)
}

export interface CompanySearchResult {
  seq: string;
  name: string;
  region: string | null;
  industry: string | null;
}

export interface NpsMonthly {
  ym: string; // YYYYMM
  memberCount: number;
  joined: number | null;
  left: number | null;
  estimatedAnnualSalaryManwon: number | null;
}

export interface NpsMetrics {
  memberCount: number;
  estimatedAnnualSalaryManwon: number | null;
  newThisMonth: number | null;
  lostThisMonth: number | null;
  industry: string | null;
  region: string | null;
  dataYm: string | null; // 자료생성연월 (YYYYMM)
  turnoverRatePct: number | null; // (입+퇴)/직원수*100, 최신월
  npsJoinedYear: number | null; // 국민연금 가입 연도 (업력 proxy)
  estTenureMonths: number | null; // 추정 평균 근속(개월) — 회전율 기반 추정
  trend: NpsMonthly[]; // 최근 N개월 (ym 오름차순)
}

export interface CompanyProfileLink {
  label: string;
  url: string;
}

export interface CompanyProfileDto {
  companyName: string; // 정규화된 표시명
  seq: string | null; // 선택된 국민연금 사업장 seq (검색→선택 결과)
  nps: NpsMetrics | null; // 매칭 모호/키없음/실패 시 null
  review: {
    rating: number | null;
    summary: string | null;
    sourceUrl: string;
  } | null;
  links: CompanyProfileLink[];
}

export interface DashboardStats {
  total: number;
  inProgress: number;
  offer: number;
  rejected: number;
}

/** 개발자에게 문의하기 — 폼이 보내는 입력. */
export interface SupportRequest {
  message: string;
  /** 답장받을 이메일(선택). 비로그인·로그인 공통. */
  email?: string;
  /** 문의가 발생한 페이지 경로(선택, 맥락 파악용). */
  path?: string;
}

export interface SupportResponse {
  ok: true;
}

export type CalendarEventType = 'deadline' | 'stage';

export interface CalendarEvent {
  date: string; // ISO datetime
  type: CalendarEventType;
  applicationId: string;
  companyName: string;
  label: string; // deadline: "서류 마감" / stage: 전형명
  status: StageStatus | null; // type === "stage" 일 때만 값
}
