const { expect, thumbnail } = require('./pixiv');

function work(id, overrides = {}) {
    return {
        id: String(id), userId: String(id), title: 'Work ' + id, userName: 'Artist ' + id,
        url: thumbnail.replace('101_p0', id + '_p0'), profileImageUrl: '/avatar-' + id + '.png',
        xRestrict: 0, pageCount: 1, illustType: 0, aiType: 1, tags: ['cat'], ...overrides,
    };
}

async function mockArtworks(page, pages, counts = {}) {
    const searches = [];
    const statistics = [];
    await page.route(/\/ajax\/search\/(artworks|illustrations|manga)\//, route => {
        const url = new URL(route.request().url());
        searches.push(url);
        const p = url.searchParams.get('p');
        expect(pages, 'Unexpected search page ' + p).toHaveProperty(p);
        return route.fulfill({ json: { error: false, body: { illustManga: { data: pages[p] } } } });
    });
    await page.route(/\/ajax\/illust\/\d+$/, route => {
        const id = new URL(route.request().url()).pathname.split('/').pop();
        statistics.push(id);
        const [bookmarkCount, likeCount, viewCount] = counts[id] || [10, 20, 30];
        return route.fulfill({ json: { error: false, body: { bookmarkCount, likeCount, viewCount } } });
    });
    return { searches, statistics };
}

async function mockFollowing(page) {
    const requests = [];
    await page.route('**/ajax/user/42/following?**', route => {
        const params = new URL(route.request().url()).searchParams;
        const key = params.get('rest') + '/' + params.get('offset');
        requests.push(key);
        const users = { 'show/0': [{ userId: '71' }], 'hide/0': [{ userId: '72' }] }[key] || [];
        return route.fulfill({ json: { error: false, body: { users } } });
    });
    return requests;
}

module.exports = { work, mockArtworks, mockFollowing };
