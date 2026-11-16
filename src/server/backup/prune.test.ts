import { mkdtemp, writeFile, utimes, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pruneOldBackups } from "./run";

describe("backup prune", () => {
  it("удаляет .enc старше keepDays", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "vaybik-bak-"));
    const oldFile = path.join(dir, "db-old.sql.gz.enc");
    const newFile = path.join(dir, "db-new.sql.gz.enc");
    await writeFile(oldFile, "x");
    await writeFile(newFile, "y");
    const oldTime = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    await utimes(oldFile, oldTime, oldTime);

    const removed = await pruneOldBackups(dir, 14);
    expect(removed).toBe(1);
    const left = await readdir(dir);
    expect(left).toEqual(["db-new.sql.gz.enc"]);
  });
});
