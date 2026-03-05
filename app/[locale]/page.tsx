import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    title: t("homeTitle"),
    description: t("homeDescription"),
    alternates: { canonical: "/" },
  };
}

export default async function HomePage(): Promise<JSX.Element> {
  const t = await getTranslations("HomePage");

  return (
    <div className="homepage">
      <section className="hero">
        <span className="hero-badge">{t("badge")}</span>
        <h2 className="hero-title">
          {t("title")}
          <span className="hero-title-accent">{t("titleAccent")}</span>
        </h2>
        <p className="hero-subtitle">{t("subtitle")}</p>
        <div className="hero-actions">
          <Link href="/dashboard" className="btn primary hero-btn">
            {t("ctaDashboard")}
          </Link>
          <Link href="/guide" className="btn secondary hero-btn">
            {t("ctaGuide")}
          </Link>
        </div>
      </section>

      <section className="features-section">
        <div className="features-row">
          <div className="feature-card-home">
            <span className="feature-icon-home">&#9835;</span>
            <h3>{t("feature1Title")}</h3>
            <p>{t("feature1Desc")}</p>
          </div>
          <div className="feature-card-home">
            <span className="feature-icon-home">&#9654;</span>
            <h3>{t("feature2Title")}</h3>
            <p>{t("feature2Desc")}</p>
          </div>
          <div className="feature-card-home">
            <span className="feature-icon-home">&#9711;</span>
            <h3>{t("feature3Title")}</h3>
            <p>
              {t("feature3Desc")}{" "}
              <Link href="/guide#open-source" className="feature-link">
                {t("feature3Link")}
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
