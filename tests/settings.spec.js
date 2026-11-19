const { test, expect, openPage, searchBody } = require('./support/pixiv');

test('首次安装、缺少 jQuery 时回退到 CDN，欢迎提示只显示一次', async ({ page }) => {
    const cdn = page.waitForRequest('https://code.jquery.com/jquery-2.1.4.min.js');
    await openPage(page, { jquery: false, dismissNotice: false });
    await cdn;
    await expect(page.locator('#pp-bg')).toContainText('欢迎使用');
    await page.locator('#pps-close').click();
    await page.reload();
    await expect(page.locator('#pp-settings')).toBeVisible();
    await expect(page.locator('#pp-bg')).toHaveCount(0);
});

test('升级提示显示一次，旧设置迁移后可跨刷新保留', async ({ page }) => {
    await openPage(page, { dismissNotice: false, storage: {
        PixivPreviewVersion: '1.0', PixivPreview: { enablePreview: false, linkBlank: false, previewDelay: 777, lang: '1' },
    } });
    await expect(page.locator('#pp-bg')).toContainText('New settings menu');
    await page.locator('#pps-close').click();
    await page.locator('#pp-settings').click();
    const delay = page.locator('#gmc-frame_field_previewDelay');
    await expect(delay).toHaveValue('777');
    await page.reload();
    await page.locator('#pp-settings').click();
    await expect(delay).toHaveValue('777');
    await expect(page.locator('#gmc-frame_field_enablePreview')).not.toBeChecked();
    await expect(page.locator('#pp-bg')).toHaveCount(0);
});

test('设置可关闭、切换语言、保存并在重载后生效', async ({ page }) => {
    await openPage(page, { lang: 'ja-JP' });
    const settings = page.locator('#pp-settings');
    await settings.click();
    await expect(page.locator('#gmc-frame_enablePreview_field_label')).toContainText('プレビュー');
    await page.locator('#gmc-frame_closeBtn').click();
    await expect(page.locator('#gmc-frame')).toBeHidden();
    await settings.click();
    await page.locator('#gmc-frame_field_lang').selectOption('English');
    await page.locator('#gmc-frame_field_enablePreview').uncheck();
    await page.locator('#gmc-frame_field_linkBlank').uncheck();
    await Promise.all([page.waitForNavigation(), page.locator('#gmc-frame_saveBtn').click()]);
    await settings.click();
    await expect(page.locator('#gmc-frame_closeBtn')).toHaveText('Close');
    await expect(page.locator('#gmc-frame_field_enablePreview')).not.toBeChecked();
    await page.locator('#gmc-frame_closeBtn').click();
    await page.locator('a[href="/artworks/101"] img').hover();
    await expect(page.locator('.pp-main')).toHaveCount(0);
    await expect(page.locator('.pp-control a').first()).not.toHaveAttribute('target');
});

test('没有语言字段的旧配置继承页面语言并保留新字段默认值', async ({ page }) => {
    await openPage(page, { lang: 'ja', storage: { PixivPreview: { original: true } } });
    await page.locator('#pp-settings').click();
    await expect(page.locator('#gmc-frame_enablePreview_field_label')).toContainText('プレビュー');
    await expect(page.locator('#gmc-frame_field_enablePreview')).toBeChecked();
    await expect(page.locator('#gmc-frame_field_original')).toBeChecked();
});

test('清除当前账号关注缓存以及取消和确认重置设置', async ({ page }) => {
    await openPage(page, { settings: { previewDelay: 678 }, storage: { 'followingOfUid-42': ['9'], 'followingOfUid-99': ['8'] } });
    await page.locator('#pp-settings').click();
    await page.locator('#gmc-frame_field_clearFollowedUserCache').click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('followingOfUid-42')))).toBeNull();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('followingOfUid-99')))).toEqual(['8']);
    const reset = page.locator('#gmc-frame_field_clearSettings');
    page.once('dialog', dialog => dialog.dismiss());
    await reset.click();
    await expect(page.locator('#gmc-frame_field_previewDelay')).toHaveValue('678');
    page.once('dialog', dialog => dialog.accept());
    await Promise.all([page.waitForNavigation(), reset.click()]);
    await page.locator('#pp-settings').click();
    await expect(page.locator('#gmc-frame_field_previewDelay')).toHaveValue('200');
});

test('已有用户升级时显示升级说明，下一次启动保留设置', async ({ page }) => {
    await openPage(page, { body: searchBody(), storage: { PixivPreviewVersion: '2.0' },
        settings: { previewDelay: 321 }, dismissNotice: false });
    await expect(page.locator('#pp-bg')).toContainText('新的设置菜单');
    await page.reload();
    await page.locator('#pp-settings').click();
    await expect(page.locator('#pp-bg')).toHaveCount(0);
    await expect(page.locator('#gmc-frame_field_previewDelay')).toHaveValue('321');
});
