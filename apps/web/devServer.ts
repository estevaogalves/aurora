/**
 * Hosts extras que o servidor de desenvolvimento aceita, vindos de DEV_ALLOWED_HOSTS (separados por vírgula).
 *
 * Por padrão o Vite só atende `localhost` e IPs: isso barra DNS rebinding (um site qualquer apontando um nome
 * dele para 127.0.0.1 para ler o seu servidor local). Para abrir o app por um túnel (ngrok, Cloudflare Tunnel),
 * liste o nome aqui: DEV_ALLOWED_HOSTS=meu-app.ngrok.app. Um ponto na frente libera subdomínios (.ngrok.app).
 * Curingas, "true" e "*" são recusados de propósito: liberar tudo é justamente o que isto evita.
 */
export function parseAllowedHosts(raw: string | undefined): string[] {
  if (!raw) return []
  const hosts: string[] = []
  for (const part of raw.split(",")) {
    const host = part.trim().toLowerCase()
    if (!host) continue
    if (host === "true" || host === "false") {
      throw new Error(`DEV_ALLOWED_HOSTS: "${part.trim()}" não é um nome de host (para liberar tudo não há opção, de propósito)`)
    }
    if (!/^\.?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(host)) {
      throw new Error(`DEV_ALLOWED_HOSTS: "${part.trim()}" não é um nome de host válido (curingas não são aceitos)`)
    }
    hosts.push(host)
  }
  return hosts
}
