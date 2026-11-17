export type MediaAssetDto = {
  id: string;
  kind: string;
  folderId: string | null;
  tags: string[];
  originalName: string;
  title: string | null;
  alt: string | null;
  caption: string | null;
  mime: string;
  ext: string;
  size: number;
  width: number | null;
  height: number | null;
  sha256: string;
  version: number;
  variants: {
    name: string;
    w?: number | null;
    h?: number | null;
    file: string;
    size: number;
    mime: string;
  }[];
  urls: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  alreadyExists?: boolean;
};

export type MediaFolderDto = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
};

export type MediaQuota = {
  usedBytes: number;
  softLimitBytes: number;
  overSoftLimit: boolean;
};

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
}

export function mediaPreviewUrl(asset: MediaAssetDto): string | null {
  return (
    asset.urls.preview ||
    asset.urls.w480 ||
    asset.urls.orig ||
    Object.values(asset.urls)[0] ||
    null
  );
}
