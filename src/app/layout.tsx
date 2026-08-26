import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DM_Sans, Kanit } from "next/font/google";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import "./globals.css";

const display = Kanit({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Jangada — Kanban do Ceará",
  description:
    "Kanban da Terra da Luz: boards, listas, cards e IA para a gestão pública cearense.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#04662e",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} min-h-full antialiased`}>
      <body className="min-h-dvh font-sans">
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
