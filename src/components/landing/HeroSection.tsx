import Image from "next/image";

import type { LandingContent } from "../../content/landing-content.types";
import { SiteHeader } from "./SiteHeader";
import styles from "./HeroSection.module.css";

type HeroSectionProps = {
  content: LandingContent;
};

export function HeroSection({ content }: HeroSectionProps) {
  return (
    <section aria-labelledby="hero-title" className={styles.hero}>
      <div className={styles.shell}>
        <SiteHeader brandName={content.brandName} />
        <div className={styles.grid}>
          <div className={styles.copy}>
            <h1 id="hero-title">{content.hero.title}</h1>
            <p>{content.hero.description}</p>
            <a className={styles.cta} href="#lead-form">
              {content.hero.ctaLabel}
            </a>
          </div>
          <div className={styles.portrait}>
            <p aria-hidden="true" className={styles.word}>
              FIT
            </p>
            <Image
              alt={content.hero.imageAlt}
              className={styles.image}
              height={1400}
              priority
              sizes="(max-width: 767px) 100vw, 58vw"
              src="/images/hero-trainer.webp"
              width={1200}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
