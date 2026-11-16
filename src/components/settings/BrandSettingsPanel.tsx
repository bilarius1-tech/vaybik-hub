"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { api } from "@/lib/api-client";
import { useState } from "react";

type Brand = {
  name: string;
  slogan?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  themeVariant: "A" | "B" | "C";
};

type Content = {
  status: "coming_soon" | "open";
  banner?: string | null;
  heroTitle?: string | null;
  heroText?: string | null;
  aboutTitle?: string | null;
  aboutText?: string | null;
  servicesTitle?: string | null;
  servicesText?: string | null;
  contactsTitle?: string | null;
};

type Contacts = {
  email?: string | null;
  telegram?: string | null;
  phone?: string | null;
  address?: string | null;
  social?: {
    vk?: string | null;
    youtube?: string | null;
    github?: string | null;
  };
};

export function BrandSettingsPanel({
  initialBrand,
  initialContent,
  initialContacts,
}: {
  initialBrand: Brand;
  initialContent: Content;
  initialContacts: Contacts;
}) {
  const [brand, setBrand] = useState<Brand>(initialBrand);
  const [content, setContent] = useState<Content>(initialContent);
  const [contacts, setContacts] = useState<Contacts>(initialContacts);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function saveBrand() {
    setErr(null);
    const res = await api("/api/settings/brand", {
      method: "PUT",
      body: JSON.stringify(brand),
    });
    if (res.error) setErr(res.error.message);
    else setMsg("Бренд сохранён");
  }

  async function saveContent() {
    setErr(null);
    const res = await api("/api/settings/content", {
      method: "PUT",
      body: JSON.stringify(content),
    });
    if (res.error) setErr(res.error.message);
    else setMsg("Контент сохранён");
  }

  async function saveContacts() {
    setErr(null);
    const res = await api("/api/settings/contacts", {
      method: "PUT",
      body: JSON.stringify(contacts),
    });
    if (res.error) setErr(res.error.message);
    else setMsg("Контакты сохранены");
  }

  async function upload(kind: "logo" | "favicon", file: File | null) {
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/admin/api/settings/upload", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error?.message || "Ошибка загрузки");
        return;
      }
      const url = json.file.url as string;
      if (kind === "logo") setBrand((b) => ({ ...b, logoUrl: url }));
      else setBrand((b) => ({ ...b, faviconUrl: url }));
      setMsg("Файл загружен");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Бренд" subtitle="название, слоган, тема A/B/C" />
        <div className="grid-g2">
          <Field label="Название" htmlFor="bn">
            <Input
              id="bn"
              value={brand.name}
              onChange={(e) => setBrand({ ...brand, name: e.target.value })}
            />
          </Field>
          <Field label="Слоган" htmlFor="bs">
            <Input
              id="bs"
              value={brand.slogan || ""}
              onChange={(e) => setBrand({ ...brand, slogan: e.target.value })}
            />
          </Field>
          <Field label="Вариант темы" htmlFor="tv">
            <Select
              id="tv"
              value={brand.themeVariant}
              onChange={(e) =>
                setBrand({
                  ...brand,
                  themeVariant: e.target.value as "A" | "B" | "C",
                })
              }
            >
              <option value="A">A — km + оранжевый</option>
              <option value="B">B — тёплый тёмный</option>
              <option value="C">C — синий km</option>
            </Select>
          </Field>
          <Field label="Логотип URL" htmlFor="logo">
            <Input
              id="logo"
              value={brand.logoUrl || ""}
              onChange={(e) => setBrand({ ...brand, logoUrl: e.target.value })}
            />
          </Field>
          <Field label="Загрузить логотип" htmlFor="logo-f">
            <Input
              id="logo-f"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
              disabled={uploading}
              onChange={(e) =>
                void upload("logo", e.target.files?.[0] || null)
              }
            />
          </Field>
          <Field label="Favicon URL" htmlFor="fav">
            <Input
              id="fav"
              value={brand.faviconUrl || ""}
              onChange={(e) =>
                setBrand({ ...brand, faviconUrl: e.target.value })
              }
            />
          </Field>
          <Field label="Загрузить favicon" htmlFor="fav-f">
            <Input
              id="fav-f"
              type="file"
              accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml"
              disabled={uploading}
              onChange={(e) =>
                void upload("favicon", e.target.files?.[0] || null)
              }
            />
          </Field>
        </div>
        <div className="mt-3">
          <Button onClick={() => void saveBrand()}>Сохранить бренд</Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Контент публичного сайта" />
        <div className="grid-g2">
          <Field label="Статус" htmlFor="st">
            <Select
              id="st"
              value={content.status}
              onChange={(e) =>
                setContent({
                  ...content,
                  status: e.target.value as "coming_soon" | "open",
                })
              }
            >
              <option value="coming_soon">Скоро открытие</option>
              <option value="open">Открыто</option>
            </Select>
          </Field>
          <Field label="Баннер" htmlFor="ban">
            <Input
              id="ban"
              value={content.banner || ""}
              onChange={(e) =>
                setContent({ ...content, banner: e.target.value })
              }
            />
          </Field>
          <Field label="Hero — заголовок" htmlFor="ht">
            <Input
              id="ht"
              value={content.heroTitle || ""}
              onChange={(e) =>
                setContent({ ...content, heroTitle: e.target.value })
              }
            />
          </Field>
          <Field label="Hero — текст" htmlFor="hx">
            <Textarea
              id="hx"
              value={content.heroText || ""}
              onChange={(e) =>
                setContent({ ...content, heroText: e.target.value })
              }
            />
          </Field>
          <Field label="О студии — заголовок" htmlFor="at">
            <Input
              id="at"
              value={content.aboutTitle || ""}
              onChange={(e) =>
                setContent({ ...content, aboutTitle: e.target.value })
              }
            />
          </Field>
          <Field label="О студии — текст" htmlFor="ax">
            <Textarea
              id="ax"
              value={content.aboutText || ""}
              onChange={(e) =>
                setContent({ ...content, aboutText: e.target.value })
              }
            />
          </Field>
          <Field label="Сервисы — заголовок" htmlFor="svt">
            <Input
              id="svt"
              value={content.servicesTitle || ""}
              onChange={(e) =>
                setContent({ ...content, servicesTitle: e.target.value })
              }
            />
          </Field>
          <Field label="Сервисы — текст" htmlFor="svx">
            <Textarea
              id="svx"
              value={content.servicesText || ""}
              onChange={(e) =>
                setContent({ ...content, servicesText: e.target.value })
              }
            />
          </Field>
          <Field label="Контакты — заголовок блока" htmlFor="ct">
            <Input
              id="ct"
              value={content.contactsTitle || ""}
              onChange={(e) =>
                setContent({ ...content, contactsTitle: e.target.value })
              }
            />
          </Field>
        </div>
        <div className="mt-3">
          <Button onClick={() => void saveContent()}>Сохранить контент</Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Контакты и соцсети" />
        <div className="grid-g2">
          <Field label="Email" htmlFor="em">
            <Input
              id="em"
              value={contacts.email || ""}
              onChange={(e) =>
                setContacts({ ...contacts, email: e.target.value })
              }
            />
          </Field>
          <Field label="Telegram" htmlFor="tg">
            <Input
              id="tg"
              value={contacts.telegram || ""}
              onChange={(e) =>
                setContacts({ ...contacts, telegram: e.target.value })
              }
            />
          </Field>
          <Field label="Телефон" htmlFor="ph">
            <Input
              id="ph"
              value={contacts.phone || ""}
              onChange={(e) =>
                setContacts({ ...contacts, phone: e.target.value })
              }
            />
          </Field>
          <Field label="Адрес" htmlFor="ad">
            <Input
              id="ad"
              value={contacts.address || ""}
              onChange={(e) =>
                setContacts({ ...contacts, address: e.target.value })
              }
            />
          </Field>
          <Field label="VK" htmlFor="vk">
            <Input
              id="vk"
              value={contacts.social?.vk || ""}
              onChange={(e) =>
                setContacts({
                  ...contacts,
                  social: { ...contacts.social, vk: e.target.value },
                })
              }
            />
          </Field>
          <Field label="YouTube" htmlFor="yt">
            <Input
              id="yt"
              value={contacts.social?.youtube || ""}
              onChange={(e) =>
                setContacts({
                  ...contacts,
                  social: { ...contacts.social, youtube: e.target.value },
                })
              }
            />
          </Field>
          <Field label="GitHub" htmlFor="gh">
            <Input
              id="gh"
              value={contacts.social?.github || ""}
              onChange={(e) =>
                setContacts({
                  ...contacts,
                  social: { ...contacts.social, github: e.target.value },
                })
              }
            />
          </Field>
        </div>
        <div className="mt-3">
          <Button onClick={() => void saveContacts()}>Сохранить контакты</Button>
        </div>
      </Card>

      {msg ? <p className="text-[13px] text-gr">{msg}</p> : null}
      {err ? <p className="text-[13px] text-rd">{err}</p> : null}
      <p className="text-[12px] text-mu">
        Публичный API:{" "}
        <a className="text-ac underline" href="/admin/api/public/site">
          /admin/api/public/site
        </a>
      </p>
    </div>
  );
}
