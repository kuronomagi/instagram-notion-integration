const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const { Client } = require('@notionhq/client');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const fs = require('fs');
require('dotenv').config();

// const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

async function listDirectoryContents(path) {
  try {
    const items = fs.readdirSync(path);
    console.log(`Contents of ${path}:`, items);
    return items;
  } catch (error) {
    console.log(`Error reading ${path}:`, error.message);
    return [];
  }
}

async function uploadImageToNotion(pageId, imageUrl) {
  try {
    await notion.blocks.children.append({
      block_id: pageId,
      children: [
        {
          type: "image",
          image: {
            type: "external",
            external: {
              url: imageUrl
            }
          }
        }
      ]
    });

    return imageUrl;
  } catch (error) {
    console.error('Error uploading image to Notion:', error);
    throw error;
  }
}

// ブラウザインスタンスを取得するための関数
async function getBrowser() {
  const chromiumCachePath = '/tmp/chromium';
  process.env.CHROME_USER_DATA_DIR = chromiumCachePath;

  console.log('Starting browser launch process...');

  const executablePath = await chromium.executablePath()
  console.log('Chromium executable path:', executablePath);

  // executablePathが存在するか確認
  if (fs.existsSync(executablePath)) {
    console.log('Chromium executable exists');
  } else {
    console.log('Chromium executable does not exist');
  }

  const options = {
    args: [
      ...chromium.args,
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--no-zygote',
      '--disable-web-security',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-nss-db',
      '--disable-notifications',
      '--disable-webgl',
      '--disable-threaded-scrolling',
      '--disable-dev-profile',
      '--disable-extensions',
      '--disable-audio-output',
      '--disable-nss-http',               // 新規追加
      '--disable-sync',                   // 新規追加
      '--disable-background-networking',  // 新規追加
      '--disable-default-apps',          // 新規追加
      '--disable-client-side-phishing-detection', // 新規追加
      '--disable-component-extensions-with-background-pages', // 新規追加
      `--disable-gl-extensions`,         // 新規追加
      '--in-process-gpu',                // 新規追加
      '--use-gl=swiftshader'            // 新規追加
    ],
    defaultViewport: {
      width: 507,
      height: 384,
      deviceScaleFactor: 1,
    },
    executablePath: executablePath,
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
    dumpio: true,  // ブラウザのコンソール出力を取得
  };

  for (let i = 0; i < 3; i++) {  // 3回まで再試行
    try {
      const browser = await puppeteer.launch(options);

      // ブラウザが正常に起動したか確認
      const pages = await browser.pages();
      if (pages.length > 0) {
        console.log('Browser launched successfully with', pages.length, 'pages');
        return browser;
      }

      await browser.close();
    } catch (e) {
      console.error(`Browser launch attempt ${i + 1} failed:`, e);
      if (i === 2) throw e;  // 最後の試行で失敗した場合はエラーを投げる
    }
  }
}

async function setupBrowser() {
  const options = {
    args: [
      ...chromium.args,
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--no-zygote',
      '--no-first-run',
      '--disable-extensions',
      '--disable-audio-output',     // 追加
      '--disable-background-timer-throttling', // 追加
      '--disable-background-networking',      // 追加
      '--disable-breakpad',                   // 追加
      '--disable-component-extensions-with-background-pages', // 追加
      '--disable-default-apps'
    ],
    defaultViewport: {
      width: 507,
      height: 384,
      deviceScaleFactor: 1,
    },
    executablePath:  await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
    dumpio: true,  // ブラウザのコンソール出力を取得
    env: {
      ...process.env,
      HOME: '/tmp'  // 追加: HOMEディレクトリを/tmpに設定
    }
  };

  const browser = await puppeteer.launch(options);

  // プロセスの終了を監視
  browser.process().on('exit', (code) => {
    console.log(`Chrome process exited with code ${code}`);
  });

  return browser;
}

async function scrapeInstagramPost(postUrl) {
  let browser = null;
  let page = null;

  try {
    browser = await setupBrowser();
    console.log('Browser setup completed');

    // 新しいページを作成する前に少し待機
    await new Promise(resolve => setTimeout(resolve, 1000));

    page = await browser.newPage();
    console.log('New page created');

    // NSSデータベースディレクトリを作成
    const nssPath = '/tmp/.pki/nssdb';
    try {
      fs.mkdirSync('/tmp/.pki', { recursive: true });
      fs.mkdirSync(nssPath, { recursive: true });
      console.log('NSS directory created:', nssPath);
    } catch (err) {
      console.log('Error creating NSS directory:', err);
    }

    const chromiumCachePath = '/tmp/chromium';
    process.env.CHROME_USER_DATA_DIR = chromiumCachePath;

    console.log('Starting browser launch process...');

    const executablePath = await chromium.executablePath()
    console.log('Chromium executable path:', executablePath);

    // executablePathが存在するか確認
    if (fs.existsSync(executablePath)) {
      console.log('Chromium executable exists');
    } else {
      console.log('Chromium executable does not exist');
    }

    const options = {
      args: [
        ...chromium.args,
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--no-zygote',
        '--no-first-run',
        '--disable-extensions',
        '--disable-audio-output',     // 追加
        '--disable-background-timer-throttling', // 追加
        '--disable-background-networking',      // 追加
        '--disable-breakpad',                   // 追加
        '--disable-component-extensions-with-background-pages', // 追加
        '--disable-default-apps'
      ],
      defaultViewport: {
        width: 507,
        height: 384,
        deviceScaleFactor: 1,
      },
      executablePath:  await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
      dumpio: true,  // ブラウザのコンソール出力を取得
      env: {
        ...process.env,
        HOME: '/tmp'  // 追加: HOMEディレクトリを/tmpに設定
      }
    };

    console.log('Browser launch options:', JSON.stringify(options, null, 2));

    try {
      // browser = await puppeteer.launch(options);
      browser = await getBrowser();
      console.log('Browser launched successfully');
    } catch (browserError) {
      console.error('Browser launch failed:', browserError);
      throw browserError;
    }

    try {
      page = await browser.newPage();
      console.log('New page created successfully');
    } catch (pageError) {
      console.error('Page creation failed:', pageError);
      throw pageError;
    }

    // ページの設定
    await page.setDefaultNavigationTimeout(30000);
    await page.setDefaultTimeout(30000);

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    // メモリ使用量を削減するための設定を追加
    await page.setCacheEnabled(false);
    await Promise.all([
      page.coverage.startJSCoverage(),
      page.coverage.startCSSCoverage()
    ]);

    // Instagram のブロッキングを回避するため、リクエストインターセプトを調整します
    await page.setRequestInterception(true);

    page.on('request', request => {
      const type = request.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // ナビゲーション前にページの状態を確認
    console.log('Pre-navigation browser status check');
    const pages = await browser.pages();
    console.log(`Active pages: ${pages.length}`);

    console.log('Attempting navigation to:', postUrl);
    await page.goto(postUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });


    // エラーハンドリングを追加
    page.on('error', err => {
      console.error('Page error:', err);
    });

    browser.on('disconnected', () => {
      console.log('Browser has been disconnected');
    });

    // タイムアウトを設定
    const timeoutDuration = 30000;

    console.log('Navigating to:', postUrl);

    // ナビゲーションを待機
    const response = await page.goto(postUrl, {
      waitUntil: ['domcontentloaded', 'networkidle0'],
      timeout: timeoutDuration
    });

    if (!response.ok()) {
      throw new Error(`Failed to load page: ${response.status()} ${response.statusText()}`);
    }

    // ページの読み込みを待機
    await page.waitForSelector('article', { timeout: timeoutDuration });
    console.log('Article element found');

    // メモリ使用量をログ出力
    const metrics = await page.metrics();
    console.log('Page metrics:', metrics);

    // データを抽出
    const postData = await Promise.race([
      page.evaluate(() => {
        const images = [];
        const singleImage = document.querySelector('article img');
        if (singleImage) {
          images.push(singleImage.src);
        }

        const articleElement = document.querySelector('article');
        const textElement = articleElement ? articleElement.querySelector('h1') : null;
        const postText = textElement ? textElement.textContent : '';

        const timeElement = document.querySelector('time');
        const postedAt = timeElement ? timeElement.dateTime : '';

        return {
          images,
          content: postText,
          postedAt,
        };
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Data extraction timed out')), timeoutDuration)
      )
    ]);

    console.log('Data extracted successfully');

    // ユーザー名を抽出
    const username = postUrl.match(/instagram\.com\/([^\/]+)\/p\//)?.[1] || '';
    const hashtagPattern = /[#＃]([^#＃\s]+)/g;
    const tags = [];
    let cleanContent = postData.content || '';

    let match;
    while ((match = hashtagPattern.exec(cleanContent)) !== null) {
      tags.push(match[1]);
    }

    cleanContent = cleanContent
      .replace(/[#＃][^#＃\s]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const result = {
      ...postData,
      content: cleanContent,
      title: cleanContent.slice(0, 15) || 'Untitled Instagram Post',
      username,
      postUrl,
      userUrl: `https://instagram.com/${username}`,
      tags: [...new Set(tags)]
    };

    console.log('Processing completed successfully');
    return result;

  } catch (error) {
    console.error('Scraping error:', error);
    if (page) {
      try {
        const metrics = await page.metrics();
        console.log('Page metrics at error:', metrics);

        const processes = await browser.process().pid;
        console.log('Browser process ID:', processes);
      } catch (e) {
        console.error('Error getting debug info:', e);
      }
    }

    throw new Error('Failed to scrape Instagram post data: ' + error.message);

  } finally {
    if (page) {
      try {
        await page.close();
        console.log('Page closed successfully');
      } catch (e) {
        console.error('Error closing page:', e);
      }
    }
    if (browser) {
      try {
        await browser.close();
        console.log('Browser closed successfully');
      } catch (e) {
        console.error('Error closing browser:', e);
      }
    }
  }
}

async function saveToNotion(postData) {
  try {
    console.log('Saving to Notion:', postData);

    // データの存在確認
    if (!postData || typeof postData !== 'object') {
      throw new Error('Invalid postData: ' + JSON.stringify(postData));
    }

    const pageData = {
      parent: {
        database_id: process.env.NOTION_DATABASE_ID,
      },
      properties: {
        Title: {
          title: [
            {
              text: {
                content: postData.title || 'Untitled Instagram Post',
              },
            },
          ],
        },
        Content: {
          rich_text: [
            {
              text: {
                content: (postData.content || '').substring(0, 2000),
              },
            },
          ],
        },
        Username: {
          rich_text: [
            {
              text: {
                content: postData.username || '',
              },
            },
          ],
        },
        PostedAt: {
          date: {
            start: postData.postedAt || new Date().toISOString(),
          },
        },
        PostURL: {
          url: postData.postUrl || '',
        },
        UserURL: {
          url: postData.userUrl || '',
        },
        Tags: {
          multi_select: (postData.tags || []).map(tag => ({ name: tag })),
        },
      },
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: postData.content || ''
                }
              }
            ]
          }
        }
      ]
    };

    console.log('Notion page data:', pageData);

    const response = await notion.pages.create(pageData);
    const pageId = response.id;

    // 画像が存在する場合のみアップロード
    if (postData.images && Array.isArray(postData.images)) {
      for (const imageUrl of postData.images) {
        await uploadImageToNotion(pageId, imageUrl);
      }
    }

    return response;
  } catch (error) {
    console.error('Error saving to Notion:', error);
    throw new Error('Failed to save data to Notion: ' + error.message);
  }
}

app.post('/create-ugc', async (req, res) => {
  try {
    const { postUrl } = req.body;
    console.log('Processing Instagram URL:', postUrl);

    if (!postUrl) {
      return res.status(400).json({ error: 'Post URL is required' });
    }

    const postData = await scrapeInstagramPost(postUrl);
    console.log('Scraped data:', postData);

    const notionResponse = await saveToNotion(postData);

    res.json({
      message: 'Successfully created UGC entry',
      data: postData,
      notionPageId: notionResponse.id
    });
  } catch (error) {
    console.error('Error in create-ugc:', error);
    res.status(500).json({
      error: 'Failed to process request',
      message: error.message
    });
  }
});

// module.exports.createUGC = serverless(app);

const handler = serverless(app);

exports.createUGC = async (event, context) => {
  try {
    process.env.HOME = '/tmp';
    process.env.CHROME_AWS_LAMBDA_CACHE_DIR = '/tmp';
    process.env.SSL_CERT_DIR = '/tmp';
    process.env.SSL_CERT_FILE = '/tmp/dummy.pem';
    process.env.NSS_DB_DIR = '/tmp/.pki/nssdb';
    process.env.NSS_DEFAULT_DB_TYPE = 'sql';

    // ダミーの証明書ファイルを作成
    fs.writeFileSync('/tmp/dummy.pem', '');

    // 必要なディレクトリを作成
    const dirs = [
      '/tmp/.pki',
      '/tmp/.pki/nssdb',
      '/tmp/chrome-user-data',
      '/tmp/chrome-crashes'
    ];

    for (const dir of dirs) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        // ディレクトリのパーミッションを設定
        fs.chmodSync(dir, 0o755);
      } catch (err) {
        console.log(`Error creating directory ${dir}:`, err);
      }
    }

    // Chromiumのキャッシュディレクトリを設定
    process.env.CHROME_AWS_LAMBDA_CACHE_DIR = '/tmp';
    process.env.HOME = '/tmp';  // HOMEディレクトリを設定

    const result = await handler(event, context);
    return result;
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

// エクスポート方法を修正
// exports.createUGC = async (event, context) => {
//   try {
//     // Chromiumのキャッシュディレクトリを設定
//     process.env.CHROME_AWS_LAMBDA_CACHE_DIR = '/tmp';
//     const result = await handler(event, context);
//     return result;
//   } catch (error) {
//     console.error('Handler error:', error);
//     return {
//       statusCode: 500,
//       body: JSON.stringify({
//         error: 'Internal server error',
//         message: error.message
//       })
//     };
//   }
// };
