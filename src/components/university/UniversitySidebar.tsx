"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navMain = [
  {
    href: "/university",
    label: "Dashboard",
    exact: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="2" width="6" height="6" rx="1.5" fill="currentColor"/>
        <rect x="10" y="2" width="6" height="6" rx="1.5" fill="currentColor" fillOpacity="0.5"/>
        <rect x="2" y="10" width="6" height="6" rx="1.5" fill="currentColor" fillOpacity="0.5"/>
        <rect x="10" y="10" width="6" height="6" rx="1.5" fill="currentColor"/>
      </svg>
    ),
  },
  {
    href: "/university/course-library",
    label: "Course Library",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M3 4h12M3 9h12M3 14h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="14" cy="14" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M16 15.5l1.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "/university/my-learning",
    label: "My Learning",
    badge: 3,
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M7 6.5l5 2.5-5 2.5V6.5z" fill="currentColor"/>
      </svg>
    ),
  },
  {
    href: "/university/certificates",
    label: "Certificates",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M6 16h6M9 13v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M6 8h6M6 10.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const navManage = [
  {
    href: "/university/reports",
    label: "Reports",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M3 14l3-4 3 2 3-5 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: "/university/settings",
    label: "Settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M9 2v1.5M9 14.5V16M2 9h1.5M14.5 9H16M4.1 4.1l1.05 1.05M12.85 12.85l1.05 1.05M4.1 13.9l1.05-1.05M12.85 5.15l1.05-1.05" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

function NavItem({
  href,
  label,
  icon,
  badge,
  exact,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        isActive
          ? "bg-[#7C3AED] text-white"
          : "text-gray-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className={isActive ? "text-white" : "text-gray-400"}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#7C3AED] text-xs text-white font-semibold">
          {badge}
        </span>
      )}
    </Link>
  );
}

export default function UniversitySidebar() {
  const { user, logout } = useAuth();

  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "AR";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col bg-[#1E1B2E]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7C3AED]">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5L1.5 5v6L8 14.5 14.5 11V5L8 1.5z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M8 1.5v13M1.5 5l6.5 4 6.5-4" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="leading-none">
          <p className="text-xs font-bold text-white tracking-wide">SwiftNine</p>
          <p className="text-[10px] font-medium text-[#7C3AED] tracking-widest uppercase">University</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        <div>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            Main
          </p>
          <div className="space-y-0.5">
            {navMain.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            Manage
          </p>
          <div className="space-y-0.5">
            {navManage.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        </div>
      </nav>

      {/* User */}
      <div className="border-t border-white/10 px-3 py-4">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7C3AED] text-xs font-semibold text-white flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {user?.fullName ?? "User"}
            </p>
            <p className="truncate text-xs text-gray-400">
              {user?.email ?? ""}
            </p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
