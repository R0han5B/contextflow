import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Context Flow",
  description: "Document intelligence with retrieval, grounded answers, and a clean workflow for asking questions over uploaded PDFs.",
  keywords: ["Context Flow", "Document Q&A", "RAG", "MongoDB Atlas Vector Search", "Next.js", "FastAPI"],
  authors: [{ name: "Context Flow Team" }],
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
  openGraph: {
    title: "Context Flow",
    description: "A polished document Q&A experience powered by retrieval-augmented generation.",
    url: "http://localhost:3000",
    siteName: "Context Flow",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Context Flow",
    description: "A polished document Q&A experience powered by retrieval-augmented generation.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
