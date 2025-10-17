import type { Metadata } from "next";
import { Inter, Fira_Code } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";
import "./rainbowkit.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The DeFi Terminal",
  description: "The DeFi Terminal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${firaCode.variable} antialiased font-sans`}
        suppressHydrationWarning
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
