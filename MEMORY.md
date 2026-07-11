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
- [x] 실행 검증(E2E) 통과 (26-07-10): 같은 에러 2회 → 그룹 1개 count 2 / 주문번호 다른 메시지 → 정규화로 같은 그룹 / SDK 데모(행 번호 달라도 같은 그룹, 기존 그룹 합류 count 2→4, warn 전송) / 잘못된 키 401
- 트러블슈팅 기록: ① apache/kafka 이미지는 리스너에 0.0.0.0을 쓰면 기동 거부 → 호스트 생략형(//:포트)으로 해결 ② 토픽 없이 구독하면 UNKNOWN_TOPIC_OR_PARTITION 크래시 → 워커 시작 시 admin으로 명시적 생성 (블로그 글감)
- [x] Discord 웹훅 연결 완료. 채팅에 URL이 노출됐으므로 프로젝트 마무리 시점에 재발급 권장
- [x] npm 배포 완료 (26-07-10): kanari@0.2.0 (0.1.0은 2022년 unpublish 이력으로 영구 소진 → 0.2.0으로 우회). 외부 앱이 공개 레지스트리에서 설치해 수집까지 E2E 검증 완료
- [x] Phase 3 완료 (26-07-10): 워치독(1분 주기) 급증 탐지 = 최근 5분 10건 이상 AND 기준선 3배, 30분 쿨다운 / 합성 테스트 = 등록 URL 주기 호출, 연속 2회 실패 시 알람, 회복 알림, run-all(배포 스모크 API) / 알람 4종(신규·급증·실패·회복) Discord 발송 검증 완료
- [ ] Phase 3 미검증 항목: 회복(🟢) 알림은 로직만 있고 E2E 미확인 (jinro 장착 후 자연 검증 예정)
- [x] Phase 3.5 보안+셀프 모니터링 (26-07-10): helmet / 바디 256kb 제한 / IP당 분당 120회 레이트리밋 / 전역 예외 필터(500 스택 비노출, express 4xx 구분) / 셀프 프로젝트(kanari-self)로 자기 에러 수집(루프 가드: /ingest 경로 제외). E2E: 413·429·헤더·Kafka 중단 시 클린 500 확인. 한계 기록: 인프라 전체 장애는 셀프 보고도 죽음 → 합성테스트+Grafana 영역
- 결정: GitHub 범용 코드 리뷰 기능은 안 만든다 (별개 제품, 타깃 불일치). 대신 Phase 4 조사 에이전트가 연결된 저장소에서 topFrame 위치의 코드를 가져와 원인 분석에 사용 + 알람에 GitHub 파일 링크
- npm publish는 403 (2FA 필요) → 창호가 npmjs.com에서 2FA 활성화 후 재시도
- [x] Phase 4-a (26-07-10): 해결 메모(resolve + note = 지식베이스 씨앗) + 유사 장애 검색 v1(키워드 점수: 같은 에러명 +3, 같은 위치 +4, 단어 겹침 최대 +4, 임계 4점, 최대 2건) → 신규 에러 알람에 과거 해결 메모 첨부. Qdrant 컨테이너 추가(v1.13.4, :6333). E2E: 그룹 #10 알람에 #1 메모 첨부 확인
- 트러블슈팅 추가: Git Bash curl은 한글을 CP949로 보내 저장이 깨짐 → 서버는 정상(node fetch UTF-8 왕복 검증). 한글 테스트는 node fetch로
- [ ] Phase 4-b: Qdrant 벡터 검색 결합 + AI 조사 에이전트(GitHub 코드 컨텍스트) ← 키는 마무리 단계에 (창호 확인)
- [x] Phase 6-a 관측 스택 (26-07-11): 카나리 자신도 Winston 사용(도그푸딩, nest-winston으로 전체 로거 교체) → 콘솔 + Loki(winston-loki, 라벨 app=kanari-api/worker). prom-client 메트릭(/metrics: 요청 수·소요시간 히스토그램, 라우트 패턴 라벨로 카디널리티 방지). Prometheus 15초 스크레이프(타깃 up 확인), Grafana(:3001, admin/kanari-dev) 데이터소스 프로비저닝. E2E: 메트릭 카운터 증가, Loki 양쪽 앱 로그 수신, Grafana healthy 확인
- 결정 (26-07-11): Voyage 임베딩은 키워드 검색이 놓치는 사례가 쌓이면 평가셋 만들어 측정 후 도입. Neo4j는 불필요(에러 간 구조적 참조 없음, Phase 8 아이디어로만)
- Phase 7 요구사항 (창호): 회원가입 → 키 발급 → 대시보드 웹 콘솔. 로그 뷰는 터미널/SSH 감성. 디자인 스킬 스택(frontend-design, taste-skill, animate, playwright-mcp) 활용 희망 — 세션에 미설치라 시작 시 설치 또는 내장 도구로 대체 결정 필요
- 창호 학습 순서: kanari/README.md의 폴더 구조 표 순서대로 (1번 fingerprint.ts부터)
- 참고 자료: 상위 폴더의 카카오톡 스크린샷 11장 (RAG 아키텍처 8종, Claude 디자인 스킬 스택, 장애 알림 실무 사례, AX 지식그래프, B2B 대시보드 디자인 프롬프트)
- 로컬 경로 변경됨: C:\Users\mszza\Desktop\창호\kanari\kanari (구 새 폴더\kanari)

## 관련 링크

- GitHub: github.com/dlckdgh0523-lgtm/Kanari-ai
- 참고 리포: github.com/dlckdgh0523-lgtm/AI- (쇼핑 컨시어지 — 재사용할 패턴: 모델 다운시프트, 인용 검증, A/B 하네스)
- 진로나침반: github.com/dlckdgh0523-lgtm/jinro-backend
- 블로그(회고 올릴 곳): blog.naver.com/moodie_lv3





