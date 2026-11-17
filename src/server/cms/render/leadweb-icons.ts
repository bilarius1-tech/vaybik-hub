/** Декоративные SVG из leadweb (карточки услуг, FAQ, стрелка «Подробнее»). */

export const PRICE_ICON =
  '<svg class="ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" /></svg>';

export const CHECK_ICON =
  '<svg class="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>';

export const FAQ_ICON =
  '<svg class="ic q-ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /> <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /> <path d="M12 17h.01" /></svg>';

export const MORE_ARROW =
  '<svg class="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>';

/** Подпись/размеры маскотов leadweb (picture + srcset). */
export const MASCOT_META: Record<
  string,
  { width: number; height: number; alt: string }
> = {
  privet: {
    width: 400,
    height: 539,
    alt: "Вайбик — рыжий кот в робото-доспехах, маскот vaybik.ru, машет лапой. Это вымышленный персонаж. Это не сотрудник.",
  },
  dumaet: {
    width: 400,
    height: 621,
    alt: "Вайбик — рыжий кот в робото-доспехах, маскот vaybik.ru, задумался над расчётом. Это вымышленный персонаж. Это не сотрудник.",
  },
};

export function renderMascotPicture(
  mascot: string,
  opts?: { fetchPriority?: "high" | "auto" },
): string {
  const key = mascot || "privet";
  const meta = MASCOT_META[key] || {
    width: 400,
    height: 539,
    alt: "Вайбик — маскот vaybik.ru. Вымышленный персонаж, не сотрудник.",
  };
  const fp =
    opts?.fetchPriority === "high" ? ' fetchpriority="high"' : "";
  return `<figure class="mascot"><picture><source type="image/webp" srcset="/img/vaybik-${key}-240.webp 240w, /img/vaybik-${key}-400.webp 400w, /img/vaybik-${key}-640.webp 640w" sizes="(max-width: 899px) 60vw, 364px"><img src="/img/vaybik-${key}.png" width="${meta.width}" height="${meta.height}" alt="${meta.alt.replace(/"/g, "&quot;")}" decoding="async"${fp}></picture></figure>`;
}

/**
 * Если у &lt;svg&gt; нет viewBox, а есть width/height — подставить lucide 24×24.
 * Чинит снимки, сохранённые до фикса санитайзера.
 */
export function fixMissingSvgViewBox(html: string): string {
  if (!html || !/<svg\b/i.test(html)) return html;
  return html.replace(/<svg\b([^>]*)>/gi, (full, attrs: string) => {
    if (/\bviewBox\s*=/i.test(attrs) || /\bviewbox\s*=/i.test(attrs)) {
      return full;
    }
    if (!/\bwidth\s*=/i.test(attrs) && !/\bheight\s*=/i.test(attrs)) {
      return full;
    }
    const trimmed = attrs.replace(/\s*$/, "");
    return `<svg${trimmed} viewBox="0 0 24 24">`;
  });
}
