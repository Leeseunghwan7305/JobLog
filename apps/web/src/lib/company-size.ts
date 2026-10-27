// 회사규모(국민연금 가입자수≈직원수) 로컬 캐시.
// 상세에서 회사 정보를 조회하면 기억해 두고, 대시보드 목록 카드에서 뱃지로 보여준다.
// (브라우저별·점진적. 기기 간 공유가 필요하면 Application 에 스냅샷 컬럼으로 옮긴다.)

const KEY = 'joblog_company_sizes';
type Sizes = Record<string, number>;

const normalize = (name: string): string => name.trim().toLowerCase();

function read(): Sizes {
  if (typeof window === 'undefined') return {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Sizes) : {};
  } catch {
    return {};
  }
}

export function rememberCompanySize(name: string, size: number): void {
  if (typeof window === 'undefined' || !name || size <= 0) return;
  const sizes = read();
  const key = normalize(name);
  if (sizes[key] === size) return;
  sizes[key] = size;
  try {
    localStorage.setItem(KEY, JSON.stringify(sizes));
  } catch {
    // 저장 실패(용량 등)는 무시 — 뱃지는 부가 기능.
  }
}

export function getCompanySize(name: string): number | null {
  return read()[normalize(name)] ?? null;
}
