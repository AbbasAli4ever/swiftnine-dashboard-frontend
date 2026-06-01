"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/university": {
    title: "Dashboard",
    subtitle: new Date().toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  },
  "/university/course-library": {
    title: "Course Library",
    subtitle: "Browse and enrol in courses",
  },
  "/university/my-learning": {
    title: "Now Playing",
    subtitle: "Information Security Essentials 2026",
  },
  "/university/certificates": {
    title: "Certificates",
    subtitle: "Your earned certificates",
  },
  "/university/reports": {
    title: "Reports",
    subtitle: "Learning analytics & insights",
  },
  "/university/settings": {
    title: "Settings",
    subtitle: "Manage your account and preferences",
  },
};

export default function UniversityHeader() {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const page = PAGE_TITLES[pathname] ?? {
    title: "University",
    subtitle: "SwiftNine University",
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 gap-4">
      {/* Page title */}
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">
          {page.title}
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {page.subtitle}
        </p>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden sm:block">
          <input
            type="text"
            placeholder="Search courses, topics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56 rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 pl-9 pr-4 py-2 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED]"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
          >
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Portal switcher */}
        <Link
          href="/portal-select"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          title="Switch portal"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 8h12M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Switch
        </Link>

        {/* Notifications */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5A4.5 4.5 0 0 0 3.5 6v2.5l-1.5 2h12l-1.5-2V6A4.5 4.5 0 0 0 8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M6.5 12.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </button>

        {/* Theme toggle */}
        <ThemeToggle />
      </div>
    </header>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  const toggle = () => {
    setDark(!dark);
    document.documentElement.classList.toggle("dark");
  };

  return (
    <button
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
    >
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.2 3.2l1.05 1.05M11.75 11.75l1.05 1.05M3.2 12.8l1.05-1.05M11.75 4.25l1.05-1.05" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  );
}
