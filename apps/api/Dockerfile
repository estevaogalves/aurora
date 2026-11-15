# syntax=docker/dockerfile:1
# Imagens fixadas por digest (tag@sha256); o Dependabot propõe as atualizações.
FROM golang:1.27-alpine@sha256:eb61c3873c97416fff0116553fff65d67a3549f72e11d9758849a689cdd8b523 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM alpine:3.21@sha256:87a4361f6c819618a6bafa2ed5228714cb0bb22195d2b49c95eb26799990128a
RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 10001 app
USER app
COPY --from=build /out/api /usr/local/bin/api
EXPOSE 8080
ENTRYPOINT ["api"]
