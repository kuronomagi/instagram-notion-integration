const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const { Client } = require('@notionhq/client');
const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer');
const axios = require('axios'); // 画像ダウンロード用に追加
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// 画像をNotionにアップロードする関数
async function uploadImageToNotion(imageUrl) {
  try {
    // 画像をダウンロード
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer'
    });

    // Content-Typeを取得
    const contentType = response.headers['content-type'];

    // NotionのファイルアップロードAPIを呼び出し
    const uploadResponse = await notion.files.create({
      file: {
        name: `instagram_image_${Date.now()}.${contentType.split('/')[1]}`,
        type: contentType,
        content: response.data
      }
    });

    return uploadResponse;
  } catch (error) {
    console.error('Error uploading image to Notion:', error);
    throw error;
  }
}

// Instagram投稿をスクレイピングする関数
async function scrapeInstagramPost(postUrl) {
  let browser = null;

  try {
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
      const images = [];

      // カルーセル（複数画像）の場合
      const carouselItems = document.querySelectorAll('article [role="presentation"] [role="button"] img');
      if (carouselItems.length > 0) {
        carouselItems.forEach(img => {
          if (img.srcset) {
            const srcsetItems = img.srcset.split(',');
            const highestQualityImage = srcsetItems[srcsetItems.length - 1].trim().split(' ')[0];
            images.push(highestQualityImage);
          } else {
            images.push(img.src);
          }
        });
      }

      // 単一画像の場合のフォールバック
      if (images.length === 0) {
        const singleImage = document.querySelector('article img');
        if (singleImage) {
          if (singleImage.srcset) {
            const srcsetItems = singleImage.srcset.split(',');
            const highestQualityImage = srcsetItems[srcsetItems.length - 1].trim().split(' ')[0];
            images.push(highestQualityImage);
          } else {
            images.push(singleImage.src);
          }
        }
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
    });

    const username = extractUsername(postUrl);

    const hashtagPattern = /[#＃]([^#＃\s]+)/g;
    const tags = [];
    let cleanContent = postData.content;

    let match;
    while ((match = hashtagPattern.exec(postData.content)) !== null) {
      tags.push(match[1]);
    }

    cleanContent = postData.content
      .replace(/[#＃][^#＃\s]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      ...postData,
      content: cleanContent,
      title: cleanContent.slice(0, 20) || '',
      username,
      postUrl,
      userUrl: `https://instagram.com/${username}`,
      tags: [...new Set(tags)]
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

    // 画像をNotionにアップロード
    const uploadedImages = [];
    for (const imageUrl of postData.images) {
      const uploadedImage = await uploadImageToNotion(imageUrl);
      uploadedImages.push(uploadedImage);
    }

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
        Images: {
          files: uploadedImages.map(image => ({
            name: image.name,
            type: "file",
            file: {
              url: image.url,
              expiry_time: image.expiry_time
            }
          }))
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

    const postData = await scrapeInstagramPost(postUrl);
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
