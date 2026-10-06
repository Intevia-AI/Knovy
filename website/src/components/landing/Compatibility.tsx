import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { Video, MessageCircle, Headphones, MonitorPlay } from 'lucide-react';

const meetingPlatforms = [
  { name: 'Google Meet' },
  { name: 'Zoom' },
  { name: 'Microsoft Teams' },
  { name: 'Webex' },
];

const streamingPlatforms = [
  { name: 'YouTube' },
  { name: 'Netflix' },
  { name: 'Amazon Prime' },
  { name: 'Disney+' },
];

const audioPlatforms = [
  { name: 'Spotify' },
  { name: 'Apple Music' },
  { name: 'Discord' },
];

export function Compatibility() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section className="py-24 px-4">
      <div ref={ref} className="container mx-auto max-w-4xl text-center">
        <div className={`transition-all duration-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Compatibility</h2>
          <p className="text-muted-foreground mb-12">
            Works alongside your favorite platforms
          </p>
        </div>

        <div className={`transition-all duration-700 delay-200 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          <h3 className="text-lg font-semibold mb-4 text-muted-foreground">Meeting Platforms</h3>
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {meetingPlatforms.map((platform, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary border border-border hover:bg-accent transition-colors"
              >
                <Video className="h-4 w-4 text-foreground" />
                <span className="font-medium text-sm">{platform.name}</span>
              </div>
            ))}
          </div>

          <h3 className="text-lg font-semibold mb-4 text-muted-foreground">Streaming Platforms</h3>
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {streamingPlatforms.map((platform, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary border border-border hover:bg-accent transition-colors"
              >
                <MonitorPlay className="h-4 w-4 text-foreground" />
                <span className="font-medium text-sm">{platform.name}</span>
              </div>
            ))}
          </div>

          <h3 className="text-lg font-semibold mb-4 text-muted-foreground">Audio & Music Platforms</h3>
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {audioPlatforms.map((platform, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary border border-border hover:bg-accent transition-colors"
              >
                <Headphones className="h-4 w-4 text-foreground" />
                <span className="font-medium text-sm">{platform.name}</span>
              </div>
            ))}
          </div>
        </div>

        <p className={`text-sm text-muted-foreground flex items-center justify-center gap-2 transition-all duration-700 delay-400 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}>
          <MessageCircle className="h-4 w-4" />
          Knovy is a third-party app that runs in the background—no vendor lock-in.
        </p>
      </div>
    </section>
  );
}
