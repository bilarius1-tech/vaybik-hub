import { readFile } from "node:fs/promises";
import { statfs } from "node:fs/promises";
import { existsSync } from "node:fs";

/** /host/proc в Docker; локально — /proc */
export function procRoot(): string {
  if (existsSync("/host/proc/stat")) return "/host/proc";
  return "/proc";
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

let prevCpu: { idle: number; total: number } | null = null;

export type HostMetrics = {
  cpu: number;
  memUsed: bigint;
  memTotal: bigint;
  diskUsed: bigint;
  diskTotal: bigint;
  load1: number;
};

export async function collectHostMetrics(): Promise<HostMetrics> {
  const [stat, meminfo, loadavg] = await Promise.all([
    readProc("stat"),
    readProc("meminfo"),
    readProc("loadavg"),
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
  const memUsed = mem.total > mem.available ? mem.total - mem.available : BigInt(0);

  // Диск: корень контейнера или /host/root если смонтирован
  const diskPath = existsSync("/host/root") ? "/host/root" : "/";
  const disk = await statfs(diskPath);
  const diskTotal = BigInt(disk.blocks) * BigInt(disk.bsize);
  const diskFree = BigInt(disk.bfree) * BigInt(disk.bsize);
  const diskUsed = diskTotal > diskFree ? diskTotal - diskFree : BigInt(0);

  return {
    cpu: Number(cpu.toFixed(1)),
    memUsed,
    memTotal: mem.total,
    diskUsed,
    diskTotal,
    load1: parseLoadavg(loadavg),
  };
}
