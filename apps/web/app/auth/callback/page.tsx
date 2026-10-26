'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setToken } from '@/lib/auth';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const match = window.location.hash.match(/token=([^&]+)/);
    if (match) {
      setToken(decodeURIComponent(match[1]));
      router.replace('/');
    } else {
      router.replace('/login?error=token');
    }
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center text-slate-500">
      로그인 중…
    </main>
  );
}
