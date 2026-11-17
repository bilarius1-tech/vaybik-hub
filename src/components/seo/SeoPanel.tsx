"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { api } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type SeoPageRow = {
  id: string;
  host: string;
  path: string;
  title: string | null;
  description: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  inSitemap: boolean;
  robots: string;
  jsonLd: unknown;
};

type Counters = {
  yandexWebmaster?: string | null;
  yandexMetrika?: string | null;
  googleSearchConsole?: string | null;
  googleAnalytics?: string | null;
};

type InspectResult = {
  url: string;
  status: number | null;
  title: string | null;
  description: string | null;
  errors: string[];
};

function lenTone(n: number, soft: number, hard: number): "ok" | "warn" | "bad" {
  if (n > hard) return "bad";
  if (n > soft) return "warn";
  return "ok";
}

export function SeoPanel({
  initialPages,
  initialCounters,
  initialRobots = "",
}: {
  initialPages: SeoPageRow[];
  initialCounters: Counters;
  initialRobots?: string;
}) {
  const router = useRouter();
  const [path, setPath] = useState("/");
  const [host, setHost] = useState("vaybik.ru");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [jsonLd, setJsonLd] = useState(
    '{\n  "@context": "https://schema.org",\n  "@type": "Organization",\n  "name": "Вайбик"\n}',
  );
  const [inSitemap, setInSitemap] = useState(true);
  const [counters, setCounters] = useState<Counters>(initialCounters);
  const [robotsText, setRobotsText] = useState(initialRobots);
  const [inspectUrl, setInspectUrl] = useState("https://vaybik.ru/");
  const [inspect, setInspect] = useState<InspectResult | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const titleLen = title.length;
  const descLen = description.length;
  const previewTitle = title || "Заголовок страницы";
  const previewDesc =
    description || "Описание страницы появится здесь после заполнения.";
  const previewUrl = `${host}${path}`;

  const titleTone = useMemo(
    () => lenTone(titleLen, 60, 70),
    [titleLen],
  );
  const descTone = useMemo(
    () => lenTone(descLen, 160, 180),
    [descLen],
  );

  async function createPage() {
    setErr(null);
    let parsedJson: unknown = null;
    if (jsonLd.trim()) {
      try {
        parsedJson = JSON.parse(jsonLd);
      } catch {
        setErr("JSON-LD: невалидный JSON");
        return;
      }
    }
    const res = await api("/api/seo/pages", {
      method: "POST",
      body: JSON.stringify({
        host,
        path,
        title: title || null,
        description: description || null,
        ogTitle: ogTitle || title || null,
        ogDescription: ogDescription || description || null,
        ogImage: ogImage || null,
        jsonLd: parsedJson,
        inSitemap,
        robots: "index,follow",
      }),
    });
    if (res.error) setErr(res.error.message);
    else {
      setMsg("Страница сохранена");
      router.refresh();
    }
  }

  async function saveCounters() {
    setErr(null);
    const res = await api("/api/seo/counters", {
      method: "PUT",
      body: JSON.stringify(counters),
    });
    if (res.error) setErr(res.error.message);
    else setMsg("Счётчики сохранены");
  }

  async function saveRobots() {
    setErr(null);
    const res = await api("/api/seo/robots", {
      method: "PUT",
      body: JSON.stringify({ text: robotsText }),
    });
    if (res.error) setErr(res.error.message);
    else setMsg("robots.txt сохранён");
  }

  async function runInspect() {
    setErr(null);
    setInspect(null);
    const res = await api<{ result: InspectResult }>("/api/seo/inspect", {
      method: "POST",
      body: JSON.stringify({ url: inspectUrl }),
    });
    if (res.error) setErr(res.error.message);
    else setInspect(res.data?.result || null);
  }

  async function removePage(id: string) {
    const res = await api(`/api/seo/pages/${id}`, {
      method: "DELETE",
      body: "{}",
    });
    if (res.error) setErr(res.error.message);
    else {
      setMsg("Удалено");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="mt-[10px] text-[16.5px] font-extrabold text-tx">SEO</h2>

      <div className="grid-g-2-1 gap-3.5">
        <Card>
          <CardHeader
            title="Страница"
            subtitle="ввод слева — превью справа"
          />
          <div className="grid-g2">
            <Field label="Host" htmlFor="host">
              <Input
                id="host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
            </Field>
            <Field label="Path" htmlFor="path">
              <Input
                id="path"
                value={path}
                onChange={(e) => setPath(e.target.value)}
              />
            </Field>
          </div>
          <Field label={`Title (${titleLen}/60)`} htmlFor="title">
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={
                titleTone === "bad"
                  ? "border-rd"
                  : titleTone === "warn"
                    ? "border-yl"
                    : undefined
              }
            />
          </Field>
          <Field label={`Description (${descLen}/160)`} htmlFor="desc">
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={
                descTone === "bad"
                  ? "border-rd"
                  : descTone === "warn"
                    ? "border-yl"
                    : undefined
              }
            />
          </Field>
          <Field label="OG title" htmlFor="ogt">
            <Input
              id="ogt"
              value={ogTitle}
              onChange={(e) => setOgTitle(e.target.value)}
            />
          </Field>
          <Field label="OG description" htmlFor="ogd">
            <Textarea
              id="ogd"
              value={ogDescription}
              onChange={(e) => setOgDescription(e.target.value)}
            />
          </Field>
          <Field label="OG image URL" htmlFor="ogi">
            <Input
              id="ogi"
              value={ogImage}
              onChange={(e) => setOgImage(e.target.value)}
            />
          </Field>
          <Field label="JSON-LD" htmlFor="jd">
            <Textarea
              id="jd"
              value={jsonLd}
              onChange={(e) => setJsonLd(e.target.value)}
              className="font-mono text-[12px]"
            />
          </Field>
          <Field label="В sitemap" htmlFor="sm">
            <Select
              id="sm"
              value={inSitemap ? "1" : "0"}
              onChange={(e) => setInSitemap(e.target.value === "1")}
            >
              <option value="1">Да</option>
              <option value="0">Нет</option>
            </Select>
          </Field>
          <div className="mt-3">
            <Button onClick={() => void createPage()}>Сохранить страницу</Button>
          </div>
        </Card>

        <div className="space-y-3.5">
          <Card>
            <CardHeader title="Сниппет Google / Яндекс" />
            <div className="rounded-xl border border-bd bg-bg2 p-3">
              <div className="truncate text-[13px] text-gr">{previewUrl}</div>
              <div className="mt-1 text-[18px] font-extrabold leading-snug text-[#8ab4f8]">
                {previewTitle}
              </div>
              <div className="mt-1 text-[13px] leading-snug text-mu">
                {previewDesc}
              </div>
            </div>
            <div className="mt-2 flex gap-2 text-[12px]">
              <Pill
                tone={
                  titleTone === "ok"
                    ? "green"
                    : titleTone === "warn"
                      ? "yellow"
                      : "red"
                }
              >
                title {titleLen}
              </Pill>
              <Pill
                tone={
                  descTone === "ok"
                    ? "green"
                    : descTone === "warn"
                      ? "yellow"
                      : "red"
                }
              >
                desc {descLen}
              </Pill>
            </div>
          </Card>

          <Card>
            <CardHeader title="OG-карточка" subtitle="как CalcCard — результат крупно" />
            <div className="overflow-hidden rounded-xl border border-bd bg-bg2">
              {ogImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ogImage}
                  alt=""
                  className="h-28 w-full object-cover"
                />
              ) : (
                <div className="flex h-28 items-center justify-center bg-card2 text-[12px] text-mu">
                  нет og:image
                </div>
              )}
              <div className="p-3">
                <div className="text-[11px] uppercase tracking-wide text-mu">
                  {host}
                </div>
                <div className="mt-1 text-[20px] font-extrabold text-ac">
                  {ogTitle || previewTitle}
                </div>
                <div className="mt-1 text-[12.5px] text-mu">
                  {ogDescription || previewDesc}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Счётчики и верификация"
          subtitle="Яндекс / Google"
        />
        <div className="grid-g2">
          <Field label="Яндекс.Вебмастер (meta)" htmlFor="yw">
            <Input
              id="yw"
              value={counters.yandexWebmaster || ""}
              onChange={(e) =>
                setCounters((c) => ({ ...c, yandexWebmaster: e.target.value }))
              }
            />
          </Field>
          <Field label="Яндекс.Метрика (ID)" htmlFor="ym">
            <Input
              id="ym"
              value={counters.yandexMetrika || ""}
              onChange={(e) =>
                setCounters((c) => ({ ...c, yandexMetrika: e.target.value }))
              }
            />
          </Field>
          <Field label="Google Search Console" htmlFor="gsc">
            <Input
              id="gsc"
              value={counters.googleSearchConsole || ""}
              onChange={(e) =>
                setCounters((c) => ({
                  ...c,
                  googleSearchConsole: e.target.value,
                }))
              }
            />
          </Field>
          <Field label="Google Analytics (опц.)" htmlFor="ga">
            <Input
              id="ga"
              value={counters.googleAnalytics || ""}
              onChange={(e) =>
                setCounters((c) => ({ ...c, googleAnalytics: e.target.value }))
              }
            />
          </Field>
        </div>
        <div className="mt-3">
          <Button variant="ghost" onClick={() => void saveCounters()}>
            Сохранить счётчики
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="robots.txt"
          subtitle="публичный сайт; на site-test всегда Disallow: /"
        />
        <Field label="Текст robots.txt" htmlFor="robots">
          <Textarea
            id="robots"
            rows={12}
            value={robotsText}
            onChange={(e) => setRobotsText(e.target.value)}
            className="font-mono text-[12px]"
          />
        </Field>
        <div className="mt-3">
          <Button onClick={() => void saveRobots()}>Сохранить robots.txt</Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Проверить страницу" subtitle="SSRF-защита" />
        <div className="flex flex-wrap gap-2">
          <Input
            value={inspectUrl}
            onChange={(e) => setInspectUrl(e.target.value)}
            className="min-w-[280px] flex-1"
          />
          <Button onClick={() => void runInspect()}>Проверить</Button>
        </div>
        {inspect ? (
          <div className="mt-3 space-y-1 text-[13px]">
            <div>
              HTTP {inspect.status ?? "—"} · {inspect.url}
            </div>
            <div className="text-mu">title: {inspect.title || "—"}</div>
            <div className="text-mu">
              description: {inspect.description || "—"}
            </div>
            {inspect.errors.length ? (
              <ul className="mt-2 list-disc pl-5 text-rd">
                {inspect.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gr">Критических ошибок не найдено</p>
            )}
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="Страницы"
          action={
            <a
              className="text-[12.5px] text-ac underline"
              href="/admin/api/public/sitemap.xml"
              target="_blank"
              rel="noreferrer"
            >
              sitemap.xml
            </a>
          }
        />
        <DataTable
          rows={initialPages}
          rowKey={(r) => r.id}
          columns={[
            {
              key: "p",
              header: "URL",
              render: (r) => (
                <span className="tabular-nums">
                  {r.host}
                  {r.path}
                </span>
              ),
            },
            { key: "t", header: "Title", render: (r) => r.title || "—" },
            {
              key: "s",
              header: "Sitemap",
              render: (r) => (
                <Pill tone={r.inSitemap ? "green" : "yellow"}>
                  {r.inSitemap ? "да" : "нет"}
                </Pill>
              ),
            },
            {
              key: "a",
              header: "",
              render: (r) => (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void removePage(r.id)}
                >
                  Удалить
                </Button>
              ),
            },
          ]}
        />
      </Card>

      {msg ? <p className="text-[13px] text-gr">{msg}</p> : null}
      {err ? <p className="text-[13px] text-rd">{err}</p> : null}
    </div>
  );
}
