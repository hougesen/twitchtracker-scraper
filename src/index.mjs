import fs from 'fs';
import ObjectsToCsv from 'objects-to-csv';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import enabledLanguages from './enabled_languages.mjs';

// Comes with a lot of build in features that makes it harder to detect us
puppeteer.use(StealthPlugin());

// Minimizes page load times
puppeteer.use(AdblockerPlugin());

// Max amount of pages (Will return early if we reach last page)
const MAX_PAGES = 5;

console.log('Enabled languages: ', enabledLanguages);
console.log('Max pages each language: ', MAX_PAGES);

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

  for (const currentLanguage of enabledLanguages) {
    const languageData = [];

    for (let pageNumber = 1; pageNumber < MAX_PAGES + 1; ++pageNumber) {
      console.log('currentLanguage', currentLanguage, 'pageNumber', pageNumber);

      console.time(`language ${currentLanguage || 'overall'} page ${pageNumber}`);
      let currentUrl = `https://twitchtracker.com/channels/viewership/${currentLanguage || ''}?page=${pageNumber}`;

      await page.goto(currentUrl);

      try {
        await page.waitForSelector('#channels > tbody', { timeout: 25000 });
      } catch (error) {
        console.error(
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
            const hoursStreamed = td[4]?.outerText?.replace(',', '')?.split('\n');

            const followers = td[9]?.outerText;
            let followerMultiplier = 1;

            if (followers?.toLowerCase()?.includes('m')) {
              followerMultiplier = 1_000_000;
            } else if (followers?.toLowerCase()?.includes('k')) {
              followerMultiplier = 1_000;
            }

            return {
              handle: td[2]?.outerText?.toLowerCase() || null,
              average_viewers: parseFloat(td[3]?.outerText?.replace(',', '') ?? 0) ?? 0,
              hours_streamed: hoursStreamed?.length ? parseFloat(hoursStreamed[0]?.trim() ?? 0) : 0,
              total_followers: td[9]?.outerText ? parseFloat(followers) * followerMultiplier : 0,
              twitch_link: td[2]?.outerText ? `https://twitch.tv/${td[2]?.outerText?.toLowerCase()}` : '',
            };
          })
          .filter((elm) => elm?.handle !== null);
      });

      languageData.push(...pageData);
    }

    // Make sure data folder exists
    if (!fs.existsSync(`./data`)) {
      fs.mkdirSync(`./data`);
    }

    // Save data as json
    const csv = new ObjectsToCsv(languageData);
    await csv.toDisk(`./data/${currentLanguage || 'overall'}-${new Date().toISOString()}.csv`);

    console.log(`Done saving ${currentLanguage || 'overall'} as csv`);
  }

  await browser.close();

  console.timeEnd('total');
})();
