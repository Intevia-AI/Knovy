"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { WaitlistForm } from "./waitlist-form";
import { TextEffect } from "@workspace/ui/components/text-effect";
// import { Button } from "@workspace/ui/components/button";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "@/context/language-context";
import { Logo } from "./logo";

interface HeroSectionProps {
  stripCount?: number;
  animationDuration?: number;
}

export function HeroSection({ stripCount = 5, animationDuration = 1.25 }: HeroSectionProps = {}) {
  const { t } = useLanguage();
  const [showStrips, setShowStrips] = useState(true);

  return (
    <>
      <main className="overflow-hidden relative" id="home">
        {/* Strip Overlay Animation */}
        <AnimatePresence>
          {showStrips && (
            <div className="fixed inset-0 z-50 pointer-events-none">
              {Array.from({ length: stripCount }, (_, index) => {
                const isOdd = index % 2 === 0;
                const stripHeight = 100 / stripCount;

                return (
                  <motion.div
                    key={index}
                    className="absolute w-full"
                    style={{
                      height: `${stripHeight}%`,
                      top: `${index * stripHeight}%`,
                    }}
                    initial={{
                      x: 0,
                      background: "#000",
                    }}
                    animate={{
                      x: isOdd ? "-100%" : "100%",
                      background: isOdd
                        ? `linear-gradient(to right, #000 0%, #000 70%, transparent 100%)`
                        : `linear-gradient(to left, #000 0%, #000 70%, transparent 100%)`,
                    }}
                    transition={{
                      duration: animationDuration,
                      ease: [0.25, 0.1, 0.25, 1],
                    }}
                    onAnimationComplete={() => {
                      if (index === stripCount - 1) {
                        setShowStrips(false);
                      }
                    }}
                  />
                );
              })}
            </div>
          )}
        </AnimatePresence>

        <div
          aria-hidden
          className="absolute inset-0 isolate hidden opacity-65 contain-strict lg:block"
        >
          <div className="w-140 h-320 -translate-y-87.5 absolute left-0 top-0 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,85%,.08)_0,hsla(0,0%,55%,.02)_50%,hsla(0,0%,45%,0)_80%)]" />
        </div>
        <section className="h-screen flex items-center justify-center">
          <div className="relative -mt-12">
            <div className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_100%,transparent_0%,var(--color-background)_75%)]"></div>
            <div className="mx-auto max-w-7xl px-6">
              <div className="text-center sm:mx-auto lg:mr-auto lg:mt-0">
                <Link
                  href="#"
                  className="hover:bg-background dark:hover:border-t-border bg-muted group mx-auto flex w-fit items-center gap-4 rounded-full border p-1 pl-4 shadow-md shadow-zinc-950/5 transition-colors duration-300 dark:border-t-white/5 dark:shadow-zinc-950"
                >
                  <Logo className="size-5" />
                  <span className={`text-sm transition-colors duration-300`}>
                    {t("hero.introducing")}
                  </span>
                  <div className="bg-background group-hover:bg-muted size-6 overflow-hidden rounded-full duration-500">
                    <div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
                      <span className="flex size-6">
                        <ArrowRight className="m-auto size-3" />
                      </span>
                      <span className="flex size-6">
                        <ArrowRight className="m-auto size-3" />
                      </span>
                    </div>
                  </div>
                </Link>

                <TextEffect
                  preset="fade-in-blur"
                  speedSegment={0.3}
                  as="h1"
                  className={`mt-8 text-balance text-6xl md:text-7xl lg:mt-16 xl:text-[7.25rem] transition-colors duration-300`}
                >
                  {t("hero.brand")}
                </TextEffect>
                <TextEffect
                  per="line"
                  preset="fade-in-blur"
                  speedSegment={0.3}
                  delay={0.5}
                  as="h3"
                  className={`mt-4 text-balance text-xl md:text-2xl lg:mt-8 xl:text-[2.20rem] transition-colors duration-300`}
                >
                  {t("hero.tagline")}
                </TextEffect>
                <div className="mt-8 flex justify-center">
                  <WaitlistForm />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
