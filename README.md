# 拍時計

メトロノームとカウントダウンタイマーが一つになった練習用アプリ。
リング上のドットが拍、外周のアークがタイマーの残り時間。外部ライブラリなしの素のHTML/CSS/JS。

- 1枚のリングにメトロノームとタイマーを統合
- 拍ごとに 強拍 / 弱拍 / 休符 を切り替え（ドットをタップ）
- 拍子 1〜12拍 × /2 /4 /8、サブディビジョン なし・8分・3連・16分、タップテンポ
- カウントダウンタイマー（プリセット＋1分/5分刻み）、終了でアラーム
- 「連動」オンでタイマー開始と同時にメトロノームが鳴り、終了で止まる
- 再生中は画面が消えない（Wake Lock）
- オフライン対応・ホーム画面から全画面起動（PWA）
- 設定は端末内に保存。あとから Firebase を足せば端末間で同期できる

---

## ファイル

```
index.html            画面
styles.css            見た目
app.js                本体（メトロノーム・タイマー・音の合成）
store.js              設定の保存（localStorage ＋ 任意のクラウド同期の受け口）
firebase-config.js    Firebase の設定（既定 null ＝ 使わない）
firebase-sync.js      Google ログイン＋Firestore 同期（設定が null なら何もしない）
sw.js                 Service Worker（オフライン用）
manifest.webmanifest  ホーム画面アプリの定義
icons/                アイコン
.nojekyll             GitHub Pages の Jekyll 処理を無効化
```

---

## GitHub Pages で公開する

1. GitHub で新しいリポジトリを作る（例: `hakudokei`）。**Public** にする
   （Private でも Pages は使えるが、無料プランでは公開できない）
2. このフォルダの中身を**そのまま**リポジトリ直下に置く
   - ブラウザだけで済ませるなら: リポジトリの「Add file」→「Upload files」に
     フォルダごとドラッグ＆ドロップ →「Commit changes」
   - Mac のターミナルを使うなら:
     ```bash
     cd hakudokei
     git init
     git add .
     git commit -m "拍時計"
     git branch -M main
     git remote add origin https://github.com/<ユーザー名>/hakudokei.git
     git push -u origin main
     ```
3. リポジトリの **Settings → Pages** で
   - Source: **Deploy from a branch**
   - Branch: **main** / **/(root)** → Save
4. 1〜2分待つと `https://<ユーザー名>.github.io/hakudokei/` で開けるようになる

### iPhone に入れる

Safari でそのURLを開く → 共有ボタン → **ホーム画面に追加**。
以後はアイコンから全画面で起動し、オフラインでも動く（初回だけオンラインで開くこと）。

### 更新するとき

ファイルを差し替えて push するだけ。ただし Service Worker が古いファイルを
掴んだままになることがあるので、`sw.js` の先頭の

```js
var VERSION = "hakudokei-v1";
```

を `-v2`, `-v3` … と上げてから push する。これで次回起動時に入れ替わる。

---

## Firebase を後から有効にする（任意）

いまは設定が端末内（localStorage）だけに保存される。
iPhone と Mac で同じ設定を使いたくなったら、以下を行うと
右上に「ログイン」ボタンが出て、Google ログイン後に自動で同期する。

1. [Firebase コンソール](https://console.firebase.google.com/) でプロジェクトを作る
2. **Authentication** → ログイン方法 → **Google** を有効化
3. Authentication → **設定 → 承認済みドメイン** に `<ユーザー名>.github.io` を追加
4. **Firestore Database** を作成（本番モードでよい）
5. プロジェクトの設定 → マイアプリ → **ウェブアプリ（</>）を追加** し、表示された
   `firebaseConfig` の中身を `firebase-config.js` に貼る:

   ```js
   window.HAKU_FIREBASE = {
     apiKey: "...",
     authDomain: "xxxx.firebaseapp.com",
     projectId: "xxxx",
     storageBucket: "xxxx.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

6. Firestore の **ルール** を次のようにする（自分のデータだけ読み書きできる状態）:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

7. push して完了。`sw.js` の VERSION も上げること

保存先は `users/{uid}/app/settings` の1ドキュメントだけ。無料枠（Spark）で十分収まる。
`firebase-config.js` に書く値はブラウザから見える公開情報で、秘密鍵ではない。
データを守るのは上のセキュリティルール側なので、ルールの設定は必ず行うこと。

### 練習ログを足したくなったら

`store.js` が保存の入口になっているので、`users/{uid}/logs/{日付}` のような
コレクションを `firebase-sync.js` に足せば、タイマー完了の記録も同じ仕組みで扱える。

---

## ローカルで試す

`file://` で直接開くと Service Worker が動かないので、簡易サーバを立てる:

```bash
cd hakudokei
python3 -m http.server 8000
```

→ ブラウザで `http://localhost:8000/`

---

## 既知の制約

- iOS は本体側面の着信/サイレントスイッチが「消音」だと音が出ない（Webアプリ共通の制約）
- iOS は最初のタップまで音を鳴らせない（再生ボタンを一度押すと有効になる）
- 画面をロックしたり他のアプリに移ると音は止まる（ブラウザアプリ共通の制約）
