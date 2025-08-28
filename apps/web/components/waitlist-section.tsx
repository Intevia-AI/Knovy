"use client";

import { WaitlistForm } from "./waitlist-form";
import { useLanguage } from "@/context/language-context";

export function WaitlistSection() {
  const { t } = useLanguage();
  return (
    <section className="py-16 md:py-24 px-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t("waitlist.title")}
        </h2>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">{t("waitlist.description")}</p>
        <div className="mt-8 flex justify-center">
          <WaitlistForm />
        </div>
      </div>
    </section>
  );
}
