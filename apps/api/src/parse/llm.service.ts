import { Injectable, Logger } from '@nestjs/common';

import { ClaudeService } from './claude.service';
import { GroqService } from './groq.service';
import { OllamaService } from './ollama.service';
import { ParsedPosting } from './types';

export type LlmProvider = 'ollama' | 'anthropic' | 'groq' | 'none';

/**
 * LLM 프로바이더 라우터.
 * LLM_PROVIDER: ollama(로컬) / anthropic(클라우드 유료) / groq(클라우드 무료) / none(끔).
 * 미설정 시: ANTHROPIC_API_KEY가 있으면 anthropic, 없으면 ollama(로컬 테스트 기본값).
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private claude: ClaudeService,
    private ollama: OllamaService,
    private groq: GroqService,
  ) {}

  get provider(): LlmProvider {
    const p = (process.env.LLM_PROVIDER ?? '').toLowerCase();
    if (p === 'ollama' || p === 'anthropic' || p === 'groq' || p === 'none') {
      return p;
    }
    return process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'ollama';
  }

  get enabled(): boolean {
    return this.provider !== 'none';
  }

  async parse(text: string): Promise<ParsedPosting | null> {
    const provider = this.provider;
    this.logger.log(`parsing via "${provider}"`);
    switch (provider) {
      case 'anthropic':
        return this.claude.parse(text);
      case 'groq':
        return this.groq.parse(text);
      case 'ollama':
        return this.ollama.parse(text);
      default:
        return null;
    }
  }
}
