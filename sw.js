importScripts("https://storage.googleapis.com/workbox-cdn/releases/3.3.1/workbox-sw.js");

workbox.precaching.precacheAndRoute([
  {
    "url": "icons-actionbar.html",
    "revision": "fad4a1281dcb80a16ab8f67146c19e97"
  },
  {
    "url": "icons-app-shortcut.html",
    "revision": "19b506ca14125b496889e76f62bc6e59"
  },
  {
    "url": "icons-generic.html",
    "revision": "b5dacad3b34788e90cf10d476f502796"
  },
  {
    "url": "icons-launcher.html",
    "revision": "040bbd04bc17adfdef9c3d4f85e7faa1"
  },
  {
    "url": "icons-notification.html",
    "revision": "11ef81162f7f76be2e81a71dd1e421df"
  },
  {
    "url": "index.html",
    "revision": "3c25a830a98305cebc42ce0f5a5d2c38"
  },
  {
    "url": "nine-patches.html",
    "revision": "94fe38d60615c3c9a91bce3fcdd39562"
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
    "revision": "b7330c66fc11795d5744dc3d11bbfe2b"
  },
  {
    "url": "bg-color-suggester.js",
    "revision": "ee15e0bb3b4e912fce76cf48b72da8cd"
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
    "revision": "2179920b70534cc9127622a607dbc7ce"
  },
  {
    "url": "app.css",
    "revision": "f8e938b151313228fa330c35fbaa3941"
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
