import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { Mic, Bot, FileSearch, LineChart, Rocket } from 'lucide-react';

const features = [
  {
    icon: Mic,
    title: 'Real-Time Capture & Summaries',
    description: 'Live speech-to-text, on-screen context analysis, instant transcription',
  },
  {
    icon: Bot,
    title: 'Automated AI Agent',
    description: 'Autonomously answer and execute tasks, automation workflows, customizable role presets',
  },
  {
    icon: FileSearch,
    title: 'Deep Content Assistance',
    description: 'Auto keyword extraction, multilingual translation, intelligent AI chatbot',
  },
  {
    icon: LineChart,
    title: 'Post-Meeting Insights',
    description: 'Export records, personal performance analytics, actionable summaries',
  },
];

const futureFeature = {
  icon: Rocket,
  title: 'Agentic Integration',
  description: "AI will auto-execute tasks based on conversation context and user's intent — emails, calendars, Google Suite, and other apps.",
};

export function Features() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="features" className="py-24 px-4 bg-secondary/30">
      <div ref={ref} className="container mx-auto max-w-6xl">
        <div className={`text-center mb-16 transition-all duration-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Core Features</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`p-8 rounded-lg bg-card border border-border hover-lift transition-all duration-500 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
              style={{ transitionDelay: `${(index + 1) * 100}ms` }}
            >
              <feature.icon className="h-10 w-10 mb-4 text-foreground" />
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Future Development - Special highlight */}
        <div
          className={`p-8 rounded-lg border-2 border-foreground bg-card hover-lift transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
          style={{ transitionDelay: '500ms' }}
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-foreground">
              <futureFeature.icon className="h-6 w-6 text-background" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xl font-bold">{futureFeature.title}</h3>
                <span className="px-3 py-1 text-xs font-medium rounded-full bg-secondary text-secondary-foreground">
                  Coming Soon
                </span>
              </div>
              <p className="text-muted-foreground">{futureFeature.description}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
