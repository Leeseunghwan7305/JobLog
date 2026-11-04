'use client';

import { useEffect, useState } from 'react';

/** Chrome/Android가 설치 가능 시점에 쏘는 이벤트(표준 타입 미제공이라 좁게 선언). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'joblog_pwa_dismissed';

/**
 * "홈 화면에 추가" 설치 배너. 서비스워커를 등록해 설치 가능 조건을 만들고,
 * beforeinstallprompt를 가로채 사용자가 원할 때 네이티브 설치 프롬프트를 띄운다.
 * 한 번 닫으면 localStorage로 다시 띄우지 않는다. (iOS Safari는 이벤트 미발생 → 조용히 미표시)
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [show, setShow] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // 등록 실패해도 앱 동작엔 영향 없음 — 설치 유도만 비활성.
      });
    }
    if (localStorage.getItem(DISMISS_KEY)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault(); // 브라우저 기본 미니 인포바 대신 우리 배너로
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    const onInstalled = () => {
      setShow(false);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!show || !deferred) return null;

  const install = async () => {
    await deferred.prompt();
    await deferred.userChoice;
    setShow(false);
    setDeferred(null);
  };
  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setShow(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-xl border border-border bg-card p-3 shadow-card duration-300 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
          J
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">JobLog을 홈 화면에 추가</div>
          <div className="text-xs text-muted-foreground">
            앱처럼 한 번에 열고, 알림도 더 빠르게.
          </div>
        </div>
        <div className="flex flex-none items-center gap-1.5">
          <button
            onClick={dismiss}
            className="rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            나중에
          </button>
          <button
            onClick={() => {
              void install();
            }}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
