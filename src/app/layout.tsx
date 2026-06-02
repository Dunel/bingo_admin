import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastProvider, Toaster } from "@/components/ui/toast";
import { ConfirmProvider } from "@/hooks/use-confirm";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bingo Admin",
  description: "Administración de usuarios y cartas de bingo con IA",
};

const themeInitScript = `(function(){try{var t=localStorage.getItem('bingo-theme:v1');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ToastProvider>
          <ConfirmProvider>
            <ThemeToggle />
            <div className="flex-1 flex flex-col">{children}</div>
            <footer className="mt-auto border-t border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4 text-center text-xs font-semibold tracking-wide text-[var(--color-fg-muted)]">
              Copyright by dunel 2026
            </footer>
            <Toaster />
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
