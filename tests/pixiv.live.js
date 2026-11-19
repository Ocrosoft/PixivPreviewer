const { test, expect } = require('@playwright/test');
const { installUserscript } = require('./support/install');

test('Pixiv 线上标签页能识别作品并加载静态预览', async ({ page }) => {
    await page.addInitScript(() => {
        if (window === window.top && location.hostname === 'www.pixiv.net') {
            localStorage.setItem('gmc-frame', JSON.stringify({ enableSort: false, enableNovelSort: false, previewDelay: 1 }));
        }
    });
    await installUserscript(page);
    await page.goto('https://www.pixiv.net/tags/landscape', { waitUntil: 'domcontentloaded' });
    await page.locator('#pps-close').click();
    const link = page.locator('a[href*="/artworks/"]:has(img):not(.ugoku-illust)').filter({
        hasNot: page.locator(':scope > div:first-child svg, pixiv-icon[name="24/Play"]'),
    }).first();
    await expect(link).toBeVisible();
    const href = new URL(await link.getAttribute('href'), page.url());
    expect(href.pathname).toMatch(/\/artworks\/[1-9]\d*\/?$/);
    const id = href.pathname.match(/\/artworks\/(\d+)/)[1];
    const response = page.waitForResponse(r => new URL(r.url()).pathname === '/ajax/illust/' + id + '/pages');
    await link.locator('img').first().hover();
    expect((await response).ok()).toBeTruthy();
    const image = page.locator('.pp-main img.pp-image');
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
});

test('Pixiv 线上小说接口提供排序与卡片渲染所需字段', async ({ page }) => {
    // Use a browser navigation so the check also uses the browser's configured network proxy.
    const response = await page.goto('https://www.pixiv.net/ajax/search/novels/cat?p=1&mode=safe');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.error).toBe(false);
    expect(data.body.novel.data).toEqual(expect.arrayContaining([expect.objectContaining({
        id: expect.any(String), title: expect.any(String), bookmarkCount: expect.any(Number),
        tags: expect.any(Array), userId: expect.any(String),
    })]));
});
