# ZERO-1 EXPO — Live Vote

イベント会場向けのリアルタイム2択投票サイトです。

## 起動

```sh
python3 -m http.server 8080
```

ブラウザで `http://localhost:8080` を開いてください。同じブラウザの複数タブでは投票と設定が即時同期されます。

管理画面は公開環境では `/admin` です。投票の開始・一時停止・終了、途中結果の表示切替、イベント編集、票のリセットができます。

## 補足

## Firebaseの設定

1. Firebase ConsoleでプロジェクトとWebアプリを作成します。
2. Authenticationで「匿名」と「メール/パスワード」を有効にします。
3. Firestore Databaseを作成します。
4. Webアプリの `firebaseConfig` を `firebase-config.js` に貼り付けます。
5. Authenticationで管理者ユーザーを1人作成し、そのUIDを控えます。
6. Firestoreに `admins/{管理者UID}` という空のドキュメントを作成します。
7. `npx firebase-tools login` と `npx firebase-tools use --add` を実行します。
8. `npx firebase-tools deploy --only firestore:rules,hosting` でルールとサイトを公開します。
9. 公開した `/admin` にログインし、一度「変更を保存」を押して `events/main` を作成します。

投票は `events/main/votes/{匿名ユーザーUID}` に1人1ドキュメントで保存されます。一度投票すると投票先は変更できません。この制限は画面とFirestoreルールの両方で強制されます。参加者の集計は5秒間隔、管理画面はリアルタイム更新です。

管理画面の「投票形式」から2択・3択を切り替えられます。形式の変更は投票開始前、または票をリセットした後に行ってください。3択から2択へ変更しても既存のSIDE C票は削除されず、3択へ戻すと再び集計されます。

500人が同じ会場Wi-Fiから初回アクセスする場合、Firebase Authenticationの匿名登録にあるIP単位の制限へ触れる可能性があります。本番前に同条件で負荷テストを行い、必要ならFirebase Consoleから匿名アカウント作成上限の一時変更を申請してください。
