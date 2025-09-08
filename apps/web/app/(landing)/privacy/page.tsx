"use client";

import { useLanguage } from "@/context/language-context";

const PrivacyPage = () => {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-background text-foreground pt-24">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{t("privacy.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("privacy.lastUpdated")}</p>
          </div>

          <div className="bg-muted/30 p-6 rounded-lg border border-border space-y-8">
            {/* Overview */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">{t("privacy.overview.title")}</h2>
              <p className="text-muted-foreground">{t("privacy.overview.p1")}</p>
            </section>

            {/* Data Collection */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">{t("privacy.dataCollection.title")}</h2>

              <h3 className="text-xl font-semibold mt-4 mb-2">
                {t("privacy.dataCollection.userProvided.title")}
              </h3>
              <ul className="list-disc list-inside ml-4 text-muted-foreground">
                <li>{t("privacy.dataCollection.userProvided.l1")}</li>
                <li>{t("privacy.dataCollection.userProvided.l2")}</li>
              </ul>
              <p className="mt-2 text-muted-foreground/80">
                {t("privacy.dataCollection.userProvided.p1")}
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-2">
                {t("privacy.dataCollection.automated.title")}
              </h3>
              <p className="text-muted-foreground">{t("privacy.dataCollection.automated.p1")}</p>

              <h3 className="text-xl font-semibold mt-4 mb-2">
                {t("privacy.dataCollection.content.title")}
              </h3>
              <p className="text-muted-foreground">{t("privacy.dataCollection.content.p1")}</p>
            </section>

            {/* Data Usage */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">{t("privacy.dataUsage.title")}</h2>
              <p className="mb-2 text-muted-foreground">{t("privacy.dataUsage.p1")}</p>
              <ul className="list-disc list-inside ml-4 text-muted-foreground">
                <li>{t("privacy.dataUsage.l1")}</li>
                <li>{t("privacy.dataUsage.l2")}</li>
                <li>{t("privacy.dataUsage.l3")}</li>
                <li>{t("privacy.dataUsage.l4")}</li>
                <li>{t("privacy.dataUsage.l5")}</li>
                <li>{t("privacy.dataUsage.l6")}</li>
              </ul>
            </section>

            {/* Data Sharing */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">{t("privacy.dataSharing.title")}</h2>
              <p className="mb-2 text-muted-foreground">{t("privacy.dataSharing.p1")}</p>
              <ul className="list-disc list-inside ml-4 text-muted-foreground">
                <li dangerouslySetInnerHTML={{ __html: t("privacy.dataSharing.l1") }} />
                <li dangerouslySetInnerHTML={{ __html: t("privacy.dataSharing.l2") }} />
                <li dangerouslySetInnerHTML={{ __html: t("privacy.dataSharing.l3") }} />
              </ul>
            </section>

            {/* Data Security */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">{t("privacy.security.title")}</h2>
              <p className="text-muted-foreground">{t("privacy.security.p1")}</p>
            </section>

            {/* User Rights */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">{t("privacy.userRights.title")}</h2>
              <p className="mb-2 text-muted-foreground">{t("privacy.userRights.p1")}</p>
              <ul className="list-disc list-inside ml-4 text-muted-foreground">
                <li dangerouslySetInnerHTML={{ __html: t("privacy.userRights.l1") }} />
                <li dangerouslySetInnerHTML={{ __html: t("privacy.userRights.l2") }} />
              </ul>
            </section>

            {/* Cookies */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">{t("privacy.cookies.title")}</h2>
              <p className="text-muted-foreground">{t("privacy.cookies.p1")}</p>
            </section>

            {/* Third-Party */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">{t("privacy.thirdParty.title")}</h2>
              <p className="text-muted-foreground">{t("privacy.thirdParty.p1")}</p>
            </section>

            {/* Policy Changes */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">{t("privacy.policyChanges.title")}</h2>
              <p className="text-muted-foreground">{t("privacy.policyChanges.p1")}</p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">{t("privacy.contact.title")}</h2>
              <p className="text-muted-foreground">{t("privacy.contact.p1")}</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
