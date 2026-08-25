"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";
import { toast } from "sonner";
import { parseApiError } from "@/lib/api";
import { useEmployeeMutations } from "@/hooks/useAccounting";
import type { AccountingEmployee } from "@/services/accounting.service";

/**
 * Create-or-rename in one modal. Unlike Clients (which splits create/rename
 * because create alone captures totalRevenue+currencyType), an Employee has
 * exactly one field — name — so there's no asymmetry to justify two
 * components for what's really the same form.
 */
export default function EmployeeFormModal({
  isOpen,
  onClose,
  employee = null,
  initialName = "",
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Present = rename this employee. Absent = create a new one. */
  employee?: AccountingEmployee | null;
  /** Prefills the name when opened from the "Create <term>" row of a picker. */
  initialName?: string;
  onSaved?: (employee: AccountingEmployee) => void;
}) {
  const { createEmployee, renameEmployee } = useEmployeeMutations();
  const isEditing = employee !== null;
  const [name, setName] = useState(employee?.name ?? initialName);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(employee?.name ?? initialName);
    setError("");
  }, [isOpen, employee, initialName]);

  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter an employee name.");
      return;
    }

    setSaving(true);
    try {
      const saved = isEditing
        ? await renameEmployee(employee.id, { name: trimmed })
        : await createEmployee({ name: trimmed });
      toast.success(isEditing ? "Employee renamed" : `${saved.name} created`);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      const { message } = parseApiError(err);
      setError(
        message || `Couldn't ${isEditing ? "rename" : "create"} the employee.`
      );
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="employee-form-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      />
      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-[360px] rounded-2xl bg-white p-6 shadow-2xl dark:border dark:border-gray-800 dark:bg-gray-950"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-6 top-5 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
        >
          <LuX className="h-4 w-4" />
        </button>
        <h2
          id="employee-form-title"
          className="text-base font-semibold text-gray-900 dark:text-gray-100"
        >
          {isEditing ? "Rename Employee" : "Add Employee"}
        </h2>
        <label className="mt-5 block text-xs font-medium text-gray-600 dark:text-gray-300">
          Employee Name
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </label>
        {isEditing && (
          <p className="mt-2 text-[11px] leading-4 text-gray-400">
            Existing transactions keep no separate record of the name — they
            always reflect the employee&apos;s current name.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-500">
            {error}
          </p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-lg bg-[linear-gradient(90deg,#6547f7_0%,#5431ed_100%)] text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
