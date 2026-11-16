"use client";

import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useEffect, useRef, useState } from "react";

type Props = {
  serviceId: string;
  containerName: string;
};

export function LogViewer({ serviceId, containerName }: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [live, setLive] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const boxRef = useRef<HTMLPreElement>(null);
  const esRef = useRef<EventSource | null>(null);

  async function loadTail() {
    setErr(null);
    const q = new URLSearchParams({
      tail: "300",
      ...(filter ? { q: filter } : {}),
    });
    const res = await fetch(
      `/admin/api/services/${serviceId}/docker/${encodeURIComponent(containerName)}/logs?${q}`,
      { credentials: "same-origin" },
    );
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error?.message || "Ошибка логов");
      return;
    }
    setLines(String(json.logs || "").split(/\r?\n/).filter(Boolean));
  }

  function stopLive() {
    esRef.current?.close();
    esRef.current = null;
    setLive(false);
  }

  function startLive() {
    stopLive();
    setLive(true);
    setErr(null);
    const q = new URLSearchParams({
      follow: "1",
      tail: "100",
      ...(filter ? { q: filter } : {}),
    });
    const es = new EventSource(
      `/admin/api/services/${serviceId}/docker/${encodeURIComponent(containerName)}/logs?${q}`,
    );
    esRef.current = es;
    es.onmessage = (ev) => {
      try {
        const line = JSON.parse(ev.data) as string;
        setLines((prev) => {
          const next = [...prev, line];
          return next.length > 2000 ? next.slice(-2000) : next;
        });
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      setErr("Поток логов оборвался");
      stopLive();
    };
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial logs fetch
    void loadTail();
    return () => stopLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, containerName]);

  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [lines]);

  function download() {
    const q = new URLSearchParams({
      download: "1",
      tail: "2000",
      ...(filter ? { q: filter } : {}),
    });
    window.open(
      `/admin/api/services/${serviceId}/docker/${encodeURIComponent(containerName)}/logs?${q}`,
      "_blank",
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Фильтр" htmlFor="log-q" className="min-w-[200px] flex-1">
          <Input
            id="log-q"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="текст строки"
          />
        </Field>
        <Button variant="ghost" size="sm" onClick={() => void loadTail()}>
          Обновить
        </Button>
        {live ? (
          <Button variant="ghost" size="sm" onClick={stopLive}>
            Стоп поток
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={startLive}>
            Живой поток
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={download}>
          Скачать
        </Button>
      </div>
      {err ? <p className="text-[13px] text-rd">{err}</p> : null}
      <pre
        ref={boxRef}
        className="max-h-80 overflow-auto rounded-md border border-bd bg-bg2 p-3 text-[11.5px] leading-relaxed text-tx"
      >
        {lines.length ? lines.join("\n") : "Нет строк"}
      </pre>
    </div>
  );
}
