"use client";

import { useEffect } from "react";
import DOMPurify from "isomorphic-dompurify";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { cx } from "@/components/dashboard/ui";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function normalizeRichTextHtml(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (looksLikeHtml(trimmed)) {
    return trimmed;
  }

  return trimmed
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

export function sanitizeRichTextHtml(value: string) {
  return DOMPurify.sanitize(normalizeRichTextHtml(value), {
    USE_PROFILES: { html: true },
  });
}

function ToolbarButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={cx("rich-editor-toolbar__button", active && "is-active")} onClick={onClick}>
      {label}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write here...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [2, 3],
          },
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
        }),
        Placeholder.configure({
          placeholder,
        }),
      ],
      content: normalizeRichTextHtml(value) || "<p></p>",
      editorProps: {
        attributes: {
          class: "rich-editor-content",
        },
      },
      onUpdate: ({ editor: activeEditor }) => {
        onChange(activeEditor.getHTML());
      },
    },
    [placeholder],
  );

  useEffect(() => {
    if (!editor) {
      return;
    }

    const normalizedValue = normalizeRichTextHtml(value) || "<p></p>";

    if (normalizedValue !== editor.getHTML()) {
      editor.commands.setContent(normalizedValue, { emitUpdate: false });
    }
  }, [editor, value]);

  function handleSetLink() {
    if (!editor) {
      return;
    }

    const currentHref = editor.getAttributes("link").href;
    const nextHref = window.prompt("Enter link URL", typeof currentHref === "string" ? currentHref : "https://");

    if (nextHref === null) {
      return;
    }

    if (!nextHref.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: nextHref.trim() }).run();
  }

  return (
    <div className="rich-editor-shell">
      <div className="rich-editor-toolbar">
        <span>Rich text editor</span>
        <ToolbarButton label="P" active={editor?.isActive("paragraph")} onClick={() => editor?.chain().focus().setParagraph().run()} />
        <ToolbarButton label="H2" active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} />
        <ToolbarButton label="H3" active={editor?.isActive("heading", { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} />
        <ToolbarButton label="Bold" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()} />
        <ToolbarButton label="Italic" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()} />
        <ToolbarButton label="Underline" active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()} />
        <ToolbarButton label="Bullets" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()} />
        <ToolbarButton label="Numbers" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()} />
        <ToolbarButton label="Quote" active={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()} />
        <ToolbarButton label="Link" active={editor?.isActive("link")} onClick={handleSetLink} />
        <ToolbarButton label="Clear" onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()} />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

export function RichTextContent({
  value,
  className,
  emptyLabel = "No content yet.",
}: {
  value: string;
  className?: string;
  emptyLabel?: string;
}) {
  const sanitized = sanitizeRichTextHtml(value);

  if (!sanitized.trim()) {
    return <p className={cx("rich-content rich-content--empty", className)}>{emptyLabel}</p>;
  }

  return <div className={cx("rich-content", className)} dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
