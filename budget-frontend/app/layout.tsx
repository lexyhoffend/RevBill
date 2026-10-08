import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { ConfirmProvider } from "@/components/ConfirmProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RevBill",
  description: "Track paycheck-cycle income and bills",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ConfirmProvider>{children}</ConfirmProvider>
        <footer className="mt-auto py-6 text-center text-xs text-slate-400 space-x-3">
          <Link href="/terms" className="hover:underline">Terms of Service</Link>
          <span aria-hidden>·</span>
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
        </footer>
      </body>
    </html>
  );
}
