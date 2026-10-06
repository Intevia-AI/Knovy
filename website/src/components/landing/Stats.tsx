import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { useCountUp } from '@/hooks/useCountUp';

const stats = [{
  value: 92,
  suffix: '%',
  label: 'multitask during meetings'
}, {
  value: 69,
  suffix: '%',
  label: 'check email in meetings'
}, {
  value: 30,
  suffix: '%',
  label: 'send emails during meetings'
}, {
  value: 25,
  suffix: ' min',
  label: 'to fully resume after interruption'
}, {
  value: 36,
  suffix: '%',
  label: 'miss key information'
}];

function StatCard({
  stat,
  isVisible,
  delay
}: {
  stat: typeof stats[0];
  isVisible: boolean;
  delay: number;
}) {
  const count = useCountUp(stat.value, 2000, isVisible);
  return (
    <div 
      className="p-6 rounded-lg bg-card border border-border hover-lift transition-all duration-500" 
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="text-4xl md:text-5xl font-bold mb-2">
        {isVisible ? count : 0}{stat.suffix}
      </div>
      <p className="text-sm text-muted-foreground">{stat.label}</p>
    </div>
  );
}

export function Stats() {
  const { ref, isVisible } = useScrollAnimation();
  
  return (
    <section className="py-24 px-4 bg-secondary/30">
      <div ref={ref} className="container mx-auto max-w-6xl">
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Current Situation of Multitasking  
          </h2>
        </div>

        <div className={`grid grid-cols-2 md:grid-cols-3 gap-4 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          {stats.map((stat, index) => (
            <StatCard key={index} stat={stat} isVisible={isVisible} delay={index * 100} />
          ))}
        </div>
      </div>
    </section>
  );
}