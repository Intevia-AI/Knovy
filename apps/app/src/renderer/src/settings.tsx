import React from 'react'
import ReactDOM from 'react-dom/client'
import { SettingsWindow } from './components/SettingsPage'
import { TranslationProvider } from './context/TranslationContext'
import './assets/main.css'
import './assets/globals.css'

ReactDOM.createRoot(document.getElementById('settings-root')!).render(
  <React.StrictMode>
    <TranslationProvider>
      <SettingsWindow />
    </TranslationProvider>
  </React.StrictMode>
)
