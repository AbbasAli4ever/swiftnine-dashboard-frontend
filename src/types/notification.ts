export interface Notification {
  id: string;
  userId?: string;
  type: string;
  title: string;
  message: string | null;
  referenceType: string;
  referenceId: string;
  taskId: string | null;
  taskName: string | null;
  commentId: string | null;
  commentName: string | null;
  actorId: string | null;
  isCommented: boolean;
  replyCommentId: string | null;
  repliedToCommentId: string | null;
  isRead: boolean;
  readAt?: string | null;
  isCleared: boolean;
  isSnoozed: boolean;
  snoozedAt: string | null;
  createdAt: string;
}

export type NotificationSSEHandlers = {
  onInit: (items: Notification[]) => void;
  onCreated: (item: Notification) => void;
  onUpdated: (item: Notification) => void;
};
