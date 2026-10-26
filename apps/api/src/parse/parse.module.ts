import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ParseController } from './parse.controller';
import { ParseService } from './parse.service';
import { FirecrawlService } from './firecrawl.service';
import { ClaudeService } from './claude.service';

@Module({
  imports: [AuthModule],
  controllers: [ParseController],
  providers: [ParseService, FirecrawlService, ClaudeService],
})
export class ParseModule {}
