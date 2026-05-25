import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpotSmart Notizie",
  description: "Il tuo Hub Intelligente di Informazione in tempo reale. Cronaca, Mondo, Tecnologia, Finanza e Scienza in un'unica piattaforma innovativa.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  verification: {
    google: "kTDzVPr99eFI725NowhubyaubJoR05LNwT_H13tEW2k",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;800&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased bg-black text-slate-200 font-montserrat">
        {children}
      </body>
    </html>
  );
}
