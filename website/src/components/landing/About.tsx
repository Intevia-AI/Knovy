import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { Rocket, Users, Plane, Lightbulb, GraduationCap, Layers, MapPin, Globe } from 'lucide-react';
import paulPhoto from '@/assets/paul-photo.png';
import archiPhoto from '@/assets/archi-photo.jpg';

const people = [{
  photo: paulPhoto,
  name: 'Paul Yao',
  role: 'Co-Founder & CEO • 23 years old',
  bio: 'Senior majoring in Political Science at National Taiwan University. Driven by systems thinking, creativity, and execution speed. My goal is to build products that truly change how people work and think.',
  highlights: [{
    icon: Rocket,
    text: 'Full 0→1 builder: Solo-built Taiwan\'s first prayer-based social app in 2 weeks'
  }, {
    icon: Users,
    text: 'Co-founded NTU\'s first student-led Startup & VC club'
  }, {
    icon: Lightbulb,
    text: 'Strong believer that the future belongs to intention-driven / agent-driven software'
  }, {
    icon: Plane,
    text: 'Currently in Taiwan, preparing to move to the US for full-time entrepreneurship'
  }]
}, {
  photo: archiPhoto,
  name: 'Archi Zhang',
  website: 'https://archi-zhang.blog',
  role: 'Co-Founder & CTO • 25 years old',
  bio: 'Master\'s in Electrical & Computer Engineering at National Taiwan University of Science and Technology. A full-stack builder who works across the whole stack — from front-end to deep learning to agentic systems. My goal is to build something people really want.',
  highlights: [{
    icon: GraduationCap,
    text: <>Published <a href="https://ieeexplore.ieee.org/document/10852332" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 decoration-muted-foreground/40 hover:decoration-foreground transition-colors">"VM-ASR"</a> in IEEE TASLP (Q1 2025) — 35% SOTA improvement in audio super-resolution</>
  }, {
    icon: Layers,
    text: 'Full-stack builder: ships across front-end, deep learning, and agentic systems'
  }, {
    icon: Lightbulb,
    text: 'Built Secreterry — a Chrome extension that organizes what you read into Notion'
  }, {
    icon: MapPin,
    text: 'Currently in Taipei, Taiwan'
  }]
}];

export function About() {
  const {
    ref,
    isVisible
  } = useScrollAnimation();
  return <section id="about" className="py-24 px-4 bg-secondary/30">
      <div ref={ref} className="container mx-auto max-w-4xl">
        <div className={`text-center mb-12 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Meet the Team</h2>
        </div>

        <div className="space-y-8">
          {people.map((person, personIndex) => <div key={person.name} className={`p-8 rounded-lg bg-card border border-border transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{
        transitionDelay: `${200 + personIndex * 150}ms`
      }}>
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-shrink-0">
                <div className="w-24 h-24 rounded-full bg-secondary overflow-hidden">
                  <img src={person.photo} alt={person.name} className="w-full h-full object-cover object-top" loading="lazy" decoding="async" />
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-2xl font-bold">{person.name}</h3>
                  {person.website && <a href={person.website} target="_blank" rel="noopener noreferrer" aria-label={`${person.name}'s personal website`} className="text-muted-foreground hover:text-foreground transition-colors">
                    <Globe className="h-5 w-5" />
                  </a>}
                </div>
                <p className="text-muted-foreground mb-4">{person.role}</p>
                <p className="text-muted-foreground mb-6">{person.bio}</p>

                <div className="space-y-3">
                  {person.highlights.map((highlight, index) => <div key={index} className="flex items-center gap-3">
                      <highlight.icon className="h-5 w-5 text-foreground flex-shrink-0" />
                      <span className="text-sm text-foreground">{highlight.text}</span>
                    </div>)}
                </div>
              </div>
            </div>
          </div>)}
        </div>
      </div>
    </section>;
}
