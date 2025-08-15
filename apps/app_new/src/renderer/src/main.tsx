import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import "@/assets/globals.css";
import { Providers } from "./components/providers";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "./context/LanguageContext";
import { AuthProvider } from './context/AuthContext';

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