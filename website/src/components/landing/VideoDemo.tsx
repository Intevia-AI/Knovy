import { useState } from 'react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { Play } from 'lucide-react';

const VIDEO_ID = '4FIhDU2CdX4';

export function VideoDemo() {
  const { ref, isVisible } = useScrollAnimation();
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <section id="demo" className="py-20 px-4 bg-secondary/30">
      <div 
        ref={ref}
        className={`container mx-auto max-w-4xl transition-all duration-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">See Knovy in Action</h2>
          <p className="text-muted-foreground flex items-center justify-center gap-2">
            <Play className="h-4 w-4" />
            Please turn on English captions
          </p>
        </div>

        <div className="relative aspect-video rounded-lg overflow-hidden border border-border bg-card shadow-2xl">
          {isPlaying ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1`}
              title="Knovy Demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          ) : (
            <button
              onClick={() => setIsPlaying(true)}
              className="absolute inset-0 w-full h-full cursor-pointer group"
              aria-label="Play Knovy demo video"
            >
              <img
                src={`https://img.youtube.com/vi/${VIDEO_ID}/maxresdefault.jpg`}
                alt="Knovy Demo Video Thumbnail"
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-primary rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                  <Play className="w-8 h-8 md:w-10 md:h-10 text-primary-foreground ml-1" fill="currentColor" />
                </div>
              </div>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
