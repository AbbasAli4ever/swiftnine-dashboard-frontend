"use client";

import { useState } from "react";
import { LuPaperclip, LuSend, LuSmile } from "react-icons/lu";

/**
 * Message composer. Local state only for this UI pass — submitting clears the
 * field and does nothing else.
 */
export default function ChatComposer() {
  const [draft, setDraft] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setDraft("");
      }}
      className="flex shrink-0 items-center gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800"
    >
      <button
        type="button"
        aria-label="Attach a file"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <LuPaperclip className="h-[18px] w-[18px]" />
      </button>
      <button
        type="button"
        aria-label="Add an emoji"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <LuSmile className="h-[18px] w-[18px]" />
      </button>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Type a message"
        aria-label="Message"
        className="h-10 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      />
      <button
        type="submit"
        aria-label="Send message"
        disabled={!draft.trim()}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-gray-000 dark:text-black"
      >
        <LuSend className="h-[18px] w-[18px]" />
      </button>
    </form>
  );
}
