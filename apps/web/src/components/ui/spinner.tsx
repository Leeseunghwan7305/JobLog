import { cn } from '@/lib/utils';

/** 인라인 로딩 스피너 (motion-safe, 현재 글자색을 따라감). */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="로딩 중"
      className={cn(
        'inline-block h-4 w-4 shrink-0 rounded-full border-2 border-current border-t-transparent text-muted-foreground motion-safe:animate-spin',
        className,
      )}
    />
  );
}
