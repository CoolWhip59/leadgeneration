import './globals.css';

export const metadata = {
  title: 'Isletme Lead Dashboard',
  description: 'Lead generation for businesses without websites',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
