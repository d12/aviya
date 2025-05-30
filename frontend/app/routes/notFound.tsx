import type { Route } from "./+types/home";
import NotFound from "../components/notFound/notFound";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Not Found" },
    { name: "description", content: "Not Found" },
  ];
}

export default function NotFound_Route() {
  return <NotFound />;
}
