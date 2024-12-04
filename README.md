# 機能
インスタグラムの記事URLからデータを取得し、Notionデータベースへ保存します。

# 開発

- `Node.js 20 >=`

## 1. `.env` ファイルに以下を記載

```
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_notion_database_id
```


## 2. 以下で実行

```
serverless offline
```

動作チェック

```
curl -X POST http://localhost:5002/create-ugc \
  -H "Content-Type: application/json" \
  -d '{"postUrl": "https://www.instagram.com/hachi_08/p/DCV0XSzzhQv"}'
```

```
curl -X POST http://localhost:5002/create-ugc \
  -H "Content-Type: application/json" \
  -d '{"postUrl": "https://www.instagram.com/umakichi_67/p/C-IRhoRPnMH"}'
```

```
curl -X POST http://localhost:5002/create-ugc \
  -H "Content-Type: application/json" \
  -d '{"postUrl": "https://www.instagram.com/go.haaan.ck/p/C-lutrizzL8"}'
```

```
curl -X POST http://localhost:5002/create-ugc/create-ugc \
  -H "Content-Type: application/json" \
  -d '{"postUrl": "https://www.instagram.com/p/example-post-id/"}'
```

# TODO
キャッシュ機能の実装
リトライメカニズムの追加
プロキシの使用
エラーモニタリングの強化
