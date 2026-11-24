import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { ProgressProvider } from './progress/ProgressContext.jsx'
import { runMigrations } from './storage/migrations.js'

// Deixa o progresso antigo do navegador no formato atual (usado pela importação e pelo backup)
runMigrations()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ProgressProvider>
          <App />
        </ProgressProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
