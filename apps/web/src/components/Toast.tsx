'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastApi {
  show: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** 전역 토스트 트리거. <ToastProvider> 안에서만 사용. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast는 <ToastProvider> 안에서만 쓸 수 있어요.');
  return ctx;
}

const VARIANT_CLASS: Record<ToastVariant, string> = {
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100',
  error:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200',
  info: 'border-border bg-card text-foreground',
};

const VARIANT_ICON: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
  info: '•',
};

/** 앱 전역 토스트 제공자 + 렌더러. providers.tsx에서 1회 마운트. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = 'success') => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2600);
    },
    [],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        aria-label="알림"
      >
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              dismiss(t.id);
            }}
            className={`pointer-events-auto flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-lg duration-200 animate-in fade-in slide-in-from-top-2 ${VARIANT_CLASS[t.variant]}`}
          >
            <span aria-hidden="true">{VARIANT_ICON[t.variant]}</span>
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
