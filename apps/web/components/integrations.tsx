import { cn } from "@workspace/ui/lib/utils";
import Image from "next/image";

// Placeholder Logos for Meeting Software
const GoogleMeet = () => (
  <div className="flex items-center justify-center w-full h-full">
    <Image
      src="/meeting/google.png"
      alt="Google Meet"
      width={40}
      height={40}
      className="object-contain"
      priority
    />
  </div>
);
const Zoom = () => (
  <div className="flex items-center justify-center w-full h-full">
    <Image
      src="/meeting/zoom.png"
      alt="Zoom"
      width={40}
      height={40}
      className="object-contain"
      priority
    />
  </div>
);
const MicrosoftTeams = () => (
  <div className="flex items-center justify-center w-full h-full">
    <Image
      src="/meeting/ms_meeting.png"
      alt="Microsoft Teams"
      width={40}
      height={40}
      className="object-contain"
      priority
    />
  </div>
);
const Webex = () => (
  <div className="flex items-center justify-center w-full h-full">
    <Image
      src="/meeting/webex.png"
      alt="Webex"
      width={40}
      height={40}
      className="object-contain"
      priority
    />
  </div>
);
const InteviaLogo = () => (
  <div className="flex items-center justify-center w-full h-full">
    <Image
      src="/meeting/intevia_logo.png"
      alt="INTEVIA"
      width={40}
      height={40}
      className="object-contain"
      priority
    />
  </div>
);

export function IntegrationsSection() {
  return (
    <section>
      <div className="bg-muted dark:bg-background py-24 md:py-32">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid items-center gap-12 sm:grid-cols-2">
            <div className="dark:bg-muted/50 relative mx-auto w-fit">
              <div className="bg-radial to-muted dark:to-background absolute inset-0 z-10 from-transparent to-75%"></div>
              {/* Row 1 */}
              <div className="mx-auto mb-2 flex w-fit justify-center gap-2">
                <IntegrationCard>
                  <GoogleMeet />
                </IntegrationCard>
                <IntegrationCard>
                  <Zoom />
                </IntegrationCard>
              </div>
              {/* Row 2 - Centered Logo */}
              <div className="mx-auto my-2 flex w-fit justify-center gap-2">
                <IntegrationCard>
                  <MicrosoftTeams />
                </IntegrationCard>
                <IntegrationCard
                  borderClassName="shadow-black-950/10 shadow-xl border-black/25 dark:border-white/25"
                  className="dark:bg-white/10"
                >
                  <InteviaLogo />
                </IntegrationCard>
                <IntegrationCard>
                  <Webex />
                </IntegrationCard>
              </div>
              {/* Row 3 - AI Logos (Optional, can be kept or removed) */}
              {/* <div className="mx-auto flex w-fit justify-center gap-2">
                <IntegrationCard><Gemini /></IntegrationCard>
                <IntegrationCard><GooglePaLM /></IntegrationCard>
              </div> */}
            </div>
            <div className="mx-auto mt-6 max-w-lg space-y-6 text-center sm:mt-0 sm:text-left">
              <h2 className="text-balance text-3xl font-semibold md:text-4xl">
                適用於您常用的會議軟體
              </h2>
              <p className="text-muted-foreground">
                INTEVIA AI 在背景運作，並能無縫整合 Google Meet、Zoom、Microsoft
                Teams、Webex 等常用平台。
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const IntegrationCard = ({
  children,
  className,
  borderClassName,
}: {
  children: React.ReactNode;
  className?: string;
  borderClassName?: string;
}) => {
  return (
    <div
      className={cn(
        "bg-background relative flex size-16 rounded-xl dark:bg-transparent",
        className,
      )}
    >
      <div
        role="presentation"
        className={cn(
          "absolute inset-0 rounded-xl border border-black/20 dark:border-white/25",
          borderClassName,
        )}
      />
      <div className="relative z-20 m-auto size-fit">{children}</div>
    </div>
  );
};
