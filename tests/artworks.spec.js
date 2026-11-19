const { test, expect, openPage, card, searchBody, token } = require('./support/pixiv');
const { work, mockArtworks, mockFollowing } = require('./support/search');

test('跨页去重、排除广告并按收藏、点赞、浏览量切换排序', async ({ page }) => {
    const { searches, statistics } = await mockArtworks(page, {
        2: [work(101), {}, work(102)], 3: [work(102), work(103)],
    }, { 101: [30, 1, 40], 102: [50, 6, 15], 103: [10, 20, 30] });
    await openPage(page, { path: '/search?q=cat%20art&type=illust_ugoira&p=2&s_mode=tag_tc&ratio=1',
        settings: { enableSort: true, pageCount: 2, pageByKey: true, enablePreview: false } });
    const titles = page.locator('.ppTitleLink');
    await expect(titles).toHaveText(['Work 102', 'Work 101', 'Work 103']);
    expect(searches.map(u => u.searchParams.get('p'))).toEqual(['2', '3']);
    for (const url of searches) {
        expect(url.pathname).toBe('/ajax/search/illustrations/cat%20art');
        expect(Object.fromEntries(url.searchParams)).toMatchObject({ word: 'cat art', type: 'illust_and_ugoira', s_mode: 's_tag_tc', ratio: '1' });
    }
    await page.getByText('按👍排序', { exact: true }).click();
    await expect(titles).toHaveText(['Work 103', 'Work 102', 'Work 101']);
    await page.getByText('按👀排序', { exact: true }).click();
    await expect(titles).toHaveText(['Work 101', 'Work 103', 'Work 102']);
    await page.getByText('按❤️排序', { exact: true }).click();
    await expect(page.locator('.ppBookmarkCount')).toHaveText(['❤️50', '❤️30', '❤️10']);
    expect(statistics.sort()).toEqual(['101', '102', '103']);
    await expect(page.locator('.pp-prevPage')).toHaveAttribute('href', /[?&]p=1&/);
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/[?&]p=4&/);
});

test('手动排序重建后台缩略图、头像、分级和多图标记', async ({ page }) => {
    await mockArtworks(page, { 1: [work(101), work(102, { xRestrict: 1 }), work(103, { xRestrict: 2, pageCount: 3 })] });
    await openPage(page, { body: searchBody(card(101, { tag: 'div', placeholder: true })),
        settings: { pageCount: 1, enablePreview: false, fullSizeThumb: true } });
    await expect(page.locator('.pp-control')).toBeAttached();
    await page.locator('#pp-sort').click();
    const cards = page.locator('[data-card]');
    await expect(cards.locator('.ppAdditionTag')).toHaveText(['', 'R-18', 'R-18G3']);
    for (const [i, id] of [101, 102, 103].entries()) {
        await expect(cards.nth(i).locator('.cover-slot > img')).toHaveAttribute('src', new RegExp('540x540_70/.*/' + id + '_p0_master1200.jpg$'));
        await expect(cards.nth(i).locator('.avatar-slot > img')).toHaveAttribute('src', '/avatar-' + id + '.png');
        await expect(cards.nth(i).locator('.ppImageLink')).toHaveAttribute('href', '/artworks/' + id);
    }
});

test('组合筛选保留边界值，支持公开及私密关注列表和缓存', async ({ page }) => {
    const following = await mockFollowing(page);
    await mockArtworks(page, { 1: [
        work(101, { pageCount: 2 }), work(102, { pageCount: 4 }), work(103, { pageCount: 2, aiType: 2 }),
        work(104, { pageCount: 2, bookmarkData: { id: 'b' } }), work(105, { pageCount: 2, tags: ['spoiler'] }),
        work(106, { pageCount: 2, userId: '9' }), work(107), work(108, { pageCount: 5 }),
        work(109, { pageCount: 2, userId: '71' }), work(110, { pageCount: 2, userId: '72' }),
        work(111, { pageCount: 2 }),
    ] }, { 111: [9, 90, 500] });
    await openPage(page, { settings: { enableSort: true, pageCount: 1, favFilter: 10,
        aiFilter: true, hideFavorite: true, hideFollowed: true, hideByTag: true, hideByTagRegex: 'gore|spoiler',
        hideByUser: true, hideByUserList: '8| 9', hideCountLessThan: 2, hideCountMoreThan: 4, enablePreview: false } });
    await expect(page.locator('.ppTitleLink')).toHaveText(['Work 101', 'Work 102']);
    await page.reload();
    await expect(page.locator('.ppTitleLink')).toHaveText(['Work 101', 'Work 102']);
    expect(following).toEqual(['show/0', 'show/100', 'hide/0', 'hide/100']);
});

test('只看 AI；翻到空页后停止请求并显示隐藏数量', async ({ page }) => {
    const { searches } = await mockArtworks(page, { 1: [work(101)], 2: [] });
    await openPage(page, { settings: { enableSort: true, aiOnly: true, pageCount: 4 } });
    await expect(page.getByText('没有可以显示的作品（隐藏了 1 个作品）')).toBeVisible();
    expect(searches).toHaveLength(2);
});

test('统计接口限流后重试，单件作品读取失败仍完成排序', async ({ page }) => {
    await mockArtworks(page, { 1: [work(101), work(102)] });
    let attempts = 0;
    const times = [];
    await page.route('**/ajax/illust/101', route => {
        times.push(Date.now());
        if (++attempts === 1) return route.fulfill({ status: 429, headers: { 'Retry-After': '1' }, body: '' });
        return route.fulfill({ json: { error: false, body: { bookmarkCount: 17, likeCount: 1, viewCount: 2 } } });
    });
    await page.route('**/ajax/illust/102', route => route.fulfill({ status: 404 }));
    await openPage(page, { settings: { enableSort: true, pageCount: 1 } });
    await expect(page.locator('.ppBookmarkCount')).toHaveText(['❤️17', '❤️0']);
    expect(times).toHaveLength(2);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(950);
});

test('插画私密收藏与取消收藏发送正确的作品 ID 和令牌', async ({ page }) => {
    await mockArtworks(page, { 1: [work(101)] });
    await page.route('**/ajax/illusts/bookmarks/add', route => {
        expect(route.request().headers()['x-csrf-token']).toBe(token);
        expect(route.request().postDataJSON()).toMatchObject({ illust_id: '101', restrict: 1 });
        return route.fulfill({ json: { error: false, body: { last_bookmark_id: '801' } } });
    });
    await page.route('**/rpc/index.php', route => {
        expect(route.request().postDataJSON()).toEqual({ mode: 'delete_illust_bookmark', bookmark_id: '801' });
        return route.fulfill({ json: { error: false } });
    });
    await openPage(page, { settings: { enableSort: true, pageCount: 1, enablePreview: false } });
    const icon = page.locator('.ppBookmarkSvg');
    const heart = icon.locator('path').last();
    await icon.locator('..').click({ modifiers: ['Control'] });
    await expect(heart).toHaveCSS('fill', 'rgb(255, 64, 96)');
    await icon.locator('..').click();
    await expect(heart).toHaveCSS('fill', 'rgb(255, 255, 255)');
});

test('排序卡片上的画师资料支持关注及取消关注', async ({ page }) => {
    await mockArtworks(page, { 1: [work(101)] });
    await page.route('**/ajax/user/101?full=1', route => route.fulfill({ json: { error: false, body: { isFollowed: false } } }));
    await page.route('**/bookmark_add.php', route => {
        expect(route.request().postDataJSON()).toMatchObject({ mode: 'add', type: 'user', user_id: '101' });
        return route.fulfill({ body: '' });
    });
    await page.route('**/rpc_group_setting.php', route => {
        expect(route.request().postDataJSON()).toMatchObject({ mode: 'del', type: 'bookuser', id: '101' });
        return route.fulfill({ json: { type: 'bookuser', id: '101' } });
    });
    await openPage(page, { settings: { enableSort: true, pageCount: 1, enablePreview: false } });
    await page.locator('.ppAuthorLink').dispatchEvent('mouseover');
    const button = page.locator('.ppa-follow');
    await expect(page.locator('.ppa-authorName')).toHaveText('Artist 101');
    await button.dispatchEvent('click');
    await expect(button).toHaveText('关注中');
    await button.dispatchEvent('click');
    await expect(button).toHaveText('关注');
});
