const { test, expect, openPage, card, pager, searchBody, thumbnail } = require('./support/pixiv');

const listing = `<section><ul>${card(101, { pages: 3 })}</ul>${pager}</section>`;
const oldMenu = '<div class="_toolmenu"></div>';
const oldWork = '<span class="page-count"><span>3</span></span>';
for (const [name, path, body] of [
    ['首页', '/', listing],
    ['英文首页', '/en/', listing],
    ['R-18 首页', '/cate_r18.php', listing],
    ['带查询条件的 R-18 首页', '/cate_r18.php?lang=ja', listing],
    ['画师作品', '/en/users/42/artworks', listing],
    ['作品详情页推荐', '/en/artworks/999', listing],
    ['关注的新作', '/bookmark_new_illust.php', listing],
    ['关注的 R-18 新作', '/bookmark_new_illust_r18.php', listing],
    ['大家的新作', '/new_illust.php', listing],
    ['发现', '/discovery', `<div class="gtm-illust-recommend-zone">${listing}</div>`],
    ['排行榜', '/ranking.php?mode=daily', '<ul><li><span>1</span><a href="/artworks/101"><div><img src="/thumb.jpg"></div><div><span>3</span></div></a></li><li><span>2</span><a href="/artworks/102"><img src="/second.jpg"></a></li></ul>'],
    ['旧版收藏', '/bookmark.php', oldMenu + `<div class="image-item"><a class="_work multiple" href="/artworks/101">${oldWork}</a></div>`],
    ['动态', '/stacc?mode=unify', oldMenu + `<a class="_work multiple" href="/member_illust.php?illust_id=101">${oldWork}</a>`],
    ['标签首页', '/en/tags/cat', listing],
    ['旧版搜索布局', '/search?q=cat&type=artwork', listing],
    ['新版搜索布局', '/en/tags/cat/manga', searchBody(card(101, { tag: 'div', pages: 3 }))],
]) {
    test(name + '识别作品并绑定预览', async ({ page }) => {
        await page.route('**/ajax/illust/101/pages', route => route.fulfill({
            json: { error: false, body: [0, 1, 2].map(i => ({ urls: { regular: '/r' + i + '.jpg', original: '/o' + i + '.png' } })) },
        }));
        await openPage(page, { path, body });
        const control = page.locator('[illustid="101"]');
        await expect(control).toHaveAttribute('pagecount', '3');
        // jQuery implements mouseenter using the native mouseover event.
        await control.dispatchEvent('mouseover');
        await expect(page.locator('.pp-image')).toHaveAttribute('src', '/r0.jpg');
        await expect(page.locator('.pp-page')).toHaveText('1/3');
    });
}

test('不支持的页面跳过工具栏，之后的站内导航会重新初始化', async ({ page }) => {
    const unsupported = page.waitForEvent('console', msg => msg.text().includes('Unsupported page'));
    await openPage(page, { path: '/settings/profile', body: listing, supported: false });
    await unsupported;
    await expect(page.locator('#pp-toolbar')).toHaveCount(0);
    await page.evaluate(() => history.pushState({}, '', '/users/42'));
    await expect(page.locator('[illustid="101"]')).toBeAttached();
    await expect(page.locator('#pp-settings')).toHaveCount(1);
});

test('延迟载入的新卡片启用全尺寸缩略图和新窗口链接', async ({ page }) => {
    await openPage(page, { path: '/users/42', body: listing, settings: { fullSizeThumb: true } });
    await expect(page.locator('[illustid="101"]')).toBeAttached();
    await page.locator('ul').evaluate((ul, html) => ul.insertAdjacentHTML('beforeend', html), card(202));
    const imageLink = page.locator('[illustid="202"] a').first();
    await expect(imageLink).toHaveAttribute('target', '_blank');
    await expect(imageLink.locator('img')).toHaveAttribute('src', thumbnail.replace('128x128', '540x540_70').replace('_square', '_master'));
});

test('已删除作品的搜索链接保留完整作品 ID', async ({ page }) => {
    await openPage(page, { path: '/users/42/bookmarks/artworks', body: '<span to="/artworks/12345">-----</span>' });
    for (const engine of ['Google', 'Bing', 'Baidu']) {
        const link = page.getByRole('link', { name: engine, exact: true });
        await expect(link).toHaveAttribute('target', '_blank');
        const url = new URL(await link.getAttribute('href'));
        expect([...url.searchParams.values()]).toEqual(['pixiv "12345"']);
    }
});
