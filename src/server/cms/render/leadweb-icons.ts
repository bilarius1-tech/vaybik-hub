/** Декоративные SVG из leadweb (карточки услуг, FAQ, стрелка «Подробнее»). */

export const PRICE_ICON =
  '<svg class="ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" /></svg>';

export const CHECK_ICON =
  '<svg class="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>';

export const FAQ_ICON =
  '<svg class="ic q-ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /> <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /> <path d="M12 17h.01" /></svg>';

export const MORE_ARROW =
  '<svg class="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>';

export const FAQ_CHEV =
  '<svg class="ic chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>';

/** Внешняя ссылка «Открыть …» в кейсах leadweb */
export const EXT_MORE_ICON =
  '<svg class="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h10v10" /><path d="M7 17 17 7" /></svg>';

/** Иконка телефона для bt-call (hero/CTA o-nas) */
export const PHONE_ICON =
  '<svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" /></svg>';

/** Фильтр кейсов keysy-ii (input radio + chips) — если sanitize срезал input */
export const KEYSY_FILTERS_HTML = `<div class="k-filters">
<input type="radio" name="kfilter" id="kf-all" value="all" checked>
<input type="radio" name="kfilter" id="kf-1c" value="1c">
<input type="radio" name="kfilter" id="kf-b24" value="b24">
<input type="radio" name="kfilter" id="kf-both" value="both">
<div class="k-chips" role="group" aria-label="Фильтр по системам">
<label for="kf-all">Все</label>
<label for="kf-1c">1С</label>
<label for="kf-b24">Битрикс24</label>
<label for="kf-both">1С + Битрикс24</label>
</div>`;

/** Подпись/размеры/srcset маскотов leadweb. */
export const MASCOT_META: Record<
  string,
  { width: number; height: number; alt: string; srcset: string }
> = {
  privet: {
    width: 400,
    height: 539,
    alt: "Вайбик — рыжий кот в робото-доспехах, маскот vaybik.ru, машет лапой. Это вымышленный персонаж. Это не сотрудник.",
    srcset:
      "/img/vaybik-privet-240.webp 240w, /img/vaybik-privet-400.webp 400w, /img/vaybik-privet-640.webp 640w",
  },
  dumaet: {
    width: 400,
    height: 621,
    alt: "Вайбик — рыжий кот в робото-доспехах, маскот vaybik.ru, задумался над задачей. Это вымышленный персонаж. Это не сотрудник.",
    srcset:
      "/img/vaybik-dumaet-240.webp 240w, /img/vaybik-dumaet-400.webp 400w, /img/vaybik-dumaet-640.webp 640w",
  },
  "1c": {
    width: 400,
    height: 515,
    alt: "Вайбик — рыжий кот в робото-доспехах, маскот vaybik.ru, держит табличку с логотипом 1С. Это вымышленный персонаж. Это не сотрудник.",
    srcset:
      "/img/vaybik-1c-240.webp 240w, /img/vaybik-1c-400.webp 400w, /img/vaybik-1c-480.webp 480w, /img/vaybik-1c-640.webp 640w, /img/vaybik-1c-772.webp 772w",
  },
  all: {
    width: 720,
    height: 731,
    alt: "Вайбик — рыжий кот в робото-доспехах, маскот vaybik.ru, держит таблички с логотипами 1С, ВКонтакте, MAX и Битрикс24. Это вымышленный персонаж. Это не сотрудник.",
    srcset:
      "/img/vaybik-all-240.webp 240w, /img/vaybik-all-400.webp 400w, /img/vaybik-all-480.webp 480w, /img/vaybik-all-720.webp 720w, /img/vaybik-all-970.webp 970w",
  },
  rabotaet: {
    width: 400,
    height: 356,
    alt: "Вайбик — рыжий кот в робото-доспехах, маскот vaybik.ru, за работой над сайтом. Это вымышленный персонаж. Это не сотрудник.",
    srcset:
      "/img/vaybik-rabotaet-240.webp 240w, /img/vaybik-rabotaet-400.webp 400w, /img/vaybik-rabotaet-640.webp 640w",
  },
  gotovo: {
    width: 400,
    height: 374,
    alt: "Вайбик — рыжий кот в робото-доспехах, маскот vaybik.ru, показывает, что работа готова. Это вымышленный персонаж. Это не сотрудник.",
    srcset:
      "/img/vaybik-gotovo-240.webp 240w, /img/vaybik-gotovo-400.webp 400w, /img/vaybik-gotovo-640.webp 640w",
  },
  original: {
    width: 400,
    height: 464,
    alt: "Вайбик — рыжий кот в робото-доспехах, маскот vaybik.ru, маскот студии. Это вымышленный персонаж. Это не сотрудник.",
    srcset:
      "/img/vaybik-original-240.webp 240w, /img/vaybik-original-400.webp 400w, /img/vaybik-original-640.webp 640w",
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
    srcset: `/img/vaybik-${key}-240.webp 240w, /img/vaybik-${key}-400.webp 400w, /img/vaybik-${key}-640.webp 640w`,
  };
  const fp =
    opts?.fetchPriority === "high" ? ' fetchpriority="high"' : "";
  return `<figure class="mascot"><picture><source type="image/webp" srcset="${meta.srcset}" sizes="(max-width: 899px) 60vw, 364px"><img src="/img/vaybik-${key}.png" width="${meta.width}" height="${meta.height}" alt="${meta.alt.replace(/"/g, "&quot;")}" decoding="async"${fp}></picture></figure>`;
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
