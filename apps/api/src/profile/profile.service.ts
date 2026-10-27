import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';

import { PrismaService } from '../prisma/prisma.service';

export interface ResumeStatus {
  hasResume: boolean;
  resumeFilename: string | null;
  resumeUpdatedAt: string | null;
}

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(private prisma: PrismaService) {}

  async getStatus(userId: string): Promise<ResumeStatus> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { resumeText: true, resumeFilename: true, resumeUpdatedAt: true },
    });
    return {
      hasResume: !!u?.resumeText,
      resumeFilename: u?.resumeFilename ?? null,
      resumeUpdatedAt: u?.resumeUpdatedAt?.toISOString() ?? null,
    };
  }

  async saveResume(
    userId: string,
    buffer: Buffer,
    filename: string,
  ): Promise<ResumeStatus> {
    let text = '';
    try {
      const data = await pdfParse(buffer);
      text = (data.text ?? '').trim();
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
    return {
      hasResume: true,
      resumeFilename: filename,
      resumeUpdatedAt: now.toISOString(),
    };
  }

  async deleteResume(userId: string): Promise<ResumeStatus> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { resumeText: null, resumeFilename: null, resumeUpdatedAt: null },
    });
    return { hasResume: false, resumeFilename: null, resumeUpdatedAt: null };
  }
}
