import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SharedModule } from '../shared/shared.module';
import { ParseController } from './parse.controller';
import { ParseService } from './parse.service';
import { LlmService } from './llm.service';
import { ClaudeService } from './claude.service';
import { OllamaService } from './ollama.service';

@Module({
  imports: [AuthModule, SharedModule],
  controllers: [ParseController],
  providers: [ParseService, LlmService, ClaudeService, OllamaService],
})
export class ParseModule {}
