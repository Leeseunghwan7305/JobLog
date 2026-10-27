'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Spinner } from '@/components/ui/spinner';
import { setToken } from '@/lib/auth';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const match = /token=([^&]+)/.exec(window.location.hash);
    if (match) {
      setToken(decodeURIComponent(match[1]));
      router.replace('/');
    } else {
      router.replace('/login?error=token');
    }
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center text-muted-foreground">
      <span className="flex items-center gap-2">
        <Spinner /> 로그인 중…
      </span>
    </main>
  );
}
