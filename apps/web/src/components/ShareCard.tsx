'use client';

import type { DashboardStats } from '@joblog/types';
import { useState } from 'react';

/**
 * "내 구직 현황 카드" 공유 버튼. 집계 숫자만 canvas로 그려 이미지를 만들고,
 * Web Share(파일 지원 시)로 공유하거나 PNG로 저장한다. 전부 클라이언트에서 처리 —
 * 개인 공고 내용은 전혀 담지 않으므로(지원/진행/합격 수와 합격률만) 프라이버시 안전.
 */
export default function ShareCard({
  stats,
  offerRate,
}: {
  stats: DashboardStats;
  offerRate: number | null;
}) {
  const [busy, setBusy] = useState(false);

  const draw = (): Promise<Blob | null> => {
    const S = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);

    const font = '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, '#3858e9');
    g.addColorStop(1, '#6d85f2');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    // 상단 브랜드
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `700 40px ${font}`;
    ctx.fillText('JobLog', S / 2, 150);
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 76px ${font}`;
    ctx.fillText('내 구직 현황', S / 2, 250);

    // 2×2 타일
    const tiles: { label: string; value: string }[] = [
      { label: '지원', value: String(stats.total) },
      { label: '진행중', value: String(stats.inProgress) },
      { label: '합격', value: String(stats.offer) },
      { label: '불합격', value: String(stats.rejected) },
    ];
    const gap = 40;
    const tileW = (S - 160 - gap) / 2;
    const tileH = 190;
    const startX = 80;
    const startY = 330;
    tiles.forEach((t, i) => {
      const x = startX + (i % 2) * (tileW + gap);
      const y = startY + Math.floor(i / 2) * (tileH + gap);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.roundRect(x, y, tileW, tileH, 28);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 92px ${font}`;
      ctx.textAlign = 'center';
      ctx.fillText(t.value, x + tileW / 2, y + 110);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `600 34px ${font}`;
      ctx.fillText(t.label, x + tileW / 2, y + 160);
    });

    // 합격률 + 푸터
    const afterTiles = startY + tileH * 2 + gap + 90;
    if (offerRate !== null) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 44px ${font}`;
      ctx.fillText(
        `지금까지 합격률 ${Math.round(offerRate * 100)}%`,
        S / 2,
        afterTiles,
      );
    }
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `500 30px ${font}`;
    ctx.fillText('joblog.store', S / 2, S - 70);

    return new Promise((resolve) => {
      canvas.toBlob((b) => {
        resolve(b);
      }, 'image/png');
    });
  };

  const onShare = async () => {
    setBusy(true);
    try {
      const blob = await draw();
      if (!blob) return;
      const file = new File([blob], 'joblog-status.png', { type: 'image/png' });
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files: File[]; title?: string; text?: string }) => Promise<void>;
      };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: '내 구직 현황',
          text: '내 구직 현황 · JobLog',
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'joblog-status.png';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // 사용자가 공유 취소하거나 실패 → 조용히 무시
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={() => {
        void onShare();
      }}
      disabled={busy}
      title="내 구직 현황을 이미지로 공유"
      className="shrink-0 rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-accent disabled:opacity-60"
    >
      {busy ? '만드는 중…' : '현황 공유'}
    </button>
  );
}
