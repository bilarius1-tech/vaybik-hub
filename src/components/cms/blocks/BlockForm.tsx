"use client";

import { AnswerForm } from "./AnswerForm";
import { BeforeAfterForm } from "./BeforeAfterForm";
import { CardsForm } from "./CardsForm";
import { CasesForm } from "./CasesForm";
import { CtaForm } from "./CtaForm";
import { FaqForm } from "./FaqForm";
import { HeroForm } from "./HeroForm";
import { IconListForm } from "./IconListForm";
import { OfferForm } from "./OfferForm";
import { RawHtmlForm } from "./RawHtmlForm";
import { StepsForm } from "./StepsForm";
import { TeamForm } from "./TeamForm";
import { TextForm } from "./TextForm";
import { WidgetForm } from "./WidgetForm";

export function BlockForm({
  type,
  data,
  onChange,
}: {
  type: string;
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  const set = (next: object) => onChange(next as Record<string, unknown>);
  switch (type) {
    case "hero":
      return <HeroForm data={data} onChange={set} />;
    case "answer":
      return <AnswerForm data={data} onChange={set} />;
    case "cards":
      return <CardsForm data={data} onChange={set} />;
    case "steps":
      return <StepsForm data={data} onChange={set} />;
    case "faq":
      return <FaqForm data={data} onChange={set} />;
    case "team":
      return <TeamForm data={data} onChange={set} />;
    case "cases":
      return <CasesForm data={data} onChange={set} />;
    case "cta":
      return <CtaForm data={data} onChange={set} />;
    case "text":
      return <TextForm data={data} onChange={set} />;
    case "widget":
      return <WidgetForm data={data} onChange={set} />;
    case "iconList":
      return <IconListForm data={data} onChange={set} />;
    case "offer":
      return <OfferForm data={data} onChange={set} />;
    case "beforeAfter":
      return <BeforeAfterForm data={data} onChange={set} />;
    case "rawHtml":
      return <RawHtmlForm data={data} onChange={set} />;
    default:
      return (
        <p className="text-sm text-mu">Нет формы для типа «{type}»</p>
      );
  }
}
