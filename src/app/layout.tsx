import type { Metadata, Viewport } from "next";
import { Inter_Tight, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ToastContext";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
});

export const metadata: Metadata = {
  title: "EdDesk Communication Suite",
  description: "Your school's report card centre: send formatted report cards to parents on WhatsApp and track every delivery.",
  icons: {
    icon: "/logo-icon-1.jpeg",
    apple: "/logo-icon-1.jpeg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${interTight.variable} ${instrumentSans.variable} font-sans antialiased`}
        suppressHydrationWarning={true}
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
