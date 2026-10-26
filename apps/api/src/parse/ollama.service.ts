import { Injectable, Logger } from '@nestjs/common';

import { normalizeParsed, ParsedPosting } from './types';

// Ollama의 format 필드에 넣어 구조화 출력을 강제하는 JSON 스키마
const SCHEMA = {
  type: 'object',
  properties: {
    companyName: { type: 'string' },
    position: { type: 'string' },
    location: { type: ['string', 'null'] },
    employmentType: { type: ['string', 'null'] },
    deadline: { type: ['string', 'null'] },
    stages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          order: { type: 'number' },
        },
        required: ['name', 'order'],
      },
    },
    confidence: { type: 'string', enum: ['high', 'low'] },
  },
  required: ['companyName', 'position', 'stages', 'confidence'],
};

/** 로컬 LLM(Ollama) 기반 공고 파서. 서버가 꺼져 있거나 실패하면 null */
@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);

  get baseUrl(): string {
    return process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  }

  get model(): string {
    return process.env.OLLAMA_MODEL ?? 'qwen2.5:7b';
  }

  async parse(text: string): Promise<ParsedPosting | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: SCHEMA,
          options: { temperature: 0 },
          messages: [
            {
              role: 'system',
              content:
                '너는 채용 공고에서 구조화 정보를 추출하는 도우미다. 반드시 주어진 JSON 스키마에 맞춰 한국어로 답한다. ' +
                '전형 단계는 공고에 적힌 실제 명칭을 순서대로 담고(예: 서류, 코딩테스트, 1차 면접, 2차 컬쳐핏 면접, 최종), ' +
                '명확히 찾지 못하면 ["서류","면접","최종"]을 넣고 confidence를 "low"로 설정해.',
            },
            {
              role: 'user',
              content:
                '다음 채용 공고에서 회사명·직무·전형 단계·마감일을 추출해줘.\n\n---\n' +
                text.slice(0, 12000),
            },
          ],
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Ollama ${res.status}`);
        return null;
      }
      const json = (await res.json()) as { message?: { content?: string } };
      const content = json.message?.content;
      if (!content) return null;
      return normalizeParsed(JSON.parse(content) as Record<string, unknown>);
    } catch (e) {
      this.logger.warn(`Ollama parse failed: ${String(e)}`);
      return null;
    }
  }
}
