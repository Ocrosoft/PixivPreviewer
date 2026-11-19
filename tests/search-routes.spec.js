const { test, expect, openPage } = require('./support/pixiv');
const { work, mockArtworks } = require('./support/search');

for (const [path, api, type] of [
    ['/tags/cat/illustrations', 'illustrations', null],
    ['/tags/cat/manga', 'manga', null],
    ['/tags/cat/ugoira', 'illustrations', 'ugoira'],
    ['/search?q=cat&type=ugoira', 'illustrations', 'ugoira'],
]) {
    test(path + ' 请求对应分类并显示排序结果', async ({ page }) => {
        const { searches } = await mockArtworks(page, { 1: [work(101)] });
        await openPage(page, { path, settings: { enableSort: true, pageCount: 1 } });
        await expect(page.locator('.ppTitleLink')).toHaveText('Work 101');
        expect(searches[0].pathname).toBe('/ajax/search/' + api + '/cat');
        expect(searches[0].searchParams.get('type')).toBe(type);
    });
}
