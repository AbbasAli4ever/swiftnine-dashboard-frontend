/**
 * Placeholder data for the Chat module's first UI pass.
 *
 * Deliberately self-contained and typed locally rather than reusing
 * `@/types/chat`: this exists so the layout can be reviewed before any wiring,
 * and the real shapes carry fields the mock has no business inventing. Delete
 * this file when `chatService`/`useDmStore` are wired in — the components take
 * these as props, so nothing else has to change.
 */

export type ChatFilter = "all" | "unread" | "favourites" | "groups";

export interface MockConversation {
  id: string;
  name: string;
  /** Last message preview, already prefixed with a sender where relevant. */
  preview: string;
  /** Pre-formatted for the mock — the real version derives this from a date. */
  timestamp: string;
  unreadCount?: number;
  /** Drives the avatar tint when there is no image. */
  avatarSeed: string;
  isGroup?: boolean;
  isFavourite?: boolean;
  /** Shows the double-tick "delivered" marker on the preview. */
  outgoing?: boolean;
}

export interface MockChannel {
  id: string;
  name: string;
  /** Workspace or project the channel belongs to, shown muted beside the name. */
  context?: string;
  isPrivate?: boolean;
  /** A freshly created channel shows the onboarding cards instead of history. */
  isNew?: boolean;
}

export const MOCK_CHANNELS: MockChannel[] = [
  { id: "c1", name: "General", context: "Swiftnine" },
  { id: "c2", name: "Welcome" },
  { id: "c3", name: "Testing", isPrivate: true, isNew: true },
  // Public counterpart, so the two onboarding variants are both reachable.
  { id: "c4", name: "Announcements", isNew: true },
];

/**
 * A system line in a channel — "X joined", "X renamed the channel", and so on.
 * Rendered differently from a message: no bubble, muted text.
 */
export interface MockChannelEvent {
  id: string;
  actor: string;
  text: string;
  time: string;
}

export const MOCK_CHANNEL_EVENTS: MockChannelEvent[] = [
  {
    id: "e1",
    actor: "Numan Zafar",
    text: "joined testing.",
    time: "4:38 PM",
  },
];

/**
 * Messages in a channel carry their sender, unlike a DM where the two
 * participants are implied by the thread itself.
 */
export interface MockChannelMessage {
  id: string;
  author: string;
  time: string;
  body: string;
}

export const MOCK_CHANNEL_MESSAGES: MockChannelMessage[] = [];

export const MOCK_CONVERSATIONS: MockConversation[] = [
  {
    id: "d1",
    name: "+92 300 4775764",
    preview: "Hello",
    timestamp: "Yesterday",
    avatarSeed: "+92 300 4775764",
  },
  {
    id: "d2",
    name: "Abdul Sami Khan Office No",
    preview: "You reacted 😊 to: 0:08",
    timestamp: "Yesterday",
    avatarSeed: "Abdul Sami Khan",
  },
  {
    id: "d3",
    name: "Sofi Us",
    preview: "Ok",
    timestamp: "Sunday",
    unreadCount: 1,
    avatarSeed: "Sofi Us",
  },
  {
    id: "d4",
    name: "Munish Gupta",
    preview: "Bhai Jan kB tk rabta Hon...",
    timestamp: "Sunday",
    avatarSeed: "Munish Gupta",
    outgoing: true,
  },
  {
    id: "d5",
    name: "TRIO by Maham - Soc...",
    preview: "Sofi: Please share the Post link...",
    timestamp: "Saturday",
    avatarSeed: "TRIO by Maham",
    isGroup: true,
  },
  {
    id: "d6",
    name: "Muhammad Zaeem Ul Has...",
    preview: "Pass nhi pta mujhe",
    timestamp: "Saturday",
    avatarSeed: "Muhammad Zaeem",
  },
];

export type MockMessageKind = "text" | "file" | "image";

export interface MockMessage {
  id: string;
  kind: MockMessageKind;
  /** Text body, or the caption for a file/image. */
  body?: string;
  time: string;
  /** Right-aligned and tinted when true. */
  outgoing: boolean;
  forwarded?: boolean;
  /** Read receipt on an outgoing message. */
  read?: boolean;
  file?: { name: string; type: string; size: string };
  /** Day separator shown above this message, e.g. "SATURDAY". */
  daySeparator?: string;
}

export const MOCK_MESSAGES: MockMessage[] = [
  {
    id: "m1",
    kind: "file",
    forwarded: true,
    outgoing: false,
    time: "13:02",
    file: { name: "Bullion brand Kit Desi...", type: "RAR", size: "34 MB" },
  },
  {
    id: "m2",
    kind: "file",
    forwarded: true,
    outgoing: false,
    time: "13:02",
    file: { name: "Bullion final logo.zip", type: "ZIP", size: "9 MB" },
  },
  {
    id: "m3",
    kind: "text",
    outgoing: true,
    read: true,
    time: "17:24",
    daySeparator: "SATURDAY",
    body: "https://www.figma.com/design/Z7vmZZn9c3wUPmqJNAfz7g/9-figure-7-7?node-id=0-1&t=YcwT8pbtlo9QZqdH-1",
  },
  {
    id: "m4",
    kind: "text",
    outgoing: true,
    read: true,
    time: "15:26",
    body: "https://www.figma.com/design/XJtd5pfK5vxIT8jCr5Us9U/MuteTaxes-V3---Copy-?node-id=2228-7333&t=a7vIpGroP8lexy2A-1\nMutetaxes Updated Figma",
  },
  {
    id: "m5",
    kind: "image",
    outgoing: true,
    read: true,
    time: "15:29",
  },
];

export const MOCK_ACTIVE_CONVERSATION = MOCK_CONVERSATIONS[1];
