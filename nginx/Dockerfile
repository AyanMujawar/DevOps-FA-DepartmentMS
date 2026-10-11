FROM nginx:1.27-alpine

# The official image turns files in /etc/nginx/templates into config at start-up,
# replacing ${VARIABLES} with environment values (see docker-compose.yml and k8s/proxy.yaml).
COPY default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80
