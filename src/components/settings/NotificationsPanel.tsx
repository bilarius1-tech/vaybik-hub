"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Input, Select } from "@/components/ui/Field";
import { api } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Rule = {
  id: string;
  event: string;
  chatIds: string[];
  isActive: boolean;
  throttleMin: number;
};

export function NotificationsPanel({ initialRules }: { initialRules: Rule[] }) {
  const router = useRouter();
  const [event, setEvent] = useState("service.down");
  const [chatId, setChatId] = useState("");
  const [throttleMin, setThrottleMin] = useState(10);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function createRule() {
    setErr(null);
    const res = await api("/api/notifications/rules", {
      method: "POST",
      body: JSON.stringify({
        event,
        chatIds: [chatId],
        throttleMin,
        isActive: true,
      }),
    });
    if (res.error) setErr(res.error.message);
    else {
      setMsg("Правило создано");
      router.refresh();
    }
  }

  async function sendTest() {
    setErr(null);
    const res = await api("/api/notifications/test", {
      method: "POST",
      body: JSON.stringify({ chatId: chatId || undefined }),
    });
    if (res.error) setErr(res.error.message);
    else setMsg("Тест отправлен");
  }

  return (
    <div className="space-y-6">
      <h2 className="mt-[10px] text-[16.5px] font-extrabold text-tx">
        Уведомления Telegram
      </h2>
      <Card>
        <CardHeader
          title="Бот"
          subtitle="токен из vault (kind=telegram_bot) или TELEGRAM_BOT_TOKEN"
        />
        <div className="grid-g2">
          <Field label="Chat ID" htmlFor="chat">
            <Input
              id="chat"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="из env или вручную"
            />
          </Field>
          <div className="flex items-end">
            <Button variant="ghost" onClick={() => void sendTest()}>
              Отправить тест
            </Button>
          </div>
        </div>
        {msg ? <p className="mt-2 text-[13px] text-gr">{msg}</p> : null}
        {err ? <p className="mt-2 text-[13px] text-rd">{err}</p> : null}
      </Card>

      <Card>
        <CardHeader title="Новое правило" subtitle="анти-спам: throttleMin" />
        <div className="grid-g3 items-end">
          <Field label="Событие" htmlFor="ev">
            <Select
              id="ev"
              value={event}
              onChange={(e) => setEvent(e.target.value)}
            >
              <option value="service.down">service.down</option>
              <option value="service.up">service.up</option>
              <option value="cert.expiring">cert.expiring</option>
            </Select>
          </Field>
          <Field label="Throttle, мин" htmlFor="th">
            <Input
              id="th"
              type="number"
              value={throttleMin}
              onChange={(e) => setThrottleMin(Number(e.target.value))}
            />
          </Field>
          <Button onClick={() => void createRule()}>Добавить</Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Правила" />
        <DataTable
          rows={initialRules}
          rowKey={(r) => r.id}
          columns={[
            { key: "e", header: "Событие", render: (r) => r.event },
            {
              key: "c",
              header: "Чаты",
              render: (r) => r.chatIds.join(", "),
            },
            {
              key: "t",
              header: "Throttle",
              render: (r) => `${r.throttleMin} мин`,
            },
            {
              key: "a",
              header: "Активно",
              render: (r) => (r.isActive ? "да" : "нет"),
            },
          ]}
        />
      </Card>
    </div>
  );
}
