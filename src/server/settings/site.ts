import { prisma } from "@/server/db";
import {
  brandSchema,
  contactsSchema,
  SETTINGS_KEYS,
  siteContentSchema,
} from "@/server/settings/schemas";

export async function getPublicSitePayload() {
  const rows = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          SETTINGS_KEYS.brand,
          SETTINGS_KEYS.content,
          SETTINGS_KEYS.contacts,
          "seo.counters",
        ],
      },
    },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const brand = brandSchema.parse(map[SETTINGS_KEYS.brand] ?? {});
  const content = siteContentSchema.parse(map[SETTINGS_KEYS.content] ?? {});
  const contacts = contactsSchema.parse(map[SETTINGS_KEYS.contacts] ?? {});
  const counters =
    map["seo.counters"] && typeof map["seo.counters"] === "object"
      ? map["seo.counters"]
      : {};

  return { brand, content, contacts, counters };
}
