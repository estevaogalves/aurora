# IP real do cliente atrás de CDN ou balanceador

Os limites por IP (login, cadastro) dependem de a API saber o IP verdadeiro do cliente. A cadeia é:

```
cliente ──> [CDN / balanceador, opcional] ──> nginx (apps/web) ──> API
```

- O **nginx** é quem decide o IP do cliente (`$remote_addr`) e **sobrescreve** `X-Real-IP` e
  `X-Forwarded-For` ao falar com a API (`apps/web/nginx.conf`). `True-Client-IP` e `Forwarded` são descartados.
- A **API** lê `X-Real-IP` quando `TRUST_PROXY=true` (padrão no `docker-compose.yml`). **Nunca** ligue
  `TRUST_PROXY` se a API puder ser alcançada sem passar pelo nginx.
- Sem nenhum proxy na frente do nginx, não há nada a configurar: `$remote_addr` já é o cliente.
- **Com** CDN/balanceador na frente, `$remote_addr` seria o IP do proxy (todos os usuários com o mesmo IP: os
  limites por IP virariam globais). Aí configure `apps/web/real-ip.conf` conforme abaixo.

> Regra de ouro: só aceite o cabeçalho de IP vindo de endereços do **seu** proxy (`set_real_ip_from`) e
> bloqueie, no firewall/security group, qualquer acesso direto ao nginx que não venha do proxy. Se o nginx
> aceitar o cabeçalho de qualquer origem, o cliente o forja e escapa dos limites.

`real-ip.conf` é incluído no bloco `server` (em `apps/web/nginx.conf`). Em produção, monte o seu por volume:

```yaml
# docker-compose.override.yml (exemplo)
services:
  web:
    volumes:
      - ./deploy/real-ip.conf:/etc/nginx/snippets/real-ip.conf:ro
```

## Cloudflare

Cloudflare envia o IP do cliente em `CF-Connecting-IP`. Liste as faixas oficiais
(<https://www.cloudflare.com/ips-v4> e <https://www.cloudflare.com/ips-v6>; mude de vez em quando, mantenha
atualizado):

```nginx
real_ip_header CF-Connecting-IP;
set_real_ip_from 173.245.48.0/20;   # ...todas as faixas de ips-v4 e ips-v6
set_real_ip_from 103.21.244.0/22;
# (repita para cada faixa)
```

No firewall da origem, aceite as portas 80/443 **somente** dessas faixas.

## Balanceador/proxy genérico (ALB, Nginx/HAProxy próprio, Fly, Render, etc.)

O balanceador acrescenta o IP do cliente ao `X-Forwarded-For`. Confie só nos endereços dele e deixe o nginx
percorrer a lista de trás para frente:

```nginx
real_ip_header X-Forwarded-For;
real_ip_recursive on;
set_real_ip_from 10.0.0.0/8;        # faixa(s) de rede do SEU balanceador (ex.: sub-redes do ALB)
```

Provedores que expõem o IP em outro cabeçalho (ex.: `Fly-Client-IP`, `X-Real-IP` do próprio provedor) usam
`real_ip_header <cabeçalho>;` com o `set_real_ip_from` da rede do provedor. Consulte a documentação dele
para a faixa e o nome do cabeçalho.

## PROXY protocol (balanceador TCP, ex.: NLB, HAProxy)

```nginx
# no listen do nginx: listen 8080 proxy_protocol;
real_ip_header proxy_protocol;
set_real_ip_from 10.0.0.0/8;
```

(Exige alterar a linha `listen` de `apps/web/nginx.conf`.)

## Terminação de TLS no balanceador

O nginx do projeto escuta em HTTP. Se o TLS termina no balanceador, o cookie `Secure` continua funcionando (o
navegador fala HTTPS com o balanceador) e `COOKIE_SECURE=true` deve permanecer ligado. `X-Forwarded-Proto` não é
usado pela API hoje.

## Como conferir

1. Suba o laboratório local: `scripts/security/lab.sh up` e rode
   `node scripts/security/sec04-ip-spoof.mjs http://localhost:18080`. Com forja de `X-Real-IP` ou
   `X-Forwarded-For`, o 6º login errado do mesmo e-mail deve dar `429` (antes da correção, nunca dava).
2. No ambiente real, depois de configurar o `real-ip.conf`: faça 6 logins errados do mesmo e-mail a partir de
   duas redes diferentes. Cada rede deve ter seu próprio contador; enviar `X-Forwarded-For`/`X-Real-IP`
   forjados não pode mudar nada.
3. `curl -s -X POST …/api/v1/auth/login` e olhe o log da API: o IP registrado deve ser o seu, não o do proxy.
