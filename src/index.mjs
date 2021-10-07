import fs from 'fs';
import ObjectsToCsv from 'objects-to-csv';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import enabledLanguages from './eanabled_languages.mjs';

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
      console.time(`language ${currentLanguage || 'overall'} page ${pageNumber}`);
      let currentUrl = `https://twitchtracker.com/channels/viewership/${currentLanguage || ''}?page=${pageNumber}`;

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
              average_viewers: td[3]?.outerText?.replace(',', '') || null,
              total_followers: td[9]?.outerText ? parseFloat(td[9]?.outerText) * 1000 : null,
              twitch_link: td[2]?.outerText ? `https://twitch.tv/${td[2]?.outerText?.toLowerCase()}` : null,
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
