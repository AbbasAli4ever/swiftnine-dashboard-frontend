"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

const stats = [
  {
    label: "Courses in Progress",
    value: "3",
    sub: "2 due this week",
    subColor: "text-orange-500",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M4 19V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M4 19h16M8 10h8M8 14h5" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    label: "Courses Completed",
    value: "12",
    sub: "↑ 2 this month",
    subColor: "text-green-600",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#22C55E" strokeWidth="1.8"/>
        <path d="M8 12l3 3 5-5" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    bg: "bg-green-50 dark:bg-green-900/20",
  },
  {
    label: "Total Learning Time",
    value: "48h",
    sub: "↑ 6h this week",
    subColor: "text-purple-600",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#7C3AED" strokeWidth="1.8"/>
        <path d="M12 7v5l3 3" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    bg: "bg-purple-50 dark:bg-purple-900/20",
  },
  {
    label: "Certificates Earned",
    value: "7",
    sub: "↑ 1 this month",
    subColor: "text-orange-500",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M8 21v-2a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4v2" stroke="#F97316" strokeWidth="1.8"/>
        <circle cx="12" cy="10" r="4" stroke="#F97316" strokeWidth="1.8"/>
        <path d="M3 21h18" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    bg: "bg-orange-50 dark:bg-orange-900/20",
  },
];

const continueLearning = [
  {
    id: 1,
    tag: "CYBERSECURITY",
    tagColor: "text-blue-600 dark:text-blue-400",
    title: "Information Security Essentials 2026",
    lessons: 8,
    duration: "3h 20m",
    progress: 65,
    completedOf: "5 of 8 completed",
    instructor: "James Khanna",
    initials: "JK",
    initialsColor: "bg-blue-600",
    badge: "MANDATORY",
    badgeColor: "bg-red-500",
    image: "/images/courses/cybersecurity.jpg",
  },
  {
    id: 2,
    tag: "LEADERSHIP",
    tagColor: "text-purple-600 dark:text-purple-400",
    title: "Product Thinking for Managers",
    lessons: 12,
    duration: "5h 10m",
    progress: 30,
    completedOf: "4 of 12 completed",
    instructor: "Sarah Lim",
    initials: "SL",
    initialsColor: "bg-purple-600",
    badge: "POPULAR",
    badgeColor: "bg-orange-500",
    image: "/images/courses/leadership.jpg",
  },
  {
    id: 3,
    tag: "HR & COMPLIANCE",
    tagColor: "text-green-600 dark:text-green-400",
    title: "Workplace Diversity & Inclusion",
    lessons: 6,
    duration: "2h 00m",
    progress: 17,
    completedOf: "1 of 6 completed",
    instructor: "Priya Rao",
    initials: "PR",
    initialsColor: "bg-green-600",
    badge: "NEW",
    badgeColor: "bg-green-500",
    image: "/images/courses/diversity.jpg",
  },
];

const gradientColors: Record<string, string> = {
  CYBERSECURITY: "from-[#1a2040] to-[#2d3a6e]",
  LEADERSHIP: "from-[#1a1040] to-[#3d2060]",
  "HR & COMPLIANCE": "from-[#0a2a1a] to-[#1a4a2a]",
};

export default function UniversityDashboard() {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(" ")[0] ?? "there";

  return (
    <div className="p-6 space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#3D1A6E] to-[#5B2D9A] px-8 py-7 text-white">
        <div className="relative z-10">
          <p className="text-sm text-purple-200 mb-1">Good morning,</p>
          <h2 className="text-2xl font-bold mb-2">
            Ready to learn today, {firstName}?
          </h2>
          <p className="text-sm text-purple-200 mb-5 max-w-lg">
            You have 3 courses in progress and 2 assignments due this week.
            Keep the momentum going!
          </p>
          <Link
            href="/university/my-learning"
            className="inline-flex items-center gap-2 rounded-lg bg-white/20 backdrop-blur-sm border border-white/30 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/30 transition-colors"
          >
            Continue Learning →
          </Link>
        </div>
        {/* Decorative circles */}
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5" />
        <div className="absolute -right-4 -bottom-12 h-48 w-48 rounded-full bg-white/5" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
            <div className={`mb-3 inline-flex rounded-xl p-2.5 ${s.bg}`}>
              {s.icon}
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
            <p className={`mt-2 text-xs font-medium ${s.subColor}`}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Continue Learning */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Continue Learning</h3>
          <Link
            href="/university/course-library"
            className="text-sm font-medium text-[#7C3AED] hover:underline"
          >
            View Library →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {continueLearning.map((course) => (
            <div key={course.id} className="rounded-xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
              {/* Thumbnail */}
              <div className={`relative h-36 bg-gradient-to-br ${gradientColors[course.tag] ?? "from-gray-700 to-gray-900"} flex items-center justify-center`}>
                <span className={`absolute top-3 left-3 rounded px-2 py-0.5 text-[10px] font-bold text-white ${course.badgeColor}`}>
                  {course.badge}
                </span>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.3">
                  <circle cx="24" cy="24" r="20" stroke="white" strokeWidth="2"/>
                  <path d="M20 17l12 7-12 7V17z" fill="white"/>
                </svg>
              </div>

              <div className="p-4">
                <p className={`text-[11px] font-semibold tracking-wide mb-1 ${course.tagColor}`}>
                  {course.tag}
                </p>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                  {course.title}
                </h4>

                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
                  <span className="flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M3 5h6M3 7.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    {course.lessons} lessons
                  </span>
                  <span className="flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M6 3.5v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    {course.duration}
                  </span>
                </div>

                {/* Progress */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>{course.completedOf}</span>
                    <span className="font-medium text-[#7C3AED]">{course.progress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                    <div
                      className="h-1.5 rounded-full bg-[#7C3AED]"
                      style={{ width: `${course.progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-6 w-6 rounded-full ${course.initialsColor} flex items-center justify-center text-[10px] font-bold text-white`}>
                      {course.initials}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{course.instructor}</span>
                  </div>
                  <Link
                    href="/university/my-learning"
                    className="rounded-lg bg-purple-50 dark:bg-purple-900/30 px-3 py-1.5 text-xs font-medium text-[#7C3AED] hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                  >
                    Resume →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
