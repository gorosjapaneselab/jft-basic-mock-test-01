# v8 調査結果・修正・公開手順

## コードで確認した原因

1. 本番Result画面は、localStorageを読み直して表示するのではありません。`script.js`のメモリ上の`attempt`を`core.js`の`grade()`へ渡して表示します。正答数は回答のchoice IDと正解IDの比較、点数は正答数÷50×250、時間は終了時刻−開始時刻です。このため16正解・80点・73秒がResultに表示されても、保存やPOSTの成功は証明されません。
2. 元の`persist()`はlocalStorageの書き込み失敗を捕捉してfalseを返しますが、終了処理はその戻り値を確認せずResultへ進んでいました。表示切り替えで保存警告も消える経路がありました。これが「結果は表示できるが、後から完了済みデータが見つからない」状態を作れる直接の不具合です。ただし今回のスマホで実際に書き込みが失敗したかは、端末の実行記録がないため断定できません。
3. 2026年10月7日の公開ファイル確認では、`index.html`は`script.js?payload-v=3`を読み込み、模試本体にはResult表示前の`prepareResultDelivery(grade(questions,attempt))`がありませんでした。一方、復旧ページはv7でした。復旧ページの更新だけでは、通常受験終了時の新しい保存順序は反映されません。公開版には新旧ファイルの混在がありました。
4. 旧診断ページには、POST・保存確認の待機中に全ボタンを無効にする処理がありました。モバイルで待機処理が長引く、またはバックグラウンドで中断されると、確認ボタンまで押せない経路です。またクリック直後のログがなかったため、押下・保存データなし・通信待ちを切り分けられませんでした。
5. 公開版の診断コードでは、`actual.onclick`への登録がReady表示より前にあります。したがって「Readyなのに押しても反応しない」という報告だけから、登録漏れやJavaScriptエラーを断定することはできません。今回そのスマホの実行時エラーをこちらで取得できていません。v8はクリック直後・例外・モジュール読み込み失敗を画面へ記録し、確認ボタンを通信で無効にしない構成へ変更しました。

## 保存領域と構造

本番、旧診断、v7復旧ページは、同じoriginのlocalStorageの`jft-basic-01:attempt:v1`を読みます。sessionStorageを読む処理はありません。保存形式は、`student.name` / `student.rawName` / `student.className`、`startedAt`、`submittedAt`、`attemptId`、`answers:[{questionId,selectedChoiceId}]`、選択肢順序、音声再生状態などを含む受験データです。

本番はメモリ上のデータを描画できますが、診断・復旧は保存済みデータが必要です。旧診断は完了済みデータと`validAttempt()`、復旧は指定IDとの一致と完了済みデータを要求します。v7復旧は、従来のPOST記録・準備済みpayload・outboxも探します。Result描画と保存データ探索の違いが重要です。以前の診断ではコピーに新しいIDを補える処理もあり、診断表示だけでは元の保存データに同じIDが存在したことを証明できませんでした。v8診断はIDがない場合に新規生成せず、読み取り専用でその事実を表示します。

今回のGoro Testについて、どの保存段階で失われたかを確定する端末記録はありません。回答のないデータを推測して作成することや、Goro TestのIDを架空の回答へ付与することはしていません。既存データの削除・ID変更も行っていません。

## v8の終了処理の順序

1. 終了時刻を確定し、既存の採点処理を実行。
2. 元のAttempt ID、氏名・クラス、開始・終了・時間、得点、各Part、Q01〜Q50の回答と正誤からpayloadを作成。
3. 新しい`jft-basic:completed-results:v1`へ、payloadと受験データ全体のスナップショットを保存。Attempt IDごとに保持し、同じIDの異なるpayloadで上書きしません。
4. localStorageから読み戻し、保存内容の一致を確認。この確認に失敗した場合はPOSTせず、Resultに保存失敗とRetryを表示します。結果表示とPDFは利用できます。
5. outboxにも送信状態を記録し、Apps ScriptへJSONをtext/plain・no-corsでPOST。
6. Resultを表示。ネットワーク処理で表示を止めません。
7. Apps Scriptのstatus応答で、同じAttempt IDの`saved:true`を確認した場合だけ保存完了とします。fetchが返っただけでは成功と扱いません。
8. 通信失敗・確認失敗ではpendingのままデータを保持。Result再表示、Retry、オンライン復帰、定期再試行で同じID・同じpayloadを使用します。既存のsent状態もResult再表示時にはサーバーへ再確認します。

受験データの通常保存が古い状態で残っていても、同じIDの完了スナップショットがある場合は、Resultの復元にそのスナップショットを使用します。outboxが失われても完了スナップショットからpendingを再構成します。新しい受験を始めても、この完了記録は削除しません。

既存Apps ScriptのAttempt ID重複判定・ロック・保存確認は維持しています。今回はGoogle側のコードを変更していません。

## 変更ファイル

- `script.js`：完了時の先行保存、Result再表示時の復元・再送、保存失敗の表示。
- `result-delivery.js`：完了スナップショット、保存内容の読み戻し確認、同じIDのpayload保護、outbox復元。
- `index.html`：修正版模試スクリプトの読み込みURLを`durable-v=8`へ変更。
- `result-send-test.js`：クリック直後のログ、通信に依存しないボタン登録、確認ボタンの有効維持、例外表示、新規IDを作らない診断。
- `result-send-test.html`：診断スクリプトの読み込みURLを`durable-v=8`へ変更。
- `tests/durable-v8.test.js`、`tests/post-replay.test.js`：新しい保存と診断処理の検証。

問題JSON、13個のMP3、採点のcore.js、音声再生処理、PDF生成、CSS、問題表示処理、送信先URL、Apps Scriptコードは変更していません。既存の取り消し線対策も保持しています。

## テスト結果と限界

自動テスト44件成功。完了データの復元、容量不足・書き込み失敗・読み戻し不一致時のPOST停止、同一IDの上書き拒否、通信失敗後の保持、サーバー確認なしでは成功にしないこと、重複防止、全50問の列対応、Submitで保存がResultより先になることを検証しました。既存の採点・タイマー・音声のテストも成功しています。

PCおよび390px幅のブラウザで、診断ボタンのクリック記録・保存データ読み取り・JSON表示を確認し、実行時エラーはありませんでした。読み取りにはPCの既存データを使用しています。今回のスマホBraveとGoro Testの実データでの保存確認は未実施です。自動テスト用データを先生のSheetsへ送って成功扱いにはしていません。

サイトデータをユーザーやブラウザが削除した場合、WebアプリがlocalStorage内のデータを維持することはできません。通常の再読み込み・通信失敗に対しては保存済みデータから再試行できます。

## GitHubへ反映する手順

今回使うZIPは **JFT-Basic-Mock-Test-01-GitHub-Pages-Durable-Submit-v8.zip** です。

1. ZIPを開く → 「すべて展開」をクリック → 展開先を選んで「展開」をクリック。
2. GitHubを開く → `gorosjapaneselab/jft-basic-mock-test-01`リポジトリを開く。
3. 「Add file」→「Upload files」をクリック。
4. 展開した中の`index.html`がある階層を開く → **中身のファイルとdata・vendorフォルダをまとめて**アップロード。ZIP自体や外側のフォルダをアップロードするのではありません。復旧ページだけの更新にせず、模試本体のindex.html・script.js・result-delivery.jsも必ず反映してください。
5. 「Commit changes」欄に `Update durable result submission v8` と入力 → 「Commit changes」をクリック。
6. 「Actions」を開く → Pagesの公開処理が成功するまで待つ。
7. スマホの同じBraveで診断ページを開き直す → 表示の **Build: durable-v8** を確認。表示されない場合は反映が確認できていません。ブラウザのサイトデータは削除しないでください。

診断ページ：
https://gorosjapaneselab.github.io/jft-basic-mock-test-01/result-send-test.html

## 再受験しない確認・再送

1. 上記診断ページを、受験した同じスマホ・同じBraveで開く。
2. 「このブラウザの実際の受験結果を確認」を押す。`Click: actual`がログへ出ます。データがなければ理由がログに出ます。
3. Goro Testのデータが表示された場合だけ、氏名・クラス・16正解・80点・73秒・元のAttempt ID・50問の回答を確認する。別の受験が表示された場合は送信しないでください。
4. 全項目が一致した場合、「今回の保存済み受験結果を再送（受験不要）」を押す。
5. **保存確認成功（Saved confirmed）** を確認 → Sheetsを開く → Attempt IDが`d39e4c05-bdb5-4fe1-a8cf-761953207fcd`の行を探す。確認できなければ保存済みとは判断しません。

データが見つからない場合は、復旧できたことにはしません。データを削除したり、Goro TestのIDで新しい受験を作る操作は不要です。

次回通常受験では、Submit後のResultで **Result saved to your teacher.** を確認してください。未確認の場合は **Retry saving** を押せます。Resultを再読み込みした場合も保存済みの同じ受験を再確認・再送します。通常受験での最終確認は、Sheetsに同じAttempt IDと実際の氏名・クラス・点数・全50問が揃うことです。
