import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { siteConfig } from "@/lib/siteConfig";
import { buildPageAlternates } from "@/lib/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("Metadata");
  const alt = buildPageAlternates(locale, "/guide");
  return {
    title: t("guideTitle"),
    description: t("guideDescription"),
    alternates: { canonical: alt.canonical, languages: alt.languages },
    openGraph: { url: alt.url },
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<JSX.Element> {
  const { locale } = await params;
  const t = await getTranslations("GuidePage");

  const faqItems = [
    { question: t("faq1Q"), answer: t("faq1A") },
    { question: t("faq2Q"), answer: t("faq2A") },
    { question: t("faq3Q"), answer: t("faq3A") },
    { question: t("faq4Q"), answer: t("faq4A") },
    { question: t("faq5Q"), answer: t("faq5A") },
  ];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  const guideUrl =
    locale === "en"
      ? `${siteConfig.url}/guide`
      : `${siteConfig.url}/${locale}/guide`;

  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: t("howToName"),
    description: t("howToDescription"),
    inLanguage: locale,
    tool: [
      { "@type": "HowToTool", name: "A web browser" },
      { "@type": "HowToTool", name: "A microphone" },
    ],
    step: [
      {
        "@type": "HowToStep",
        name: t("step1"),
        text: t("gettingStartedDetails"),
      },
      {
        "@type": "HowToStep",
        name: t("step2"),
        text: t("manualDesc"),
      },
      {
        "@type": "HowToStep",
        name: t("step3"),
        text: t("gettingStartedDetails"),
      },
    ],
    totalTime: "PT10M",
    url: guideUrl,
  };

  return (
    <div className="guide">
      <JsonLd data={faqJsonLd} />
      <JsonLd data={howToJsonLd} />
      <header className="guide-header">
        <h2>{t("title")}</h2>
        <p>{t("subtitle")}</p>
      </header>

      {/* What is Shadowing? */}
      <section className="guide-section card">
        <h3>{t("whatIsShadowingTitle")}</h3>
        <p>{t("whatIsShadowingP1")}</p>
        <p>{t("whatIsShadowingP2")}</p>
      </section>

      {/* Getting Started */}
      <section className="guide-section card">
        <h3>{t("gettingStartedTitle")}</h3>
        <div className="steps-row">
          <div className="step-card">
            <span className="step-number">1</span>
            <h3>{t("step1")}</h3>
          </div>
          <div className="step-connector" />
          <div className="step-card">
            <span className="step-number">2</span>
            <h3>{t("step2")}</h3>
          </div>
          <div className="step-connector" />
          <div className="step-card">
            <span className="step-number">3</span>
            <h3>{t("step3")}</h3>
          </div>
        </div>
        <div className="guide-details">
          <p>{t("gettingStartedDetails")}</p>
        </div>
      </section>

      {/* Practice Modes */}
      <section className="guide-section">
        <h3 className="guide-section-title">{t("practiceModesTitle")}</h3>
        <div className="guide-card-grid">
          <div className="card guide-mode-card">
            <h4>{t("manualTitle")}</h4>
            <p>{t("manualDesc")}</p>
            <p className="guide-hint">{t("manualHint")}</p>
          </div>
          <div className="card guide-mode-card">
            <h4>{t("autoTitle")}</h4>
            <p>{t("autoDesc")}</p>
            <p className="guide-hint">{t("autoHint")}</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="guide-section">
        <h3 className="guide-section-title">{t("featuresTitle")}</h3>
        <div className="features-grid">
          <div className="card feature-card">
            <h3>{t("liveWaveformTitle")}</h3>
            <p>{t("liveWaveformDesc")}</p>
          </div>
          <div className="card feature-card">
            <h3>{t("waveformPlaybackTitle")}</h3>
            <p>{t("waveformPlaybackDesc")}</p>
          </div>
          <div className="card feature-card">
            <h3>{t("speedControlTitle")}</h3>
            <p>{t("speedControlDesc")}</p>
          </div>
          <div className="card feature-card">
            <h3>{t("transcriptToggleTitle")}</h3>
            <p>{t("transcriptToggleDesc", { key: "T" })}</p>
          </div>
          <div className="card feature-card">
            <h3>{t("progressTrackingTitle")}</h3>
            <p>{t("progressTrackingDesc")}</p>
          </div>
          <div className="card feature-card">
            <h3>{t("localFirstTitle")}</h3>
            <p>{t("localFirstDesc")}</p>
          </div>
        </div>
      </section>

      {/* Open Source & Privacy */}
      <section className="guide-section card" id="open-source">
        <h3>{t("openSourceTitle")}</h3>
        <p>{t("openSourceP1")}</p>
        <p>{t("openSourceP2")}</p>
        <p>{t("openSourceP3")}</p>
        <div style={{ marginTop: "1rem" }}>
          <a
            href="https://github.com/realzhangshen/shadowing_space"
            target="_blank"
            rel="noopener noreferrer"
            className="btn secondary open-source-btn"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            {t("viewOnGithub")}
          </a>
        </div>
      </section>

      {/* Keyboard Shortcuts */}
      <section className="guide-section card">
        <h3>{t("keyboardShortcutsTitle")}</h3>
        <table className="shortcuts-table">
          <thead>
            <tr>
              <th>{t("keyHeader")}</th>
              <th>{t("actionHeader")}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><kbd>Space</kbd></td><td>{t("shortcutSpace")}</td></tr>
            <tr><td><kbd>R</kbd></td><td>{t("shortcutR")}</td></tr>
            <tr><td><kbd>A</kbd></td><td>{t("shortcutA")}</td></tr>
            <tr><td><kbd>B</kbd></td><td>{t("shortcutB")}</td></tr>
            <tr><td><kbd>M</kbd></td><td>{t("shortcutM")}</td></tr>
            <tr><td><kbd>T</kbd></td><td>{t("shortcutT")}</td></tr>
            <tr><td><kbd>&larr;</kbd></td><td>{t("shortcutLeft")}</td></tr>
            <tr><td><kbd>&rarr;</kbd></td><td>{t("shortcutRight")}</td></tr>
          </tbody>
        </table>
      </section>

      {/* FAQ */}
      <section className="guide-section card">
        <h3>{t("faqTitle")}</h3>
        {faqItems.map((item, index) => (
          <details key={index} className="faq-item">
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
