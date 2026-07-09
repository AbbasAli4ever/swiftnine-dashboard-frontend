"use client";

import { LuBotMessageSquare } from "react-icons/lu";

export default function ChatTypingIndicator() {
  return (
    <div className="flex items-center gap-3 px-2 py-1">
      <div className="w-8 h-8 rounded-full bg-swiftnine-gradient flex items-center justify-center text-white shrink-0">
        <LuBotMessageSquare className="w-4 h-4" />
      </div>
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
    </div>
  );
}
