export type StudioServiceLink = {
  label: string;
  /** Путь хаба (с basePath) или абсолютный URL */
  href: string;
  /** Открывать во внешней вкладке (сайт Атласа и т.п.) */
  external?: boolean;
  /** Серый пункт без перехода (SSO не настроено) */
  disabled?: boolean;
  /** Подсказка при disabled */
  title?: string;
};

export type StudioCabinetLink = StudioServiceLink & {
  id: "chat" | "leads" | "atlas";
};

/** Клиент чата «наш виджет / база знаний» студии (не клиента хаба). */
export const CHAT_STUDIO_WIDGET_CLIENT_ID = "cmwl06pki0001qm5kuqwp8uss";

/** Как chatStudioSsoHref — без импорта studio-sso (Prisma), чтобы можно было в client. */
function chatSsoHref(chatNextPath: string): string {
  return `/sso/chat?next=${encodeURIComponent(chatNextPath)}`;
}

const CHAT_STUDIO_LINKS: StudioServiceLink[] = [
  { label: "Клиенты чата", href: chatSsoHref("/manage") },
  {
    label: "Наш виджет (база знаний)",
    href: chatSsoHref(`/manage/clients/${CHAT_STUDIO_WIDGET_CLIENT_ID}`),
  },
  { label: "Справка чата", href: chatSsoHref("/manage/help") },
  {
    label: "Лендинг чата (SEO)",
    href: chatSsoHref("/manage/landing"),
  },
];

const DESIGN_ATLAS_LINKS: StudioServiceLink[] = [
  {
    label: "Открыть сайт",
    href: "https://design.vaybik.ru",
    external: true,
  },
  {
    label: "Пример сайта для клиента",
    href: "https://design.vaybik.ru/primer",
    external: true,
  },
];

function leadsSsoHref(leadsNextPath: string): string {
  return `/sso/leads?next=${encodeURIComponent(leadsNextPath)}`;
}

/** Внутренний кабинет лидов (не продукт для CLIENT). */
const LEAD_STUDIO_LINKS: StudioServiceLink[] = [
  { label: "Кабинет лидов", href: leadsSsoHref("/manage") },
];

/**
 * Быстрые ссылки студии на карточке сервиса.
 * Только для OWNER/ADMIN UI (`services.manage`); CLIENT сюда не попадает.
 */
export function studioLinksForService(slug: string): StudioServiceLink[] {
  if (slug === "chat") return CHAT_STUDIO_LINKS;
  if (slug === "design-atlas") return DESIGN_ATLAS_LINKS;
  if (slug === "lead") return LEAD_STUDIO_LINKS;
  return [];
}

/**
 * Блок «Кабинеты» на дашборде и в сайдбаре.
 * chatSsoReady / leadsSsoReady — с сервера (есть env).
 */
export function studioCabinetLinks(opts: {
  chatSsoReady: boolean;
  leadsSsoReady: boolean;
}): StudioCabinetLink[] {
  return [
    {
      id: "chat",
      label: "Кабинет чата",
      href: chatSsoHref("/manage"),
      disabled: !opts.chatSsoReady,
      title: opts.chatSsoReady
        ? undefined
        : "SSO не настроено: CHAT_BASE_URL / HUB_CHAT_SSO_SECRET",
    },
    {
      id: "leads",
      label: "Кабинет лидов",
      href: leadsSsoHref("/manage"),
      disabled: !opts.leadsSsoReady,
      title: opts.leadsSsoReady
        ? undefined
        : "SSO не настроено: LEADS_BASE_URL / HUB_LEADS_SSO_SECRET",
    },
    {
      id: "atlas",
      label: "Дизайн Атлас",
      href: "https://design.vaybik.ru",
      external: true,
    },
  ];
}
