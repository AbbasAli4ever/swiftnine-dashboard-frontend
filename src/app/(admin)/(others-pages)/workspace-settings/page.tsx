import { Metadata } from "next";
import WorkspaceSettingsPage from "@/components/workspace/WorkspaceSettingsPage";

export const metadata: Metadata = {
  title: "Workspace Settings | FocusHub",
  description: "Manage workspace profile, branding, and danger zone settings.",
};

export default function WorkspaceSettings() {
  return <WorkspaceSettingsPage />;
}
