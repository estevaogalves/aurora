> **Branch `local-sqlite`:** este checklist é da `main` (Postgres e Redis em containers, para abrir ao público). Nesta branch o banco é um arquivo SQLite e o uso previsto é pessoal, em um computador; os itens de `POSTGRES_PASSWORD`, `REDIS_PASSWORD` e a troca de senha do Postgres não se aplicam.

# Checklist de deploy — correções de segurança (SEC-01 a SEC-09, SEC-13 a SEC-19) e requisitos para abrir ao público

## Requisitos antes de abrir para clientes

As correções de segurança deixam o Aurora **pronto para um piloto controlado**, não para o público. Enquanto a lista abaixo não estiver
cumprida, **mantenha `REGISTRATION_ENABLED=false`** (cadastro fechado) ou limite o acesso a pessoas conhecidas. Os itens marcados
"jurídico" precisam de validação de advogado/encarregado; o que está escrito aqui é proposta técnica, **não** parecer legal.

Perfil de dados que a lista considera: e-mail, nome e **dados financeiros declarados pelo próprio usuário** (lançamentos, metas, observações e
anotações livres). **Não há integração bancária** (Open Finance, extratos, contas) nem cartão de pagamento: se isso mudar, esta lista deixa de valer e precisa ser refeita.

- [ ] **TLS (SEC-03).** HTTPS válido na frente do app, redirecionamento 80 → 443, `COOKIE_SECURE=true` com o cookie `Secure` visto no navegador, HSTS efetivo.
      Hoje: o nginx do projeto escuta só em HTTP; HSTS e `Secure` já estão prontos, mas só funcionam atrás de TLS. *Pronto quando:* teste de SSL (nota A) e o `curl` de cookie da seção 4.
- [ ] **Backups testados.** Backup automático do Postgres (dump agendado ou PITR do provedor), com retenção definida, criptografia e **restauração testada** num ambiente separado
      (anote o tempo: é o seu RTO; a perda máxima aceita é o seu RPO). Hoje: nenhum backup configurado, só o volume `pgdata`. O Redis não precisa de backup (só sessões e contadores).
      Backups seguem a mesma retenção de privacidade (dado apagado some também deles no prazo). *Pronto quando:* uma restauração real foi feita e conferida (login e dados de um usuário de teste).
- [ ] **RLS / isolamento entre usuários (SEC-07).** Decidir: implementar (papel de migração separado do papel da aplicação, policies por `user_id`, `FORCE ROW LEVEL SECURITY`)
      **ou** aceitar formalmente o risco mantendo só o filtro `user_id` + testes de isolamento ampliados para **todas** as entidades. Hoje: RLS ligado mas sem policies e a API é dona das tabelas
      (não protege); o isolamento depende de cada consulta ter `WHERE user_id`. *Pronto quando:* a decisão está registrada e, se implementada, os testes de isolamento passam com o papel restrito.
- [ ] **LGPD (SEC-10), proporcional a dados financeiros declarados pelo usuário** *(jurídico)*. Mínimo técnico: exclusão de conta (`DELETE /me` com reautenticação e purga em cascata),
      exportação dos dados do titular (`GET /me/export`), minimização (não coletar além de e-mail/nome/dados que o usuário digita), controle de acesso aos dados (já há), registro das operações de tratamento,
      plano de resposta a incidente (quem avisa quem e em que prazo: **prazo regulatório a confirmar com o jurídico**). Avaliar se o serviço se enquadra como agente de tratamento de pequeno porte.
      Indicar o canal e o responsável pelo atendimento de pedidos de titulares. Hoje: nada disso existe.
- [ ] **Retenção dos logs de auditoria** *(jurídico)*. Os eventos guardam IP + id do usuário. Proposta: 180 dias, depois eliminação (ou agregados sem IP/id); mesma regra para cópias e backups de log.
      A retenção por tempo é configurada **onde os logs são guardados** (o Docker só gira por tamanho). Hoje: sem retenção definida na infraestrutura. Detalhes: relatório, SEC-10.
- [ ] **Verificação de e-mail e recuperação de senha (SEC-11 e SEC-20).** Exige antes **envio de e-mail transacional** (provedor, SPF/DKIM/DMARC, remetente próprio), tokens de uso único com validade curta,
      endpoints e telas, limites contra abuso, e a resposta neutra do cadastro (que fecha o SEC-11). Hoje: não existe; quem esquece a senha perde a conta e qualquer pessoa pode cadastrar um e-mail que não é dela.
      *Pronto quando:* cadastro só vale após confirmar o e-mail, e "esqueci a senha" funciona de ponta a ponta em homologação.
- [ ] **SEC-12: `aud` e revogação de tokens.** Emitir e validar `aud` no JWT; revogar tokens de acesso quando faz sentido (logout, troca de senha, mudança de papel, conta excluída), por exemplo com
      versão de sessão por usuário ou lista de `jti` no Redis. Hoje: o token de acesso vale até 15 min depois do logout e o papel vem dentro dele. *Pronto quando:* teste mostrando que um token revogado é recusado.
- [ ] **Política de privacidade e Termos de uso** *(jurídico)*. Textos redigidos e validados (finalidade, dados tratados, bases legais, retenção, direitos do titular, contato, limitação de responsabilidade, aviso de que não é consultoria financeira),
      links visíveis no app e **aceite registrado no cadastro** (data e versão do texto). Hoje: não existem.
- [ ] **Monitoramento e teste de carga em homologação.** Monitorar: disponibilidade (`/healthz`), erros 5xx, latência, taxa de `429`/`503`, memória da API (OOM), conexões e espaço do banco, e alertas sobre os eventos de
      auditoria (`auth.refresh_reuse`, picos de `auth.login_failed`/`auth.login_blocked`). Teste de carga **só em homologação** (nunca em produção), com metas definidas (ex.: p95 e taxa de erro) e resultado guardado.
      Os scripts de `scripts/security/` só aceitam `localhost`; para homologação remota use uma ferramenta de carga (k6, vegeta) com autorização. Hoje: sem monitoramento nem alertas.
- [ ] **Aviso de não inserir dados de cartão ou documentos nos campos livres.** O app não precisa e não deve guardar esses dados. Os campos livres são: nome do lançamento, observação, anotações e nomes de categorias e metas.
      Texto proposto (validar com o jurídico): *"Não digite números de cartão, senhas, CPF, RG ou outros documentos nesses campos. O Aurora não precisa dessas informações e elas não devem ser guardadas aqui."*
      Mostrar nos formulários de lançamento e de anotação, no cadastro e na política de privacidade. Hoje: o aviso não existe no app.
- [ ] **Decisão final.** Todos os itens acima cumpridos (ou aceitos por escrito por quem responde pelo risco, com data) → apagar `REGISTRATION_ENABLED=false` do ambiente e `docker compose up -d`.

## 1. Ordem de merge

Mescle nesta ordem, uma de cada vez, rodando o CI entre elas:

1. `deps/atualizar-jspdf-router-dompurify` — jsPDF, react-router-dom, dompurify (SEC-05)
2. `security/fase-1` — SEC-01 (segredo), SEC-03 (cookie/`APP_ENV`), SEC-06 (cabeçalhos e CSP report-only)
3. `security/fase-2` — SEC-02 (limite de hash e de cadastro), SEC-04 (IP real)
4. `security/fase-3` — SEC-08 (admin por comando), SEC-09 (tetos e pool), SEC-19 (dependências de dev)
5. `security/fase-4` — SEC-13 (logs de auditoria), SEC-16 (containers e senha do Postgres), SEC-17 (CI)
6. `security/fase-5` — SEC-14 (Redis com senha), SEC-15 (CSV), SEC-18 (servidor de desenvolvimento do Vite)
7. `security/fase-6` — `REGISTRATION_ENABLED` e a lista "Requisitos antes de abrir para clientes"

Conflitos: simulei (`git merge-tree`) cada branch contra a `main` e a ordem completa: **sem conflito**. A fase 3 contém uma
cópia (cherry-pick) do commit da `deps/…`; como a mudança é idêntica, o git a reconhece como já aplicada.

Depois do merge de cada uma: `pnpm install --frozen-lockfile && pnpm lint && pnpm --filter web exec tsc -b && pnpm test && pnpm build`
e, na API, `go vet ./... && go test ./...` (com `TEST_DATABASE_URL`).

## 2. Variáveis de ambiente

### Obrigatórias (a API não inicia sem elas)
| Variável | Valor |
|---|---|
| `JWT_SECRET` | `openssl rand -hex 32`. **Sem valor padrão**; a API recusa curto, de exemplo ou de pouca variedade. Se o ambiente antigo usava o padrão do compose, o segredo está comprometido: trocar invalida as sessões (todos fazem login de novo). |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` (só letras e números: ela entra na URL). **Sem valor padrão** (o compose recusa subir sem ela). **Atenção em ambiente existente:** o Postgres só lê a senha ao criar o volume; para trocar a de um volume que já existe, siga `docs/trocar-senha-postgres.md` (sem perder dados). Se o `.env` antigo não tinha a variável, ponha a senha que o volume tem hoje (era `aurora`) para a stack subir e depois troque. Com banco externo, defina qualquer valor (o compose exige a variável). |
| `REDIS_PASSWORD` | `openssl rand -hex 24` (só letras e números). **Sem valor padrão** (o compose recusa subir sem ela). Está na `REDIS_URL` padrão do compose. Com Redis externo, defina qualquer valor aqui e ponha a senha real na `REDIS_URL` (`redis://:SENHA@host:6379/0`). Em produção a API avisa no log se a `REDIS_URL` não tiver senha. Para trocar depois: `apps/api/README.md` (seção "Senha do Redis"); desloga todos. |
| `DATABASE_URL` | já existia (sem ela, o compose monta a URL com `POSTGRES_USER/PASSWORD/DB`) |
| `APP_ENV` | `production` (padrão). Em produção, `COOKIE_SECURE=false` impede a API de iniciar. |
| `COOKIE_SECURE` | `true` (padrão). **Exige HTTPS**: com cookie `Secure` em HTTP o navegador descarta o refresh token e o usuário perde a sessão a cada recarga. |

### Recomendadas / revisar
| Variável | Padrão | Observação |
|---|---|---|
| `API_MEM_LIMIT` | `512m` | Memória real da API. Dela sai a concorrência de hashes de senha (40% ÷ 64 MiB; 512m → 3). |
| `TRUST_PROXY` | `true` no compose | Só deixe `true` se a API for alcançável **apenas** pelo nginx. Se houver CDN/balanceador na frente, configure `real-ip.conf` (veja `docs/ip-real-atras-de-proxy.md`). |
| `CORS_ORIGINS` | localhost | Domínio real, se front e API não ficarem no mesmo endereço. |
| `REGISTRATION_ENABLED` | `true` | `false` **fecha o cadastro** (`403` com mensagem clara); o login de quem já tem conta não muda. Só aceita `true`/`false` (outro valor impede a API de iniciar). Use `false` até cumprir os "Requisitos antes de abrir para clientes" (seção abaixo) ou durante um incidente; para reabrir, apague a variável e `docker compose up -d`. |
| `WEB_PORT` / `API_PORT` | `8080` / `8081` | portas publicadas no host (a API só em `127.0.0.1`). |

### Novas, opcionais (vazio = padrão)
| Variável | Padrão | Para quê |
|---|---|---|
| `HASH_MAX_CONCURRENCY` / `HASH_MAX_QUEUE` / `HASH_QUEUE_TIMEOUT` | automático / 4× / `3s` | fila de hash de senha; cheia ou estourou → `503` + `Retry-After` |
| `REGISTER_MAX_PER_IP` / `REGISTER_WINDOW` | `5` / `1h` | cadastros por IP; passou → `429` |
| `DB_MAX_CONNS` | `10` | pool da API; reduzido sozinho para caber no `max_connections` (desconta reservadas + 20%). Com N réplicas, N × valor deve caber. |
| `DB_STATEMENT_TIMEOUT` | `15s` | só no pool da API (migrations ficam sem limite). `0` desliga. **Se o pooler (modo transação, ex.: Supabase) rejeitar o parâmetro** (`unsupported startup parameter`), use `0` e defina no banco: `ALTER ROLE <usuario-da-api> SET statement_timeout='15s';` |
| `MAX_BODY_BYTES` / `MAX_IMPORT_BYTES` | `262144` / `10485760` | corpo máximo (`413`) |
| `MAX_IMPORT_ITEMS` / `MAX_MONTH_OVERRIDES` | `25000` / `600` | itens por coleção na importação / meses ajustados por despesa fixa (`400`) |
| `MAX_CUSTOM_CATEGORIES` / `MAX_DISTRIBUTION_ITEMS` | `200` / `50` | categorias na importação / itens da distribuição |

### Removida
- `ADMIN_EMAIL`: **não tem mais efeito** (a API registra um aviso se estiver definida). Apague-a do ambiente.

### Infra
- **A porta interna do web mudou de 80 para 8080** (nginx sem root). Proxy/balanceador/Ingress na frente deve apontar para a porta
  **8080** do container (no compose, `WEB_PORT` já mapeia `host:8080`). `real-ip.conf` e `listen ... proxy_protocol` também usam 8080.
- Os containers `api` e `web` agora rodam com disco somente leitura, sem capabilities e com limites (`mem_limit`, `pids_limit`).
  Se o seu orquestrador não for o compose, replique: usuário não-root, FS somente leitura com `/tmp` gravável, `cap_drop ALL`, `no-new-privileges`.
- Terminar **TLS** na frente (a stack entregue escuta em HTTP) e redirecionar 80 → 443.
- Firewall: o nginx só aceita tráfego do proxy/CDN (se houver); a API não pode ficar exposta diretamente.
- Se houver CDN/balanceador: preencher `apps/web/real-ip.conf` (monte por volume).

## 3. Antes de publicar (uma vez)
- [ ] CI: marque o job **Segurança (pnpm audit, govulncheck)** como verificação obrigatória na proteção da branch `main`
      (Settings → Branches). Ative o Dependabot (o `.github/dependabot.yml` já está no repositório).
- [ ] Backup do banco. (As correções não têm migration nova, mas faça o backup.)
- [ ] `.env` de produção com `JWT_SECRET` novo, sem `ADMIN_EMAIL`, com `APP_ENV=production` e `COOKIE_SECURE=true`.
- [ ] Quem já era admin continua admin (o papel está no banco). Para promover outra pessoa, depois do cadastro dela:
      `docker compose exec api api admin promote pessoa@dominio.com`

## 4. O que conferir logo após publicar

Troque `https://app.exemplo.com` pelo seu endereço.

**Cabeçalhos**
```sh
curl -sI https://app.exemplo.com/ | grep -i -E "content-security-policy-report-only|x-content-type|x-frame|referrer|permissions|strict-transport"
curl -si -X POST https://app.exemplo.com/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"a@a.com","password":"x"}' | grep -i -E "^HTTP|cache-control|x-content-type"
```
Esperado: os 6 cabeçalhos na página (CSP **report-only** + nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS); na API, `Cache-Control: no-store` e `nosniff`, **sem duplicatas**.
Abra o app com o console (F12) aberto: violações da CSP aparecem como avisos. Sem violações por alguns dias → trocar o nome do cabeçalho
em `apps/web/security-headers.conf` para `Content-Security-Policy`.

**Cookie seguro**
```sh
curl -si -X POST https://app.exemplo.com/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"SEU@EMAIL","password":"SUA-SENHA"}' | grep -i set-cookie
```
Esperado: `aurora_refresh=…; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Lax`. Sem `Secure` → a API não deveria ter iniciado: revise `APP_ENV`/`COOKIE_SECURE`.

**Login**
- [ ] Login com a senha certa entra; recarregar a página mantém a sessão (o cookie de refresh funciona).
- [ ] Senha errada: `401` com mensagem genérica.
- [ ] 6 senhas erradas seguidas para o **mesmo e-mail** (use um e-mail de teste): a 6ª dá `429` com `Retry-After`.

**Limite por IP (IP real chegando certo)**
- [ ] Repita as 6 tentativas enviando `-H 'X-Forwarded-For: 1.2.3.4'` e `-H 'X-Real-IP: 5.6.7.8'` com valores diferentes a cada vez: **continua** dando `429` na 6ª (forjar não escapa).
- [ ] Com CDN/balanceador: faça as tentativas de duas redes diferentes (ex.: Wi-Fi e 4G). Cada rede tem o seu contador; uma não bloqueia a outra.
- [ ] Log da API: o IP registrado/limitado é o do cliente, não o do proxy.

**Cadastro aberto/fechado (`REGISTRATION_ENABLED`)**
- [ ] Ambiente ainda **não** liberado para clientes: `REGISTRATION_ENABLED=false` e `curl -i -X POST https://app.exemplo.com/api/v1/auth/register -H 'Content-Type: application/json' -d '{"email":"a@b.com","name":"x","password":"senha-forte-123"}'` dá `403` com "O cadastro está fechado no momento…". O login de quem já tem conta continua funcionando.
- [ ] Ambiente liberado: a variável ausente (ou `true`) e o mesmo `curl` com um e-mail de teste dá `201` (apague a conta de teste depois).
- [ ] Log de inicialização sem erro `REGISTRATION_ENABLED=… inválido` (a API só aceita `true`/`false`).

**Cadastro e seu limite**
- [ ] Cadastro normal funciona e devolve `role: "user"`.
- [ ] Cadastro com o e-mail que era o `ADMIN_EMAIL` **não** vira admin.
- [ ] Limite por IP: em produção o padrão é 5/hora e cada teste cria uma conta real. Prefira **homologação**; em produção, defina
      temporariamente `REGISTER_MAX_PER_IP=1`, faça 2 cadastros (o 2º dá `429`), apague a conta de teste
      (`DELETE FROM users WHERE email='teste@…';`, as tabelas filhas caem em cascata) e volte ao valor normal.

**Containers (SEC-16)**
```sh
docker compose ps                                                     # api e web "healthy"
docker compose exec web id -u && docker compose exec api id -u        # 101 e 10001 (não-root)
docker compose exec web sh -c 'touch /etc/x' 2>&1 | head -1           # Read-only file system
docker compose exec -T postgres psql -U aurora -d aurora -tAc 'select 1'   # funciona (socket local)
```
- [ ] Postgres e Redis **sem** porta publicada no host (`docker compose ps` não mostra `0.0.0.0:5432` nem `:6379`).
- [ ] A senha antiga `aurora` é recusada (veja o passo 6 de `docs/trocar-senha-postgres.md`).
- [ ] O Redis recusa quem não tem a senha: `docker run --rm --network <pasta>_default redis:7-alpine redis-cli -h redis ping` → `NOAUTH`.
- [ ] Log de inicialização da API **sem** o aviso "REDIS_URL sem senha".

**Logs de auditoria (SEC-13)**
```sh
docker compose logs api | grep '"msg":"audit"' | tail -5
```
- [ ] Depois de um login, aparece `auth.login_success` com `user_id` e `ip` (o IP deve ser o do cliente, não o do proxy).
- [ ] Nenhum e-mail, senha, token ou nome em nenhuma linha. Faça um login de teste e confira: `docker compose logs api | grep -c 'SEU@EMAIL'` deve dar `0`.
- [ ] Alerta/rotina para `auth.refresh_reuse` (possível roubo de sessão) e para muitos `auth.login_failed`/`auth.login_blocked` do mesmo IP.

**Carga e banco**
- [ ] Log de inicialização da API: `limite de hashing` (concorrência = esperado para `API_MEM_LIMIT`) e `pool do banco`
      (`max_conns`, `servidor_max_connections`). Um `WARN ... DB_MAX_CONNS reduzido` indica que o valor pedido não cabia.
- [ ] Importação de dados do navegador funciona com um usuário real (os tetos cobrem até ~25 mil lançamentos).

**Administração**
- [ ] `docker compose exec api api admin promote seu@email` → "agora é admin"; faça login de novo e `GET /api/v1/admin/users` dá `200`.
- [ ] `… admin demote` do único admin é **recusado**.

## 5. Se algo der errado
- API não sobe: leia a mensagem — `JWT_SECRET`, `COOKIE_SECURE`/`APP_ENV` e `DATABASE_URL` são as causas mais prováveis.
- `503` em cadastro/login em horário normal: aumente `API_MEM_LIMIT` (mais hashes simultâneos) antes de mexer em `HASH_*`.
- Erro de banco `canceling statement due to statement timeout`: aumente `DB_STATEMENT_TIMEOUT` e investigue a consulta.
- Todos caindo para `429` no cadastro/login: o IP visto é o do proxy. Revise `TRUST_PROXY` e o `real-ip.conf`.
- Reverter: cada correção é um commit; `git revert <commit>` na ordem inversa.
