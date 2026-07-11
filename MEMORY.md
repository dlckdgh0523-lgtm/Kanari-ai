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
- [x] npm 배포: kanari@0.2.0 (26-07-10). SDK 0.3.0(captureGlobalErrors) 코드 완료 → 창호가 npm publish 필요 /  (0.1.0은 2022년 unpublish 이력으로 영구 소진 → 0.2.0으로 우회). 외부 앱이 공개 레지스트리에서 설치해 수집까지 E2E 검증 완료
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

- [x] Phase 7-a (26-07-11): 콘솔 인증(가입/로그인 JWT 12h, bcrypt) + 프로젝트 소유권(ownerId, assertOwner 공용 검사) + 콘솔 API 전체 보호(401/403 검증) + CORS. 웹훅 설정 PATCH /projects/:id/webhook, 로그 피드 GET /projects/:id/events 추가
- [x] Phase 7-b (26-07-11): web/ Vite+React 대시보드. 디자인: 갱도(암갈색)+카나리아 노랑, 시그니처=셸 프롬프트 제목(❯ kanari groups --project N)+깜빡이는 커서, ssh 상태바. 화면: 로그인/가입, 프로젝트(키 1회 표시+웹훅 설정), 에러 인박스, 그룹 상세(해결 메모 유도), tail -f 로그 스트림(3초 폴링). frontend-design 스킬 가이드 적용. 실행: web에서 npm run dev (:5173)
- [x] 랜딩(/) → 로그인(/login) → 콘솔(/console) 흐름 + 테스트 계정 demo@kanari.dev / kanari-demo (프로젝트 1,2 소유, 데모 데이터 있음)
- [x] 합성 테스트 콘솔 화면 (26-07-11): 등록/삭제/지금 실행/run-all(배포 스모크), 상태 뱃지·방금 결과 표시. 실전 사례: 콘솔 인증 추가가 /projects를 401로 바꾼 회귀를 합성 테스트가 잡아냄
- 결정 (26-07-11): 4-b 조사 에이전트 외부 도구 채택 = GitHub 이슈 검색 API(라이브러리 내부 에러일 때 같은 이슈 링크) + 외부 서비스 상태 확인(내 코드 vs 외부 장애 판별). OSV 취약점·스택오버플로는 보류(오탐 소음), 브라우저 시각 검증(크롬 확장 미연결로 자동화 못함 - 창호 눈으로 확인)

- [x] Phase 6-b 준비 (26-07-11): Dockerfile(멀티스테이지, non-root, 이미지 로컬 검증 완료 - compose 네트워크에서 부팅+DB연결+서빙 확인), Terraform 초안(ECR/ECS Fargate api·worker·kafka/RDS/ALB, Service Connect로 내부 DNS), DEPLOY.md(순서·비용표 월 $50·트레이드오프). apply는 창호 AWS 계정 세팅 후
- 아이디어 (Phase 8 후보): 성능 워치독 - SDK가 라우트별 응답시간을 1분 집계로 전송 → 기준선 대비 지연 급증 알람. 풀 APM은 범위 밖, 느려짐 감지만 잘라서. 합성 테스트 응답시간 추이 알람도 저비용 대안

- [x] APM (26-07-11): SDK KanariMetrics 미들웨어(라우트별 60초 집계 + 분포 버킷, 1초 초과는 개별 샘플, 실제 경로 아닌 라우트 패턴으로 카디널리티 제어) → POST /ingest/metrics → 별도 Kafka 토픽(kanari.metrics.raw, 에러 처리를 안 막게 분리) → route_stats/slow_samples 저장 → 성능 워치독(p95 300ms 이상 AND 기준선 2.5배, 표본 20건 이상, 30분 쿨다운, 쿨다운은 메모리=워커 1대 트레이드오프) → 🐢 알람. 콘솔 /apm 화면(라우트 표+느린 샘플, 15초 갱신). E2E: 25건 400ms 트래픽 → 집계 p95=500ms → 워치독 1분 내 발동 확인. SDK 0.4.0 (publish는 창호)
- 경계 확정: 라우트 레벨 APM까지가 카나리. 스팬/쿼리 단위 트레이싱은 OTel 영역 (랜딩 scope 섹션 갱신됨)

- [x] 능동 진단 + 통합 UX (26-07-11):
  - 보안 점검: HTTPS/보안헤더(HSTS·CSP·X-Frame 등)/서버버전노출/CORS와일드카드/스택트레이스유출. 요청 몇 개라 안전. E2E 확인(helmet 덕에 헤더 양호, http라 HTTPS만 위험)
  - 부하 테스트: 동시요청 웨이브로 용량 측정(RPS·p95·실패율·판정). 가드레일 하드코딩(동시50·총500·10초) + DTO @Max로 이중 방어. E2E: 625RPS/p95 31ms 판정, 9999 요청은 400 거부
  - 합성 테스트 전 메서드(GET/POST/PUT/PATCH/DELETE) + 헤더/바디 지원
  - 통합 개요 화면: 건강배너 + 통계타일(열린에러/24h이벤트/체크실패/성능) + top에러 + 미니로그. GET /projects/:id/overview
  - 프로젝트 탭 내비(개요/에러/로그/성능/합성/진단)로 UX 통합. 페이지별 중복 Prompt·링크 제거
- 반대 결정 (26-07-11): 리버스 프록시(요청 경로에 카나리 끼우기)는 거부. fire-and-forget 원칙 위반(카나리 죽으면 사용자 서비스도 죽음). SDK 미들웨어가 경로 밖에서 같은 목적 달성
- 개선 과제: 부하 테스트 대상 도메인 소유 검증(현재는 경고+가드레일만)

- [x] 릴리스 추적 + 회귀 감지 (26-07-12): 금요일 배포 공포 해결 계층.
  - SDK 0.6.0: release 옵션(git SHA) -> 모든 이벤트에 실림
  - 회귀 감지: resolved 그룹이 재발하면 자동 재오픈 + regressed=true + 🔴 회귀 알람(지난번 해결메모 첨부). E2E 확인(그룹14 resolve->재발->reopened)
  - 배포 마커: POST /ingest/deploy (CI에서 curl 한 줄). 배포 후 신규에러 3+ 급증하면 ⚠️ 롤백 고려 알람(2분 유예, 30분 창)
  - 신규 에러 알람에 배포 버전 표기
  - 프론트: 회귀 뱃지(인박스/상세), 최초 배포 표기
  - examples/github-actions-deploy.yml: 배포 스모크(run-all 실패시 파이프라인 중단) + 배포 마커
- Winston 활용 점검: transport는 정석 사용. 미사용=child logger(traceId 자동주입 가이드 없음), profiling. 개선 여지로 기록
- 다음 배포안전 후보: source map 해석, suspect commits(git blame)

- [x] suspect commits + 코드 딥링크 (26-07-12): 프로젝트에 GitHub repoUrl 연결 -> 에러 스택의 첫 우리코드 프레임(file:line) 파싱 -> GitHub 정확한 줄 딥링크 + 그 파일 최근 커밋(용의자, GitHub REST commits API, 공개리포 토큰불필요). GET /groups/:id/suspect(버튼 눌렀을 때만, 그룹상세와 분리해 API 한도 관리). 정직: line-blame 아니라 file 단위 근사. E2E: 실제 Kanari-ai 리포로 src/main.ts:15 -> 딥링크 + 커밋 a85c34b 확인
- source map 해석은 보류 결정 (26-07-12): 우리는 백엔드 Node SDK. TS 소스맵이 이미 스택을 원본 .ts 위치로 보여줌 -> 백엔드에선 소스맵 해석 payoff 낮음. 압축 스택 복원은 프론트/번들 코드 문제이고, 그건 미래의 브라우저 SDK와 함께 해야 값어치. 지금 반쯤 만드는 건 과설계
- 멀티에이전트 설계 원칙 확정: 라이브러리별이 아니라 축(질문)별 분해 / 상위는 데이터보관이 아니라 판정기준+종합+반증 / 회의론자 에이전트로 검증. Phase 4-b 조사에이전트에 적용

- [x] D1 테스트 기반 시작 (26-07-12): Jest+ts-jest 도입. 순수함수 단위테스트 21개 통과(fingerprint 8, p95FromBuckets 4, source-location 9). GitHub Actions CI(build+test+sdk build) 추가 = 우리 배포게이트 철학 도그푸딩. 남음: 통합테스트(실DB ingest->group, 인증401/403, 회귀흐름), SDK 테스트
- 심화 로드맵 DEPTH.md 작성: D1 테스트+CI / D2 Redis(분산상태) / D3 Kafka심화(DLQ,멱등,컨슈머랙) / D4 카디널리티방어 / D5 Winston심화(child logger ALS,profiling,exceptionHandlers) / D6 보안전체 / D7 부채(마이그레이션,페이지네이션,health) / D8 AI에이전트. 순서=테스트로 잠근 뒤 리팩터링

## 관련 링크

- GitHub: github.com/dlckdgh0523-lgtm/Kanari-ai
- 참고 리포: github.com/dlckdgh0523-lgtm/AI- (쇼핑 컨시어지 — 재사용할 패턴: 모델 다운시프트, 인용 검증, A/B 하네스)
- 진로나침반: github.com/dlckdgh0523-lgtm/jinro-backend
- 블로그(회고 올릴 곳): blog.naver.com/moodie_lv3












