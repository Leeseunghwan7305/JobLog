import type { HomeLocation, ProfileStatus } from '@joblog/types';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';

import { PrismaService } from '../prisma/prisma.service';
import { GeoService } from '../shared/geo.service';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private prisma: PrismaService,
    private geo: GeoService,
  ) {}

  async getStatus(userId: string): Promise<ProfileStatus> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        resumeText: true,
        resumeFilename: true,
        resumeUpdatedAt: true,
        homeAddress: true,
        homeLat: true,
        homeLng: true,
      },
    });
    return {
      hasResume: !!u?.resumeText,
      resumeFilename: u?.resumeFilename ?? null,
      resumeUpdatedAt: u?.resumeUpdatedAt?.toISOString() ?? null,
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

  async saveResume(
    userId: string,
    buffer: Buffer,
    filename: string,
  ): Promise<ProfileStatus> {
    let text = '';
    try {
      const data = await pdfParse(buffer);
      text = data.text.trim();
    } catch (e) {
      this.logger.warn(`PDF 파싱 실패: ${String(e)}`);
      throw new BadRequestException(
        'PDF에서 텍스트를 읽지 못했어요. 다른 파일로 시도해 주세요.',
      );
    }
    if (text.length < 30) {
      throw new BadRequestException(
        '이력서 텍스트가 너무 짧아요. 텍스트가 포함된 PDF인지 확인해 주세요(이미지 스캔본은 인식이 어려울 수 있어요).',
      );
    }
    const now = new Date();
    await this.prisma.user.update({
      where: { id: userId },
      // 매칭 입력으로만 쓰므로 과도한 길이는 자른다.
      data: {
        resumeText: text.slice(0, 50000),
        resumeFilename: filename,
        resumeUpdatedAt: now,
      },
    });
    return this.getStatus(userId);
  }

  async deleteResume(userId: string): Promise<ProfileStatus> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { resumeText: null, resumeFilename: null, resumeUpdatedAt: null },
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
