import type { CompanySearchResult, NpsMetrics } from '@joblog/types';
import { Injectable, Logger } from '@nestjs/common';

import {
  companyMonths,
  computeTrends,
  groupCompanies,
  type NpsMonthSnapshot,
  parseBassItems,
  parseDetail,
  parsePeriod,
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
    const res = await fetch(`${BASE}/${path}?${qs.toString()}`);
    if (!res.ok) {
      this.logger.warn(`NPS ${path} ${res.status}`);
      return null;
    }
    return res.json();
  }

  /** 사업장명 검색 → bass는 회사×월로 행을 주므로 회사 단위로 묶어 후보 반환. */
  async searchCandidates(name: string): Promise<CompanySearchResult[]> {
    if (!this.enabled || !name) return [];
    try {
      const rows = parseBassItems(await this.bass(name));
      return groupCompanies(rows);
    } catch (e) {
      this.logger.warn(`NPS search 실패 (${name}): ${String(e)}`);
      return [];
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
        if (i === 0) industry = d.industry; // months[0] = 최신월
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
