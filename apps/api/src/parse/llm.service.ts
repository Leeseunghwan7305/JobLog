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

  /**
   * 2-tier 파싱: 기본(빠른/무료) 프로바이더로 먼저 파싱하고, 실패하거나 confidence가
   * low면 강한 tier(anthropic)로 1회 에스컬레이션한다. ANTHROPIC_API_KEY가 없으면
   * 에스컬레이션은 비활성(동작·비용 변화 없음) — 쉬운 공고는 싸게, 어려운 것만 비싸게.
   */
  async parse(text: string): Promise<ParsedPosting | null> {
    const provider = this.provider;
    this.logger.log(`parsing via "${provider}"`);
    const primary = await this.parseWith(provider, text);

    const shouldEscalate =
      provider !== 'anthropic' &&
      this.claude.enabled &&
      (primary === null || primary.confidence === 'low');
    if (!shouldEscalate) return primary;

    this.logger.log('low/none confidence → escalating to anthropic');
    const strong = await this.claude.parse(text);
    // 강한 tier가 성공하고(기존이 null이거나) 더 확신할 때만 교체.
    if (strong && (primary === null || strong.confidence === 'high')) {
      return strong;
    }
    return primary;
  }

  private parseWith(
    provider: LlmProvider,
    text: string,
  ): Promise<ParsedPosting | null> {
    switch (provider) {
      case 'anthropic':
        return this.claude.parse(text);
      case 'groq':
        return this.groq.parse(text);
      case 'ollama':
        return this.ollama.parse(text);
      default:
        return Promise.resolve(null);
    }
  }
}
