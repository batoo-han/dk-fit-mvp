import type { ReactNode } from "react";

import "../styles/reset.css";
import "../styles/tokens.css";
import "./globals.css";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
