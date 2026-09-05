import { useLanguage } from "~/lib/i18n";

export function meta() {
  return [
    { title: "History | Dupli1" },
    { name: "description", content: "View recent browsing history." },
  ];
}

export default function History() {
  const { t } = useLanguage();

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <h1 className="text-2xl font-semibold">{t("history.title")}</h1>
    </main>
  );
}
