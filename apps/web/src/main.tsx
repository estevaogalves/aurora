import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DATA_SOURCE } from './config'
import { useAuthStore } from './Store/AuthStore'
import { useFinanceStore } from './Store/FinanceStore'
import { initTheme } from './theme/theme'

initTheme()

// Antes de desenhar a tela: com a API, tenta retomar a sessão (e carrega os dados da conta);
// sem ela, carrega o que está salvo neste navegador.
const ready = DATA_SOURCE === 'api' ? useAuthStore.getState().bootstrap() : useFinanceStore.getState().hydrate()

ready.finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
