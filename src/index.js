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

    for (let handleNumber = 1; handleNumber < amountPerPage; ++handleNumber) {
      console.time(`streamer page ${pageNumber} number ${handleNumber}`);

      const streamer = {
        handle: null,
        language: LANGUAGE || '',
        average_viewers: null,
        total_followers: null,
        twitch_link: null,
      };

      // Twitch tracker has tr in their table without data in them, so we need to make sure they exists before setting the data on each eval
      try {
        streamer.handle = await page.$eval(
          `#channels > tbody > tr:nth-child(${handleNumber}) > td:nth-child(3) > a`,
          (el) => el?.innerText?.toLowerCase(),
        );
      } catch (error) {
        console.log('error getting handle', error);
        continue;
      }

      if (!streamer?.handle?.length > 0) {
        console.log('streamer handle length is 0 OR null');
      }

      streamer.twitch_link = `https://twitch.tv/${streamer.handle}`;

      try {
        streamer.average_viewers = await page.$eval(
          `#channels > tbody > tr:nth-child(${handleNumber}) > td.color-viewers.active > span`,
          (el) => el.innerText.toLowerCase(),
        );
      } catch (error) {
        console.log('error getting avg viewers', error);
        continue;
      }

      try {
        streamer.total_followers = await page.$eval(
          `#channels > tbody > tr:nth-child(${handleNumber}) > td:nth-child(10) > span`,

          (el) => el.innerText.toLowerCase(),
        );
      } catch (error) {
        console.log('error getting total followers', error);
        continue;
      }

      allData.push(streamer);

      console.timeEnd(`streamer page ${pageNumber} number ${handleNumber}`);
    }

    console.timeEnd(`page ${pageNumber}`);
  }

  for (const streamer of allData) {
    // If total_followers is higher than 1000 TwitchTracker shortens it with a K
    if (streamer.total_followers.toLowerCase().includes('k')) {
      streamer.total_followers = parseFloat(streamer.total_followers) * 1000;
    }

    // TwitchTracker uses commas to seperate values
    streamer.average_viewers = streamer.average_viewers.replaceAll(',', '');
  }

  // Make sure data folder exists
  if (!fs.existsSync(`./data`)) {
    fs.mkdirSync(`./data`);
  }

  if (!fs.existsSync(`./data/${LANGUAGE || 'all'}`)) {
    fs.mkdirSync(`./data/${LANGUAGE || 'all'}`);
  }

  await browser.close();

  // Save data as json
  const csv = new ObjectsToCsv(allData);
  await csv.toDisk(`./data/${LANGUAGE || 'all'}/${LANGUAGE || 'all'}-${new Date().toISOString()}.csv`);
  console.log('Done saving as csv');

  console.time('total');
})();
