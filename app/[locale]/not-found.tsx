import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFoundPage(): Promise<JSX.Element> {
  const t = await getTranslations("NotFoundPage");

  return (
    <section className="card not-found-card">
      <h2>{t("title")}</h2>
      <p className="muted">{t("message")}</p>
      <Link className="btn primary inline-btn" href="/">
        {t("backHome")}
      </Link>
    </section>
  );
}
