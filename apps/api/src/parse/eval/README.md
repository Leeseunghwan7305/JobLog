# 파싱 eval 하네스

JobLog의 핵심은 "공고 본문 → 구조화 JSON"이고 LLM 출력은 **비결정적**이다.
이 하네스는 골든 데이터셋 대비 **필드 정확도를 채점**해 파싱 품질의 "정답 신호"를 만든다.
프롬프트·스키마를 바꿀 때 이 신호를 보고 근거 있게 고친다. (= 루프 엔지니어링의 안쪽 루프)

## 돌리기

```bash
# 결정적 신호 — 채점 로직 자체의 단위 테스트 (네트워크 불필요)
pnpm --filter @joblog/api test

# 확률적 신호 — 실제 파서(LlmService)로 픽스처를 돌려 정확도 채점
pnpm --filter @joblog/api parse:eval
```

`parse:eval`은 API와 **똑같은** `LlmService`를 태운다. 프로바이더 선택도 동일한 env 규칙:

| env | 동작 |
|-----|------|
| `ANTHROPIC_API_KEY` 설정 | anthropic(claude)로 파싱 |
| `LLM_PROVIDER=ollama` + 로컬 ollama | 로컬 모델로 파싱 (무료, 네트워크 불필요) |
| 둘 다 없음 | provider=none → 채점 건너뜀(우아한 실패) |
| `PARSE_EVAL_THRESHOLD=0.8` | 통과 기준 변경 (기본 0.7) |

평균 점수가 기준 미만이면 종료코드 1 → CI·자동 루프의 실패 신호로 쓸 수 있다.

## 픽스처 추가하기 (이게 사용법의 핵심)

쌍으로 둔다. **실패했던 실제 공고를 계속 쌓는 게 품질을 올리는 길이다.**

```
fixtures/
  <name>.input.txt       # Firecrawl이 뽑았거나 붙여넣은 공고 본문 (생 텍스트)
  <name>.expected.json   # 사람이 검수한 정답 (ParsedPosting 형태)
```

`expected.json` 스키마는 `../types.ts`의 `ParsedPosting`과 같다:

```jsonc
{
  "companyName": "회사명",
  "position": "직무",
  "location": "근무지 | null",
  "employmentType": "고용형태 | null",
  "deadline": "YYYY-MM-DD | null",
  "stages": [{ "name": "서류", "order": 0 }],
  "confidence": "high | low"
}
```

## 채점 방식 (`score.ts`)

- 문자열 필드는 정규화(공백·대소문자·전각 통일) 후 비교
- `stages`는 전형 단계 이름 집합의 **Jaccard 유사도** + 순서 완전일치(`stageOrderExact`) 별도 측정
- 전형 단계가 JobLog의 급소이므로 **가중치를 3배** 준다
- 전체 점수는 필드 가중 평균

채점 로직을 바꾸면 반드시 `score.test.ts`도 함께 갱신한다.
