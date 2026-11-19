const { test: base, expect } = require('@playwright/test');
const { installUserscript, jquerySource } = require('./install');

const origin = 'https://www.pixiv.net';
const token = '0123456789abcdef0123456789abcdef';
const thumbnail = 'https://i.pximg.net/c/128x128/img-master/img/2020/01/01/00/00/00/101_p0_square1200.jpg';
const pager = '<nav><a href="?p=1">Previous</a><a href="?p=2"><span>2</span></a><a href="?p=3">Next</a></nav>';

function card(id = 101, { placeholder = false, animation = false, pages = 1, tag = 'li' } = {}) {
    const cover = placeholder ? '<figure class="cover"></figure>' : `<img class="cover" src="${thumbnail}">`;
    const avatar = placeholder ? '<figure></figure>' : '<img src="/avatar.png">';
    return `<${tag} data-card><div>
        <div><a href="/artworks/${id}">
            <div class="cover-slot">${cover}${animation ? '<pixiv-icon name="24/Play"></pixiv-icon>' : ''}</div>
            <div>${pages > 1 ? '<span>' + pages + '</span>' : ''}</div>
        </a><button aria-label="Bookmark"><svg><path/><path/></svg></button></div>
        <div><a href="/artworks/${id}">Seed ${id}</a></div>
        <div><a href="/users/1"><div class="avatar-slot">${avatar}</div></a><a href="/users/1">Author</a></div>
    </div></${tag}>`;
}

function searchBody(cards = card(101, { tag: 'div' })) {
    return `<div data-ga4-label="works_content"><div>${cards}</div></div>${pager}`;
}

const errorsByPage = new WeakMap();
const test = base.extend({
    page: async ({ page }, use) => {
        const errors = [];
        errorsByPage.set(page, errors);
        page.on('pageerror', error => errors.push(error.message));
        await use(page);
        expect(errors, 'Unexpected requests or uncaught browser errors').toEqual([]);
    },
});

async function openPage(page, {
    path = '/tags/cat/artworks', body = searchBody(), settings = {}, storage = {},
    lang = 'zh-CN', dismissNotice = true, supported = true, jquery = true,
} = {}) {
    const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
        .cover, .cover-slot { width: 90px; height: 80px; margin: 0 }
        .avatar-slot img { width: 20px; height: 20px }
        button svg { width: 16px; height: 16px } [data-card] { width: 160px }
        </style></head><body>${body}<!-- token\\":\\"${token} --></body></html>`;
    await page.context().route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (request.resourceType() === 'image') {
            return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"><rect width="64" height="48" fill="blue"/></svg>' });
        }
        if (url.origin === origin && request.method() === 'GET' &&
            (request.isNavigationRequest() || url.href === page.url())) {
            return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
        }
        if (url.href === 'https://code.jquery.com/jquery-2.1.4.min.js') {
            return route.fulfill({ contentType: 'application/javascript', body: jquerySource() });
        }
        errorsByPage.get(page).push(request.method() + ' ' + url.href);
        return route.abort();
    });
    await page.addInitScript(({ config, storage }) => {
        if (!sessionStorage.getItem('fixture-initialized')) {
            localStorage.setItem('gmc-frame', JSON.stringify(config));
            for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, JSON.stringify(value));
            sessionStorage.setItem('fixture-initialized', '1');
        }
        window.dataLayer = [{ user_id: '42' }];
    }, { config: { enableSort: false, enableNovelSort: false, previewDelay: 1, ...settings }, storage });
    await installUserscript(page, { jquery });
    await page.goto(origin + path);
    if (supported) {
        await expect(page.locator('#pp-settings')).toBeVisible();
        if (dismissNotice) await page.locator('#pps-close').click();
    }
}

module.exports = { test, expect, openPage, card, searchBody, pager, origin, thumbnail, token };
