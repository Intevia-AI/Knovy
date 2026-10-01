import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { Rocket, Calendar, Trophy, TrendingUp } from 'lucide-react';
const progressItems = [{
  icon: Calendar,
  text: "Developed over 4 months, with the beta live for 1 month"
}, {
  icon: Trophy,
  text: "Selected for multiple startup competitions in Taiwan and showcased at the largest startup expo in Taipei"
}, {
  icon: TrendingUp,
  text: "10+ investors and VCs from San Francisco and Taipei have proactively reached out, who are actively following product progress and supporting U.S. expansion and scaling plans"
}, {
  icon: Rocket,
  text: "Applied to multiple accelerators in Taiwan and the United States, currently awaiting results"
}];
export function CurrentProgress() {
  const {
    ref,
    isVisible
  } = useScrollAnimation();
  return <section className="py-20 md:py-28 bg-muted/30">
      <div className="container mx-auto px-4">
        <div ref={ref} className={`max-w-4xl mx-auto transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-12">@Knovy Current Progress</h2>
          
          <div className="space-y-4">
            {progressItems.map((item, index) => <div key={index} className={`flex items-start gap-4 p-4 rounded-xl bg-background/50 border border-border/50 backdrop-blur-sm transition-all duration-500 hover:border-primary/30 hover:bg-background/80 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`} style={{
            transitionDelay: `${index * 100}ms`
          }}>
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <p className="text-lg text-foreground/90 leading-relaxed pt-1.5">
                  {item.text}
                </p>
              </div>)}
          </div>
        </div>
      </div>
    </section>;
}