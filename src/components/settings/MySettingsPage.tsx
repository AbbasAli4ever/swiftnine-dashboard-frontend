"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useTheme } from "@/context/ThemeContext";
import { getInitials } from "@/lib/getInitials";
import { api, parseApiError } from "@/lib/api";
import { toast } from "sonner";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";

const THEME_COLORS = [
  "#1a1a1a", "#6366f1", "#3b82f6", "#ec4899",
  "#a855f7", "#8b5cf6", "#f97316", "#14b8a6",
  "#84cc16", "#22c55e",
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function SectionRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-0 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="w-[200px] shrink-0 py-5 pr-6">
        <p className="text-sm font-normal text-gray-800 dark:text-white/90">{label}</p>
        {description && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 leading-relaxed">{description}</p>}
      </div>
      <div className="flex-1 py-5 min-w-0">{children}</div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-1.5 text-xs font-normal text-gray-500 dark:text-gray-400">{label}</p>
      {children}
    </div>
  );
}


function PreferenceToggleRow({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-normal text-gray-800 dark:text-white/90">{label}</p>
        {description && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 leading-relaxed">{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export default function MySettingsPage() {
  const { user, logout } = useAuth();
  const { profile, fetch, update } = useProfile();
  const { theme, toggleTheme } = useTheme();

  const [fullName, setFullName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [selectedColor, setSelectedColor] = useState(THEME_COLORS[1]);
  const [appearance, setAppearance] = useState<"light" | "dark" | "auto">("light");
  const [highContrast, setHighContrast] = useState(false);
  const [language] = useState("English");
  const [timezone, setTimezone] = useState("Asia/Karachi");
  const [notifyTimezone, setNotifyTimezone] = useState(false);
  const [startOfWeek, setStartOfWeek] = useState<"sunday" | "monday">("sunday");
  const [timeFormat, setTimeFormat] = useState<"24" | "12">("12");
  const [dateFormat, setDateFormat] = useState("mm/dd/yyyy");
  const [prefs, setPrefs] = useState({
    flyoutToast: true,
    dontPostWithReturn: false,
    keyboardShortcuts: false,
    markdown: true,
    showQuotes: true,
    showCelebrations: true,
    verified: true,
    plainTextLinks: false,
    performanceMode: false,
    detectDesktopApp: false,
    blockSelectAll: true,
    browserTabLimits: true,
    askAddToPriorities: false,
  });
  const [loginPermission, setLoginPermission] = useState<"disabled" | "login" | "all">("disabled");
  const [onlineStatus, setOnlineStatus] = useState<"ONLINE" | "OFFLINE">("ONLINE");
  const [savedOnlineStatus, setSavedOnlineStatus] = useState<"ONLINE" | "OFFLINE">("ONLINE");
  const [saving, setSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Track saved baseline to detect dirty state
  const [savedName, setSavedName] = useState("");
  const [savedTimezone, setSavedTimezone] = useState("Asia/Karachi");

  const isDirty =
    fullName !== savedName ||
    timezone !== savedTimezone ||
    onlineStatus !== savedOnlineStatus ||
    !!currentPassword ||
    !!newPassword ||
    !!confirmPassword;

  useEffect(() => {
    if (!profile) fetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName);
      setSavedName(profile.fullName);
      setTimezone(profile.timezone ?? "Asia/Karachi");
      setSavedTimezone(profile.timezone ?? "Asia/Karachi");
      setOnlineStatus(profile.status);
      setSavedOnlineStatus(profile.status);
    }
  }, [profile]);

  useEffect(() => {
    setAppearance(theme === "dark" ? "dark" : "light");
  }, [theme]);

  const avatarColor = user?.avatarColor ?? "#6366f1";
  const initials = getInitials(profile?.fullName ?? user?.fullName);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Parameters<typeof update>[0] = {};
      if (fullName !== profile?.fullName) updates.fullName = fullName;
      if (timezone !== profile?.timezone) updates.timezone = timezone;
      if (onlineStatus !== profile?.status) updates.status = onlineStatus;
      if (Object.keys(updates).length) await update(updates);

      if (currentPassword || newPassword || confirmPassword) {
        setPasswordError("");
        if (!currentPassword) { setPasswordError("Current password is required"); setSaving(false); return; }
        if (!newPassword) { setPasswordError("New password is required"); setSaving(false); return; }
        if (newPassword !== confirmPassword) { setPasswordError("Passwords do not match"); setSaving(false); return; }
        try {
          await api.patch("/user/change-password", { currentPassword, newPassword });
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        } catch (err) {
          setPasswordError(parseApiError(err).message);
          setSaving(false);
          return;
        }
      }

      setSavedName(fullName);
      setSavedTimezone(timezone);
      setSavedOnlineStatus(onlineStatus);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await api.delete("/user/profile");
      await logout();
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setDeletingAccount(false);
      setDeleteModalOpen(false);
    }
  };

  const togglePref = (key: keyof typeof prefs) =>
    setPrefs(p => ({ ...p, [key]: !p[key] }));

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-gray-950">
      <div className="mx-auto max-w-full px-8 py-6">
        <h1 className="text-2xl font-normal text-gray-900 dark:text-gray-100 mb-1">My Settings</h1>

        {/* ── Profile ─────────────────────────────────────────── */}
        <SectionRow label="Profile" description="Your personal information and account security settings.">
          <div className="space-y-1">
            {/* Avatar */}
            <div className="mb-5">
              <p className="text-xs font-normal text-gray-500 dark:text-gray-400 mb-2">Avatar</p>
              <div className="flex items-center justify-between">
                <div className="relative shrink-0">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-normal"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {initials}
                  </div>
                  <span className={`absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-950 ${onlineStatus === "ONLINE" ? "bg-green-500" : "bg-gray-400"}`} />
                </div>

                {/* Pill switcher */}
                <div
                  className={`relative flex items-center rounded-full border-2 p-1 cursor-pointer select-none transition-colors duration-300 ${onlineStatus === "ONLINE" ? "border-green-500" : "border-gray-400"}`}
                  onClick={() => setOnlineStatus(s => s === "ONLINE" ? "OFFLINE" : "ONLINE")}
                >
                  {/* Sliding background */}
                  <span
                    className={`absolute top-1 bottom-1 rounded-full transition-all duration-300 ease-in-out ${onlineStatus === "ONLINE" ? "bg-green-500" : "bg-gray-400"}`}
                    style={{
                      left: onlineStatus === "ONLINE" ? "calc(50% - 2px)" : "4px",
                      right: onlineStatus === "ONLINE" ? "4px" : "calc(50% - 2px)",
                    }}
                  />
                  <span className={`relative z-10 px-4 py-1.5 rounded-full text-sm font-normal transition-colors duration-300 ${onlineStatus === "OFFLINE" ? "text-white" : "text-gray-400"}`}>
                    Offline
                  </span>
                  <span className={`relative z-10 px-4 py-1.5 rounded-full text-sm font-normal transition-colors duration-300 ${onlineStatus === "ONLINE" ? "text-white" : "text-green-500"}`}>
                    Online
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm font-normal text-gray-800 dark:text-white/90">
                {profile?.fullName ?? user?.fullName ?? "—"}
              </p>
            </div>

            <FieldRow label="Full Name">
              <div className="relative flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 h-10">
                <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                </svg>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="flex-1 text-sm text-gray-800 dark:text-gray-100 bg-transparent outline-none"
                />
              </div>
            </FieldRow>

            <FieldRow label="Email">
              <div className="relative flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 h-10">
                <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <input
                  type="email"
                  value={profile?.email ?? user?.email ?? ""}
                  disabled
                  className="flex-1 text-sm text-gray-400 bg-transparent outline-none cursor-not-allowed"
                />
              </div>
            </FieldRow>

            <FieldRow label="Current Password">
              <div className={`relative flex items-center rounded-lg border bg-white dark:bg-gray-800 px-3 h-10 ${passwordError && !currentPassword ? "border-red-400" : "border-gray-200 dark:border-gray-700"}`}>
                <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => { setCurrentPassword(e.target.value); setPasswordError(""); }}
                  placeholder="Enter current password"
                  className="flex-1 text-sm text-gray-800 dark:text-gray-100 bg-transparent outline-none placeholder:text-gray-400"
                />
              </div>
            </FieldRow>

            <FieldRow label="New Password">
              <div className="relative flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 h-10">
                <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setPasswordError(""); }}
                  placeholder="Enter new password"
                  className="flex-1 text-sm text-gray-800 dark:text-gray-100 bg-transparent outline-none placeholder:text-gray-400"
                />
              </div>
            </FieldRow>

            <FieldRow label="Confirm New Password">
              <div className={`relative flex items-center rounded-lg border bg-white dark:bg-gray-800 px-3 h-10 ${passwordError === "Passwords do not match" ? "border-red-400" : "border-gray-200 dark:border-gray-700"}`}>
                <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setPasswordError(""); }}
                  placeholder="Confirm new password"
                  className="flex-1 text-sm text-gray-800 dark:text-gray-100 bg-transparent outline-none placeholder:text-gray-400"
                />
              </div>
            </FieldRow>

            {passwordError && (
              <p className="mt-1 text-xs text-red-500">{passwordError}</p>
            )}
          </div>
        </SectionRow>

        {/* ── 2FA ─────────────────────────────────────────────── */}
        <SectionRow label="Two-factor authentication (2FA)" description="Keep your account secure by enabling 2FA via SMS or using a temporary one-time passcode (TOTP) from an authenticator app.">
          <div>
            <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-sm font-normal text-gray-800 dark:text-white/90">Text Message (SMS)</p>
                <p className="text-xs text-gray-400 mt-0.5">Receive a one-time passcode via SMS each time you log in.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 pt-0.5">
                <span className="rounded px-2 py-0.5 text-[10px] font-normal bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">Business</span>
                <Toggle checked={false} onChange={() => {}} />
              </div>
            </div>
            <div className="flex items-start justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-normal text-gray-800 dark:text-white/90">Authenticator App (TOTP)</p>
                <p className="text-xs text-gray-400 mt-0.5">Use an app to receive a temporary one-time passcode each time you log in.</p>
              </div>
              <Toggle checked={false} onChange={() => {}} />
            </div>
          </div>
        </SectionRow>

        {/* ── Theme color ──────────────────────────────────────── */}
        <SectionRow label="Theme color" description="Choose a preferred theme for the app.">
          <div className="flex items-center gap-2 flex-wrap">
            {THEME_COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setSelectedColor(color)}
                className="relative w-7 h-7 rounded-full transition-transform hover:scale-110"
                style={{ backgroundColor: color }}
              >
                {selectedColor === color && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        </SectionRow>

        {/* ── Appearance ───────────────────────────────────────── */}
        <SectionRow label="Appearance" description="Choose light or dark mode, or switch your mode automatically based on your system settings.">
          <div className="flex items-center gap-3 flex-wrap">
            {(["light", "dark", "auto"] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setAppearance(mode);
                  if (mode !== "auto") {
                    if ((mode === "dark") !== (theme === "dark")) toggleTheme();
                  }
                }}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-2 transition-colors ${
                  appearance === mode
                    ? "border-brand-500"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                }`}
              >
                {/* Mini preview */}
                <div className={`w-24 h-14 rounded-lg overflow-hidden flex ${mode === "dark" ? "bg-gray-900" : mode === "auto" ? "bg-gradient-to-r from-white to-gray-900" : "bg-white"} border border-gray-200 dark:border-gray-700`}>
                  <div className={`w-8 h-full ${mode === "dark" ? "bg-gray-800" : mode === "auto" ? "bg-gray-100" : "bg-gray-100"}`} />
                  <div className="flex-1 p-1.5 space-y-1">
                    <div className={`h-1.5 rounded-full w-full ${mode === "dark" ? "bg-gray-700" : "bg-gray-200"}`} />
                    <div className={`h-1.5 rounded-full w-3/4 ${mode === "dark" ? "bg-gray-700" : "bg-gray-200"}`} />
                    <div className={`h-1.5 rounded-full w-1/2 ${mode === "dark" ? "bg-gray-700" : "bg-gray-200"}`} />
                  </div>
                </div>
                <span className="text-xs font-normal text-gray-700 dark:text-gray-300 capitalize">{mode}</span>
              </button>
            ))}
          </div>
        </SectionRow>

        {/* ── Contrast ─────────────────────────────────────────── */}
        <SectionRow label="Contrast" description="Turn on and off high contrast text and borders.">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">High Contrast for increased accessibility</span>
            <Toggle checked={highContrast} onChange={() => setHighContrast(v => !v)} />
          </div>
        </SectionRow>

        {/* ── Language & Region ────────────────────────────────── */}
        <SectionRow label="Language & Region" description="Customize your language and region.">
          <div className="space-y-3">
            <FieldRow label="Language">
              <div className="relative">
                <select
                  value={language}
                  disabled
                  className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 pr-8 text-sm text-gray-800 dark:text-gray-100 appearance-none outline-none"
                >
                  <option>English</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </div>
            </FieldRow>
            <FieldRow label="Timezone">
              <div className="relative">
                <select
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 pr-8 text-sm text-gray-800 dark:text-gray-100 appearance-none outline-none"
                >
                  <option value="Asia/Karachi">Asia/Karachi</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="America/Los_Angeles">America/Los_Angeles</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="Asia/Dubai">Asia/Dubai</option>
                  <option value="Asia/Tokyo">Asia/Tokyo</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </div>
            </FieldRow>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyTimezone}
                onChange={() => setNotifyTimezone(v => !v)}
                className="w-4 h-4 rounded border-gray-300 accent-brand-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Notify me of Timezone changes</span>
            </label>
          </div>
        </SectionRow>

        {/* ── Time & Date format ───────────────────────────────── */}
        <SectionRow label="Time & Date format" description="Select the way times & dates are displayed.">
          <div className="space-y-5">
            <div>
              <p className="text-xs font-normal text-gray-500 dark:text-gray-400 mb-2">Start of the calendar week</p>
              {(["sunday", "monday"] as const).map(day => (
                <label key={day} className="flex items-center gap-2 mb-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={startOfWeek === day}
                    onChange={() => setStartOfWeek(day)}
                    className="accent-brand-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{day}</span>
                </label>
              ))}
            </div>
            <div>
              <p className="text-xs font-normal text-gray-500 dark:text-gray-400 mb-2">Time format</p>
              {(["24", "12"] as const).map(fmt => (
                <label key={fmt} className="flex items-center gap-2 mb-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={timeFormat === fmt}
                    onChange={() => setTimeFormat(fmt)}
                    className="accent-brand-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{fmt} hour</span>
                </label>
              ))}
            </div>
            <div>
              <p className="text-xs font-normal text-gray-500 dark:text-gray-400 mb-2">Date format</p>
              {["mm/dd/yyyy", "dd/mm/yyyy", "yyyy/mm/dd"].map(fmt => (
                <label key={fmt} className="flex items-center gap-2 mb-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={dateFormat === fmt}
                    onChange={() => setDateFormat(fmt)}
                    className="accent-brand-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{fmt}</span>
                </label>
              ))}
            </div>
          </div>
        </SectionRow>

        {/* ── Preferences ──────────────────────────────────────── */}
        <SectionRow label="Preferences" description="Manage your in-app preferences.">
          <div>
            <PreferenceToggleRow
              label="Flyout Toast Message"
              description="When performing actions, toast messages may appear in the bottom left-hand of your screen. You can disable that here."
              checked={prefs.flyoutToast}
              onChange={() => togglePref("flyoutToast")}
            />
            <PreferenceToggleRow
              label="Don't post comments with  Return"
              description="Use Cmd + Return to send comments instead of just Return."
              checked={prefs.dontPostWithReturn}
              onChange={() => togglePref("dontPostWithReturn")}
            />
            <PreferenceToggleRow
              label="Keyboard Shortcuts"
              description="Use keyboard shortcuts to quickly navigate and take action through the app without using your mouse."
              checked={prefs.keyboardShortcuts}
              onChange={() => togglePref("keyboardShortcuts")}
            />
            <PreferenceToggleRow
              label="Markdown"
              description="You can disable Markdown shortcuts when typing by turning it off here."
              checked={prefs.markdown}
              onChange={() => togglePref("markdown")}
            />
            <PreferenceToggleRow
              label="Show quotes"
              description="Show celebratory quotes when you clear all your notifications or load certain pages"
              checked={prefs.showQuotes}
              onChange={() => togglePref("showQuotes")}
            />
            <PreferenceToggleRow
              label="Show Celebrations"
              description="Show confetti celebrations when you clear My Work, clear all notifications, or complete a Goal Target."
              checked={prefs.showCelebrations}
              onChange={() => togglePref("showCelebrations")}
            />
            <PreferenceToggleRow
              label="Verified"
              description="You can disable your Verified checkmark."
              checked={prefs.verified}
              onChange={() => togglePref("verified")}
            />
            <PreferenceToggleRow
              label="Plain text links"
              description="Pasted URLs will appear as plain text hyperlinks. This will disable auto-unfurling hyperlinks such as embeds or bookmarks"
              checked={prefs.plainTextLinks}
              onChange={() => togglePref("plainTextLinks")}
            />
            <PreferenceToggleRow
              label="Performance mode"
              description="Enhance performance by turning off non-essential features like product guides and certain visuals. A refresh is required to apply the changes."
              checked={prefs.performanceMode}
              onChange={() => togglePref("performanceMode")}
            />
            <PreferenceToggleRow
              label="Detect Desktop App"
              description="Automatically open links in the desktop app when it's running."
              checked={prefs.detectDesktopApp}
              onChange={() => togglePref("detectDesktopApp")}
            />
            <PreferenceToggleRow
              label="Block Select All"
              description="Press Cmd + A to select all text in the current block, press again to select all."
              checked={prefs.blockSelectAll}
              onChange={() => togglePref("blockSelectAll")}
            />
            <PreferenceToggleRow
              label="Browser Tab Limits"
              description="Set how many tabs can be active at the same time. Visible tabs stay active, with least-used tabs going to sleep first."
              checked={prefs.browserTabLimits}
              onChange={() => togglePref("browserTabLimits")}
            />
            <PreferenceToggleRow
              label="Ask to add task to priorities after assigning"
              description="Show a prompt asking if you'd like to add the task to assigned member's priorities."
              checked={prefs.askAddToPriorities}
              onChange={() => togglePref("askAddToPriorities")}
            />
          </div>
        </SectionRow>

        {/* ── Login Permissions ────────────────────────────────── */}
        <SectionRow
          label="Login Permissions for Support"
          description="If login permissions are granted, our trained Support Specialists can access your account to troubleshoot specific issues you raise in a support ticket."
        >
          <div className="space-y-2">
            {([
              ["disabled", "Disabled"],
              ["login", "Login and testing permissions granted"],
              ["all", "Login, testing, video, and screenshot permissions granted"],
            ] as const).map(([val, label]) => (
              <label key={val} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={loginPermission === val}
                  onChange={() => setLoginPermission(val)}
                  className="accent-brand-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
              </label>
            ))}
          </div>
        </SectionRow>

        {/* ── Danger zone ──────────────────────────────────────── */}
        <SectionRow label="Danger zone" description="Proceed with caution.">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
            <p className="text-sm text-gray-700 dark:text-gray-300">Log out all sessions including any session on mobile, iPad, and other browsers</p>
            <button
              type="button"
              className="shrink-0 text-sm font-normal text-brand-500 hover:text-brand-600 whitespace-nowrap"
            >
              Log out of all sessions
            </button>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setDeleteModalOpen(true)}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-normal text-white hover:bg-red-600 transition-colors"
            >
              Delete account
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-normal text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </SectionRow>
      </div>

      <ConfirmActionModal
        isOpen={deleteModalOpen}
        title="Delete account"
        description="This will permanently delete your account and all associated data. This action cannot be undone."
        confirmLabel="Delete my account"
        requireText="DELETE"
        requireTextLabel='Type "DELETE" to confirm'
        onClose={() => { if (!deletingAccount) setDeleteModalOpen(false); }}
        onConfirm={handleDeleteAccount}
        isLoading={deletingAccount}
      />

      {/* ── Sticky save bar ──────────────────────────────────── */}
      {isDirty && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">You have unsaved changes</p>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-normal text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}
