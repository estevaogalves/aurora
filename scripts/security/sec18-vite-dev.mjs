// SEC-18: o servidor de desenvolvimento do Vite (pnpm dev) fica exposto na rede ou aceita qualquer nome de host?
//
// USO LOCAL: sobe o Vite desta pasta numa porta de teste, faz algumas requisições para a própria máquina e o
// encerra. Não ataca nada nem sai da sua máquina.
//
// Uso: node scripts/security/sec18-vite-dev.mjs
//
// Resultado esperado COM a correção (padrão):
//   - conexão pelo IP da rede local (192.168.x.x…) é RECUSADA (só escuta em localhost);
//   - requisição com `Host: evil.example` (DNS rebinding) é BLOQUEADA (403);
//   - `Host: localhost` funciona;
//   - com `DEV_ALLOWED_HOSTS=meu-tunel.example` esse host passa e continua bloqueando os outros;
//   - com `pnpm dev --host` (opt-in) o servidor passa a escutar na rede, mas continua bloqueando nomes desconhecidos.
import { spawn, execSync } from "node:child_process";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const lanIp = Object.values(os.networkInterfaces())
  .flat()
  .find((i) => i && i.family === "IPv4" && !i.internal)?.address;

function request(host, hostHeader, port) {
  return new Promise((resolve) => {
    const req = http.request({ host, port, path: "/", headers: { Host: hostHeader }, timeout: 4000 }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on("error", (e) => resolve(e.code ?? "erro"));
    req.on("timeout", () => {
      req.destroy();
      resolve("timeout");
    });
    req.end();
  });
}

function waitPort(port, ms = 30000) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const s = net.connect(port, "localhost");
      s.on("connect", () => {
        s.destroy();
        resolve();
      });
      s.on("error", () => {
        s.destroy();
        Date.now() - t0 > ms ? reject(new Error("o Vite não subiu a tempo")) : setTimeout(tryOnce, 300);
      });
    };
    tryOnce();
  });
}

async function withVite({ port, args = [], env = {} }, fn) {
  const child = spawn("pnpm", ["--filter", "web", "exec", "vite", "--port", String(port), "--strictPort", ...args], {
    cwd: root,
    shell: true,
    env: { ...process.env, ...env },
    stdio: "ignore",
  });
  try {
    await waitPort(port);
    return await fn();
  } finally {
    try {
      if (process.platform === "win32") execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
      else child.kill("SIGKILL");
    } catch {
      /* já terminou */
    }
  }
}

const rows = [];
const check = (label, got, expected) => {
  const ok = Array.isArray(expected) ? expected.includes(got) : got === expected;
  rows.push(ok);
  console.log(`${ok ? "OK  " : "FALHA"} ${label.padEnd(66)} -> ${got}${ok ? "" : `  (esperado ${expected})`}`);
};

console.log(`IP da rede local desta máquina: ${lanIp ?? "(nenhum)"}\n`);

console.log("== 1) padrão: `vite`");
await withVite({ port: 5391 }, async () => {
  check("Host: localhost", await request("localhost", "localhost:5391", 5391), 200);
  check("Host: evil.example (DNS rebinding)", await request("localhost", "evil.example", 5391), 403);
  if (lanIp) check(`conexão pelo IP da rede (${lanIp}) fica recusada`, await request(lanIp, lanIp, 5391), ["ECONNREFUSED", "ETIMEDOUT", "timeout"]);
});

console.log("\n== 2) túnel autorizado: DEV_ALLOWED_HOSTS=meu-tunel.example");
await withVite({ port: 5392, env: { DEV_ALLOWED_HOSTS: "meu-tunel.example" } }, async () => {
  check("Host: meu-tunel.example (autorizado)", await request("localhost", "meu-tunel.example", 5392), 200);
  check("Host: evil.example continua bloqueado", await request("localhost", "evil.example", 5392), 403);
});

console.log("\n== 3) opt-in de rede: `vite --host`");
await withVite({ port: 5393, args: ["--host"] }, async () => {
  if (lanIp) check(`conexão pelo IP da rede (${lanIp}) funciona`, await request(lanIp, lanIp, 5393), 200);
  check("Host: evil.example continua bloqueado", await request("localhost", "evil.example", 5393), 403);
});

if (rows.includes(false)) {
  console.error("\nFALHOU: o servidor de desenvolvimento está mais aberto do que deveria.");
  process.exit(1);
}
console.log("\nOK: o servidor de desenvolvimento só aceita localhost por padrão; rede e túneis são opt-in.");
