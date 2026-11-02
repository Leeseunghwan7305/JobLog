import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ProfileService } from './profile.service';

class SetHomeDto {
  @IsOptional() @IsString() address?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private svc: ProfileService) {}

  @Get()
  status(@CurrentUser() userId: string) {
    return this.svc.getStatus(userId);
  }

  @Patch('home')
  setHome(@CurrentUser() userId: string, @Body() dto: SetHomeDto) {
    return this.svc.setHome(userId, dto.address ?? '');
  }
}
