import type { Metadata } from "next";
import type { ReactNode } from "react";
import { branding } from "../lib/branding";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: `${branding.nombreApp} — Fidelización Digital`,
  description: branding.descripcionCorta,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
