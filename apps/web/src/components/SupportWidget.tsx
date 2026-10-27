'use client';

import type { SupportRequest, SupportResponse } from '@joblog/types';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';

/**
 * 전역 "개발자에게 문의하기" 위젯. 우하단 플로팅 버튼 → 모달.
 * 내용은 우리 API(/support)를 거쳐 백엔드가 Discord 웹훅으로 전달한다
 * (웹훅 URL은 백엔드 전용 — 프론트에 노출하지 않는다).
 */
export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
        }}
        aria-label="개발자에게 문의하기"
        title="개발자에게 문의하기"
        className="fixed bottom-5 right-5 z-40 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-black/5 transition hover:bg-primary/90 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:hover:-translate-y-0.5"
      >
        <ChatIcon />
      </button>
      {open && (
        <SupportModal
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function SupportModal({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  const submit = useMutation({
    mutationFn: (body: SupportRequest) =>
      apiFetch<SupportResponse>('/support', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });

  // 전송 중이 아닐 때만 닫을 수 있다.
  const closable = !submit.isPending;
  const tryClose = () => {
    if (closable) onClose();
  };

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closable) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [closable, onClose]);

  const send = () => {
    const body: SupportRequest = { message: message.trim() };
    const mail = email.trim();
    if (mail) body.email = mail;
    if (typeof window !== 'undefined') body.path = window.location.pathname;
    submit.mutate(body);
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm duration-200 animate-in fade-in"
      onClick={tryClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl ring-1 ring-black/5 duration-200 animate-in fade-in zoom-in-95 slide-in-from-bottom-2"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">
            개발자에게 문의하기
          </h2>
          <button
            onClick={tryClose}
            disabled={!closable}
            aria-label="닫기"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            ✕
          </button>
        </div>

        {submit.isSuccess ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center duration-200 animate-in fade-in">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <CheckIcon />
            </div>
            <div>
              <p className="font-bold">문의가 전송됐어요</p>
              <p className="mt-1 text-sm text-muted-foreground">
                소중한 의견 감사합니다. 필요하면 남겨주신 이메일로 답장드릴게요.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg bg-primary px-5 py-2 font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              닫기
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 duration-200 animate-in fade-in">
            <p className="text-sm text-muted-foreground">
              버그 제보, 기능 제안, 궁금한 점 무엇이든 남겨주세요. 바로 개발자에게
              전달됩니다.
            </p>
            <textarea
              ref={textRef}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
              }}
              rows={6}
              maxLength={2000}
              placeholder="어떤 점이 불편하거나 궁금하신가요?"
              className="rounded-lg border border-input px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground">
                답장받을 이메일 <span className="font-normal">(선택)</span>
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                placeholder="you@example.com"
                className="rounded-lg border border-input px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </label>

            {submit.isError && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                전송에 실패했어요. 잠시 후 다시 시도해 주세요.
              </div>
            )}

            <button
              onClick={send}
              disabled={!message.trim() || submit.isPending}
              className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submit.isPending ? '전송 중…' : '문의 보내기'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 10.5l3.5 3.5L15 6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
