const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const { Client } = require('@notionhq/client');
const chromium = require('chrome-aws-lambda');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

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

async function scrapeInstagramPost(postUrl) {
  let browser = null;

  try {
    const extractUsername = (url) => {
      const matches = url.match(/instagram\.com\/([^\/]+)\/p\//);
      return matches ? matches[1] : '';
    };

    // Lambda用のPuppeteer設定
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // タイムアウトを設定
    await page.setDefaultNavigationTimeout(20000);
    await page.setDefaultTimeout(20000);

    console.log('Navigating to:', postUrl);
    await page.goto(postUrl, {
      waitUntil: 'networkidle0',
      timeout: 20000
    });

    const postData = await page.evaluate(() => {
      const images = [];

      // const imageElement = document.querySelector('article img');
      // const imageUrl = imageElement ? imageElement.src : null;
      const singleImage = document.querySelector('article img');

        if (singleImage) {
          images.push(singleImage.src);
          // if (singleImage.srcset) {
          //   const srcsetItems = singleImage.srcset.split(',');
          //   const highestQualityImage = srcsetItems[srcsetItems.length - 1].trim().split(' ')[0];
          //   images.push(highestQualityImage);
          // } else {
          //   images.push(singleImage.src);
          // }
        }

      // // カルーセル（複数画像）の場合
      // const carouselItems = document.querySelectorAll('article [role="presentation"] [role="button"] img');
      // if (carouselItems.length > 0) {
      //   carouselItems.forEach(img => {
      //     if (img.srcset) {
      //       const srcsetItems = img.srcset.split(',');
      //       const highestQualityImage = srcsetItems[srcsetItems.length - 1].trim().split(' ')[0];
      //       images.push(highestQualityImage);
      //     } else {
      //       images.push(img.src);
      //     }
      //   });
      // }

      // // 単一画像の場合のフォールバック
      // if (images.length === 0) {
      //   const singleImage = document.querySelector('article img');
      //   if (singleImage) {
      //     if (singleImage.srcset) {
      //       const srcsetItems = singleImage.srcset.split(',');
      //       const highestQualityImage = srcsetItems[srcsetItems.length - 1].trim().split(' ')[0];
      //       images.push(highestQualityImage);
      //     } else {
      //       images.push(singleImage.src);
      //     }
      //   }
      // }

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
    let cleanContent = postData.content || '';

    let match;
    while ((match = hashtagPattern.exec(cleanContent)) !== null) {
      tags.push(match[1]);
    }

    cleanContent = cleanContent
      .replace(/[#＃][^#＃\s]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      ...postData,
      content: cleanContent,
      title: cleanContent.slice(0, 15) || 'Untitled Instagram Post',
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

async function saveToNotion(postData) {
  try {
    console.log('Saving to Notion:', postData);

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
    };

    const response = await notion.pages.create(pageData);
    const pageId = response.id;

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

module.exports.createUGC = serverless(app);
