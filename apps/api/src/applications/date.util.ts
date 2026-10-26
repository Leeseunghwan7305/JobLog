import { BadRequestException } from '@nestjs/common';

/**
 * 날짜 문자열을 Date로 변환하되, 해석할 수 없는 값이면 명확한 400을 던진다.
 * Prisma DateTime 컬럼에 Invalid Date가 흘러가 500으로 터지는 것을 막는 "저장 직전" 방어선.
 * 빈 값(null/undefined) 분기는 호출부가 책임지고, 여기선 "주어진 값은 날짜여야 한다"만 보장한다.
 */
export function parseDateStrict(value: string, field: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(
      `${field} 날짜 형식이 올바르지 않습니다: ${value}`,
    );
  }
  return d;
}
