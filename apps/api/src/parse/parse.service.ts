import { Injectable, Logger } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';

import { PrismaService } from '../prisma/prisma.service';
import { FirecrawlService } from '../shared/firecrawl.service';
import { LlmService } from './llm.service';
import {
  DEFAULT_STAGES,
  ParsedPosting,
  ParseResponse,
  stripRecommended,
} from './types';

export class ParseDto {
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() rawText?: string;
}

@Injectable()
export class ParseService {
  private readonly logger = new Logger(ParseService.name);

  constructor(
    private firecrawl: FirecrawlService,
    private llm: LlmService,
    private prisma: PrismaService,
  ) {}

  /** 파싱 수행 + 사이트별 품질 계측(best-effort). 계측 실패는 응답에 영향 없음. */
  async parse(dto: ParseDto): Promise<ParseResponse> {
    const result = await this.doParse(dto);
    await this.logParse(dto, result);
    return result;
  }

  private async doParse(dto: ParseDto): Promise<ParseResponse> {
    let text = (dto.rawText ?? '').trim();

    // 1. 링크 우선: 본문이 없으면 Firecrawl로 수집 시도
    if (!text && dto.url) {
      // SPA(원티드 등)는 렌더 전에 긁으면 본문이 비므로 waitFor로 대기한 뒤 수집
      const scraped = await this.firecrawl.scrape(dto.url, { waitFor: 5000 });
      if (scraped && scraped.trim().length > 50) {
        // 추천/광고 섹션(다른 회사 공고)을 제거해 실제 공고만 LLM에 넘긴다
        text = stripRecommended(scraped.trim());
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
