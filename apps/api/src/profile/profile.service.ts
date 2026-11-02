import type { HomeLocation, ProfileStatus } from '@joblog/types';
import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { GeoService } from '../shared/geo.service';

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private geo: GeoService,
  ) {}

  async getStatus(userId: string): Promise<ProfileStatus> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        homeAddress: true,
        homeLat: true,
        homeLng: true,
      },
    });
    return {
      home: toHome(u),
    };
  }

  /** 집 주소 저장: 지오코딩해 좌표까지 저장. 빈 주소면 해제. */
  async setHome(userId: string, address: string): Promise<ProfileStatus> {
    const q = address.trim();
    if (!q) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { homeAddress: null, homeLat: null, homeLng: null },
      });
      return this.getStatus(userId);
    }
    const geo = await this.geo.geocode(q);
    if (!geo) {
      throw new BadRequestException(
        '주소를 찾지 못했어요. 도로명/지번 주소나 지역명을 확인해 주세요.',
      );
    }
    await this.prisma.user.update({
      where: { id: userId },
      // 지오코딩으로 정규화된 주소를 저장(사용자가 확인하기 쉽게).
      data: { homeAddress: geo.address, homeLat: geo.lat, homeLng: geo.lng },
    });
    return this.getStatus(userId);
  }
}

/** User 행의 home* 필드 → HomeLocation(좌표 완비 시에만). */
function toHome(
  u: { homeAddress: string | null; homeLat: number | null; homeLng: number | null } | null,
): HomeLocation | null {
  if (!u?.homeAddress || u.homeLat == null || u.homeLng == null) return null;
  return { address: u.homeAddress, lat: u.homeLat, lng: u.homeLng };
}
