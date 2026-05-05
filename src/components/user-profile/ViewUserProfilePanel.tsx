"use client";

import { useEffect, useState } from "react";
import { getInitials } from "@/lib/getInitials";
import { userService } from "@/services/user.service";
import { UserProfile } from "@/hooks/useProfile";

interface Props {
  userId: string | null;
  onClose: () => void;
}

type Tab = "Activity" | "Tasks" | "Comments" | "Calendar";

const MOCK_ACTIVITY = [
  { id: "a1", text: "Task 1", sub: "Team Space / Project 1", time: "1 hour ago", type: "task" },
  { id: "a2", text: "You tracked time", sub: "1m on Apr 10", time: "1 hour ago", type: "time" },
  { id: "a3", text: "You tracked time", sub: "1m on Apr 10", time: "1 hour ago", type: "time" },
  { id: "a4", text: "You changed status from To Do to ●", sub: "", time: "1 hour ago", type: "status" },
  { id: "a5", text: "You added follower: Numan Zafar", sub: "", time: "2:02 pm", type: "follower" },
  { id: "a6", text: "You assigned to: Numan Zafar", sub: "", time: "2:02 pm", type: "assign" },
];

const MOCK_TASKS = [
  { id: "t1", title: "Task 1", status: "In Progress", project: "Project 1" },
  { id: "t2", title: "Task 2", status: "To Do", project: "Project 2" },
];

export default function ViewUserProfilePanel({ userId, onClose }: Props) {
  const isOpen = Boolean(userId);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Activity");

  useEffect(() => {
    if (!userId) { setProfile(null); return; }
    setLoading(true);
    userService.getById(userId)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  const displayName = profile?.fullName ?? "User";
  const initials = getInitials(displayName);
  const status = profile?.status ?? "ONLINE";
  const localTime = profile?.localTime;

  const tabs: { label: string; key: Tab; count?: number }[] = [
    { label: "Activity", key: "Activity" },
    { label: "Tasks", key: "Tasks", count: MOCK_TASKS.length },
    { label: "Comments", key: "Comments", count: 0 },
    { label: "Calendar", key: "Calendar" },
  ];

  return (
    <div
      className={`h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden transition-all duration-200 ease-in-out shrink-0 ${
        isOpen ? "w-80" : "w-0"
      }`}
    >
      {isOpen && (
        <>
          {/* Close button row */}
          <div className="flex items-center justify-end px-4 py-2.5 shrink-0">
            <button
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
              </div>
            ) : !profile ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-sm text-gray-400">Could not load profile</p>
              </div>
            ) : (
              <>
                {/* Avatar section */}
                <div className="px-5 pb-4">
                  {/* Large avatar */}
                  <div
                    className="w-[72px] h-[72px] rounded-lg flex items-center justify-center text-white text-2xl font-normal mb-3"
                    style={{ backgroundColor: "#6366f1" }}
                  >
                    {initials}
                  </div>

                  {/* Name + chevron */}
                  <div className="flex items-center gap-1 mb-0.5">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">{displayName}</h3>
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* Description placeholder */}
                  <p className="text-xs italic text-gray-400 dark:text-gray-500 mb-2">
                    {profile.bio || "Add description..."}
                  </p>

                  {/* Status */}
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className={`w-2 h-2 rounded-full ${status === "ONLINE" ? "bg-green-500" : "bg-gray-400"}`} />
                    <span className={`text-xs font-normal ${status === "ONLINE" ? "text-green-500" : "text-gray-400"}`}>
                      {status === "ONLINE" ? "Online" : "Offline"}
                    </span>
                  </div>

                  {/* Get StandUp button */}
                  <button className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <span className="text-brand-500">●</span>
                    Get StandUp
                  </button>
                </div>

                {/* Info rows */}
                <div className="px-5 py-3 space-y-2.5 border-t border-gray-100 dark:border-gray-800">
                  {/* Email */}
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    <span className="truncate text-xs">{profile.email}</span>
                  </div>

                  {/* Local time */}
                  {localTime && (
                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs">{localTime} local time</span>
                    </div>
                  )}

                  {/* Select manager */}
                  <div className="flex items-center gap-3 text-sm text-gray-400 dark:text-gray-500">
                    <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                    <button className="text-xs italic text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                      Select manager
                      <svg className="w-3 h-3 inline ml-1 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Priorities section */}
                <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Priorities</span>
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                      </svg>
                    </div>
                    <button className="text-xs text-brand-500 hover:text-brand-600 transition-colors font-medium">+ Add</button>
                  </div>
                  <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 px-3 py-4 text-center">
                    <p className="text-xs italic text-gray-400 dark:text-gray-500">+ Add your most important tasks here</p>
                  </div>
                </div>

                {/* Tab bar */}
                <div className="border-t border-gray-100 dark:border-gray-800">
                  <div className="flex px-2">
                    {tabs.map(({ label, key, count }) => (
                      <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`px-2.5 py-2.5 text-xs font-normal border-b-2 transition-colors whitespace-nowrap ${
                          activeTab === key
                            ? "border-brand-500 text-brand-500"
                            : "border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        }`}
                      >
                        {label}{count !== undefined ? ` (${count})` : ""}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab content */}
                <div className="px-5 py-3">
                  {activeTab === "Activity" && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Today</span>
                        <div className="flex items-center gap-1.5">
                          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                            </svg>
                          </button>
                          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {MOCK_ACTIVITY.map((item) => (
                          <div key={item.id} className="flex items-start gap-2.5">
                            <div className="w-4 h-4 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0 mt-0.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{item.text}</p>
                              {item.sub && <p className="text-xs text-gray-400 truncate">{item.sub}</p>}
                            </div>
                            <span className="text-[10px] text-gray-400 shrink-0 whitespace-nowrap">{item.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === "Tasks" && (
                    <div className="space-y-2">
                      {MOCK_TASKS.map((task) => (
                        <div key={task.id} className="flex items-center gap-2.5 py-2 border-b border-gray-50 dark:border-gray-800">
                          <div className="w-3 h-3 rounded-full border-2 border-brand-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">{task.title}</p>
                            <p className="text-[10px] text-gray-400 truncate">{task.project}</p>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-normal ${
                            task.status === "In Progress"
                              ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                          }`}>
                            {task.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === "Comments" && (
                    <p className="text-xs text-gray-400 text-center py-6">No comments</p>
                  )}

                  {activeTab === "Calendar" && (
                    <p className="text-xs text-gray-400 text-center py-6">No upcoming events</p>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
