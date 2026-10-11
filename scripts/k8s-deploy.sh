#!/usr/bin/env bash
# Deploys the app to whatever Kubernetes cluster kubectl currently points at (kind, minikube, Docker Desktop...).
#
#   scripts/k8s-deploy.sh
#
# CI sets BACKEND_IMAGE, FRONTEND_IMAGE and PROXY_IMAGE to the images it just built and loaded into the
# cluster, so the manifests run exactly those images instead of pulling anything.
set -euo pipefail
cd "$(dirname "$0")/.."

PREFIX="ghcr.io/nehal-kongwad/campus-connect"
rendered="$(kubectl kustomize k8s)"

swap() {   # swap <default image> <replacement or empty>
  if [ -n "${2:-}" ]; then
    rendered="$(printf '%s\n' "$rendered" | sed "s#$1#$2#g")"
  fi
}
swap "${PREFIX}-backend:latest"  "${BACKEND_IMAGE:-}"
swap "${PREFIX}-frontend:latest" "${FRONTEND_IMAGE:-}"
swap "${PREFIX}-proxy:latest"    "${PROXY_IMAGE:-}"

# Namespace first, then everything else
kubectl apply -f k8s/namespace.yaml
printf '%s\n' "$rendered" | kubectl apply -f -

# Wait until every Deployment is fully rolled out
for d in mongodb backend frontend proxy; do
  kubectl rollout status "deployment/$d" -n campus-connect --timeout=300s
done

echo
echo "Deployed. Open the site with:"
echo "  kubectl port-forward -n campus-connect svc/proxy 8080:80   ->  http://localhost:8080"
