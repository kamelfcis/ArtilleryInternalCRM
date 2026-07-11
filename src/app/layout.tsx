import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

/**
 * Root layout. The entire application is Arabic and right-to-left; this is set
 * once here (lang="ar", dir="rtl") and inherited everywhere. Cairo is a clean,
 * highly legible Arabic typeface appropriate for a government portal.
 */
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "نظام إدارة الوثائق - قسم الاحتياجات",
    template: "%s | نظام إدارة الوثائق",
  },
  description:
    "نظام إدارة الوثائق وعلاقات الجهات لقسم الاحتياجات بإدارة المدفعية",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#1c3f76",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body>{children}</body>
    </html>
  );
}
