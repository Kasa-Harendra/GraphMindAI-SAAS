import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GraphMind AI — Knowledge Graph Intelligence",
  description: "Enterprise Multimodal Knowledge Graph Intelligence Platform. Transform your documents into intelligent knowledge graphs.",
};

import AuthProvider from "@/components/AuthProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap" rel="stylesheet" />
      </head>
      <body className={`font-sans font-medium tracking-tight antialiased h-full bg-background text-foreground`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
