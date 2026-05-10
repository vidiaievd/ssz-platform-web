import type { Metadata } from 'next';
import { JetBrains_Mono, Lora, Plus_Jakarta_Sans } from 'next/font/google';

import '@/styles/globals.css';

const fontUI = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

const fontReading = Lora({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-lora',
  display: 'swap',
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ssz-platform',
  description: 'Learning platform for tutors, schools, and students.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontUI.variable} ${fontReading.variable} ${fontMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
