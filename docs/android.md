# App Android (APK)

O Aurora roda no Android empacotado com [Capacitor](https://capacitorjs.com): o mesmo front da web numa WebView, com os dados **só no aparelho** (`VITE_DATA_SOURCE=local`, sem servidor e sem login). A web não muda.

## Gerar o APK de teste
Pré-requisitos: JDK 21 (com `javac`) e Android SDK (platform 36, build-tools 36). Exemplo:
```
export JAVA_HOME=$HOME/Android/jdk ANDROID_HOME=$HOME/Android
pnpm --filter web android:debug
```
O arquivo sai em `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`.

## Instalar no celular
Ative a Depuração USB e rode `adb install -r app-debug.apk`, ou copie o arquivo e instale (permitindo fontes desconhecidas).

## O que é diferente da web
- `src/platform.ts`: `isNative()` diz se está no app.
- `src/Services/download.ts`: no app, PDF/CSV/backup/comprovantes vão para a folha de compartilhar (Arquivos, Drive, WhatsApp) em vez de `<a download>`.
- `src/nativeApp.ts`: cor da barra de status e botão voltar.
- Sem service worker no app (os arquivos já vão no APK); `allowBackup=false` para o Android não copiar os dados financeiros.

## Atenção
Os dados ficam no armazenamento do app: desinstalar ou limpar os dados apaga tudo. Use o menu da conta > Exportar (backup JSON) com frequência.
APK de debug serve para testar; para publicar é preciso gerar um APK/AAB **assinado** com keystore própria (guarde-a fora do Git).
