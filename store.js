/* store.js — 設定の保存を一箇所に集約するレイヤー
 *
 * 既定では端末内（localStorage）だけに保存する。
 * firebase-sync.js が Store.attachRemote() を呼ぶと、保存のたびにクラウドへも送られ、
 * クラウド側が変わったときは Store.applyRemote() 経由でアプリに反映される。
 * アプリ本体（app.js）は Store の形だけ知っていればよく、Firebase の有無を意識しない。
 */
(function (global) {
  "use strict";

  var KEY = "hakudokei.v1";
  var state = null;
  var remote = null;
  var listeners = [];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var Store = {
    /* 既定値を渡すと、保存済みの値を上書きした状態を返す */
    load: function (defaults) {
      state = clone(defaults);
      try {
        var raw = localStorage.getItem(KEY);
        if (raw) {
          var saved = JSON.parse(raw);
          for (var k in state) {
            if (Object.prototype.hasOwnProperty.call(saved, k) && saved[k] !== undefined) state[k] = saved[k];
          }
        }
      } catch (e) {}
      return state;
    },

    save: function (next) {
      if (next) state = next;
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
      if (remote && remote.push) {
        try { remote.push(clone(state)); } catch (e) {}
      }
    },

    current: function () { return state; },

    /* --- ここから下は firebase-sync.js 用 --- */

    /* remote = { push: function(state){} } */
    attachRemote: function (r) {
      remote = r;
      if (remote && remote.push && state) {
        try { remote.push(clone(state)); } catch (e) {}
      }
    },

    detachRemote: function () { remote = null; },

    /* クラウド側の値をアプリへ反映する */
    applyRemote: function (data) {
      if (!data || typeof data !== "object") return;
      for (var k in data) {
        if (Object.prototype.hasOwnProperty.call(data, k)) state[k] = data[k];
      }
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
      for (var i = 0; i < listeners.length; i++) {
        try { listeners[i](clone(state)); } catch (e) {}
      }
    },

    onRemote: function (fn) { listeners.push(fn); }
  };

  global.Store = Store;
})(window);
