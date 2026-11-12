#!/usr/bin/env node
// Confere o layout do Aurora no Chrome de verdade (hero/cabeçalho e estouro horizontal), em várias larguras e telas.
// Regra do projeto: rodar depois de QUALQUER mudança no front (`make layout`). Falha se algo quebrar.
//   - o cabeçalho tem que ficar numa linha só ("Lançar" na mesma linha do logo), de 360 px para cima;
//   - nenhuma tela pode ter rolagem horizontal;
//   - o card de saldo do Painel (hero) não pode ter conteúdo vazando.
// Precisa do Google Chrome instalado. Sobe o Vite sozinho em :5199 (ou usa o que já estiver lá).
// Opções: --shots <pasta>  salva um screenshot de cada tela/largura (para olhar com os próprios olhos).
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const seed = JSON.parse(fs.readFileSync(path.join(here, "layout-seed.json"), "utf8"));
const shotsDir = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
const BASE = "http://127.0.0.1:5199";
const WIDTHS = [360, 390, 430, 700, 701, 1000, 1299, 1300, 1440, 1920];
const ROUTES = ["/painel", "/lancamentos", "/projecao", "/comparacao", "/metas", "/relatorios"];
const PREFS = JSON.stringify({ showHours: true, hoursPerMonth: 176, netIncome: null, showBreathing: true, dismissedInsights: [] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function up(url) { try { return (await fetch(url)).ok; } catch { return false; } }

let vite = null;
if (!(await up(BASE))) {
  vite = spawn("npx", ["vite", "--port", "5199", "--host", "127.0.0.1", "--strictPort"], { cwd: path.join(root, "apps/web"), stdio: "ignore" });
  for (let i = 0; i < 60 && !(await up(BASE)); i++) await sleep(500);
}

const PORT = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn("google-chrome", ["--headless=new", `--remote-debugging-port=${PORT}`, "--no-sandbox", "--disable-gpu", `--user-data-dir=/tmp/aurora-layout-${PORT}`, "about:blank"], { stdio: "ignore" });
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (targets.length) break; } catch { /* espera o Chrome subir */ } await sleep(200); }
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

const MEASURE = `(() => {
  const h = document.querySelector("header");
  const logo = h.querySelector("a[aria-label=Aurora]").getBoundingClientRect();
  const lanc = [...h.querySelectorAll("button")].find((b) => b.textContent.includes("Lançar")).getBoundingClientRect();
  const hero = document.querySelector("[data-tour=saldo]");
  return JSON.stringify({
    headerOneRow: Math.abs(lanc.top - logo.top) < 30,
    headerH: Math.round(h.getBoundingClientRect().height),
    overflowX: document.documentElement.scrollWidth > innerWidth,
    heroLeaks: hero ? hero.scrollWidth > hero.clientWidth + 1 : false,
  });
})()`;

await send("Page.enable");
await send("Page.navigate", { url: BASE });
await sleep(1500);
await ev(`localStorage.setItem("aurora:finance", ${JSON.stringify(JSON.stringify({ version: 9, data: seed }))}); localStorage.setItem("aurora:theme", "dark"); localStorage.setItem("aurora:prefs", ${JSON.stringify(PREFS)});`);

const problems = [];
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
for (const width of WIDTHS) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 700 });
  for (const route of ROUTES) {
    await send("Page.navigate", { url: BASE + route });
    await sleep(1400);
    const r = JSON.parse((await ev(MEASURE)) ?? "{}");
    const bad = [];
    if (!r.headerOneRow) bad.push("cabeçalho quebrou em mais de uma linha");
    if (r.overflowX) bad.push("rolagem horizontal na página");
    if (r.heroLeaks) bad.push("conteúdo vazando do card de saldo (hero)");
    if (bad.length) problems.push(`${width}px ${route}: ${bad.join("; ")}`);
    if (shotsDir && (route === "/painel" || bad.length)) {
      const shot = await send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(shotsDir, `${route.slice(1)}-${width}.png`), Buffer.from(shot.result.data, "base64"));
    }
  }
}
ws.close();
chrome.kill();
vite?.kill();

if (problems.length) {
  console.error(`\n✗ layout quebrado (${problems.length}):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ layout ok: ${WIDTHS.length} larguras × ${ROUTES.length} telas (cabeçalho em uma linha, sem rolagem horizontal, hero íntegro)`);
