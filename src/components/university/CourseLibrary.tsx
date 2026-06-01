"use client";

import Link from "next/link";
import { useState } from "react";

const CATEGORIES = [
  "All Courses",
  "Compliance",
  "Leadership",
  "Technical",
  "HR & Culture",
  "Onboarding",
  "Sales",
];

type Badge = "NEW" | "POPULAR" | "MANDATORY" | null;

interface Course {
  id: number;
  tag: string;
  tagColor: string;
  title: string;
  description: string;
  lessons: number;
  duration: string;
  badge: Badge;
  badgeColor: string;
  gradient: string;
  category: string;
}

const COURSES: Course[] = [
  {
    id: 1,
    tag: "LEADERSHIP",
    tagColor: "text-purple-600 dark:text-purple-400",
    title: "Product Thinking for Managers",
    description: "Learn how to lead with a product mindset, run effective roadmapping sessions, and align your team on OKRs.",
    lessons: 6,
    duration: "2h 00m",
    badge: "NEW",
    badgeColor: "bg-green-500",
    gradient: "from-[#1a1040] to-[#3d2060]",
    category: "Leadership",
  },
  {
    id: 2,
    tag: "TECHNICAL",
    tagColor: "text-blue-600 dark:text-blue-400",
    title: "Excel & Google Sheets Mastery",
    description: "From VLOOKUP to pivot tables, dashboards and macros. Become the spreadsheet expert your team needs.",
    lessons: 16,
    duration: "6h 45m",
    badge: "POPULAR",
    badgeColor: "bg-orange-500",
    gradient: "from-[#0a2040] to-[#1a4060]",
    category: "Technical",
  },
  {
    id: 3,
    tag: "CYBERSECURITY",
    tagColor: "text-indigo-600 dark:text-indigo-400",
    title: "Information Security Essentials 2026",
    description: "Learn how to lead with a product mindset, run effective roadmapping sessions, and align your team on OKRs.",
    lessons: 6,
    duration: "2h 00m",
    badge: "NEW",
    badgeColor: "bg-green-500",
    gradient: "from-[#1a2040] to-[#2d3a6e]",
    category: "Compliance",
  },
  {
    id: 4,
    tag: "COMMUNICATION",
    tagColor: "text-rose-600 dark:text-rose-400",
    title: "Executive Communication & Storytelling",
    description: "Present ideas with clarity and confidence. Master slide design, storytelling frameworks, and executive presence.",
    lessons: 6,
    duration: "2h 00m",
    badge: "MANDATORY",
    badgeColor: "bg-red-500",
    gradient: "from-[#2a1010] to-[#6e1a1a]",
    category: "Leadership",
  },
  {
    id: 5,
    tag: "TECHNOLOGY",
    tagColor: "text-cyan-600 dark:text-cyan-400",
    title: "AI & Automation for Every Role",
    description: "Understand how AI tools like ChatGPT, Claude, and automation platforms can transform your daily workflows.",
    lessons: 6,
    duration: "2h 00m",
    badge: "NEW",
    badgeColor: "bg-green-500",
    gradient: "from-[#0a2030] to-[#0a4050]",
    category: "Technical",
  },
  {
    id: 6,
    tag: "HR & CULTURE",
    tagColor: "text-green-600 dark:text-green-400",
    title: "Workplace Diversity & Inclusion",
    description: "Build a more inclusive workplace. Covers unconscious bias, allyship and creating equitable teams.",
    lessons: 6,
    duration: "2h 00m",
    badge: "POPULAR",
    badgeColor: "bg-orange-500",
    gradient: "from-[#0a2a1a] to-[#1a4a2a]",
    category: "HR & Culture",
  },
  {
    id: 7,
    tag: "SALES",
    tagColor: "text-amber-600 dark:text-amber-400",
    title: "Consultative Sales Techniques",
    description: "Master discovery calls, objection handling, and closing strategies that build long-term client relationships.",
    lessons: 10,
    duration: "3h 30m",
    badge: null,
    badgeColor: "",
    gradient: "from-[#2a1a00] to-[#6e4a00]",
    category: "Sales",
  },
  {
    id: 8,
    tag: "ONBOARDING",
    tagColor: "text-teal-600 dark:text-teal-400",
    title: "New Employee Orientation",
    description: "Everything you need to know in your first 30 days. Company values, tools, processes, and who to talk to.",
    lessons: 8,
    duration: "1h 45m",
    badge: "MANDATORY",
    badgeColor: "bg-red-500",
    gradient: "from-[#002a2a] to-[#004a4a]",
    category: "Onboarding",
  },
  {
    id: 9,
    tag: "COMPLIANCE",
    tagColor: "text-red-600 dark:text-red-400",
    title: "GDPR & Data Privacy Fundamentals",
    description: "Understand your legal obligations under GDPR. Covers data handling, subject rights, and breach reporting.",
    lessons: 5,
    duration: "1h 20m",
    badge: "MANDATORY",
    badgeColor: "bg-red-500",
    gradient: "from-[#2a0a0a] to-[#4a1a1a]",
    category: "Compliance",
  },
];

export default function CourseLibrary() {
  const [activeCategory, setActiveCategory] = useState("All Courses");

  const filtered =
    activeCategory === "All Courses"
      ? COURSES
      : COURSES.filter((c) => c.category === activeCategory);

  return (
    <div className="p-6">
      {/* Category filters */}
      <div className="flex gap-2 flex-wrap mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors border ${
              activeCategory === cat
                ? "bg-[#7C3AED] text-white border-[#7C3AED]"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-[#7C3AED] hover:text-[#7C3AED]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Course grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          No courses found in this category.
        </div>
      )}
    </div>
  );
}

function CourseCard({ course }: { course: Course }) {
  return (
    <div className="rounded-xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all group">
      {/* Thumbnail */}
      <div className={`relative h-40 bg-gradient-to-br ${course.gradient} flex items-center justify-center overflow-hidden`}>
        {course.badge && (
          <span className={`absolute top-3 left-3 rounded px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide ${course.badgeColor}`}>
            {course.badge}
          </span>
        )}
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none" opacity="0.25">
          <circle cx="26" cy="26" r="22" stroke="white" strokeWidth="2"/>
          <path d="M22 18l14 8-14 8V18z" fill="white"/>
        </svg>
      </div>

      <div className="p-4">
        <p className={`text-[11px] font-bold tracking-widest mb-1.5 ${course.tagColor}`}>
          {course.tag}
        </p>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-[#7C3AED] transition-colors">
          {course.title}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
          {course.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
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
          <Link
            href="/university/my-learning"
            className="rounded-lg bg-purple-50 dark:bg-purple-900/30 px-3 py-1.5 text-xs font-medium text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white transition-colors"
          >
            Watch Now
          </Link>
        </div>
      </div>
    </div>
  );
}
