const fs = require('node:fs');
const path = require('node:path');
const { GifReader } = require('omggif');
const { test, expect, openPage, searchBody, card } = require('./support/pixiv');

const archive = fs.readFileSync(path.join(__dirname, 'fixtures/ugoira.zip'));
const frames = [{ file: 'Red.png', delay: 80 }, { file: 'Blue.png', delay: 120 }];
const metadata = { src: '/regular.zip', originalSrc: '/original.zip', mime_type: 'image/png', frames };
const detail = '<header></header><main><figure><div><canvas></canvas><button>Play</button></div></figure></main>';

async function serveZip(page, url, rangeSupported) {
    const methods = [];
    await page.route(url, route => {
        const request = route.request();
        methods.push(request.method());
        const headers = { 'Content-Length': String(archive.length) };
        if (request.method() === 'HEAD') return route.fulfill({ headers, body: '' });
        const range = request.headers().range;
        if (!rangeSupported || !range) return route.fulfill({ headers, body: archive });
        const [, start, end] = range.match(/^bytes=(\d+)-(\d+)$/).map(Number);
        const chunk = archive.subarray(start, end + 1);
        return route.fulfill({ status: 206, headers: { 'Content-Range': `bytes ${start}-${end}/${archive.length}`,
            'Content-Length': String(chunk.length) }, body: chunk });
    });
    return methods;
}

test('悬停动图会读取 ZIP 并在画布播放不同的帧', async ({ page }) => {
    await page.route('**/ajax/illust/101/ugoira_meta', r => r.fulfill({ json: { error: false, body: metadata } }));
    const requests = await serveZip(page, '**/regular.zip', true);
    await openPage(page, { body: searchBody(card(101, { tag: 'div', animation: true })) });
    await page.locator('.pp-control').hover();
    const canvas = page.locator('canvas.pp-image');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('width', '16');
    const colors = new Set();
    await expect.poll(async () => {
        const rgba = await canvas.evaluate(c => Array.from(c.getContext('2d').getImageData(0, 0, 1, 1).data));
        if (rgba[3]) colors.add(rgba.slice(0, 3).join(','));
        return [...colors].sort();
    }, { intervals: [25, 35, 50] }).toEqual(['0,0,255', '255,0,0']);
    expect(requests).toEqual(['HEAD', 'GET']);
});

test('元数据出错后可重试，在详情页下载真实 GIF 并校验帧顺序和延时', async ({ page }) => {
    let requests = 0;
    await page.route('**/ajax/illust/101/ugoira_meta', route => {
        return route.fulfill({ json: ++requests === 1 ? { error: true, message: 'missing' } : { error: false, body: metadata } });
    });
    const zipRequests = await serveZip(page, '**/original.zip', false);
    await openPage(page, { path: '/artworks/101', body: detail });
    const button = page.getByTitle('下载 GIF');
    const dialogSeen = new Promise(resolve => page.once('dialog', async dialog => {
        const message = dialog.message();
        await dialog.dismiss();
        resolve(message);
    }));
    await button.click();
    expect(await dialogSeen).toContain('missing');
    await expect(button).toBeEnabled();
    const downloadPromise = page.waitForEvent('download');
    await button.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('pixiv_101.gif');
    const gif = new GifReader(fs.readFileSync(await download.path()));
    expect([gif.width, gif.height, gif.numFrames()]).toEqual([16, 12, 2]);
    expect([gif.frameInfo(0).delay, gif.frameInfo(1).delay]).toEqual([8, 12]);
    const pixels = new Uint8Array(gif.width * gif.height * 4);
    gif.decodeAndBlitFrameRGBA(0, pixels);
    expect(pixels[0]).toBeGreaterThan(pixels[2]);
    gif.decodeAndBlitFrameRGBA(1, pixels);
    expect(pixels[2]).toBeGreaterThan(pixels[0]);
    expect(zipRequests).toEqual(['HEAD', 'GET']);
    await expect(button).toBeEnabled();
});

test('关闭下载功能时动图详情页保留原有播放按钮', async ({ page }) => {
    await page.clock.install();
    await openPage(page, { path: '/artworks/101', body: detail, settings: { enableAnimeDownload: false } });
    await expect(page.locator('canvas.pp-canvas')).toBeAttached();
    // The detail-page handler schedules button creation on a timer.
    await page.clock.runFor(1500);
    await expect(page.locator('figure button')).toHaveCount(1);
    await expect(page.getByTitle('下载 GIF')).toHaveCount(0);
});
