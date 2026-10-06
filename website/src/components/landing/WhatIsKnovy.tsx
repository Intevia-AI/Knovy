import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { Monitor, MessageSquare, FileText, Brain } from 'lucide-react';

const painPoints = [
  {
    icon: Monitor,
    text: 'Constantly context-switch across meeting apps, Google, ChatGPT, cloud/local files...',
  },
  {
    icon: MessageSquare,
    text: 'Listen to meetings while hunting docs, researching, and taking notes',
  },
  {
    icon: FileText,
    text: 'Non-intuitive flows, friction everywhere, attention fragmentation',
  },
];

export function WhatIsKnovy() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="what-is-knovy" className="py-24 px-4">
      <div 
        ref={ref}
        className="container mx-auto max-w-6xl"
      >
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className={`transition-all duration-700 delay-100 ${
            isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
          }`}>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              What's Knovy?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Does this feel like your day?
            </p>

            <div className="space-y-6">
              {painPoints.map((point, index) => (
                <div 
                  key={index}
                  className={`flex items-start gap-4 transition-all duration-500`}
                  style={{ transitionDelay: `${(index + 2) * 100}ms` }}
                >
                  <div className="p-3 rounded-lg bg-secondary">
                    <point.icon className="h-5 w-5 text-foreground" />
                  </div>
                  <p className="text-foreground pt-2">{point.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className={`transition-all duration-700 delay-300 ${
            isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'
          }`}>
            {/* Custom minimalist illustration */}
            <div className="relative p-8">
              <svg viewBox="0 0 400 300" className="w-full h-auto">
                {/* Person at desk */}
                <circle cx="200" cy="100" r="30" fill="none" stroke="currentColor" strokeWidth="2" className="text-foreground" />
                <path d="M170 140 Q200 160 230 140" fill="none" stroke="currentColor" strokeWidth="2" className="text-foreground" />
                <rect x="150" y="160" width="100" height="60" rx="5" fill="none" stroke="currentColor" strokeWidth="2" className="text-foreground" />
                
                {/* Multiple floating windows/tabs */}
                <g className="animate-float" style={{ animationDelay: '0s' }}>
                  <rect x="50" y="40" width="60" height="40" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />
                  <line x1="55" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="1" className="text-muted-foreground" />
                  <line x1="55" y1="60" x2="90" y2="60" stroke="currentColor" strokeWidth="1" className="text-muted-foreground" />
                </g>
                
                <g className="animate-float" style={{ animationDelay: '0.5s' }}>
                  <rect x="290" y="50" width="70" height="45" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />
                  <line x1="295" y1="60" x2="350" y2="60" stroke="currentColor" strokeWidth="1" className="text-muted-foreground" />
                  <line x1="295" y1="72" x2="340" y2="72" stroke="currentColor" strokeWidth="1" className="text-muted-foreground" />
                </g>
                
                <g className="animate-float" style={{ animationDelay: '1s' }}>
                  <rect x="30" y="150" width="55" height="50" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />
                  <circle cx="57" cy="175" r="15" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground" />
                </g>
                
                <g className="animate-float" style={{ animationDelay: '1.5s' }}>
                  <rect x="310" y="160" width="65" height="40" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />
                  <line x1="315" y1="170" x2="365" y2="170" stroke="currentColor" strokeWidth="1" className="text-muted-foreground" />
                  <line x1="315" y1="182" x2="355" y2="182" stroke="currentColor" strokeWidth="1" className="text-muted-foreground" />
                </g>
                
                {/* Stress lines */}
                <path d="M160 80 L140 60" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />
                <path d="M240 80 L260 60" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />
                <path d="M200 65 L200 45" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />
                
                {/* Question marks */}
                <text x="130" y="55" className="text-muted-foreground" fill="currentColor" fontSize="16">?</text>
                <text x="265" y="55" className="text-muted-foreground" fill="currentColor" fontSize="16">?</text>
                
                {/* Arrows showing chaos */}
                <path d="M120 80 C100 100 80 90 60 100" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4" className="text-muted-foreground" />
                <path d="M280 80 C300 100 320 90 340 100" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4" className="text-muted-foreground" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
