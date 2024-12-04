// handler.js
const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const { Client } = require('@notionhq/client');
const chromium = require('chrome-aws-lambda');
// const puppeteer = require('puppeteer-core');
const puppeteer = require('puppeteer'); // ローカル開発用にpuppeteerを使用
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// Instagram投稿をスクレイピングする関数
async function scrapeInstagramPost(postUrl) {
  let browser = null;

  try {
    // URLからユーザー名を抽出する関数
    const extractUsername = (url) => {
      const matches = url.match(/instagram\.com\/([^\/]+)\/p\//);
      return matches ? matches[1] : '';
    };

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    console.log('Navigating to:', postUrl);
    await page.goto(postUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    const postData = await page.evaluate(() => {
      const imageElement = document.querySelector('article img');
      const imageUrl = imageElement ? imageElement.src : null;

      const articleElement = document.querySelector('article');
      const textElement = articleElement ? articleElement.querySelector('h1') : null;
      const postText = textElement ? textElement.textContent : '';

      const timeElement = document.querySelector('time');
      const postedAt = timeElement ? timeElement.dateTime : '';

      return {
        image: imageUrl,
        content: postText,
        postedAt,
      };
    });

    // URLからユーザー名を抽出
    const username = extractUsername(postUrl);

    // タグの抽出とコンテンツの整理
    const { content } = postData;
    const hashtagPattern = /[#＃]([^#＃\s]+)/g;
    const tags = [];
    let cleanContent = content;

    // タグの抽出
    let match;
    while ((match = hashtagPattern.exec(content)) !== null) {
      tags.push(match[1]);
    }

    // コンテンツからハッシュタグを削除
    cleanContent = content
      .replace(/[#＃][^#＃\s]+/g, '') // ハッシュタグを削除
      .replace(/\s+/g, ' ')           // 複数の空白を1つに
      .trim();                        // 前後の空白を削除

    return {
      ...postData,
      content: cleanContent,
      title: cleanContent.slice(0, 15) || '',
      username,
      postUrl,
      userUrl: `https://instagram.com/${username}/`,
      tags: [...new Set(tags)] // 重複を除去
    };

  } catch (error) {
    console.error('Error details:', error);
    throw new Error('Failed to scrape Instagram post data: ' + error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Notionデータベースに投稿を保存する関数
async function saveToNotion(postData) {
  try {
    console.log('Saving to Notion:', postData);

    await notion.pages.create({
      parent: {
        database_id: process.env.NOTION_DATABASE_ID,
      },
      properties: {
        Title: {
          title: [
            {
              text: {
                content: postData.title || 'Untitled',
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
        Image: {
          rich_text: [
            {
              text: {
                content: postData.image || '',
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
          rich_text: [
            {
              text: {
                content: postData.postUrl || '',
              },
            },
          ],
        },
        UserURL: {
          rich_text: [
            {
              text: {
                content: postData.userUrl || '',
              },
            },
          ],
        },
        Tags: {
          multi_select: (postData.tags || []).map(tag => ({ name: tag })),
        },
      },
    });
  } catch (error) {
    console.error('Error saving to Notion:', error);
    throw new Error('Failed to save data to Notion: ' + error.message);
  }
}

app.post('/create-ugc', async (req, res) => {
  try {
    const { postUrl } = req.body;

    console.log('post URL:', postUrl)

    if (!postUrl) {
      return res.status(400).json({ error: 'Post URL is required' });
    }

    // Instagram投稿をスクレイピング
    const postData = await scrapeInstagramPost(postUrl);

    // Notionデータベースに保存
    await saveToNotion(postData);

    res.json({
      message: 'Successfully created UGC entry',
      data: postData
    });
  } catch (error) {
    console.error('Error in create-ugc:', error);
    res.status(500).json({
      error: 'Failed to process request',
      message: error.message
    });
  }
});

module.exports.createUGC = serverless(app);
