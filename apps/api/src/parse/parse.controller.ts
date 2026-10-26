import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ParseDto, ParseService } from './parse.service';

@UseGuards(JwtAuthGuard)
@Controller('applications')
export class ParseController {
  constructor(private svc: ParseService) {}

  @Post('parse')
  parse(@Body() dto: ParseDto) {
    return this.svc.parse(dto);
  }
}
