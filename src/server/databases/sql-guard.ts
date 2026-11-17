/**
 * Разрешаем только read-only SELECT / WITH…SELECT.
 * Мутации, DDL, несколько операторов, SELECT INTO, FOR UPDATE — отказ.
 */

const FORBIDDEN =
  /\b(INSERT|UPDATE|DELETE|MERGE|UPSERT|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|COPY|CALL|EXECUTE|DO|COMMENT|VACUUM|REINDEX|CLUSTER|REFRESH|SECURITY|LISTEN|NOTIFY|LOAD|LOCK|SET\s+ROLE|SET\s+SESSION\s+AUTHORIZATION|SELECT\s+INTO)\b/i;

const FOR_UPDATE = /\bFOR\s+(UPDATE|NO\s+KEY\s+UPDATE|SHARE|KEY\s+SHARE)\b/i;

export function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

export function assertReadOnlySelect(sql: string): string {
  const cleaned = stripSqlComments(sql).trim();
  if (!cleaned) {
    throw Object.assign(new Error("Пустой запрос"), {
      status: 400,
      code: "BAD_SQL",
    });
  }
  if (/;\s*\S/.test(cleaned)) {
    throw Object.assign(new Error("Разрешён только один оператор"), {
      status: 400,
      code: "BAD_SQL",
    });
  }
  const normalized = cleaned.replace(/;+\s*$/, "").trim();
  if (!/^(WITH|SELECT)\b/i.test(normalized)) {
    throw Object.assign(new Error("Разрешены только SELECT / WITH … SELECT"), {
      status: 400,
      code: "BAD_SQL",
    });
  }
  if (FORBIDDEN.test(normalized) || FOR_UPDATE.test(normalized)) {
    throw Object.assign(
      new Error("Запрос отклонён: запрещены изменения данных и DDL"),
      { status: 400, code: "BAD_SQL" },
    );
  }
  // SELECT … INTO (без «SELECT INTO» как одной лексемы в FORBIDDEN уже есть;
  // ловим «INTO temp_table» после SELECT-списка)
  if (/\bINTO\b/i.test(normalized) && !/\bINTO\s+(STDOUT|STDIN)\b/i.test(normalized)) {
    throw Object.assign(new Error("SELECT INTO запрещён"), {
      status: 400,
      code: "BAD_SQL",
    });
  }
  return normalized;
}
