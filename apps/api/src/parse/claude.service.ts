import { Injectable, Logger } from '@nestjs/common';
import { normalizeParsed, ParsedPosting } from './types';

// 구조화 출력을 강제하기 위한 tool 정의 (tool_choice로 호출 강제)
const EXTRACT_TOOL = {
  name: 'save_job_posting',
  description: '채용 공고에서 추출한 구조화 정보를 저장한다.',
  input_schema: {
    type: 'object',
    properties: {
      companyName: { type: 'string', description: '회사명' },
      position: { type: 'string', description: '직무/포지션' },
      location: { type: 'string', description: '근무지' },
      employmentType: {
        type: 'string',
        description: '고용형태 (정규직/인턴/계약직 등)',
      },
      deadline: {
        type: 'string',
        description: '지원 마감일 (YYYY-MM-DD). 없으면 생략',
      },
      stages: {
        type: 'array',
        description:
          '채용 전형 단계를 순서대로. 회사마다 다름. 예: 서류, 코딩테스트, 1차 면접, 2차 컬쳐핏 면접, 최종',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
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
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY as string,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          tools: [EXTRACT_TOOL],
          tool_choice: { type: 'tool', name: EXTRACT_TOOL.name },
          messages: [
            {
              role: 'user',
              content:
                '다음 채용 공고에서 회사명·직무·전형 단계·마감일을 추출해 save_job_posting 도구로 저장해줘. ' +
                '전형 단계는 공고에 적힌 실제 명칭을 순서대로 담고, 명확히 찾지 못하면 기본값(서류 → 면접 → 최종)을 넣고 confidence를 "low"로 설정해.\n\n---\n' +
                text.slice(0, 20000),
            },
          ],
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Claude ${res.status}`);
        return null;
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
      this.logger.warn(`Claude parse failed: ${String(e)}`);
      return null;
    }
  }
}
