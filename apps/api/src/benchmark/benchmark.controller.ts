import { Controller, Get } from '@nestjs/common';

import { BenchmarkService } from './benchmark.service';

// 공개 엔드포인트(인증 불필요) — 익명 집계라 소유권 개념이 없다.
@Controller('benchmark')
export class BenchmarkController {
  constructor(private svc: BenchmarkService) {}

  @Get()
  get() {
    return this.svc.get();
  }
}
