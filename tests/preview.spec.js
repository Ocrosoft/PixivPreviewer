const { test, expect, openPage, card, searchBody } = require('./support/pixiv');

function images(id, count) {
    return { error: false, body: Array.from({ length: count }, (_, i) => ({
        urls: { regular: '/regular/' + id + '-' + i + '.jpg', original: '/original/' + id + '-' + i + '.png' },
    })) };
}

test('多图点击与滚轮循环翻页、切换原图、另开原图并记住页码', async ({ page }) => {
    await page.route('**/ajax/illust/101/pages', r => r.fulfill({ json: images(101, 2) }));
    await openPage(page, { body: searchBody(card(101, { tag: 'div', pages: 2 })) });
    const thumbnail = page.locator('a[href="/artworks/101"] img');
    await thumbnail.hover();
    const image = page.locator('.pp-main img.pp-image');
    await expect(image).toBeVisible();
    await expect(page.locator('.pp-page')).toHaveText('1/2');
    await image.dispatchEvent('click');
    await expect(image).toHaveAttribute('src', '/regular/101-1.jpg');
    await image.dispatchEvent('click');
    await expect(image).toHaveAttribute('src', '/regular/101-0.jpg');
    await image.dispatchEvent('wheel', { deltaY: -100 });
    await expect(page.locator('.pp-page')).toHaveText('2/2');
    await image.dispatchEvent('click', { ctrlKey: true });
    await expect(image).toHaveAttribute('src', '/original/101-1.png');
    const popup = page.waitForEvent('popup');
    await image.dispatchEvent('click', { shiftKey: true });
    const originalPage = await popup;
    await expect(originalPage).toHaveURL(/\/original\/101-1\.png$/);
    await originalPage.close();
    await page.mouse.move(1, 1);
    await expect(image).toHaveCount(0);
    await thumbnail.hover();
    await expect(image).toHaveAttribute('src', '/original/101-1.png');
});

test('快速移到下一件作品时忽略较晚返回的上一个预览', async ({ page }) => {
    let firstRequest;
    const received = new Promise(resolve => { firstRequest = resolve; });
    await page.route('**/ajax/illust/101/pages', route => firstRequest(route));
    await page.route('**/ajax/illust/202/pages', r => r.fulfill({ json: images(202, 1) }));
    await openPage(page, { body: searchBody(card(101, { tag: 'div' }) + card(202, { tag: 'div' })) });
    await page.locator('a[href="/artworks/101"] img').dispatchEvent('mousemove');
    const delayed = await received;
    await page.locator('a[href="/artworks/202"] img').dispatchEvent('mousemove');
    const image = page.locator('.pp-main .pp-image');
    await expect(image).toHaveAttribute('src', '/regular/202-0.jpg');
    await delayed.fulfill({ json: images(101, 1) });
    await expect.poll(() => page.evaluate(() => $.active)).toBe(0);
    await expect(image).toHaveAttribute('src', '/regular/202-0.jpg');
    await image.dispatchEvent('click');
    await expect(page.locator('.pp-pageCount')).toBeHidden();
});

test('动态插入的链接在悬停期间换了作品时，只预览最新作品', async ({ page }) => {
    await page.clock.install();
    await page.route('**/ajax/illust/303/pages', r => r.fulfill({ json: images(303, 1) }));
    await openPage(page, { settings: { previewDelay: 100 } });
    await page.evaluate(() => {
        const link = document.createElement('a');
        link.href = '/artworks/202';
        link.textContent = '新作品';
        document.body.append(link);
        link.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
        link.href = '/artworks/303';
    });
    await page.clock.runFor(150);
    await expect(page.locator('.pp-main')).toHaveCount(0);
    await page.getByRole('link', { name: '新作品' }).hover();
    await page.clock.runFor(150);
    await expect(page.locator('.pp-main .pp-image')).toHaveAttribute('src', '/regular/303-0.jpg');
});

test('Ctrl 控制全屏预览并在关闭时恢复页面滚动', async ({ page }) => {
    await page.route('**/ajax/illust/101/pages', r => r.fulfill({ json: images(101, 1) }));
    await openPage(page, { settings: { previewByKey: true, previewFullScreen: true, scrollLockWhenPreview: true } });
    await page.locator('a[href="/artworks/101"] img').hover();
    const preview = page.locator('.pp-main');
    await expect(preview.locator('.pp-image')).toHaveAttribute('src', '/regular/101-0.jpg');
    await expect(preview).toBeHidden();
    await page.keyboard.press('Control');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveCSS('position', 'fixed');
    const canScroll = () => page.evaluate(() => window.dispatchEvent(new WheelEvent('wheel', { cancelable: true })));
    expect(await canScroll()).toBe(false);
    await preview.dispatchEvent('click');
    await expect(preview).toBeHidden();
    expect(await canScroll()).toBe(true);
});

test('关闭动图预览后悬停不请求动画；固定翻页按钮使用原生分页', async ({ page }) => {
    await page.clock.install();
    await openPage(page, { body: searchBody(card(101, { tag: 'div', animation: true })),
        settings: { enableAnimePreview: false } });
    await page.getByRole('link', { name: 'Seed 101' }).hover();
    await page.clock.runFor(30);
    await expect(page.locator('.pp-main')).toHaveCount(0);
    await page.locator('#pp-nextPage-fixed').click();
    await expect(page).toHaveURL(/\?p=3$/);
});
