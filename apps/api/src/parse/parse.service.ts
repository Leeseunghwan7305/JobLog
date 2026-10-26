import { Injectable } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { FirecrawlService } from './firecrawl.service';
import { ClaudeService } from './claude.service';
import { DEFAULT_STAGES, ParsedPosting, ParseResponse } from './types';

export class ParseDto {
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() rawText?: string;
}

@Injectable()
export class ParseService {
  constructor(
    private firecrawl: FirecrawlService,
    private claude: ClaudeService,
  ) {}

  async parse(dto: ParseDto): Promise<ParseResponse> {
    let text = (dto.rawText ?? '').trim();

    // 1. 링크 우선: 본문이 없으면 Firecrawl로 수집 시도
    if (!text && dto.url) {
      const scraped = await this.firecrawl.scrape(dto.url);
      if (scraped && scraped.trim().length > 50) {
        text = scraped.trim();
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

    // 2. 본문 → Claude 파싱
    const parsed = await this.claude.parse(text);
    if (!parsed) {
      return {
        draft: this.emptyDraft(dto.url),
        needsManualInput: false,
        notice: this.claude.enabled
          ? '자동 분석에 실패했어요. 내용을 직접 확인하고 채워 주세요.'
          : 'AI 분석이 설정되지 않아 기본 양식을 제공해요. 직접 채워 주세요.',
      };
    }

    return {
      draft: parsed,
      needsManualInput: false,
      notice:
        parsed.confidence === 'low'
          ? '일부 항목을 확실히 추출하지 못했어요. 확인 후 수정해 주세요.'
          : undefined,
    };
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
