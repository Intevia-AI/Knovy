import React from 'react'
import ReactDOM from 'react-dom/client'
import { SettingsWindow } from './components/SettingsWindow'
import { AuthProvider } from './context/AuthContext'
import './assets/main.css'
import './assets/globals.css'

ReactDOM.createRoot(document.getElementById('settings-root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <SettingsWindow />
    </AuthProvider>
  </React.StrictMode>
)
