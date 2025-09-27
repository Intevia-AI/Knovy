import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App.js'
import '@/assets/globals.css'
import { Providers } from './app/providers.js'
import { Toaster } from '@/components/ui/sonner'
// Note: These providers will be simplified in the new structure
// Language and Auth are now hooks that can be used directly in components

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Providers>
      <App />
      <Toaster />
    </Providers>
  </React.StrictMode>
)
