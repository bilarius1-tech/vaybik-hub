"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { api } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type ServiceFormValues = {
  slug: string;
  name: string;
  url: string;
  description?: string | null;
  type: "DOCKER" | "EXTERNAL" | "STATIC";
  healthUrl?: string | null;
  expectedStatus: number;
  keyword?: string | null;
  intervalSec: number;
  timeoutMs: number;
  isPublic: boolean;
  isDeployed: boolean;
  tags: string[];
};

const empty: ServiceFormValues = {
  slug: "",
  name: "",
  url: "https://",
  description: "",
  type: "DOCKER",
  healthUrl: "",
  expectedStatus: 200,
  keyword: "",
  intervalSec: 60,
  timeoutMs: 10000,
  isPublic: false,
  isDeployed: true,
  tags: [],
};

type Props = {
  mode: "create" | "edit";
  serviceId?: string;
  initial?: Partial<ServiceFormValues>;
};

export function ServiceForm({ mode, serviceId, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ServiceFormValues>({ ...empty, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof ServiceFormValues>(key: K, value: ServiceFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const payload = {
      ...form,
      healthUrl: form.healthUrl || null,
      description: form.description || null,
      keyword: form.keyword || null,
      tags: form.tags,
    };
    const res =
      mode === "create"
        ? await api<{ service: { slug: string } }>("/api/services", {
            method: "POST",
            body: JSON.stringify(payload),
          })
        : await api<{ service: { slug: string } }>(`/api/services/${serviceId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
    setLoading(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    router.push(`/services/${res.data?.service.slug}`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader
        title={mode === "create" ? "Новый сервис" : "Редактирование"}
      />
      <form onSubmit={onSubmit} className="grid-g2">
        <Field label="Название" htmlFor="name">
          <Input
            id="name"
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field label="Slug" htmlFor="slug">
          <Input
            id="slug"
            required
            disabled={mode === "edit"}
            value={form.slug}
            onChange={(e) => set("slug", e.target.value)}
          />
        </Field>
        <Field label="URL" htmlFor="url">
          <Input
            id="url"
            required
            type="url"
            value={form.url}
            onChange={(e) => set("url", e.target.value)}
          />
        </Field>
        <Field label="Тип" htmlFor="type">
          <Select
            id="type"
            value={form.type}
            onChange={(e) =>
              set("type", e.target.value as ServiceFormValues["type"])
            }
          >
            <option value="DOCKER">DOCKER</option>
            <option value="EXTERNAL">EXTERNAL</option>
            <option value="STATIC">STATIC</option>
          </Select>
        </Field>
        <Field label="Health URL" htmlFor="health">
          <Input
            id="health"
            type="url"
            value={form.healthUrl || ""}
            onChange={(e) => set("healthUrl", e.target.value)}
          />
        </Field>
        <Field label="Ожидаемый код" htmlFor="code">
          <Input
            id="code"
            type="number"
            value={form.expectedStatus}
            onChange={(e) => set("expectedStatus", Number(e.target.value))}
          />
        </Field>
        <Field label="Ключевое слово" htmlFor="kw">
          <Input
            id="kw"
            value={form.keyword || ""}
            onChange={(e) => set("keyword", e.target.value)}
          />
        </Field>
        <Field label="Интервал, сек" htmlFor="int">
          <Input
            id="int"
            type="number"
            value={form.intervalSec}
            onChange={(e) => set("intervalSec", Number(e.target.value))}
          />
        </Field>
        <label className="mt-6 flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={form.isDeployed}
            onChange={(e) => set("isDeployed", e.target.checked)}
          />
          Развёрнут
        </label>
        <label className="mt-6 flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={form.isPublic}
            onChange={(e) => set("isPublic", e.target.checked)}
          />
          На публичной витрине
        </label>
        {error ? (
          <p className="col-span-full text-[13px] text-rd">{error}</p>
        ) : null}
        <div className="col-span-full mt-2 flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Сохраняем…" : "Сохранить"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Отмена
          </Button>
        </div>
      </form>
    </Card>
  );
}
