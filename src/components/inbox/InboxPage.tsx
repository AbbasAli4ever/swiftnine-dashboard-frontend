"use client";

import React, { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────
type Tab = "primary" | "other" | "later" | "cleared";

type InboxItem = {
  id: string;
  icon: "clock" | "check" | "circle-dot";
  iconColor: string;
  title: string;
  author: string;
  authorInitials: string;
  authorColor: string;
  preview: string;
  commentCount?: number;
  date: string;
  group: "Yesterday" | "Earlier this month" | "March";
};

// ── Mock data ────────────────────────────────────────────────────────────────
const inboxItems: InboxItem[] = [
  {
    id: "1", group: "Yesterday",
    icon: "clock", iconColor: "text-gray-400",
    title: "Code Refactoring",
    author: "MR", authorInitials: "MR", authorColor: "bg-orange-400",
    preview: "github.com",
    date: "",
  },
  {
    id: "2", group: "Earlier this month",
    icon: "clock", iconColor: "text-purple-400",
    title: "Code refactoring Frontend",
    author: "Zeeshan Zafar", authorInitials: "ZZ", authorColor: "bg-teal-500",
    preview: "Zeeshan Zafar changed status To Do → In Progress",
    commentCount: 1,
    date: "Apr 3",
  },
  {
    id: "3", group: "March",
    icon: "check", iconColor: "text-green-500",
    title: "In the hero section I click on call gaia butt…",
    author: "Zeeshan Zafar", authorInitials: "ZZ", authorColor: "bg-teal-500",
    preview: "Zeeshan Zafar changed status To Do → Qa",
    commentCount: 1,
    date: "Mar 26",
  },
  {
    id: "4", group: "March",
    icon: "circle-dot", iconColor: "text-orange-400",
    title: "When I receive the invitation email, the He…",
    author: "Dania", authorInitials: "MR", authorColor: "bg-orange-400",
    preview: "@Dania I need HexaAI Logo url as the logo should be publicly acces…",
    commentCount: 5,
    date: "Mar 16",
  },
  {
    id: "5", group: "March",
    icon: "circle-dot", iconColor: "text-purple-400",
    title: "Dasboard and qr code list UI Issues",
    author: "AS", authorInitials: "AS", authorColor: "bg-indigo-500",
    preview: "this ticket is block due to the Search functionality….from bac",
    commentCount: 12,
    date: "Mar 9",
  },
  {
    id: "6", group: "March",
    icon: "check", iconColor: "text-green-500",
    title: "Archietechture Changes For eleven Labs in…",
    author: "MR", authorInitials: "MR", authorColor: "bg-orange-400",
    preview: "PRs: github.com",
    commentCount: 5,
    date: "Mar 9",
  },
  {
    id: "7", group: "March",
    icon: "check", iconColor: "text-green-500",
    title: "In grade 4 English Level 1 Meduim Questio…",
    author: "ZZ", authorInitials: "ZZ", authorColor: "bg-teal-500",
    preview: "In this case the the answer is -teen (teen with d",
    commentCount: 3,
    date: "Mar 6",
  },
  {
    id: "8", group: "March",
    icon: "check", iconColor: "text-green-500",
    title: "In Class 04 → Music Subject → Level 01 → l…",
    author: "ZZ", authorInitials: "ZZ", authorColor: "bg-teal-500",
    preview: "www.youtube.com This is the link to the video. It appears that the video has either been r",
    commentCount: 3,
    date: "Mar 6",
  },
  {
    id: "9", group: "March",
    icon: "circle-dot", iconColor: "text-purple-400",
    title: "Frontend Integration: Dashboard Analytics…",
    author: "AS", authorInitials: "AS", authorColor: "bg-indigo-500",
    preview: "block due to endpoint for \"Top-Performing QR Codes\" graph @Ahmad ali i required date c",
    commentCount: 6,
    date: "Mar 3",
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
      <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">Inbox Zero</h3>
      <p className="text-sm text-gray-400">Congratulations! You cleared your important notifications</p>

      {/* ClickTip */}
      <div className="mt-10 flex flex-col items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-300 dark:text-gray-600 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-0.5">ClickTip</span>
        <p className="text-sm text-gray-500 text-center max-w-xs leading-relaxed">
          Create a Reminder on the fly by pressing &apos;R&apos;<br />
          anywhere in your Workspace!
        </p>
        <button className="text-xs font-medium text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          Learn more
        </button>
      </div>
    </div>
  );
}

// ── Group divider ─────────────────────────────────────────────────────────────
function GroupLabel({ label }: { label: string }) {
  return (
    <div className="px-4 py-2 mt-2">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

// ── Single inbox row ──────────────────────────────────────────────────────────
function InboxRow({ item }: { item: InboxItem }) {
  const [hovered, setHovered] = useState(false);
  const [cleared, setCleared] = useState(false);

  if (cleared) return null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
    >
      {/* Status icon */}
      <div className="shrink-0">
        <StatusIcon type={item.icon} color={item.iconColor} />
      </div>

      {/* Title + preview */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{item.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white ${item.authorColor} shrink-0`}>
            {item.authorInitials.slice(0, 1)}
          </span>
          <p className="text-xs text-gray-400 truncate">{item.preview}</p>
        </div>
      </div>

      {/* Right: actions or meta */}
      <div className="shrink-0 flex items-center gap-2">
        {hovered ? (
          <>
            {/* Snooze */}
            <button
              title="Snooze"
              className="p-1 rounded-md text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors"
              onClick={(e) => { e.stopPropagation(); }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            </button>
            {/* Clear */}
            <button
              title="Clear"
              onClick={(e) => { e.stopPropagation(); setCleared(true); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Clear
            </button>
          </>
        ) : (
          <>
            {item.commentCount !== undefined && (
              <span className="text-xs text-gray-400">{item.commentCount}</span>
            )}
            {item.date && (
              <span className="text-xs text-gray-400 w-10 text-right">{item.date}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Content list ──────────────────────────────────────────────────────────────
function ContentList({ items }: { items: InboxItem[] }) {
  const groups = ["Yesterday", "Earlier this month", "March"] as const;

  return (
    <div className="flex flex-col">
      {/* Filter + Clear all bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <button className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
          </svg>
          Filter
        </button>
        <div className="flex items-center gap-2">
          <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-brand-500 transition-colors font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Clear all
          </button>
        </div>
      </div>

      {/* Grouped rows */}
      {groups.map((group) => {
        const groupItems = items.filter((i) => i.group === group);
        if (!groupItems.length) return null;
        return (
          <div key={group}>
            <GroupLabel label={group} />
            {groupItems.map((item) => <InboxRow key={item.id} item={item} />)}
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
              <span className="font-medium leading-none">{tab.label}</span>
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
