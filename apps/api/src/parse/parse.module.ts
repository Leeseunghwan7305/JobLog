import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SharedModule } from '../shared/shared.module';
import { ClaudeService } from './claude.service';
import { GroqService } from './groq.service';
import { LlmService } from './llm.service';
import { OllamaService } from './ollama.service';
import { ParseController } from './parse.controller';
import { ParseService } from './parse.service';
import { ParsePreviewController } from './parse-preview.controller';

@Module({
  imports: [AuthModule, SharedModule],
  controllers: [ParseController, ParsePreviewController],
  providers: [
    ParseService,
    LlmService,
    ClaudeService,
    OllamaService,
    GroqService,
  ],
  exports: [LlmService],
})
export class ParseModule {}
