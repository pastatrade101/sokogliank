# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS build
WORKDIR /app

ENV CI=true
ARG REACT_APP_PREMIUM_CHECKOUT_URL=""
ENV REACT_APP_PREMIUM_CHECKOUT_URL=${REACT_APP_PREMIUM_CHECKOUT_URL}

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
WORKDIR /usr/share/nginx/html

COPY --from=build /app/build ./
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
