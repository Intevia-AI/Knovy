"use client";

import { useEffect, useRef } from "react";
import { useLanguage } from "@/context/language-context";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

export function VideoDemo() {
  const { t } = useLanguage();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [sectionRef, isIntersecting] = useIntersectionObserver({
    threshold: 0.5,
    freezeOnceVisible: true,
  });

  // YouTube video ID extracted from: https://www.youtube.com/watch?v=4FIhDU2CdX4
  const videoId = "4FIhDU2CdX4";

  useEffect(() => {
    if (isIntersecting && iframeRef.current) {
      // Trigger autoplay by posting message to YouTube iframe API
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "playVideo", args: "" }),
        "*"
      );
    }
  }, [isIntersecting]);

  return (
    <section id="video-demo" ref={sectionRef}>
      <div className="mx-auto max-w-5xl px-6 py-12 md:py-20 lg:py-24">
        {/* Horizontal divider */}
        <div className="h-px w-full bg-border my-8"></div>

        {/* Title and description */}
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-balance text-3xl font-semibold lg:text-4xl">
            {t("videoDemo.title")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            {t("videoDemo.description")}
          </p>
        </div>

        {/* Video container with responsive 16:9 aspect ratio */}
        <div className="relative w-full max-w-4xl mx-auto">
          <div className="relative aspect-video rounded-lg overflow-hidden border shadow-lg bg-muted">
            <iframe
              ref={iframeRef}
              src={`https://www.youtube.com/embed/${videoId}?mute=1&enablejsapi=1&rel=0&modestbranding=1`}
              title={t("videoDemo.title")}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
