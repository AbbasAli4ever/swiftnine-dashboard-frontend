"use client";

import React, { useState } from "react";
import { LuSettings2, LuCheck, LuMessageSquare, LuClock, LuListFilter } from "react-icons/lu";

// ── Types ────────────────────────────────────────────────────────────────────
type Tab = "primary" | "other" | "later" | "cleared";

type InboxItem = {
  id: string;
  icon: "clock" | "check" | "circle-dot";
  iconColor: string;
  title: string;
  authorName: string;
  authorInitials: string;
  authorColor: string;
  action: string;
  commentCount?: number;
  date: string;
  group: "Today" | "Last 7 days";
};

// ── Mock data ────────────────────────────────────────────────────────────────
const inboxItems: InboxItem[] = [
  {
    id: "1", group: "Today",
    icon: "circle-dot", iconColor: "text-gray-400",
    title: "Project List UI & API Integration",
    authorName: "Dania Tariq", authorInitials: "DT", authorColor: "bg-violet-500",
    action: "assigned this task to you",
    commentCount: 2,
    date: "1:01 PM",
  },
  {
    id: "2", group: "Last 7 days",
    icon: "check", iconColor: "text-green-500",
    title: "Custom Task Statuses API integration with…",
    authorName: "Dania Tariq", authorInitials: "DT", authorColor: "bg-violet-500",
    action: "assigned this task to you",
    commentCount: 4,
    date: "Apr 17",
  },
  {
    id: "3", group: "Last 7 days",
    icon: "circle-dot", iconColor: "text-gray-400",
    title: "Task List API Integration",
    authorName: "Dania Tariq", authorInitials: "DT", authorColor: "bg-violet-500",
    action: "assigned this task to you",
    commentCount: 4,
    date: "Apr 17",
  },
  {
    id: "4", group: "Last 7 days",
    icon: "circle-dot", iconColor: "text-gray-400",
    title: "Frontend: Subtask Management",
    authorName: "Dania Tariq", authorInitials: "DT", authorColor: "bg-violet-500",
    action: "assigned this task to you",
    commentCount: 2,
    date: "Apr 17",
  },
  {
    id: "5", group: "Last 7 days",
    icon: "circle-dot", iconColor: "text-gray-400",
    title: "User Profile Integrations",
    authorName: "Dania Tariq", authorInitials: "DT", authorColor: "bg-violet-500",
    action: "assigned this task to you",
    commentCount: 3,
    date: "Apr 17",
  },
  {
    id: "6", group: "Last 7 days",
    icon: "circle-dot", iconColor: "text-gray-400",
    title: "Task Management UI and Integration",
    authorName: "Dania Tariq", authorInitials: "DT", authorColor: "bg-violet-500",
    action: "assigned this task to you",
    commentCount: 2,
    date: "Apr 17",
  },
  {
    id: "7", group: "Last 7 days",
    icon: "check", iconColor: "text-green-500",
    title: "Workspace flow changes with multiple user",
    authorName: "Dania Tariq", authorInitials: "DT", authorColor: "bg-violet-500",
    action: "set due date to Apr 17",
    date: "Apr 17",
  },
];

// ── Sub-icons ────────────────────────────────────────────────────────────────
function StatusIcon({ type, color }: { type: InboxItem["icon"]; color: string }) {
  if (type === "clock") return (
    <svg className={`w-4 h-4 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  if (type === "check") return (
    <svg className={`w-4 h-4 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  return (
    <svg className={`w-4 h-4 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

// ── Tab config ───────────────────────────────────────────────────────────────
const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: string }[] = [
  {
    id: "primary", label: "Primary", count: "27 unread",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
      </svg>
    ),
  },
  {
    id: "other", label: "Other", count: "99+ unread",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    id: "later", label: "Later",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "cleared", label: "Cleared",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-24 select-none">
      {/* Envelope illustration */}
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
          <svg className="w-12 h-12 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4} d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z" />
          </svg>
        </div>
        {/* Blue badge top-right */}
        <div className="absolute -top-1 -right-1 w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow-md">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
            <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
          </svg>
        </div>
      </div>
      <h3 className="text-base font-normal text-gray-800 dark:text-gray-100 mb-1">Inbox Zero</h3>
      <p className="text-sm text-gray-400">Congratulations! You cleared your important notifications</p>

      {/* ClickTip */}
      <div className="mt-10 flex flex-col items-center gap-3">
        <span className="text-[11px] font-normal uppercase tracking-widest text-gray-300 dark:text-gray-600 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-0.5">ClickTip</span>
        <p className="text-sm text-gray-500 text-center max-w-xs leading-relaxed">
          Create a Reminder on the fly by pressing &apos;R&apos;<br />
          anywhere in your Workspace!
        </p>
        <button className="text-xs font-normal text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          Learn more
        </button>
      </div>
    </div>
  );
}

// ── Single inbox row ──────────────────────────────────────────────────────────
function InboxRow({ item, isLast }: { item: InboxItem; isLast: boolean }) {
  const [cleared, setCleared] = useState(false);

  if (cleared) return null;

  return (
    <div
      className={`group grid grid-cols-[20px_minmax(0,1fr)_minmax(0,1.2fr)_160px] items-center gap-5 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors ${!isLast ? "border-b border-gray-100 dark:border-gray-800" : ""}`}
    >
      {/* Status icon */}
      <div className="shrink-0 flex items-center justify-center">
        <StatusIcon type={item.icon} color={item.iconColor} />
      </div>

      {/* Title */}
      <p className="text-sm text-gray-800 dark:text-gray-100 truncate">{item.title}</p>

      {/* Author + action */}
      <div className="flex items-center gap-2 min-w-0">
        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] text-white shrink-0 ${item.authorColor}`}>
          {item.authorInitials.slice(0, 1)}
        </span>
        <p className="text-xs truncate">
          <span className="text-gray-700 dark:text-gray-300">{item.authorName}</span>
          {" "}<span className="text-brand-500">{item.action}</span>
        </p>
      </div>

      {/* Right col — always 160px, both layers always in DOM, CSS toggles visibility */}
      <div className="relative flex items-center justify-end w-full h-6">
        {/* Default: comment count + date — hidden on hover */}
        <div className="absolute inset-0 flex items-center justify-end gap-2 group-hover:opacity-0 group-hover:pointer-events-none transition-opacity">
          {item.commentCount !== undefined && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-gray-300 dark:border-gray-600 text-[11px] text-gray-500 dark:text-gray-400 shrink-0">
              {item.commentCount}
            </span>
          )}
          {item.date && (
            <span className="text-xs text-gray-400 whitespace-nowrap">{item.date}</span>
          )}
        </div>

        {/* Hover: action buttons — hidden by default */}
        <div className="absolute inset-0 flex items-center justify-end gap-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
          <button
            title="Message"
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <LuMessageSquare className="w-4 h-4" />
          </button>
          <button
            title="Snooze"
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <LuClock className="w-4 h-4" />
          </button>
          <button
            title="Clear"
            onClick={(e) => { e.stopPropagation(); setCleared(true); }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-brand-500 text-white text-xs hover:bg-brand-600 transition-colors"
          >
            <LuCheck className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Content list ──────────────────────────────────────────────────────────────
function ContentList({ items }: { items: InboxItem[] }) {
  const groups = ["Today", "Last 7 days"] as const;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Filter + Clear all bar */}
      <div className="flex items-center justify-between">
        <button className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
          <LuListFilter className="w-4 h-4" />
          Filter
        </button>
        <div className="flex items-center gap-3">
          <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <LuSettings2 className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-brand-500 transition-colors">
            <LuCheck className="w-4 h-4" />
            Clear all
          </button>
        </div>
      </div>

      {/* Grouped tables */}
      {groups.map((group) => {
        const groupItems = items.filter((i) => i.group === group);
        if (!groupItems.length) return null;
        return (
          <div key={group}>
            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400 px-1">{group}</p>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
              {groupItems.map((item, idx) => (
                <InboxRow key={item.id} item={item} isLast={idx === groupItems.length - 1} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main InboxPage ────────────────────────────────────────────────────────────
export default function InboxPage() {
  const [activeTab, setActiveTab] = useState<Tab>("primary");

  // "primary" has content, others show empty state
  const hasContent = activeTab === "primary";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 4-tab bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 shrink-0">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-3.5 px-2 text-sm transition-colors border-b-2
                ${isActive
                  ? "border-brand-500 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
            >
              <span className={`${isActive ? "text-brand-500" : "text-gray-400"}`}>{tab.icon}</span>
              <span className="font-normal leading-none">{tab.label}</span>
              {tab.count && (
                <span className={`text-[11px] leading-none ${isActive ? "text-brand-400" : "text-gray-400"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {hasContent ? <ContentList items={inboxItems} /> : <EmptyState />}
      </div>
    </div>
  );
}
