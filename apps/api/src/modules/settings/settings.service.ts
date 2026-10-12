import { prisma } from "../../lib/prisma.js";
import { SETTINGS_KEY, defaultSiteSettings, siteSettingsSchema, type SiteSettings } from "./settings.schemas.js";

/** Sem nada salvo (ou valor inválido) devolve o padrão; depois do primeiro salvar, vale o que o admin definiu. */
export async function getSiteSettings(): Promise<SiteSettings> {
  const row = await prisma.siteSetting.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row) return defaultSiteSettings;
  const parsed = siteSettingsSchema.safeParse(row.value);
  return parsed.success ? parsed.data : defaultSiteSettings;
}

export async function saveSiteSettings(input: unknown): Promise<SiteSettings> {
  const value = siteSettingsSchema.parse(input);
  await prisma.siteSetting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value },
    update: { value },
  });
  return value;
}
