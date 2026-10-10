/* sw.js — オフラインで動かすための Service Worker
 * ファイルを更新したら VERSION の数字を上げること（古いキャッシュが残らないように）
 */
var VERSION = "hakudokei-v2";
var SHELL = VERSION + "-shell";
var FONTS = VERSION + "-fonts";

var SHELL_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./store.js",
  "./app.js",
  "./firebase-config.js",
  "./firebase-sync.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(SHELL).then(function (c) { return c.addAll(SHELL_FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== SHELL && k !== FONTS) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  // Google Fonts: 使えたらネットワーク、落ちたらキャッシュ
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(FONTS).then(function (c) {
        return fetch(req).then(function (res) {
          c.put(req, res.clone());
          return res;
        }).catch(function () { return c.match(req); });
      })
    );
    return;
  }

  // Firebase SDK など外部はそのまま（オフライン時は同期しないだけ）
  if (url.origin !== self.location.origin) return;

  // ページ遷移: ネットワーク優先、失敗したらキャッシュの index.html
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(function () {
        return caches.match("./index.html", { ignoreSearch: true });
      })
    );
    return;
  }

  // 同一オリジンのファイル: キャッシュ優先＋裏で更新
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          caches.open(SHELL).then(function (c) { c.put(req, res.clone()); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
