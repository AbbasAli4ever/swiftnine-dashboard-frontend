"use client";

import { MOCK_DM_USERS } from "@/lib/mock-dm-data";
import { getInitials } from "@/lib/getInitials";
import { useUiStore } from "@/stores/ui.store";
import { useRouter } from "next/navigation";

export default function DmSidebarSection() {
  const { activeDmUserId, openDmThread } = useUiStore();
  const router = useRouter();

  const handleClickUser = (userId: string) => {
    openDmThread(userId);
    router.push(`/messages/${userId}`);
  };

  const handleNewMessage = () => {
    router.push("/messages");
  };

  return (
    <div className="mt-4">
      <p className="px-3 pb-1 text-[11px] font-normal text-gray-400 dark:text-gray-500 uppercase tracking-wider">
        Direct Messages
      </p>

      <div className="space-y-0.5">
        {MOCK_DM_USERS.map((u) => {
          const isActive = activeDmUserId === u.id;
          return (
            <button
              key={u.id}
              onClick={() => handleClickUser(u.id)}
              className={`flex items-center gap-2.5 w-full rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                isActive
                  ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <span
                className="relative flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] shrink-0"
                style={{ backgroundColor: u.avatarColor }}
              >
                {getInitials(u.fullName)}
                {u.status === "ONLINE" && (
                  <span className="absolute -bottom-0.5 right-0 h-1.5 w-1.5 rounded-full border border-white dark:border-gray-900 bg-green-500" />
                )}
              </span>
              <span className="truncate">{u.fullName}</span>
            </button>
          );
        })}
      </div>

      <button
        onClick={handleNewMessage}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 mt-1 rounded-lg text-[13px] text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        New message
      </button>
    </div>
  );
}
