# Nodejsについて
Lambda関数のランタイムで、以下のバージョンでの動作成功を確認しています。

- Node.js 22.x
- Node.js 18.x

# デプロイ
## 1. IAMを作成
- 作成済みならスキップ

```
AmazonAPIGatewayAdministrator
AmazonS3FullAccess
AWSCloudFormationFullAccess
AWSLambda_FullAccess
CloudWatchFullAccess
CloudWatchFullAccessV2
IAMFullAccess
```

## 2. S3バケットを作成
```
# バケット作成
aws s3 mb s3://instagram-notion-integration-for-deployments --region ap-northeast-1 --profile serverless-lambda-user

# バケットのバージョニングを有効化
aws s3api put-bucket-versioning --bucket instagram-notion-integration-for-deployments --versioning-configuration Status=Enabled --profile serverless-lambda-user
```

## 3. 以下を実行
```
cd deploy

serverless deploy --verbose --aws-profile serverless-lambda-user
```


## デプロイが完了したら以下で情報を確認

API GatewayのエンドポイントURLが作成されています。

```
serverless info --verbose --aws-profile serverless-lambda-user
```

endpoint: POST - https://e77vjnlboh.execute-api.ap-northeast-1.amazonaws.com/dev/create-ugc



## 修正した後のデプロイ

```
# キャッシュとnode_modulesをクリア
rm -rf node_modules
rm -rf .serverless
rm package-lock.json

# 依存関係を再インストール
npm install

# デプロイ
serverless deploy --verbose --aws-profile serverless-lambda-user
```
