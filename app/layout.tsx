import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";
import { SPLASH_SKIP_SCRIPT } from "@/lib/splash";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const title = "Cashly · Personal Finance";
const description = "Track accounts, budgets, credit cards, and subscriptions.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s · Cashly",
  },
  description,
  keywords: [
    "personal finance",
    "budgeting app",
    "net worth tracker",
    "subscription tracker",
    "credit card tracker",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description,
    siteName: "Cashly",
    type: "website",
    locale: "en_US",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cashly",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  // Set per request by the proxy. Both inline scripts below must carry it
  // or the CSP will block them before first paint.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang={locale}
      className={`${jakarta.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Decides before first paint whether the app-shell splash is shown
            at all. Rendered here because this is a Server Component: React
            warns about scripts rendered from Client Components, and this one
            has to execute during parse to be worth anything. */}
        {/* suppressHydrationWarning because the browser deliberately hides
            nonce values from DOM reads (it returns ""), so React sees the
            server's real nonce and the client's empty one as a mismatch. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: SPLASH_SKIP_SCRIPT }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            nonce={nonce}
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster richColors />
            <RegisterServiceWorker />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
