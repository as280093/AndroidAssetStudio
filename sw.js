importScripts("https://storage.googleapis.com/workbox-cdn/releases/3.3.1/workbox-sw.js");

self.addEventListener('install', () => {
  self.skipWaiting();
});

workbox.clientsClaim();
workbox.precaching.precacheAndRoute([
  {
    "url": "icons-actionbar.html",
    "revision": "bccc76ad029abcf73e57dc4cb99b3c05"
  },
  {
    "url": "icons-app-shortcut.html",
    "revision": "a35a711c35e25bb4707ba1c2df987245"
  },
  {
    "url": "icons-generic.html",
    "revision": "36db0724844ef0429104a30c3253b415"
  },
  {
    "url": "icons-launcher.html",
    "revision": "66d5f171853dcc3c54face1a0bc6312e"
  },
  {
    "url": "icons-notification.html",
    "revision": "e37894ebfc817a906fdf123ce461aa90"
  },
  {
    "url": "index.html",
    "revision": "76766452da70bd58cfa9e5271094c75c"
  },
  {
    "url": "nine-patches.html",
    "revision": "da4459154589a7999869ac4b21383e16"
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
    "revision": "5b12cb0bb0eacc1fe3f02bd880f0539f"
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
    "revision": "d90674887ea0701ef15778f333fc2229"
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
