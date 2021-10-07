# twitchtracker-scraper

Used for scraping top channels on [TwitchTracker](https://twitchtracker.com/) based on average viewers last 30 days. The scraped data is then saved as a csv file in the ./data folder.

## Usage

Make sure you have node & npm setup.

After setting up node, install the dependencies.

```bash
$ npm install

```

By setting the LANGUAGE variable in [./src/index.js](./src/index.js) you can specific the language you wish to scrape, otherwise it will scrape all languages.

By setting the MAX_PAGES you can specific how many pages you wish to scrape (TwitchTracker has 50 handles for each page as of 07/10/2021). BEWARE: the higher the amount of pages to scrape, the higher the chance of blocked is.

Start the scraper by running the following:

```bash
$ npm run start

```

After the scraper is done it will save the data as a .csv file in the ./data/${LANGUAGE} folder.
