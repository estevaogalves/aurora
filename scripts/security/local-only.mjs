// Trava de segurança dos scripts de teste: só aceita alvos na própria máquina.
// Não existe opção para desligar. Para testar outro ambiente seu, use um túnel local (ex.: ssh -L).
import { isIP } from "node:net";

export function assertLocal(base) {
  let host;
  try {
    host = new URL(base).hostname.replace(/^\[|\]$/g, "");
  } catch {
    console.error("Informe a URL base, ex.: http://localhost:18080");
    process.exit(2);
  }
  const loopback =
    host === "localhost" || host === "::1" || (isIP(host) === 4 && host.startsWith("127."));
  if (!loopback) {
    console.error(`Recusado: "${host}" não é localhost. Estes scripts são de uso local; nunca os aponte para produção ou terceiros.`);
    process.exit(2);
  }
}
