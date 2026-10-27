import { ImageResponse } from 'next/og';

// 모든 라우트가 상속하는 기본 OG/트위터 카드 (링크 공유 시 unfurl 미리보기).
export const alt = 'JobLog — 구직 현황 추적';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// 한글을 렌더링하려면 CJK 폰트가 필요하다. best-effort로 받아오고,
// 실패하면(오프라인 빌드 등) 영문 태그라인으로 폴백해 네모(tofu)를 피한다.
async function loadKoreanFont(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(
      'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-700-normal.woff',
    );
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const fontData = await loadKoreanFont();
  const tagline = fontData
    ? '지원한 공고, 어디까지 왔는지 한 곳에서'
    : 'Track every job application, start to finish';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '96px',
          color: '#ffffff',
          backgroundColor: '#3858e9',
          backgroundImage: 'linear-gradient(135deg, #3858e9 0%, #2740c2 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', opacity: 0.92 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: '#ffffff',
              marginRight: 20,
            }}
          />
          <div style={{ fontSize: 40, fontWeight: 700 }}>JobLog</div>
        </div>
        <div
          style={{
            fontSize: 116,
            fontWeight: 800,
            letterSpacing: -3,
            marginTop: 40,
            display: 'flex',
          }}
        >
          JobLog
        </div>
        <div
          style={{
            fontSize: 46,
            marginTop: 20,
            opacity: 0.92,
            display: 'flex',
            ...(fontData ? { fontFamily: 'NotoKR' } : {}),
          }}
        >
          {tagline}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData
        ? [{ name: 'NotoKR', data: fontData, weight: 700, style: 'normal' }]
        : [],
    },
  );
}
