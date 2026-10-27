import { Module } from '@nestjs/common';

import { FirecrawlService } from './firecrawl.service';
import { GeoService } from './geo.service';

@Module({
  providers: [FirecrawlService, GeoService],
  exports: [FirecrawlService, GeoService],
})
export class SharedModule {}
