import { Injectable, Logger } from '@nestjs/common';

import { ClaudeService } from './claude.service';
import { OllamaService } from './ollama.service';
import { ParsedPosting } from './types';

export type LlmProvider = 'ollama' | 'anthropic' | 'none';

/**
 * LLM 프로바이더 라우터.
 * LLM_PROVIDER 환경변수로 로컬(ollama) / 클라우드(anthropic) / 끔(none)을 전환한다.
 * 미설정 시: ANTHROPIC_API_KEY가 있으면 anthropic, 없으면 ollama(로컬 테스트 기본값).
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private claude: ClaudeService,
    private ollama: OllamaService,
  ) {}

  get provider(): LlmProvider {
    const p = (process.env.LLM_PROVIDER ?? '').toLowerCase();
    if (p === 'ollama' || p === 'anthropic' || p === 'none') return p;
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
      case 'ollama':
        return this.ollama.parse(text);
      default:
        return null;
    }
  }
}
