"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

interface SnoozePopoverProps {
  notificationId: string;
  anchorRect: DOMRect;
  onClose: () => void;
  onSnooze: (id: string, until?: string) => void;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function tomorrowAt9(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function nextWeekMonday(): Date {
  const d = new Date();
  const day = d.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(9, 0, 0, 0);
  return d;
}

const QUICK_OPTIONS = [
  { label: "1 hour", getDate: () => addHours(new Date(), 1) },
  { label: "3 hours", getDate: () => addHours(new Date(), 3) },
  { label: "Tomorrow 9am", getDate: tomorrowAt9 },
  { label: "Next week", getDate: nextWeekMonday },
];

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function SnoozePopover({ notificationId, anchorRect, onClose, onSnooze }: SnoozePopoverProps) {
  const [customValue, setCustomValue] = useState("");
  const [selectedQuick, setSelectedQuick] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  const handleQuickSelect = (label: string) => {
    setSelectedQuick(label);
    setCustomValue("");
  };

  const handleConfirm = () => {
    let isoString: string | undefined;

    if (customValue) {
      const date = new Date(customValue);
      if (isNaN(date.getTime()) || date <= new Date()) {
        toast.error("Snooze time must be in the future");
        return;
      }
      isoString = date.toISOString();
    } else if (selectedQuick) {
      const opt = QUICK_OPTIONS.find((o) => o.label === selectedQuick);
      if (opt) isoString = opt.getDate().toISOString();
    }

    onSnooze(notificationId, isoString);
    onClose();
  };

  const top = anchorRect.bottom + 4;
  const left = Math.max(8, anchorRect.right - 220);

  const content = (
    <div
      ref={popoverRef}
      style={{ position: "fixed", top, left, zIndex: 9999, width: 220 }}
      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden"
    >
      <p className="px-3 pt-3 pb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        Snooze for…
      </p>

      <div className="px-2 pb-2 flex flex-col gap-0.5">
        {QUICK_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            onClick={() => handleQuickSelect(opt.label)}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
              selectedQuick === opt.label
                ? "bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="px-3 pb-2 border-t border-gray-100 dark:border-gray-800 pt-2">
        <p className="text-xs text-gray-400 mb-1.5">Custom date & time</p>
        <input
          type="datetime-local"
          value={customValue}
          min={toDatetimeLocalValue(new Date())}
          onChange={(e) => { setCustomValue(e.target.value); setSelectedQuick(null); }}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={onClose}
          className="px-3 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={!selectedQuick && !customValue}
          className="px-3 py-1 rounded-lg text-xs bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Snooze
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
