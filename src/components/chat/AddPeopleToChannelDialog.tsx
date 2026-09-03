"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";
import { useFocusTrap } from "@/hooks/useFocusTrap";

/** Shown in the copy. Replace when this comes from the API. */
const ORG_NAME = "SwiftNine (SMC) Pvt. LTD";

/**
 * "Add people or agents to #channel".
 *
 * Deliberately separate from `CreateChannelDialog`: the channel already exists
 * by the time this opens, so inviting is its own action rather than a step in
 * creation. That also makes it reusable from a channel's own "Add people"
 * card, not just straight after creating one.
 *
 * Same panel spec as the create dialog: 537px wide, 32px padding, 24px radius,
 * 1px white border, 101deg violet gradient.
 */
export default function AddPeopleToChannelDialog({
  isOpen,
  channelName,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  /** Rendered as `#channelName` in the title. */
  channelName: string;
  onClose: () => void;
  onSubmit?: (invitee: string) => void;
}) {
  /* No reset effect needed: the dialog returns null while closed, so it
     remounts with fresh state every time it opens. */
  const [invitee, setInvitee] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(panelRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const trimmed = invitee.trim();

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-people-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="dialog-backdrop-in fixed inset-0 bg-black/40 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        style={{
          background: "linear-gradient(101deg, #8B5CF6 3.33%, #B16CFF 100.31%)",
        }}
        className="dialog-pop-in relative z-10 flex w-full max-w-[537px] flex-col gap-2.5 rounded-3xl border border-white p-8 shadow-2xl"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-6 top-6 flex h-7 w-7 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/15 hover:text-white"
        >
          <LuX className="h-[18px] w-[18px]" />
        </button>

        <form
          className="w-full"
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed) onSubmit?.(trimmed);
            onClose();
          }}
        >
          <h2
            id="add-people-title"
            className="pr-8 text-[22px] font-semibold leading-tight text-white"
          >
            Add people or agents to #{channelName}
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-white/90">
            You can also add email addresses of people who aren&apos;t members
            of {ORG_NAME}
          </p>

          <input
            autoFocus
            value={invitee}
            onChange={(event) => setInvitee(event.target.value)}
            placeholder="Enter a name or email address"
            aria-label="Enter a name or email address"
            /* Transparent so the panel's gradient reads through the outline. */
            className="mt-4 h-12 w-full rounded-xl border border-white bg-transparent px-4 text-sm text-white outline-none placeholder:text-white/70 focus:ring-2 focus:ring-white/40"
          />

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              className="h-10 shrink-0 rounded-lg bg-white px-6 text-sm font-medium text-gray-900 transition-opacity hover:opacity-90"
            >
              {trimmed ? "Add" : "Skip for now"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
