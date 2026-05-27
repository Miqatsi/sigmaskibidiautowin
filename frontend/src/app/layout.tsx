import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sima Arome — Manufacturing Platform',
  description: 'Enterprise-ready AI-powered manufacturing management system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
