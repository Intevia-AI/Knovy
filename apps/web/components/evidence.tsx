"use client";
"use client";

import { Annoyed, Search, BookOpen } from "lucide-react";
import { useLanguage } from "@/context/language-context";

export function Evidence() {
  const { t } = useLanguage();
  return (
    <div className="relative z-10 mx-auto max-w-5xl space-y-12 py-12 md:py-20 lg:py-24">
      <div className="space-y-6 text-center">
        <h2 className="text-balance text-3xl font-semibold lg:text-4xl text-center">
          {t("evidence.title")}
        </h2>
        <p className="text-lg text-muted-foreground text-center font-bold">{t("evidence.quote")}</p>
        <p className="text-lg text-muted-foreground">{t("evidence.description")}</p>
      </div>
      <div className="grid gap-8 md:grid-cols-3">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <span className="text-2xl font-semibold">{t("evidence.item1.numbers")}</span>
          </div>
          <h3 className="text-xl font-semibold">{t("evidence.item1.title")}</h3>
        </div>
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <span className="text-2xl font-semibold">{t("evidence.item2.numbers")}</span>
          </div>
          <h3 className="text-xl font-semibold">{t("evidence.item2.title")}</h3>
        </div>
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <span className="text-2xl font-semibold">{t("evidence.item3.numbers")}</span>
          </div>
          <h3 className="text-xl font-semibold">{t("evidence.item3.title")}</h3>
        </div>
      </div>
    </div>
  );
}
