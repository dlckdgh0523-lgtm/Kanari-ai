# 카나리 ECS 배포 가이드 (Phase 6-b)

로컬 거실에 있던 가게를 세상에 내놓는 단계. 끝나면 어떤 서비스든 카나리를 붙일 수 있다.

## 구성

```
인터넷 ── ALB(:80) ── ECS Fargate: api (롤링 배포, 헬스체크 /metrics)
                      ECS Fargate: worker (그룹핑/워치독)
                      ECS Fargate: kafka (브로커 1대, 내부 DNS "kafka")
                      RDS MySQL (관리형)
프론트(web/)는 Vercel로 별도 배포 (jinro에서 해본 방식 그대로)
```

## 준비물 (창호가 하는 것)

1. AWS 계정 + IAM 사용자 (AdministratorAccess, 액세스 키 발급)
2. AWS CLI 설치 후 `aws configure` (리전: ap-northeast-2)
3. Terraform 설치: `winget install Hashicorp.Terraform`

## 배포 순서

```bash
cd terraform

# 1. 민감값 파일 작성 (터미널에서 직접. 이 파일은 커밋 금지 - gitignore 처리됨)
#    terraform.tfvars:
#      db_password        = "강한비밀번호"
#      jwt_secret         = "긴랜덤문자열"
#      discord_webhook_url = "https://discord.com/api/webhooks/..."

# 2. 인프라 생성 (ECR, ECS, RDS, ALB 등. 약 10분)
terraform init
terraform apply

# 3. 이미지 빌드 & 푸시 (출력된 ecr_url 사용)
aws ecr get-login-password | docker login --username AWS --password-stdin <ecr_url의 호스트부분>
docker build -t <ecr_url>:latest .
docker push <ecr_url>:latest

# 4. 서비스 재시작 (새 이미지 반영)
aws ecs update-service --cluster kanari --service api --force-new-deployment
aws ecs update-service --cluster kanari --service worker --force-new-deployment

# 5. 확인
curl http://<alb_url>/metrics
```

## 예상 비용 (서울 리전, 월 기준 대략)

| 항목 | 비용 |
|---|---|
| Fargate 3태스크 (api/worker 0.25vCPU + kafka 0.5vCPU) | 약 $30 |
| ALB | 약 $18 |
| RDS db.t4g.micro | 프리티어 12개월 무료, 이후 약 $12 |
| ECR/CloudWatch | $1 미만 |
| 합계 | 약 $50/월 (프리티어 기간엔 $48) |

비용을 줄이려면: 시연 기간에만 켜고 `terraform destroy`로 내리기.
포트폴리오 목적이면 배포 검증(무중단 수치 확보) 후 내려도 충분하다.

## 기록해 둘 트레이드오프 (면접 답변)

- Kafka를 Fargate 컨테이너로: 재시작 시 미소비 메시지 유실 가능 → 워커가 초 단위로
  소비하므로 감수. 관리형 MSK는 월 $70+로 규모 대비 과함
- 시크릿을 태스크 env로: 정석은 SSM Parameter Store 참조 → 다음 개선 과제
- 기본 VPC 사용: VPC 설계는 이 프로젝트의 학습 목표가 아님. NAT 비용 회피를 위해
  퍼블릭 서브넷 + 보안그룹으로 제어

## 배포 후 할 일

1. 무중단 검증: 배포 중 autocannon으로 부하 걸고 5xx 0건 측정 (이력서 수치)
2. 도메인 + HTTPS (Route53 or 가비아, ALB에 ACM 인증서)
3. web/의 VITE_API_URL을 ALB 주소로 바꿔 Vercel 배포
4. 진로나침반·chungaba에 SDK 실장착
