"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { api } from "@/lib/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClientCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await api<{ client: { id: string } }>("/api/clients", {
      method: "POST",
      body: JSON.stringify({
        name,
        siteUrl: siteUrl || null,
        contact: contact || null,
        status: "active",
      }),
    });
    setLoading(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    router.push(`/clients/${res.data!.client.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="mt-[10px] text-[16.5px] font-extrabold text-tx">
          Новый клиент
        </h2>
        <Link href="/clients">
          <Button variant="ghost">К списку</Button>
        </Link>
      </div>

      <Card>
        <CardHeader
          title="Карточка"
          subtitle="открытой регистрации нет — только OWNER/ADMIN"
        />
        <form onSubmit={onSubmit} className="grid-g2 max-w-2xl">
          <Field label="Название" htmlFor="name">
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Тест"
            />
          </Field>
          <Field label="Сайт" htmlFor="site">
            <Input
              id="site"
              type="url"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://…"
            />
          </Field>
          <Field label="Контакт" htmlFor="contact" className="col-span-full">
            <Input
              id="contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="email / Telegram / телефон"
            />
          </Field>
          {error ? (
            <p className="col-span-full text-[13px] text-rd">{error}</p>
          ) : null}
          <div className="col-span-full mt-2 flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Создаём…" : "Создать"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Отмена
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
