"use client";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useProfileStore } from "@/hooks/useProfile";
import { useUiStore } from "@/stores/ui.store";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { getInitials } from "@/lib/getInitials";
import GlobalTaskSearchModal from "@/components/header/GlobalTaskSearchModal";

const AppHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { openProfilePanel } = useUiStore();
  const { profile, fetch: fetchProfile } = useProfileStore();
  const status = profile?.status ?? "OFFLINE";

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchAnchor, setSearchAnchor] = useState<DOMRect | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);

  // Ctrl/Cmd+K focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchAnchor(searchBarRef.current?.getBoundingClientRect() ?? null);
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = getInitials(user?.fullName);
  const avatarColor = user?.avatarColor ?? "#6366f1";

  return (
    <header className="sticky top-0 z-40 flex items-center h-14 px-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      {/* Centered search */}
      <div className="flex-1 flex justify-center">
        <div ref={searchBarRef} className="relative w-full max-w-[480px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="text"
            readOnly
            placeholder="Search"
            onFocus={() => {
              setSearchAnchor(searchBarRef.current?.getBoundingClientRect() ?? null);
              setSearchOpen(true);
            }}
            onClick={() => {
              setSearchAnchor(searchBarRef.current?.getBoundingClientRect() ?? null);
              setSearchOpen(true);
            }}
            className="w-full h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 pl-9 pr-20 text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-colors"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[11px] text-gray-400 font-normal bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5 pointer-events-none">
            Ctrl K
          </span>
        </div>
      </div>

      {/* Right: theme toggle + avatar */}
      <div className="relative flex items-center gap-3 ml-4" ref={menuRef}>
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="flex items-center justify-center w-8 h-8 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {theme === "dark" ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m8.66-9h-1M4.34 12h-1m15.07-6.36-.71.71M6.34 17.66l-.71.71m12.73 0-.71-.71M6.34 6.34l-.71-.71M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* Avatar — opens dropdown */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="relative flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-normal hover:ring-2 hover:ring-brand-300 transition-all"
          style={{ backgroundColor: avatarColor }}
          aria-label="Profile menu"
        >
          {initials}
          <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 ${status === "ONLINE" ? "bg-green-500" : "bg-gray-400"}`} />
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <div className="absolute right-0 top-11 w-72 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 z-50 overflow-y-auto max-h-[calc(100vh-64px)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

            {/* User header */}
            <div className="group flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-gray-800">
              <div
                className="relative w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-normal shrink-0"
                style={{ backgroundColor: avatarColor }}
              >
                {initials}
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 ${status === "ONLINE" ? "bg-green-500" : "bg-gray-400"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-normal text-gray-800 dark:text-gray-100 truncate">{user?.fullName ?? "User"}</p>
                <p className={`text-xs font-normal ${status === "ONLINE" ? "text-green-500" : "text-gray-400"}`}>
                  {status === "ONLINE" ? "Online" : "Offline"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); openProfilePanel(); }}
                className="invisible group-hover:visible shrink-0 rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-normal text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Profile
              </button>
            </div>

            {/* Menu items */}
            <div className="py-1.5 px-1.5 space-y-0.5 border-b border-gray-100 dark:border-gray-800">
              <DropItem icon="settings" label="Settings" onClick={() => { setMenuOpen(false); router.push("/settings"); }} />
            </div>

            {/* Footer */}
            <div className="py-1.5 px-1.5 space-y-0.5">
              <DropItem icon="logout" label="Log out" onClick={() => { setMenuOpen(false); logout(); }} danger />
            </div>
          </div>
        )}
      </div>

      <GlobalTaskSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} anchorRect={searchAnchor} />
    </header>
  );
};

type DropItemProps = {
  icon: string;
  label: string;
  onClick?: () => void;
  danger?: boolean;
};

function DropItem({ icon, label, onClick, danger }: DropItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
        danger
          ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      <span className="w-4 h-4 shrink-0 flex items-center justify-center text-gray-400">
        <DropIcon name={icon} />
      </span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}

function DropIcon({ name }: { name: string }) {
  const cls = "w-4 h-4";
  switch (name) {
    case "settings":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case "logout":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>;
    default:
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="4" /></svg>;
  }
}

export default AppHeader;
