import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Revenue Rescue AI — Autonomous Revenue Recovery',
  description:
    'AI-powered revenue recovery agent that detects at-risk revenue, diagnoses the cause, and executes safe recovery actions through Razorpay.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <div className="flex min-h-screen bg-background">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <Topbar />
            <main className="flex-1 overflow-y-auto scrollbar-thin">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
