# MEMO
## 24/12/05
Lambda関数にここで作成したLayerを追加しなくても、chromiumが起動しスクレイピングできました。


# chrome-layerの作成手順

```
npm install

# レイヤー構造の作成
mv node_modules nodejs/

# ZIPファイルの作成
zip -r chrome-layer.zip nodejs/

# S3にアップロード
aws s3 cp chrome-layer.zip s3://instagram-notion-integration-for-deployments/layers/chrome-layer.zip --profile serverless-lambda-user
```

```
# 必要なパッケージをインストール
npm init -y
npm install @sparticuz/chromium

# レイヤー用のディレクトリ構造を作成
mkdir -p nodejs/node_modules/@sparticuz
cp -r node_modules/@sparticuz/chromium nodejs/node_modules/@sparticuz/

# レイヤーをZIP化
zip -r chrome-layer.zip nodejs

# S3にアップロード
aws s3 cp chrome-layer.zip s3://instagram-notion-integration-for-deployments/layers/chrome-layer.zip --profile serverless-lambda-user
```


# 1. S3バケットにファイルをアップロード

```
aws s3 cp chrome-layer.zip s3://instagram-notion-integration-for-deployments/layers/chrome-layer.zip --profile serverless-lambda-user

```

# S3からレイヤーを作成

```
aws lambda publish-layer-version \
  --layer-name sparticuz-chrome \
  --description "Chromium for Lambda" \
  --content S3Bucket=instagram-notion-integration-for-deployments,S3Key=layers/chrome-layer.zip \
  --compatible-runtimes nodejs18.x \
  --compatible-architectures x86_64 \
  --region ap-northeast-1 \
  --profile serverless-lambda-user
```
