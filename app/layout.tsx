import type { Metadata } from "next";
import {
  DM_Sans,
  DM_Mono,
  Instrument_Serif,
  Instrument_Sans,
} from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
const display = localFont({
  src: [
    { path: "./fonts/big-shoulders-display-800.ttf", weight: "800" },
    { path: "./fonts/big-shoulders-display-900.ttf", weight: "900" },
  ],
  variable: "--font-display",
  display: "swap",
});
const body = DM_Sans({ subsets: ["latin"], variable: "--font-body" });
const mono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-print-serif",
});
const print = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-print-body",
});
export const metadata: Metadata = {
  title: "PreMatch | Walk in ready.",
  description:
    "A source-backed briefing on the last 30 days. Know what changed, who matters, and what to ask before your next meeting.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${body.variable} ${mono.variable} ${serif.variable} ${print.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
