import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useFinanceStore } from './Store/FinanceStore'

// carrega os dados salvos antes de desenhar a tela
useFinanceStore
  .getState()
  .hydrate()
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
