variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "eu-north-1"
}

variable "aws_profile" {
  description = "Named AWS CLI profile to use (leave null to use the default credentials)"
  type        = string
  default     = null
}

variable "allowed_account_ids" {
  description = "Safety guard: Terraform refuses to run against any AWS account not in this list (empty = no check)"
  type        = list(string)
  default     = []
}

variable "instance_type" {
  description = "EC2 instance type. The app plus the monitoring stack (Prometheus, Grafana, Loki) needs about 1.5 GB of RAM, so 4 GB (t3.medium) is recommended. Use t3.small (2 GB, plus the swap file Ansible creates) only if the account's plan blocks larger types."
  type        = string
  default     = "t3.medium"
}

variable "ami_id" {
  description = "Ubuntu AMI for the region (AMI ids differ per region). The default is the one the original server was created from, so Terraform does not replace the instance."
  type        = string
  default     = "ami-05bfa4a7765f38076"
}

variable "key_name" {
  description = "Name of an existing EC2 key pair used to SSH in (the private key goes into the EC2_SSH_KEY GitHub secret)"
  type        = string
  default     = "fa1-key"
}

variable "root_volume_size" {
  description = "Root disk size in GB: room for Docker images, MongoDB, and Prometheus/Loki data"
  type        = number
  default     = 20
}

variable "ssh_allowed_cidr" {
  description = "IP range allowed to SSH in. 0.0.0.0/0 means the whole internet (needed so GitHub Actions can deploy); use your own IP/32 if you deploy by hand."
  type        = string
  default     = "0.0.0.0/0"
}
