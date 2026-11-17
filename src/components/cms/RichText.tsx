"use client";

import { MediaPicker, type MediaPickerValue } from "@/components/cms/MediaPicker";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import type { RichTextPreset } from "@/lib/cms-richtext";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";

type Props = {
  value: string;
  onChange: (html: string) => void;
  preset?: RichTextPreset;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
};

function cleanPastedHtml(html: string): string {
  return html
    .replace(/<\/?(span|font|o:p)[^>]*>/gi, "")
    .replace(/\s(style|class)="[^"]*"/gi, "")
    .replace(/<p>(?:\s|&nbsp;)*<\/p>/gi, "");
}

export function RichText({
  value,
  onChange,
  preset = "basic",
  placeholder = "Текст…",
  label,
  disabled,
}: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkBlank, setLinkBlank] = useState(false);
  const [linkNofollow, setLinkNofollow] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);

  const allowHeading = preset === "full";
  const allowImage = preset === "full";
  const allowBlock = preset !== "inline";

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: allowHeading ? { levels: [2, 3, 4] } : false,
        blockquote: allowHeading ? {} : false,
        horizontalRule: allowHeading ? {} : false,
        bulletList: allowBlock ? {} : false,
        orderedList: allowBlock ? {} : false,
        paragraph: allowBlock ? {} : false,
        codeBlock: false,
        code: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer" },
      }),
      ...(allowImage
        ? [
            Image.extend({
              addAttributes() {
                return {
                  ...this.parent?.(),
                  "data-media-id": {
                    default: null,
                    parseHTML: (el) => el.getAttribute("data-media-id"),
                    renderHTML: (attrs) =>
                      attrs["data-media-id"]
                        ? { "data-media-id": attrs["data-media-id"] }
                        : {},
                  },
                };
              },
            }).configure({
              HTMLAttributes: { loading: "lazy" },
            }),
          ]
        : []),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "min-h-[88px] rounded-md border border-bd bg-bg2 px-[11px] py-[9px] text-[14px] font-semibold text-tx outline-none focus:border-ac prose-cms",
      },
      transformPastedHTML: cleanPastedHtml,
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && value !== editor.getText()) {
      // внешнее обновление (загрузка страницы / откат)
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  function openLinkDialog() {
    if (!editor) return;
    const prev = editor.getAttributes("link");
    setLinkUrl(prev.href || "");
    setLinkBlank(prev.target === "_blank");
    setLinkNofollow(/\bnofollow\b/.test(prev.rel || ""));
    setLinkOpen(true);
  }

  function applyLink() {
    if (!editor) return;
    const href = linkUrl.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      const rel = ["noopener", "noreferrer"];
      if (linkNofollow) rel.push("nofollow");
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({
          href,
          target: linkBlank ? "_blank" : null,
          rel: rel.join(" "),
        })
        .run();
    }
    setLinkOpen(false);
  }

  function insertMedia(v: MediaPickerValue) {
    if (!editor) return;
    const src = `/admin/api/public/media/${v.mediaId}/v1/orig`;
    editor
      .chain()
      .focus()
      .setImage({
        src,
        alt: v.alt || "",
      })
      .run();
    // data-media-id через updateAttributes
    editor
      .chain()
      .focus()
      .updateAttributes("image", { "data-media-id": v.mediaId })
      .run();
    setMediaOpen(false);
  }

  const bar = (
    <div className="mb-1 flex flex-wrap gap-1">
      <Btn
        label="Ж"
        title="Жирный"
        active={editor?.isActive("bold")}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      />
      <Btn
        label="К"
        title="Курсив"
        active={editor?.isActive("italic")}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      />
      {allowBlock ? (
        <>
          <Btn
            label="•"
            title="Список"
            active={editor?.isActive("bulletList")}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          />
          <Btn
            label="1."
            title="Нумерованный"
            active={editor?.isActive("orderedList")}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          />
        </>
      ) : null}
      {allowHeading ? (
        <>
          <Btn
            label="H2"
            active={editor?.isActive("heading", { level: 2 })}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
          />
          <Btn
            label="H3"
            active={editor?.isActive("heading", { level: 3 })}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 3 }).run()
            }
          />
          <Btn
            label="H4"
            active={editor?.isActive("heading", { level: 4 })}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 4 }).run()
            }
          />
          <Btn
            label="«»"
            title="Цитата"
            active={editor?.isActive("blockquote")}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          />
          <Btn
            label="—"
            title="Разделитель"
            onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          />
        </>
      ) : null}
      <Btn label="🔗" title="Ссылка" onClick={openLinkDialog} />
      {allowImage ? (
        <Btn label="🖼" title="Картинка" onClick={() => setMediaOpen(true)} />
      ) : null}
    </div>
  );

  const body = (
    <div>
      {bar}
      <EditorContent editor={editor} />
      {linkOpen ? (
        <div className="mt-2 space-y-2 rounded-xl border border-bd bg-card p-3">
          <Field label="URL">
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://… или /path/"
            />
          </Field>
          <label className="flex items-center gap-2 text-[12.5px] text-mu">
            <input
              type="checkbox"
              checked={linkBlank}
              onChange={(e) => setLinkBlank(e.target.checked)}
            />
            В новой вкладке
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-mu">
            <input
              type="checkbox"
              checked={linkNofollow}
              onChange={(e) => setLinkNofollow(e.target.checked)}
            />
            nofollow
          </label>
          <div className="flex gap-2">
            <Button variant="primary" onClick={applyLink}>
              Применить
            </Button>
            <Button variant="ghost" onClick={() => setLinkOpen(false)}>
              Отмена
            </Button>
          </div>
        </div>
      ) : null}
      <MediaPicker
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
        onSelect={insertMedia}
        title="Картинка в текст"
      />
    </div>
  );

  if (label) {
    return <Field label={label}>{body}</Field>;
  }
  return body;
}

function Btn({
  label,
  title,
  active,
  onClick,
}: {
  label: string;
  title?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title || label}
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-[12px] font-bold ${
        active
          ? "border-ac bg-ac/15 text-ac"
          : "border-bd bg-bg2 text-tx hover:border-ac/50"
      }`}
    >
      {label}
    </button>
  );
}
