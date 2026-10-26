import './globals.css';

import type { Metadata } from 'next';

import Providers from './providers';

export const metadata: Metadata = {
  title: 'JobLog',
  description: '지원한 공고, 어디까지 왔는지 한 곳에서 추적한다',
};

// 하이드레이션 전에 테마 클래스를 심어 깜빡임(FOUC)을 막는다.
const themeScript = `(function(){try{var t=localStorage.getItem('joblog_theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
