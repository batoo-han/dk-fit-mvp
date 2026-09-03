import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getServerEnv } from "../lib/config/env";
import "../styles/reset.css";
import "../styles/tokens.css";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const env = getServerEnv();

  return {
    title: "D&K Fit — персональные тренировки",
    description: "Персональные тренировки и консультация по записи.",
    alternates: { canonical: env.publicSiteUrl.href },
    icons: {
      icon: "/brand/favicon-32.png",
      apple: "/brand/apple-touch-icon.png",
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
