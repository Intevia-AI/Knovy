"use client";
import { PainPoint } from "./pain-point";
import { Solution } from "./solution";

export function FeaturesSection() {
  return (
    <section className="py-12 md:py-20 lg:py-24" id="features">
      <div className="bg-linear-to-b absolute inset-0 -z-10 sm:inset-6 sm:rounded-b-3xl dark:block dark:to-[color-mix(in_oklab,var(--color-zinc-900)_75%,var(--color-background))]"></div>
      <div className="mx-auto max-w-5xl space-y-8 px-6 md:space-y-16 lg:space-y-20 dark:[--color-border:color-mix(in_oklab,var(--color-white)_10%,transparent)]">
        <PainPoint />
        <Solution />
      </div>
    </section>
  );
}