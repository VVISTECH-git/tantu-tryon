import type { Metadata } from "next";
import { Onest, Prata } from "next/font/google";
import "./globals.css";

const onest = Onest({ variable: "--font-onest", subsets: ["latin"] });

const prata = Prata({ variable: "--font-prata", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: {
    default: "Tantu — model-worn catalogue imagery from real garment photographs",
    template: "%s · Tantu",
  },
  description:
    "Photograph the pallu, the body and the border. Tantu renders a model wearing that exact garment — without inventing the motif.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The font variables belong on <html>: globals.css declares --font-sans on
    // :root, and a custom property is substituted on the element that declares
    // it. With these on <body> instead, var(--font-onest) is undefined up here,
    // --font-sans becomes invalid at computed-value time, and every page
    // silently renders in the browser's UI stack.
    <html lang="en" className={`${onest.variable} ${prata.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
