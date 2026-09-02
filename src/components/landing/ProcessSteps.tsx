import type { LandingContent } from "../../content/landing-content.types";
import styles from "./ProcessSteps.module.css";

type ProcessStepsProps = {
  steps: LandingContent["process"];
};

export function ProcessSteps({ steps }: ProcessStepsProps) {
  return (
    <ol className={styles.steps} data-testid="process-steps">
      {steps.map((step) => (
        <li className={styles.step} key={step.title}>
          <h3>{step.title}</h3>
        </li>
      ))}
    </ol>
  );
}
