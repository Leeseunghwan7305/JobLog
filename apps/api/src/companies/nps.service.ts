import type { NpsMetrics } from '@joblog/types';
import { Injectable, Logger } from '@nestjs/common';

import {
  estimateAnnualSalaryManwon,
  parseBassItems,
  parseDetail,
  pickWorkplace,
} from './nps';

const BASE = 'http://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2';

/** 국민연금 가입사업장 공개데이터 조회. 키 없거나 실패/모호하면 null → 바로가기 폴백. */
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

  async fetchMetrics(
    name: string,
    normalize: (s: string) => string,
  ): Promise<NpsMetrics | null> {
    if (!this.enabled || !name) return null;
    try {
      const bass = await this.get('getBassInfoSearchV2', {
        wkpl_nm: name,
        pageNo: '1',
        numOfRows: '20',
      });
      const picked = pickWorkplace(parseBassItems(bass), name, normalize);
      if (!picked) return null; // 0건/복수 → 보수적으로 지표 없음

      const detailJson = await this.get('getDetailInfoSearchV2', {
        seq: picked.seq,
      });
      const detail = parseDetail(detailJson);
      if (!detail) return null;

      return {
        memberCount: detail.memberCount,
        estimatedAnnualSalaryManwon: estimateAnnualSalaryManwon(
          detail.crrmmNtcAmt,
          detail.memberCount,
        ),
        newThisMonth: detail.newThisMonth,
        lostThisMonth: detail.lostThisMonth,
        industry: detail.industry ?? picked.industry,
        region: picked.address,
        dataYm: picked.dataYm,
      };
    } catch (e) {
      this.logger.warn(`NPS fetch 실패 (${name}): ${String(e)}`);
      return null;
    }
  }
}
