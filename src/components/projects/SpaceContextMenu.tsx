"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Project } from "@/services/project.service";
import { toast } from "sonner";
import {
  LuStar,
  LuPencil,
  LuLink,
  LuPlus,
  LuPalette,
  LuZap,
  LuLayoutList,
  LuCircleDot,
  LuEllipsis as LuMoreHorizontal,
  LuEyeOff,
  LuCopy,
  LuArchive,
  LuTrash2,
  LuUsers,
  LuChevronRight,
} from "react-icons/lu";

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
  danger?: boolean;
  hasSubmenu?: boolean;
}

function MenuItem({ icon, label, description, onClick, danger, hasSubmenu }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors
        ${danger
          ? "text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
          : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
        }`}
    >
      <span className={`shrink-0 ${danger ? "text-red-500 dark:text-red-400" : "text-gray-400"}`}>{icon}</span>
      <span className="flex-1 text-left">
        <span className="block">{label}</span>
        {description && (
          <span className="block text-xs text-gray-400 dark:text-gray-500 font-normal leading-tight mt-0.5">
            {description}
          </span>
        )}
      </span>
      {hasSubmenu && <LuChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />}
    </button>
  );
}

interface Props {
  project: Project;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function SpaceContextMenu({
  project,
  triggerRef,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    // Place menu to the right of the full sidebar (rail 56px + panel 232px = 288px)
    const left = 288 + 4;

    // First pass: anchor at trigger top. After the panel mounts and has a real
    // height we clamp so it never overflows the bottom of the viewport.
    const measure = () => {
      if (!panelRef.current) return;
      const menuHeight = panelRef.current.offsetHeight;
      const top = Math.max(8, Math.min(rect.top, window.innerHeight - menuHeight - 8));
      setPosition({ top, left });
    };

    // Run immediately (panel may already be in the DOM from a previous open)
    measure();
    // Also run on the next frame in case the panel just mounted and has no height yet
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [isOpen, triggerRef]);

  useEffect(() => {
    if (!isOpen) return;
    // Close when clicking anywhere outside the panel
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use capture so we hear the event before anything else stops it
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [isOpen, onClose]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/projects/${project.id}`);
    toast.success("Link copied");
    onClose();
  };

  if (!isOpen) return null;

  const menu = (
    <div
      ref={panelRef}
      style={{ top: position.top, left: position.left }}
      className="fixed z-9999 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl py-1.5 max-h-[calc(100vh-32px)] overflow-y-auto"
    >
      <MenuItem icon={<LuStar className="w-4 h-4" />} label="Favorite" hasSubmenu onClick={onClose} />
      <MenuItem icon={<LuPencil className="w-4 h-4" />} label="Rename" onClick={onEdit} />
      <MenuItem icon={<LuLink className="w-4 h-4" />} label="Copy link" onClick={handleCopyLink} />

      <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

      <MenuItem icon={<LuPlus className="w-4 h-4" />} label="Create new" hasSubmenu onClick={onClose} />
      <MenuItem icon={<LuPalette className="w-4 h-4" />} label="Color & Icon" hasSubmenu onClick={onClose} />
      <MenuItem icon={<LuZap className="w-4 h-4" />} label="Automations" onClick={onClose} />
      <MenuItem icon={<LuLayoutList className="w-4 h-4" />} label="Custom Fields" onClick={onClose} />
      <MenuItem icon={<LuCircleDot className="w-4 h-4" />} label="Task statuses" onClick={onClose} />
      <MenuItem icon={<LuMoreHorizontal className="w-4 h-4" />} label="More" hasSubmenu onClick={onClose} />

      <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

      <MenuItem icon={<LuUsers className="w-4 h-4" />} label="Sharing & Permissions" onClick={onClose} />

      <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

      <MenuItem
        icon={<LuEyeOff className="w-4 h-4" />}
        label="Hide Space"
        description="You'll retain access to this Space, but it won't show in your sidebar"
        onClick={onClose}
      />

      <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

      <MenuItem icon={<LuCopy className="w-4 h-4" />} label="Duplicate" onClick={onClose} />
      <MenuItem icon={<LuArchive className="w-4 h-4" />} label="Archive" onClick={onClose} />
      <MenuItem icon={<LuTrash2 className="w-4 h-4" />} label="Delete" danger onClick={onDelete} />

      <div className="px-3 pt-2 pb-1">
        <button
          onClick={onClose}
          className="w-full py-2 rounded-xl bg-brand-500 text-white text-sm font-normal hover:bg-brand-600 transition-colors"
        >
          Sharing &amp; Permissions
        </button>
      </div>
    </div>
  );

  return createPortal(menu, document.body);
}
