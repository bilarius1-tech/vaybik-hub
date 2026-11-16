export type NavItem = {
  href: string;
  label: string;
  icon: string;
};

/** Пункты меню сайдбара (TZ §6) */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Дашборд", icon: "◈" },
  { href: "/services", label: "Сервисы", icon: "⌂" },
  { href: "/settings", label: "Настройки Вайбика", icon: "✦" },
  { href: "/seo", label: "SEO", icon: "◎" },
  { href: "/vault", label: "Доступы", icon: "⚿" },
  { href: "/partners", label: "Партнёры", icon: "⇄" },
  { href: "/databases", label: "Базы данных", icon: "▤" },
  { href: "/users", label: "Пользователи", icon: "☺" },
  { href: "/activity", label: "Журнал", icon: "≡" },
];

export const SIDEFOOT_ROWS = [
  { label: "Сервисов онлайн", value: "—" },
  { label: "CPU / RAM", value: "—" },
  { label: "Бэкап", value: "—" },
] as const;
