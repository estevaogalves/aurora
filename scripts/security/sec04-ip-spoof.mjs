// SEC-04: o IP usado nos limites vem de cabeçalho que o cliente consegue forjar?
//
// *** USO SOMENTE LOCAL ***  Faz tentativas de login erradas de propósito.
// Rode apenas contra o laboratório descartável (scripts/security/lab.sh) ou outro ambiente SEU,
// na sua máquina. Ele recusa qualquer endereço que não seja localhost/loopback.
//
// Uso: node scripts/security/sec04-ip-spoof.mjs http://localhost:18080
//
// Faz 10 logins errados para o MESMO e-mail em cada cenário (limite padrão: 5 falhas).
// Resultado esperado COM a correção: nos três cenários o 6º login em diante dá 429.
import { assertLocal } from "./local-only.mjs";

const base = process.argv[2];
assertLocal(base);

let failed = false;
async function run(label, headersFor) {
  const email = `v-${Math.random().toString(36).slice(2)}@example.com`;
  const codes = [];
  for (let i = 0; i < 10; i++) {
    const r = await fetch(`${base}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headersFor(i) },
      body: JSON.stringify({ email, password: "errada-errada" }),
    });
    codes.push(r.status);
  }
  const blocked = codes.slice(5).every((c) => c === 429);
  if (!blocked) failed = true;
  console.log(label.padEnd(46), codes.join(" "), blocked ? " OK" : " <- NÃO BLOQUEOU");
}

await run("sem cabeçalho forjado", () => ({}));
await run("X-Real-IP forjado, um valor por tentativa", (i) => ({ "X-Real-IP": `203.0.113.${i + 1}` }));
await run("X-Forwarded-For forjado, um por tentativa", (i) => ({ "X-Forwarded-For": `198.51.100.${i + 1}` }));
await run("True-Client-IP forjado, um por tentativa", (i) => ({ "True-Client-IP": `192.0.2.${i + 1}` }));

if (failed) {
  console.error("FALHOU: o limite de login pode ser contornado forjando o IP.");
  process.exit(1);
}
console.log("OK: forjar cabeçalhos de IP não escapa do limite.");
