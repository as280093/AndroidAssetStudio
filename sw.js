importScripts("https://storage.googleapis.com/workbox-cdn/releases/3.3.1/workbox-sw.js");

workbox.precaching.precacheAndRoute([
  {
    "url": "icons-actionbar.html",
    "revision": "244df7794f4944701f9ef2aef495e1fa"
  },
  {
    "url": "icons-app-shortcut.html",
    "revision": "deab478252bf621383988a2f3ad23518"
  },
  {
    "url": "icons-generic.html",
    "revision": "44538dbf6b0a05afc589eaf70ac3e498"
  },
  {
    "url": "icons-launcher.html",
    "revision": "ade71cbf373cbfb020256eb5e2c17093"
  },
  {
    "url": "icons-notification.html",
    "revision": "fb7506c6ec4f9ca904f953383e08fa94"
  },
  {
    "url": "index.html",
    "revision": "77cb6aeb83cc6ae6411145bac26bd8d2"
  },
  {
    "url": "nine-patches.html",
    "revision": "b25c5083f704fc05ed70f05a5b320bc5"
  },
  {
    "url": "res/generator-thumbs/icon-animator.svg",
    "revision": "65311bbd1a2658cacdf6a2be539b0d9c"
  },
  {
    "url": "res/generator-thumbs/icons-actionbar.svg",
    "revision": "747ac6e1b23e6f00a86d7baebe76029d"
  },
  {
    "url": "res/generator-thumbs/icons-app-shortcut.svg",
    "revision": "dcd36cf4d4b734e4d4d7993aeb5350ce"
  },
  {
    "url": "res/generator-thumbs/icons-generic.svg",
    "revision": "7e9aaa9edeaf210c7afac117cf094192"
  },
  {
    "url": "res/generator-thumbs/icons-launcher.svg",
    "revision": "ac624b8aabda5851413f3ccfd252b80d"
  },
  {
    "url": "res/generator-thumbs/icons-notification.svg",
    "revision": "bd07505811fade5e742afe6a85cedf03"
  },
  {
    "url": "res/generator-thumbs/nine-patches.svg",
    "revision": "c37457a837ee23a6c1981b5d993ee72e"
  },
  {
    "url": "app.js",
    "revision": "ecdd15e32b5d236facfd65698e25512f"
  },
  {
    "url": "vendor.js",
    "revision": "29a5241ddaf6382e654816a3ac13b65f"
  },
  {
    "url": "app.css",
    "revision": "47245b5d163552ca8c59b6b98cd52103"
  }
]);

workbox.routing.registerRoute(
  new RegExp('https://(?:fonts|www).(?:googleapis|gstatic).com/(.*)'),
  workbox.strategies.cacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new workbox.expiration.Plugin({
        maxEntries: 20,
        purgeOnQuotaError: true,
      }),
      new workbox.cacheableResponse.Plugin({
        statuses: [0, 200]
      }),
    ],
  }),
);

workbox.googleAnalytics.initialize();
