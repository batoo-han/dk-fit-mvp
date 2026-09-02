import { HeroSection } from "../components/landing/HeroSection";
import { TrainerProcessSection } from "../components/landing/TrainerProcessSection";
import { landingContent } from "../content/landing.ru";

export default function Home() {
  return (
    <main>
      <HeroSection content={landingContent} />
      <TrainerProcessSection content={landingContent} />
    </main>
  );
}
