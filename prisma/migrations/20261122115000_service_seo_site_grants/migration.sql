-- Роль публичного site-сервера (vaybik_site): SELECT на доменное SEO.
-- На dig роли может не быть — тогда блок no-op.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vaybik_site') THEN
    GRANT SELECT ON TABLE "Service" TO vaybik_site;
    GRANT SELECT ON TABLE "ServiceSeo" TO vaybik_site;
  END IF;
END $$;
