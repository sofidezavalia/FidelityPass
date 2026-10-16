import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "FidelityPass — MVP",
  description: "Tarjetas de fidelidad digitales para comercios",
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
