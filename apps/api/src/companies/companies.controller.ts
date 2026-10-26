import { Controller, Get, Query } from '@nestjs/common';

import { CompaniesService } from './companies.service';

// 기업 후기 조회는 비로그인에서도 열람 가능 (spec §3.2: /companies/reviews는 JWT 가드 제외).
// 후기는 best-effort 참고용이고 사용자 리소스가 아니므로 소유권 검증 대상도 아니다.
@Controller('companies')
export class CompaniesController {
  constructor(private svc: CompaniesService) {}

  @Get('reviews')
  reviews(@Query('name') name: string) {
    return this.svc.getReviews(name ?? '');
  }
}
