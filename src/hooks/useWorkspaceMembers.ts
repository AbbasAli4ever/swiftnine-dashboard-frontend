import { useWorkspaceStore } from "@/stores/workspace.store";

// Pure reader — no fetch side effect. Initial load is handled once at app level (WorkspaceContext).
// Call refetch() on-demand (e.g. when opening an assignee picker).
export function useWorkspaceMembers() {
  const members = useWorkspaceStore((s) => s.members);
  const fetchMembers = useWorkspaceStore((s) => s.fetchMembers);
  return { members, refetch: fetchMembers };
}
