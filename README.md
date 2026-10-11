# Department Management System

## Overview

A comprehensive web application for managing academic departments, including courses, materials, and user management with different roles (students, lecturers, and admins).

The Department Management System (DMS) is designed to streamline educational operations by providing a platform for course management, student enrollment, learning materials distribution, and administrative tasks. The application features role-based access controls, real-time updates, and a responsive user interface.

## Live Applications

- Frontend: <https://department-ms.vercel.app/>
- API: <https://departmentms-1.onrender.com/>

## Documentation

- [Frontend Documentation](https://github.com/oyerohabib/departmentMS/blob/main/frontend/README.md)
- [Backend Documentation](https://github.com/oyerohabib/departmentMS/blob/main/backend/README.md)

## Core Features

- Authentication & Authorization
- User registration and login
- JWT-based authentication
- Role-based access control (Student, Lecturer, Admin)
- Password hashing with bcrypt

## Course Management

- Create, view, update, and delete courses
- Course enrollment for students
- Course assignment for lecturers
- Course details with enrolled students

## Learning Materials

- Upload and manage course materials
- Download materials
- Organize materials by course
- User Management
- User profiles with role information
- Update user details
- View enrolled/teaching courses

## Technology Stack

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- Axios for API requests
- React Toastify for notifications

### Backend

- Express.js
- TypeScript
- MongoDB with Mongoose
- JWT for authentication
- Multer for file uploads
- CORS for cross-origin requests

## Screenshots

|                                                        |                                                   |
| :----------------------------------------------------: | :-----------------------------------------------: |
|   ![Landing Page](https://i.imgur.com/wdoVJFC.jpeg)    |  ![Login Page](https://i.imgur.com/AKhT6oN.jpeg)  |
|   ![Register Page](https://i.imgur.com/ZOpo4pU.jpeg)   |  ![Dashboard](https://i.imgur.com/d3IZkBU.jpeg)   |
| ![Course Management](https://i.imgur.com/AuH7OyJ.jpeg) | ![User Profile](https://i.imgur.com/lSh6g33.jpeg) |

## DevOps: CI/CD, Monitoring and SRE

This project is also a **DevOps project**. The application itself is deliberately unchanged; the subject being
graded is the automated path that takes a code change from a laptop to a live, monitored server.

- **FA1** (Units I-II): Git/GitHub, Docker, Docker Compose, Terraform, Ansible
- **FA2** (Units III-IV): CI/CD pipeline, automated testing, security scanning, Kubernetes, Prometheus + Grafana,
  centralized logging, SRE practices

### Syllabus topic -> where it is implemented

| Syllabus topic | What we did | Where to look |
|---|---|---|
| CI/CD pipeline (build, test, deploy loop), pipeline as code | One GitHub Actions workflow with 7 jobs | `.github/workflows/ci-cd.yml` |
| Automated build and unit testing | 58 Jest tests with mocked database, coverage gate of 85% (actual 97%) | `backend/tests/`, `backend/package.json` |
| DevSecOps | ESLint security rules and `npm audit` on every push, Trivy scan of every image | `security` and `build` jobs |
| Continuous deployment, deployment strategies | Auto-deploy to AWS on merge to `main`, smoke test and automatic rollback; Kubernetes rolling update | `deploy` job, `k8s/backend.yaml` |
| Container orchestration (Kubernetes) | Deployments, Services, ConfigMap/Secret, PVC, probes, HPA, Kustomize, tested on kind | `k8s/` |
| Infrastructure as Code | Terraform (server, firewall, fixed IP), Ansible (software, deployment) | `terraform/`, `ansible/` |
| Docker, Compose, multi-container | 4 application containers + 6 monitoring containers | `docker-compose*.yml` |
| Monitoring and observability | Prometheus metrics, Loki logs, Grafana dashboard | `monitoring/` |
| Centralized logging (ELK or similar) | Backend writes JSON logs, Promtail ships them to Loki, Grafana searches them (Loki is the lightweight alternative to ELK) | `monitoring/loki`, `monitoring/promtail` |
| SRE: SLOs/SLIs, incident management | SLO table, alert rules, runbook (below) | this README |

### The pipeline

```
 push / pull request
        |
        +-- test        ESLint + 58 unit tests (coverage gate 85%)        --+
        +-- security    eslint-plugin-security + npm audit                  |
        +-- iac-check   terraform fmt/validate, ansible, compose, k8s,      |
        |               promtool                                          --+
        |
        +-- build       build the 3 images ONCE, scan with Trivy, save them
              |
              +-- compose-test   run the images with Docker Compose + smoke test
              +-- k8s-test       run the same images on a kind cluster + smoke test
                       |
                       |   main branch only
                       v
                    deploy      push the SAME images to GHCR (tag = commit SHA),
                                Ansible deploys them to AWS EC2,
                                smoke test the live site, roll back if it fails
```

| # | Job | Fails the pipeline when |
|---|---|---|
| 1 | `test` | lint fails, a test fails, or coverage is below 85% |
| 2 | `security` | the code has a security lint error, or a dependency has a known HIGH/CRITICAL vulnerability (frontend: CRITICAL) |
| 3 | `iac-check` | Terraform, Ansible, Compose, Kubernetes or Prometheus files are invalid |
| 4 | `build` | an image does not build, or has a fixable CRITICAL vulnerability |
| 5 | `compose-test` | the stack does not become healthy, a smoke check fails, or Prometheus cannot see the backend |
| 6 | `k8s-test` | pods do not become ready, or a smoke check fails |
| 7 | `deploy` | the deploy or the live smoke test fails (then it rolls back to the previous version) |

Key ideas:

- **Build once, deploy the same thing.** The images built and scanned in `build` are the ones tested in Compose and
  Kubernetes and the ones pushed to the registry and deployed. Nothing is rebuilt along the way.
- **Fail fast.** Cheap checks (lint, tests, scans) run first and in parallel; the deploy needs all of them.
- **Main only.** Pull requests run every check but never touch the server.
- **Traceable and reversible.** Every image is tagged with the commit SHA. Rolling back means deploying an older tag.

### Architecture

```
Browser --:80--> nginx (proxy) --/--> Next.js (frontend)
                       |
                       +--/api, /uploads--> Express (backend) --> MongoDB
                                                 |  /metrics (internal only)
Prometheus <-- scrapes backend + node-exporter   |  JSON logs
Grafana :3000 <-- Prometheus, Loki <-- Promtail <-+
```

Only ports 22 (SSH), 80 (website) and 3000 (Grafana) are open on the server. The API, the frontend server, MongoDB,
Prometheus and Alertmanager are reachable only inside the Docker network. nginx never forwards `/metrics`.

Because the browser talks to one address and calls `/api`, the frontend image does not contain the server's IP, so
the same image runs on a laptop, in CI and on AWS.

### Run it locally

Needs Docker Desktop.

```bash
cp .env.example .env                                              # first time only
docker compose up --build -d                                       # the app
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up --build -d   # app + monitoring
./scripts/smoke_test.sh http://localhost                           # verify
```

| What | URL |
|---|---|
| The app | http://localhost |
| Grafana (dashboard opens by default) | http://localhost:3000 (`admin` / `admin` locally) |
| Prometheus | http://localhost:9090 |
| Alertmanager | http://localhost:9093 |

If a port is already used on your machine, set `HTTP_PORT`, `GRAFANA_PORT`, `PROMETHEUS_PORT` or
`ALERTMANAGER_PORT` in `.env`.

Create the first admin account (the API has no public admin sign-up):

```bash
docker compose exec backend node dist/utils/createAdmin.js
```

This creates `admin@campusconnect.com` with the password `password`. Log in and change it before the site is
shown to anyone, because the script's password is public in this repository.

Backend tests: `cd backend && npm ci && npm test`. Kubernetes (needs `kind`): `kind create cluster`, load the
images with `kind load docker-image`, then `scripts/k8s-deploy.sh`.

### Deploy to AWS

1. `cd terraform && terraform init && terraform plan` (review) then `terraform apply`. This keeps the existing
   server's resources and adds a fixed Elastic IP, a bigger disk and a tighter firewall. `terraform output` prints
   the IP and URLs.
2. Add the repository secrets (Settings -> Secrets and variables -> Actions) and create an environment named
   `production` (a required reviewer can be added there for manual approval).
3. Merge to `main`. The pipeline deploys by itself.

| Secret | Value |
|---|---|
| `EC2_HOST` | The Elastic IP from `terraform output public_ip` |
| `EC2_SSH_KEY` | Contents of the private key for the EC2 key pair (`fa1-key`) |
| `JWT_SECRET` | A long random string (the backend refuses a weak one in production) |
| `GRAFANA_ADMIN_PASSWORD` | A strong password |

Until `EC2_HOST` is set, the deploy job still publishes the images but skips the server steps, so the pipeline
stays green. Manual deploy:

```bash
export JWT_SECRET=... GRAFANA_ADMIN_PASSWORD=...
cd ansible && ansible-playbook -i inventory.ini deploy.yml -e image_tag=<commit-sha>
```

### Monitoring and logging

**Metrics (Prometheus).** The backend exposes `/metrics` using `prom-client`:
`http_requests_total{method, endpoint, status}`, `http_request_duration_seconds`, and business counters for logins
(by outcome), registrations and course enrollments. Prometheus scrapes the backend and node-exporter (server CPU
and memory) every 15 seconds. The `endpoint` label is the route template (`/api/courses/:id`), not the concrete
id, to keep the number of series small.

**Dashboard (Grafana).** Provisioned from files, no clicking needed. It shows the golden signals (requests per
second, error rate, p95 latency, services up), logins and enrollments, server CPU and memory, and live backend
logs.

**Logs (Loki).** One JSON log line per request (method, path, status, duration, request id). Promtail reads every
container's logs and ships them to Loki; Grafana's logs panel searches them.

**Health endpoints.** `/api/health` (liveness: is the process up, no database check) and `/api/ready`
(readiness: can it reach MongoDB, 503 if not). They are separate so a database outage stops traffic without
restarting healthy API containers.

**Alerts** (`monitoring/prometheus/alerts.yml`):

| Alert | Fires when | Why it matters |
|---|---|---|
| ServiceDown | a monitored service stops answering for 1 min | outage |
| HighErrorRate | more than 5% of requests are 5xx for 2 min | users see errors (SLO 1) |
| HighLatency | p95 latency above 500 ms for 5 min | the site is slow (SLO 2) |
| LoginFailureSpike | more than 1 failed login per second for 5 min | possible password guessing |
| HighMemoryUsage | server memory above 90% for 5 min | the server is close to running out of memory |

Try it (good for the demo):

```bash
docker compose stop backend      # break the app
# about 1.5 minutes later ServiceDown fires in Alertmanager (http://localhost:9093)
docker compose start backend     # fix it, the alert clears
```

### Site Reliability Engineering

**SLI** = something we measure. **SLO** = the target we promise. **Error budget** = how much failure the SLO allows.

| SLO | SLI (what we measure) | Target | Error budget (30 days) | Alert |
|---|---|---|---|---|
| Availability | share of requests that are not 5xx | 99.5% | about 3.6 hours | HighErrorRate, ServiceDown |
| Latency | share of requests faster than 500 ms | 95% | 5% of requests may be slower | HighLatency |

If the error budget is used up, new features stop and reliability work comes first.

**Incident runbook** (what to do when an alert fires):

1. **Acknowledge.** Open the Grafana dashboard and see which signal is bad (errors, latency, down).
2. **Check.** SSH to the server and run `docker compose ps`. Is a container down or restarting? Read the backend
   logs panel in Grafana or `docker compose logs backend`.
3. **Common causes.**
   - MongoDB down: `/api/ready` returns 503. Restart it with `docker compose restart mongodb`.
   - Server out of memory: check the memory panel, restart containers, consider a larger instance type
     (`instance_type` in Terraform).
   - Bad deploy: redeploy the previous image tag with Ansible (`-e image_tag=<old-sha>`). The pipeline does this
     by itself when the live smoke test fails.
4. **Recover and verify.** Run `./scripts/smoke_test.sh http://<server-ip>`.
5. **Write a post-mortem** within two days, blameless (about the system, not the person).

### Security measures

Passwords are hashed with bcrypt; login tokens are JWTs with a role check on protected routes; the backend refuses
to start in production without a strong `JWT_SECRET`; containers run as a non-root user; secrets come from GitHub
Secrets and are written to a private `.env` on the server by Ansible, never committed; code, dependency and image
scanning run in CI; the instance requires IMDSv2; only ports 22, 80 and 3000 are open.

### Known limits

- Uploaded course materials are stored on a Docker volume on one server (and an `emptyDir` in the Kubernetes demo),
  so they are not shared between several backend pods.
- The frontend has one dependency finding inside Next.js (PostCSS) that only a major upgrade (Next 16) fixes, so
  the frontend dependency scan fails on CRITICAL only.
- No HTTPS (plain HTTP on the server's IP). A domain with a certificate would be the next step.
- The Kubernetes autoscaler needs the metrics-server add-on, which a plain kind cluster does not have.
- The live site runs on Docker Compose; Kubernetes is proven on a temporary cluster in every pipeline run.
- Alertmanager shows alerts in its web UI only; no Slack or e-mail receiver is configured.

## Future Development Roadmap

### Enhanced Admin Controls

- Comprehensive user management system
- Bulk actions for courses and users
- Analytics dashboard for administrators
- User activity monitoring
- System-wide announcements

### Academic Structure

- Integration of academic levels (100L, 200L, etc.)
- Semester/session-based course organization
- Prerequisite course relationships
- Academic calendar integration
- Course credit system

### Technical Improvements

- Improved landing page with feature highlights
- Swagger documentation for the API
- Social authentication (Google, Facebook)
- WebSocket integration for real-time notifications
- Mobile application development
- API rate limiting and caching

### Student Experience

- Class scheduling and timetable generation
- Calendar integration
- Exam and assignment submission portals
- Grade management system
- Student performance analytics
- Discussion forums for courses

### Lecturer Features

- Attendance tracking
- Grading tools
- Automated notification system for upcoming classes
- Integration with video conferencing for virtual classes
- Course material version control
- Assignment creation and management

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the [MIT LICENSE](LICENSE).
