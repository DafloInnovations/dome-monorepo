import type { Metadata } from "next";
import "./globals.css";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";

export const metadata: Metadata = {
  title: { default: "Dome — Book Sports Facilities in Canada", template: "%s | Dome" },
  description: "Find and book sports courts, fields, and arenas across Canada. Badminton, tennis, soccer, basketball and more.",
  keywords: ["sports booking", "court booking", "sports facilities", "Canada", "badminton", "tennis", "soccer"],
  openGraph: {
    siteName: "Dome",
    type: "website",
    locale: "en_CA",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-black text-white">
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
