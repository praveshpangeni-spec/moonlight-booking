import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Moonlight Astrology — Book a Session",
  description: "Book your personal astrology consultation with Moonlight Astrology. Astrology for Better Life.",
  openGraph: {
    title: "Moonlight Astrology — Book a Session",
    description: "Get your personal astrology reading. Birth chart, career, love, compatibility and more.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#0d0f1f",
              color: "#e2e8f0",
              border: "1px solid #1e2140",
            },
            success: { iconTheme: { primary: "#f59e0b", secondary: "#000" } },
            error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
          }}
        />
      </body>
    </html>
  );
}
