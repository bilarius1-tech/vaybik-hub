export type TraefikLabelInput = {
  slug: string;
  subdomain: string; // e.g. chat.vaybik.ru
  port: number;
  network?: string;
  certresolver?: string;
  entrypoint?: string;
  entrypointHttp?: string;
  redirectMiddleware?: string;
};

export function generateTraefikComposeSnippet(input: TraefikLabelInput): string {
  const network = input.network || process.env.TRAEFIK_NETWORK || "proxy";
  const certresolver =
    input.certresolver || process.env.TRAEFIK_CERTRESOLVER || "le";
  const entrypoint =
    input.entrypoint || process.env.TRAEFIK_ENTRYPOINT || "websecure";
  const entrypointHttp =
    input.entrypointHttp || process.env.TRAEFIK_ENTRYPOINT_HTTP || "web";
  const redirect =
    input.redirectMiddleware ||
    process.env.TRAEFIK_HTTPS_REDIRECT_MIDDLEWARE ||
    "to-https@docker";
  const router = `vaybik-${input.slug}`;

  return `# Сгенерировано админкой Вайбик — вставьте в docker-compose сервиса
# Сеть Traefik: ${network} (external). Админка сама Traefik не настраивает.
services:
  ${input.slug}:
    # image: ...
    networks:
      - ${network}
    labels:
      - traefik.enable=true
      - traefik.docker.network=${network}
      - traefik.http.routers.${router}.rule=Host(\`${input.subdomain}\`)
      - traefik.http.routers.${router}.entrypoints=${entrypoint}
      - traefik.http.routers.${router}.tls.certresolver=${certresolver}
      - traefik.http.services.${router}.loadbalancer.server.port=${input.port}
      - traefik.http.routers.${router}-http.rule=Host(\`${input.subdomain}\`)
      - traefik.http.routers.${router}-http.entrypoints=${entrypointHttp}
      - traefik.http.routers.${router}-http.middlewares=${redirect}
      - traefik.http.routers.${router}-http.service=${router}
      - vaybik.managed=true

networks:
  ${network}:
    external: true
`;
}
