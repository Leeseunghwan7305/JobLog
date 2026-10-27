import type { FitResult } from '@joblog/types';
import { Injectable, Logger } from '@nestjs/common';

import { FitInput, fitSystemPrompt, fitUserPrompt, normalizeFit } from './fit';
import { normalizeParsed, ParsedPosting } from './types';

// 구조화 출력을 강제하기 위한 tool 정의 (tool_choice로 호출 강제)
const EXTRACT_TOOL = {
  name: 'save_job_posting',
  description: '채용 공고에서 추출한 구조화 정보를 저장한다.',
  input_schema: {
    type: 'object',
    properties: {
      companyName: {
        type: 'string',
        description:
          '실제 채용하는 회사(고용주)명. 공고를 게시한 채용 플랫폼/잡보드(원티드·잡코리아·사람인·인크루트·링크드인·리멤버 등) 이름이 아니다.',
      },
      position: { type: 'string', description: '직무/포지션' },
      location: { type: 'string', description: '근무지' },
      employmentType: {
        type: 'string',
        description: '고용형태 (정규직/인턴/계약직 등)',
      },
      deadline: {
        type: 'string',
        description:
          '지원 마감일. 반드시 YYYY-MM-DD로 정규화. 상시·수시채용 등 특정 마감일이 없으면 이 필드를 생략',
      },
      stages: {
        type: 'array',
        description:
          '채용 전형 단계를 순서대로. 회사마다 다름. 예: 서류, 코딩테스트, 1차 면접, 2차 컬쳐핏 면접, 최종',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description:
                '간결한 전형 단계명 (괄호 부연설명 제외). 예: "1차 면접"',
            },
            order: { type: 'number' },
          },
          required: ['name', 'order'],
        },
      },
      confidence: {
        type: 'string',
        enum: ['high', 'low'],
        description: '추출 신뢰도. 전형 단계를 확실히 못 찾았으면 low',
      },
    },
    required: ['companyName', 'position', 'stages', 'confidence'],
  },
};

/** 공고 본문 → 구조화 초안. 키가 없거나 실패하면 null */
@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);

  get enabled(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async parse(text: string): Promise<ParsedPosting | null> {
    if (!this.enabled) return null;
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8';
    const body = JSON.stringify({
      model,
      max_tokens: 1024,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: 'tool', name: EXTRACT_TOOL.name },
      messages: [
        {
          role: 'user',
          content:
            '다음 채용 공고 본문에서 정보를 추출해 save_job_posting 도구로 저장해줘.\n\n' +
            '[회사명]\n' +
            '- companyName은 실제로 채용하는 회사(고용주)다. 공고가 게시된 채용 플랫폼/잡보드(원티드/wanted, 잡코리아, 사람인, 인크루트, 링크드인, 리멤버 등) 이름이나 사이트 UI 문구를 회사명으로 쓰지 마라.\n' +
            '- "회사명:" 같은 라벨이 없으면 회사를 소개하는 문맥(예: "○○는 …를 운영하는 회사입니다", "○○에서 …를 채용합니다")에서 고용주명을 찾는다.\n\n' +
            '[전형 단계]\n' +
            '- "채용 절차/전형 절차/채용 프로세스" 전용 섹션이 있으면 그 단계를 순서대로 담는다.\n' +
            '- 전용 섹션이 없어도 본문에 "서류 ▶ 코테 ▶ 면접"처럼 ▶·→·- 로 나열된 절차가 있으면 그것을 단계로 쓴다.\n' +
            '- 단계명은 간결하게: 괄호 부연("1차 면접(직무 적합성)"→"1차 면접")과 "(생략 가능)" 류 조건은 이름에서 뺀다.\n' +
            '- 어디에서도 전형 절차를 못 찾으면 기본값(서류 → 면접 → 최종)을 넣고 confidence를 "low"로, 명확히 찾았으면 "high"로 설정한다.\n\n' +
            '[마감일]\n' +
            '- "2024.12.30", "2024년 12월 30일", "~ 1/30(금)" 등은 모두 YYYY-MM-DD로 변환한다(연도 미표기 시 올해 기준).\n' +
            '- "상시채용/수시채용/채용시 마감"처럼 마감일이 특정되지 않으면 deadline을 생략한다.\n\n' +
            '공고 본문:\n---\n' +
            text.slice(0, 20000),
        },
      ],
    });

    // 일시적 오류(429·5xx·네트워크)는 1회 더 시도. 그래도 실패하면 null → 폴백 (spec 6.2).
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body,
        });
        if (res.status === 429 || res.status >= 500) {
          this.logger.warn(`Claude ${res.status} (attempt ${attempt}/2)`);
          continue; // 일시적 오류 → 재시도
        }
        if (!res.ok) {
          this.logger.warn(`Claude ${res.status}`);
          return null; // 4xx 등 영구 오류는 재시도 무의미
        }
        const json = (await res.json()) as {
          stop_reason?: string;
          content?: { type: string; input?: unknown }[];
        };
        if (json.stop_reason === 'refusal') return null;
        const block = (json.content ?? []).find((b) => b.type === 'tool_use');
        if (!block?.input) return null;
        return normalizeParsed(block.input as Record<string, unknown>);
      } catch (e) {
        this.logger.warn(
          `Claude parse failed (attempt ${attempt}/2): ${String(e)}`,
        );
      }
    }
    return null;
  }

  async analyzeFit(input: FitInput): Promise<FitResult | null> {
    if (!this.enabled) return null;
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8';
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1500,
          system: fitSystemPrompt(),
          messages: [{ role: 'user', content: fitUserPrompt(input) }],
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Claude fit ${res.status}`);
        return null;
      }
      const json = (await res.json()) as {
        content?: { type: string; text?: string }[];
      };
      const text = (json.content ?? []).find((b) => b.type === 'text')?.text;
      if (!text) return null;
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start < 0 || end < 0) return null;
      return normalizeFit(
        JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>,
      );
    } catch (e) {
      this.logger.warn(`Claude fit failed: ${String(e)}`);
      return null;
    }
  }
}
