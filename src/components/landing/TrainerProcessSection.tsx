import Image from "next/image";

import type { LandingContent } from "../../content/landing-content.types";
import { ProcessSteps } from "./ProcessSteps";
import styles from "./TrainerProcessSection.module.css";

type TrainerProcessSectionProps = {
  content: LandingContent;
};

export function TrainerProcessSection({ content }: TrainerProcessSectionProps) {
  return (
    <section aria-labelledby="approach-title" className={styles.section}>
      <div className={styles.shell}>
        <div className={styles.approach}>
          <p className={styles.eyebrow}>{content.brandName}</p>
          <div className={styles.approachImage}>
            <Image
              alt={content.hero.imageAlt}
              className={styles.image}
              height={1400}
              sizes="(max-width: 767px) 100vw, 25vw"
              src="/images/hero-trainer.webp"
              width={1200}
            />
          </div>
          <h2 id="approach-title">{content.approach.title}</h2>
        </div>
        <div className={styles.process}>
          <p className={styles.eyebrow}>Как это работает</p>
          <ProcessSteps steps={content.process} />
        </div>
        <div aria-labelledby="lead-form-title" className={styles.formSlot} id="lead-form">
          <p className={styles.eyebrow}>Заявка</p>
          <h2 id="lead-form-title">{content.leadForm.title}</h2>
        </div>
      </div>
    </section>
  );
}
