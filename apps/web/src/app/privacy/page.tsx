import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '개인정보 처리방침 · JobLog',
  description:
    'JobLog 서비스 및 크롬 익스텐션의 개인정보 수집·이용에 관한 안내.',
};

const UPDATED = '2026-11-03';

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← JobLog
      </Link>

      <h1 className="mt-6 text-2xl font-extrabold tracking-tight">
        개인정보 처리방침
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        최종 업데이트: {UPDATED}
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">
            1. 개요
          </h2>
          <p>
            JobLog(이하 “서비스”)는 구직 현황 추적 서비스이며, 함께 제공되는 크롬
            익스텐션 “JobLog — 공고 담기”(이하 “익스텐션”)를 포함합니다. 본
            방침은 서비스와 익스텐션이 수집·이용하는 정보를 설명합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">
            2. 크롬 익스텐션이 다루는 정보
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              익스텐션은 사용자가 <b className="text-foreground">아이콘을 눌러
              담기를 실행한 순간</b>, 현재 보고 있는 탭의 <b className="text-foreground">
              주소(URL)</b>만 읽습니다(<code className="rounded bg-secondary px-1">
              activeTab</code> 권한).
            </li>
            <li>
              그 URL을 쿼리로 담아 JobLog 웹사이트를 새 탭으로 엽니다. 분석·저장은
              <b className="text-foreground"> 로그인된 JobLog 웹 세션</b>이
              수행합니다.
            </li>
            <li>
              익스텐션은 백그라운드에서 브라우징을 추적하지 않으며, 로그인
              정보·비밀번호·토큰을 저장하거나 전송하지 않습니다. 자체 서버로
              데이터를 보내지 않습니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">
            3. 서비스가 수집·저장하는 정보
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b className="text-foreground">계정</b> — 카카오 로그인으로 받은
              식별자·닉네임·(선택) 이메일·프로필 이미지.
            </li>
            <li>
              <b className="text-foreground">지원 데이터</b> — 사용자가 등록한
              공고의 회사·직무·전형 단계·상태·메모·일정 등.
            </li>
            <li>
              <b className="text-foreground">선택 정보</b> — 통근 길찾기를 위해
              사용자가 입력한 집 주소(좌표로 변환해 저장).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">
            4. 이용 목적 · 제3자 제공
          </h2>
          <p>
            수집한 정보는 지원 현황 추적·알림 등 서비스 제공 목적으로만
            이용합니다. 수집한 개인정보를 판매하거나 광고 목적으로 제3자에게
            제공하지 않습니다. 공고 분석을 위해 입력 텍스트가 LLM/스크래핑
            제공자로 전송될 수 있으며, 이는 분석 목적에 한합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">
            5. 보관 · 삭제
          </h2>
          <p>
            사용자는 언제든 지원·계정 데이터를 삭제할 수 있으며, 삭제 시 관련
            데이터는 제거됩니다. 집 주소 등 선택 정보도 해제할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-foreground">
            6. 문의
          </h2>
          <p>
            개인정보 관련 문의는 서비스 내 “문의하기” 또는 저장소 이슈로 연락해
            주세요.
          </p>
        </section>
      </div>
    </main>
  );
}
