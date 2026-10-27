import type { CompanySearchResult, NpsMetrics } from '@joblog/types';
import { Injectable, Logger } from '@nestjs/common';

import {
  computeTrends,
  estimateAnnualSalaryManwon,
  type NpsDetail,
  type NpsMonthSnapshot,
  parseBassItems,
  parseDetail,
  pickWorkplace,
  recentYms,
  toSearchResults,
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
      resultType: 'json',
      ...params,
    });
    const res = await fetch(`${BASE}/${path}?${qs.toString()}`);
    if (!res.ok) {
      this.logger.warn(`NPS ${path} ${res.status}`);
      return null;
    }
    return res.json();
  }

  /** 사업장명 검색 → 후보 목록 (상세 호출 없이 가볍게). */
  async searchCandidates(name: string): Promise<CompanySearchResult[]> {
    if (!this.enabled || !name) return [];
    try {
      const bass = await this.get('getBassInfoSearchV2', {
        wkpl_nm: name,
        pageNo: '1',
        numOfRows: '30',
      });
      return toSearchResults(parseBassItems(bass));
    } catch (e) {
      this.logger.warn(`NPS search 실패 (${name}): ${String(e)}`);
      return [];
    }
  }

  /** seq로 최근 N개월 상세를 모아 추이 포함 지표 산출. 실패/빈값이면 null. */
  async fetchBySeq(seq: string, region?: string | null): Promise<NpsMetrics | null> {
    if (!this.enabled || !seq) return null;
    try {
      // 월 무지정 → 최신월 파악
      const latest = parseDetail(await this.get('getDetailInfoSearchV2', { seq }));
      if (!latest) return null;
      const latestYm = latest.dataYm ?? '';

      const snapshots: NpsMonthSnapshot[] = [];
      const seen = new Set<string>();
      const push = (d: NpsDetail, ymFallback: string): void => {
        const ym = d.dataYm ?? ymFallback;
        // 실제 자료월 기준 dedup — API가 월 파라미터를 무시해 같은 월을 반복
        // 돌려줘도 가짜 추이가 안 생긴다(그 경우 단월로 축소).
        if (!ym || seen.has(ym)) return;
        seen.add(ym);
        snapshots.push({
          ym,
          memberCount: d.memberCount,
          crrmmNtcAmt: d.crrmmNtcAmt,
          joined: d.newThisMonth,
          left: d.lostThisMonth,
        });
      };
      push(latest, latestYm);
      if (latestYm) {
        for (const ym of recentYms(latestYm, TREND_MONTHS)) {
          if (seen.has(ym)) continue;
          const d = parseDetail(
            await this.get('getDetailInfoSearchV2', { seq, data_crt_ym: ym }),
          );
          if (d) push(d, ym);
        }
      }

      const { trend, turnoverRatePct } = computeTrends(snapshots);
      return {
        memberCount: latest.memberCount,
        estimatedAnnualSalaryManwon: estimateAnnualSalaryManwon(
          latest.crrmmNtcAmt,
          latest.memberCount,
        ),
        newThisMonth: latest.newThisMonth,
        lostThisMonth: latest.lostThisMonth,
        industry: latest.industry,
        region: region ?? null,
        dataYm: latestYm || null,
        turnoverRatePct,
        trend,
      };
    } catch (e) {
      this.logger.warn(`NPS fetchBySeq 실패 (${seq}): ${String(e)}`);
      return null;
    }
  }

  /** 이름 → 완전일치 단일 사업장 → fetchBySeq. seq 동봉 반환. */
  async fetchByName(
    name: string,
    normalize: (s: string) => string,
  ): Promise<{ seq: string; metrics: NpsMetrics } | null> {
    if (!this.enabled || !name) return null;
    try {
      const bass = await this.get('getBassInfoSearchV2', {
        wkpl_nm: name,
        pageNo: '1',
        numOfRows: '20',
      });
      const picked = pickWorkplace(parseBassItems(bass), name, normalize);
      if (!picked) return null; // 0건/복수 → 보수적으로 지표 없음
      const metrics = await this.fetchBySeq(picked.seq, picked.address);
      return metrics ? { seq: picked.seq, metrics } : null;
    } catch (e) {
      this.logger.warn(`NPS fetchByName 실패 (${name}): ${String(e)}`);
      return null;
    }
  }
}
