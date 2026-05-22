# 車牌維修資料搜尋

這是一個可放在 GitHub Pages 的純前端網頁，用來搜尋 Google 試算表中「改裝業績」分頁的資料。

## 使用方式

1. 開啟 `index.html` 或 GitHub Pages 網址。
2. 等畫面顯示「線上資料」。
3. 輸入完整或部分車牌，例如 `MPB-9572`。

## GitHub Pages 部署

1. 在 GitHub 建立一個公開 repo，例如 `plate-repair-search`。
2. 上傳此資料夾內的檔案：`index.html`、`styles.css`、`app.js`、`.nojekyll`。
3. 到 repo 的 `Settings` -> `Pages`。
4. `Build and deployment` 選 `Deploy from a branch`。
5. Branch 選 `main`，資料夾選 `/root`，按 `Save`。
6. 等待 GitHub 顯示 Pages 網址。

## 資料來源

- 試算表 ID：`1DpSxO_ugC0tYlEdqMthc-xN8yVgiezsd2N3dIFiWQfc`
- 分頁名稱：`改裝業績`

網頁每次開啟、重新整理、或按「重新讀取線上表」時，都會先直接讀取 Google 試算表的最新內容。如果使用者的瀏覽器或網路阻擋 Google 跨網域讀取，才會改讀同 repo 內的 `data.csv` / `data.js` 備份。GitHub Actions 也會每天自動從 Google 試算表更新備份資料，可在 Actions 頁面手動執行 `Update sheet data`。

## 本機預覽

```bash
python3 server.py
```

開啟：

```text
http://127.0.0.1:4173
```
