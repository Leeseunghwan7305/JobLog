import type { CompanyProfileDto } from '@joblog/types';
import type { Metadata } from 'next';
import Link from 'next/link';

// 공개 SEO 페이지. 봇 트래픽은 ISR 캐시가 받고, API는 revalidate 때만 호출.
export const revalidate = 86400; // 1일

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

async function fetchProfile(name: string): Promise<CompanyProfileDto | null> {
  try {
    const res = await fetch(
      `${API_BASE}/companies/public?name=${encodeURIComponent(name)}`,
      { next: { revalidate } },
    );
    if (!res.ok) return null;
    return (await res.json()) as CompanyProfileDto;
  } catch {
    return null;
  }
}

/** 추정연봉(만원) → "약 N,NNN만원". */
function wonLabel(manwon: number | null): string | null {
  if (!manwon) return null;
  return `약 ${manwon.toLocaleString()}만원`;
}
function tenureLabel(months: number | null): string | null {
  if (!months) return null;
  return `${(months / 12).toFixed(1)}년`;
}
function ageLabel(joinedYear: number | null): string | null {
  if (!joinedYear) return null;
  // 국민연금 가입연도 기준 업력(근사).
  return `${new Date().getFullYear() - joinedYear}년+`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const company = decodeURIComponent(name);
  const p = await fetchProfile(company);
  const nps = p?.nps ?? null;
  const facts = nps
    ? [
        nps.memberCount ? `직원 ${nps.memberCount.toLocaleString()}명` : null,
        wonLabel(nps.estimatedAnnualSalaryManwon),
        nps.industry,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  const title = `${company} 직원수·추정연봉·전형 정보 | JobLog`;
  const description = facts
    ? `${company} — ${facts}. 국민연금 공개데이터 기반. JobLog에서 이 회사 지원 전형(서류·면접·최종)을 추적하세요.`
    : `${company}의 직원수·추정연봉·업종 정보와 지원 전형 추적. JobLog.`;
  return {
    title,
    description,
    // 지표가 있는 페이지만 색인(얇은 콘텐츠 색인 방지).
    robots: nps
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

function Metric({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const company = decodeURIComponent(name);
  const profile = await fetchProfile(company);
  const nps = profile?.nps ?? null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← JobLog
      </Link>

      <header className="mt-6">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          회사 정보
        </span>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
          {company}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          국민연금 공개데이터 기반 추정치 · 참고용
        </p>
      </header>

      {nps ? (
        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric
            label="직원 수"
            value={nps.memberCount ? `${nps.memberCount.toLocaleString()}명` : null}
          />
          <Metric label="추정 연봉" value={wonLabel(nps.estimatedAnnualSalaryManwon)} />
          <Metric
            label="회전율(월)"
            value={nps.turnoverRatePct != null ? `${nps.turnoverRatePct}%` : null}
          />
          <Metric label="추정 평균근속" value={tenureLabel(nps.estTenureMonths)} />
          <Metric label="업력" value={ageLabel(nps.npsJoinedYear)} />
          <Metric label="업종" value={nps.industry} />
          <Metric label="지역" value={nps.region} />
          <Metric
            label="이번 달 입사"
            value={nps.newThisMonth != null ? `${nps.newThisMonth}명` : null}
          />
          <Metric
            label="이번 달 퇴사"
            value={nps.lostThisMonth != null ? `${nps.lostThisMonth}명` : null}
          />
        </section>
      ) : (
        <p className="mt-8 rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          아직 이 회사의 공개 지표를 찾지 못했어요. 회사명을 정확히 입력하면
          국민연금 데이터에서 찾을 수 있어요.
        </p>
      )}

      {/* 전환 CTA */}
      <section className="mt-10 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-indigo-400/5 p-7 text-center">
        <h2 className="text-xl font-extrabold tracking-tight">
          {company}에 지원했나요?
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          공고 링크만 붙여넣으면 전형(서류·면접·최종)을 자동 정리하고, 어디까지
          왔는지 한곳에서 추적해요.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          무료로 전형 추적 시작하기
        </Link>
      </section>

      {profile?.links && profile.links.length > 0 && (
        <section className="mt-8">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            더 알아보기
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {profile.links.map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground"
              >
                {l.label} ↗
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
