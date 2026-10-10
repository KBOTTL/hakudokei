/* firebase-config.js
 *
 * 既定では null＝Firebase を使わない（端末内保存のみ）。
 * 設定を端末間で同期したくなったら、Firebase コンソールで作ったウェブアプリの設定を
 * 下のように貼り付けるだけで、Google ログイン＋同期が有効になる。
 * 手順は README.md の「Firebase を後から有効にする」を参照。
 *
 * window.HAKU_FIREBASE = {
 *   apiKey: "...",
 *   authDomain: "xxxx.firebaseapp.com",
 *   projectId: "xxxx",
 *   storageBucket: "xxxx.appspot.com",
 *   messagingSenderId: "...",
 *   appId: "..."
 * };
 *
 * ここに書く値は公開前提のもので、秘密鍵ではない（ブラウザから見える）。
 * データを守るのは Firestore のセキュリティルール側。README のルール例を必ず設定すること。
 */
window.HAKU_FIREBASE = null;
