import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';

import { PrismaService } from '../prisma/prisma.service';
import { FirecrawlService } from '../shared/firecrawl.service';
import {
  buildWantedText,
  extractJson,
  matchWantedId,
  wantedApiUrl,
} from './adapters/wanted.adapter';
import { LlmService } from './llm.service';
import {
  DEFAULT_STAGES,
  ParsedPosting,
  ParseResponse,
  stripNoise,
  stripRecommended,
} from './types';

export class ParseDto {
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() rawText?: string;
}

/** 파싱 결과 캐시 수명 (3일) — 공고는 수 일 내 거의 안 바뀜. */
const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
/** 렌더 성공으로 볼 최소 수집 길이 — 미만이면 긴 대기로 1회 재수집. */
const RENDER_MIN = 600;

@Injectable()
export class ParseService {
  private readonly logger = new Logger(ParseService.name);

  constructor(
    private firecrawl: FirecrawlService,
    private llm: LlmService,
    private prisma: PrismaService,
  ) {}

  /** 캐시 → 파싱 → 계측. 같은 URL/본문 재분석은 캐시로 즉답(수집·LLM 생략). */
  async parse(dto: ParseDto): Promise<ParseResponse> {
    const key = this.cacheKey(dto);
    if (key) {
      const hit = await this.cacheGet(key);
      if (hit) {
        this.logger.log(`parse cache hit (${key.slice(0, 40)})`);
        return hit;
      }
    }
    const result = await this.doParse(dto);
    await this.logParse(dto, result);
    // 성공 결과만 캐시(실패/폴백은 재시도 여지를 남긴다)
    if (key && result.draft.companyName !== '' && !result.needsManualInput) {
      await this.cachePut(key, result);
    }
    return result;
  }

  private async doParse(dto: ParseDto): Promise<ParseResponse> {
    let text = (dto.rawText ?? '').trim();

    // 1. 링크 우선: 본문이 없으면 Firecrawl로 수집 시도(동적 대기)
    if (!text && dto.url) {
      const scraped = await this.scrapeAdaptive(dto.url);
      if (scraped && scraped.trim().length > 50) {
        // 추천/광고(다른 회사 공고)를 자르고, 이미지·링크·푸터 노이즈를 걷어
        // 실제 공고 텍스트만 LLM에 넘긴다(토큰↓·잡음↓).
        text = stripNoise(stripRecommended(scraped.trim()));
        // 본문이 이미지로만 되어 있거나(JD 이미지 업로드) 내용이 너무 짧으면
        // 틀린 기본값을 조용히 주지 말고 붙여넣기를 안내한다.
        if (text.length < 200) {
          return {
            draft: this.emptyDraft(dto.url),
            needsManualInput: true,
            notice:
              '공고 본문이 이미지로 되어 있거나 내용이 짧아 자동 분석이 어려워요. 공고 내용을 붙여넣어 주세요.',
          };
        }
      } else {
        // 수집 실패 → 붙여넣기 폴백
        return {
          draft: this.emptyDraft(dto.url),
          needsManualInput: true,
          notice: this.firecrawl.enabled
            ? '공고 본문을 자동으로 가져오지 못했어요. 공고 내용을 붙여넣어 주세요.'
            : '링크 자동 수집이 설정되지 않았어요. 공고 내용을 붙여넣어 주세요.',
        };
      }
    }

    if (!text) {
      return {
        draft: this.emptyDraft(dto.url),
        needsManualInput: true,
        notice: '링크 또는 공고 내용을 입력해 주세요.',
      };
    }

    // 2. 본문 → LLM 파싱 (로컬 ollama / 클라우드 anthropic, env로 라우팅)
    const parsed = this.llm.enabled ? await this.llm.parse(text) : null;
    if (!parsed) {
      return {
        draft: this.emptyDraft(dto.url),
        needsManualInput: false,
        rawText: text.slice(0, 20000),
        notice: this.llm.enabled
          ? '자동 분석에 실패했어요. 내용을 직접 확인하고 채워 주세요.'
          : 'AI 분석이 꺼져 있어 기본 양식을 제공해요. 직접 채워 주세요.',
      };
    }

    // 전형 단계를 본문에서 못 찾아 기본값으로 폴백한 경우(=이미지 전형 등) 명확히 안내
    const stagesAreDefault =
      parsed.stages.length === DEFAULT_STAGES.length &&
      parsed.stages.every((s, i) => s.name === DEFAULT_STAGES[i]?.name);

    return {
      draft: parsed,
      needsManualInput: false,
      rawText: text.slice(0, 20000),
      notice: stagesAreDefault
        ? '전형 단계를 공고에서 찾지 못해 기본값(서류·면접·최종)을 넣었어요. 공고에 전형 절차가 이미지로 있으면 본문을 붙여넣거나, 단계를 직접 수정해 주세요.'
        : parsed.confidence === 'low'
          ? '일부 항목을 확실히 추출하지 못했어요. 확인 후 수정해 주세요.'
          : undefined,
    };
  }

  /**
   * 동적 대기 수집: 대부분 공고는 2.5s면 렌더 완료 → 빠른 1차. 결과가 비었거나
   * 너무 짧으면(미렌더 SPA) 긴 대기(6s)로 1회만 재수집. 고정 5s 대기 제거.
   */
  private async scrapeAdaptive(url: string): Promise<string | null> {
    // 사이트 어댑터 우선: Wanted는 chaos API(JSON)에 전형 등 구조화 필드가 완전해
    // 렌더 페이지보다 커버리지가 높다(전형이 이미지인 공고도 복구).
    const wantedId = matchWantedId(url);
    if (wantedId) {
      const apiMd = await this.firecrawl.scrape(wantedApiUrl(wantedId));
      const built = apiMd ? buildWantedText(extractJson(apiMd)) : null;
      if (built && built.length > 200) {
        this.logger.log(`wanted adapter hit (wd/${wantedId})`);
        return built;
      }
      // 어댑터 실패 → 일반 수집으로 폴백
    }

    const fast = await this.firecrawl.scrape(url, { waitFor: 2500 });
    if (fast && fast.trim().length >= RENDER_MIN) return fast;
    const slow = await this.firecrawl.scrape(url, { waitFor: 6000 });
    return slow ?? fast;
  }

  /** 캐시 키: 붙여넣기면 본문 해시, 링크면 URL. 둘 다 없으면 캐시 안 함. */
  private cacheKey(dto: ParseDto): string | null {
    const raw = (dto.rawText ?? '').trim();
    if (raw) return `h:${createHash('sha256').update(raw).digest('hex')}`;
    if (dto.url) return `u:${dto.url.trim()}`;
    return null;
  }

  private async cacheGet(key: string): Promise<ParseResponse | null> {
    try {
      const row = await this.prisma.parseCache.findUnique({ where: { key } });
      if (!row) return null;
      if (Date.now() - row.createdAt.getTime() > CACHE_TTL_MS) return null; // 만료
      return JSON.parse(row.resultJson) as ParseResponse;
    } catch (e) {
      this.logger.warn(`ParseCache 조회 실패: ${String(e)}`);
      return null;
    }
  }

  private async cachePut(key: string, result: ParseResponse): Promise<void> {
    try {
      const resultJson = JSON.stringify(result);
      await this.prisma.parseCache.upsert({
        where: { key },
        create: { key, resultJson },
        update: { resultJson, createdAt: new Date() },
      });
    } catch (e) {
      this.logger.warn(`ParseCache 저장 실패: ${String(e)}`);
    }
  }

  /** 호스트 추출: URL이면 www 뺀 호스트, 붙여넣기면 'paste', 실패 시 'unknown'. */
  private hostOf(url?: string): string {
    if (!url) return 'paste';
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return 'unknown';
    }
  }

  private async logParse(dto: ParseDto, res: ParseResponse): Promise<void> {
    try {
      await this.prisma.parseLog.create({
        data: {
          host: this.hostOf(dto.url),
          // 빈 초안(companyName='')이면 실제 파싱이 아니라 폴백이다.
          ok: res.draft.companyName !== '',
          confidence: res.draft.companyName !== '' ? res.draft.confidence : null,
          needsManualInput: res.needsManualInput,
        },
      });
    } catch (e) {
      this.logger.warn(`ParseLog 기록 실패: ${String(e)}`);
    }
  }

  private emptyDraft(_url?: string): ParsedPosting {
    return {
      companyName: '',
      position: '',
      location: null,
      employmentType: null,
      deadline: null,
      stages: DEFAULT_STAGES,
      confidence: 'low',
    };
  }
}
