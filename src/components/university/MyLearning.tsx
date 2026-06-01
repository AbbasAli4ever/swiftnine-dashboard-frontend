"use client";

import { useState } from "react";

const curriculum = [
  {
    id: 1,
    chapter: "Introduction to Cybersecurity",
    lessons: 2,
    duration: "45m",
    items: [
      { title: "What is information security?", duration: "18m", completed: true },
      { title: "The threat landscape in 2026", duration: "27m", completed: true },
    ],
  },
  {
    id: 2,
    chapter: "Phishing & Social Engineering",
    lessons: 2,
    duration: "50m",
    items: [
      { title: "Recognising phishing emails", duration: "24m", completed: true },
      { title: "Social engineering tactics", duration: "26m", completed: true },
    ],
  },
  {
    id: 3,
    chapter: "Secure Remote Access",
    lessons: 2,
    duration: "55m",
    items: [
      { title: "VPNs and Zero Trust architecture", duration: "30m", completed: true },
      { title: "Password managers and MFA", duration: "25m", completed: false },
    ],
  },
  {
    id: 4,
    chapter: "Data Protection & Compliance",
    lessons: 2,
    duration: "50m",
    items: [
      { title: "GDPR essentials for employees", duration: "28m", completed: false },
      { title: "Data classification and handling", duration: "22m", completed: false },
    ],
  },
];

export default function MyLearning() {
  const [note, setNote] = useState("Always check sender email carefully. Real companies don't use gmail for official comms.");
  const [expandedChapter, setExpandedChapter] = useState<number | null>(1);
  const [progress] = useState(65);

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 overflow-auto lg:overflow-hidden">
      {/* Main content */}
      <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-6">
        {/* Video player */}
        <div className="rounded-xl overflow-hidden bg-[#1a1a2e] shadow-lg">
          <div className="relative aspect-video flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#2d2d4e]">
            {/* Play button */}
            <button className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/30 hover:bg-white/30 transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M6 4l14 8-14 8V4z" fill="white"/>
              </svg>
            </button>
            {/* Progress bar overlay */}
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
              <div className="flex items-center gap-3 text-white text-xs mb-2">
                <button className="hover:text-gray-300">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                    <path d="M2 2h2v10H2zM4.5 7L10 2v10L4.5 7z"/>
                  </svg>
                </button>
                <button className="hover:text-gray-300">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 2l9 5-9 5V2z" fill="currentColor"/>
                  </svg>
                </button>
                <button className="hover:text-gray-300">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                    <path d="M10 2h2v10h-2zM4 7L9.5 2v10L4 7z"/>
                  </svg>
                </button>
                <span className="ml-1">12:45 / 30:20</span>
              </div>
              <div className="relative h-1 w-full rounded-full bg-white/20 cursor-pointer">
                <div className="h-1 rounded-full bg-[#7C3AED]" style={{ width: "42%" }} />
                <div className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-[#7C3AED] border-2 border-white shadow" style={{ left: "calc(42% - 6px)" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Course info */}
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
          <p className="text-xs font-bold tracking-widest text-blue-600 dark:text-blue-400 mb-2">CYBERSECURITY</p>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Information Security Essentials 2026
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            This course covers everything you need to stay safe online and protect company data. From identifying phishing attempts to setting up secure remote access, you&apos;ll finish with practical, actionable knowledge.
          </p>

          <div className="grid grid-cols-3 gap-4 mb-5">
            {[
              { label: "Lessons", value: "8" },
              { label: "Duration", value: "3h 20m" },
              { label: "Rating", value: "4.9 ★" },
            ].map((s) => (
              <div key={s.label} className="text-center rounded-lg bg-gray-50 dark:bg-gray-700/50 py-3">
                <p className="text-lg font-bold text-gray-900 dark:text-white">{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="mb-5">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-600 dark:text-gray-300 font-medium">Your progress</span>
              <span className="font-semibold text-[#7C3AED]">{progress}% complete</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700">
              <div className="h-2 rounded-full bg-[#7C3AED]" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#7C3AED] px-5 py-3 text-sm font-semibold text-white hover:bg-[#6d28d9] transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 2l10 6-10 6V2z" fill="white"/>
              </svg>
              Continue Lesson 6
            </button>
            <button className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l3 1.5 2-1 3 1 2-1.5v10l-2 1.5-3-1-2 1-3-1.5V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                <path d="M5 2v10M10 2v10" stroke="currentColor" strokeWidth="1.3"/>
              </svg>
              Save
            </button>
          </div>
        </div>

        {/* Curriculum */}
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Course Curriculum
            </h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {curriculum.map((chapter) => (
              <div key={chapter.id}>
                <button
                  onClick={() => setExpandedChapter(expandedChapter === chapter.id ? null : chapter.id)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#7C3AED]/10 text-[#7C3AED] text-xs font-bold">
                      {chapter.id}
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white text-left">
                      {chapter.chapter}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-400">
                      {chapter.lessons} lessons • {chapter.duration}
                    </span>
                    <svg
                      width="14" height="14" viewBox="0 0 14 14" fill="none"
                      className={`text-gray-400 transition-transform ${expandedChapter === chapter.id ? "rotate-180" : ""}`}
                    >
                      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>

                {expandedChapter === chapter.id && (
                  <div className="px-6 pb-3 space-y-1">
                    {chapter.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-2 pl-10 pr-2">
                        <div className="flex items-center gap-2.5">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                            <path d="M5 7l2 2 2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                          </svg>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{item.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{item.duration}</span>
                          {item.completed && (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <circle cx="7" cy="7" r="6" fill="#22C55E"/>
                              <path d="M4.5 7l2 2 3-3" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="lg:w-80 flex-shrink-0 p-6 space-y-5 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {/* My Notes */}
        <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
            <span>📝</span> My Notes
          </h4>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED]"
          />
          <button className="mt-3 w-full rounded-lg bg-[#7C3AED] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors">
            Save Note
          </button>
        </div>

        {/* Instructor */}
        <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Instructor</h4>
          <div className="flex items-start gap-3 mb-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
              JK
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">James Khanna</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Head of IT Security, 12 years exp.</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Former security consultant at Deloitte. Certified CISSP and passionate about making security accessible to everyone in the workplace.
          </p>
        </div>

        {/* Related courses */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Up Next</h4>
          <div className="space-y-3">
            {[
              { title: "GDPR & Data Privacy", duration: "1h 20m", tag: "Compliance" },
              { title: "Secure Remote Access", duration: "2h 10m", tag: "Technical" },
            ].map((c) => (
              <div key={c.title} className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-600 p-3 hover:border-[#7C3AED] cursor-pointer transition-colors">
                <div className="flex h-10 w-14 flex-shrink-0 items-center justify-center rounded bg-[#7C3AED]/10">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="#7C3AED" strokeWidth="1.5"/>
                    <path d="M6 5l6 3-6 3V5z" fill="#7C3AED"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{c.title}</p>
                  <p className="text-[11px] text-gray-400">{c.tag} • {c.duration}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
