"use client";

import { useLanguage } from "@/context/language-context";
import Link from "next/link";

const TermsPage = () => {
  const { t } = useLanguage();

  const renderPrivacyLink = () => {
    const text = t("terms.privacy.p1");
    const parts = text.split(/<1>|<\/1>/);
    return (
      <>
        {parts[0]}
        <Link href="/privacy" className="underline hover:text-white">
          {parts[1]}
        </Link>
        {parts[2]}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground pt-24">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{t("terms.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("terms.lastUpdated")}</p>
          </div>

          <div className="bg-muted/30 p-6 rounded-lg border border-border space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4">
                {t("terms.acceptance.title")}
              </h2>
              <p className="text-muted-foreground">{t("terms.acceptance.p1")}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">
                {t("terms.serviceDescription.title")}
              </h2>
              <p className="mb-2 text-muted-foreground">{t("terms.serviceDescription.p1")}</p>
              <ul className="list-disc list-inside ml-4 text-muted-foreground">
                <li>{t("terms.serviceDescription.l1")}</li>
                <li>{t("terms.serviceDescription.l2")}</li>
                <li>{t("terms.serviceDescription.l3")}</li>
                <li>{t("terms.serviceDescription.l4")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">
                {t("terms.userObligations.title")}
              </h2>
              <p className="mb-2 text-muted-foreground">{t("terms.userObligations.p1")}</p>
              <ul className="list-disc list-inside ml-4 text-muted-foreground">
                <li>{t("terms.userObligations.l1")}</li>
                <li>{t("terms.userObligations.l2")}</li>
                <li>{t("terms.userObligations.l3")}</li>
                <li>{t("terms.userObligations.l4")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">
                {t("terms.usageRestrictions.title")}
              </h2>
              <p className="mb-2 text-muted-foreground">{t("terms.usageRestrictions.p1")}</p>
              <ul className="list-disc list-inside ml-4 text-muted-foreground">
                <li>{t("terms.usageRestrictions.l1")}</li>
                <li>{t("terms.usageRestrictions.l2")}</li>
                <li>{t("terms.usageRestrictions.l3")}</li>
                <li>{t("terms.usageRestrictions.l4")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">
                {t("terms.intellectualProperty.title")}
              </h2>
              <p className="mb-4 text-muted-foreground">{t("terms.intellectualProperty.p1")}</p>
              <p className="text-muted-foreground">{t("terms.intellectualProperty.p2")}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">{t("terms.privacy.title")}</h2>
              <p className="text-muted-foreground">{renderPrivacyLink()}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">
                {t("terms.serviceChanges.title")}
              </h2>
              <p className="text-muted-foreground">{t("terms.serviceChanges.p1")}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">
                {t("terms.disclaimer.title")}
              </h2>
              <p className="text-muted-foreground">{t("terms.disclaimer.p1")}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">
                {t("terms.liability.title")}
              </h2>
              <p className="text-muted-foreground">{t("terms.liability.p1")}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">
                {t("terms.governingLaw.title")}
              </h2>
              <p className="text-muted-foreground">{t("terms.governingLaw.p1")}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">
                {t("terms.termsChanges.title")}
              </h2>
              <p className="text-muted-foreground">{t("terms.termsChanges.p1")}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">{t("terms.contact.title")}</h2>
              <p className="text-muted-foreground">{t("terms.contact.p1")}</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;