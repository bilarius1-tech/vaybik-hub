/** Жёсткий denylist: VPN / Traefik / WG — никогда не управлять */
const DENY_NAME =
  /^(traefik|amnezia|xray|wg)([._-]|$)/i;
const DENY_NAME_CONTAINS =
  /(^|[_.-])(amnezia|xray|wireguard|wg-easy)([_.-]|$)|^wg-/i;

export class DockerPolicyError extends Error {
  status = 403;
  code = "DOCKER_FORBIDDEN";
  constructor(message: string) {
    super(message);
  }
}

export function isDeniedName(name: string): boolean {
  const n = name.replace(/^\//, "");
  return DENY_NAME.test(n) || DENY_NAME_CONTAINS.test(n);
}

export function isDeniedImage(image: string | null | undefined): boolean {
  if (!image) return false;
  const ref = image.toLowerCase();
  // traefik/whoami — тестовый образ, не прокси
  if (ref.includes("whoami")) return false;
  return /(^|\/)traefik(?![a-z])|amnezia|xray|wireguard|wg-easy|linuxserver\/wireguard/.test(
    ref,
  );
}

export type ContainerIdentity = {
  name: string;
  image?: string | null;
  labels?: Record<string, string> | null;
};

/**
 * Разрешено, если:
 * 1) не denylist по имени/образу;
 * 2) имя есть в реестре сервиса (containerNames) ИЛИ label vaybik.managed=true
 *    и при этом имя всё равно должно быть в containerNames сервиса
 *    (управляем только контейнерами из реестра).
 */
export function assertContainerAllowed(
  identity: ContainerIdentity,
  registryNames: string[],
): void {
  const name = identity.name.replace(/^\//, "");
  if (isDeniedName(name) || isDeniedImage(identity.image)) {
    throw new DockerPolicyError(
      `Контейнер «${name}» в denylist (Traefik/VPN) — управление запрещено`,
    );
  }

  const inRegistry = registryNames.some(
    (r) => r.replace(/^\//, "") === name,
  );
  if (!inRegistry) {
    throw new DockerPolicyError(
      `Контейнер «${name}» не в реестре сервиса — управление запрещено`,
    );
  }

  const managed = identity.labels?.["vaybik.managed"] === "true";
  // Label рекомендуется, но для уже существующих контейнеров достаточно реестра.
  // Denylist уже отработал. Если label явно false — запрет.
  if (identity.labels?.["vaybik.managed"] === "false") {
    throw new DockerPolicyError(
      `Контейнер «${name}» помечен vaybik.managed=false`,
    );
  }
  void managed;
}

/** Проверка только denylist (для тестов и pre-check) */
export function assertNotDenied(identity: ContainerIdentity): void {
  const name = identity.name.replace(/^\//, "");
  if (isDeniedName(name) || isDeniedImage(identity.image)) {
    throw new DockerPolicyError(
      `Контейнер «${name}» в denylist (Traefik/VPN) — управление запрещено`,
    );
  }
}
