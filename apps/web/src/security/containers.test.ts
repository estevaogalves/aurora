import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Regressão do SEC-16: containers endurecidos, sem senha padrão e com imagens fixadas por digest.
// vitest roda com a pasta apps/web como diretório atual.
const root = (file: string) => readFileSync(resolve(process.cwd(), "../..", file), "utf8").replace(/\r\n/g, "\n");

const compose = root("docker-compose.yml");
const envExample = root(".env.example");
const nginxConf = root("apps/web/nginx.conf");

/** Bloco de um serviço do compose (do "  nome:" até o próximo serviço ou o fim de `services`). */
function service(name: string): string {
  const m = compose.match(new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  \\w[\\w-]*:\\n|^\\w)`, "m"));
  if (!m) throw new Error(`serviço ${name} não encontrado`);
  return m[1];
}

describe("sem senha padrão do Postgres", () => {
  it("o compose exige POSTGRES_PASSWORD (sem valor padrão)", () => {
    expect(compose).toMatch(/POSTGRES_PASSWORD: \$\{POSTGRES_PASSWORD:\?/);
    expect(compose).not.toMatch(/POSTGRES_PASSWORD:-/);
  });

  it("nenhum arquivo traz aurora:aurora nem a senha 'aurora' como padrão", () => {
    for (const text of [compose, envExample]) {
      expect(text).not.toContain("aurora:aurora@");
      expect(text).not.toMatch(/^POSTGRES_PASSWORD=aurora\s*$/m);
    }
    // a DATABASE_URL padrão usa a variável, não um literal
    expect(compose).toContain("${POSTGRES_USER:-aurora}:${POSTGRES_PASSWORD}@postgres");
  });

  it(".env.example deixa POSTGRES_PASSWORD e JWT_SECRET vazios (make env preenche)", () => {
    expect(envExample).toMatch(/^POSTGRES_PASSWORD=$/m);
    expect(envExample).toMatch(/^JWT_SECRET=$/m);
  });
});

describe("Redis com senha (SEC-14)", () => {
  it("o compose exige REDIS_PASSWORD (sem valor padrão) e o redis-server a usa", () => {
    expect(compose).toMatch(/\$\{REDIS_PASSWORD:\?/);
    expect(compose).not.toMatch(/REDIS_PASSWORD:-/);
    const redis = service("redis");
    expect(redis).toMatch(/- --requirepass\n\s+- \$\{REDIS_PASSWORD:\?/);
  });

  it("a REDIS_URL padrão da API leva a senha, e o healthcheck autentica sem pôr a senha na linha de comando", () => {
    expect(service("api")).toContain("REDIS_URL: ${REDIS_URL:-redis://:${REDIS_PASSWORD}@redis:6379/0}");
    const redis = service("redis");
    expect(redis).toContain("REDISCLI_AUTH: ${REDIS_PASSWORD}");
    expect(redis).not.toMatch(/redis-cli[^\n]*(-a|--pass)/);
  });

  it("nenhuma URL do Redis sem senha como padrão e .env.example deixa a senha vazia", () => {
    expect(compose).not.toMatch(/redis:\/\/redis:6379/);
    expect(envExample).toMatch(/^REDIS_PASSWORD=$/m);
  });

  it("o redis-server é o primeiro argumento do comando (o entrypoint só larga o root assim)", () => {
    expect(service("redis")).toMatch(/command:\n\s+- redis-server\n/);
    expect(service("redis")).not.toMatch(/command:.*\bsh\b/);
  });
});

describe("api e web endurecidos", () => {
  for (const name of ["api", "web"]) {
    it(`${name}: somente leitura, sem capabilities, sem novos privilégios, com healthcheck e limites`, () => {
      const s = service(name);
      expect(s).toMatch(/^ {4}read_only: true$/m);
      expect(s).toMatch(/^ {4}cap_drop: \[ALL\]$/m);
      expect(s).toContain("no-new-privileges:true");
      expect(s).toMatch(/^ {4}healthcheck:$/m);
      expect(s).toMatch(/^ {4}pids_limit: \d+$/m);
      expect(s).toMatch(/^ {4}mem_limit: /m);
      expect(s).toMatch(/^ {4}tmpfs:\n {6}- \/tmp$/m); // única área gravável
    });
  }

  it("a porta do web é a 8080 do container (nginx sem root) e a da API só publica em loopback", () => {
    expect(service("web")).toMatch(/- "\$\{WEB_PORT:-8080\}:8080"/);
    expect(service("api")).toMatch(/- "127\.0\.0\.1:\$\{API_PORT:-8081\}:8080"/);
    expect(nginxConf).toMatch(/^\s*listen 8080;$/m);
    expect(nginxConf).not.toMatch(/^\s*listen 80;$/m);
  });

  it("web só sobe depois de a API estar saudável", () => {
    expect(service("web")).toMatch(/api: \{ condition: service_healthy \}/);
  });

  it("postgres e redis: sem novos privilégios, capabilities mínimas e sem portas publicadas", () => {
    for (const name of ["postgres", "redis"]) {
      const s = service(name);
      expect(s).toMatch(/^ {4}cap_drop: \[ALL\]$/m);
      expect(s).toContain("no-new-privileges:true");
      expect(s).not.toMatch(/^ {4}ports:$/m);
    }
  });
});

describe("imagens fixadas por digest", () => {
  const digest = /@sha256:[0-9a-f]{64}/;

  it("toda imagem do compose tem digest", () => {
    const images = [...compose.matchAll(/^ {4}image: (\S+)$/gm)].map((m) => m[1]);
    expect(images.length).toBeGreaterThanOrEqual(2);
    for (const image of images) expect(image, image).toMatch(digest);
  });

  it("todo FROM dos Dockerfiles tem digest, e o web usa nginx sem root", () => {
    for (const file of ["apps/api/Dockerfile", "apps/web/Dockerfile"]) {
      const froms = root(file).split("\n").filter((l) => l.startsWith("FROM "));
      expect(froms.length).toBeGreaterThan(0);
      for (const from of froms) expect(from, `${file}: ${from}`).toMatch(digest);
    }
    const web = root("apps/web/Dockerfile");
    expect(web).toContain("nginxinc/nginx-unprivileged");
    expect(web).not.toMatch(/FROM nginx:/);
    expect(web).toContain("EXPOSE 8080");
  });

  it("a imagem da API continua sem root", () => {
    expect(root("apps/api/Dockerfile")).toMatch(/^USER app$/m);
  });
});
