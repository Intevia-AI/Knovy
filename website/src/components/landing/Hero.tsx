import { Button } from '@/components/ui/button';
import { Download, Github, Zap } from 'lucide-react';
import { useDownloadUrl, REPO_URL } from '@/hooks/useDownloadUrl';

export function Hero() {
  const downloadUrl = useDownloadUrl();

  return <section className="min-h-screen flex items-center justify-center pt-20 pb-16 px-4">
      <div className="container mx-auto text-center max-w-4xl">
        <div className="opacity-0 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mb-8">
            <Zap className="h-4 w-4" />
            <span>Stay in your flow</span>
          </div>
        </div>

        <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tight mb-2 opacity-0 animate-fade-in-up animation-delay-100">
          Knovy
        </h1>

        <p className="text-lg md:text-xl font-medium mb-12 opacity-0 animate-fade-in-up animation-delay-150">
          Your All-in-One Real-Time AI Assistant
        </p>

        

        <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto mb-4 opacity-0 animate-fade-in-up animation-delay-400">
          <Button asChild className="h-12 px-6 font-medium group">
            <a href={downloadUrl}>
              <Download className="mr-2 h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
              Download for macOS
            </a>
          </Button>
          <Button asChild variant="outline" className="h-12 px-6 font-medium">
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              <Github className="mr-2 h-4 w-4" />
              View on GitHub
            </a>
          </Button>
        </div>

        <p className="text-sm text-muted-foreground opacity-0 animate-fade-in-up animation-delay-500">
          <span className="font-medium text-foreground">Free and open source.</span> Runs fully on your machine — no account, no API keys. Apple Silicon Mac.
        </p>
      </div>
    </section>;
}