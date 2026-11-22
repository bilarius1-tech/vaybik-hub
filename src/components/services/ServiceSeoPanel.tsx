"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { api, apiForm } from "@/lib/api-client";
import { useEffect, useMemo, useState } from "react";

type SeoRow = {
  title: string | null;
  description: string | null;
  canonical: string | null;
  robots: string;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterCard: string | null;
  jsonLd: unknown;
  yandexMetrika: string | null;
  yandexWebmaster: string | null;
  googleSearchConsole: string | null;
  googleAnalytics: string | null;
  robotsTxt: string | null;
  llmsTxt: string | null;
  sitemapUrl: string | null;
  faviconGeneratedAt: string | null;
};

function lenTone(n: number, soft: number, hard: number): "ok" | "warn" | "bad" {
  if (n > hard) return "bad";
  if (n > soft) return "warn";
  return "ok";
}

export function ServiceSeoPanel({ serviceId }: { serviceId: string }) {
  const [seo, setSeo] = useState<SeoRow | null>(null);
  const [jsonLdText, setJsonLdText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await api<{ seo: SeoRow }>(`/api/services/${serviceId}/seo`);
      if (cancelled) return;
      if (res.error) {
        setErr(res.error.message);
        setLoaded(true);
        return;
      }
      const row = res.data!.seo;
      setSeo(row);
      setJsonLdText(
        row.jsonLd ? JSON.stringify(row.jsonLd, null, 2) : "",
      );
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  const titleLen = seo?.title?.length || 0;
  const descLen = seo?.description?.length || 0;
  const titleTone = useMemo(() => lenTone(titleLen, 60, 70), [titleLen]);
  const descTone = useMemo(() => lenTone(descLen, 160, 180), [descLen]);

  function patch<K extends keyof SeoRow>(key: K, value: SeoRow[K]) {
    setSeo((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!seo) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await api<{ seo: SeoRow }>(`/api/services/${serviceId}/seo`, {
      method: "PUT",
      body: JSON.stringify({
        ...seo,
        jsonLd: jsonLdText,
      }),
    });
    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setSeo(res.data!.seo);
    setJsonLdText(
      res.data!.seo.jsonLd
        ? JSON.stringify(res.data!.seo.jsonLd, null, 2)
        : "",
    );
    setMsg("SEO сохранено");
  }

  async function uploadFavicon(file: File) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await apiForm<{ seo: SeoRow }>(
      `/api/services/${serviceId}/seo/favicon`,
      fd,
    );
    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setSeo(res.data!.seo);
    setMsg("Favicon сгенерирован");
  }

  if (!loaded) {
    return (
      <Card>
        <CardHeader title="SEO и аналитика" />
        <p className="text-[13px] text-mu">Загрузка…</p>
      </Card>
    );
  }
  if (!seo) {
    return (
      <Card>
        <CardHeader title="SEO и аналитика" />
        <p className="text-[13px] text-rd">{err || "Не удалось загрузить"}</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="SEO и аналитика"
        subtitle="доменные настройки для сервиса и публичного API"
      />
      <div className="space-y-4">
        <div className="grid-g2">
          <Field label={`Title (${titleLen}) · ~60`}>
            <Input
              value={seo.title || ""}
              onChange={(e) => patch("title", e.target.value || null)}
              className={titleTone === "bad" ? "border-rd" : undefined}
            />
          </Field>
          <Field label="Canonical">
            <Input
              value={seo.canonical || ""}
              onChange={(e) => patch("canonical", e.target.value || null)}
              placeholder="https://…"
            />
          </Field>
        </div>
        <Field label={`Description (${descLen}) · ~160`}>
          <Textarea
            rows={3}
            value={seo.description || ""}
            onChange={(e) => patch("description", e.target.value || null)}
            className={descTone === "bad" ? "border-rd" : undefined}
          />
        </Field>
        <div className="rounded-[12px] border border-bd bg-card2/40 p-3">
          <p className="text-[12.5px] font-semibold text-mu">Превью сниппета</p>
          <p className="mt-1 text-[18px] font-bold text-ac">
            {seo.title || "Заголовок"}
          </p>
          <p className="text-[13px] text-mu">
            {seo.canonical || "https://example.vaybik.ru/"}
          </p>
          <p className="mt-1 text-[13px] text-tx">
            {seo.description || "Описание появится здесь."}
          </p>
        </div>

        <div className="grid-g2">
          <Field label="OG title">
            <Input
              value={seo.ogTitle || ""}
              onChange={(e) => patch("ogTitle", e.target.value || null)}
            />
          </Field>
          <Field label="OG image URL">
            <Input
              value={seo.ogImage || ""}
              onChange={(e) => patch("ogImage", e.target.value || null)}
              placeholder="https://… или /media/…"
            />
          </Field>
        </div>
        <Field label="OG description">
          <Textarea
            rows={2}
            value={seo.ogDescription || ""}
            onChange={(e) => patch("ogDescription", e.target.value || null)}
          />
        </Field>
        <Field label="Robots (meta)">
          <Input
            value={seo.robots || ""}
            onChange={(e) => patch("robots", e.target.value)}
          />
        </Field>

        <h3 className="text-[14px] font-extrabold text-tx">Счётчики</h3>
        <div className="grid-g2">
          <Field label="Яндекс.Метрика (ID)">
            <Input
              value={seo.yandexMetrika || ""}
              onChange={(e) => patch("yandexMetrika", e.target.value || null)}
            />
          </Field>
          <Field label="Яндекс.Вебмастер (content)">
            <Input
              value={seo.yandexWebmaster || ""}
              onChange={(e) =>
                patch("yandexWebmaster", e.target.value || null)
              }
            />
          </Field>
          <Field label="Google Search Console (content)">
            <Input
              value={seo.googleSearchConsole || ""}
              onChange={(e) =>
                patch("googleSearchConsole", e.target.value || null)
              }
            />
          </Field>
          <Field label="Google Analytics (опц.)">
            <Input
              value={seo.googleAnalytics || ""}
              onChange={(e) =>
                patch("googleAnalytics", e.target.value || null)
              }
            />
          </Field>
        </div>

        <Field label="Sitemap URL">
          <Input
            value={seo.sitemapUrl || ""}
            onChange={(e) => patch("sitemapUrl", e.target.value || null)}
          />
        </Field>
        <Field label="robots.txt">
          <Textarea
            rows={8}
            className="font-mono text-[12px]"
            value={seo.robotsTxt || ""}
            onChange={(e) => patch("robotsTxt", e.target.value || null)}
          />
        </Field>
        <Field label="llms.txt">
          <Textarea
            rows={6}
            className="font-mono text-[12px]"
            value={seo.llmsTxt || ""}
            onChange={(e) => patch("llmsTxt", e.target.value || null)}
          />
        </Field>
        <Field label="JSON-LD">
          <Textarea
            rows={8}
            className="font-mono text-[12px]"
            value={jsonLdText}
            onChange={(e) => setJsonLdText(e.target.value)}
          />
        </Field>

        <div>
          <p className="mb-2 text-[12.5px] font-semibold text-mu">
            Favicon (SVG/PNG ≥512) — сгенерируем ico/32/180/192/512 + manifest
          </p>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFavicon(f);
              e.target.value = "";
            }}
          />
          <p className="mt-1 text-[12px] text-mu">
            {seo.faviconGeneratedAt
              ? `Сгенерирован: ${new Date(seo.faviconGeneratedAt).toLocaleString("ru-RU")}`
              : "Ещё не загружен"}
          </p>
        </div>

        {msg ? <p className="text-[13px] text-gr">{msg}</p> : null}
        {err ? <p className="text-[13px] text-rd">{err}</p> : null}
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? "Сохраняем…" : "Сохранить SEO"}
        </Button>
      </div>
    </Card>
  );
}
