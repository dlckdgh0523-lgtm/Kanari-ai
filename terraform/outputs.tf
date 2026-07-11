output "alb_url" {
  description = "배포 후 카나리 API 주소"
  value       = "http://${aws_lb.main.dns_name}"
}

output "ecr_url" {
  description = "이미지를 푸시할 ECR 주소"
  value       = aws_ecr_repository.api.repository_url
}

output "rds_endpoint" {
  value = aws_db_instance.mysql.address
}
