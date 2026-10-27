import { Injectable, Logger } from '@nestjs/common';

import { normalizeParsed, ParsedPosting } from './types';

// json_object 모드라 스키마는 프롬프트로 안내한다(응답은 JSON 객체 하나).
const JSON_SHAPE =
  '{"companyName": string, "position": string, "location": string|null, ' +
  '"employmentType": string|null, "deadline": "YYYY-MM-DD"|null, ' +
  '"stages": [{"name": string, "order": number}], "confidence": "high"|"low"}';

/**
 * Groq(OpenAI 호환) 기반 공고 파서. 무료 티어로 클라우드 배포 시 사용.
 * GROQ_API_KEY가 없거나 실패하면 null. 나중에 LLM_PROVIDER=anthropic 으로 교체 가능.
 */
@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);

  get enabled(): boolean {
    return !!process.env.GROQ_API_KEY;
  }

  get model(): string {
    return process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b';
  }

  async parse(text: string): Promise<ParsedPosting | null> {
    if (!this.enabled) return null;
    try {
      const res = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY ?? ''}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content:
                  '너는 채용 공고에서 구조화 정보를 추출하는 도우미다. ' +
                  `반드시 다음 JSON 형식의 객체 하나로만 답한다(JSON 외 텍스트 금지): ${JSON_SHAPE}. ` +
                  '공고는 본문 맨 위의 것 하나뿐이다. 회사명과 직무는 가장 먼저 나오는 제목(# 로 시작하는 H1)과 그 바로 위의 회사에서 찾아라. 그 아래의 광고·배너·서비스 안내(이력서 작성, 합격자소서 등)와 추천/다른 회사 공고는 전부 무시하라. ' +
                  'companyName은 공고에 적힌 주된 회사명이다. 괄호 안의 별칭·법인명·영문명은 빼라(예: "토스(비바리퍼블리카)"→"토스", "카운터컬쳐컴퍼니(킨즈아카데미)"→"카운터컬쳐컴퍼니"). ' +
                  'companyName은 실제로 채용하는 회사(고용주)다. 공고가 게시된 채용 플랫폼/잡보드(원티드/wanted, 잡코리아, 사람인, 인크루트, 링크드인, 리멤버 등) 이름이나 사이트 UI 문구를 회사명으로 쓰지 마라. ' +
                  '"회사명:" 라벨이 없으면 회사를 소개하는 문맥(예: "○○는 …를 운영하는 회사입니다")에서 고용주명을 찾아라. ' +
                  'location(근무지)도 괄호 안 건물명·부가정보를 빼고 핵심 주소만 남겨라(예: "성남시 분당구 (네이버 1784)"→"성남시 분당구"). ' +
                  '전형 단계는 공고에 적힌 실제 명칭을 순서대로 담되, 괄호 부연설명과 콜론(:) 뒤 설명은 빼고 핵심 명칭만 남겨라(예: "1차 면접(직무 적합성)"→"1차 면접", "지원서 심사: 직무 테스트"→"지원서 심사"). ' +
                  '명확히 찾지 못하면 ["서류","면접","최종"]을 order 0,1,2로 넣고 confidence를 "low"로 설정해.',
              },
              {
                role: 'user',
                content:
                  '다음 채용 공고에서 회사명·직무·근무지·고용형태·전형 단계·마감일을 추출해줘.\n\n---\n' +
                  text.slice(0, 16000),
              },
            ],
          }),
        },
      );
      if (!res.ok) {
        this.logger.warn(`Groq ${res.status}`);
        return null;
      }
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content;
      if (!content) return null;
      return normalizeParsed(JSON.parse(content) as Record<string, unknown>);
    } catch (e) {
      this.logger.warn(`Groq parse failed: ${String(e)}`);
      return null;
    }
  }
}
