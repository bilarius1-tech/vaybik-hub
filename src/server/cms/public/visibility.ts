/**
 * Правило публичности страницы CMS.
 *
 * Публична, если есть publishedRevisionId, статус не ARCHIVED и не в корзине.
 * DRAFT с опубликованной ревизией остаётся на сайте (restore/конвертер ставят DRAFT).
 */
export type PageVisibilityInput = {
  publishedRevisionId: string | null;
  status: string;
  deletedAt?: Date | string | null;
};

export function isPublicPage(page: PageVisibilityInput): boolean {
  if (!page.publishedRevisionId) return false;
  if (page.status === "ARCHIVED") return false;
  if (page.deletedAt != null) return false;
  return true;
}

/** Prisma where для списка публичных страниц */
export function publicPageWhere() {
  return {
    publishedRevisionId: { not: null },
    status: { not: "ARCHIVED" as const },
    deletedAt: null,
  };
}
