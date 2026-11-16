import Docker from "dockerode";

let cached: Docker | null = null;

/** Docker API только через DOCKER_HOST (socket-proxy), никогда через сырой sock в app */
export function getDocker(): Docker {
  if (cached) return cached;
  const host = process.env.DOCKER_HOST;
  if (!host) {
    throw Object.assign(new Error("DOCKER_HOST не задан"), {
      status: 503,
      code: "DOCKER_UNAVAILABLE",
    });
  }

  // tcp://docker-proxy:2375
  if (host.startsWith("tcp://")) {
    const without = host.replace(/^tcp:\/\//, "");
    const [hostname, portStr] = without.split(":");
    cached = new Docker({
      host: hostname,
      port: Number(portStr || 2375),
      protocol: "http",
    });
    return cached;
  }

  // unix:///var/run/docker.sock — только для локальных тестов, не для прод-app
  if (host.startsWith("unix://") || host.startsWith("/")) {
    const socketPath = host.replace(/^unix:\/\//, "");
    cached = new Docker({ socketPath });
    return cached;
  }

  throw Object.assign(new Error(`Некорректный DOCKER_HOST: ${host}`), {
    status: 503,
    code: "DOCKER_UNAVAILABLE",
  });
}

export function resetDockerClient(): void {
  cached = null;
}
