import type { CapacitorConfig } from "@capacitor/cli"

/** Configuração do app Android (Capacitor). O front é o mesmo da web; só o empacotamento muda. */
const config: CapacitorConfig = {
  appId: "br.com.aurora.financeiro",
  appName: "Aurora",
  webDir: "dist",
  android: {
    // só HTTPS/recursos locais (o modo local não usa rede)
    allowMixedContent: false,
  },
}

export default config
