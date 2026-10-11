terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  required_version = ">= 1.6.0"
}

provider "aws" {
  region              = var.aws_region
  profile             = var.aws_profile
  allowed_account_ids = length(var.allowed_account_ids) > 0 ? var.allowed_account_ids : null
}

# Get the default VPC
data "aws_vpc" "default" {
  default = true
}

# Opens only the ports we need:
#   22   SSH (Ansible and GitHub Actions deploy through it)
#   80   the website (nginx)
#   3000 Grafana dashboards
# The API port (4000) is NOT open any more - users reach it through nginx on port 80.
# Prometheus (9090) and Alertmanager (9093) stay private too; reach them with an SSH tunnel.
resource "aws_security_group" "campus_connect_sg" {
  name        = "campus-connect-terraform-sg"
  description = "Security group for Campus Connect DevOps server"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_allowed_cidr]
  }

  ingress {
    description = "Website"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Grafana dashboards"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "campus-connect-terraform-sg"
  }
}

# The virtual machine that runs the Docker containers
resource "aws_instance" "campus_connect_server" {
  ami           = var.ami_id
  instance_type = var.instance_type
  key_name      = var.key_name

  vpc_security_group_ids = [aws_security_group.campus_connect_sg.id]

  # Room for Docker images, the database, and Prometheus/Loki data
  root_block_device {
    volume_size = var.root_volume_size
    volume_type = "gp3"
  }

  # Require IMDSv2 (session tokens) for the instance metadata service
  metadata_options {
    http_tokens = "required"
  }

  tags = {
    Name = "campus-connect-terraform-server"
  }
}

# An Elastic IP is a fixed public address. Without it the IP changes every time the instance is
# stopped and started, which would break the CI/CD pipeline's deploy target (the EC2_HOST secret).
resource "aws_eip" "campus_connect_ip" {
  instance = aws_instance.campus_connect_server.id
  domain   = "vpc"

  tags = {
    Name = "campus-connect-ip"
  }
}
