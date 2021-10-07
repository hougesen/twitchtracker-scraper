const fs = require('fs');
const ObjectsToCsv = require('objects-to-csv');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');

// Comes with a lot of build in features that makes it harder to detect us
puppeteer.use(StealthPlugin());

// Minimizes page load times
puppeteer.use(AdblockerPlugin());

// Language to scrape
const LANGUAGE = 'german';

// Max amount of pages (Will return early if we reach last page)
const MAX_PAGES = 5;

const allData = [];

(async () => {
  console.time('total');
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 250,
    defaultViewport: null,
  });

  const page = await browser.newPage();

  // Twitch tracker hides fields on small screens
  await page.setViewport({ width: 1920, height: 1080 });

  for (let pageNumber = 1; pageNumber < MAX_PAGES + 1; ++pageNumber) {
    console.time(`page ${pageNumber}`);
    let currentUrl = `https://twitchtracker.com/channels/viewership/${LANGUAGE || ''}?page=${pageNumber}`;

    await page.goto(currentUrl);

    try {
      await page.waitForSelector('#channels > tbody', { timeout: 25000 });
    } catch (error) {
      console.log(
        `The table on page ${pageNumber} didn't seem to render correctly. We might be getting capcha blocked.`,
        error,
      );
      continue;
    }

    const amountPerPage = await page.$eval('#channels > tbody', (table) => table?.rows?.length);

    if (amountPerPage === 0) {
      break;
    }

    const pageData = await page.evaluate(() => {
      return Array.prototype.slice
        .call(document.querySelector('#channels > tbody').rows)
        .map((tr) => Array.prototype.slice.call(tr.cells))
        .map((td) => {
          return {
            handle: td[2]?.outerText?.toLowerCase() || null,
            average_viewers: td[3]?.outerText || null,
            total_followers: td[9]?.outerText || null,
            twitch_link: td[2]?.outerText ? `https://twitch.tv/${td[2]?.outerText?.toLowerCase()}` : null,
          };
        })
        .filter((elm) => elm?.handle !== null);
    });

    allData.push(...pageData);

    console.log(allData);
  }

  await browser.close();

  // Make sure data folder exists
  if (!fs.existsSync(`./data`)) {
    fs.mkdirSync(`./data`);
  }

  // Make sure language folder exists
  if (!fs.existsSync(`./data/${LANGUAGE || 'all'}`)) {
    fs.mkdirSync(`./data/${LANGUAGE || 'all'}`);
  }

  // Save data as json
  const csv = new ObjectsToCsv(allData);
  await csv.toDisk(`./data/${LANGUAGE || 'all'}/${LANGUAGE || 'all'}-${new Date().toISOString()}.csv`);
  console.log('Done saving as csv');

  console.timeEnd('total');
})();
