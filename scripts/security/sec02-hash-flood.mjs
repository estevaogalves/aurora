// SEC-02: N cadastros simultâneos (cada um roda argon2id de 64 MiB) + uma sonda de vida da API.
//
// *** USO SOMENTE LOCAL ***  Este script derruba um servidor mal configurado de propósito.
// Rode apenas contra o laboratório descartável (scripts/security/lab.sh) ou outro ambiente SEU,
// na sua máquina. Ele recusa qualquer endereço que não seja localhost/loopback.
//
// Uso: node scripts/security/sec02-hash-flood.mjs http://localhost:18080 [N=30]
//
// Resultado esperado COM a correção: nenhum "502"/"erro:*"; só 201 (concluídos), 503 (fila cheia ou
// timeout, com Retry-After) e/ou 429 (limite de cadastro por IP); a API continua de pé (sonda 401 = no ar).
import { assertLocal } from "./local-only.mjs";

const base = process.argv[2];
const N = Number(process.argv[3] ?? 30);
assertLocal(base);

const t0 = Date.now();
const probe = [];
const timer = setInterval(async () => {
  const s = Date.now();
  try {
    // /healthz não passa pelo nginx; /api/v1/me sem token responde 401 quando a API está viva (502 = caiu)
    const r = await fetch(`${base}/api/v1/me`, { signal: AbortSignal.timeout(5000) });
    probe.push(`${r.status}:${Date.now() - s}ms`);
  } catch {
    probe.push(`falha:${Date.now() - s}ms`);
  }
}, 500);

const retryAfter = new Set();
const res = await Promise.allSettled(
  Array.from({ length: N }, (_, i) =>
    fetch(`${base}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `load-${Date.now()}-${i}@example.com`, name: "x", password: "senha-forte-123" }),
      signal: AbortSignal.timeout(60000),
    }).then((r) => {
      if (r.status === 503 || r.status === 429) retryAfter.add(r.headers.get("retry-after") ?? "AUSENTE");
      return r.status;
    }),
  ),
);
clearInterval(timer);

const tally = {};
for (const r of res) {
  const k = r.status === "fulfilled" ? r.value : "erro:" + (r.reason?.cause?.code ?? r.reason?.name);
  tally[k] = (tally[k] ?? 0) + 1;
}
console.log("duração", Date.now() - t0, "ms | respostas:", JSON.stringify(tally));
console.log("Retry-After nas recusas:", [...retryAfter].join(", ") || "(nenhuma recusa)");
console.log("sonda da API (401 = no ar):", probe.join(" ") || "(rápido demais para sondar)");

const down = probe.filter((p) => !p.startsWith("401:"));
const bad = Object.keys(tally).filter((k) => !["201", "429", "503"].includes(k));
if (bad.length || down.length || retryAfter.has("AUSENTE")) {
  console.error("FALHOU:", bad.length ? `respostas inesperadas ${bad.join(", ")}` : down.length ? `API não respondeu à sonda (${down.join(" ")})` : "recusa sem Retry-After");
  process.exit(1);
}
console.log("OK: só 201/429/503, todas as recusas com Retry-After.");
