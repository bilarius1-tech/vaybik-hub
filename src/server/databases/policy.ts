import type { DbConnection } from "@prisma/client";
import { parseDatabaseUrl } from "@/server/backup/pg-url";

/**
 * Цели restore: на фазе 3 разрешён только временный тестовый контейнер.
 * Прод-БД админки и чужие проекты — никогда.
 */
export type RestoreTargetKind = "test";

const BLOCKED_HOST_FRAGMENTS = [
  "region",
  "amnezia",
  "xray",
  "traefik",
  "wireguard",
];

export function assertRestoreTargetAllowed(params: {
  target: string;
  connection: DbConnection;
  confirmName: string;
}): asserts params is {
  target: RestoreTargetKind;
  connection: DbConnection;
  confirmName: string;
} {
  if (params.target !== "test") {
    throw Object.assign(
      new Error("Восстановление только в тестовый контейнер (target=test)"),
      { status: 400, code: "RESTORE_TARGET_FORBIDDEN" },
    );
  }
  const okName =
    params.confirmName === params.connection.name ||
    params.confirmName === params.connection.database ||
    params.confirmName === params.connection.slug;
  if (!okName) {
    throw Object.assign(
      new Error("Подтверждение: введите точное имя подключения или БД"),
      { status: 400, code: "CONFIRM_MISMATCH" },
    );
  }
}

/** Нельзя целиться restore в прод-БД админки (хост+имя из DATABASE_URL) */
export function isProdAdminDatabase(conn: DbConnection): boolean {
  if (!conn.isSystem) return false;
  const url = process.env.DATABASE_URL;
  if (!url) return conn.isSystem;
  try {
    const p = parseDatabaseUrl(url);
    return (
      conn.database === p.database &&
      (conn.host === p.host || conn.host === "postgres")
    );
  } catch {
    return conn.isSystem;
  }
}

export function assertConnectionNotBlocked(conn: Pick<DbConnection, "host" | "name" | "slug" | "database">): void {
  const hay = `${conn.host} ${conn.name} ${conn.slug} ${conn.database}`.toLowerCase();
  for (const frag of BLOCKED_HOST_FRAGMENTS) {
    if (hay.includes(frag)) {
      throw Object.assign(
        new Error(`Подключение к «${frag}» запрещено политикой`),
        { status: 403, code: "FORBIDDEN" },
      );
    }
  }
}

/** UI/API не должны предлагать «восстановить в прод» */
export function restoreTargetOptions(): Array<{ value: RestoreTargetKind; label: string }> {
  return [{ value: "test", label: "Временный тестовый контейнер" }];
}
