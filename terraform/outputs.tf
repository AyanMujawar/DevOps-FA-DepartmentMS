output "instance_id" {
  description = "ID of the Campus Connect EC2 instance"
  value       = aws_instance.campus_connect_server.id
}

output "public_ip" {
  description = "Fixed public IP of the server - use it as the EC2_HOST secret in GitHub and in ansible/inventory.ini"
  value       = aws_eip.campus_connect_ip.public_ip
}

output "app_url" {
  description = "Where the website lives"
  value       = "http://${aws_eip.campus_connect_ip.public_ip}"
}

output "grafana_url" {
  description = "Monitoring dashboards (login admin / the GRAFANA_ADMIN_PASSWORD secret)"
  value       = "http://${aws_eip.campus_connect_ip.public_ip}:3000"
}

output "security_group_id" {
  description = "ID of the Campus Connect security group"
  value       = aws_security_group.campus_connect_sg.id
}
