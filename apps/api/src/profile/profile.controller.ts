import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsOptional, IsString } from 'class-validator';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ProfileService } from './profile.service';

class SetHomeDto {
  @IsOptional() @IsString() address?: string;
}

// multer 메모리 저장소가 주는 파일(필요한 필드만).
interface UploadFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private svc: ProfileService) {}

  @Get()
  status(@CurrentUser() userId: string) {
    return this.svc.getStatus(userId);
  }

  @Post('resume')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  upload(@CurrentUser() userId: string, @UploadedFile() file?: UploadFile) {
    if (!file) throw new BadRequestException('PDF 파일을 선택해 주세요.');
    const isPdf =
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf');
    if (!isPdf) throw new BadRequestException('PDF 파일만 업로드할 수 있어요.');
    return this.svc.saveResume(userId, file.buffer, file.originalname);
  }

  @Delete('resume')
  remove(@CurrentUser() userId: string) {
    return this.svc.deleteResume(userId);
  }

  @Patch('home')
  setHome(@CurrentUser() userId: string, @Body() dto: SetHomeDto) {
    return this.svc.setHome(userId, dto.address ?? '');
  }
}
