# ============================================================
# 카나리 ECS 배포 (Phase 6-b 초안)
#
# 구성: ECR ← 이미지 푸시
#       ECS Fargate 클러스터
#         ├─ api 서비스 (ALB 뒤, 롤링 배포)
#         ├─ worker 서비스 (내부 전용)
#         └─ kafka 서비스 (브로커 1대, Service Connect로 내부 DNS "kafka")
#       RDS MySQL (관리형 - 데이터는 잃으면 안 되니까)
#
# 트레이드오프 기록:
# - Kafka를 Fargate에 띄우면 재시작 시 브로커에 남아있던 미소비 메시지가
#   사라질 수 있다. 이벤트는 워커가 초 단위로 소비하므로 MVP에서는 감수한다.
#   (대안인 관리형 MSK는 월 $70+로 포트폴리오 규모에 과함)
# - 시크릿을 태스크 환경변수로 넣는다. 실무 정석은 SSM Parameter Store
#   참조인데, 이건 다음 개선으로 남긴다 (면접 답변 포인트)
# ============================================================

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

# 기본 VPC를 쓴다. VPC 설계는 이 프로젝트의 학습 목표가 아니다
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# ---------- ECR ----------
resource "aws_ecr_repository" "api" {
  name         = "${var.project}-api"
  force_delete = true
}

# ---------- 로그 ----------
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${var.project}"
  retention_in_days = 14
}

# ---------- 보안 그룹 ----------
# ALB: 인터넷에서 80 허용 (HTTPS는 도메인 붙일 때 443 추가)
resource "aws_security_group" "alb" {
  name   = "${var.project}-alb"
  vpc_id = data.aws_vpc.default.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# 서비스: ALB에서 오는 3000만, 그리고 서로(카프카 19092, MySQL 3306) 통신 허용
resource "aws_security_group" "service" {
  name   = "${var.project}-service"
  vpc_id = data.aws_vpc.default.id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  # 같은 보안그룹 안(서비스끼리)은 전부 허용 - kafka, service connect
  ingress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"
    self      = true
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ---------- RDS (MySQL) ----------
resource "aws_db_instance" "mysql" {
  identifier        = "${var.project}-db"
  engine            = "mysql"
  engine_version    = "8.0"
  instance_class    = "db.t4g.micro" # 프리티어 대상
  allocated_storage = 20
  db_name           = "kanari"
  username          = "kanari"
  password          = var.db_password

  vpc_security_group_ids = [aws_security_group.service.id]
  skip_final_snapshot    = true # 포트폴리오용. 실서비스라면 false + 백업 설정
}

# ---------- ECS ----------
resource "aws_ecs_cluster" "main" {
  name = var.project
}

# 서비스끼리 이름으로 찾게 해주는 내부 DNS (worker가 "kafka:19092"로 접속)
resource "aws_service_discovery_http_namespace" "main" {
  name = var.project
}

resource "aws_iam_role" "execution" {
  name = "${var.project}-ecs-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

locals {
  app_env = [
    { name = "DB_HOST", value = aws_db_instance.mysql.address },
    { name = "DB_PORT", value = "3306" },
    { name = "DB_USER", value = "kanari" },
    { name = "DB_PASSWORD", value = var.db_password },
    { name = "DB_NAME", value = "kanari" },
    { name = "KAFKA_BROKER", value = "kafka:19092" },
    { name = "JWT_SECRET", value = var.jwt_secret },
    { name = "DISCORD_WEBHOOK_URL", value = var.discord_webhook_url },
  ]
}

# ----- API 태스크/서비스 -----
resource "aws_ecs_task_definition" "api" {
  family                   = "${var.project}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.execution.arn

  container_definitions = jsonencode([{
    name         = "api"
    image        = "${aws_ecr_repository.api.repository_url}:${var.image_tag}"
    portMappings = [{ containerPort = 3000 }]
    environment  = local.app_env
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.ecs.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "api"
      }
    }
  }])
}

resource "aws_ecs_service" "api" {
  name            = "api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.service.id]
    assign_public_ip = true # 기본 VPC 퍼블릭 서브넷. NAT 비용 회피
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }

  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn
  }

  # 무중단 롤링: 새 태스크가 헬스체크를 통과해야 이전 태스크를 내린다
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
}

# ----- 워커 태스크/서비스 (ALB 없음) -----
resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.project}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.execution.arn

  container_definitions = jsonencode([{
    name        = "worker"
    image       = "${aws_ecr_repository.api.repository_url}:${var.image_tag}"
    command     = ["node", "dist/worker.js"]
    environment = local.app_env
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.ecs.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "worker"
      }
    }
  }])
}

resource "aws_ecs_service" "worker" {
  name            = "worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.service.id]
    assign_public_ip = true
  }

  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn
  }
}

# ----- Kafka 태스크/서비스 (브로커 1대) -----
resource "aws_ecs_task_definition" "kafka" {
  family                   = "${var.project}-kafka"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.execution.arn

  container_definitions = jsonencode([{
    name         = "kafka"
    image        = "apache/kafka:3.9.0"
    portMappings = [{ containerPort = 19092, name = "kafka" }]
    environment = [
      { name = "KAFKA_NODE_ID", value = "1" },
      { name = "KAFKA_PROCESS_ROLES", value = "broker,controller" },
      { name = "KAFKA_CONTROLLER_QUORUM_VOTERS", value = "1@localhost:9093" },
      { name = "KAFKA_LISTENERS", value = "PLAINTEXT://:19092,CONTROLLER://:9093" },
      { name = "KAFKA_ADVERTISED_LISTENERS", value = "PLAINTEXT://kafka:19092" },
      { name = "KAFKA_LISTENER_SECURITY_PROTOCOL_MAP", value = "PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT" },
      { name = "KAFKA_CONTROLLER_LISTENER_NAMES", value = "CONTROLLER" },
      { name = "KAFKA_INTER_BROKER_LISTENER_NAME", value = "PLAINTEXT" },
      { name = "KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR", value = "1" },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.ecs.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "kafka"
      }
    }
  }])
}

resource "aws_ecs_service" "kafka" {
  name            = "kafka"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.kafka.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.service.id]
    assign_public_ip = true
  }

  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn
    service {
      port_name      = "kafka"
      discovery_name = "kafka"
      client_alias {
        port     = 19092
        dns_name = "kafka"
      }
    }
  }
}

# ---------- ALB ----------
resource "aws_lb" "main" {
  name               = var.project
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = data.aws_subnets.default.ids
}

resource "aws_lb_target_group" "api" {
  name        = "${var.project}-api"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "ip"

  # 헬스체크: /metrics는 인증 없이 200을 준다. 무중단 배포의 판정 기준
  health_check {
    path                = "/metrics"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 15
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}
