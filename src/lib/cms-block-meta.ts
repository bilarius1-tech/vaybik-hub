export const BLOCK_TYPES = [
  "hero",
  "answer",
  "cards",
  "serviceCards",
  "steps",
  "faq",
  "team",
  "cases",
  "cta",
  "text",
  "widget",
  "iconList",
  "offer",
  "beforeAfter",
  "rawHtml",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_META: Record<
  BlockType,
  { label: string; description: string }
> = {
  hero: {
    label: "Hero",
    description: "Шапка страницы: заголовок, кнопки, маскот",
  },
  answer: {
    label: "Короткий ответ",
    description: "AEO-блок под hero + факты",
  },
  cards: {
    label: "Карточки",
    description: "Сетка карточек 2–4 колонки",
  },
  serviceCards: {
    label: "Сервисы (карточки)",
    description: "Карточки продукта: картинка 4:3, текст, кнопка",
  },
  steps: {
    label: "Шаги",
    description: "Нумерованный список шагов",
  },
  faq: {
    label: "FAQ",
    description: "Вопросы и ответы (details/summary)",
  },
  team: {
    label: "Команда",
    description: "Люди студии",
  },
  cases: {
    label: "Кейсы",
    description: "Карточки портфолио",
  },
  cta: {
    label: "CTA",
    description: "Призыв к действию / контакты",
  },
  text: {
    label: "Текст",
    description: "Заголовок + markdown",
  },
  widget: {
    label: "Виджет",
    description: "Студия / калькулятор (снимок HTML)",
  },
  iconList: {
    label: "Список с иконками",
    description: "plist-cards или safe (ibox + текст)",
  },
  offer: {
    label: "Оффер / цена",
    description: "Сетка answer-карточек с ценой",
  },
  beforeAfter: {
    label: "Было → стало",
    description: "ba-list сравнения",
  },
  rawHtml: {
    label: "HTML",
    description: "Сырой HTML (запасной вариант импорта)",
  },
};
