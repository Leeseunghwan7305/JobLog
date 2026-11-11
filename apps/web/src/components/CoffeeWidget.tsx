'use client';

import { useEffect, useState } from 'react';

import { useToast } from '@/components/Toast';

/**
 * 전역 "커피 한 잔 후원" 위젯. 우하단 문의 버튼 위에 스택되는 플로팅 버튼 → 모달.
 * 결제 연동 없이 공개 입금 계좌만 안내한다(비밀값 아님, 후원 수신용 공개 계좌).
 */
const BANK = '국민은행';
const ACCOUNT = '812701-04-155948';
const HOLDER = '이승환'; // 예금주 — 실제와 다르면 이 줄만 고치면 된다.

export default function CoffeeWidget() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
        }}
        aria-label="개발자에게 커피 한 잔 후원하기"
        title="커피 한 잔 후원하기"
        className="fixed bottom-20 right-5 z-40 grid h-12 w-12 place-items-center rounded-full bg-amber-500 text-xl text-white shadow-lg ring-1 ring-black/5 transition hover:bg-amber-600 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 motion-safe:hover:-translate-y-0.5"
      >
        <span aria-hidden="true">☕</span>
      </button>
      {open && (
        <CoffeeModal
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function CoffeeModal({ onClose }: { onClose: () => void }) {
  const { show } = useToast();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const copy = () => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(ACCOUNT);
        show('계좌번호를 복사했어요 ✓', 'success');
      } catch {
        show('복사가 안 돼요. 계좌번호를 길게 눌러 복사해 주세요.', 'error');
      }
    })();
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm duration-200 animate-in fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="커피 한 잔 후원"
        className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl ring-1 ring-black/5 duration-200 animate-in fade-in zoom-in-95 slide-in-from-bottom-2"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">☕ 커피 한 잔 후원</h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          JobLog은 1인 개발자가 혼자 만들고 서버비도 직접 내며 무료로 운영하고
          있어요. 구직에 도움이 됐다면 커피 한 잔으로 응원해 주세요. 큰 힘이 돼요.
          🙏
        </p>

        <div className="mt-4 rounded-xl border border-border bg-muted/50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            입금 계좌
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-sm font-semibold">{BANK}</span>
            <span className="select-all text-lg font-bold tabular-nums tracking-tight">
              {ACCOUNT}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            예금주 {HOLDER}
          </div>
        </div>

        <button
          onClick={copy}
          className="mt-4 w-full rounded-lg bg-amber-500 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2"
        >
          계좌번호 복사
        </button>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          작은 응원도 큰 동기부여가 돼요. 감사합니다 :)
        </p>
      </div>
    </div>
  );
}
