import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.js'
import '@/assets/globals.css'
import { Providers } from './components/providers.js'
import { Toaster } from '@/components/ui/sonner'
import { LanguageProvider } from './context/LanguageContext.js'
import { AuthProvider } from './context/AuthContext.js'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Providers>
      <LanguageProvider>
        <AuthProvider>
          <App />
          <Toaster />
        </AuthProvider>
      </LanguageProvider>
    </Providers>
  </React.StrictMode>
)
