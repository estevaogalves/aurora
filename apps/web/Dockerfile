# syntax=docker/dockerfile:1
# Contexto de build: a raiz do repositório (monorepo pnpm).
# Imagens fixadas por digest (tag@sha256); o Dependabot propõe as atualizações.
FROM node:22-alpine@sha256:0e1754758c2df4cfa3e68d59e2e1b7374bb7fd9ea6328eaaacf15cc934af8202 AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/api-types/package.json packages/api-types/
RUN pnpm install --frozen-lockfile
COPY packages/api-types packages/api-types
COPY apps/web apps/web
# a imagem do compose liga o front à API; para a versão só local: --build-arg VITE_DATA_SOURCE=local
ARG VITE_DATA_SOURCE=api
ENV VITE_DATA_SOURCE=$VITE_DATA_SOURCE
RUN pnpm --filter web build

# nginx SEM root (uid 101): escuta em 8080 e só escreve em /tmp
FROM nginxinc/nginx-unprivileged:alpine@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY apps/web/real-ip.conf /etc/nginx/snippets/real-ip.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
