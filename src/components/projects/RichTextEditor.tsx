"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent, Extension, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import styles from "./RichTextEditor.module.css";
import {
  LuBold, LuItalic, LuUnderline, LuStrikethrough,
  LuList, LuListOrdered, LuQuote,
  LuAlignLeft, LuAlignCenter, LuAlignRight,
  LuHeading1, LuHeading2,
  LuUndo2, LuRedo2, LuMinus,
} from "react-icons/lu";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

function Btn({ onClick, active, disabled, title, children }: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`flex h-7 w-7 items-center justify-center rounded transition-colors disabled:opacity-30
        ${active
          ? "bg-brand-100 text-brand-600 dark:bg-brand-900/60 dark:text-brand-300"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
        }`}
    >
      {children}
    </button>
  );
}

const Sep = () => <div className="mx-1 h-5 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />;

/* Shift+Enter: new list item inside lists, new paragraph outside */
const ShiftEnter = Extension.create({
  name: "shiftEnter",
  addKeyboardShortcuts() {
    return {
      "Shift-Enter": ({ editor }) => {
        if (editor.isActive("listItem")) {
          return editor.commands.splitListItem("listItem");
        }
        return editor.commands.splitBlock();
      },
    };
  },
});

export default function RichTextEditor({ value, onChange, placeholder = "Add a description…" }: Props) {
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        hardBreak: false,
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
      ShiftEnter,
    ],
    content: value || "",
    onUpdate({ editor }) {
      const html = editor.getHTML();
      const out = html === "<p></p>" ? "" : html;
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => onChange(out), 600);
    },
  });

  const lastSyncedValue = useRef(value);
  useEffect(() => {
    if (!editor || value === lastSyncedValue.current) return;
    lastSyncedValue.current = value;
    const current = editor.getHTML();
    const incoming = value || "";
    if (current !== incoming) editor.commands.setContent(incoming);
  }, [editor, value]);

  useEffect(() => () => { if (saveTimeout.current) clearTimeout(saveTimeout.current); }, []);

  // Subscribe to editor state so toolbar re-renders on every selection/content change
  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      canUndo: ctx.editor?.can().undo() ?? false,
      canRedo: ctx.editor?.can().redo() ?? false,
      isBold: ctx.editor?.isActive("bold") ?? false,
      isItalic: ctx.editor?.isActive("italic") ?? false,
      isUnderline: ctx.editor?.isActive("underline") ?? false,
      isStrike: ctx.editor?.isActive("strike") ?? false,
      isBullet: ctx.editor?.isActive("bulletList") ?? false,
      isOrdered: ctx.editor?.isActive("orderedList") ?? false,
      isBlockquote: ctx.editor?.isActive("blockquote") ?? false,
      isH1: ctx.editor?.isActive("heading", { level: 1 }) ?? false,
      isH2: ctx.editor?.isActive("heading", { level: 2 }) ?? false,
      isAlignLeft: ctx.editor?.isActive({ textAlign: "left" }) ?? false,
      isAlignCenter: ctx.editor?.isActive({ textAlign: "center" }) ?? false,
      isAlignRight: ctx.editor?.isActive({ textAlign: "right" }) ?? false,
    }),
  });

  if (!editor) return null;

  const st = editorState ?? {
    canUndo: false, canRedo: false,
    isBold: false, isItalic: false, isUnderline: false, isStrike: false,
    isBullet: false, isOrdered: false, isBlockquote: false,
    isH1: false, isH2: false,
    isAlignLeft: false, isAlignCenter: false, isAlignRight: false,
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 dark:border-gray-700 dark:bg-gray-900 dark:focus-within:border-brand-600 dark:focus-within:ring-brand-900/40">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-100 bg-gray-50/80 px-2 py-1.5 dark:border-gray-800 dark:bg-gray-800/50">
        <Btn title="Undo" disabled={!st.canUndo} onClick={() => editor.chain().focus().undo().run()}>
          <LuUndo2 className="h-3.5 w-3.5" />
        </Btn>
        <Btn title="Redo" disabled={!st.canRedo} onClick={() => editor.chain().focus().redo().run()}>
          <LuRedo2 className="h-3.5 w-3.5" />
        </Btn>
        <Sep />
        <Btn title="Heading 1" active={st.isH1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <LuHeading1 className="h-3.5 w-3.5" />
        </Btn>
        <Btn title="Heading 2" active={st.isH2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <LuHeading2 className="h-3.5 w-3.5" />
        </Btn>
        <Sep />
        <Btn title="Bold (⌘B)" active={st.isBold} onClick={() => editor.chain().focus().toggleBold().run()}>
          <LuBold className="h-3.5 w-3.5" />
        </Btn>
        <Btn title="Italic (⌘I)" active={st.isItalic} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <LuItalic className="h-3.5 w-3.5" />
        </Btn>
        <Btn title="Underline (⌘U)" active={st.isUnderline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <LuUnderline className="h-3.5 w-3.5" />
        </Btn>
        <Btn title="Strikethrough" active={st.isStrike} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <LuStrikethrough className="h-3.5 w-3.5" />
        </Btn>
        <Sep />
        <Btn title="Bullet list" active={st.isBullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <LuList className="h-3.5 w-3.5" />
        </Btn>
        <Btn title="Numbered list" active={st.isOrdered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <LuListOrdered className="h-3.5 w-3.5" />
        </Btn>
        <Btn title="Blockquote" active={st.isBlockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <LuQuote className="h-3.5 w-3.5" />
        </Btn>
        <Sep />
        <Btn title="Align left" active={st.isAlignLeft} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <LuAlignLeft className="h-3.5 w-3.5" />
        </Btn>
        <Btn title="Align center" active={st.isAlignCenter} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <LuAlignCenter className="h-3.5 w-3.5" />
        </Btn>
        <Btn title="Align right" active={st.isAlignRight} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <LuAlignRight className="h-3.5 w-3.5" />
        </Btn>
        <Sep />
        <Btn title="Divider line" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <LuMinus className="h-3.5 w-3.5" />
        </Btn>
      </div>

      {/* ── Content ── */}
      <div className={`${styles.body} px-4 py-3 text-sm leading-relaxed text-gray-700 dark:text-gray-200`}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
