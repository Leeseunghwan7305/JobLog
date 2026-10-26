import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CompaniesService } from './companies.service';

@UseGuards(JwtAuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private svc: CompaniesService) {}

  @Get('reviews')
  reviews(@Query('name') name: string) {
    return this.svc.getReviews(name ?? '');
  }
}
