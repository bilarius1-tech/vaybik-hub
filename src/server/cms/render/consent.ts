import { esc, escAttr } from "./escape";

export const ANALYTICS_CONSENT_COOKIE = "vaybik_analytics_consent";

export type SiteAnalyticsRender = {
  yandexMetrika?: string | null;
  yandexWebmaster?: string | null;
  googleSearchConsole?: string | null;
  googleAnalytics?: string | null;
};

export type SiteFaviconRender = {
  ico?: string | null;
  png32?: string | null;
  appleTouch180?: string | null;
  icon192?: string | null;
  icon512?: string | null;
  manifest?: string | null;
  svg?: string | null;
};

/** Ссылки favicon/manifest для <head>. */
export function renderFaviconLinks(
  favicon: SiteFaviconRender | null | undefined,
  fallbackSvg: string,
): string {
  const parts: string[] = [];
  if (favicon?.svg) {
    parts.push(
      `<link rel="icon" href="${escAttr(favicon.svg)}" type="image/svg+xml">`,
    );
  } else {
    parts.push(
      `<link rel="icon" href="${escAttr(fallbackSvg)}" type="image/svg+xml">`,
    );
  }
  if (favicon?.ico) {
    parts.push(
      `<link rel="icon" href="${escAttr(favicon.ico)}" sizes="any">`,
    );
  }
  if (favicon?.png32) {
    parts.push(
      `<link rel="icon" type="image/png" sizes="32x32" href="${escAttr(favicon.png32)}">`,
    );
  }
  if (favicon?.appleTouch180) {
    parts.push(
      `<link rel="apple-touch-icon" sizes="180x180" href="${escAttr(favicon.appleTouch180)}">`,
    );
  }
  if (favicon?.manifest) {
    parts.push(
      `<link rel="manifest" href="${escAttr(favicon.manifest)}">`,
    );
  }
  return parts.join("\n");
}

export function renderVerificationMeta(
  analytics: SiteAnalyticsRender | null | undefined,
): string {
  const parts: string[] = [];
  const yw = analytics?.yandexWebmaster?.trim();
  const gsc = analytics?.googleSearchConsole?.trim();
  if (yw) {
    parts.push(
      `<meta name="yandex-verification" content="${escAttr(yw)}">`,
    );
  }
  if (gsc) {
    parts.push(
      `<meta name="google-site-verification" content="${escAttr(gsc)}">`,
    );
  }
  return parts.join("\n");
}

/**
 * Баннер согласия + загрузка Метрики только после «Принимаю».
 * Без cookie тег не вставляется (и не грузится).
 */
export function renderConsentAndAnalytics(opts: {
  analytics: SiteAnalyticsRender | null | undefined;
  privacyUrl: string;
}): string {
  const ymId = opts.analytics?.yandexMetrika?.trim() || "";
  if (!ymId) {
    // Нет ID — баннер не нужен (нечего грузить)
    return "";
  }
  const privacy = opts.privacyUrl || "https://chat.vaybik.ru/privacy";
  // Инлайн: компактно, без отдельного файла. Cookie 180 дней.
  return `<div id="vaybik-consent" class="vaybik-consent" hidden role="dialog" aria-live="polite" aria-label="Согласие на аналитику">
<p>Мы используем Яндекс.Метрику (в т.ч. вебвизор), чтобы улучшать сайт. <a href="${escAttr(privacy)}" target="_blank" rel="noopener">Политика конфиденциальности</a></p>
<div class="vaybik-consent-acts">
<button type="button" data-consent="1">Принимаю</button>
<button type="button" data-consent="0" class="ghost">Отказаться</button>
</div>
</div>
<style>
.vaybik-consent{position:fixed;z-index:9999;left:16px;right:16px;bottom:16px;max-width:420px;margin:0 auto;padding:14px 16px;border-radius:14px;background:color-mix(in srgb,#120c24 92%,transparent);color:#f4f0ff;border:1px solid rgba(255,138,31,.35);box-shadow:0 12px 40px rgba(0,0,0,.35);font:500 13px/1.45 Manrope,system-ui,sans-serif}
.vaybik-consent[hidden]{display:none!important}
.vaybik-consent a{color:#ff8a1f}
.vaybik-consent-acts{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.vaybik-consent button{appearance:none;border:0;border-radius:10px;padding:8px 14px;font:700 13px/1 Manrope,system-ui,sans-serif;cursor:pointer;background:#ff8a1f;color:#1a0f08}
.vaybik-consent button.ghost{background:transparent;color:#f4f0ff;border:1px solid rgba(255,255,255,.25)}
</style>
<script>
(function(){
  var COOKIE=${JSON.stringify(ANALYTICS_CONSENT_COOKIE)};
  var YM_ID=${JSON.stringify(ymId)};
  function getCookie(n){
    var m=document.cookie.match(new RegExp("(?:^|; )"+n.replace(/([.$?*|{}()\\[\\]\\\\/+^])/g,"\\\\$1")+"=([^;]*)"));
    return m?decodeURIComponent(m[1]):"";
  }
  function setCookie(n,v){
    var max=60*60*24*180;
    document.cookie=n+"="+encodeURIComponent(v)+"; Path=/; Max-Age="+max+"; SameSite=Lax";
  }
  function loadMetrika(){
    if(!YM_ID||window.__vaybikYmLoaded) return;
    window.__vaybikYmLoaded=true;
    (function(m,e,t,r,i,k,a){
      m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
      m[i].l=1*new Date();
      for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r)return;}
      k=e.createElement(t);a=e.getElementsByTagName(t)[0];
      k.async=1;k.src=r;a.parentNode.insertBefore(k,a);
    })(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");
    ym(YM_ID,"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});
  }
  var box=document.getElementById("vaybik-consent");
  if(!box) return;
  var c=getCookie(COOKIE);
  if(c==="1"){loadMetrika();return;}
  if(c==="0"){return;}
  box.hidden=false;
  box.addEventListener("click",function(ev){
    var t=ev.target;
    if(!t||!t.getAttribute) return;
    var v=t.getAttribute("data-consent");
    if(v!=="0"&&v!=="1") return;
    setCookie(COOKIE,v);
    box.hidden=true;
    if(v==="1") loadMetrika();
  });
})();
</script>
<noscript><p class="sr-only">${esc("Аналитика отключена без JavaScript и согласия.")}</p></noscript>`;
}
