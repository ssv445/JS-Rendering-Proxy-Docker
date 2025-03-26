import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import pLimit from 'p-limit';

const MAX_URLS_TO_CRAWL = 500; // Limit total URLs to crawl
const MAX_CONCURRENT_REQUESTS = 10; // Adjust this value for concurrency


// Configure axios to use proxy
const axiosProxyInstance = axios.create({
    proxy: {
        host: 'localhost',
        port: 3000,
        protocol: 'http',
    },
    // Still don't throw on non-200
    validateStatus: () => true,
    timeout: 30000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
        'x-api-key': '1234567890',
        'x-page-timeout-ms': '10000',
        // 'x-follow-redirects': 'true'
    }
});

const axiosInstance = axios.create({
    validateStatus: () => true,
    timeout: 30000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
        'x-api-key': '1234567890',
        'x-page-timeout-ms': '10000',
        // 'x-follow-redirects': 'true'
    }
});

const normalizeUrl = (url) => {
    try {
        const parsed = new URL(url);
        // Remove hash
        parsed.hash = '';
        // Remove trailing slash
        let path = parsed.pathname;
        if (path.length > 1 && path.endsWith('/')) {
            parsed.pathname = path.slice(0, -1);
        }
        // Always use https if available
        parsed.protocol = 'https:';
        // Remove www if present
        // if (parsed.hostname.startsWith('www.')) {
        //     parsed.hostname = parsed.hostname.slice(4);
        // }
        return parsed.toString();
    } catch (e) {
        return url;
    }
};

const crawlWebsite = async (startUrl, concurrency = MAX_CONCURRENT_REQUESTS) => {
    const startTime = Date.now();
    const seen = new Set();
    const queue = [normalizeUrl(startUrl)];
    const results = [];
    const limit = pLimit(concurrency);
    const activePromises = new Set();
    const stats = {
        statusCodes: {},
        errors: 0,
        totalUrls: 0,
        successfulUrls: 0,
        timeMs: 0,
        avgResponseTimeMs: 0,
        totalResponseTimeMs: 0,
        skippedUrls: 0
    };

    const isValidUrl = (url) => {
        try {
            const parsedUrl = new URL(url);
            const startUrlDomain = new URL(startUrl).hostname;
            return parsedUrl.hostname === startUrlDomain;
        } catch (e) {
            return false;
        }
    };

    const extractUrls = (html, baseUrl) => {
        const $ = cheerio.load(html);
        const urls = new Set();

        $('a').each((_, element) => {
            const href = $(element).attr('href');
            if (!href) return;

            try {
                const url = normalizeUrl(new URL(href, baseUrl).href);
                if (isValidUrl(url)) {
                    urls.add(url);
                }
            } catch (e) { }
        });

        return Array.from(urls);
    };

    const processSingleUrl = async (url) => {
        const normalizedUrl = normalizeUrl(url);
        if (seen.has(normalizedUrl)) {
            stats.skippedUrls++;
            return;
        }
        seen.add(normalizedUrl);
        stats.totalUrls++;

        const urlStartTime = Date.now();
        try {
            console.log(`Crawling: ${normalizedUrl}`);
            const response = await axiosInstance.get('http://localhost:3000/?render_url=' + normalizedUrl);

            // Track response time
            const responseTime = Date.now() - urlStartTime;
            stats.totalResponseTimeMs += responseTime;

            // Track status codes
            stats.statusCodes[response.status] = (stats.statusCodes[response.status] || 0) + 1;

            if (response.status === 200) {
                stats.successfulUrls++;
                results.push({
                    url: normalizedUrl,
                    status: response.status,
                    title: cheerio.load(response.data)('title').text(),
                    responseTimeMs: responseTime
                });

                const newUrls = extractUrls(response.data, normalizedUrl);
                for (const newUrl of newUrls) {
                    if (!seen.has(newUrl) && queue.length + activePromises.size < MAX_URLS_TO_CRAWL) {
                        queue.push(newUrl);
                    }
                }
            }
        } catch (error) {
            stats.errors++;
            console.error(`Error crawling ${normalizedUrl}:`, error.message);
        }
    };

    while ((queue.length > 0 || activePromises.size > 0) && seen.size < MAX_URLS_TO_CRAWL) {
        // Start new requests if we have URLs in queue and haven't hit concurrency limit
        while (queue.length > 0 && activePromises.size < concurrency) {
            const url = queue.shift();
            const promise = limit(() => processSingleUrl(url));
            activePromises.add(promise);

            // Clean up promise from active set when done
            promise.then(() => {
                activePromises.delete(promise);
            });
        }

        // Wait for at least one promise to complete if we have active promises
        if (activePromises.size > 0) {
            await Promise.race(Array.from(activePromises));
        }
    }

    // Wait for any remaining promises to complete
    await Promise.all(Array.from(activePromises));

    // Calculate final stats
    stats.timeMs = Date.now() - startTime;
    stats.avgResponseTimeMs = Math.round(stats.totalResponseTimeMs / stats.totalUrls);

    return {
        results,
        stats: {
            ...stats,
            successRate: `${Math.round((stats.successfulUrls / stats.totalUrls) * 100)}%`,
            crawlTimeFormatted: `${Math.round(stats.timeMs / 1000)}s`,
            avgResponseTimeFormatted: `${stats.avgResponseTimeMs}ms`
        }
    };
};

// Example usage
const startCrawl = async (website) => {
    const { results, stats } = await crawlWebsite(website, 5);

    console.log('\nCrawl Stats:');
    console.log('============');
    console.log(`Total URLs Found: ${stats.totalUrls + stats.skippedUrls}`);
    console.log(`Unique URLs Crawled: ${stats.totalUrls}`);
    console.log(`Skipped (Duplicate) URLs: ${stats.skippedUrls}`);
    console.log(`Successful URLs: ${stats.successfulUrls} (${stats.successRate})`);
    console.log(`Total Time: ${stats.crawlTimeFormatted}`);
    console.log(`Avg Response Time: ${stats.avgResponseTimeFormatted}`);
    console.log('\nStatus Code Distribution:');
    Object.entries(stats.statusCodes)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .forEach(([code, count]) => {
            console.log(`  ${code}: ${count} URLs`);
        });
    console.log(`\nErrors: ${stats.errors}`);

    // console.log('\nDetailed Results:', JSON.stringify(results, null, 2));
};
//https://www.dietapplements.com/
startCrawl('https://blog.linkody.com').catch(console.error);
