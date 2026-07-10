# 카나리 (Kanari)

사람보다 먼저 장애를 감지하는 에러 관제 서비스.
옛날 광부들이 탄광에 데려간 카나리아처럼, 서비스에 위험이 차오르면 사용자 제보보다 먼저 알려준다.

## 전체 흐름

```
고객 서비스 (SDK)
    │  POST /ingest (x-kanari-key)
    ▼
인입 API ──── Kafka(kanari.events.raw) ──── 그룹핑 워커
(받아서 넣기만)                              │ 1. fingerprint 계산
                                            │ 2. 그룹 upsert (신규면 Discord 알람)
                                            │ 3. 카운트 갱신 + 원본 저장
                                            ▼
                                          MySQL
```

인입 API와 워커를 프로세스로 나눈 이유: 이벤트가 폭주해도 API는 즉시 202로 응답하고,
무거운 처리는 워커가 Kafka에서 자기 속도로 꺼내 간다. API가 죽어도 워커는 살고, 그 반대도 마찬가지다.

## 실행 순서

```bash
# 1. 인프라 켜기 (MySQL + Kafka + Kafka UI)
docker compose up -d

# 2. 환경변수
cp .env.example .env    # 필요하면 DISCORD_WEBHOOK_URL 채우기

# 3. 의존성 설치
npm install

# 4. 터미널 두 개로 실행
npm run start:api:dev   # 터미널 1: 수집/조회 API (:3000)
npm run start:worker    # 터미널 2: 그룹핑 컨슈머
```

## 손으로 테스트해 보기

```bash
# 1) 프로젝트 등록 -> 응답의 apiKey를 복사해 둔다 (다시 볼 수 없음)
curl -X POST localhost:3000/projects -H "content-type: application/json" -d "{\"name\":\"test-service\"}"

# 2) 에러 이벤트 보내기 (apiKey 교체)
curl -X POST localhost:3000/ingest -H "content-type: application/json" -H "x-kanari-key: kn_여기에키" -d "{\"events\":[{\"name\":\"TypeError\",\"message\":\"Cannot read properties of undefined (reading id)\",\"stack\":\"TypeError: Cannot read properties of undefined\\n    at UserService.find (/app/src/users/users.service.ts:42:15)\\n    at UsersController.get (/app/src/users/users.controller.ts:18:20)\"}]}"

# 3) 같은 요청을 여러 번 보내도 그룹은 1개, count만 올라가는지 확인
curl localhost:3000/projects/1/groups

# 4) 그룹 상세 (스택, traceId 포함 원본 20건)
curl localhost:3000/groups/1
```

Kafka에 실제로 메시지가 흐르는 건 http://localhost:8080 (Kafka UI)에서 눈으로 확인할 수 있다.

## 폴더 구조 (공부 순서 추천)

| 순서 | 파일 | 내용 |
|---|---|---|
| 1 | `src/grouping/fingerprint.ts` | 심장. 에러를 같은 원인끼리 묶는 지문 계산 (순수 함수) |
| 2 | `src/ingest/` | 수집 API. 왜 받기만 하고 Kafka에 넘기는지 |
| 3 | `src/worker.ts` | Kafka 컨슈머. groupId, 포이즌 메시지 주석 참고 |
| 4 | `src/grouping/grouping.service.ts` | 그룹 upsert. 동시성 경합을 unique 인덱스로 푸는 부분 |
| 5 | `src/projects/` | API 키 발급과 해시 저장 |
| 6 | `src/events/` | 대시보드용 조회 API |

## 다음 단계

PRD.md(상위 폴더)의 Phase 2부터: Winston transport SDK(npm) → 급증 탐지 → 합성 테스트 → AI 조사.
