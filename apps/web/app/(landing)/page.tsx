import CallToAction from "@/components/call-to-action";
import { FeaturesSection } from "@/components/features";
import { HeroSection } from "@/components/hero-section";
import { WaitlistSection } from "@/components/waitlist-section";
import { IntegrationsSection } from "@/components/integrations";
import { TeamSection } from "@/components/team";
import { VideoDemo } from "@/components/video-demo";

export default function Page() {
  return (
    <>
      <HeroSection />
      <VideoDemo />
      <FeaturesSection />
      <IntegrationsSection />
      <WaitlistSection />
      {/* <TeamSection /> */}
      {/* <CallToAction /> */}
    </>
  );
}
