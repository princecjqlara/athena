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
