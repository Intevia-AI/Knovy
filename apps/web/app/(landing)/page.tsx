import CallToAction from "@/components/call-to-action";
import { FeaturesSection } from "@/components/features";
import { HeroSection } from "@/components/hero-section";
import { IntegrationsSection } from "@/components/integrations";
import { TeamSection } from "@/components/team";

export default function Page() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <IntegrationsSection />
      {/* <TeamSection /> */}
      {/* <CallToAction /> */}
    </>
  );
}
