declare const __PWA_ENABLED__: boolean;
declare const __PWA_SCOPE__: string;
declare const __PWA_SERVICE_WORKER_URL__: string;

export const SITE_PWA_CONFIG = Object.freeze({
  enabled: __PWA_ENABLED__,
  scope: __PWA_SCOPE__,
  serviceWorkerUrl: __PWA_SERVICE_WORKER_URL__,
});
