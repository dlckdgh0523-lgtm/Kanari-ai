# MEMORY — 파수꾼 (가칭) 프로젝트 컨텍스트

> Claude Code 세션이 바뀌어도 이 파일을 먼저 읽으면 맥락이 이어진다.
> 규칙: 결정이 바뀌면 이 파일을 즉시 갱신한다. 오래된 정보를 남기지 않는다.

## 프로젝트 한 줄

Node.js 서비스용 에러 관제 SaaS. SDK(Winston transport)로 에러를 모아 그룹핑하고, 합성 테스트로 능동 감시하고, AI가 1차 조사한 리포트와 함께 Discord/전화 알람을 보낸다. 상세는 PRD.md.

## 왜 만드는가 (배경)

- 이창호(dlckdgh0523@gmail.com)의 취업 포트폴리오 겸 실사용 도구
- 멘토 지침: 안 써본 스택 + ECS 배포 + 로그 모니터링 + 왜를 설명할 수 있어야 함
- 첫 고객 = 본인 운영 실서비스 2개: 진로나침반(jinro.it.kr, NestJS+Prisma+PG), chungaba.com(NestJS)
- 목적은 점진적 성장 증명: 배운 것(RRF 하이브리드, 모델 다운시프트, A/B 측정, 인용 검증)을 방법론으로 재사용

## 확정된 의사결정 로그

| 날짜 | 결정 | 이유 |
|---|---|---|
| 26-07-10 | 범용 SaaS로 (운영 콘솔 아님) | 제품성 + npm SDK 차별화 |
| 26-07-10 | Kafka 채택, BullMQ 안 씀 | 다중 컨슈머 독립 소비 필연성. 브로커는 1대만 |
| 26-07-10 | MySQL + TypeORM | 채용 공고 최다 조합 경험 목적 (정직한 이유로 기록) |
| 26-07-10 | Winston 채택 (Pino 아님) | transport 구조가 SDK 핵심. Pino는 이미 경험 → 비교 글 작성 예정 |
| 26-07-10 | 벡터 DB는 Qdrant | pgvector 중복 회피 + 전용 벡터 DB 경험 |
| 26-07-10 | 합성 테스트 + 전화 에스컬레이션(Solapi) 포함 | 실무자 사례: 200 떠도 장애는 핑으로 못 잡음. 전화 통당 200원 → 심각도 게이트 |
| 26-07-10 | AI 조사는 신규/급증 트리거만 | 비용 게이트. 다운시프트 + 캐싱 재사용 |
| 26-07-10 | 스코프 폭발 감수하고 전체 진행 | 단, Phase 순서 엄수 (PRD 6장) |
| 26-07-10 | 서비스 이름 카나리(kanari) 확정 | 탄광의 카나리아 = 사람보다 먼저 위험 감지. npm에 kanari 비어 있음 확인 |
| 26-07-10 | 대시보드는 터미널 감성 UI | 주 사용자가 개발자. Phase 7에서 반영 |
| 26-07-10 | 역할 조정: 초기 구현은 Claude, 창호는 코드 리딩으로 학습 | 창호가 아직 Kafka·TypeORM 미경험. 이후 수정·확장은 직접 하며 역할 회복 |

## 역할 분담 (중요 — 세션마다 지킬 것)

### 창호가 직접 한다 (Claude는 리뷰만)
- 핵심 로직 구현: fingerprint 그룹핑, 급증 탐지 규칙, Kafka 컨슈머 흐름
  - 이유: 면접에서 왜를 설명해야 하는 심장 코드. 직접 짜야 답할 수 있다
- 기술 선택의 이유를 본인 언어로 PRD/블로그에 기록
- 주차(Phase)별 회고 블로그 작성
- 계정·키 발급: AWS, Solapi, Anthropic API, npm, 도메인
- 진로나침반/chungaba에 SDK 장착 (본인 운영 서비스)
- A/B 리포트 라벨링 (정답 데이터는 사람 몫)

### Claude가 한다
- 스캐폴딩: NestJS 구조, docker-compose(Kafka/MySQL/Qdrant/Grafana), TypeORM 엔티티 초안
- 문서 초안: API 명세, 스키마, 로그 표준 문서
- 적대적 코드 리뷰, 트러블슈팅 페어
- Terraform 템플릿 초안, 테스트 코드 뼈대
- 대시보드 UI (디자인 스킬 스택: frontend-design → taste-skill → animate → playwright-mcp)

### 함께 (결정 프로세스)
- Claude가 선택지 + 트레이드오프 제시 → 창호가 결정하고 이유를 이 파일에 기록

## 컨벤션

- 커밋: Conventional Commits (feat/fix/docs/chore)
- 브랜치: main / feature-*
- 문서·이력서 문체: 존댓말, 큰따옴표 금지, 본문 볼드 강조 금지, AI 말투 금지 (대시 남용, 개념 따옴표, 기계적 병렬 리듬)
- 로그 표준: traceId 필수, PII·토큰·상담내용 금지 (Phase 0 문서 참조)
- 하나가 끝날 때마다: PRD 체크박스 갱신 + 이 파일의 현재 상태 갱신

## 현재 상태 (26-07-10)

- [x] PRD.md 작성 완료
- [x] Phase 0: kanari/ 스캐폴딩, docker-compose(MySQL+Kafka KRaft+Kafka UI), docs/logging-standard.md
- [x] Phase 1 코드: 프로젝트 등록·API 키(해시 저장) → POST /ingest → Kafka → 그룹핑 워커(fingerprint) → MySQL → 신규 그룹 Discord 알람 → 조회 API. npm install + nest build 통과
- [x] Phase 2 코드: sdk/ Winston 커스텀 transport (배치 전송, fire-and-forget, 타임아웃 3초). tsc 빌드 통과
- [x] examples/sdk-demo.js: SDK 동작 확인 시나리오 4종 (같은 에러 반복, 가변 메시지 묶임, warn 전송)
- [x] GitHub 푸시 완료: github.com/dlckdgh0523-lgtm/Kanari-ai (main)
- [ ] 실행 검증(E2E): Docker Desktop 설치 중 ← 완료되면 README 손 테스트 + sdk-demo 실행이 첫 작업
- [ ] npm 배포: 창호의 npm 계정 필요. sdk/ 에서 npm publish (패키지명 kanari)
- [ ] Phase 3: 급증 탐지 워치독 + 합성 테스트
- 창호 학습 순서: kanari/README.md의 폴더 구조 표 순서대로 (1번 fingerprint.ts부터)
- 참고 자료: 이 폴더의 카카오톡 스크린샷 11장 (RAG 아키텍처 8종, Claude 디자인 스킬 스택, 장애 알림 실무 사례, AX 지식그래프, B2B 대시보드 디자인 프롬프트)

## 관련 링크

- GitHub: github.com/dlckdgh0523-lgtm/Kanari-ai
- 참고 리포: github.com/dlckdgh0523-lgtm/AI- (쇼핑 컨시어지 — 재사용할 패턴: 모델 다운시프트, 인용 검증, A/B 하네스)
- 진로나침반: github.com/dlckdgh0523-lgtm/jinro-backend
- 블로그(회고 올릴 곳): blog.naver.com/moodie_lv3
