import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ParseController } from './parse.controller';
import { ParseService } from './parse.service';
import { FirecrawlService } from './firecrawl.service';
import { LlmService } from './llm.service';
import { ClaudeService } from './claude.service';
import { OllamaService } from './ollama.service';

@Module({
  imports: [AuthModule],
  controllers: [ParseController],
  providers: [
    ParseService,
    FirecrawlService,
    LlmService,
    ClaudeService,
    OllamaService,
  ],
})
export class ParseModule {}
