import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { Lock, MousePointerClick, Smartphone, LucideIcon } from 'lucide-react';

const marketGaps: { text: string; icon: LucideIcon }[] = [
  { text: 'Most AI tools are locked to single ecosystems', icon: Lock },
  { text: 'They require user-initiated actions; lack proactive assistance', icon: MousePointerClick },
  { text: 'System assistants (Siri) remain limited in multi-task scenarios', icon: Smartphone },
];

export function MarketGap() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section className="py-24 px-4">
      <div ref={ref} className="container mx-auto max-w-3xl">
        <div className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h2 className="text-4xl md:text-5xl font-bold mb-8 text-center">Market Gap</h2>
          <div className="space-y-4">
            {marketGaps.map((gap, index) => {
              const Icon = gap.icon;
              return (
                <div 
                  key={index} 
                  className="flex items-center gap-4 p-4 rounded-lg bg-card border border-border hover:bg-accent/50 transition-colors"
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-foreground">{gap.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
