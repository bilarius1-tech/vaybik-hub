/** Версии статики leadweb (?v=). Переопределяются Setting `site.assets`. */
export type SiteAssetVersions = {
  siteCss: string;
  serviceCss: string;
  keysyCss: string;
  mainJs: string;
  magicRingsJs: string;
  gradientBlindsJs: string;
  keysyJs: string;
};

export const DEFAULT_ASSET_VERSIONS: SiteAssetVersions = {
  siteCss: "13",
  serviceCss: "2",
  keysyCss: "6",
  mainJs: "2",
  magicRingsJs: "1",
  gradientBlindsJs: "1",
  keysyJs: "2",
};

export function mergeAssetVersions(
  override?: Partial<SiteAssetVersions> | null,
): SiteAssetVersions {
  return { ...DEFAULT_ASSET_VERSIONS, ...(override || {}) };
}

export type TemplateAssets = {
  bodyClass: string;
  bodyAttrs: string;
  css: string[];
  js: string[];
};

/** CSS/JS и body-класс по шаблону страницы */
export function assetsForTemplate(
  template: string,
  versions: SiteAssetVersions = DEFAULT_ASSET_VERSIONS,
): TemplateAssets {
  const css = [
    `/css/fonts.css`,
    `/css/site.css?v=${versions.siteCss}`,
  ];
  const js = [`/js/main.js?v=${versions.mainJs}`];

  if (template === "keysy") {
    css.push(`/css/service-pages.css?v=${versions.serviceCss}`);
    css.push(`/css/keysy-ii.css?v=${versions.keysyCss}`);
    js.push(`/js/magic-rings.js?v=${versions.magicRingsJs}`);
    js.push(`/js/gradient-blinds.js?v=${versions.gradientBlindsJs}`);
    js.push(`/js/keysy-ii.js?v=${versions.keysyJs}`);
    js.push(`/js/metrika.js`);
    return { bodyClass: "svc", bodyAttrs: "", css, js };
  }

  if (template === "service") {
    css.push(`/css/service-pages.css?v=${versions.serviceCss}`);
    js.push(`/js/magic-rings.js?v=${versions.magicRingsJs}`);
    js.push(`/js/gradient-blinds.js?v=${versions.gradientBlindsJs}`);
    js.push(`/js/metrika.js`);
    return { bodyClass: "svc", bodyAttrs: "", css, js };
  }

  if (template === "calculator") {
    js.push(`/js/metrika.js`);
    return {
      bodyClass: "lc-page",
      bodyAttrs: ' data-mode="client"',
      css,
      js,
    };
  }

  // home | default
  js.push(`/js/magic-rings.js?v=${versions.magicRingsJs}`);
  js.push(`/js/gradient-blinds.js?v=${versions.gradientBlindsJs}`);
  js.push(`/js/metrika.js`);
  return { bodyClass: "", bodyAttrs: "", css, js };
}
