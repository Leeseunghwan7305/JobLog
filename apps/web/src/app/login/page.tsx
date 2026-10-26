'use client';

import { kakaoLoginUrl } from '@/lib/api';

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="text-center">
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-2xl font-bold text-white shadow">
          J
        </div>
        <h1 className="mb-2 text-2xl font-extrabold tracking-tight">JobLog</h1>
        <p className="mb-8 text-slate-500">
          지원한 공고, 어디까지 왔는지 한 곳에서.
        </p>
        <a
          href={kakaoLoginUrl}
          className="inline-block rounded-lg bg-[#FEE500] px-6 py-3 font-semibold text-[#191600] transition hover:brightness-95"
        >
          카카오로 시작하기
        </a>
      </div>
    </main>
  );
}
