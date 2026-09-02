import Image from "next/image";

import styles from "./SiteHeader.module.css";

type SiteHeaderProps = {
  brandName: string;
};

export function SiteHeader({ brandName }: SiteHeaderProps) {
  return (
    <header className={styles.header}>
      <a className={styles.brand} href="#lead-form">
        <Image alt="" aria-hidden="true" height={32} priority src="/brand/favicon-32.png" width={32} />
        <span>{brandName}</span>
      </a>
    </header>
  );
}
