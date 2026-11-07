# syntax=docker/dockerfile:1
# Contexto de build: a raiz do repositório (monorepo pnpm).
FROM node:22-alpine AS build
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

FROM nginx:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
