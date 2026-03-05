import { useTranslations } from "next-intl";

export default function OfflinePage(): JSX.Element {
  const t = useTranslations("OfflinePage");

  return (
    <section className="card empty-state">
      <h2>{t("title")}</h2>
      <p className="muted">{t("message")}</p>
    </section>
  );
}
