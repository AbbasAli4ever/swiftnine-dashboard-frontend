"use client";

import { use, useEffect } from "react";
import { useUiStore } from "@/stores/ui.store";
import { getDmUser } from "@/lib/mock-dm-data";
import DmChatView from "@/components/dm/DmChatView";
import { useRouter } from "next/navigation";

interface Props {
  params: Promise<{ userId: string }>;
}

export default function MessageThreadPage({ params }: Props) {
  const { userId } = use(params);
  const { openDmThread } = useUiStore();
  const router = useRouter();

  const dmUser = getDmUser(userId);

  useEffect(() => {
    if (dmUser) {
      openDmThread(userId);
    }
  }, [userId, dmUser, openDmThread]);

  if (!dmUser) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-sm text-gray-400">Conversation not found.</p>
          <button
            onClick={() => router.push("/messages")}
            className="mt-3 text-sm text-brand-500 hover:underline"
          >
            Start a new message
          </button>
        </div>
      </div>
    );
  }

  return <DmChatView userId={userId} dmUser={dmUser} />;
}
