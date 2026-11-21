import { readFile } from "node:fs/promises";
import { statfs } from "node:fs/promises";
import { existsSync } from "node:fs";

/** /host/proc в Docker; локально — /proc */
export function procRoot(): string {
  if (existsSync("/host/proc/stat")) return "/host/proc";
  return "/proc";
}

/**
 * Точка для df хостового диска (только :ro).
 * Приоритет: /host/disk (compose) → /app/backups (bind бэкапов) → /host/root (legacy) → /.
 * Не монтируем весь корень хоста `/` в контейнер.
 */
export function diskStatPath(): string {
  if (existsSync("/host/disk")) return "/host/disk";
  if (existsSync("/app/backups")) return "/app/backups";
  if (existsSync("/host/root")) return "/host/root";
  return "/";
}

async function readProc(file: string): Promise<string> {
  return readFile(`${procRoot()}/${file}`, "utf8");
}

function parseMeminfo(raw: string): { total: bigint; available: bigint } {
  let total = BigInt(0);
  let available = BigInt(0);
  for (const line of raw.split("\n")) {
    if (line.startsWith("MemTotal:")) {
      total = BigInt(line.split(/\s+/)[1] || "0") * BigInt(1024);
    }
    if (line.startsWith("MemAvailable:")) {
      available = BigInt(line.split(/\s+/)[1] || "0") * BigInt(1024);
    }
  }
  return { total, available };
}

function parseLoadavg(raw: string): number {
  return Number(raw.split(/\s+/)[0] || "0");
}

function parseCpuTimes(stat: string): { idle: number; total: number } {
  const line = stat.split("\n").find((l) => l.startsWith("cpu "));
  if (!line) return { idle: 0, total: 0 };
  const parts = line.trim().split(/\s+/).slice(1).map(Number);
  const idle = (parts[3] || 0) + (parts[4] || 0);
  const total = parts.reduce((a, b) => a + b, 0);
  return { idle, total };
}

/** Интерфейсы, которые не считаем «внешней» сетью хоста. */
export function isIgnoredNetIface(name: string): boolean {
  const n = name.replace(/:$/, "");
  if (n === "lo" || n === "docker0") return true;
  if (n.startsWith("veth")) return true;
  if (n.startsWith("br-")) return true;
  if (n.startsWith("awg")) return true;
  if (n.startsWith("wg")) return true;
  return false;
}

/** Имя iface с дефолтным маршрутом (Destination=00000000) или null. */
export function parseDefaultIface(routeRaw: string): string | null {
  for (const line of routeRaw.split("\n").slice(1)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const [iface, dest] = parts;
    if (!iface || isIgnoredNetIface(iface)) continue;
    if (dest === "00000000") return iface;
  }
  return null;
}

export type NetCounters = { iface: string; rx: bigint; tx: bigint };

/**
 * Читает /proc/net/dev (+ route). Берёт iface дефолтного маршрута,
 * иначе — с наибольшим суммарным трафиком (без lo/docker/veth/br/wg).
 */
export function parseNetDev(
  netDevRaw: string,
  routeRaw: string | null,
): NetCounters | null {
  const rows: NetCounters[] = [];
  for (const line of netDevRaw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.includes(":")) continue;
    const [left, right] = trimmed.split(":");
    if (!left || right == null) continue;
    const iface = left.trim();
    if (isIgnoredNetIface(iface)) continue;
    const cols = right.trim().split(/\s+/);
    if (cols.length < 9) continue;
    const rx = BigInt(cols[0] || "0");
    const tx = BigInt(cols[8] || "0");
    rows.push({ iface, rx, tx });
  }
  if (rows.length === 0) return null;

  const preferred = routeRaw ? parseDefaultIface(routeRaw) : null;
  if (preferred) {
    const hit = rows.find((r) => r.iface === preferred);
    if (hit) return hit;
  }

  rows.sort((a, b) => {
    const sa = a.rx + a.tx;
    const sb = b.rx + b.tx;
    if (sa === sb) return 0;
    return sa > sb ? -1 : 1;
  });
  return rows[0] ?? null;
}

let prevCpu: { idle: number; total: number } | null = null;

export type HostMetrics = {
  cpu: number;
  memUsed: bigint;
  memTotal: bigint;
  diskUsed: bigint;
  diskTotal: bigint;
  load1: number;
  netRxBytes: bigint;
  netTxBytes: bigint;
};

export async function collectHostMetrics(): Promise<HostMetrics> {
  const [stat, meminfo, loadavg, netDev, route] = await Promise.all([
    readProc("stat"),
    readProc("meminfo"),
    readProc("loadavg"),
    readProc("net/dev").catch(() => ""),
    readProc("net/route").catch(() => ""),
  ]);

  const cur = parseCpuTimes(stat);
  let cpu = 0;
  if (prevCpu && cur.total > prevCpu.total) {
    const idleDelta = cur.idle - prevCpu.idle;
    const totalDelta = cur.total - prevCpu.total;
    cpu = Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100));
  }
  prevCpu = cur;

  const mem = parseMeminfo(meminfo);
  const memUsed =
    mem.total > mem.available ? mem.total - mem.available : BigInt(0);

  const disk = await statfs(diskStatPath());
  const diskTotal = BigInt(disk.blocks) * BigInt(disk.bsize);
  const diskFree = BigInt(disk.bfree) * BigInt(disk.bsize);
  const diskUsed = diskTotal > diskFree ? diskTotal - diskFree : BigInt(0);

  const net = netDev
    ? parseNetDev(netDev, route || null)
    : null;

  return {
    cpu: Number(cpu.toFixed(1)),
    memUsed,
    memTotal: mem.total,
    diskUsed,
    diskTotal,
    load1: parseLoadavg(loadavg),
    netRxBytes: net?.rx ?? BigInt(0),
    netTxBytes: net?.tx ?? BigInt(0),
  };
}
