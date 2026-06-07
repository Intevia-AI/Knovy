import React from 'react'
import ReactDOM from 'react-dom/client'
import { SettingsWindow } from './components/SettingsPage'
import { TranslationProvider } from './context/TranslationContext'
import { Toaster } from '@/components/ui/sonner'
import './assets/main.css'
import './assets/globals.css'

ReactDOM.createRoot(document.getElementById('settings-root')!).render(
  <React.StrictMode>
    <TranslationProvider>
      <SettingsWindow />
      <Toaster />
    </TranslationProvider>
  </React.StrictMode>
)
