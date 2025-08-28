import { Button } from "@workspace/ui/components/button";
import { Mail, SendHorizonal } from "lucide-react";
import { useLanguage } from "@/context/language-context";

export default function CallToAction() {
  const { t } = useLanguage();
  return (
    <section className="py-16 md:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <h2 className="text-balance text-4xl font-semibold lg:text-5xl">{t("cta.title")}</h2>
          <p className="mt-4 text-muted-foreground">{t("cta.description")}</p>

          <form action="" className="mx-auto mt-10 max-w-sm lg:mt-12">
            <div className="bg-background has-[input:focus]:ring-muted relative grid grid-cols-[1fr_auto] items-center rounded-[calc(var(--radius)+0.75rem)] border pr-3 shadow shadow-zinc-950/5 has-[input:focus]:ring-2">
              <Mail className="text-caption pointer-events-none absolute inset-y-0 left-5 my-auto size-5" />

              <input
                placeholder={t("cta.placeholder")}
                className="h-14 w-full bg-transparent pl-12 focus:outline-none"
                type="email"
              />

              <div className="md:pr-1.5 lg:pr-0">
                <Button aria-label="submit" className="rounded-(--radius)">
                  <span className="hidden md:block">{t("cta.button")}</span>
                  <SendHorizonal className="relative mx-auto size-5 md:hidden" strokeWidth={2} />
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
