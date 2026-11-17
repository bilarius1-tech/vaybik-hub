/** CSP Report-Only для публичного site-сервера (не enforce). */
export const SITE_CSP_REPORT_ONLY =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://mc.yandex.ru https://mc.yandex.com https://yastatic.net https://chat.vaybik.ru; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://mc.yandex.ru https://mc.yandex.com; frame-src https://mc.yandex.ru https://chat.vaybik.ru; report-uri /csp-report";
