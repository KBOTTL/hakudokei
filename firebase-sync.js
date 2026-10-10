/* firebase-sync.js — 設定を端末間で同期する（任意）
 *
 * firebase-config.js が null のあいだは何もしない（ボタンも出ない）。
 * 設定を入れると右上に「ログイン」が出て、Google ログイン後に
 * Firestore の users/{uid}/app/settings と双方向に同期する。
 *
 * 保存先のかたち:
 *   users/{uid}/app/settings = { state: {...拍時計の設定...}, updatedAt: <serverTimestamp> }
 */
(function () {
  "use strict";

  var cfg = window.HAKU_FIREBASE;
  var btn = document.getElementById("syncBtn");
  if (!btn) return;
  if (!cfg || !cfg.apiKey) return;   // 未設定 → 端末内保存のまま

  btn.hidden = false;
  btn.textContent = "ログイン";

  var SDK = "https://www.gstatic.com/firebasejs/10.12.5/";
  var auth = null, db = null, fb = {}, docRef = null;
  var pushTimer = null, lastPushed = "", applying = false;

  function label(text, on) {
    btn.textContent = text;
    btn.classList.toggle("on", !!on);
  }

  label("接続中…", false);

  Promise.all([
    import(SDK + "firebase-app.js"),
    import(SDK + "firebase-auth.js"),
    import(SDK + "firebase-firestore.js")
  ]).then(function (mods) {
    var appMod = mods[0], authMod = mods[1], fsMod = mods[2];
    fb = { auth: authMod, fs: fsMod };

    var app = appMod.initializeApp(cfg);
    auth = authMod.getAuth(app);
    db = fsMod.getFirestore(app);

    // iOS のホーム画面起動ではポップアップが開けないのでリダイレクト方式を使う
    var standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

    authMod.getRedirectResult(auth).catch(function () {});

    authMod.onAuthStateChanged(auth, function (user) {
      if (user) {
        label(user.displayName ? user.displayName.slice(0, 8) : "同期中", true);
        start(user.uid);
      } else {
        label("ログイン", false);
        stop();
      }
    });

    btn.addEventListener("click", function () {
      if (auth.currentUser) {
        if (confirm("ログアウトしますか？（設定は端末内に残ります）")) authMod.signOut(auth);
        return;
      }
      var provider = new authMod.GoogleAuthProvider();
      if (standalone) authMod.signInWithRedirect(auth, provider);
      else authMod.signInWithPopup(auth, provider).catch(function () {
        authMod.signInWithRedirect(auth, provider);
      });
    });
  }).catch(function () {
    label("同期なし", false);
  });

  var unsub = null;

  function start(uid) {
    var fs = fb.fs;
    docRef = fs.doc(db, "users", uid, "app", "settings");

    unsub = fs.onSnapshot(docRef, function (snap) {
      if (!snap.exists()) {              // 初回はこの端末の設定をクラウドへ
        push(Store.current());
        return;
      }
      var data = snap.data();
      if (!data || !data.state) return;
      var json = JSON.stringify(data.state);
      if (json === lastPushed) return;   // 自分が書いた内容の戻り
      applying = true;
      Store.applyRemote(data.state);
      applying = false;
      lastPushed = json;
    }, function () { label("同期エラー", false); });

    Store.attachRemote({ push: push });
  }

  function stop() {
    if (unsub) { unsub(); unsub = null; }
    Store.detachRemote();
    docRef = null;
  }

  function push(state) {
    if (!docRef || applying) return;
    var json = JSON.stringify(state);
    if (json === lastPushed) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      var fs = fb.fs;
      lastPushed = json;
      fs.setDoc(docRef, { state: JSON.parse(json), updatedAt: fs.serverTimestamp() })
        .catch(function () { lastPushed = ""; });
    }, 800);
  }
})();
