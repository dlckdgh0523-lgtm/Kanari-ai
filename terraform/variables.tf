variable "region" {
  description = "AWS 리전. 서울"
  type        = string
  default     = "ap-northeast-2"
}

variable "project" {
  description = "리소스 이름 접두사"
  type        = string
  default     = "kanari"
}

variable "image_tag" {
  description = "배포할 ECR 이미지 태그"
  type        = string
  default     = "latest"
}

# 민감값들은 terraform.tfvars 파일에 넣는다 (tfvars는 절대 커밋 금지)
variable "db_password" {
  description = "RDS MySQL 비밀번호"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "콘솔 로그인 토큰 서명 키"
  type        = string
  sensitive   = true
}

variable "discord_webhook_url" {
  description = "기본 Discord 웹훅 (프로젝트별 웹훅이 없을 때 사용)"
  type        = string
  sensitive   = true
  default     = ""
}
