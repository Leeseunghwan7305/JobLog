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
  employeeCount: number | null;
  fitResult: FitResult | null;
  fitAt: string | null;
  memo: string | null;
  tags: string[];
  /** 보관(아카이브) 시점. null=활성. */
  archivedAt: string | null;
  status: AppStatus;
  stages: StageDto[];
  createdAt: string;
  updatedAt: string;
}

/** 공고 파싱 결과(초안). Claude가 이 스키마로만 출력하도록 강제. */
/** 이력서 ↔ 공고 핏 분석 결과 (LLM 산출, 서버에서 정규화·캐시). */
export interface FitResult {
  techFit: {
    score: number; // 0~100
    matched: string[]; // 이력서에서 확인되는 충족 역량
    missing: string[]; // 공고가 요구하나 이력서에 안 보이는 것
    note: string;
  };
  cultureFit: {
    score: number; // 0~100
    rationale: string;
    basis: string; // 판단 근거의 출처/한계
  };
  recommendations: string[];
  summary: string;
}

export interface ParsedPosting {
  companyName: string;
  position: string;
  location?: string | null;
  employmentType?: string | null;
  deadline?: string | null; // ISO date
  stages: { name: string; order: number }[];
  confidence: 'high' | 'low';
}

export interface ResumeStatus {
  hasResume: boolean;
  resumeFilename: string | null;
  resumeUpdatedAt: string | null; // ISO
}

export interface ParseResponse {
  draft: ParsedPosting;
  /** 공고 원문 텍스트(핏 분석 입력용). 수집/붙여넣기 본문. */
  rawText?: string;
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

/** 전형 단계명 하나에 대한 통과율 집계. */
export interface StageInsight {
  /** 단계 이름 (trim된 자유 문자열, 예: "서류", "1차 면접"). */
  name: string;
  /** 이 이름의 단계가 전체 지원에서 등장한 횟수. */
  total: number;
  passed: number;
  failed: number;
  /** 아직 결정되지 않은 단계 수 (PENDING + IN_PROGRESS). */
  undecided: number;
  /** passed / (passed + failed). 결정된 단계가 없으면 null. */
  passRate: number | null;
}

/** 합격률·전형별 통과율 인사이트. GET /dashboard/insights */
export interface DashboardInsights {
  total: number;
  offer: number;
  rejected: number;
  inProgress: number;
  /** 사용자가 철회(CLOSED)한 지원 수. 합격률 계산에서는 제외. */
  closed: number;
  /** 결론이 난 지원 수 (offer + rejected). */
  decided: number;
  /** offer / decided. 결론 난 지원이 없으면 null. */
  offerRate: number | null;
  /** 등장 횟수 내림차순, 동률이면 이름 오름차순. */
  stages: StageInsight[];
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
