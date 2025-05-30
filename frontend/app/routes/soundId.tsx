import type { Route } from "./+types/home";
import SoundId from "../components/soundId/soundId";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "SoundID" },
    { name: "description", content: "Detect birds by sound." },
  ];
}

export default function SoundId_Route() {
  return <SoundId />;
}
