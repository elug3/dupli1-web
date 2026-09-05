import { NotFoundPage } from "~/components/not-found";

export function meta() {
  return [
    { title: "Page not found | Dupli1" },
    {
      name: "description",
      content: "The requested Dupli1 page could not be found.",
    },
  ];
}

export default function NotFoundRoute() {
  return <NotFoundPage />;
}
