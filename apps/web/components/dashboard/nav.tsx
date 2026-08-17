"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/workflows", label: "Workflows" },
  { href: "/dashboard/executions", label: "Executions" },
  { href: "/dashboard/approvals", label: "Approvals" },
  { href: "/dashboard/billing", label: "Billing" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav() {
  const pathname = usePathname() || "/dashboard";

  return (
    <nav className="flex gap-1 overflow-x-auto px-4 pb-3">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "rounded-md bg-white/10 px-3 py-1.5 text-sm text-signal"
                : "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
            }
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/pricing"
        prefetch={false}
        className={
          pathname.startsWith("/pricing")
            ? "rounded-md bg-signal/10 px-3 py-1.5 text-sm text-signal"
            : "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
        }
      >
        Pricing
      </Link>
    </nav>
  );
}
