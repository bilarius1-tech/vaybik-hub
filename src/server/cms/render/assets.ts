/** Версии статики leadweb (?v=). Переопределяются Setting `site.assets`. */
export type SiteAssetVersions = {
  siteCss: string;
  serviceCss: string;
  keysyCss: string;
  mainJs: string;
  magicRingsJs: string;
  gradientBlindsJs: string;
  keysyJs: string;
  calcCss: string;
  calcDataJs: string;
  calcContentJs: string;
  calcJs: string;
  calcClientJs: string;
};

export const DEFAULT_ASSET_VERSIONS: SiteAssetVersions = {
  siteCss: "13",
  serviceCss: "2",
  keysyCss: "6",
  mainJs: "2",
  magicRingsJs: "1",
  gradientBlindsJs: "1",
  keysyJs: "2",
  calcCss: "2",
  calcDataJs: "2",
  calcContentJs: "2",
  calcJs: "2",
  calcClientJs: "2",
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
  /** HTML сразу после &lt;/main&gt; (например lc-bar на /kalkulyator/) */
  afterMain?: string;
};

export const LC_BAR_HTML =
  '<div class="lc-bar" aria-hidden="false"><span class="lc-bar-l">Разработка</span><b id="lcBarSum"></b><button type="button" class="bt-btn2" data-go="lcOut">Заявка</button></div>';

/** CSS/JS и body-класс по шаблону страницы */
export function assetsForTemplate(
  template: string,
  versions: SiteAssetVersions = DEFAULT_ASSET_VERSIONS,
): TemplateAssets {
  const css = [`/css/fonts.css`, `/css/site.css?v=${versions.siteCss}`];
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
    css.push(`/kalkulyator/calc.css?v=${versions.calcCss}`);
    js.push(`/kalkulyator/data.js?v=${versions.calcDataJs}`);
    js.push(`/kalkulyator/content.js?v=${versions.calcContentJs}`);
    js.push(`/kalkulyator/calc.js?v=${versions.calcJs}`);
    js.push(`/kalkulyator/client.js?v=${versions.calcClientJs}`);
    js.push(`/js/metrika.js`);
    return {
      bodyClass: "lc-page",
      bodyAttrs: ' data-mode="client"',
      css,
      js,
      afterMain: LC_BAR_HTML,
    };
  }

  // home | default
  js.push(`/js/magic-rings.js?v=${versions.magicRingsJs}`);
  js.push(`/js/gradient-blinds.js?v=${versions.gradientBlindsJs}`);
  js.push(`/js/metrika.js`);
  return { bodyClass: "", bodyAttrs: "", css, js };
}
