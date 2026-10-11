FROM nginx:1.27-alpine

# Pull in the latest security fixes for the operating-system packages (for example OpenSSL) that were
# released after this base image was built. The Trivy scan in CI fails the build on fixable CRITICAL findings.
RUN apk upgrade --no-cache

# The official image turns files in /etc/nginx/templates into config at start-up,
# replacing ${VARIABLES} with environment values (see docker-compose.yml and k8s/proxy.yaml).
COPY default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80
