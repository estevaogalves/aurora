# Trocar a senha do Postgres num volume que já existe (sem perder dados)

O Postgres só lê `POSTGRES_PASSWORD` quando **cria** o volume (primeira subida). Depois disso, mudar a variável no `.env`
não muda a senha que está gravada no banco: a API passaria a usar uma senha que o banco não conhece e não conectaria.
Por isso a troca é feita **no banco primeiro**, e só depois no `.env`. Os dados do volume não são tocados.

> Este procedimento foi executado e verificado numa stack de teste com dados: login do usuário cadastrado continuou funcionando,
> a senha antiga passou a ser recusada e a nova aceita.

## Quando usar
- Seu volume foi criado antes desta mudança, com a senha antiga `aurora` (o padrão que existia). **Troque.**
- Qualquer suspeita de vazamento da senha atual, ou rotação periódica.

## Se o seu `.env` ainda não tem `POSTGRES_PASSWORD`
O compose agora exige a variável. Para a stack subir enquanto você faz a troca, use a senha que o volume tem hoje
(a antiga era `aurora`): `POSTGRES_PASSWORD=aurora` no `.env`. Em seguida faça os passos abaixo.

## Passo a passo

1. **Faça um backup** (a troca não apaga nada, mas é boa prática):
   ```sh
   docker compose exec -T postgres pg_dump -U aurora aurora > backup-aurora.sql
   ```

2. **Gere a senha nova.** Só letras e números (ela vai dentro da `DATABASE_URL`; caracteres como `@`, `:` ou `/` quebrariam a URL):
   ```sh
   NEW=$(openssl rand -hex 24)
   ```
   (Sem `openssl`: `node -e 'console.log(require("crypto").randomBytes(24).toString("hex"))'`.)

3. **Troque a senha dentro do banco**, com a stack rodando. Dentro do container o `psql` entra pelo socket local, que não pede a
   senha antiga. A senha vai por entrada padrão, então não aparece na lista de processos nem no histórico:
   ```sh
   echo "ALTER USER aurora PASSWORD :'pw';" | docker compose exec -T postgres psql -U aurora -d aurora -v pw="$NEW" -v ON_ERROR_STOP=1
   ```
   Esperado: `ALTER ROLE`. (Se você mudou `POSTGRES_USER`, use esse usuário no lugar de `aurora`.)

4. **Atualize o `.env`** com a mesma senha (e a `DATABASE_URL`, se você a definiu à mão):
   ```sh
   sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$NEW/" .env
   ```

5. **Recrie os serviços** para que usem a senha nova:
   ```sh
   docker compose up -d
   docker compose ps          # todos "healthy"
   ```

6. **Confira:**
   ```sh
   # a senha ANTIGA deve ser recusada (use a rede do seu projeto: <pasta>_default)
   docker run --rm --network aurora_default -e PGPASSWORD=aurora postgres:17 psql -h postgres -U aurora -d aurora -c "select 1"
   #   => FATAL: password authentication failed for user "aurora"
   # a NOVA deve funcionar e os dados continuam lá
   docker run --rm --network aurora_default -e PGPASSWORD="$NEW" postgres:17 psql -h postgres -U aurora -d aurora -tAc "select count(*) from users"
   ```
   Entre no app: o login e os dados devem estar como antes.

7. **Guarde a senha nova** no seu cofre de segredos e apague `backup-aurora.sql` quando não precisar mais (ele contém dados pessoais).

## Se algo der errado
- **API não conecta depois do passo 5** (`password authentication failed`): o `.env` está com uma senha diferente da do banco.
  Repita o passo 3 com a senha que está no `.env`, ou ponha no `.env` a senha do passo 3.
- **`ALTER USER` deu erro de conexão:** a stack precisa estar de pé (`docker compose up -d postgres`).
- **Esqueceu a senha atual e o `.env` não a tem:** o passo 3 não precisa dela (o socket local não pede senha); basta rodá-lo.
- **Banco externo (Supabase, RDS…):** a troca é no painel/provedor; depois atualize `DATABASE_URL` (e `MIGRATE_DATABASE_URL`).
- **Quer recomeçar do zero (perde os dados):** `docker compose down -v` apaga o volume; na próxima subida o Postgres usa a senha do `.env`.
