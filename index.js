const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const { join } = require('path');

function urlToSlug(url) {
    let slug = url.toLowerCase();
    
    // Remove special characters, keep only alphanumeric and spaces
    slug = slug.replace(/[^a-z0-9\s-]/g, '');
    
    // Replace spaces and consecutive hyphens with single hyphens
    slug = slug.replace(/\s+/g, '-').replace(/-+/g, '-');
    
    // Remove leading and trailing hyphens
    slug = slug.replace(/^-+|-+$/g, '');
    
    return slug;
}

// Function to fetch and parse sitemap
async function fetchSitemap(url) {
    const response = await axios.get( join( url, '/sitemap/' ) );
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Extract all links from the page
    const links = [];
    $('a').each((index, element) => {
        let link = $(element).attr('href');
        if ( link && link.indexOf('/') === 0 ) {
            link = url + link.substring(1);
        }
        if (link) links.push(link);
    });
    
    return links;
}

// Function to capture a screenshot of a given URL
async function captureScreenshot(url, browser, index) {
    const page = await browser.newPage();
    await page.setViewport({
        width: 1500,
        height: 900
    });

    await page.goto(url, { waitUntil: 'load' });

    // Wait for 2 seconds to ensure all animations complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Ensure the directory exists
    const screenshotsDir = join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir);
    }

    const screenshotPath = join(screenshotsDir, `${urlToSlug(url)}.png`);
    await page.screenshot({ path: screenshotPath });
    // await page.screenshot({ path: screenshotPath, fullPage: true });
    await page.close();
}

// Main function to execute the script
(async () => {
    let url;
    
    process.argv.forEach((val, index) => {
        if ( val.indexOf('--url=') > -1 ) {
            url = val.split('=')[1];
        }
    });

    if ( !url ) {
        console.log('Please provide a sitemap url');
        return;
    }

    const links = await fetchSitemap(url);
    const browser = await puppeteer.launch();

    for (let i = 0; i < links.length; i++) {
        const link = links[i];
        try {
            console.log(`Capturing screenshot of ${link}`);
            await captureScreenshot(link, browser, i);
        } catch (error) {
            console.error(`Failed to capture screenshot of ${link}: ${error.message}`);
        }
    }

    await browser.close();
    console.log('All screenshots captured.');
})();
