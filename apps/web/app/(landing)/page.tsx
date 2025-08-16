import CallToAction from "@/components/call-to-action";
import { FeaturesSection } from "@/components/features";
import { HeroSection } from "@/components/hero-section";
import { IntegrationsSection } from "@/components/integrations";
import { TeamSection } from "@/components/team";
import { DemoSection } from "@/components/demo";

export default function Page() {
  return (
    <>
      <HeroSection />
      <DemoSection />
      <FeaturesSection />
      <IntegrationsSection />
      {/* <TeamSection /> */}
      {/* <CallToAction /> */}
    </>
  );
}
