import './globals.css';

import type { Metadata } from 'next';

import Providers from './providers';

export const metadata: Metadata = {
  title: 'JobLog',
  description: '지원한 공고, 어디까지 왔는지 한 곳에서 추적한다',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
