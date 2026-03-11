"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorBoundary({ reset }: ErrorProps): JSX.Element {
  const t = useTranslations("ErrorBoundary");

  return (
    <section className="card error-boundary-card">
      <h2>{t("title")}</h2>
      <p className="muted">{t("message")}</p>
      <div className="error-boundary-actions">
        <button type="button" className="btn primary" onClick={reset}>
          {t("retry")}
        </button>
        <Link className="btn secondary inline-btn" href="/dashboard">
          {t("backToDashboard")}
        </Link>
      </div>
    </section>
  );
}
