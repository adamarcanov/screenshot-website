const fs = require('fs');
const { join } = require('path');

const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
const xml2js = require('xml2js');
const colors = require('colors');

function urlToSlug(url) {
    return url
        .replace(/^https?:\/\//, '')  // Remove protocol
        .replace(/[.]/g, '-')  // change dots to hyphens
        .replace(/\/$/, '')  // Remove trailing slash
        .replace(/[\/:]/g, '-')  // Replace slashes and colons with hyphens
        .replace(/[^\w\-]+/g, '')  // Remove non-alphanumeric characters (excluding hyphens)
        .toLowerCase();  // Convert to lowercase
}

// Function to fetch and parse sitemap
async function fetchSitemap(url) {
    const links = [];

    const response = await axios.get(url);
    const contentType = response.headers['content-type'];

    try {
        if ( contentType.includes('text/html') ) {
            const html = response.data;

            const $ = cheerio.load(html);

            // Extract all links from the page
            $('a').each((index, element) => {
                let link = $(element).attr('href');
                if ( link && link.indexOf('/') === 0 ) {
                    link = url + link.substring(1);
                }
                if (link) links.push(link);
            });

        } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
            const sitemapXml = response.data;

            xml2js.parseString(sitemapXml, (err, result) => {
                if (err) throw err;

                // Extract URLs from the sitemap
                const urls = result.urlset.url.map(entry => entry.loc[0]);

                // Print the URLs
                urls.forEach( link => {
                    if ( link && link.indexOf('/') === 0 ) {
                        link = url + link.substring(1);
                    }
                    if (link) links.push(link);
                });
            });
            
        } else {
            console.log('Unknown content type.');
        }
    } catch (error) {
        console.error('Error fetching the content:', error);
    }
    
    return links;
}

// Function to scroll the page to the bottom and back to the top
async function scrollPageToBottomAndBack(page) {
    await page.evaluate( async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;

            const scrollDownInterval = setInterval(() => {
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= document.body.scrollHeight) {
                    clearInterval(scrollDownInterval);
                    resolve();
                }
            }, 100);
        });
  
        // Scroll back to top
        window.scrollTo(0, 0);
    });
}

// Function to trigger all images to load
async function triggerAllImagesToLoad(page) {
    await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('img'));
        images.forEach(img => {

            const newImg = new Image();
            newImg.src = img.src;

            // force reload images with async decoding
            // if (img.getAttribute('decoding') === 'async') {
            //     const newImg = new Image();
            //     newImg.src = img.src;
            // }
        });
    });
}

// Function to capture a screenshot of a given URL
async function captureScreenshot(url, browser, index) {
    const page = await browser.newPage();
    await page.setViewport({
        width: 1500,
        height: 900
    });

    await page.goto(url, { waitUntil: 'load' });

    // Trigger all images to load
    await triggerAllImagesToLoad(page);

    // Scroll to the bottom of the page to load all lazy-load images and back to the top
    await scrollPageToBottomAndBack(page);

    // Wait for 1 second to ensure all animations complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Ensure the directory exists
    const screenshotsDir = join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir);
    }

    const screenshotPath = join(screenshotsDir, `${urlToSlug(url)}.png`);
    // await page.screenshot({ path: screenshotPath });
    await page.screenshot({ path: screenshotPath, fullPage: true });
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
            console.error('Failed to capture screenshot'.red + ` of ${link} => ${error.message}`);
        }
    }

    await browser.close();
    console.log('All screenshots captured.');
})();
