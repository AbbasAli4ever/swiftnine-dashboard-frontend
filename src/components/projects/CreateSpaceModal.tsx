"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useProjects } from "@/context/ProjectContext";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";
import {
  LuX,
  LuLock,
  LuLockOpen,
  LuChevronLeft,
  LuCircleDashed,
  LuPlus,
  LuInfo,
} from "react-icons/lu";
import { IoCheckmarkCircle } from "react-icons/io5";
import { IoMdRadioButtonOn } from "react-icons/io";

// Auto-generate task prefix from name:
// - Single word: first 2 characters
// - Multiple words: first character of each word
function generatePrefix(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return words
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 6);
}

const COLOR_OPTIONS = [
  "#6366f1", "#3b82f6", "#22c55e", "#f59e0b",
  "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6",
  "#f97316", "#64748b",
];

type CreateStep = "details" | "statuses";

type StatusItem = {
  name: string;
  color: string;
};

type StatusGroup = {
  title: string;
  iconType: "dashed" | "active" | "check";
  statuses: StatusItem[];
};

const DEFAULT_STATUS_GROUPS: StatusGroup[] = [
  {
    title: "Not started",
    iconType: "dashed",
    statuses: [{ name: "To Do", color: "#94a3b8" }],
  },
  {
    title: "Active",
    iconType: "active",
    statuses: [
      { name: "In Progress", color: "#3b82f6" },
      { name: "Review", color: "#f59e0b" },
    ],
  },
  {
    title: "Done",
    iconType: "check",
    statuses: [],
  },
  {
    title: "Closed",
    iconType: "check",
    statuses: [{ name: "Completed", color: "#22c55e" }],
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateSpaceModal({ isOpen, onClose }: Props) {
  const { createProject } = useProjects();
  const [step, setStep] = useState<CreateStep>("details");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [prefix, setPrefix] = useState("");
  const [prefixTouched, setPrefixTouched] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prefixError, setPrefixError] = useState("");
  const [nameError, setNameError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep("details");
      setName("");
      setDescription("");
      setColor(COLOR_OPTIONS[0]);
      setPrefix("");
      setPrefixTouched(false);
      setIsPrivate(false);
      setPrefixError("");
      setNameError("");
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Auto-generate prefix from name unless user has manually edited it
  useEffect(() => {
    if (!prefixTouched) {
      setPrefix(generatePrefix(name));
    }
  }, [name, prefixTouched]);

  const handlePrefixChange = (val: string) => {
    setPrefixTouched(true);
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setPrefix(clean);
    if (clean.length < 2) {
      setPrefixError("Prefix must be at least 2 characters");
    } else {
      setPrefixError("");
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
    const trimmed = val.trim();
    if (trimmed.length > 0 && trimmed.length < 2) {
      setNameError("Name must be at least 2 characters");
      return;
    }
    setNameError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (name.trim().length < 2) {
      setNameError("Name must be at least 2 characters");
      return;
    }
    if (prefix.length < 2) {
      setPrefixError("Prefix must be at least 2 characters");
      return;
    }
    setStep("statuses");
  };

  const handleCreateProject = async () => {
    setLoading(true);
    try {
      await createProject({
        name: name.trim(),
        taskIdPrefix: prefix,
        description: description.trim() || undefined,
        color,
      });
      toast.success(`Space "${name.trim()}" created`);
      onClose();
    } catch (err) {
      const { message, code } = parseApiError(err);
      if (code === "CONFLICT") {
        setPrefixError("This prefix is already taken in this workspace");
        setStep("details");
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const initial = name.trim().charAt(0).toUpperCase() || "S";
  const titleName = name.trim() || "Space";
  const isNameValid = name.trim().length >= 2;

  const modal = (
    <div className="fixed inset-0 z-9999 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {step === "details" ? (
        <div className="relative z-10 w-full max-w-[760px] mx-4 bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-6 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Create a Space</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                A Space represents teams, departments, or groups, each with its
                own Lists, workflows, and settings.
              </p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
            >
              <LuX className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="px-6 space-y-5">
              {/* Icon & Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Icon &amp; name
                </label>
                <div className="flex items-center gap-3">
                  {/* Color picker avatar */}
                  <div className="relative group">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg font-bold cursor-pointer shrink-0 transition-opacity hover:opacity-80"
                      style={{ backgroundColor: color }}
                    >
                      {initial}
                    </div>
                    {/* Color swatches on hover */}
                    <div className="absolute left-0 top-full mt-1 hidden group-hover:flex flex-wrap gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-2 w-36 z-10 shadow-xl">
                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setColor(c)}
                          className="w-6 h-6 rounded-lg transition-transform hover:scale-110"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <input
                    ref={nameRef}
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Marketing, Engineering, HR"
                    maxLength={100}
                    className={`flex-1 bg-gray-50 dark:bg-gray-800 border rounded-xl px-4 py-2.5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none transition-colors text-sm ${
                      nameError
                        ? "border-red-500 focus:ring-1 focus:ring-red-500"
                        : "border-gray-200 dark:border-gray-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    }`}
                  />
                </div>
                {nameError && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">{nameError}</p>
                )}
              </div>

              {/* Task ID Prefix */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Task ID Prefix
                  <span className="ml-1 text-xs text-gray-400 dark:text-gray-500 font-normal">
                    (2–6 chars, e.g. API, MKT)
                  </span>
                </label>
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => handlePrefixChange(e.target.value)}
                  placeholder="e.g. MKT"
                  className={`w-full bg-gray-50 dark:bg-gray-800 border rounded-xl px-4 py-2.5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none transition-colors text-sm font-mono ${
                    prefixError
                      ? "border-red-500 focus:ring-1 focus:ring-red-500"
                      : "border-gray-200 dark:border-gray-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  }`}
                />
                {prefixError && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">{prefixError}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description{" "}
                  <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors text-sm resize-none"
                />
              </div>

              {/* Make Private */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2.5">
                  {isPrivate ? (
                    <LuLock className="w-4 h-4 text-gray-400" />
                  ) : (
                    <LuLockOpen className="w-4 h-4 text-gray-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      Make Private
                    </p>
                    <p className="text-xs text-gray-500">
                      Only you and invited members have access
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrivate((v) => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    isPrivate ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-700"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      isPrivate ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end px-6 py-4 mt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="submit"
                disabled={loading || !isNameValid || prefix.length < 2}
                className="px-6 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Continue
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="relative z-10 w-full max-w-[720px] mx-4 bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden max-h-[86vh] flex flex-col">
          <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep("details")}
                className="flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <LuChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Edit {titleName} statuses
              </h2>
            </div>
            <button
              onClick={onClose}
              className="ml-4 flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
            >
              <LuX className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[220px_1fr]">
            <div className="px-4 py-5 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status template</p>
              <select
                value="custom"
                disabled
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 appearance-none"
              >
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="px-5 py-5 space-y-5 overflow-y-auto">
              {DEFAULT_STATUS_GROUPS.map((group) => (
                <div key={group.title}>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-semibold text-gray-700 dark:text-gray-200">{group.title}</p>
                      <LuInfo className="w-4 h-4 text-gray-400" />
                    </div>
                    <button
                      type="button"
                      className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <LuPlus className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {group.statuses.map((status) => (
                      <div
                        key={status.name}
                        className="h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 flex items-center gap-3 text-sm text-gray-900 dark:text-gray-100"
                      >
                        {group.iconType === "dashed" ? (
                          <LuCircleDashed className="w-4 h-4" style={{ color: status.color }} />
                        ) : group.iconType === "active" ? (
                          <IoMdRadioButtonOn className="w-4 h-4" style={{ color: status.color }} />
                        ) : (
                          <IoCheckmarkCircle className="w-4 h-4" style={{ color: status.color }} />
                        )}
                        <span>{status.name.toUpperCase()}</span>
                      </div>
                    ))}

                    <button
                      type="button"
                      className="w-full h-10 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center gap-2"
                    >
                      <LuPlus className="w-4 h-4" />
                      <span>Add status</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end px-6 py-4 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={handleCreateProject}
              disabled={loading}
              className="px-6 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Creating..." : "Create Project"}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modal, document.body);
}
