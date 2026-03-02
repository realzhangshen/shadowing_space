"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/guide", label: "Guide" }
];

export function AppHeader(): JSX.Element {
  const pathname = usePathname();

  return (
    <header className="topbar">
      <div>
        <Link href="/" className="eyebrow-link">
          <p className="eyebrow">Shadowing Space</p>
        </Link>
        <h1>English Shadowing Practice</h1>
      </div>

      <nav className="topnav" aria-label="Main navigation">
        {links.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link key={item.href} href={item.href} className={active ? "nav-link active" : "nav-link"}>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
