"use client";
"use client";

import { Annoyed, Search, BookOpen } from "lucide-react";
import { useLanguage } from "@/context/language-context";

export function PainPoint() {
  const { t } = useLanguage();
  return (
    <div className="relative z-10 mx-auto max-w-5xl space-y-12 py-12 md:py-20 lg:py-24">
      <div className="space-y-6 text-center">
        <h2 className="text-balance text-3xl font-semibold lg:text-4xl text-center">
          {t("painpoint.title")}
        </h2>
        <p className="text-lg text-muted-foreground text-center font-bold">
          {t("painpoint.quote")}
        </p>
        <p className="text-lg text-muted-foreground">
          {t("painpoint.description")}
        </p>
      </div>
      <div className="grid gap-8 md:grid-cols-3">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Annoyed className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold">{t("painpoint.item1.title")}</h3>
          <p className="text-muted-foreground">{t("painpoint.item1.description")}</p>
        </div>
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Search className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold">{t("painpoint.item2.title")}</h3>
          <p className="text-muted-foreground">{t("painpoint.item2.description")}</p>
        </div>
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold">{t("painpoint.item3.title")}</h3>
          <p className="text-muted-foreground">{t("painpoint.item3.description")}</p>
        </div>
      </div>
    </div>
  );
}
