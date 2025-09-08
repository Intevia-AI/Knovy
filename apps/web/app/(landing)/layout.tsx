import FooterSection from "@/components/footer";
import { HeroHeader } from "@/components/hero-header";
import { PageTransition } from "@/components/page-transition";

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HeroHeader />
      <PageTransition>{children}</PageTransition>
      <FooterSection />
    </>
  );
}
