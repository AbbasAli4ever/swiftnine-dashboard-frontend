"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  DmMessage,
  DmUser,
  getConversation,
} from "@/lib/mock-dm-data";
import { getInitials } from "@/lib/getInitials";
import { useAuth } from "@/context/AuthContext";
import { useUiStore } from "@/stores/ui.store";
import DmMessageInput from "./DmMessageInput";

interface Props {
  userId: string;
  dmUser: DmUser;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function getDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (today.getTime() - msgDay.getTime()) / 86400000;
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function groupMessages(messages: DmMessage[]): { label: string; messages: DmMessage[] }[] {
  const groups: Map<string, DmMessage[]> = new Map();
  for (const msg of messages) {
    const label = getDateLabel(msg.createdAt);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(msg);
  }
  return Array.from(groups.entries()).map(([label, messages]) => ({ label, messages }));
}

function formatConversationDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

type Tab = "Chat" | "Calendar" | "Assigned Tasks";

export default function DmChatView({ userId, dmUser }: Props) {
  const { user } = useAuth();
  const { openUserPanel } = useUiStore();
  const conv = getConversation(userId);

  const [messages, setMessages] = useState<DmMessage[]>(() =>
    (conv?.messages ?? []).map((m) => ({
      ...m,
      senderId: m.senderId === "__me__" ? (user?.id ?? "__me__") : m.senderId,
    }))
  );
  const [isStarred, setIsStarred] = useState(conv?.isStarred ?? false);
  const [activeTab, setActiveTab] = useState<Tab>("Chat");

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (text: string) => {
    const newMsg: DmMessage = {
      id: `msg-${Date.now()}`,
      senderId: user?.id ?? "__me__",
      text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  const myId = user?.id ?? "__me__";
  const myColor = user?.avatarColor ?? "#6366f1";
  const myInitials = getInitials(user?.fullName ?? "Me");

  const grouped = groupMessages(messages);

  const tabs: Tab[] = ["Chat", "Calendar", "Assigned Tasks"];
  const tabLabel = (t: Tab) => (t === "Assigned Tasks" ? `${dmUser.fullName}'s Assigned Tasks` : t);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center px-5 h-14 border-b border-gray-100 dark:border-gray-800 shrink-0 gap-3">
        {/* Avatar + name */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="relative shrink-0">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-normal"
              style={{ backgroundColor: dmUser.avatarColor }}
            >
              {getInitials(dmUser.fullName)}
            </div>
            {dmUser.status === "ONLINE" && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-gray-900" />
            )}
          </div>
          <span className="text-sm font-medium text-gray-800 dark:text-white truncate">{dmUser.fullName}</span>
          <span className="text-gray-300 dark:text-gray-600 text-sm">···</span>
          {/* Star */}
          <button
            onClick={() => setIsStarred((v) => !v)}
            className="text-gray-300 dark:text-gray-600 hover:text-amber-400 transition-colors"
            aria-label="Star conversation"
          >
            <svg className={`w-4 h-4 ${isStarred ? "fill-amber-400 text-amber-400" : ""}`} fill={isStarred ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </button>
        </div>
        {/* Ask AI */}
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 transition-colors shrink-0">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          Ask AI
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-100 dark:border-gray-800 px-5 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2.5 text-sm transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-brand-500 text-brand-500 font-medium"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tabLabel(tab)}
          </button>
        ))}
      </div>

      {/* Body */}
      {activeTab !== "Chat" ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-400">No content yet</p>
        </div>
      ) : (
        <>
          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {messages.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-normal"
                  style={{ backgroundColor: dmUser.avatarColor }}
                >
                  {getInitials(dmUser.fullName)}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-800 dark:text-white">Chat with {dmUser.fullName}</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    This conversation started on {formatConversationDate(conv?.conversationStartedAt ?? new Date().toISOString())}.
                  </p>
                </div>
                <button
                  onClick={() => openUserPanel(userId)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  View Profile
                </button>
              </div>
            ) : (
              <>
                {/* Conversation start banner */}
                {conv && (
                  <div className="flex flex-col items-center gap-3 pb-6">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-normal"
                      style={{ backgroundColor: dmUser.avatarColor }}
                    >
                      {getInitials(dmUser.fullName)}
                    </div>
                    <div className="text-center">
                      <h2 className="text-base font-semibold text-gray-800 dark:text-white">Chat with {dmUser.fullName}</h2>
                      <p className="text-sm text-gray-400">This conversation started on {formatConversationDate(conv.conversationStartedAt)}.</p>
                    </div>
                    <button
                      onClick={() => openUserPanel(userId)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                      View Profile
                    </button>
                  </div>
                )}

                {grouped.map(({ label, messages: groupMsgs }) => (
                  <div key={label}>
                    {/* Date separator */}
                    <div className="flex items-center gap-3 py-3">
                      <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                      <span className="text-xs text-gray-400 bg-white dark:bg-gray-900 px-1">{label}</span>
                      <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                    </div>

                    {/* Messages */}
                    <div className="space-y-3">
                      {groupMsgs.map((msg) => {
                        const isMe = msg.senderId === myId;
                        const senderName = isMe ? (user?.fullName ?? "Me") : dmUser.fullName;
                        const senderColor = isMe ? myColor : dmUser.avatarColor;
                        const senderInitials = isMe ? myInitials : getInitials(dmUser.fullName);
                        return (
                          <div key={msg.id} className="flex items-start gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-normal shrink-0 mt-0.5"
                              style={{ backgroundColor: senderColor }}
                            >
                              {senderInitials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2">
                                <span className="text-sm font-medium text-gray-800 dark:text-white">{senderName}</span>
                                <span className="text-xs text-gray-400">{formatTime(msg.createdAt)}</span>
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 leading-relaxed">{msg.text}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Input */}
          <DmMessageInput recipientName={dmUser.fullName} onSend={handleSend} />
        </>
      )}
    </div>
  );
}
