import { useState, useEffect } from 'react'
import { Sparkles, ExternalLink, FileText, Github, Download } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { motion } from 'motion'

export function AboutView() {
  const [appVersion, setAppVersion] = useState<string>('Loading...')

  useEffect(() => {
    // Fetch app version from Electron
    window.electronAPI.getAppVersion().then((version: string) => {
      setAppVersion(version)
    })
  }, [])

  const checkForUpdates = () => {
    // Trigger update check via Electron IPC
    window.electronAPI.send('check-for-updates')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">About</h2>
        <p className="text-sm text-muted-foreground">About Knovy and version information</p>
      </div>

      {/* App Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="text-center">
          <CardContent className="pt-6 space-y-4">
            {/* App Icon */}
            <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center">
              <Sparkles className="w-12 h-12 text-primary-foreground" />
            </div>

            <div>
              <h2 className="text-2xl font-bold">Knovy</h2>
              <p className="text-sm text-muted-foreground">AI-Powered Real-Time Transcription</p>
            </div>

            <div className="text-sm space-y-1">
              <p className="font-mono">Version {appVersion}</p>
              <p className="text-muted-foreground">© {new Date().getFullYear()} Intevia AI</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Links Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Button variant="ghost" className="w-full justify-start" asChild>
              <a href="https://knovy.ai" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Visit Website
              </a>
            </Button>
            <Button variant="ghost" className="w-full justify-start" asChild>
              <a href="https://docs.knovy.ai" target="_blank" rel="noopener noreferrer">
                <FileText className="w-4 h-4 mr-2" />
                Documentation
              </a>
            </Button>
            <Button variant="ghost" className="w-full justify-start" asChild>
              <a href="https://github.com/intevia/knovy" target="_blank" rel="noopener noreferrer">
                <Github className="w-4 h-4 mr-2" />
                GitHub Repository
              </a>
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={checkForUpdates}>
              <Download className="w-4 h-4 mr-2" />
              Check for Updates
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Open Source Credits Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">Open Source Credits</h3>
          </CardHeader>
          <CardContent>
            <div className="h-32 overflow-y-auto pr-2 settings-scrollbar">
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Electron - MIT License</p>
                <p>• React - MIT License</p>
                <p>• Tailwind CSS - MIT License</p>
                <p>• Radix UI - MIT License</p>
                <p>• Supabase - Apache 2.0 License</p>
                <p>• Framer Motion - MIT License</p>
                <p>• TypeScript - Apache 2.0 License</p>
                <p>• Vite - MIT License</p>
                <p>• Lucide Icons - ISC License</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
