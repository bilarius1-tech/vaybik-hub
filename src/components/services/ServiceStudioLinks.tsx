"use client";

import { Button } from "@/components/ui/Button";
import type { StudioServiceLink } from "@/lib/studio-service-links";
import Link from "next/link";

type Props = {
  links: StudioServiceLink[];
  /** Первая кнопка — primary, остальные ghost */
  emphasizeFirst?: boolean;
  className?: string;
};

/**
 * Заметные кнопки-ссылки студии (чат через SSO, Атлас — внешние URL).
 * Рендерить только на экранах с services.manage (CLIENT их не видит).
 */
export function ServiceStudioLinks({
  links,
  emphasizeFirst = true,
  className,
}: Props) {
  if (links.length === 0) return null;

  return (
    <div
      className={
        className ??
        "mt-2 flex flex-wrap items-center gap-2"
      }
      data-no-row-click
      onClick={(e) => e.stopPropagation()}
    >
      {links.map((l, i) => {
        const variant =
          emphasizeFirst && i === 0 ? "primary" : "ghost";
        const btn = (
          <Button type="button" variant={variant} size="sm">
            {l.label}
          </Button>
        );
        if (l.external) {
          return (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {btn}
            </a>
          );
        }
        return (
          <Link key={l.href} href={l.href}>
            {btn}
          </Link>
        );
      })}
    </div>
  );
}
