"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { useMemo, useState } from "react";

/** Карточка-калькулятор в стиле #sec-calc km-dashboard */
export function CalcCard() {
  const [users, setUsers] = useState("10");
  const [plan, setPlan] = useState("pro");
  const [months, setMonths] = useState("12");

  const result = useMemo(() => {
    const u = Number(users) || 0;
    const m = Number(months) || 0;
    const pricePerUser = plan === "pro" ? 490 : plan === "biz" ? 890 : 190;
    return u * pricePerUser * m;
  }, [users, plan, months]);

  return (
    <Card>
      <CardHeader
        title="Оценка стоимости"
        subtitle="демо-калькулятор в стиле km-dashboard"
      />
      <Field label="Пользователей" htmlFor="calc-users">
        <Input
          id="calc-users"
          type="number"
          min={1}
          value={users}
          onChange={(e) => setUsers(e.target.value)}
        />
      </Field>
      <Field label="Тариф" htmlFor="calc-plan">
        <Select
          id="calc-plan"
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
        >
          <option value="start">Старт</option>
          <option value="pro">Про</option>
          <option value="biz">Бизнес</option>
        </Select>
      </Field>
      <Field label="Месяцев" htmlFor="calc-months">
        <Input
          id="calc-months"
          type="number"
          min={1}
          value={months}
          onChange={(e) => setMonths(e.target.value)}
        />
      </Field>
      <div className="mt-4 text-[24px] font-extrabold text-ac">
        {result.toLocaleString("ru-RU")} ₽
      </div>
      <div className="mt-1 text-[12px] text-mu">
        Итого за период (демо-данные)
      </div>
    </Card>
  );
}
