import type { CompanySearchResult, NpsMetrics } from '@joblog/types';
import { Injectable, Logger } from '@nestjs/common';

import {
  companyMonths,
  computeTrends,
  estimateTenureMonths,
  groupCompanies,
  type NpsMonthSnapshot,
  parseBassItems,
  parseDetail,
  parsePeriod,
  rankCompanies,
} from './nps';

const BASE = 'https://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2';
const TREND_MONTHS = 6;

/** 국민연금 가입사업장 공개데이터 조회. 키 없거나 실패/모호하면 null → 폴백. */
@Injectable()
export class NpsService {
  private readonly logger = new Logger(NpsService.name);

  get enabled(): boolean {
    return !!process.env.NPS_API_KEY;
  }

  private async get(
    path: string,
    params: Record<string, string>,
  ): Promise<unknown> {
    const qs = new URLSearchParams({
      serviceKey: process.env.NPS_API_KEY ?? '',
      dataType: 'json', // 국민연금 API는 dataType=json 이어야 JSON (resultType 무시)
      ...params,
    });
    const url = `${BASE}/${path}?${qs.toString()}`;
    // data.go.kr 게이트웨이가 간헐적으로 504/5xx를 뱉어 → 짧은 백오프로 재시도.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url);
        if (res.status === 429 || res.status >= 500) {
          this.logger.warn(`NPS ${path} ${res.status} (attempt ${attempt}/3)`);
        } else if (!res.ok) {
          this.logger.warn(`NPS ${path} ${res.status}`);
          return null; // 4xx 등 영구 오류는 재시도 무의미
        } else {
          return await res.json();
        }
      } catch (e) {
        this.logger.warn(
          `NPS ${path} 네트워크 실패 (attempt ${attempt}/3): ${String(e)}`,
        );
      }
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 300 * attempt));
      }
    }
    return null;
  }

  /** 사업장명 검색 → bass는 회사×월로 행을 주므로 회사 단위로 묶어 후보 반환. */
  async searchCandidates(name: string): Promise<CompanySearchResult[]> {
    if (!this.enabled || !name) return [];
    try {
      const rows = parseBassItems(await this.bass(name));
      // 본사 우선으로 재정렬 — 완전일치·일반을 앞에, 파견·용역 하청을 뒤로.
      return rankCompanies(groupCompanies(rows), name);
    } catch (e) {
      this.logger.warn(`NPS search 실패 (${name}): ${String(e)}`);
      return [];
    }
  }

  /**
   * 공개 페이지용: 이름으로 '가장 규모 큰' 사업장(=본사 추정)을 골라 지표 반환.
   * 상위 후보들의 최신월 가입자수를 조회해 최대치를 선택 → 동명 소규모 오매칭 방지
   * (예: '삼성전자' 4명짜리 공사업체 대신 본사). 캐시 미스 때만 호출(웹은 ISR).
   */
  async resolveLargest(
    name: string,
  ): Promise<{ seq: string; metrics: NpsMetrics } | null> {
    if (!this.enabled || !name) return null;
    try {
      const candidates = rankCompanies(
        groupCompanies(parseBassItems(await this.bass(name))),
        name,
      );
      let bestSeq: string | null = null;
      let bestCount = -1;
      for (const c of candidates.slice(0, 6)) {
        const d = parseDetail(
          await this.get('getDetailInfoSearchV2', { seq: c.seq }),
        );
        const cnt = d?.memberCount ?? 0;
        if (cnt > bestCount) {
          bestCount = cnt;
          bestSeq = c.seq;
        }
      }
      if (!bestSeq) return null;
      const metrics = await this.fetchProfile(name, bestSeq);
      return metrics ? { seq: bestSeq, metrics } : null;
    } catch (e) {
      this.logger.warn(`NPS resolveLargest 실패 (${name}): ${String(e)}`);
      return null;
    }
  }

  /** seq가 속한 회사의 최근 N개월 상세를 모아 추이 포함 지표 산출. */
  async fetchProfile(name: string, seq: string): Promise<NpsMetrics | null> {
    if (!this.enabled || !seq) return null;
    try {
      const rows = parseBassItems(await this.bass(name));
      let months = companyMonths(rows, seq);
      if (months.length === 0) months = rows.filter((w) => w.seq === seq);
      if (months.length === 0) return null;

      const snapshots: NpsMonthSnapshot[] = [];
      let industry: string | null = null;
      let joinedYear: number | null = null;
      const recent = months.slice(0, TREND_MONTHS);
      for (let i = 0; i < recent.length; i++) {
        const r = recent[i];
        const d = parseDetail(
          await this.get('getDetailInfoSearchV2', { seq: r.seq }),
        );
        if (!d) continue;
        const p = parsePeriod(
          await this.get('getPdAcctoSttusInfoSearchV2', { seq: r.seq }),
        );
        if (i === 0) {
          industry = d.industry; // months[0] = 최신월
          joinedYear = d.joinedYear;
        }
        snapshots.push({
          ym: r.dataYm ?? d.dataYm ?? '',
          memberCount: d.memberCount,
          crrmmNtcAmt: d.crrmmNtcAmt,
          joined: p.joined,
          left: p.left,
        });
      }
      if (snapshots.length === 0) return null;

      const { trend, turnoverRatePct } = computeTrends(snapshots);
      const latest = trend[trend.length - 1];
      const latestRow = months[0];
      return {
        memberCount: latest.memberCount,
        estimatedAnnualSalaryManwon: latest.estimatedAnnualSalaryManwon,
        newThisMonth: latest.joined,
        lostThisMonth: latest.left,
        industry: industry ?? latestRow.industry,
        region: latestRow.address,
        dataYm: latest.ym || null,
        turnoverRatePct,
        npsJoinedYear: joinedYear,
        estTenureMonths: estimateTenureMonths(trend),
        trend,
      };
    } catch (e) {
      this.logger.warn(`NPS fetchProfile 실패 (${seq}): ${String(e)}`);
      return null;
    }
  }

  /** 이름 → 완전일치 단일 회사 → fetchProfile. seq 동봉 반환. */
  async fetchByName(
    name: string,
    normalize: (s: string) => string,
  ): Promise<{ seq: string; metrics: NpsMetrics } | null> {
    if (!this.enabled || !name) return null;
    try {
      const companies = groupCompanies(parseBassItems(await this.bass(name)));
      const q = normalize(name);
      const matches = companies.filter((c) => normalize(c.name) === q);
      if (matches.length !== 1) return null; // 0건/복수 → 보수적으로 지표 없음
      const seq = matches[0].seq;
      const metrics = await this.fetchProfile(name, seq);
      return metrics ? { seq, metrics } : null;
    } catch (e) {
      this.logger.warn(`NPS fetchByName 실패 (${name}): ${String(e)}`);
      return null;
    }
  }

  private bass(name: string): Promise<unknown> {
    return this.get('getBassInfoSearchV2', {
      wkplNm: name,
      pageNo: '1',
      numOfRows: '100',
    });
  }
}
