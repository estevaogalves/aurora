# Scripts de teste de segurança — USO SOMENTE LOCAL

Provas reproduzíveis das correções de SEC-02 (esgotamento de memória por hash de senha) e SEC-04 (IP forjado
contornando o limite de login). Eles **atacam de propósito** o alvo que você indicar.

> **Aviso.** Rode apenas na sua máquina, contra o laboratório descartável abaixo. Os scripts `.mjs` recusam
> qualquer endereço que não seja `localhost`/loopback (`local-only.mjs`) e não há opção para desligar essa
> trava. Nunca os aponte para produção, homologação compartilhada ou sistemas de terceiros.

## Laboratório

Requer Docker e Node. Sobe Postgres, Redis, API e nginx numa rede própria (`aurora-lab`), com banco vazio e
segredo aleatório, publicado só em `127.0.0.1:18080`. Não toca no `docker compose` do projeto nem nos seus dados.

```sh
scripts/security/lab.sh up [VAR=valor ...]   # VAR=valor vão para o ambiente da API
scripts/security/lab.sh down                 # remove tudo
```

Variáveis do laboratório: `LAB_API_MEM` (padrão `512m`), `LAB_PORT` (padrão `18080`).

## SEC-02 — rajada de cadastros

```sh
# sem o limite de cadastro por IP, para exercitar só o limite de hashes:
scripts/security/lab.sh up REGISTER_MAX_PER_IP=100000
node scripts/security/sec02-hash-flood.mjs http://localhost:18080 200
```

Esperado: só `201` e `503` (com `Retry-After`), API de pé (sonda `401`), sem `OOMKilled`
(`docker inspect -f '{{.State.OOMKilled}}' lab-api` → `false`). Sem a correção: `502` em tudo e `OOMKilled=true`.

Com os padrões (`scripts/security/lab.sh up`), o mesmo teste mostra o limite por IP: `201` ×5 e `429` ×25.

## SEC-04 — IP forjado

```sh
scripts/security/lab.sh up
node scripts/security/sec04-ip-spoof.mjs http://localhost:18080
```

Esperado: nos 4 cenários (sem forja, `X-Real-IP`, `X-Forwarded-For`, `True-Client-IP`) o 6º login errado do mesmo
e-mail dá `429`. Sem a correção e com `TRUST_PROXY=true`, os cenários forjados nunca bloqueavam.
Se for atrás de CDN/balanceador, veja `docs/ip-real-atras-de-proxy.md`.

Código de saída: `0` = correção comprovada; `1` = falhou; `2` = alvo recusado (não local).
