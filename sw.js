importScripts("https://storage.googleapis.com/workbox-cdn/releases/3.3.1/workbox-sw.js");

self.addEventListener('install', () => {
  self.skipWaiting();
});

workbox.clientsClaim();
workbox.precaching.precacheAndRoute([
  {
    "url": "icons-actionbar.html",
    "revision": "7109f7ae15f110afaeb354ba5dff84ea"
  },
  {
    "url": "icons-app-shortcut.html",
    "revision": "12234117526826296f3dd4dec8a00e8c"
  },
  {
    "url": "icons-generic.html",
    "revision": "fa5788da2b3326f87a7f2ea5fc69eda5"
  },
  {
    "url": "icons-launcher.html",
    "revision": "af34c8dfc1f13fff8d166c47d8b353b1"
  },
  {
    "url": "icons-notification.html",
    "revision": "c71335bf004e5daca9a4c2c39783cc6c"
  },
  {
    "url": "index.html",
    "revision": "8df485c2b855e275d3c0eae7e0b34daa"
  },
  {
    "url": "nine-patches.html",
    "revision": "5f9f80a2669120d29221d2c67170f494"
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
    "revision": "1ef3ed1282c9b5d09217937e6ae193dc"
  },
  {
    "url": "bg-color-suggester.js",
    "revision": "cbc58593b367dfb4e090f6c42f79e49d"
  },
  {
    "url": "image-url-picker.js",
    "revision": "7ce319aff556b92c76b2d9dc20cde874"
  },
  {
    "url": "material-color-utilities.js",
    "revision": "9f98f169beb93323ed8ac531dd10a96a"
  },
  {
    "url": "theme-manager.js",
    "revision": "92abb85ae9685dcd56e15e73ebce2984"
  },
  {
    "url": "vendor.js",
    "revision": "8c2dc3e53deaef91fefd6c71b67432e8"
  },
  {
    "url": "app.css",
    "revision": "6f626d9963af9696efee3d3b73ad6c67"
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
