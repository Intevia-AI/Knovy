import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { Download } from 'lucide-react';
import { useDownloadUrl } from '@/hooks/useDownloadUrl';

export function Positioning() {
  const { ref, isVisible } = useScrollAnimation();
  const downloadUrl = useDownloadUrl();

  return (
    <section className="py-24 px-4">
      <div 
        ref={ref}
        className="container mx-auto max-w-4xl text-center"
      >
        <div className={`transition-all duration-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          <h2 className="text-4xl md:text-5xl font-bold mb-8">
            Knovy's Positioning
          </h2>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
            INTEVIA AI targets cognitive interruptions with a cross-platform, always-on toolbar—delivering 
            <span className="text-foreground font-medium"> instant, proactive, context-aware support </span>
            without blocking your screen.
          </p>

          <a
            href={downloadUrl}
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            <Download className="h-5 w-5" />
            Download for macOS
          </a>
        </div>
      </div>
    </section>
  );
}
