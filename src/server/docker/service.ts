import type Dockerode from "dockerode";
import { getDocker } from "@/server/docker/client";
import {
  assertContainerAllowed,
  DockerPolicyError,
} from "@/server/docker/policy";
import { prisma } from "@/server/db";

export { DockerPolicyError };

async function loadRegistryNames(serviceId: string): Promise<{
  names: string[];
  serviceName: string;
  slug: string;
}> {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) {
    throw Object.assign(new Error("Сервис не найден"), {
      status: 404,
      code: "NOT_FOUND",
    });
  }
  return {
    names: service.containerNames,
    serviceName: service.name,
    slug: service.slug,
  };
}

function normalizeName(name: string): string {
  return name.replace(/^\//, "");
}

async function resolveContainer(
  serviceId: string,
  containerName: string,
): Promise<{
  container: Dockerode.Container;
  inspect: Dockerode.ContainerInspectInfo;
  registry: Awaited<ReturnType<typeof loadRegistryNames>>;
}> {
  const registry = await loadRegistryNames(serviceId);
  const docker = getDocker();
  const name = normalizeName(containerName);
  const container = docker.getContainer(name);
  let inspect: Dockerode.ContainerInspectInfo;
  try {
    inspect = await container.inspect();
  } catch (err) {
    const status =
      err && typeof err === "object" && "statusCode" in err
        ? Number((err as { statusCode: number }).statusCode)
        : 500;
    if (status === 404) {
      throw Object.assign(new Error(`Контейнер «${name}» не найден`), {
        status: 404,
        code: "NOT_FOUND",
      });
    }
    throw err;
  }

  assertContainerAllowed(
    {
      name: inspect.Name,
      image: inspect.Config?.Image,
      labels: inspect.Config?.Labels || {},
    },
    registry.names,
  );

  return { container, inspect, registry };
}

function calcCpuPercent(stats: Dockerode.ContainerStats): number {
  const cpuDelta =
    (stats.cpu_stats?.cpu_usage?.total_usage || 0) -
    (stats.precpu_stats?.cpu_usage?.total_usage || 0);
  const systemDelta =
    (stats.cpu_stats?.system_cpu_usage || 0) -
    (stats.precpu_stats?.system_cpu_usage || 0);
  const online =
    stats.cpu_stats?.online_cpus ||
    stats.cpu_stats?.cpu_usage?.percpu_usage?.length ||
    1;
  if (systemDelta > 0 && cpuDelta > 0) {
    return (cpuDelta / systemDelta) * online * 100;
  }
  return 0;
}

export async function getContainerStatus(
  serviceId: string,
  containerName: string,
) {
  const { inspect } = await resolveContainer(serviceId, containerName);
  const state = inspect.State;
  const startedAt = state.StartedAt ? new Date(state.StartedAt) : null;
  const uptimeSec =
    state.Running && startedAt
      ? Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000))
      : 0;

  let cpuPercent = 0;
  let memUsage = 0;
  let memLimit = 0;
  try {
    const docker = getDocker();
    const c = docker.getContainer(inspect.Id);
    const stats = (await c.stats({ stream: false })) as Dockerode.ContainerStats;
    cpuPercent = Math.round(calcCpuPercent(stats) * 10) / 10;
    memUsage = stats.memory_stats?.usage || 0;
    memLimit = stats.memory_stats?.limit || 0;
  } catch {
    // stats могут быть недоступны для stopped
  }

  return {
    id: inspect.Id.slice(0, 12),
    name: normalizeName(inspect.Name),
    image: inspect.Config?.Image || "",
    state: state.Status,
    running: !!state.Running,
    startedAt: startedAt?.toISOString() || null,
    uptimeSec,
    cpuPercent,
    memUsage,
    memLimit,
    labels: inspect.Config?.Labels || {},
  };
}

export async function listServiceContainers(serviceId: string) {
  const registry = await loadRegistryNames(serviceId);
  const results = [];
  for (const name of registry.names) {
    try {
      results.push(await getContainerStatus(serviceId, name));
    } catch (err) {
      results.push({
        name: normalizeName(name),
        error:
          err instanceof Error ? err.message : "Не удалось получить статус",
        running: false,
        state: "unknown",
      });
    }
  }
  return { containers: results, service: registry };
}

export async function restartContainer(
  serviceId: string,
  containerName: string,
) {
  const { container, inspect, registry } = await resolveContainer(
    serviceId,
    containerName,
  );
  await container.restart({ t: 10 });
  return {
    name: normalizeName(inspect.Name),
    action: "restart" as const,
    service: registry.slug,
  };
}

export async function startContainer(
  serviceId: string,
  containerName: string,
) {
  const { container, inspect, registry } = await resolveContainer(
    serviceId,
    containerName,
  );
  await container.start();
  return {
    name: normalizeName(inspect.Name),
    action: "start" as const,
    service: registry.slug,
  };
}

export async function stopContainer(serviceId: string, containerName: string) {
  const { container, inspect, registry } = await resolveContainer(
    serviceId,
    containerName,
  );
  await container.stop({ t: 10 });
  return {
    name: normalizeName(inspect.Name),
    action: "stop" as const,
    service: registry.slug,
  };
}

function pullImage(docker: Dockerode, image: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    docker.pull(image, (err: Error | null, stream: any) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, (err2: Error | null) =>
        err2 ? reject(err2) : resolve(),
      );
    });
  });
}

/** Вариант A: pull образа + recreate с прежними параметрами */
export async function updateContainer(
  serviceId: string,
  containerName: string,
) {
  const { container, inspect, registry } = await resolveContainer(
    serviceId,
    containerName,
  );
  const docker = getDocker();
  const image = inspect.Config?.Image;
  if (!image) {
    throw Object.assign(new Error("У контейнера нет образа"), {
      status: 400,
      code: "NO_IMAGE",
    });
  }

  await pullImage(docker, image);

  const name = normalizeName(inspect.Name);
  if (inspect.State.Running) {
    await container.stop({ t: 15 }).catch(() => undefined);
  }
  await container.remove({ v: false, force: true });

  const networks = inspect.NetworkSettings?.Networks || {};
  const created = await docker.createContainer({
    name,
    Image: image,
    Env: inspect.Config?.Env,
    Cmd: inspect.Config?.Cmd,
    Entrypoint: inspect.Config?.Entrypoint,
    Labels: inspect.Config?.Labels,
    ExposedPorts: inspect.Config?.ExposedPorts,
    WorkingDir: inspect.Config?.WorkingDir,
    User: inspect.Config?.User,
    HostConfig: inspect.HostConfig || undefined,
    NetworkingConfig: { EndpointsConfig: networks },
  });
  await created.start();

  return {
    name,
    action: "update" as const,
    image,
    service: registry.slug,
  };
}

export async function getLogsTail(
  serviceId: string,
  containerName: string,
  opts: { tail?: number; timestamps?: boolean } = {},
): Promise<string> {
  const { container } = await resolveContainer(serviceId, containerName);
  const buf = await container.logs({
    stdout: true,
    stderr: true,
    tail: opts.tail ?? 200,
    timestamps: opts.timestamps ?? true,
    follow: false,
  });
  return demuxDockerLogs(buf);
}

/** Убрать 8-байтовые docker stream headers */
export function demuxDockerLogs(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buf.length < 8) return buf.toString("utf8");
  const chunks: string[] = [];
  let offset = 0;
  let multiplexed = true;
  while (offset < buf.length) {
    if (offset + 8 > buf.length) {
      multiplexed = false;
      break;
    }
    const streamType = buf[offset];
    if (streamType !== 0 && streamType !== 1 && streamType !== 2) {
      multiplexed = false;
      break;
    }
    const size = buf.readUInt32BE(offset + 4);
    if (offset + 8 + size > buf.length) {
      multiplexed = false;
      break;
    }
    if (size > 0) {
      chunks.push(buf.subarray(offset + 8, offset + 8 + size).toString("utf8"));
    }
    offset += 8 + size;
  }
  if (multiplexed && chunks.length > 0) return chunks.join("");
  return buf.toString("utf8");
}

export async function streamLogs(
  serviceId: string,
  containerName: string,
  opts: { tail?: number; timestamps?: boolean } = {},
): Promise<NodeJS.ReadableStream> {
  const { container } = await resolveContainer(serviceId, containerName);
  const stream = await container.logs({
    stdout: true,
    stderr: true,
    tail: opts.tail ?? 100,
    timestamps: opts.timestamps ?? true,
    follow: true,
  });
  return stream as unknown as NodeJS.ReadableStream;
}
