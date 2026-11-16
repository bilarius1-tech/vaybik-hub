import { ThemeProvider } from "@/components/theme/ThemeProvider";
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const themeVariant =
  (process.env.NEXT_PUBLIC_THEME_VARIANT as "A" | "B" | "C" | undefined) ?? "A";

export const metadata: Metadata = {
  title: {
    default: "Вайбик — панель управления",
    template: "%s · Вайбик",
  },
  description: "Админка хаба сервисов Вайбик",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" data-theme={themeVariant} className={manrope.variable} suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased">
        <ThemeProvider defaultVariant={themeVariant}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
