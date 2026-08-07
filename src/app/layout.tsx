import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Lojistik İş Takibi",
  description: "Lojistik iş takip portalı",
};

// Sayfa boyanmadan temayı uygula (yanıp sönmeyi önler)
const themeScript = `
try {
  var t = localStorage.getItem('deren_theme');
  if (t) document.documentElement.setAttribute('data-theme', t);
} catch(e){}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
