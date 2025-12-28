import type { Metadata } from "next";
import "./globals.css";
import { AppWrapper } from "@/components/AppWrapper";

export const metadata: Metadata = {
  title: "Athena - Smart Ad Video Analytics",
  description: "AI-powered ad video analysis and success prediction system. Upload videos, track performance, and get intelligent recommendations.",
  keywords: "ad analytics, video marketing, AI predictions, ROI optimization, ad performance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f0f1a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AppWrapper>
          {children}
        </AppWrapper>
      </body>
    </html>
  );
}
