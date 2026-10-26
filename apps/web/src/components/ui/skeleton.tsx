import { cn } from '@/lib/utils';

/** 로딩 자리표시자. 콘텐츠 모양을 흉내 내 레이아웃 점프를 줄인다. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-md bg-muted motion-safe:animate-pulse', className)}
    />
  );
}
