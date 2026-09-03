"use client";

import { avatarColors, initials } from "@/components/accounts/avatar";

/**
 * Round avatar for a conversation or member.
 *
 * Reuses the accounting module's `avatarColors`/`initials` so one person keeps
 * the same tint everywhere in the app rather than getting a second, unrelated
 * colour scheme in Chat.
 */
export default function ChatAvatar({
  name,
  size = 40,
  className = "",
}: {
  /** Also the colour seed, so the same name always gets the same tint. */
  name: string;
  size?: number;
  className?: string;
}) {
  const { background, color } = avatarColors(name);
  return (
    <span
      aria-hidden="true"
      style={{
        backgroundColor: background,
        color,
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.34)),
      }}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${className}`}
    >
      {initials(name)}
    </span>
  );
}
