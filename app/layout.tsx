import "./globals.css";

type RootLayoutProps = {
  children: React.ReactNode;
};

// Root layout is a pass-through — locale-specific <html>/<body>
// are rendered by app/[locale]/layout.tsx
export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return children as JSX.Element;
}
