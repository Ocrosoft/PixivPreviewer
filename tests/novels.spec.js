const { test, expect, openPage, pager, token } = require('./support/pixiv');
const { mockFollowing } = require('./support/search');

function novelBody(legacy) {
    const card = `<div>
        <div><a href="/novel/show.php?id=1"><img src="/cover.jpg"></a></div>
        <div><div>
            <div><h3><a href="/novel/show.php?id=1">Seed title</a></h3></div>
            <div><a class="gtm-novel-searchpage-result-user" href="/users/1"><img src="/avatar.png"></a>
                <a class="gtm-novel-searchpage-result-user" href="/users/1">Author</a></div>
            <div><div><div></div><div><p>Description</p></div><div><span>1 字</span></div></div>
                <button><svg width="24" height="24"><path/><path/></svg></button></div>
        </div></div>
    </div>`;
    return legacy ? `<section><ul><li>${card}</li></ul>${pager}</section>`
        : `<div data-ga4-label="works_content"><div><div class="col-span-1">${card}</div></div></div>${pager}`;
}

function novel(id, bookmarkCount, changes = {}) {
    return { id: String(id), title: 'Novel ' + id, bookmarkCount, userId: '3', userName: 'Writer',
        url: '/cover.jpg', profileImageUrl: '/author.png', description: '<b>Opening</b>',
        textCount: 12345, tags: ['cat', 'R-18'], ...changes };
}

for (const [layout, path] of [['网格', '/search?q=cat&type=novel&p=2&work_lang=ja'],
    ['列表', '/tags/cat/novels?p=2&work_lang=ja']]) {
    test('小说' + layout + '跨页排序、筛选、系列、标签及翻页', async ({ page }) => {
        const following = await mockFollowing(page);
        const pages = [];
        await page.route('**/ajax/search/novels/cat?**', route => {
            const params = new URL(route.request().url()).searchParams;
            pages.push(params.get('p'));
            expect(params.get('work_lang')).toBe('ja');
            const data = params.get('p') === '2' ? [
                novel(10, 15), novel(11, 14), novel(12, 50, { userId: '72' }),
            ] : [novel(13, 80, { bookmarkData: { id: '9' } }), novel(14, 31, { seriesId: '123', seriesTitle: 'Series' })];
            return route.fulfill({ json: { body: { novel: { data } } } });
        });
        await openPage(page, { path, body: novelBody(layout === '列表'), settings: {
            enableNovelSort: true, novelPageCount: 2, novelFavFilter: 15, novelHideFavorite: true, novelHideFollowed: true,
        } });
        await expect(page.locator('.pns-title')).toHaveText(['Novel 14', 'Novel 10']);
        expect(pages).toEqual(['2', '3']);
        expect(following).toContain('hide/0');
        await expect(page.locator('.pns-series').first()).toHaveAttribute('href', '/novel/series/123');
        await expect(page.locator('.pns-series').last()).toBeHidden();
        await expect(page.locator('.pns-text-count').first()).toHaveText('12,345 字');
        await expect(page.locator('.pns-tag-list a').first()).toHaveAttribute('href', '/search?q=cat&type=novel&work_lang=ja');
        await expect(page.locator('.pns-desc b').first()).toHaveText('Opening');
        await expect(page.locator('.pns-title').first()).toHaveAttribute('href', '/novel/show.php?id=14');
        await expect(page.locator('.pns-title').first()).toHaveAttribute('target', '_blank');
        await expect(page.locator('.pns-bookmark-count')).toHaveText(['31', '15']);
        await expect(page.locator('.pp-prevPage')).toHaveAttribute('href', /[?&]p=1&/);
        await page.locator('#pp-nextPage-fixed').click();
        await expect(page).toHaveURL(/[?&]p=4&/);
    });
}

test('小说某一页请求失败后继续处理；可添加和删除收藏', async ({ page }) => {
    await page.route('**/ajax/search/novels/cat?**', route => {
        if (new URL(route.request().url()).searchParams.get('p') === '1') return route.fulfill({ status: 503 });
        return route.fulfill({ json: { body: { novel: { data: [novel(10, 5)] } } } });
    });
    await page.route('**/ajax/novels/bookmarks/add', route => {
        expect(route.request().headers()['x-csrf-token']).toBe(token);
        expect(route.request().postDataJSON()).toMatchObject({ novel_id: '10', restrict: 0 });
        return route.fulfill({ json: { error: false, body: '901' } });
    });
    await page.route('**/ajax/novels/bookmarks/delete', route => {
        expect(route.request().postDataJSON()).toMatchObject({ book_id: '901' });
        return route.fulfill({ json: { error: false } });
    });
    await openPage(page, { path: '/tags/cat/novels', body: novelBody(false), settings: { enableNovelSort: true, novelPageCount: 2 } });
    const like = page.locator('.pns-like');
    await expect(page.locator('.pp-prevPage')).toBeHidden();
    await expect(page.locator('.pns-title')).toHaveText('Novel 10');
    await like.click();
    await expect(like).toHaveAttribute('bookmark-id', '901');
    await like.click();
    await expect(like).not.toHaveAttribute('bookmark-id');
});
