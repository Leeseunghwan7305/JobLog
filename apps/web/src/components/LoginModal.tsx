'use client';

import { kakaoLoginUrl } from '@/lib/api';

export default function LoginModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 duration-200 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-card p-8 text-center shadow-xl duration-200 animate-in fade-in zoom-in-95 slide-in-from-bottom-2"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
          J
        </div>
        <h2 className="mb-1 text-lg font-bold">로그인이 필요해요</h2>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          카카오로 로그인하면 공고를 분석하고
          <br />
          지원 현황을 저장할 수 있어요.
        </p>
        <a
          href={kakaoLoginUrl}
          className="block rounded-lg bg-[#FEE500] px-6 py-3 font-semibold text-[#191600] transition hover:brightness-95"
        >
          카카오로 계속하기
        </a>
        <button
          onClick={onClose}
          className="mt-3 text-sm text-muted-foreground hover:text-foreground"
        >
          나중에
        </button>
      </div>
    </div>
  );
}
