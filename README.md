# Sokogliank Web App

React single-page application with Firebase integration.

## Prerequisites

- Node.js 22+
- npm 10+
- Docker 24+ (for containerized production deployment)

## Local Development

```bash
npm ci
npm start
```

App runs at `http://localhost:3000`.

## Production Build (Without Docker)

```bash
npm ci
npm run build
```

The optimized static output is generated in `build/`.

## Docker Production Setup

### Build image

```bash
docker build -t sokogliank:latest .
```

Or with npm script:

```bash
npm run docker:build
```

### Run container

```bash
docker run --rm -p 8080:8080 sokogliank:latest
```

Or with npm script:

```bash
npm run docker:run
```

App is served at `http://localhost:8080`.

### Docker Compose

```bash
npm run docker:up
npm run docker:down
```

## Build-time Environment Variables

This app uses Create React App, so `REACT_APP_*` values are embedded at build time.

Current supported override:

- `REACT_APP_PREMIUM_CHECKOUT_URL`

Example build:

```bash
docker build \
  --build-arg REACT_APP_PREMIUM_CHECKOUT_URL="https://your-endpoint" \
  -t sokogliank:latest .
```

For Compose:

```bash
REACT_APP_PREMIUM_CHECKOUT_URL="https://your-endpoint" npm run docker:up
```

## Production Readiness Included

- Multi-stage Docker build (small runtime image)
- Unprivileged Nginx runtime on port `8080`
- SPA route fallback (`try_files ... /index.html`)
- PWA installability via manifest + service worker
- Offline app shell support for previously visited routes and static assets
- Static asset caching for `/static/*`
- Security response headers
- Gzip compression
- Health endpoint at `/healthz`
- Container healthcheck configured
