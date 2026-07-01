"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LuFileText, LuPlus, LuLock } from "react-icons/lu";
import { useDocs } from "@/context/DocsContext";
import CreateDocModal from "./CreateDocModal";

export default function DocsListSidebarSection() {
  const pathname = usePathname();
  const { docs, isLoading } = useDocs();
  const [createOpen, setCreateOpen] = useState(false);

  // Show workspace + personal docs in sidebar (project docs live on the project overview)
  const visible = docs.filter(
    (d) => d.scope === "WORKSPACE" || d.scope === "PERSONAL"
  );

  return (
    <div className="pt-3">
      <div className="flex items-center justify-between px-2 mb-1">
        <p className="text-[12px] uppercase tracking-wide text-[#646464] font-semibold">
          Docs
        </p>
        <button
          onClick={() => setCreateOpen(true)}
          className="text-gray-400 hover:text-brand-500 transition-colors"
          title="New document"
        >
          <LuPlus className="w-4 h-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <div className="w-3.5 h-3.5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <p className="px-2.5 py-1.5 text-[12px] text-gray-400 italic">
          No docs yet
        </p>
      ) : (
        <div className="space-y-0.5 mt-0.5">
          {visible.map((d) => {
            const href = `/docs/${d.id}`;
            const active = pathname === href;
            return (
              <Link
                key={d.id}
                href={href}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors ${
                  active
                    ? "bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                }`}
                title={d.scope === "PERSONAL" ? "Personal — only you" : undefined}
              >
                {d.scope === "PERSONAL" ? (
                  <LuLock className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                ) : (
                  <LuFileText className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                )}
                <span className="truncate">{d.title || "Untitled"}</span>
              </Link>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setCreateOpen(true)}
        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 mt-1 w-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-brand-500 transition-colors"
      >
        <LuPlus className="w-4 h-4" />
        <span>New Doc</span>
      </button>

      <CreateDocModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(docId) => {
          window.location.href = `/docs/${docId}`;
        }}
      />
    </div>
  );
}
