import FooterSection from "@/components/footer";
import { HeroHeader } from "@/components/hero-header";

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HeroHeader />
      {children}
      <FooterSection />
    </>
  );
}
