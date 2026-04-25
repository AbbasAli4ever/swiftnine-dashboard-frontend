import { api } from "@/lib/api";
import { getAccessToken } from "@/stores/auth.store";
import { getActiveWorkspaceId } from "@/stores/workspace.store";

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

export interface CommentAuthor {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface ReactionMember {
  id: string;
  userId: string;
  role: string;
  user?: { id: string; fullName: string; avatarUrl: string | null };
}

export interface CommentReaction {
  id: string;
  commentId: string;
  memberId: string;
  reactFace: string;
  createdAt: string;
  member?: ReactionMember;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  parentId: string | null;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  author: CommentAuthor;
  reactions: CommentReaction[];
}

export type SSEHandlers = {
  onInit: (comments: Comment[]) => void;
  onCreated: (comment: Comment) => void;
  onUpdated: (comment: Comment) => void;
  onDeleted: (deletedIds: string[]) => void;
  onReactionCreated: (commentId: string, reaction: CommentReaction) => void;
  onReactionUpdated: (commentId: string, reaction: CommentReaction) => void;
  onReactionDeleted: (commentId: string, reactionId: string) => void;
};

export const commentService = {
  createComment: (taskId: string, content: string, parentId?: string, mentionedUserIds?: string[]) =>
    api
      .post<ApiWrapper<Comment>>(`/tasks/${taskId}/comments`, { content, parentId, mentionedUserIds })
      .then((r) => r.data.data),

  updateComment: (commentId: string, content: string, mentionedUserIds?: string[]) =>
    api
      .put<ApiWrapper<Comment>>(`/comments/${commentId}`, { content, mentionedUserIds })
      .then((r) => r.data.data),

  deleteComment: (commentId: string) =>
    api.delete(`/comments/${commentId}`),

  addReaction: (commentId: string, reactFace: string) =>
    api
      .post<ApiWrapper<CommentReaction>>(`/comments/${commentId}/reactions`, { reactFace })
      .then((r) => r.data.data),

  patchReaction: (reactionId: string, reactFace: string) =>
    api
      .patch<ApiWrapper<CommentReaction>>(`/reactions/${reactionId}`, { reactFace })
      .then((r) => r.data.data),

  deleteReaction: (reactionId: string) =>
    api.delete(`/reactions/${reactionId}`),

  openStream: (taskId: string, handlers: SSEHandlers, signal: AbortSignal): void => {
    const workspaceId = getActiveWorkspaceId() ?? "";
    const token = getAccessToken() ?? "";
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";
    const url = `${baseUrl}/tasks/${taskId}/comments/stream`;

    const dispatch = (eventName: string, raw: string) => {
      try {
        const payload = JSON.parse(raw);
        if (eventName === "comments:init") {
          handlers.onInit(Array.isArray(payload) ? payload : []);
        } else if (eventName === "comment:created") {
          handlers.onCreated(payload as Comment);
        } else if (eventName === "comment:updated") {
          handlers.onUpdated(payload as Comment);
        } else if (eventName === "comment:deleted") {
          const p = payload as { id?: string; deletedIds?: string[] };
          handlers.onDeleted(p.deletedIds ?? (p.id ? [p.id] : []));
        } else if (eventName === "reaction:created") {
          const r = payload as CommentReaction & { commentId: string };
          handlers.onReactionCreated(r.commentId, r);
        } else if (eventName === "reaction:updated") {
          const r = payload as CommentReaction & { commentId: string };
          handlers.onReactionUpdated(r.commentId, r);
        } else if (eventName === "reaction:deleted") {
          const r = payload as { id: string; commentId: string };
          handlers.onReactionDeleted(r.commentId, r.id);
        }
      } catch { /* ignore malformed frames */ }
    };

    const connect = async () => {
      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-workspace-id": workspaceId,
            Accept: "text/event-stream",
          },
          signal,
        });

        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let currentEvent = "message";

        while (true) {
          const { done, value } = await reader.read();
          if (done || signal.aborted) break;

          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dispatch(currentEvent, line.slice(5).trim());
              currentEvent = "message";
            } else if (line === "") {
              currentEvent = "message";
            }
          }
        }
      } catch {
        /* fetch aborted or network error */
      }
    };

    void connect();
  },
};
