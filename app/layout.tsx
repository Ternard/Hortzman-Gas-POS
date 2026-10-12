import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Hortzman Gas POS",
  description: "Point of sale for Hortzman Gas",
  appleWebApp: { capable: true, title: "Hortzman POS", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#ea580c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
