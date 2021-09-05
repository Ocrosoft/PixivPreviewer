// ==UserScript==
// @name                Pixiv Previewer
// @namespace           https://github.com/Ocrosoft/PixivPreviewer
// @version             3.6.2
// @description         Display preview images (support single image, multiple images, moving images); Download animation(.zip); Sorting the search page by favorite count(and display it). Updated for the latest search page.
// @description:zh-CN   显示预览图（支持单图，多图，动图）；动图压缩包下载；搜索页按热门度（收藏数）排序并显示收藏数，适配11月更新。
// @description:ja      プレビュー画像の表示（単一画像、複数画像、動画のサポート）; アニメーションのダウンロード（.zip）; お気に入りの数で検索ページをソートします（そして表示します）。 最新の検索ページ用に更新されました。
// @description:zh_TW   顯示預覽圖像（支持單幅圖像，多幅圖像，運動圖像）； 下載動畫（.zip）; 按收藏夾數對搜索頁進行排序（並顯示）。 已為最新的搜索頁面適配。
// @author              Ocrosoft
// @match               *://www.pixiv.net/*
// @grant               unsafeWindow
// @compatible          Chrome
// ==/UserScript==

// https://greasyfork.org/zh-CN/scripts/417761-ilog
// 后面把DoLog替换掉
function ILog() {
    this.prefix = '';

    this.v = function (value) {
        if (level <= this.LogLevel.Verbose) {
            console.log(this.prefix + value);
        }
    }

    this.i = function (info) {
        if (level <= this.LogLevel.Info) {
            console.info(this.prefix + info);
        }
    }

    this.w = function (warning) {
        if (level <= this.LogLevel.Warning) {
            console.warn(this.prefix + warning);
        }
    }

    this.e = function (error) {
        if (level <= this.LogLevel.Error) {
            console.error(this.prefix + error);
        }
    }

    this.d = function (element) {
        if (level <= this.LogLevel.Verbose) {
            console.log(element);
        }
    }

    this.setLogLevel = function (logLevel) {
        level = logLevel;
    }

    this.LogLevel = {
        Verbose: 0,
        Info: 1,
        Warning: 2,
        Error: 3,
    };

    let level = this.LogLevel.Verbose;
}
var iLog = new ILog();

// https://greasyfork.org/zh-CN/scripts/417760-checkjquery
var checkJQuery = function () {
    let jqueryCdns = [
        'http://code.jquery.com/jquery-2.1.4.min.js',
        'https://ajax.aspnetcdn.com/ajax/jquery/jquery-2.1.4.min.js',
        'https://ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min.js',
        'https://cdn.staticfile.org/jquery/2.1.4/jquery.min.js',
        'https://apps.bdimg.com/libs/jquery/2.1.4/jquery.min.js',
    ];
    function isJQueryValid() {
        try {
            let wd = unsafeWindow;
            if (wd.jQuery && !wd.$) {
                wd.$ = wd.jQuery;
            }
            $();
            return true;
        } catch (exception) {
            return false;
        }
    }
    function insertJQuery(url) {
        let script = document.createElement('script');
        script.src = url;
        document.head.appendChild(script);
        return script;
    }
    function converProtocolIfNeeded(url) {
        let isHttps = location.href.indexOf('https://') != -1;
        let urlIsHttps = url.indexOf('https://') != -1;

        if (isHttps && !urlIsHttps) {
            return url.replace('http://', 'https://');
        } else if (!isHttps && urlIsHttps) {
            return url.replace('https://', 'http://');
        }
        return url;
    }
    function waitAndCheckJQuery(cdnIndex, resolve) {
        if (cdnIndex >= jqueryCdns.length) {
            iLog.e('无法加载 JQuery，正在退出。');
            resolve(false);
            return;
        }
        let url = converProtocolIfNeeded(jqueryCdns[cdnIndex]);
        iLog.i('尝试第 ' + (cdnIndex + 1) + ' 个 JQuery CDN：' + url + '。');
        let script = insertJQuery(url);
        setTimeout(function () {
            if (isJQueryValid()) {
                iLog.i('已加载 JQuery。');
                resolve(true);
            } else {
                iLog.w('无法访问。');
                script.remove();
                waitAndCheckJQuery(cdnIndex + 1, resolve);
            }
        }, 100);
    }
    return new Promise(function (resolve) {
        if (isJQueryValid()) {
            iLog.i('已加载 jQuery。');
            resolve(true);
        } else {
            iLog.i('未发现 JQuery，尝试加载。');
            waitAndCheckJQuery(0, resolve);
        }
    });
}

let Lang = {
    // 自动选择
    auto: -1,
    // 中文-中国大陆
    zh_CN: 0,
    // 英语-美国
    en_US: 1,
    // 俄语-俄罗斯
    ru_RU: 2,
};
let Texts = {};
Texts[Lang.zh_CN] = {
    // 安装或更新后弹出的提示
    install_title: '欢迎使用 PixivPreviewer v',
    install_body: '<div style="position: absolute;left: 50%;top: 30%;font-size: 20px; color: white;transform:translate(-50%,0);"><p style="text-indent: 2em;">欢迎反馈问题和提出建议！><a style="color: green;" href="https://greasyfork.org/zh-CN/scripts/30766-pixiv-previewer/feedback" target="_blank">反馈页面</a><</p><br><p style="text-indent: 2em;">如果您是第一次使用，推荐到<a style="color: green;" href="https://greasyfork.org/zh-CN/scripts/30766-pixiv-previewer" target="_blank"> 详情页 </a>查看脚本介绍。</p></div>',
    // 设置项
    setting_language: '语言',
    setting_preview: '预览',
    setting_sort: '排序（仅搜索页生效）',
    setting_anime: '动图下载（动图预览及详情页生效）',
    setting_origin: '预览时优先显示原图（慢）',
    setting_previewDelay: '延迟显示预览图（毫秒）',
    setting_maxPage: '每次排序时统计的最大页数',
    setting_hideWork: '隐藏收藏数少于设定值的作品',
    setting_hideFav: '排序时隐藏已收藏的作品',
    setting_hideFollowed: '排序时隐藏已关注画师作品',
    setting_clearFollowingCache: '清除缓存',
    setting_clearFollowingCacheHelp: '关注画师信息会在本地保存一天，如果希望立即更新，请点击清除缓存',
    setting_followingCacheCleared: '已清除缓存，请刷新页面。',
    setting_blank: '使用新标签页打开作品详情页',
    setting_turnPage: '使用键盘←→进行翻页（排序后的搜索页）',
    setting_save: '保存设置',
    setting_reset: '重置脚本',
    setting_resetHint: '这会删除所有设置，相当于重新安装脚本，确定要重置吗？',
    setting_novelSort: '小说排序',
    setting_novelMaxPage: '小说排序时统计的最大页数',
    // 搜索时过滤值太高
    sort_noWork: '没有可以显示的作品',
    sort_getWorks: '正在获取第%1/%2页作品',
    sort_getBookmarkCount: '获取收藏数：%1/%2',
    sort_getPublicFollowing: '获取公开关注画师',
    sort_getPrivateFollowing: '获取私有关注画师',
    sort_filtering: '过滤%1收藏量低于%2的作品',
    sort_filteringHideFavorite: '已收藏和',
    sort_fullSizeThumb: '排序后展示全尺寸图片',
    // 小说排序
    nsort_getWorks: '正在获取第1%/2%页作品',
    nsort_sorting: '正在按收藏量排序',
};
// translate by google
Texts[Lang.en_US] = {
    install_title: 'Welcome to PixivPreviewer v',
    install_body: '<div style="position: absolute;left: 50%;top: 30%;font-size: 20px; color: white;transform:translate(-50%,0);"><p style="text-indent: 2em;">Feedback questions and suggestions are welcome! ><a style="color: green;" href="https://greasyfork.org/zh-CN/scripts/30766-pixiv-previewer/feedback" target="_blank">Feedback Page</a><</p><br><p style="text-indent: 2em;">If you are using it for the first time, it is recommended to go to the<a style="color: green;" href="https://greasyfork.org/zh-CN/scripts/30766-pixiv-previewer" target="_blank"> Details Page </a>to see the script introduction.</p></div>',
    setting_language: 'Language',
    setting_preview: 'Preview',
    setting_sort: 'Sorting (Search page)',
    setting_anime: 'Animation download (Preview and Artwork page)',
    setting_origin: 'Display original image when preview (slow)',
    setting_previewDelay: 'Delay of display preview image(Million seconds)',
    setting_maxPage: 'Maximum number of pages counted per sort',
    setting_hideWork: 'Hide works with bookmark count less than set value',
    setting_hideFav: 'Hide favorites when sorting',
    setting_hideFollowed: 'Hide artworks of followed artists when sorting',
    setting_clearFollowingCache: 'Cache',
    setting_clearFollowingCacheHelp: 'The folloing artists info. will be saved locally for one day, if you want to update immediately, please click this to clear cache',
    setting_followingCacheCleared: 'Success, please refresh the page.',
    setting_blank: 'Open works\' details page in new tab',
    setting_turnPage: 'Use ← → to turn pages (Search page)',
    setting_save: 'Save',
    setting_reset: 'Reset',
    setting_resetHint: 'This will delete all settings and set it to default. Are you sure?',
    setting_novelSort: 'Sorting (Novel)',
    setting_novelMaxPage: 'Maximum number of pages counted for novel sorting',
    sort_noWork: 'No works to display',
    sort_getWorks: 'Getting artworks of page: %1 of %2',
    sort_getBookmarkCount: 'Getting bookmark count of artworks：%1 of %2',
    sort_getPublicFollowing: 'Getting public following list',
    sort_getPrivateFollowing: 'Getting private following list',
    sort_filtering: 'Filtering%1works with bookmark count less than %2',
    sort_filteringHideFavorite: ' favorited works and ',
    sort_fullSizeThumb: 'Display not cropped images.',
    nsort_getWorks: 'Getting novels of page: 1% of 2%',
    nsort_sorting: 'Sorting by bookmark cound',
};
// RU: перевод от  vanja-san
Texts[Lang.ru_RU] = {
    install_title: 'Добро пожаловать в PixivPreviewer v',
    install_body: '<div style="position: absolute;left: 50%;top: 30%;font-size: 20px; color: white;transform:translate(-50%,0);"><p style="text-indent: 2em;">Вопросы и предложения приветствуются! ><a style="color: green;" href="https://greasyfork.org/zh-CN/scripts/30766-pixiv-previewer/feedback" target="_blank">Страница обратной связи</a><</p><br><p style="text-indent: 2em;">Если вы используете это впервые, рекомендуется перейти к<a style="color: green;" href="https://greasyfork.org/zh-CN/scripts/30766-pixiv-previewer" target="_blank"> Странице подробностей </a>, чтобы посмотреть введение в скрипт.</p></div>',
    setting_language: 'Язык',
    setting_preview: 'Предпросмотр',
    setting_sort: 'Сортировка (Страница поиска)',
    setting_anime: 'Анимация скачивания (Страницы предпросмотра и Artwork)',
    setting_origin: 'При предпросмотре, показывать изображения с оригинальным качеством (медленно)',
    setting_previewDelay: 'Задержка отображения предпросмотра изображения (Миллион секунд)',
    setting_maxPage: 'Максимальное количество страниц, подсчитанных за сортировку',
    setting_hideWork: 'Скрыть работы с количеством закладок меньше установленного значения',
    setting_hideFav: 'При сортировке, скрыть избранное',
    setting_hideFollowed: 'При сортировке, скрыть работы художников на которых подписаны',
    setting_clearFollowingCache: 'Кэш',
    setting_clearFollowingCacheHelp: 'Следующая информация о художниках будет сохранена локально в течение одного дня, если вы хотите обновить её немедленно, нажмите на эту кнопку, чтобы очистить кэш',
    setting_followingCacheCleared: 'Готово, обновите страницу.',
    setting_blank: 'Открывать страницу с описанием работы на новой вкладке',
    setting_turnPage: 'Использовать ← → для перелистывания страниц (Страница поиска)',
    setting_save: 'Сохранить',
    setting_reset: 'Сбросить',
    setting_resetHint: 'Это удалит все настройки и установит их по умолчанию. Продолжить?',
    setting_novelSort: Texts[Lang.en_US].setting_novelSort,
    setting_novelMaxPage: Texts[Lang.en_US].setting_novelMaxPage,
    sort_noWork: 'Нет работ для отображения',
    sort_getWorks: 'Получение иллюстраций страницы: %1 из %2',
    sort_getBookmarkCount: 'Получение количества закладок artworks：%1 из %2',
    sort_getPublicFollowing: 'Получение публичного списка подписок',
    sort_getPrivateFollowing: 'Получение приватного списка подписок',
    sort_filtering: 'Фильтрация %1 работ с количеством закладок меньше чем %2',
    sort_filteringHideFavorite: ' избранные работы и ',
    sort_fullSizeThumb: 'Показать неотредактированное изображение',
    nsort_getWorks: Texts[Lang.en_US].nsort_getWorks,
    nsort_sorting: Texts[Lang.en_US].nsort_sorting,
};

let LogLevel = {
    None: 0,
    Error: 1,
    Warning: 2,
    Info: 3,
    Elements: 4,
};
function DoLog(level, msgOrElement) {
    if (level <= g_logLevel) {
        let prefix = '%c';
        let param = '';

        if (level == LogLevel.Error) {
            prefix += '[Error]';
            param = 'color:#ff0000';
        } else if (level == LogLevel.Warning) {
            prefix += '[Warning]';
            param = 'color:#ffa500';
        } else if (level == LogLevel.Info) {
            prefix += '[Info]';
            param = 'color:#000000';
        } else if (level == LogLevel.Elements) {
            prefix += 'Elements';
            param = 'color:#000000';
        }

        if (level != LogLevel.Elements) {
            console.log(prefix + msgOrElement, param);
        } else {
            console.log(msgOrElement);
        }

        if (++g_logCount > 512) {
            //console.clear();
            g_logCount = 0;
        }
    }
}

// 语言
let g_language = Lang.zh_CN;
// 版本号，第三位不需要跟脚本的版本号对上，第三位更新只有需要弹更新提示的时候才需要更新这里
let g_version = '3.6.0';
// 添加收藏需要这个
let g_csrfToken = '';
// 打的日志数量，超过一定数值清空控制台
let g_logCount = 0;
// 当前页面类型
let g_pageType = -1;
// 图片详情页的链接，使用时替换 #id#
let g_artworkUrl = '/artworks/#id#';
// 获取图片链接的链接
let g_getArtworkUrl = '/ajax/illust/#id#/pages';
// 获取动图下载链接的链接
let g_getUgoiraUrl = '/ajax/illust/#id#/ugoira_meta';
// 获取小说列表的链接
let g_getNovelUrl = '/ajax/search/novels/#key#?word=#key#&p=#page#'
// 鼠标位置
let g_mousePos = { x: 0, y: 0 };
// 加载中图片
let g_loadingImage = 'https://pp-1252089172.cos.ap-chengdu.myqcloud.com/loading.gif';
// 页面打开时的 url
let initialUrl = location.href;
// 默认设置，仅用于首次脚本初始化
let g_defaultSettings = {
    'lang': -1,
    'enablePreview': 1,
    'enableSort': 1,
    'enableAnimeDownload': 1,
    'original': 0,
    'previewDelay': 200,
    'pageCount': 3,
    'favFilter': 0,
    'hideFavorite': 0,
    'hideFollowed': 0,
    'linkBlank': 1,
    'pageByKey': 0,
    'fullSizeThumb': 0,
    'enableNovelSort': 1,
    'novelPageCount': 3,
    'logLevel': 1,
    'version': g_version,
};
// 设置
let g_settings;
// 日志等级
let g_logLevel = LogLevel.Error;
// 排序时同时请求收藏量的 Request 数量，没必要太多，并不会加快速度
let g_maxXhr = 64;
// 排序是否完成（如果排序时页面出现了非刷新切换，强制刷新）
let g_sortComplete = true;

// 页面相关的一些预定义，包括处理页面元素等
let PageType = {
    // 搜索（不包含小说搜索）
    Search: 0,
    // 关注的新作品
    BookMarkNew: 1,
    // 发现
    Discovery: 2,
    // 用户主页
    Member: 3,
    // 首页
    Home: 4,
    // 排行榜
    Ranking: 5,
    // 大家的新作品
    NewIllust: 6,
    // R18
    R18: 7,
    // 自己的收藏页
    BookMark: 8,
    // 动态
    Stacc: 9,
    // 作品详情页（处理动图预览及下载）
    Artwork: 10,
    // 小说页
    NovelSearch: 11,

    // 总数
    PageTypeCount: 12,
};
let Pages = {};
/* Pages 必须实现的函数
 * PageTypeString: string，字符串形式的 PageType
 * bool CheckUrl: function(string url)，用于检查一个 url 是否是当前页面的目标 url
 * ReturnMap ProcessPageElements: function()，处理页面（寻找图片元素、添加属性等），返回 ReturnMap
 * ReturnMap GetProcessedPageElements: function(), 返回上一次 ProcessPageElements 的返回值（如果没有上次调用则调用一次）
 * Object GetToolBar: function(), 返回工具栏元素（右下角那个，用来放设置按钮）
 * HasAutoLoad: bool，表示这个页面是否有自动加载功能
 */
let ReturnMapSample = {
    // 页面是否加载完成，false 意味着后面的成员无效
    loadingComplete: false,
    // 控制元素，每个图片的鼠标响应元素
    controlElements: [],
    // 可有可无，如果为 true，强制重新刷新预览功能
    forceUpdate: false,
};
let ControlElementsAttributesSample = {
    // 图片信息，内容如下：
    // [必需] 图片 id
    illustId: 0,
    // [必需] 图片类型（0：普通图片，2：动图）
    illustType: 0,
    // [必需] 页数
    pageCount: 1,
    // [可选] 标题
    title: '',
    // [可选] 作者 id
    userId: 0,
    // [可选] 作者昵称
    userName: '',
    // [可选] 收藏数
    bookmarkCount: 0,
};

function findToolbarCommon() {
    // 目前第三级div，除了目标div外，子元素都是div
    return $('#root>div>div>ul').get(0);
}
function findToolbarOld() {
    return $('._toolmenu').get(0);
}
function convertThumbUrlToSmall(thumbUrl) {
    // 目前发现有以下两种格式的缩略图
    // https://i.pximg.net/c/128x128/custom-thumb/img/2021/01/31/20/35/53/87426718_p0_custom1200.jpg
    // https://i.pximg.net/c/128x128/img-master/img/2021/01/31/10/57/06/87425082_p0_square1200.jpg
    let replace1 = 'c/540x540_70/img-master';
    //let replace1 = 'img-master'; // 这个是转到regular的，比small的大多了，会很慢
    let replace2 = '_master';
    return thumbUrl.replace(/c\/.*\/custom-thumb/, replace1).replace('_custom', replace2)
        .replace(/c\/.*\/img-master/, replace1).replace('_square', replace2);
}

Pages[PageType.Search] = {
    PageTypeString: 'SearchPage',
    CheckUrl: function (url) {
        // 没有 /artworks 的页面不支持
        return /^https?:\/\/www.pixiv.net\/tags\/.*\/(artworks|illustrations|manga)/.test(url) ||
            /^https?:\/\/www.pixiv.net\/en\/tags\/.*\/(artworks|illustrations|manga)/.test(url);
    },
    ProcessPageElements: function () {
        let returnMap = {
            loadingComplete: false,
            controlElements: [],
        };

        let sections = $('section');
        DoLog(LogLevel.Info, 'Page has ' + sections.length + ' <section>.');
        DoLog(LogLevel.Elements, sections);
        // 先对 section 进行评分
        let sectionIndex = -1;
        let bestScore = -99;
        sections.each(function (i, e) {
            let section = $(e);
            let score = 0;
            if (section.find('ul').length > 0) {
                let childrenCount = section.children().length;
                if (childrenCount != 2) {
                    DoLog(LogLevel.Warning, '<ul> was found in this <section>, but it has ' + childrenCount + ' children!');
                    score--;
                }
                let ul = section.find('ul');
                if (ul.length > 1) {
                    DoLog(LogLevel.Warning, 'This section has more than one <ul>?');
                    score--;
                }
                if ($(ul.parent().get(0)).css('display') == 'none' || $(ul.get(0)).css('display') == 'none') {
                    DoLog(LogLevel.Info, '<ul> or it\'s parentNode is not visible now, continue waiting.');
                    sectionIndex = -1;
                    bestScore = 999;
                    return false;
                }
                if ($(ul.get(0)).next().length === 0) {
                    DoLog(LogLevel.Info, 'Page selector not exists, continue waiting.');
                    sectionIndex = -1;
                    bestScore = 999;
                    return false;
                }
                let lis = ul.find('li');
                if (lis.length === 0) {
                    DoLog(LogLevel.Info, 'This <ul> has 0 children, will be skipped.');
                    return false;
                }
                if ($(lis.get(0)).find('figure').length > 0) {
                    DoLog(LogLevel.Warning, '<figure> was found in the first <li>, continue waiting.');
                    sectionIndex = -1;
                    bestScore = 999;
                    return false;
                }
                if (lis.length > 4) {
                    score += 5;
                }
                // 正确的会在后面
                if (score >= bestScore) {
                    bestScore = score;
                    sectionIndex = i;
                }
            } else {
                DoLog(LogLevel.Info, 'This section(' + i + ' is not has <ul>, will be skipped.');
            }
        });

        if (sectionIndex == -1) {
            if (bestScore < 100) {
                DoLog(LogLevel.Error, 'No suitable <section>!');
            }
            return returnMap;
        }

        let lis = $(sections[sectionIndex]).find('ul').find('li');
        lis.each(function (i, e) {
            let li = $(e);

            // 只填充必须的几个，其他的目前用不着
            let ctlAttrs = {
                illustId: 0,
                illustType: 0,
                pageCount: 1,
            };

            let img = $(li.find('img').get(0));
            let imageLink = img.parent().parent();
            let additionDiv = img.parent().prev();
            let animationSvg = img.parent().find('svg');
            let pageCountSpan = additionDiv.find('span');

            if (img == null || imageLink == null) {
                DoLog(LogLevel.Warning, 'Can not found img or imageLink, skip this.');
                return;
            }

            let link = imageLink.attr('href');
            if (link == null) {
                DoLog(LogLevel.Warning, 'Invalid href, skip this.');
                return;
            }
            let linkMatched = link.match(/artworks\/(\d+)/);
            let illustId = '';
            if (linkMatched) {
                ctlAttrs.illustId = linkMatched[1];
            } else {
                DoLog(LogLevel.Error, 'Get illustId failed, skip this list item!');
                return;
            }
            if (animationSvg.length > 0) {
                ctlAttrs.illustType = 2;
            }
            if (pageCountSpan.length > 0) {
                ctlAttrs.pageCount = parseInt(pageCountSpan.text());
            }

            // 添加 attr
            let control = li.children('div:first').children('div:first');
            control.attr({
                'illustId': ctlAttrs.illustId,
                'illustType': ctlAttrs.illustType,
                'pageCount': ctlAttrs.pageCount
            });

            control.addClass('pp-control');
        });
        returnMap.controlElements = $('.pp-control');
        this.private.pageSelector = $($(sections[sectionIndex]).find('ul').get(0)).next().get(0);
        returnMap.loadingComplete = true;
        this.private.imageListConrainer = $(sections[sectionIndex]).find('ul').get(0);

        DoLog(LogLevel.Info, 'Process page elements complete.');
        DoLog(LogLevel.Elements, returnMap);

        this.private.returnMap = returnMap;
        return returnMap;
    },
    GetProcessedPageElements: function () {
        if (this.private.returnMap == null) {
            return this.ProcessPageElements();
        }
        return this.private.returnMap;
    },
    GetToolBar: function () {
        return findToolbarCommon();
    },
    // 搜索页有 lazyload，不开排序的情况下，最后几张图片可能会无法预览。这里把它当做自动加载处理
    HasAutoLoad: true,
    GetImageListContainer: function () {
        return this.private.imageListConrainer;
    },
    GetFirstImageElement: function () {
        return $(this.private.imageListConrainer).find('li').get(0);
    },
    GetPageSelector: function () {
        return this.private.pageSelector;
    },
    private: {
        imageListContainer: null,
        pageSelector: null,
        returnMap: null,
    },
};
Pages[PageType.BookMarkNew] = {
    PageTypeString: 'BookMarkNewPage',
    CheckUrl: function (url) {
        return /^https:\/\/www.pixiv.net\/bookmark_new_illust.php.*/.test(url) ||
            /^https:\/\/www.pixiv.net\/bookmark_new_illust_r18.php.*/.test(url);
    },
    ProcessPageElements: function () {
        let returnMap = {
            loadingComplete: false,
            controlElements: [],
        };

        let containerDiv = $('#js-mount-point-latest-following').children('div:first');
        if (containerDiv.length > 0) {
            DoLog(LogLevel.Info, 'Found container div.');
            DoLog(LogLevel.Elements, containerDiv);
        } else {
            DoLog(LogLevel.Error, 'Can not found container div.');
            return returnMap;
        }

        containerDiv.children().each(function (i, e) {
            let _this = $(e);

            let figure = _this.find('figure');
            if (figure.length === 0) {
                DoLog(LogLevel.Warning, 'Can not found <fingure>, skip this element.');
                return;
            }

            let link = figure.children('div:first').children('a:first');
            if (link.length === 0) {
                DoLog(LogLevel.Warning, 'Can not found <a>, skip this element.');
                return;
            }

            let ctlAttrs = {
                illustId: 0,
                illustType: 0,
                pageCount: 1,
            };

            let href = link.attr('href');
            if (href == null || href === '') {
                DoLog(LogLevel.Warning, 'No href found, skip.');
                return;
            } else {
                let matched = href.match(/artworks\/(\d+)/);
                if (matched) {
                    ctlAttrs.illustId = matched[1];
                } else {
                    DoLog(LogLevel.Warning, 'Can not found illust id, skip.');
                    return;
                }
            }

            if (link.children().length > 1) {
                if (link.children('div:first').find('span').length > 0) {
                    let span = link.children('div:first').children('span:first');
                    if (span.length === 0) {
                        DoLog(LogLevel.Warning, 'Can not found <span>, skip this element.');
                        return;
                    }
                    ctlAttrs.pageCount = span.text();
                } else {
                    ctlAttrs.illustType = 2;
                }
            }

            let control = figure.children('div:first');
            control.attr({
                'illustId': ctlAttrs.illustId,
                'illustType': ctlAttrs.illustType,
                'pageCount': ctlAttrs.pageCount
            });

            returnMap.controlElements.push(control.get(0));
        });

        DoLog(LogLevel.Info, 'Process page elements complete.');
        DoLog(LogLevel.Elements, returnMap);

        returnMap.loadingComplete = true;
        this.private.returnMap = returnMap;
        return returnMap;
    },
    GetProcessedPageElements: function () {
        if (this.private.returnMap == null) {
            return this.ProcessPageElements();
        }
        return this.private.returnMap;
    },
    GetToolBar: function () {
        return findToolbarOld();
    },
    HasAutoLoad: false,
    private: {
        returnMap: null,
    },
};
Pages[PageType.Discovery] = {
    PageTypeString: 'DiscoveryPage',
    CheckUrl: function (url) {
        return /^https?:\/\/www.pixiv.net\/discovery.*/.test(url);
    },
    ProcessPageElements: function () {
        let returnMap = {
            loadingComplete: false,
            controlElements: [],
        };

        let containerDiv = $('.gtm-illust-recommend-zone');
        if (containerDiv.length > 0) {
            DoLog(LogLevel.Info, 'Found container div.');
            DoLog(LogLevel.Elements, containerDiv);
        } else {
            DoLog(LogLevel.Error, 'Can not found container div.');
            return returnMap;
        }

        containerDiv.children().each(function (i, e) {
            let _this = $(e);

            let figure = _this.find('figure');
            if (figure.length === 0) {
                DoLog(LogLevel.Warning, 'Can not found <fingure>, skip this element.');
                return;
            }

            let link = figure.children('div:first').children('a:first');
            if (link.length === 0) {
                DoLog(LogLevel.Warning, 'Can not found <a>, skip this element.');
                return;
            }

            let ctlAttrs = {
                illustId: 0,
                illustType: 0,
                pageCount: 1,
            };

            let href = link.attr('href');
            if (href == null || href === '') {
                DoLog(LogLevel.Warning, 'No href found, skip.');
                return;
            } else {
                let matched = href.match(/artworks\/(\d+)/);
                if (matched) {
                    ctlAttrs.illustId = matched[1];
                } else {
                    DoLog(LogLevel.Warning, 'Can not found illust id, skip.');
                    return;
                }
            }

            if (link.children().length > 1) {
                if (link.children('div:first').find('span').length > 0) {
                    let span = link.children('div:first').children('span:first');
                    if (span.length === 0) {
                        DoLog(LogLevel.Warning, 'Can not found <span>, skip this element.');
                        return;
                    }
                    ctlAttrs.pageCount = span.text();
                } else if (link.children('div:last').css('background-image').indexOf('.svg') != -1) {
                    ctlAttrs.illustType = 2;
                }
            }

            let control = figure.children('div:first');
            control.attr({
                'illustId': ctlAttrs.illustId,
                'illustType': ctlAttrs.illustType,
                'pageCount': ctlAttrs.pageCount
            });

            returnMap.controlElements.push(control.get(0));
        });

        DoLog(LogLevel.Info, 'Process page elements complete.');
        DoLog(LogLevel.Elements, returnMap);

        returnMap.loadingComplete = true;
        this.private.returnMap = returnMap;
        return returnMap;
    },
    GetProcessedPageElements: function () {
        if (this.private.returnMap == null) {
            return this.ProcessPageElements();
        }
        return this.private.returnMap;
    },
    GetToolBar: function () {
        return findToolbarOld();
    },
    HasAutoLoad: true,
    private: {
        returnMap: null,
    },
};
Pages[PageType.Member] = {
    PageTypeString: 'MemberPage/MemberIllustPage/MemberBookMark',
    CheckUrl: function (url) {
        return /^https?:\/\/www.pixiv.net\/users\/\d+/.test(url);
    },
    ProcessPageElements: function () {
        let returnMap = {
            loadingComplete: false,
            controlElements: [],
        };

        let sections = $('section');
        DoLog(LogLevel.Info, 'Page has ' + sections.length + ' <section>.');
        DoLog(LogLevel.Elements, sections);

        let lis = sections.find('ul').find('li');
        lis.each(function (i, e) {
            let li = $(e);

            // 只填充必须的几个，其他的目前用不着
            let ctlAttrs = {
                illustId: 0,
                illustType: 0,
                pageCount: 1,
            };

            let img = $(li.find('img').get(0));
            let imageLink = img.parent().parent();
            let additionDiv = img.parent().prev();
            let animationSvg = img.parent().find('svg');
            let pageCountSpan = additionDiv.find('span');

            if (!img || !imageLink) {
                DoLog(LogLevel.Warning, 'Can not found img or imageLink, skip this.');
                return;
            }

            let link = imageLink.attr('href');
            if (link == null) {
                DoLog(LogLevel.Warning, 'Can not found illust id, skip this.');
                return;
            }

            let linkMatched = link.match(/artworks\/(\d+)/);
            let illustId = '';
            if (linkMatched) {
                ctlAttrs.illustId = linkMatched[1];
            } else {
                DoLog(LogLevel.Error, 'Get illustId failed, skip this list item!');
                return;
            }
            if (animationSvg.length > 0) {
                ctlAttrs.illustType = 2;
            }
            if (pageCountSpan.length > 0) {
                ctlAttrs.pageCount = parseInt(pageCountSpan.text());
            }

            // 添加 attr
            let control = li.children('div:first').children('div:first');
            if (control.length === 0) {
                control = li.children('div:last').children('div:first');
            }
            control.attr({
                'illustId': ctlAttrs.illustId,
                'illustType': ctlAttrs.illustType,
                'pageCount': ctlAttrs.pageCount
            });

            control.addClass('pp-control');
        });
        returnMap.controlElements = $('.pp-control');
        returnMap.loadingComplete = true;

        DoLog(LogLevel.Info, 'Process page elements complete.');
        DoLog(LogLevel.Elements, returnMap);

        this.private.returnMap = returnMap;
        return returnMap;
    },
    GetProcessedPageElements: function () {
        if (this.private.returnMap == null) {
            return this.ProcessPageElements();
        }
        return this.private.returnMap;
    },
    GetToolBar: function () {
        return findToolbarCommon();
    },
    // 跟搜索页一样的情况
    HasAutoLoad: true,
    private: {
        returnMap: null,
    },
};
Pages[PageType.Home] = {
    PageTypeString: 'HomePage',
    CheckUrl: function (url) {
        return /https?:\/\/www.pixiv.net\/?$/.test(url) ||
            /https?:\/\/www.pixiv.net\/en\/?$/.test(url);
    },
    ProcessPageElements: function () {
        let returnMap = {
            loadingComplete: false,
            controlElements: [],
            forceUpdate: false,
        };

        let illust_div = $('div[type="illust"]');

        DoLog(LogLevel.Info, 'This page has ' + illust_div.length + ' illust <div>.');
        if (illust_div.length < 1) {
            DoLog(LogLevel.Warning, 'Less than one <div>, continue waiting.');
            return returnMap;
        }

        // 实际里面还套了一个 div，处理一下，方便一点
        let illust_div_c = [];
        illust_div.each(function (i, e) {
            illust_div_c.push($(e).children('div:first'));
        });
        illust_div = illust_div_c;
        $.each(illust_div, function (i, e) {
            let _this = $(e);

            let a = _this.children('a:first');
            if (a.length == 0 || a.attr('href').indexOf('artworks') == -1) {
                DoLog(LogLevel.Warning, 'No href or an invalid href was found, skip this.');
                return;
            }

            let ctlAttrs = {
                illustId: 0,
                illustType: 0,
                pageCount: 1,
            };

            let illustId = a.attr('href').match(/\d+/);
            if (illustId == null) {
                DoLog(LogLevel.Warning, 'Can not found illust id of this image, skip.');
                return;
            } else {
                ctlAttrs.illustId = illustId[0];
            }
            let pageCount = a.children('div:first').find('span');
            if (pageCount.length > 0) {
                ctlAttrs.pageCount = parseInt($(pageCount.get(pageCount.length - 1)).text());
            }
            if ($(a.children('div').get(1)).find('svg').length > 0) {
                ctlAttrs.illustType = 2;
            }

            let control = a;
            if (control.attr('illustId') != ctlAttrs.illustId) {
                returnMap.forceUpdate = true;
            }
            control.attr({
                'illustId': ctlAttrs.illustId,
                'illustType': ctlAttrs.illustType,
                'pageCount': ctlAttrs.pageCount
            });

            returnMap.controlElements.push(control.get(0));
        });

        DoLog(LogLevel.Info, 'Process page elements complete.');
        DoLog(LogLevel.Elements, returnMap);

        returnMap.loadingComplete = true;
        this.private.returnMap = returnMap;
        return returnMap;
    },
    GetProcessedPageElements: function () {
        if (this.private.returnMap == null) {
            return this.ProcessPageElements();
        }
        return this.private.returnMap;
    },
    GetToolBar: function () {
        return findToolbarCommon();
    },
    HasAutoLoad: true,
    private: {
        returnMap: null,
    },
};
Pages[PageType.Ranking] = {
    PageTypeString: 'RankingPage',
    CheckUrl: function (url) {
        return /^https?:\/\/www.pixiv.net\/ranking.php.*/.test(url);
    },
    ProcessPageElements: function () {
        let returnMap = {
            loadingComplete: false,
            controlElements: [],
        };

        let works = $('._work');

        DoLog(LogLevel.Info, 'Found .work, length: ' + works.length);
        DoLog(LogLevel.Elements, works);

        works.each(function (i, e) {
            let _this = $(e);

            let ctlAttrs = {
                illustId: 0,
                illustType: 0,
                pageCount: 1,
            };

            let href = _this.attr('href');

            if (href == null || href === '') {
                DoLog('Can not found illust id, skip this.');
                return;
            }

            let matched = href.match(/artworks\/(\d+)/);
            if (matched) {
                ctlAttrs.illustId = matched[1];
            } else {
                DoLog('Can not found illust id, skip this.');
                return;
            }

            if (_this.hasClass('multiple')) {
                ctlAttrs.pageCount = _this.find('.page-count').find('span').text();
            }

            if (_this.hasClass('ugoku-illust')) {
                ctlAttrs.illustType = 2;
            }

            // 添加 attr
            _this.attr({
                'illustId': ctlAttrs.illustId,
                'illustType': ctlAttrs.illustType,
                'pageCount': ctlAttrs.pageCount
            });

            returnMap.controlElements.push(e);
        });

        returnMap.loadingComplete = true;

        DoLog(LogLevel.Info, 'Process page elements complete.');
        DoLog(LogLevel.Elements, returnMap);

        this.private.returnMap = returnMap;
        return returnMap;
    },
    GetProcessedPageElements: function () {
        if (this.private.returnMap == null) {
            return this.ProcessPageElements();
        }
        return this.private.returnMap;
    },
    GetToolBar: function () {
        return findToolbarOld();
    },
    HasAutoLoad: false,
    private: {
        returnMap: null,
    },
};
Pages[PageType.NewIllust] = {
    PageTypeString: 'NewIllustPage',
    CheckUrl: function (url) {
        return /^https?:\/\/www.pixiv.net\/new_illust.php.*/.test(url);
    },
    ProcessPageElements: function () {
        let returnMap = {
            loadingComplete: false,
            controlElements: [],
        };

        let ul = $('#root').find('ul:first');
        if (ul.length === 0) {
            DoLog(LogLevel.Error, 'Can not found <ul>!');
            return returnMap;
        }

        ul.find('li').each(function (i, e) {
            let _this = $(e);

            let link = _this.find('a:first');
            let href = link.attr('href');
            if (href == null || href === '') {
                DoLog(LogLevel.Error, 'Can not found illust id, skip this.');
                return;
            }

            let ctlAttrs = {
                illustId: 0,
                illustType: 0,
                pageCount: 1,
            };

            let matched = href.match(/artworks\/(\d+)/);
            if (matched) {
                ctlAttrs.illustId = matched[1];
            } else {
                DoLog(LogLevel.Warning, 'Can not found illust id, skip this.');
                return;
            }

            if (link.children().length > 1) {
                let span = link.find('svg').parent().parent().next();
                if (span.length > 0 && span.get(0).tagName == 'SPAN') {
                    ctlAttrs.pageCount = span.text();
                } else if (link.find('svg').length > 0) {
                    ctlAttrs.illustType = 2;
                }
            }

            let control = _this.children('div:first').children('div:first');
            control.attr({
                'illustId': ctlAttrs.illustId,
                'illustType': ctlAttrs.illustType,
                'pageCount': ctlAttrs.pageCount
            });

            returnMap.controlElements.push(control.get(0));
        });

        returnMap.loadingComplete = true;

        DoLog(LogLevel.Info, 'Process page elements complete.');
        DoLog(LogLevel.Elements, returnMap);

        this.private.returnMap = returnMap;
        return returnMap;
    },
    GetProcessedPageElements: function () {
        if (this.private.returnMap == null) {
            return this.ProcessPageElements();
        }
        return this.private.returnMap;
    },
    GetToolBar: function () {
        return findToolbarCommon();
    },
    HasAutoLoad: true,
    private: {
        returnMap: null,
    },
};
Pages[PageType.R18] = {
    PageTypeString: 'R18Page',
    CheckUrl: function (url) {
        return /^https?:\/\/www.pixiv.net\/cate_r18.php.*/.test(url);
    },
    ProcessPageElements: function () {
        //
    },
    GetToolBar: function () {
        //
    },
    HasAutoLoad: false,
};
Pages[PageType.BookMark] = {
    PageTypeString: 'BookMarkPage',
    CheckUrl: function (url) {
        return /^https:\/\/www.pixiv.net\/bookmark.php\/?$/.test(url);
    },
    ProcessPageElements: function () {
        let returnMap = {
            loadingComplete: false,
            controlElements: [],
        };

        let images = $('.image-item');
        DoLog(LogLevel.Info, 'Found images, length: ' + images.length);
        DoLog(LogLevel.Elements, images);

        images.each(function (i, e) {
            let _this = $(e);

            let work = _this.find('._work');
            if (work.length === 0) {
                DoLog(LogLevel.Warning, 'Can not found ._work, skip this.');
                return;
            }

            let ctlAttrs = {
                illustId: 0,
                illustType: 0,
                pageCount: 1,
            };

            let href = work.attr('href');
            if (href == null || href === '') {
                DoLog(LogLevel.Warning, 'Can not found illust id, skip this.');
                return;
            }

            let matched = href.match(/artworks\/(\d+)/);
            if (matched) {
                ctlAttrs.illustId = matched[1];
            } else {
                DoLog(LogLevel.Warning, 'Can not found illust id, skip this.');
                return;
            }

            if (work.hasClass('multiple')) {
                ctlAttrs.pageCount = _this.find('.page-count').find('span').text();
            }

            if (work.hasClass('ugoku-illust')) {
                ctlAttrs.illustType = 2;
            }

            // 添加 attr
            let control = _this.children('a:first');
            control.attr({
                'illustId': ctlAttrs.illustId,
                'illustType': ctlAttrs.illustType,
                'pageCount': ctlAttrs.pageCount
            });

            returnMap.controlElements.push(control.get(0));
        });

        returnMap.loadingComplete = true;

        DoLog(LogLevel.Info, 'Process page elements complete.');
        DoLog(LogLevel.Elements, returnMap);

        this.private.returnMap = returnMap;
        return returnMap;
    },
    GetProcessedPageElements: function () {
        if (this.private.returnMap == null) {
            return this.ProcessPageElements();
        }
        return this.private.returnMap;
    },
    GetToolBar: function () {
        return findToolbarOld();
    },
    HasAutoLoad: false,
    private: {
        returnMap: null,
    },
};
Pages[PageType.Stacc] = {
    PageTypeString: 'StaccPage',
    CheckUrl: function (url) {
        return /^https:\/\/www.pixiv.net\/stacc.*/.test(url);
    },
    ProcessPageElements: function () {
        let returnMap = {
            loadingComplete: false,
            controlElements: [],
        };

        let works = $('._work');

        DoLog(LogLevel.Info, 'Found .work, length: ' + works.length);
        DoLog(LogLevel.Elements, works);

        works.each(function (i, e) {
            let _this = $(e);

            let ctlAttrs = {
                illustId: 0,
                illustType: 0,
                pageCount: 1,
            };

            let href = _this.attr('href');

            if (href == null || href === '') {
                DoLog('Can not found illust id, skip this.');
                return;
            }

            let matched = href.match(/illust_id=(\d+)/);
            if (matched) {
                ctlAttrs.illustId = matched[1];
            } else {
                DoLog('Can not found illust id, skip this.');
                return;
            }

            if (_this.hasClass('multiple')) {
                ctlAttrs.pageCount = _this.find('.page-count').find('span').text();
            }

            if (_this.hasClass('ugoku-illust')) {
                ctlAttrs.illustType = 2;
            }

            // 添加 attr
            _this.attr({
                'illustId': ctlAttrs.illustId,
                'illustType': ctlAttrs.illustType,
                'pageCount': ctlAttrs.pageCount
            });

            returnMap.controlElements.push(e);
        });

        returnMap.loadingComplete = true;

        DoLog(LogLevel.Info, 'Process page elements complete.');
        DoLog(LogLevel.Elements, returnMap);

        this.private.returnMap = returnMap;
        return returnMap;
    },
    GetProcessedPageElements: function () {
        if (this.private.returnMap == null) {
            return this.ProcessPageElements();
        }
        return this.private.returnMap;
    },
    GetToolBar: function () {
        return findToolbarOld();
    },
    HasAutoLoad: true,
    private: {
        returnMap: null,
    },
};
Pages[PageType.Artwork] = {
    PageTypeString: 'ArtworkPage',
    CheckUrl: function (url) {
        return /^https:\/\/www.pixiv.net\/artworks\/.*/.test(url) ||
            /^https:\/\/www.pixiv.net\/en\/artworks\/.*/.test(url);
    },
    ProcessPageElements: function () {
        let returnMap = {
            loadingComplete: false,
            controlElements: [],
        };

        // 是动图
        let canvas = $('main').find('figure').find('canvas');
        if ($('main').find('figure').find('canvas').length > 0) {
            this.private.needProcess = true;
            canvas.addClass('pp-canvas');
        }

        if (location.href.indexOf('#preview') == -1) {
            // 相关作品，container找不到说明还没加载
            let containerDiv = $('.gtm-illust-recommend-zone');
            if (containerDiv.length > 0) {
                DoLog(LogLevel.Info, 'Found container div.');
                DoLog(LogLevel.Elements, containerDiv);

                containerDiv.find('ul:first').children().each(function (i, e) {
                    let _this = $(e);

                    let img = _this.find('img');
                    if (img.length === 0) {
                        DoLog(LogLevel.Warning, 'Can not found <img>, skip this element.');
                        return;
                    }

                    let link = _this.find('a:first');
                    if (link.length === 0) {
                        DoLog(LogLevel.Warning, 'Can not found <a>, skip this element.');
                        return;
                    }

                    let ctlAttrs = {
                        illustId: 0,
                        illustType: 0,
                        pageCount: 1,
                    };

                    let href = link.attr('href');
                    if (href == null || href === '') {
                        DoLog(LogLevel.Warning, 'No href found, skip.');
                        return;
                    } else {
                        let matched = href.match(/artworks\/(\d+)/);
                        if (matched) {
                            ctlAttrs.illustId = matched[1];
                        } else {
                            DoLog(LogLevel.Warning, 'Can not found illust id, skip.');
                            return;
                        }
                    }

                    if (link.children().length > 1) {
                        if (link.children('div:first').find('span').length > 0) {
                            let span = link.children('div:first').find('span:first');
                            if (span.length === 0) {
                                DoLog(LogLevel.Warning, 'Can not found <span>, skip this element.');
                                return;
                            }
                            ctlAttrs.pageCount = span.next().text();
                        } else if (link.children('div:last').find('svg').length > 0) {
                            ctlAttrs.illustType = 2;
                        }
                    }

                    let control = link.parent();
                    control.attr({
                        'illustId': ctlAttrs.illustId,
                        'illustType': ctlAttrs.illustType,
                        'pageCount': ctlAttrs.pageCount
                    });

                    returnMap.controlElements.push(control.get(0));
                });
            }

            DoLog(LogLevel.Info, 'Process page elements complete.');
            DoLog(LogLevel.Elements, returnMap);
        }

        returnMap.loadingComplete = true;
        this.private.returnMap = returnMap;
        return returnMap;
    },
    GetProcessedPageElements: function () {
        if (this.private.returnMap == null) {
            return this.ProcessPageElements();
        }
        return this.private.returnMap;
    },
    GetToolBar: function () {
        return findToolbarCommon();
    },
    HasAutoLoad: true,
    Work: function () {
        function AddDownloadButton(button, offsetToOffsetTop) {
            if (!g_settings.enableAnimeDownload) {
                return;
            }

            let cloneButton = button.clone().css({ 'bottom': '50px', 'padding': 0, 'width': '48px', 'height': '48px', 'opacity': '0.4', 'cursor': 'pointer' });
            cloneButton.get(0).innerHTML = '<svg viewBox="0 0 120 120" style="width: 40px; height: 40px; stroke-width: 10; stroke-linecap: round; stroke-linejoin: round; border-radius: 24px; background-color: black; stroke: limegreen; fill: none;" class="_3Fo0Hjg"><polyline points="60,30 60,90"></polyline><polyline points="30,60 60,90 90,60"></polyline></svg></button>';

            function MoveButton() {
                function getOffset(e) {
                    if (e.offsetParent) {
                        let offset = getOffset(e.offsetParent);
                        return {
                            offsetTop: e.offsetTop + offset.offsetTop,
                            offsetLeft: e.offsetLeft + offset.offsetLeft,
                        };
                    } else {
                        return {
                            offsetTop: e.offsetTop,
                            offsetLeft: e.offsetLeft,
                        };
                    }
                }

                /*let offset = getOffset(button.get(0));
                DoLog(LogLevel.Info, 'offset of download button: ' + offset.offsetTop + ', ' + offset.offsetLeft);
                DoLog(LogLevel.Elements, offset);

                cloneButton.css({ 'position': 'absolute' }).show();*/
            }

            MoveButton();
            $(window).on('resize', MoveButton);
            button.after(cloneButton);

            cloneButton.mouseover(function () {
                $(this).css('opacity', '0.2');
            }).mouseleave(function () {
                $(this).css('opacity', '0.4');
            }).click(function () {
                let illustId = '';

                let matched = location.href.match(/artworks\/(\d+)/);
                if (matched) {
                    illustId = matched[1];
                    DoLog(LogLevel.Info, 'IllustId=' + illustId);
                } else {
                    DoLog(LogLevel.Error, 'Can not found illust id!');
                    return;
                }

                $.ajax(g_getUgoiraUrl.replace('#id#', illustId), {
                    method: 'GET',
                    success: function (json) {
                        DoLog(LogLevel.Elements, json);

                        if (json.error == true) {
                            DoLog(LogLevel.Error, 'Server response an error: ' + json.message);
                            return;
                        }

                        // 因为浏览器会拦截不同域的 open 操作，绕一下
                        let newWindow = window.open('_blank');
                        newWindow.location = json.body.originalSrc;
                    },
                    error: function () {
                        DoLog(LogLevel.Error, 'Request zip file failed!');
                    }
                });
            });
        }

        if (this.private.needProcess) {
            let canvas = $('.pp-canvas');

            // 预览模式，需要调成全屏，并且添加下载按钮到全屏播放的 div 里
            if (location.href.indexOf('#preview') != -1) {
                canvas.click();

                $('#root').remove();

                let callbackInterval = setInterval(function () {
                    let div = $('div[role="presentation"]');
                    if (div.length < 1) {
                        return;
                    }

                    DoLog(LogLevel.Info, 'found <div>, continue to next step.');

                    clearInterval(callbackInterval);

                    let presentationCanvas = div.find('canvas');
                    if (presentationCanvas.length < 1) {
                        DoLog(LogLevel.Error, 'Can not found canvas in the presentation div.');
                        return;
                    }

                    let width = 0, height = 0;
                    let tWidth = presentationCanvas.attr('width');
                    let tHeight = presentationCanvas.attr('height');
                    if (tWidth && tHeight) {
                        width = parseInt(tWidth);
                        height = parseInt(tHeight);
                    } else {
                        tWidth = presentationCanvas.css('width');
                        tHeight = presentationCanvas.css('height');
                        width = parseInt(tWidth);
                        height = parseInt(this);
                    }

                    let parent = presentationCanvas.parent();
                    for (let i = 0; i < 3; i++) {
                        parent.get(0).className = '';
                        parent = parent.parent();
                    }
                    presentationCanvas.css({ 'width': width + 'px', 'height': height + 'px', 'cursor': 'default' }).addClass('pp-presentationCanvas');
                    let divForStopClick = $('<div class="pp-disableClick"></div>').css({
                        'width': width + 'px', 'height': height + 'px',
                        'opacity': 0,
                        'position': 'absolute', 'top': '0px', 'left': '0px', 'z-index': 99999,
                    });
                    div.append(divForStopClick);
                    div.append(presentationCanvas.next().css('z-index', 99999));
                    presentationCanvas.next().remove();
                    // 防止预览图消失
                    $('html').addClass('pp-main');

                    // 调整 canvas 大小的函数
                    window.ResizeCanvas = function (newWidth, newHeight) {
                        DoLog(LogLevel.Info, 'Resize canvas: ' + newWidth + 'x' + newHeight);
                        $('.pp-disableClick').css({ 'width': newWidth, 'height': newHeight });
                        $('.pp-presentationCanvas').css({ 'width': newWidth, 'height': newHeight });
                    };
                    window.GetCanvasSize = function () {
                        return {
                            width: width,
                            height: height,
                        };
                    }

                    // 添加下载按钮
                    AddDownloadButton(divForStopClick.next(), 0);

                    window.parent.PreviewCallback(width, height);
                }, 500);
            }
            // 普通模式，只需要添加下载按钮到内嵌模式的 div 里
            else {
                let div = $('div[role="presentation"]:last');
                let button = div.find('button');

                let headerRealHeight = parseInt($('header').css('height')) +
                    parseInt($('header').css('padding-top')) + parseInt($('header').css('padding-bottom')) +
                    parseInt($('header').css('margin-top')) + parseInt($('header').css('margin-bottom')) +
                    parseInt($('header').css('border-bottom-width')) + parseInt($('header').css('border-top-width'));

                AddDownloadButton(button, headerRealHeight);
            }
        }
    },
    private: {
        needProcess: false,
        returnMap: null,
    },
};
Pages[PageType.NovelSearch] = {
    PageTypeString: 'NovelSearchPage',
    CheckUrl: function (url) {
        return /^https:\/\/www.pixiv.net\/tags\/.*\/novels/.test(url) ||
            /^https:\/\/www.pixiv.net\/en\/tags\/.*\/novels/.test(url);
    },
    ProcessPageElements: function () {
        let returnMap = {
            loadingComplete: false,
            controlElements: [],
        };
        let ul = $('section>div>ul');
        if (ul.length > 0) {
            returnMap.loadingComplete = true;
        }
        this.private.returnMap = returnMap;
        return returnMap;
    },
    GetProcessedPageElements: function () {
        if (this.private.returnMap == null) {
            return this.ProcessPageElements();
        }
        return this.private.returnMap;
    },
    GetToolBar: function () {
        return findToolbarCommon();
    },
    GetPageSelector: function() {
        return $('section:first').find('nav:first');
    },
    HasAutoLoad: false,
    private: {
        returnMap: null,
    },
}

function CheckUrlTest() {
    let urls = [
        'http://www.pixiv.net',
        'http://www.pixiv.net',
        'https://www.pixiv.net',
        'https://www.pixiv.net/',
        'https://www.pixiv.net/?lang=en',
        'https://www.pixiv.net/search.php?s_mode=s_tag&word=miku',
        'https://www.pixiv.net/search.php?word=VOCALOID&s_mode=s_tag_full',
        'https://www.pixiv.net/discovery',
        'https://www.pixiv.net/discovery?x=1',
        'https://www.pixiv.net/member.php?id=3207350',
        'https://www.pixiv.net/member_illust.php?id=3207350&type=illust',
        'https://www.pixiv.net/bookmark.php?id=3207350&rest=show',
        'https://www.pixiv.net/ranking.php?mode=daily&content=ugoira',
        'https://www.pixiv.net/ranking.php?mode=daily',
        'https://www.pixiv.net/new_illust.php',
        'https://www.pixiv.net/new_illust.php?x=1',
        'https://www.pixiv.net/cate_r18.php',
        'https://www.pixiv.net/cate_r18.php?x=1',
        'https://www.pixiv.net/bookmark.php',
        'https://www.pixiv.net/bookmark.php?x=1',
        'https://www.pixiv.net/stacc?mode=unify',
        'https://www.pixiv.net/artworks/77996773',
        'https://www.pixiv.net/artworks/77996773#preview',
        'https://www.pixiv.net/tags/miku/novels',
    ];

    for (let j = 0; j < urls.length; j++) {
        for (let i = 0; i < PageType.PageTypeCount; i++) {
            if (Pages[i].CheckUrl(urls[j])) {
                console.log(urls[j]);
                console.log('[' + j + '] is ' + Pages[i].PageTypeString);
            }
        }
    }
}

/* ---------------------------------------- 预览 ---------------------------------------- */
let autoLoadInterval = null;
function PixivPreview() {
    // 最终需要显示的预览图ID，用于避免鼠标滑过多张图片时，最终显示的图片错误
    let previewTargetIllustId = '';

    // 开启预览功能
    function ActivePreview() {
        let returnMap = Pages[g_pageType].GetProcessedPageElements();
        if (!returnMap.loadingComplete) {
            DoLog(LogLevel.Error, 'Page not load, should not call Preview!');
            return;
        }

        // 鼠标进入
        $(returnMap.controlElements).mouseenter(function (e) {
            // 按住 Ctrl键 不显示预览图
            if (e.ctrlKey) {
                return;
            }

            let startTime = new Date().getTime();
            let delay = parseInt(g_settings.previewDelay == null ? g_defaultSettings.previewDelay : g_settings.previewDelay);

            let _this = $(this);
            let illustId = _this.attr('illustId');
            let illustType = _this.attr('illustType');
            let pageCount = _this.attr('pageCount');

            if (illustId == null) {
                DoLog(LogLevel.Error, 'Can not found illustId in this element\'s attrbutes.');
                return;
            }
            if (illustType == null) {
                DoLog(LogLevel.Error, 'Can not found illustType in this element\'s attrbutes.');
                return;
            }
            if (pageCount == null) {
                DoLog(LogLevel.Error, 'Can not found pageCount in this element\'s attrbutes.');
                return;
            }
            previewTargetIllustId = illustId;

            // 鼠标位置
            g_mousePos = { x: e.pageX, y: e.pageY };
            // 预览 Div
            let previewDiv = $(document.createElement('div')).addClass('pp-main').attr('illustId', illustId)
                .css({
                    'position': 'absolute', 'z-index': '999999', 'left': g_mousePos.x + 'px', 'top': g_mousePos.y + 'px',
                    'border-style': 'solid', 'border-color': '#6495ed', 'border-width': '2px', 'border-radius': '20px',
                    'width': '48px', 'height': '48px',
                    'background-image': 'url(https://pp-1252089172.cos.ap-chengdu.myqcloud.com/transparent.png)',
                    'display': 'none'
                });
            // 添加到 body
            $('.pp-main').remove();
            $('body').append(previewDiv);

            let waitTime = delay - (new Date().getTime() - startTime);
            if (waitTime > 0) {
                setTimeout(function () {
                    previewDiv.show();
                }, waitTime);
            } else {
                previewDiv.show();
            }

            // 加载中图片
            let loadingImg = $(new Image()).addClass('pp-loading').attr('src', g_loadingImage).css({
                'position': 'absolute', 'border-radius': '20px',
            });
            previewDiv.append(loadingImg);

            // 要显示的预览图节点
            let loadImg = $(new Image()).addClass('pp-image').css({ 'height': '0px', 'width': '0px', 'display': 'none', 'border-radius': '20px' });
            previewDiv.append(loadImg);

            // 原图（笑脸）图标
            let originIcon = $(new Image()).addClass('pp-original').attr('src', 'https://source.pixiv.net/www/images/pixivcomic-favorite.png')
                .css({ 'position': 'absolute', 'bottom': '5px', 'right': '5px', 'display': 'none' });
            previewDiv.append(originIcon);

            // 点击图标新网页打开原图
            originIcon.click(function () {
                window.open($(previewDiv).children('img')[1].src);
            });

            // 右上角张数标记
            let pageCountHTML = '<div class="pp-pageCount" style="display: flex;-webkit-box-align: center;align-items: center;box-sizing: border-box;margin-left: auto;height: 20px;color: rgb(255, 255, 255);font-size: 10px;line-height: 12px;font-weight: bold;flex: 0 0 auto;padding: 4px 6px;background: rgba(0, 0, 0, 0.32);border-radius: 10px;margin-top:5px;margin-right:5px;">\<svg viewBox="0 0 9 10" width="9" height="10" style="stroke: none;line-height: 0;font-size: 0px;fill: currentcolor;"><path d="M8,3 C8.55228475,3 9,3.44771525 9,4 L9,9 C9,9.55228475 8.55228475,10 8,10 L3,10 C2.44771525,10 2,9.55228475 2,9 L6,9 C7.1045695,9 8,8.1045695 8,7 L8,3 Z M1,1 L6,1 C6.55228475,1 7,1.44771525 7,2 L7,7 C7,7.55228475 6.55228475,8 6,8 L1,8 C0.44771525,8 0,7.55228475 0,7 L0,2 C0,1.44771525 0.44771525,1 1,1 Z"></path></svg><span style="margin-left:2px;" class="pp-page">0/0</span></div>';
            let pageCountDiv = $(pageCountHTML)
                .css({ 'position': 'absolute', 'top': '0px', 'display': 'none', 'right': '0px', 'display': 'none' });
            previewDiv.append(pageCountDiv);

            $('.pp-main').mouseleave(function (e) {
                $(this).remove();
            });

            let url = '';
            if (illustType == 2) {
                // 动图
                let screenWidth = document.documentElement.clientWidth;
                let screenHeight = document.documentElement.clientHeight;
                previewDiv.get(0).innerHTML = '<iframe class="pp-iframe" style="width: 48px; height: 48px; display: none; border-radius: 20px;" src="https://www.pixiv.net/artworks/' + illustId + '#preview" />';
                previewDiv.append(loadingImg);
            } else {
                url = g_getArtworkUrl.replace('#id#', illustId);

                // 获取图片链接
                $.ajax(url, {
                    method: 'GET',
                    success: function (json) {
                        DoLog(LogLevel.Info, 'Got artwork urls:');
                        DoLog(LogLevel.Elements, json);

                        if (json.error === true) {
                            DoLog(LogLevel.Error, 'Server responsed an error: ' + json.message);
                            return;
                        }

                        // 已经不需要显示这个预览图了，直接丢弃
                        if (illustId != previewTargetIllustId) {
                            DoLog(LogLevel.Info, 'Drop this preview request.');
                            return;
                        }

                        let regular = [];
                        let original = [];
                        for (let i = 0; i < json.body.length; i++) {
                            regular.push(json.body[i].urls.regular);
                            original.push(json.body[i].urls.original);
                        }

                        DoLog(LogLevel.Info, 'Process urls complete.');
                        DoLog(LogLevel.Elements, regular);
                        DoLog(LogLevel.Elements, original);

                        ViewImages(regular, 0, original, g_settings.original, illustId);
                    },
                    error: function (data) {
                        DoLog(LogLevel.Error, 'Request image urls failed!');
                        if (data) {
                            DoLog(LogLevel.Elements, data);
                        }
                    }
                });
            }
        });

        // 鼠标移出图片
        $(returnMap.controlElements).mouseleave(function (e) {
            let _this = $(this);
            let illustId = _this.attr('illustId');
            let illustType = _this.attr('illustType');
            let pageCount = _this.attr('pageCount');

            let moveToElement = $(e.relatedTarget);
            let isMoveToPreviewElement = false;
            // 鼠标移动到预览图上
            while (true) {
                if (moveToElement.hasClass('pp-main') && moveToElement.attr('illustId') == illustId) {
                    isMoveToPreviewElement = true;
                }

                if (moveToElement.parent().length < 1) {
                    break;
                }

                moveToElement = moveToElement.parent();
            }
            if (!isMoveToPreviewElement) {
                // 非预览图上
                $('.pp-main').remove();
            }
        });

        // 鼠标移动，调整位置
        $(returnMap.controlElements).mousemove(function (e) {
            // Ctrl 和 中键 都可以禁止预览图移动，这样就可以单手操作了
            if (e.ctrlKey || e.buttons & 4) {
                return;
            }
            let screenWidth = document.documentElement.clientWidth;
            let screenHeight = document.documentElement.clientHeight;
            g_mousePos.x = e.pageX; g_mousePos.y = e.pageY;

            AdjustDivPosition();
        });

        // 这个页面有自动加载
        if (Pages[g_pageType].HasAutoLoad && autoLoadInterval == null) {
            autoLoadInterval = setInterval(ProcessAutoLoad, 1000);
            DoLog(LogLevel.Info, 'Auto load interval set.');
        }

        // 插一段回调函数
        window.PreviewCallback = PreviewCallback;
        DoLog(LogLevel.Info, 'Callback function was inserted.');
        DoLog(LogLevel.Elements, window.PreviewCallback);

        DoLog(LogLevel.Info, 'Preview enable succeed!');
    }

    // 关闭预览功能，不是给外部用的
    function DeactivePreview() {
        let returnMap = Pages[g_pageType].GetProcessedPageElements();
        if (!returnMap.loadingComplete) {
            DoLog(LogLevel.Error, 'Page not load, should not call Preview!');
            return;
        }

        // 只需要取消绑定事件， attrs 以及回调都不需要删除
        $(returnMap.controlElements).unbind('mouseenter').unbind('mouseleave').unbind('mousemove');

        if (autoLoadInterval) {
            clearInterval(autoLoadInterval);
            autoLoadInterval = null;
        }

        DoLog(LogLevel.Info, 'Preview disable succeed!');
    }

    // iframe 的回调函数
    function PreviewCallback(canvasWidth, canvasHeight) {
        DoLog(LogLevel.Info, 'iframe callback, width: ' + canvasWidth + ', height: ' + canvasHeight);

        let size = AdjustDivPosition();

        $('.pp-loading').hide();
        $('.pp-iframe').css({ 'width': size.width, 'height': size.height }).show();
    }

    // 调整预览 Div 的位置
    function AdjustDivPosition() {
        // 鼠标到预览图的距离
        let fromMouseToDiv = 30;

        let screenWidth = document.documentElement.clientWidth;
        let screenHeight = document.documentElement.clientHeight;
        let left = 0;
        let top = document.body.scrollTop + document.documentElement.scrollTop;

        let width = 0, height = 0;
        if ($('.pp-main').find('iframe').length > 0) {
            let iframe = $('.pp-main').find('iframe').get(0);
            if (iframe.contentWindow.GetCanvasSize) {
                let canvasSize = iframe.contentWindow.GetCanvasSize();
                width = canvasSize.width;
                height = canvasSize.height;
            } else {
                width = 0;
                height = 0;
            }
        } else {
            $('.pp-image').css({ 'width': '', 'height': '' });
            width = $('.pp-image').get(0) == null ? 0 : $('.pp-image').get(0).width;
            height = $('.pp-image').get(0) == null ? 0 : $('.pp-image').get(0).height;
        }

        let isShowOnLeft = g_mousePos.x > screenWidth / 2;

        let newWidth = 48, newHeight = 48;
        if (width > 0 && height > 0) {
            newWidth = isShowOnLeft ? g_mousePos.x - fromMouseToDiv : screenWidth - g_mousePos.x - fromMouseToDiv;
            newHeight = height / width * newWidth;
            // 高度不足以完整显示，只能让两侧留空了
            if (newHeight > screenHeight) {
                newHeight = screenHeight;
                newWidth = newHeight / height * width;
            }
            newWidth -= 5;
            newHeight -= 5;

            // 设置新的宽高
            if ($('.pp-main').find('iframe').length > 0) {
                let iframe = $('.pp-main').find('iframe');
                iframe.get(0).contentWindow.ResizeCanvas(newWidth, newHeight);
                iframe.css({ 'width': newWidth, 'height': newHeight });
            }
            else {
                $('.pp-image').css({ 'height': newHeight + 'px', 'width': newWidth + 'px' });
            }

            // 调整下一次 loading 出现的位置
            $('.pp-loading').css({ 'left': newWidth / 2 - 24 + 'px', 'top': newHeight / 2 - 24 + 'px' });
        }

        // 图片宽度大于高度很多时，会显示在页面顶部，鼠标碰不到，把它移动到下面
        if (top + newHeight <= g_mousePos.y) {
            top = (g_mousePos.y - newHeight - fromMouseToDiv);
        }
        // 调整DIV的位置
        left = isShowOnLeft ? g_mousePos.x - newWidth - fromMouseToDiv : g_mousePos.x + fromMouseToDiv;

        $('.pp-main').css({ 'left': left + 'px', 'top': top + 'px', 'width': newWidth, 'height': newHeight });

        // 返回新的宽高
        return {
            width: newWidth,
            height: newHeight,
        };
    }

    // 请求显示的预览图ID
    let displayTargetIllustId = '';
    // 显示预览图
    function ViewImages(regular, index, original, isShowOriginal, illustId) {
        displayTargetIllustId = illustId;
        if (!regular || regular.length === 0) {
            DoLog(LogLevel.Error, 'Regular url array is null, can not view images!');
            return;
        }
        if (index == null || index < 0 || index >= regular.length) {
            DoLog(LogLevel.Error, 'Index(' + index + ') out of range, can not view images!');
            return;
        }
        if (original == null || original.length === 0) {
            DoLog(LogLevel.Warning, 'Original array is null, replace it with regular array.');
            original = regular;
        }
        if (original.length < regular) {
            DoLog(LogLevel.Warning, 'Original array\'s length is less than regular array, replace it with regular array.');
            original = regular;
        }
        if (isShowOriginal == null) {
            isShowOriginal = false;
        }

        if (original.length > 1) {
            $('.pp-page').text((index + 1) + '/' + regular.length);
            $('.pp-pageCount').show();
        }
        if (isShowOriginal) {
            $('.pp-image').addClass('original');
        } else {
            $('.pp-image').removeClass('original');
        }
        g_settings.original = isShowOriginal ? 1 : 0;

        // 隐藏页数和原图标签
        $('.pp-original, .pp-pageCount').hide();

        // 第一次需要绑定事件
        if ($('.pp-image').attr('index') == null || $('.pp-image').attr('pageCount') != regular.length) {
            $('.pp-image').attr('pageCount', regular.length);

            // 绑定点击事件，Ctrl+左键 单击切换原图
            $('.pp-image').on('click', function (ev) {
                let _this = $(this);
                let isOriginal = _this.hasClass('original');
                let index = _this.attr('index');
                if (index == null) {
                    index = 0;
                } else {
                    index = parseInt(index);
                }

                if (ev.ctrlKey) {
                    // 按住 Ctrl 来回切换原图
                    isOriginal = !isOriginal;
                    ViewImages(regular, index, original, isOriginal, illustId);
                }
                else if (ev.shiftKey) {
                    // 按住 Shift 点击图片新标签页打开原图
                    window.open(original[index]);
                } else {
                    if (regular.length == 1) {
                        return;
                    }
                    // 如果是多图，点击切换下一张
                    if (++index >= regular.length) {
                        index = 0;
                    }
                    ViewImages(regular, index, original, isOriginal, illustId);
                    // 预加载
                    for (let i = index + 1; i < regular.length && i <= index + 3; i++) {
                        let image = new Image();
                        image.src = isOriginal ? original[i] : regular[i];;
                    }
                }
            });

            // 图片预加载完成
            $('.pp-image').on('load', function () {
                // 显示图片前也判断一下是不是目标图片
                if (displayTargetIllustId != previewTargetIllustId) {
                    DoLog(LogLevel.Info, '(2)Drop this preview request.');
                    return;
                }

                // 调整图片位置和大小
                let _this = $(this);
                let size = AdjustDivPosition();
                let isShowOriginal = _this.hasClass('original');

                $('.pp-loading').css('display', 'none');
                // 显示图像、页数、原图标签
                $('.pp-image').css('display', '');
                if (regular.length > 1) {
                    $('.pp-pageCount').show();
                }
                if (isShowOriginal) {
                    $('.pp-original').show();
                }

                // 预加载
                for (let i = index + 1; i < regular.length && i <= index + 3; i++) {
                    let image = new Image();
                    image.src = isShowOriginal ? original[i] : regular[i];;
                }
            }).on('error', function () {
                DoLog(LogLevel.Error, 'Load image failed!');
            });
        }

        $('.pp-image').attr('src', isShowOriginal ? original[index] : regular[index]).attr('index', index);
    }

    // 处理自动加载
    function ProcessAutoLoad() {
        if (Pages[g_pageType].GetProcessedPageElements() == null) {
            DoLog(LogLevel.Error, 'Call ProcessPageElements first!');
            return;
        }

        let oldReturnMap = Pages[g_pageType].GetProcessedPageElements();
        let newReturnMap = Pages[g_pageType].ProcessPageElements();

        if (newReturnMap.loadingComplete) {
            if (oldReturnMap.controlElements.length < newReturnMap.controlElements.length || newReturnMap.forceUpdate) {
                DoLog(LogLevel.Info, 'Page loaded ' + (newReturnMap.controlElements.length - oldReturnMap.controlElements.length) + ' new work(s).');

                if (g_settings.linkBlank) {
                    $(newReturnMap.controlElements).find('a').attr('target', '_blank');
                }

                SetTargetBlank(newReturnMap);
                DeactivePreview();
                ActivePreview();

                return;
            } else if (oldReturnMap.controlElements.length > newReturnMap.controlElements.length) {
                DoLog(LogLevel.Warning, 'works become less?');

                Pages[g_pageType].private.returnMap = oldReturnMap;

                return;
            }
        }

        DoLog(LogLevel.Info, 'Page not change.');
    }

    // 开启预览
    ActivePreview();
}
/* ---------------------------------------- 排序 ---------------------------------------- */
let imageElementTemplate = null;
function PixivSK(callback) {
    // 不合理的设定
    if (g_settings.pageCount < 1 || g_settings.favFilter < 0) {
        g_settings.pageCount = 1;
        g_settings.favFilter = 0;
    }
    // 当前已经取得的页面数量
    let currentGettingPageCount = 0;
    // 当前加载的页面 URL
    let currentUrl = 'https://www.pixiv.net/ajax/search/';
    // 当前加载的是第几张页面
    let currentPage = 0;
    // 获取到的作品
    let works = [];

    // 仅搜索页启用
    if (g_pageType != PageType.Search) {
        return;
    }

    // 获取第 currentPage 页的作品
    let getWorks = function (onloadCallback) {
        $('#progress').text(Texts[g_language].sort_getWorks.replace('%1', currentGettingPageCount + 1).replace('%2', g_settings.pageCount));

        let url = currentUrl.replace(/p=\d+/, 'p=' + currentPage);

        if (location.href.indexOf('?') != -1) {
            let param = location.href.split('?')[1];
            param = param.replace(/^p=\d+/, '');
            param = param.replace(/&p=\d+/, '');
            url += '&' + param;
        }

        if (url.indexOf('order=') == -1) {
            url += '&order=date_d';
        }
        if (url.indexOf('mode=') == -1) {
            url += '&mode=all';
        }
        if (url.indexOf('s_mode=') == -1) {
            url += '&s_mode=s_tag_full';
        }

        DoLog(LogLevel.Info, 'getWorks url: ' + url);

        let req = new XMLHttpRequest();
        req.open('GET', url, true);
        req.onload = function (event) {
            onloadCallback(req);
        };
        req.onerror = function (event) {
            DoLog(LogLevel.Error, 'Request search page error!');
        };

        req.send(null);
    };

    function getFollowingOfType(user_id, type, offset) {
        return new Promise(function (resolve, reject) {
            if (offset == null) {
                offset = 0;
            }
            let limit = 100;
            let following_show = [];
            $.ajax('https://www.pixiv.net/ajax/user/' + user_id + '/following?offset=' + offset + '&limit=' + limit + '&rest=' + type, {
                async: true,
                success: function (data) {
                    if (data == null || data.error) {
                        DoLog(LogLevel.Error, 'Following response contains an error.');
                        resolve([]);
                        return;
                    }
                    if (data.body.users.length == 0) {
                        resolve([]);
                        return;
                    }
                    $.each(data.body.users, function (i, user) {
                        following_show.push(user.userId);
                    });
                    getFollowingOfType(user_id, type, offset + limit).then(function (members) {
                        resolve(following_show.concat(members));
                        return;
                    });
                },
                error: function () {
                    DoLog(LogLevel.Error, 'Request following failed.');
                    resolve([]);
                }
            });
        });
    }

    function getFollowingOfCurrentUser() {
        return new Promise(function (resolve, reject) {
            let user_id = '';

            try {
                user_id = dataLayer[0].user_id;
            } catch (ex) {
                DoLog(LogLevel.Error, 'Get user id failed.');
                resolve([]);
                return;
            }

            // show/hide
            $('#progress').text(Texts[g_language].sort_getPublicFollowing);

            // 首先从Cookie读取
            let following = GetCookie('followingOfUid-' + user_id);
            if (following != null) {
                resolve(following);
                return;
            }

            getFollowingOfType(user_id, 'show').then(function (members) {
                $('#progress').text(Texts[g_language].sort_getPrivateFollowing);
                getFollowingOfType(user_id, 'hide').then(function (members2) {
                    let following = members.concat(members2);
                    SetCookie('followingOfUid-' + user_id, following, 1);
                    resolve(following);
                });
            });
        });
    }

    // 筛选已关注画师作品
    let filterByUser = function () {
        return new Promise(function (resolve, reject) {
            if (!g_settings.hideFollowed) {
                resolve();
            }

            getFollowingOfCurrentUser().then(function (members) {
                let tempWorks = [];
                let hideWorkCount = 0;
                $(works).each(function (i, work) {
                    let found = false;
                    for (let i = 0; i < members.length; i++) {
                        if (members[i] == work.userId) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        tempWorks.push(work);
                    } else {
                        hideWorkCount++;
                    }
                });
                works = tempWorks;

                DoLog(LogLevel.Info, hideWorkCount + ' works were hide.');
                DoLog(LogLevel.Elements, works);
                resolve();
            });
        });
    };

    // 排序和筛选
    let filterAndSort = function () {
        return new Promise(function (resolve, reject) {
            DoLog(LogLevel.Info, 'Start sort.');
            DoLog(LogLevel.Elements, works);

            // 收藏量低于 FAV_FILTER 的作品不显示
            let text = Texts[g_language].sort_filtering.replace('%2', g_settings.favFilter);
            text = text.replace('%1', (g_settings.hideFavorite ? Texts[g_language].sort_filteringHideFavorite : ''));
            $('#progress').text(text); // 实际上这个太快完全看不到
            let tmp = [];
            $(works).each(function (i, work) {
                let bookmarkCount = work.bookmarkCount ? work.bookmarkCount : 0;
                if (bookmarkCount >= g_settings.favFilter && !(g_settings.hideFavorite && work.bookmarkData)) {
                    tmp.push(work);
                }
            });
            works = tmp;

            filterByUser().then(function () {
                // 排序
                works.sort(function (a, b) {
                    let favA = a.bookmarkCount;
                    let favB = b.bookmarkCount;
                    if (!favA) {
                        favA = 0;
                    }
                    if (!favB) {
                        favB = 0;
                    }
                    if (favA > favB) {
                        return -1;
                    }
                    if (favA < favB) {
                        return 1;
                    }
                    return 0;
                });
                DoLog(LogLevel.Info, 'Sort complete.');
                DoLog(LogLevel.Elements, works);
                resolve();
            });
        });
    };

    if (currentPage === 0) {
        let url = location.href;

        if (url.indexOf('&p=') == -1 && url.indexOf('?p=') == -1) {
            DoLog(LogLevel.Warning, 'Can not found page in url.');
            if (url.indexOf('?') == -1) {
                url += '?p=1';
                DoLog(LogLevel.Info, 'Add "?p=1": ' + url);
            } else {
                url += '&p=1';
                DoLog(LogLevel.Info, 'Add "&p=1": ' + url);
            }
        }
        let wordMatch = url.match(/\/tags\/([^/]*)\//);
        let searchWord = '';
        if (wordMatch) {
            DoLog(LogLevel.Info, 'Search key word: ' + searchWord);
            searchWord = wordMatch[1];
        } else {
            DoLog(LogLevel.Error, 'Can not found search key word!');
            return;
        }

        // page
        let page = url.match(/p=(\d*)/)[1];
        currentPage = parseInt(page);
        DoLog(LogLevel.Info, 'Current page: ' + currentPage);

        let type = url.match(/tags\/.*\/(.*)[?$]/)[1];
        currentUrl += type + '/';

        currentUrl += searchWord + '?word=' + searchWord + '&p=' + currentPage;
        DoLog(LogLevel.Info, 'Current url: ' + currentUrl);
    } else {
        DoLog(LogLevel.Error, '???');
    }

    let imageContainer = Pages[PageType.Search].GetImageListContainer();
    // loading
    $(imageContainer).hide().before('<div id="loading" style="width:100%;text-align:center;"><img src="' + g_loadingImage + '" /><p id="progress" style="text-align: center;font-size: large;font-weight: bold;padding-top: 10px;">0%</p></div>');

    // page
    if (true) {
        let pageSelectorDiv = Pages[PageType.Search].GetPageSelector();
        if (pageSelectorDiv == null) {
            DoLog(LogLevel.Error, 'Can not found page selector!');
            return;
        }

        if ($(pageSelectorDiv).find('a').length > 2) {
            let pageButton = $(pageSelectorDiv).find('a').get(1);
            let newPageButtons = [];
            let pageButtonString = 'Previewer';
            for (let i = 0; i < 9; i++) {
                let newPageButton = pageButton.cloneNode(true);
                $(newPageButton).find('span').text(pageButtonString[i]);
                newPageButtons.push(newPageButton);
            }

            $(pageSelectorDiv).find('button').remove();
            while ($(pageSelectorDiv).find('a').length > 2) {
                $(pageSelectorDiv).find('a:first').next().remove();
            }

            for (let i = 0; i < 9; i++) {
                $(pageSelectorDiv).find('a:last').before(newPageButtons[i]);
            }

            $(pageSelectorDiv).find('a').attr('href', 'javascript:;');

            let pageUrl = location.href;
            if (pageUrl.indexOf('&p=') == -1 && pageUrl.indexOf('?p=') == -1) {
                if (pageUrl.indexOf('?') == -1) {
                    pageUrl += '?p=1';
                } else {
                    pageUrl += '&p=1';
                }
            }
            let prevPageUrl = pageUrl.replace(/p=\d+/, 'p=' + (currentPage - g_settings.pageCount > 1 ? currentPage - g_settings.pageCount : 1));
            let nextPageUrl = pageUrl.replace(/p=\d+/, 'p=' + (currentPage + g_settings.pageCount));
            DoLog(LogLevel.Info, 'Previous page url: ' + prevPageUrl);
            DoLog(LogLevel.Info, 'Next page url: ' + nextPageUrl);
            // 重新插入一遍清除事件绑定
            let prevButton = $(pageSelectorDiv).find('a:first');
            prevButton.before(prevButton.clone());
            prevButton.remove();
            let nextButton = $(pageSelectorDiv).find('a:last');
            nextButton.before(nextButton.clone());
            nextButton.remove();
            $(pageSelectorDiv).find('a:first').attr('href', prevPageUrl).addClass('pp-prevPage');
            $(pageSelectorDiv).find('a:last').attr('href', nextPageUrl).addClass('pp-nextPage');
        }

        let onloadCallback = function (req) {
            let no_artworks_found = false;

            try {
                let json = JSON.parse(req.responseText);
                if (json.hasOwnProperty('error')) {
                    if (json.error === false) {
                        let data;
                        if (json.body.illustManga) {
                            data = json.body.illustManga.data;
                        } else if (json.body.manga) {
                            data = json.body.manga.data;
                        } else if (json.body.illust) {
                            data = json.body.illust.data;
                        }
                        if (data.length > 0) {
                            works = works.concat(data);
                        } else {
                            no_artworks_found = true;
                        }
                    } else {
                        DoLog(LogLevel.Error, 'ajax error!');
                        return;
                    }
                } else {
                    DoLog(LogLevel.Error, 'Key "error" not found!');
                    return;
                }
            } catch (e) {
                DoLog(LogLevel.Error, 'A invalid json string!');
                DoLog(LogLevel.Info, req.responseText);
            }

            currentPage++;
            currentGettingPageCount++;

            // 后面已经没有作品了
            if (no_artworks_found) {
                DoLog(LogLevel.Warning, 'No artworks found, ignore ' + (g_settings.pageCount - currentGettingPageCount) + ' pages.');
                currentPage += g_settings.pageCount - currentGettingPageCount;
                currentGettingPageCount = g_settings.pageCount;
            }
            // 设定数量的页面加载完成
            if (currentGettingPageCount == g_settings.pageCount) {
                DoLog(LogLevel.Info, 'Load complete, start to load bookmark count.');
                DoLog(LogLevel.Elements, works);

                // 获取到的作品里面可能有广告，先删掉，否则后面一些处理需要做判断
                let tempWorks = [];
                let workIdsSet = new Set();
                for (let i = 0; i < works.length; i++) {
                    if (works[i].id && !workIdsSet.has(works[i].id)) {
                        tempWorks.push(works[i]);
                        workIdsSet.add(works[i].id);
                    }
                }
                works = tempWorks;
                DoLog(LogLevel.Info, 'Clear ad container complete.');
                DoLog(LogLevel.Elements, works);

                GetBookmarkCount(0);
            } else {
                getWorks(onloadCallback);
            }
        };

        getWorks(onloadCallback);
    }

    let xhrs = [];
    let currentRequestGroupMinimumIndex = 0;
    function FillXhrsArray() {
        xhrs.length = 0;
        let onloadFunc = function (event) {
            let json = null;
            try {
                json = JSON.parse(event.currentTarget.responseText);
            } catch (e) {
                DoLog(LogLevel.Error, 'Parse json failed!');
                DoLog(LogLevel.Element, e);
                return;
            }

            if (json) {
                let illustId = '';
                let illustIdMatched = event.currentTarget.responseURL.match(/illust_id=(\d+)/);
                if (illustIdMatched) {
                    illustId = illustIdMatched[1];
                } else {
                    DoLog(LogLevel.Error, 'Can not get illust id from url!');
                    return;
                }
                let indexOfThisRequest = -1;
                for (let j = 0; j < g_maxXhr; j++) {
                    if (xhrs[j].illustId == illustId) {
                        indexOfThisRequest = j;
                        break;
                    }
                }
                if (indexOfThisRequest == -1) {
                    DoLog(LogLevel.Error, 'This url not match any request!');
                    return;
                }
                xhrs[indexOfThisRequest].complete = true;

                if (!json.error) {
                    let bookmarkCount = json.body.illust_details.bookmark_user_total;
                    works[currentRequestGroupMinimumIndex + indexOfThisRequest].bookmarkCount = parseInt(bookmarkCount);
                    DoLog(LogLevel.Info, 'IllustId: ' + illustId + ', bookmarkCount: ' + bookmarkCount);
                } else {
                    DoLog(LogLevel.Error, 'Some error occured: ' + json.message);
                }

                let completeCount = 0;
                // 真实完成数（不包含没有发起请求的XHR，最后一批请求时）
                let completeReally = 0;
                for (let j = 0; j < g_maxXhr; j++) {
                    if (xhrs[j].complete) {
                        completeCount++;
                        if (xhrs[j].illustId != '') {
                            completeReally++;
                        }
                    }
                }
                $('#loading').find('#progress').text(Texts[g_language].sort_getBookmarkCount.replace('%1', currentRequestGroupMinimumIndex + completeReally).replace('%2', works.length));
                if (completeCount == g_maxXhr) {
                    currentRequestGroupMinimumIndex += g_maxXhr;
                    GetBookmarkCount(currentRequestGroupMinimumIndex);
                }
            }
        };
        let onerrorFunc = function (event) {
            let illustId = '';
            let illustIdMatched = event.currentTarget.__sentry_xhr__.url.match(/artworks\/(\d+)/);
            if (illustIdMatched) {
                illustId = illustIdMatched[1];
            } else {
                DoLog(LogLevel.Error, 'Can not get illust id from url!');
                return;
            }

            DoLog(LogLevel.Error, 'Send request failed, set this illust(' + illustId + ')\'s bookmark count to 0!');

            let indexOfThisRequest = -1;
            for (let j = 0; j < g_maxXhr; j++) {
                if (xhrs[j].illustId == illustId) {
                    indexOfThisRequest = j;
                    break;
                }
            }
            if (indexOfThisRequest == -1) {
                DoLog('This url not match any request!');
                return;
            }
            xhrs[indexOfThisRequest].complete = true;

            let completeCount = 0;
            let completeReally = 0;
            for (let j = 0; j < g_maxXhr; j++) {
                if (xhrs[j].complete) {
                    completeCount++;
                    if (xhrs[j].illustId != '') {
                        completeReally++;
                    }
                }
            }
            $('#loading').find('#progress').text(Texts[g_language].sort_getBookmarkCount.replace('%1', currentRequestGroupMinimumIndex + completeReally).replace('%2', works.length));
            if (completeCount == g_maxXhr) {
                GetBookmarkCount(currentRequestGroupMinimumIndex + g_maxXhr);
            }
        };
        for (let i = 0; i < g_maxXhr; i++) {
            xhrs.push({
                xhr: new XMLHttpRequest(),
                illustId: '',
                complete: false,
            });
            xhrs[i].xhr.onload = onloadFunc;
            xhrs[i].xhr.onerror = onerrorFunc;
        }
    }

    let GetBookmarkCount = function (index) {
        if (index >= works.length) {
            clearAndUpdateWorks();
            return;
        }

        if (xhrs.length === 0) {
            FillXhrsArray();
        }

        for (let i = 0; i < g_maxXhr; i++) {
            if (index + i >= works.length) {
                xhrs[i].complete = true;
                xhrs[i].illustId = '';
                continue;
            }

            let illustId = works[index + i].id;
            let url = 'https://www.pixiv.net/touch/ajax/illust/details?illust_id=' + illustId;
            xhrs[i].illustId = illustId;
            xhrs[i].complete = false;
            xhrs[i].xhr.open('GET', url, true);
            xhrs[i].xhr.send(null);
        }
    };

    /*
    li
    -div
    --div
    ---div
    ----div
    -----div
    ------a
    -------div: 多图标签、R18标签
    -------div: 里面是 img （以及 svg 动图标签）
    ------div: 里面是 like 相关的元素
    ---a: 作品标题，跳转链接
    ---div: 作者头像和昵称
    */
    let clearAndUpdateWorks = function () {
        filterAndSort().then(function () {

            let container = Pages[PageType.Search].GetImageListContainer();
            let firstImageElement = Pages[PageType.Search].GetFirstImageElement();
            if (imageElementTemplate == null) {
                imageElementTemplate = firstImageElement.cloneNode(true);

                // 清理模板
                // image
                let img = $($(imageElementTemplate).find('img').get(0));
                let imageDiv = img.parent();
                let imageLink = imageDiv.parent();
                let imageLinkDiv = imageLink.parent();
                let titleLinkParent = imageLinkDiv.parent().next();
                if (img == null || imageDiv == null || imageLink == null || imageLinkDiv == null || titleLinkParent == null) {
                    DoLog(LogLevel.Error, 'Can not found some elements!');
                }
                let titleLink = $('<a></a>');
                if (titleLinkParent.children().length == 0) {
                    titleLinkParent.append(titleLink);
                } else {
                    titleLink = titleLinkParent.children('a:first');
                }

                // author
                let authorDiv = titleLinkParent.next();
                let authorLinkProfileImage = authorDiv.find('a:first');
                let authorLink = authorDiv.find('a:last');
                let authorName = authorLink;
                let authorImage = $(authorDiv.find('img').get(0));

                // others
                let bookmarkDiv = imageLink.next();
                let bookmarkSvg = bookmarkDiv.find('svg');
                let additionTagDiv = imageDiv.prev();
                let animationTag = imageDiv.find('svg');

                let bookmarkCountDiv = additionTagDiv.clone();
                bookmarkCountDiv.css({ 'top': 'auto', 'bottom': '0px', 'width': '50%' });
                additionTagDiv.parent().append(bookmarkCountDiv);

                // 添加 class，方便后面修改内容
                img.addClass('ppImg');
                imageLink.addClass('ppImageLink');
                //if (titleLink.get(0).tagName == 'A') {
                titleLink.addClass('ppTitleLink');
                //} else {
                //    titleLink.append('<a class="ppTitleLink"></a>');
                //}
                authorLinkProfileImage.addClass('ppAuthorLinkProfileImage');
                authorLink.addClass('ppAuthorLink');
                authorName.addClass('ppAuthorName');
                authorImage.addClass('ppAuthorImage');
                bookmarkSvg.attr('class', bookmarkSvg.attr('class') + ' ppBookmarkSvg');
                additionTagDiv.addClass('ppAdditionTag');
                bookmarkCountDiv.addClass('ppBookmarkCount');

                img.attr('src', '');
                additionTagDiv.empty();
                bookmarkCountDiv.empty();
                animationTag.remove();
                bookmarkSvg.find('path:first').css('fill', 'rgb(31, 31, 31)');
                bookmarkSvg.find('path:last').css('fill', 'rgb(255, 255, 255)');

                if (g_settings.linkBlank) {
                    imageLink.attr('target', '_blank');
                    titleLink.attr('target', '_blank');
                    authorLinkProfileImage.attr('target', '_blank');
                    authorLink.attr('target', '_blank');
                }
            }

            $(container).empty();
            for (let i = 0; i < works.length; i++) {
                let li = $(imageElementTemplate.cloneNode(true));

                let regularUrl = works[i].url;
                if (g_settings.fullSizeThumb) {
                    regularUrl = convertThumbUrlToSmall(works[i].url);
                }
                li.find('.ppImg').attr('src', regularUrl).css('object-fit', 'contain');
                li.find('.ppImageLink').attr('href', '/artworks/' + works[i].id);
                li.find('.ppTitleLink').attr('href', '/artworks/' + works[i].id).text(works[i].title);
                li.find('.ppAuthorLink, .ppAuthorLinkProfileImage').attr('href', '/member.php?id=' + works[i].userId).attr({ 'userId': works[i].userId, 'profileImageUrl': works[i].profileImageUrl, 'userName': works[i].userName });
                li.find('.ppAuthorName').text(works[i].userName);
                li.find('.ppAuthorImage').attr('src', works[i].profileImageUrl);
                li.find('.ppBookmarkSvg').attr('illustId', works[i].id);
                if (works[i].bookmarkData) {
                    li.find('.ppBookmarkSvg').find('path').css('fill', 'rgb(255, 64, 96)');
                    li.find('.ppBookmarkSvg').attr('bookmarkId', works[i].bookmarkData.id);
                }
                if (works[i].xRestrict !== 0) {
                    let R18HTML = '<div style="margin-top: 2px; margin-left: 2px;"><div style="color: rgb(255, 255, 255);font-weight: bold;font-size: 10px;line-height: 1;padding: 3px 6px;border-radius: 3px;background: rgb(255, 64, 96);">R-18</div></div>';
                    li.find('.ppAdditionTag').append(R18HTML);
                }
                if (works[i].pageCount > 1) {
                    let pageCountHTML = '<div style="display: flex;-webkit-box-align: center;align-items: center;box-sizing: border-box;margin-left: auto;height: 20px;color: rgb(255, 255, 255);font-size: 10px;line-height: 12px;font-weight: bold;flex: 0 0 auto;padding: 4px 6px;background: rgba(0, 0, 0, 0.32);border-radius: 10px;">\<svg viewBox="0 0 9 10" width="9" height="10" style="stroke: none;line-height: 0;font-size: 0px;fill: currentcolor;"><path d="M8,3 C8.55228475,3 9,3.44771525 9,4 L9,9 C9,9.55228475 8.55228475,10 8,10 L3,10 C2.44771525,10 2,9.55228475 2,9 L6,9 C7.1045695,9 8,8.1045695 8,7 L8,3 Z M1,1 L6,1 C6.55228475,1 7,1.44771525 7,2 L7,7 C7,7.55228475 6.55228475,8 6,8 L1,8 C0.44771525,8 0,7.55228475 0,7 L0,2 C0,1.44771525 0.44771525,1 1,1 Z"></path></svg><span style="margin-left: 2px;">' + works[i].pageCount + '</span></div>';
                    li.find('.ppAdditionTag').append(pageCountHTML);
                }
                let bookmarkCountHTML = '<div style="margin-bottom: 6px; margin-left: 2px;"><div style="color: rgb(7, 95, 166);font-weight: bold;font-size: 13px;line-height: 1;padding: 3px 6px;border-radius: 3px;background: rgb(204, 236, 255);">' + works[i].bookmarkCount + ' likes</div></div>';
                li.find('.ppBookmarkCount').append(bookmarkCountHTML);
                if (works[i].illustType == 2) {
                    let animationHTML = '<svg viewBox="0 0 24 24" style="width: 48px; height: 48px;stroke: none;fill: rgb(255, 255, 255);line-height: 0;font-size: 0px;vertical-align: middle;position:absolute;"><circle cx="12" cy="12" r="10" style="fill: rgb(0, 0, 0);fill-opacity: 0.4;"></circle><path d="M9,8.74841664 L9,15.2515834 C9,15.8038681 9.44771525,16.2515834 10,16.2515834 C10.1782928,16.2515834 10.3533435,16.2039156 10.5070201,16.1135176 L16.0347118,12.8619342 C16.510745,12.5819147 16.6696454,11.969013 16.3896259,11.4929799 C16.3034179,11.3464262 16.1812655,11.2242738 16.0347118,11.1380658 L10.5070201,7.88648243 C10.030987,7.60646294 9.41808527,7.76536339 9.13806578,8.24139652 C9.04766776,8.39507316 9,8.57012386 9,8.74841664 Z"></path></svg>';
                    li.find('.ppImg').after(animationHTML);
                }

                $(container).append(li);
            }

            // 监听加入书签点击事件，监听父节点，但是按照 <svg> 节点处理
            $('.ppBookmarkSvg').parent().on('click', function (ev) {
                if (g_csrfToken == '') {
                    DoLog(LogLevel.Error, 'No g_csrfToken, failed to add bookmark!');
                    alert('获取 Token 失败，无法添加，请到详情页操作。');
                    return;
                }
                // 非公开收藏
                let restrict = 0;
                if (ev.ctrlKey) {
                    restrict = 1;
                }

                let _this = $(this).children('svg:first');
                let illustId = _this.attr('illustId');
                let bookmarkId = _this.attr('bookmarkId');
                if (bookmarkId == null || bookmarkId == '') {
                    DoLog(LogLevel.Info, 'Add bookmark, illustId: ' + illustId);
                    $.ajax('/ajax/illusts/bookmarks/add', {
                        method: 'POST',
                        contentType: 'application/json;charset=utf-8',
                        headers: { 'x-csrf-token': g_csrfToken },
                        data: '{"illust_id":"' + illustId + '","restrict":' + restrict + ',"comment":"","tags":[]}',
                        success: function (data) {
                            DoLog(LogLevel.Info, 'addBookmark result: ');
                            DoLog(LogLevel.Elements, data);
                            if (data.error) {
                                DoLog(LogLevel.Error, 'Server returned an error: ' + data.message);
                                return;
                            }
                            let bookmarkId = data.body.last_bookmark_id;
                            DoLog(LogLevel.Info, 'Add bookmark success, bookmarkId is ' + bookmarkId);
                            _this.attr('bookmarkId', bookmarkId);
                            _this.find('path').css('fill', 'rgb(255, 64, 96)');
                        }
                    });
                } else {
                    DoLog(LogLevel.Info, 'Delete bookmark, bookmarkId: ' + bookmarkId);
                    $.ajax('/rpc/index.php', {
                        method: 'POST',
                        headers: { 'x-csrf-token': g_csrfToken },
                        data: { "mode": "delete_illust_bookmark", "bookmark_id": bookmarkId },
                        success: function (data) {
                            DoLog(LogLevel.Info, 'delete bookmark result: ');
                            DoLog(LogLevel.Elements, data);
                            if (data.error) {
                                DoLog(LogLevel.Error, 'Server returned an error: ' + data.message);
                                return;
                            }
                            DoLog(LogLevel.Info, 'Delete bookmark success.');
                            _this.attr('bookmarkId', '');
                            _this.find('path:first').css('fill', 'rgb(31, 31, 31)');
                            _this.find('path:last').css('fill', 'rgb(255, 255, 255)');
                        }
                    });
                }

                _this.parent().focus();
            });

            $('.ppAuthorLink').on('mouseenter', function (e) {
                let _this = $(this);

                function getOffset(e) {
                    if (e.offsetParent) {
                        let offset = getOffset(e.offsetParent);
                        return {
                            offsetTop: e.offsetTop + offset.offsetTop,
                            offsetLeft: e.offsetLeft + offset.offsetLeft,
                        };
                    } else {
                        return {
                            offsetTop: e.offsetTop,
                            offsetLeft: e.offsetLeft,
                        };
                    }
                }

                let isFollowed = false;
                $.ajax('https://www.pixiv.net/ajax/user/' + _this.attr('userId') + '?full=1', {
                    method: 'GET',
                    async: false,
                    success: function (data) {
                        if (data.error == false && data.body.isFollowed) {
                            isFollowed = true;
                        }
                    },
                });

                $('.pp-authorDiv').remove();
                let pres = $('<div class="pp-authorDiv"><div class="ppa-main" style="position: absolute; top: 0px; left: 0px; border-width: 1px; border-style: solid; z-index: 1; border-color: rgba(0, 0, 0, 0.08); border-radius: 8px;"><div class=""style="    width: 336px;    background-color: rgb(255, 255, 255);    padding-top: 24px;    flex-flow: column;"><div class=""style=" display: flex; align-items: center; flex-flow: column;"><a class="ppa-authorLink"><div role="img"size="64"class=""style=" display: inline-block; width: 64px; height: 64px; border-radius: 50%; overflow: hidden;"><img class="ppa-authorImage" width="64"height="64"style="object-fit: cover; object-position: center top;"></div></a><a class="ppa-authorLink"><div class="ppa-authorName" style=" line-height: 24px; font-size: 16px; font-weight: bold; margin: 4px 0px 0px;"></div></a><div class=""style=" margin: 12px 0px 24px;"><button type="button"class="ppa-follow"style=" padding: 9px 25px; line-height: 1; border: none; border-radius: 16px; font-weight: 700; background-color: #0096fa; color: #fff; cursor: pointer;"><span style="margin-right: 4px;"><svg viewBox="0 0 8 8"width="10"height="10"class=""style=" stroke: rgb(255, 255, 255); stroke-linecap: round; stroke-width: 2;"><line x1="1"y1="4"x2="7"y2="4"></line><line x1="4"y1="1"x2="4"y2="7"></line></svg></span>关注</button></div></div></div></div></div>');
                $('body').append(pres);
                let offset = getOffset(this);
                pres.find('.ppa-main').css({ 'top': offset.offsetTop - 196 + 'px', 'left': offset.offsetLeft - 113 + 'px' });
                pres.find('.ppa-authorLink').attr('href', '/member.php?id=' + _this.attr('userId'));
                pres.find('.ppa-authorImage').attr('src', _this.attr('profileImageUrl'));
                pres.find('.ppa-authorName').text(_this.attr('userName'));
                if (isFollowed) {
                    pres.find('.ppa-follow').get(0).outerHTML = '<button type="button" class="ppa-follow followed" data-click-action="click" data-click-label="follow" style="padding: 9px 25px;line-height: 1;border: none;border-radius: 16px;font-size: 14px;font-weight: 700;cursor: pointer;">关注中</button>';
                }
                pres.find('.ppa-follow').attr('userId', _this.attr('userId'));
                pres.on('mouseleave', function (e) {
                    $(this).remove();
                }).on('mouseenter', function () {
                    $(this).addClass('mouseenter');
                });

                pres.find('.ppa-follow').on('click', function () {
                    let userId = $(this).attr('userId');
                    if ($(this).hasClass('followed')) {
                        // 取关
                        $.ajax('https://www.pixiv.net/rpc_group_setting.php', {
                            method: 'POST',
                            headers: { 'x-csrf-token': g_csrfToken },
                            data: 'mode=del&type=bookuser&id=' + userId,
                            success: function (data) {
                                DoLog(LogLevel.Info, 'delete bookmark result: ');
                                DoLog(LogLevel.Elements, data);

                                if (data.type == 'bookuser') {
                                    $('.ppa-follow').get(0).outerHTML = '<button type="button"class="ppa-follow"style=" padding: 9px 25px; line-height: 1; border: none; border-radius: 16px; font-weight: 700; background-color: #0096fa; color: #fff; cursor: pointer;"><span style="margin-right: 4px;"><svg viewBox="0 0 8 8"width="10"height="10"class=""style=" stroke: rgb(255, 255, 255); stroke-linecap: round; stroke-width: 2;"><line x1="1"y1="4"x2="7"y2="4"></line><line x1="4"y1="1"x2="4"y2="7"></line></svg></span>关注</button>';
                                }
                                else {
                                    DoLog(LogLevel.Error, 'Delete follow failed!');
                                }
                            }
                        });
                    } else {
                        // 关注
                        $.ajax('https://www.pixiv.net/bookmark_add.php', {
                            method: 'POST',
                            headers: { 'x-csrf-token': g_csrfToken },
                            data: 'mode=add&type=user&user_id=' + userId + '&tag=&restrict=0&format=json',
                            success: function (data) {
                                DoLog(LogLevel.Info, 'addBookmark result: ');
                                DoLog(LogLevel.Elements, data);
                                // success
                                if (data.length === 0) {
                                    $('.ppa-follow').get(0).outerHTML = '<button type="button" class="ppa-follow followed" data-click-action="click" data-click-label="follow" style="padding: 9px 25px;line-height: 1;border: none;border-radius: 16px;font-size: 14px;font-weight: 700;cursor: pointer;">关注中</button>';
                                } else {
                                    DoLog(LogLevel.Error, 'Follow failed!');
                                }
                            }
                        });
                    }
                });
            }).on('mouseleave', function (e) {
                setTimeout(function () {
                    if (!$('.pp-authorDiv').hasClass('mouseenter')) {
                        $('.pp-authorDiv').remove();
                    }
                }, 200);
            });

            if (works.length === 0) {
                $(container).show().get(0).outerHTML = '<div class=""style="display: flex;align-items: center;justify-content: center; height: 408px;flex-flow: column;"><div class=""style="margin-bottom: 12px;color: rgba(0, 0, 0, 0.16);"><svg viewBox="0 0 16 16"size="72"style="fill: currentcolor;height: 72px;vertical-align: middle;"><path d="M8.25739 9.1716C7.46696 9.69512 6.51908 10 5.5 10C2.73858 10 0.5 7.76142 0.5 5C0.5			2.23858 2.73858 0 5.5 0C8.26142 0 10.5 2.23858 10.5 5C10.5 6.01908 10.1951 6.96696 9.67161			7.75739L11.7071 9.79288C12.0976 10.1834 12.0976 10.8166 11.7071 11.2071C11.3166 11.5976 10.6834			11.5976 10.2929 11.2071L8.25739 9.1716ZM8.5 5C8.5 6.65685 7.15685 8 5.5 8C3.84315 8 2.5 6.65685			2.5 5C2.5 3.34315 3.84315 2 5.5 2C7.15685 2 8.5 3.34315 8.5 5Z"transform="translate(2.25 2.25)"fill-rule="evenodd"clip-rule="evenodd"></path></svg></div><span class="sc-LzMCO fLDUzU">' + Texts[g_language].sort_noWork + '</span></div>';
            }

            // 恢复显示
            $('#loading').remove();
            $(container).show();

            Pages[PageType.Search].ProcessPageElements();

            // 监听键盘的左右键，用来翻页
            $(document).keydown(function (e) {
                if (g_settings.pageByKey != 1) {
                    return;
                }
                if (e.keyCode == 39) {
                    let btn = $('.pp-nextPage');
                    if (btn.length < 1 || btn.attr('hidden') == 'hidden') {
                        return;
                    }
                    // 很奇怪不能用 click()
                    location.href = btn.attr('href');
                } else if (e.keyCode == 37) {
                    let btn = $('.pp-prevPage');
                    if (btn.length < 1 || btn.attr('hidden') == 'hidden') {
                        return;
                    }
                    location.href = btn.attr('href');
                }
            });

            if (callback) {
                callback();
            }
        });
    }
};

/* ---------------------------------------- 小说 ---------------------------------------- */
function PixivNS(callback) {
    function findNovelSection() {
        let ul = $('section>div>ul');
        if (ul.length == 0) {
            DoLog(LogLevel.Error, 'Can not found novel list.');
            return null;
        }
        return ul;
    }

    function getSearchParamsWithoutPage() {
        return location.search.substr(1).replace(/&?p=\d+/, '');
    }

    function getNovelTemplate(ul) {
        if (!ul) {
            return null;
        }
        if (ul.length == 0) {
            DoLog(LogLevel.Error, 'Empty list, can not create template.');
            return null;
        }
        let template = ul.children().eq(0).clone(true)
        // 左侧图片
        let picDiv = template.children().eq(0).children().eq(0);
        picDiv.find('a:first').addClass('pns-link');
        picDiv.find('img:first').addClass('pns-img');
        // 右侧详情
        let detailDiv = template.children().eq(0).children().eq(1).children().eq(0);
        let titleDiv = detailDiv.children().eq(0);
        if (titleDiv.children().length > 1) {
            titleDiv.children().eq(0).addClass('pns-series');
        } else {
            // 如果作为模板的DIV没有系列，就自己加一个
            let series = $('<a class="pns-series" href="/novel/series/000000"></a>');
            series.css({
                'display': 'inline-block',
                'white-space': 'nowrap',
                'text-overflow': 'ellipsis',
                'overflow': 'hidden',
                'max-width': '100%',
                'line-height': '22px',
                'font-size': '14px',
                'text-decoration': 'none'
            });
            $('head').append('<style>.pns-series:visited{color:rgb(173,173,173)}</style>');
            titleDiv.prepend(series);
        }
        titleDiv.children().eq(1).addClass('pns-title').addClass('pns-link');
        let authorDiv = detailDiv.children().eq(1);
        authorDiv.children().eq(0).addClass('pns-author');
        let tagDiv = detailDiv.children().eq(2);
        let bookmarkDiv = tagDiv.children().eq(0);
        bookmarkDiv.children().eq(0).addClass('pns-text-count');
        if (bookmarkDiv.children().length < 2) {
            bookmarkDiv.find('.pns-text-count').after('<div class="pns-bookmark-div"><span style="display: inline-flex; vertical-align: top; height: 20px;"><svg viewBox="0 0 12 12" size="12" class="sc-14heosd-1 dcwYur"><path fill-rule="evenodd" clip-rule="evenodd" d="M9 0.75C10.6569 0.75 12 2.09315 12 3.75C12 7.71703 7.33709 10.7126   6.23256 11.3666C6.08717 11.4526 5.91283 11.4526 5.76744 11.3666C4.6629 10.7126 0 7.71703 0 3.75C0 2.09315 1.34315 0.75 3 0.75C4.1265 0.75 5.33911 1.60202 6 2.66823C6.66089 1.60202 7.8735 0.75 9 0.75Z"></path></svg></span><span class="pns-bookmark-count" style="padding-left: 4px;">0</span></div>')
        } else {
            bookmarkDiv.find('span:last').addClass('pns-bookmark-count').parent().addClass('pns-bookmark-div');
        }
        detailDiv.children().eq(3).empty().addClass('pns-tag-list');
        let descDiv = detailDiv.children().eq(4);
        descDiv.children().eq(0).addClass('pns-desc');
        // 右下角爱心
        let likeDiv = template.children().eq(0).children().eq(1).children().eq(1);
        let svg = likeDiv.find('svg');
        svg.attr('class', svg.attr('class') + ' pns-like');
        likeDiv.find('path:first').css('color', 'rgb(31, 31, 31)');
        likeDiv.find('path:last').css('fill', 'rgb(255, 255, 255)');

        return template;
    }

    function fillTemplate(template, novel) {
        if (template == null || novel == null) {
            return null;
        }
        let link = template.find('.pns-link:first').attr('href').replace(/id=\d+/g, 'id=' + novel.id);
        template.find('.pns-link').attr('href', link);
        template.find('.pns-img').attr('src', novel.url);
        if (novel.seriesId) {
            let seriesLink = template.find('.pns-series').attr('href').replace(/\d+$/, novel.seriesId);
            template.find('.pns-series').text(novel.seriesTitle).attr('title', novel.seriesTitle).attr('href', seriesLink);
        } else {
            template.find('.pns-series').hide();
        }
        template.find('.pns-title').text(novel.title).attr('title', novel.title);
        let authorLink = template.find('.pns-author').attr('href').replace(/\d+$/, novel.userId);
        template.find('.pns-author').text(novel.userName).attr('href', authorLink);
        template.find('.pns-text-count').text(novel.textCount + '文字');
        if (novel.bookmarkCount == 0) {
            template.find('.pns-bookmark-div').hide();
        } else {
            template.find('.pns-bookmark-count').text(novel.bookmarkCount);
        }
        let tagList = template.find('.pns-tag-list');
        let search = getSearchParamsWithoutPage();
        if (search.length > 0) {
            search = '?' + search;
        }
        $.each(novel.tags, function (i, tag) {
            let tagItem = $('<span"><a style="color: rgb(61, 118, 153);" href="/tags/' + tag + '/novels' + search + '">' + tag + '</a></span>');
            if (tag == 'R-18' || tag == 'R-18G') {
                tagItem.find('a').css({ 'color': 'rgb(255, 64, 96)', 'font-weight': 'bold' }).text(tag);
            }
            tagList.append(tagItem);
        });
        template.find('.pns-desc').html(novel.description).attr('title', template.find('.pns-desc').text());
        let like = template.find('.pns-like');
        like.attr('novel-id', novel.id);
        if (novel.bookmarkData) {
            like.attr('bookmark-id', novel.bookmarkData.id);
            like.find('path:first').css('color', 'rgb(255, 64, 96)');
            like.find('path:last').css('fill', 'rgb(255, 64, 96)');
        }
        like.click(function() {
            if ($(this).attr('disable')) {
                return;
            }
            let bid = $(this).attr('bookmark-id');
            let nid = $(this).attr('novel-id');
            if (bid) {
                deleteBookmark($(this), bid);
            } else {
                addBookmark($(this), nid, 0);
            }
            $(this).blur();
        });
        if (g_settings.linkBlank) {
            template.find('a').attr('target', '_blank');
        }
        return template;
    }

    function getNovelByPage(key, from, to, total) {
        if (total == undefined) {
            total = to - from;
        }

        let url = location.origin + g_getNovelUrl.replace(/#key#/g, key).replace(/#page#/g, from);
        let search = getSearchParamsWithoutPage();
        if (search.length > 0) {
            url += '&' + search;
        }

        updateProgress(Texts[g_language].nsort_getWorks.replace('1%', total - to + from + 1).replace('2%', total));

        let novelList = [];
        function onLoadFinish(data, resolve) {
            if (data && data.body && data.body.novel && data.body.novel.data) {
                novelList = novelList.concat(data.body.novel.data);
            }

            if (from == to - 1) {
                resolve(novelList);
            } else {
                getNovelByPage(key, from + 1, to, total).then(function (list) {
                    if (list && list.length > 0) {
                        novelList = novelList.concat(list);
                    }
                    resolve(novelList);
                });
            }
        }

        return new Promise(function (resolve, reject) {
            $.ajax({
                url: url,
                success: function (data) {
                    onLoadFinish(data, resolve);
                },
                error: function () {
                    DoLog(LogLevel.Error, 'get novel page ' + from + ' failed!');
                    onLoadFinish(null, resolve);
                },
            });
        });
    }

    function sortNovel(list) {
        updateProgress(Texts[g_language].nsort_sorting);
        // 排序
        list.sort(function (a, b) {
            let bookmarkA = a.bookmarkCount;
            let bookmarkB = b.bookmarkCount;
            if (!bookmarkA) {
                bookmarkA = 0;
            }
            if (!bookmarkB) {
                bookmarkB = 0;
            }
            if (bookmarkA > bookmarkB) {
                return -1;
            }
            if (bookmarkA < bookmarkB) {
                return 1;
            }
            return 0;
        });
        return list;
    }

    function rearrangeNovel(list) {
        let ul = findNovelSection();
        if (ul == null) {
            return;
        }
        let template = getNovelTemplate(ul);
        if (template == null) {
            return;
        }
        let newList = [];
        $.each(list, function (i, novel) {
            let e = fillTemplate(template.clone(true), novel);
            if (e != null) {
                newList.push(e);
            }
        });
        ul.empty();
        $.each(newList, function (i, e) {
            ul.append(e);
        });
        hideLoading();
    }

    function getKeyWord() {
        let match = location.pathname.match(/\/tags\/(.+)\/novels/);
        if (!match) {
            return '';
        }
        return match[1];
    }

    function getCurrentPage() {
        let match = location.search.match(/p=(\d+)/);
        if (match) {
            return parseInt(match[1]);
        }
        return 1;
    }

    function showLoading() {
        let ul = findNovelSection();
        if (ul == null) {
            iLog.e('Can not found novel section!');
            return;
        }

        ul.hide().before('<div id="loading" style="width:100%;text-align:center;"><img src="' + g_loadingImage + '" /><p id="progress" style="text-align: center;font-size: large;font-weight: bold;padding-top: 10px;">0%</p></div>');
    }

    function hideLoading() {
        let ul = findNovelSection();
        if (ul == null) {
            iLog.e('Can not found novel section!');
            return;
        }

        $('#loading').remove();
        ul.show();
    }

    function updateProgress(msg) {
        let p = $('#progress');
        p.text(msg);
    }

    function addBookmark(element, novelId, restrict) {
        if (g_csrfToken == '') {
            iLog.e('No g_csrfToken, failed to add bookmark!');
            alert('获取 Token 失败，无法添加，请到详情页操作。');
            return;
        }
        element.attr('disable', 'disable');
        iLog.i('add bookmark: ' + novelId);
        $.ajax('/ajax/novels/bookmarks/add', {
            method: 'POST',
            contentType: 'application/json;charset=utf-8',
            headers: { 'x-csrf-token': g_csrfToken },
            data: '{"novel_id":"' + novelId + '","restrict":' + restrict + ',"comment":"","tags":[]}',
            success: function (data) {
                iLog.i('add novel bookmark result: ');
                iLog.d(data);
                if (data.error) {
                    iLog.e('Server returned an error: ' + data.message);
                    return;
                }
                let bookmarkId = data.body;
                iLog.i('Add novel bookmark success, bookmarkId is ' + bookmarkId);
                element.attr('bookmark-id', bookmarkId);
                element.find('path:first').css('color', 'rgb(255, 64, 96)');
                element.find('path:last').css('fill', 'rgb(255, 64, 96)');
                element.removeAttr('disable');
            },
            error: function() {
                element.removeAttr('disable');
            }
        });
    }

    function deleteBookmark(element, bookmarkId) {
        if (g_csrfToken == '') {
            iLog.e('No g_csrfToken, failed to add bookmark!');
            alert('获取 Token 失败，无法添加，请到详情页操作。');
            return;
        }
        element.attr('disable', 'disable');
        iLog.i('delete bookmark: ' + bookmarkId);
        $.ajax('/ajax/novels/bookmarks/delete', {
            method: 'POST',
            headers: { 'x-csrf-token': g_csrfToken },
            data: { 'del': 1, 'book_id': bookmarkId },
            success: function (data) {
                iLog.i('delete novel bookmark result: ');
                iLog.d(data);
                if (data.error) {
                    iLog.e('Server returned an error: ' + data.message);
                    return;
                }
                iLog.i('delete novel bookmark success');
                element.removeAttr('bookmark-id');
                element.find('path:first').css('color', 'rgb(31, 31, 31)');
                element.find('path:last').css('fill', 'rgb(255, 255, 255)');
                element.removeAttr('disable');
            },
            error: function() {
                element.removeAttr('disable');
            }
        });
    }

    function changePageSelector() {
        let pager = Pages[PageType.NovelSearch].GetPageSelector();
        if (pager.length == 0) {
            iLog.e('can not found page selector!');
            return;
        }
        let left = pager.find('a:first').clone().attr('aria-disabled', 'false').removeAttr('hidden').addClass('pp-prevPage');
        let right = pager.find('a:last').clone().attr('aria-disabled', 'false').removeAttr('hidden').addClass('pp-nextPage');
        let normal = pager.find('a').eq(1).clone().removeAttr('href');
        let href = location.href;
        let match = href.match(/[?&]p=(\d+)/);
        let page = 1;
        if (match) {
            page = parseInt(match[1]);
        } else {
            if (location.search == '') {
                href += '?p=1';
            } else {
                href += '&p=1';
            }
        }
        if (page == 1) {
            left.attr('hidden', 'hidden');
        }
        pager.empty();
        let lp = page - g_settings.novelPageCount;
        left.attr('href', href.replace('?p=' + page, '?p=' + lp).replace('&p=' + page, '&p=' + lp));
        pager.append(left);
        let s = 'Previewer';
        for (let i = 0; i < s.length; ++i) {
            let n = normal.clone().text(s[i]);
            pager.append(n);
        }
        let rp = page + g_settings.novelPageCount;
        right.attr('href', href.replace('?p=' + page, '?p=' + rp).replace('&p=' + page, '&p=' + rp));
        pager.append(right);
    }

    function listnerToKeyBoard() {
        $(document).keydown(function (e) {
            if (g_settings.pageByKey != 1) {
                return;
            }
            if (e.keyCode == 39) {
                let btn = $('.pp-nextPage');
                if (btn.length < 1 || btn.attr('hidden') == 'hidden') {
                    return;
                }
                location.href = btn.attr('href');
            } else if (e.keyCode == 37) {
                let btn = $('.pp-prevPage');
                if (btn.length < 1 || btn.attr('hidden') == 'hidden') {
                    return;
                }
                location.href = btn.attr('href');
            }
        });
    }

    function main() {
        let keyWord = getKeyWord();
        if (keyWord.length == 0) {
            DoLog(LogLevel.Error, 'Parse key word error.');
            return;
        }
        let currentPage = getCurrentPage();

        showLoading();
        changePageSelector();
        listnerToKeyBoard();
        getNovelByPage(keyWord, currentPage, currentPage + g_settings.novelPageCount).then(function (novelList) {
            rearrangeNovel(sortNovel(novelList));
        });
    }

    main();
}
/* ---------------------------------------- 设置 ---------------------------------------- */
function SetCookie(name, value, days) {
    let Days = 180;
    if (days) {
        Days = days;
    }
    let exp = new Date();
    exp.setTime(exp.getTime() + Days * 24 * 60 * 60 * 1000);
    let str = JSON.stringify(value);
    document.cookie = name + "=" + str + ";expires=" + exp.toGMTString() + ';path=\/';
}
function GetCookie(name) {
    let arr, reg = new RegExp("(^| )" + name + "=([^;]*)(;|$)");
    if (arr = document.cookie.match(reg)) {
        return unescape(arr[2]);
    }
    else {
        return null;
    }
}
function ShowInstallMessage() {
    $('#pp-bg').remove();
    let bg = $('<div id="pp-bg"></div>').css({
        'width': document.documentElement.clientWidth + 'px', 'height': document.documentElement.clientHeight + 'px', 'position': 'fixed',
        'z-index': 999999, 'background-color': 'rgba(0,0,0,0.8)',
        'left': '0px', 'top': '0px'
    });
    $('body').append(bg);

    bg.get(0).innerHTML = '<img id="pps-close"src="https://pp-1252089172.cos.ap-chengdu.myqcloud.com/Close.png"style="position: absolute; right: 35px; top: 20px; width: 32px; height: 32px; cursor: pointer;"><div style="position: absolute;width: 40%;left: 30%;top: 25%;font-size: 25px; text-align: center; color: white;">' + Texts[g_language].install_title + g_version + '</div><br>' + Texts[g_language].install_body;
    $('#pps-close').click(function () {
        $('#pp-bg').remove();
    });
}
function ShowUpgradeMessage() {
    $('#pp-bg').remove();
    let bg = $('<div id="pp-bg"></div>').css({
        'width': document.documentElement.clientWidth + 'px', 'height': document.documentElement.clientHeight + 'px', 'position': 'fixed',
        'z-index': 999999, 'background-color': 'rgba(0,0,0,0.8)',
        'left': '0px', 'top': '0px'
    });
    $('body').append(bg);

    let body = '新功能：<br><dd>1.支持搜索页小说排序，可在设置中关闭。</dd>优化：<br><dd>1.减少jQuery引发的错误。<br>2.设置在小窗口下不会超出屏幕。</dd>修复：<br><dd>1.更新提示不会随窗口大小改变。</dd>';
    bg.get(0).innerHTML = '<img id="pps-close"src="https://pp-1252089172.cos.ap-chengdu.myqcloud.com/Close.png"style="position: absolute; right: 35px; top: 20px; width: 32px; height: 32px; cursor: pointer;"><div style="position: absolute;width: 40%;left: 30%;top: 25%;font-size: 25px; text-align: center; color: white;">'
        + Texts[g_language].install_title + g_version 
        + '</div><br><div style="position:absolute;left:50%;top:30%;font-size:20px;color:white;transform:translate(-50%,0);">' 
        + body + '</div>';
    $('#pps-close').click(function () {
        $('#pp-bg').remove();
    });
}
function FillNewSetting(st) {
    // 升级可能会有部分新加字段在cookie里读不到
    let changed = false;
    $.each(g_defaultSettings, function(k, v) {
        if (st[k] == undefined) {
            st[k] = g_defaultSettings[k];
            changed = true;
        }
    });
    return {
        'st': st,
        'change': changed
    };
}
function GetSettings() {
    let settings;

    let cookie = GetCookie('PixivPreview');
    if (cookie == null || cookie == 'null') {
        // 新安装
        settings = g_defaultSettings;
        SetCookie('PixivPreview', settings);
        ShowInstallMessage();
    } else {
        settings = JSON.parse(cookie);
        let mp = FillNewSetting(settings);
        if (mp.change) {
            settings = mp.st;
            SetCookie('PixivPreview', settings);
        }
        // 升级
        if (settings.version != g_version) {
            ShowUpgradeMessage();
            settings.version = g_version;
            SetCookie('PixivPreview', settings);
        }
    }

    return settings;
}
function ShowSetting() {
    let screenWidth = document.documentElement.clientWidth;
    let screenHeight = document.documentElement.clientHeight;

    $('#pp-bg').remove();
    let bg = $('<div id="pp-bg"></div>').css({
        'width': screenWidth + 'px', 'height': screenHeight + 'px', 'position': 'fixed',
        'z-index': 999999, 'background-color': 'rgba(0,0,0,0.8)',
        'left': '0px', 'top': '0px'
    });
    $('body').append(bg);

    let settings = GetSettings();

    let settingHTML = '<div style="color: white; font-size: 1em;">' +
        '<img id="pps-close" src="https://pp-1252089172.cos.ap-chengdu.myqcloud.com/Close.png" style="position: absolute; right: 35px; top: 20px; width: 32px; height: 32px; cursor: pointer;">' +
        '<div style="position: absolute; height: 60%; left: 50%; top: 10%; overflow-y: auto; transform: translate(-50%, 0%);">' +
        '<ul id="pps-ul" style="list-style: none; padding: 0; margin: 0;"></ul></div>' +
        '<div style="margin-top: 10px;position: absolute;bottom: 10%;width: 100%;text-align: center;">' +
        '<button id="pps-save" style="font-size: 25px; border-radius: 12px; height: 48px; min-width: 138px; max-width: 150px; background-color: green; color: white; margin: 0 32px 0 32px; cursor: pointer; border: none;">' + Texts[g_language].setting_save + '</button>' +
        '<button id="pps-reset" style="font-size: 25px; border-radius: 12px; height: 48px; min-width: 138px; max-width: 150px; background-color: darkred; color: white; margin: 0 32px 0 32px; cursor: pointer; border: none;">' + Texts[g_language].setting_reset + '</button>' +
        '</div></div>';

    bg.get(0).innerHTML = settingHTML;
    let ul = $('#pps-ul');
    function getImageAction(id) {
        return '<img id="' + id + '" src="https://pp-1252089172.cos.ap-chengdu.myqcloud.com/On.png" style="height: 32px; cursor: pointer; margin-right: 20px; vertical-align: middle;"/>';
    }
    function getInputAction(id) {
        return '<input id="' + id + '" style="font-size: 24px; padding: 0; margin-right: 16px; border-width: 0px; width: 64px; text-align: center;"/>'
    }
    function getSelectAction(id) {
        return '<select id="' + id + '" style="font-size: 20px; margin-right: 10px;"></select>';
    }
    function addItem(action, text) {
        ul.append('<li style="font-size: 25px; padding-bottom: 5px;">' + action + text + '</li>');
    }
    ul.empty();
    addItem(getSelectAction('pps-lang'), Texts[g_language].setting_language);
    addItem(getImageAction('pps-preview'), Texts[g_language].setting_preview);
    addItem(getImageAction('pps-sort'), Texts[g_language].setting_sort);
    addItem(getImageAction('pps-anime'), Texts[g_language].setting_anime);
    addItem(getImageAction('pps-original'), Texts[g_language].setting_origin);
    addItem(getInputAction('pps-previewDelay'), Texts[g_language].setting_previewDelay);
    addItem('', '&nbsp');
    addItem(getInputAction('pps-maxPage'), Texts[g_language].setting_maxPage);
    addItem(getInputAction('pps-hideLess'), Texts[g_language].setting_hideWork);
    addItem(getImageAction('pps-hideBookmarked'), Texts[g_language].setting_hideFav);
    addItem(getImageAction('pps-hideFollowed'), Texts[g_language].setting_hideFollowed + '&nbsp<button id="pps-clearFollowingCache" style="cursor:pointer;background-color:gold;border-radius:12px;border:none;font-size:20px;padding:3px 10px;" title="' + Texts[g_language].setting_clearFollowingCacheHelp + '">' + Texts[g_language].setting_clearFollowingCache + '</button>');
    addItem(getImageAction('pps-newTab'), Texts[g_language].setting_blank);
    addItem(getImageAction('pps-pageKey'), Texts[g_language].setting_turnPage);
    addItem(getImageAction('pps-fullSizeThumb'), Texts[g_language].sort_fullSizeThumb);
    addItem('', '&nbsp');
    addItem(getImageAction('pps-novelSort'), Texts[g_language].setting_novelSort);
    addItem(getInputAction('pps-novelMaxPage'), Texts[g_language].setting_novelMaxPage);

    let imgOn = 'https://pp-1252089172.cos.ap-chengdu.myqcloud.com/On.png';
    let imgOff = 'https://pp-1252089172.cos.ap-chengdu.myqcloud.com/Off.png'
    $('#pps-preview').attr('src', settings.enablePreview ? imgOn : imgOff).addClass(settings.enablePreview ? 'on' : 'off').css('cursor: pointer');
    $('#pps-sort').attr('src', settings.enableSort ? imgOn : imgOff).addClass(settings.enableSort ? 'on' : 'off').css('cursor: pointer');
    $('#pps-anime').attr('src', settings.enableAnimeDownload ? imgOn : imgOff).addClass(settings.enableAnimeDownload ? 'on' : 'off').css('cursor: pointer');
    $('#pps-original').attr('src', settings.original ? imgOn : imgOff).addClass(settings.original ? 'on' : 'off').css('cursor: pointer');
    $('#pps-previewDelay').val(settings.previewDelay);
    $('#pps-maxPage').val(settings.pageCount);
    $('#pps-hideLess').val(settings.favFilter);
    $('#pps-hideBookmarked').attr('src', settings.hideFavorite ? imgOn : imgOff).addClass(settings.hideFavorite ? 'on' : 'off').css('cursor: pointer');
    $('#pps-hideFollowed').attr('src', settings.hideFollowed ? imgOn : imgOff).addClass(settings.hideFollowed ? 'on' : 'off').css('cursor: pointer');
    $('#pps-newTab').attr('src', settings.linkBlank ? imgOn : imgOff).addClass(settings.linkBlank ? 'on' : 'off').css('cursor: pointer');
    $('#pps-pageKey').attr('src', settings.pageByKey ? imgOn : imgOff).addClass(settings.pageByKey ? 'on' : 'off').css('cursor: pointer');
    $('#pps-fullSizeThumb').attr('src', settings.fullSizeThumb ? imgOn : imgOff).addClass(settings.fullSizeThumb ? 'on' : 'off').css('cursor: pointer');
    $('#pps-novelSort').attr('src', settings.enableNovelSort ? imgOn : imgOff).addClass(settings.enableNovelSort ? 'on' : 'off').css('cursor: pointer');
    $('#pps-novelMaxPage').val(settings.novelPageCount);

    $('#pps-lang')
        .append('<option value="-1">Auto</option>')
        .append('<option value="' + Lang.zh_CN + '">简体中文</option>')
        .append('<option value="' + Lang.en_US + '">English</option>')
        .append('<option value="' + Lang.ru_RU + '">Русский язык</option>')
        .val(g_settings.lang == undefined ? Lang.auto : g_settings.lang);

    $('#pps-ul').find('img').click(function () {
        let _this = $(this);

        if (_this.hasClass('on')) {
            _this.attr('src', imgOff).removeClass('on').addClass('off');
        } else {
            _this.attr('src', imgOn).removeClass('off').addClass('on');
        }
    });
    $('#pps-clearFollowingCache').click(function () {
        let user_id = dataLayer[0].user_id;
        SetCookie('followingOfUid-' + user_id, null, -1);
        alert(Texts[g_language].setting_followingCacheCleared);
    });

    $('#pps-save').click(function () {
        if ($('#pps-maxPage').val() === '') {
            $('#pps-maxPage').val(g_defaultSettings.pageCount);
        }
        if ($('#pps-hideLess').val() == '') {
            $('#pps-hideLess').val(g_defaultSettings.favFilter);
        }

        let settings = {
            'lang': $('#pps-lang').val(),
            'enablePreview': $('#pps-preview').hasClass('on') ? 1 : 0,
            'enableSort': $('#pps-sort').hasClass('on') ? 1 : 0,
            'enableAnimeDownload': $('#pps-anime').hasClass('on') ? 1 : 0,
            'original': $('#pps-original').hasClass('on') ? 1 : 0,
            'previewDelay': parseInt($('#pps-previewDelay').val()),
            'pageCount': parseInt($('#pps-maxPage').val()),
            'favFilter': parseInt($('#pps-hideLess').val()),
            'hideFavorite': $('#pps-hideBookmarked').hasClass('on') ? 1 : 0,
            'hideFollowed': $('#pps-hideFollowed').hasClass('on') ? 1 : 0,
            'linkBlank': $('#pps-newTab').hasClass('on') ? 1 : 0,
            'pageByKey': $('#pps-pageKey').hasClass('on') ? 1 : 0,
            'fullSizeThumb': $('#pps-fullSizeThumb').hasClass('on') ? 1 : 0,
            'enableNovelSort': $('#pps-novelSort').hasClass('on') ? 1 : 0,
            'novelPageCount': parseInt($('#pps-novelMaxPage').val()),
            'version': g_version,
        }

        SetCookie('PixivPreview', settings);

        location.href = location.href;
    });

    $('#pps-reset').click(function () {
        let comfirmText = Texts[g_language].setting_resetHint;
        if (confirm(comfirmText)) {
            SetCookie('PixivPreview', null);
            location.href = location.href;
        }
    });

    $('#pps-close').click(function () {
        $('#pp-bg').remove();
    });
}
function SetTargetBlank(returnMap) {
    if (g_settings.linkBlank) {
        let target = [];
        $.each(returnMap.controlElements, function (i, e) {
            if (e.tagName == 'A') {
                target.push(e);
            }
        });

        $.each($(returnMap.controlElements).find('a'), function (i, e) {
            target.push(e);
        });

        $.each(target, function (i, e) {
            $(e).attr({ 'target': '_blank', 'rel': 'external' });
            // 主页这里用的是js监听跳转，特殊处理
            if (g_pageType == PageType.Home || g_pageType == PageType.Member || g_pageType == PageType.Artwork) {
                e.addEventListener("click", function (ev) {
                    ev.stopPropagation();
                })
            }
        });
    }
}
/* --------------------------------------- 主函数 --------------------------------------- */
let loadInterval = null;
let itv = null;
function Load() {
    // 匹配当前页面
    for (let i = 0; i < PageType.PageTypeCount; i++) {
        if (Pages[i].CheckUrl(location.href)) {
            g_pageType = i;
            break;
        }
    }
    if (g_pageType >= 0) {
        DoLog(LogLevel.Info, 'Current page is ' + Pages[g_pageType].PageTypeString);
    } else {
        DoLog(LogLevel.Info, 'Unsupported page.');
        clearInterval(loadInterval);
        return;
    }

    // 设置按钮
    let toolBar = Pages[g_pageType].GetToolBar();
    if (toolBar) {
        DoLog(LogLevel.Elements, toolBar);
        clearInterval(loadInterval);
    } else {
        DoLog(LogLevel.Warning, 'Get toolbar failed.');
        return;
    }

    window.onresize = function () {
        if ($('#pp-bg').length > 0) {
            let screenWidth = document.documentElement.clientWidth;
            let screenHeight = document.documentElement.clientHeight;
            $('#pp-bg').css({ 'width': screenWidth + 'px', 'height': screenHeight + 'px' });
        }
    };

    if ($('#pp-settings').length == 0) {
        toolBar.appendChild(toolBar.firstChild.cloneNode(true));
        toolBar.lastChild.outerHTML = '<button id="pp-settings" style="background-color: rgb(0, 0, 0);margin-top: 5px;opacity: 0.8;cursor: pointer;border: none;padding: 12px;border-radius: 24px;width: 48px;height: 48px;"><svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 1000 1000" enable-background="new 0 0 1000 1000" xml:space="preserve" style="fill: white;"><metadata> Svg Vector Icons : http://www.sfont.cn </metadata><g><path d="M377.5,500c0,67.7,54.8,122.5,122.5,122.5S622.5,567.7,622.5,500S567.7,377.5,500,377.5S377.5,432.3,377.5,500z"></path><path d="M990,546v-94.8L856.2,411c-8.9-35.8-23-69.4-41.6-100.2L879,186L812,119L689,185.2c-30.8-18.5-64.4-32.6-100.2-41.5L545.9,10h-94.8L411,143.8c-35.8,8.9-69.5,23-100.2,41.5L186.1,121l-67,66.9L185.2,311c-18.6,30.8-32.6,64.4-41.5,100.3L10,454v94.8L143.8,589c8.9,35.8,23,69.4,41.6,100.2L121,814l67,67l123-66.2c30.8,18.6,64.5,32.6,100.3,41.5L454,990h94.8L589,856.2c35.8-8.9,69.4-23,100.2-41.6L814,879l67-67l-66.2-123.1c18.6-30.7,32.6-64.4,41.5-100.2L990,546z M500,745c-135.3,0-245-109.7-245-245c0-135.3,109.7-245,245-245s245,109.7,245,245C745,635.3,635.3,745,500,745z"></path></g></svg></button>';
        $(toolBar.lastChild).css('margin-top', '10px');
        $(toolBar.lastChild).css('opacity', '0.8');
        $(toolBar.lastChild).click(function () {
            ShowSetting();
        });
    }

    // 读取设置
    g_settings = GetSettings();

    // 自动检测语言
    g_language = g_settings.lang == undefined ? Lang.auto : g_settings.lang;
    if (g_language == Lang.auto) {
        let lang = $('html').attr('lang');
        if (lang && lang.indexOf('zh') != -1) {
            // 简体中文和繁体中文都用简体中文
            g_language = Lang.zh_CN;
        } else {
            // 其他的统一用英语，其他语言也不知道谷歌翻译得对不对
            g_language = Lang.en_US;
        }
    }

    // g_csrfToken
    if (g_pageType == PageType.Search || g_pageType == PageType.NovelSearch) {
        $.get(location.href, function (data) {
            let matched = data.match(/token":"([a-z0-9]{32})/);
            if (matched.length > 0) {
                g_csrfToken = matched[1];
                DoLog(LogLevel.Info, 'Got g_csrfToken: ' + g_csrfToken);
            } else {
                DoLog(LogLevel.Error, 'Can not get g_csrfToken, so you can not add works to bookmark when sorting has enabled.');
            }
        });
    }

    // 排序、预览
    itv = setInterval(function () {
        let returnMap = Pages[g_pageType].ProcessPageElements();
        if (!returnMap.loadingComplete) {
            return;
        }

        DoLog(LogLevel.Info, 'Process page comlete, sorting and prevewing begin.');
        DoLog(LogLevel.Elements, returnMap);

        clearInterval(itv);

        SetTargetBlank(returnMap);

        try {
            if (g_pageType == PageType.Artwork) {
                Pages[g_pageType].Work();
                if (g_settings.enablePreview) {
                    PixivPreview();
                }
            }
            else if (g_pageType == PageType.Search) {
                if (g_settings.enableSort) {
                    g_sortComplete = false;
                    PixivSK(function () {
                        g_sortComplete = true;
                        if (g_settings.enablePreview) {
                            PixivPreview();
                        }
                    });
                } else if (g_settings.enablePreview) {
                    PixivPreview();
                }
            } else if (g_pageType == PageType.NovelSearch) {
                if (g_settings.enableNovelSort) {
                    PixivNS();
                }
            } else if (g_settings.enablePreview) {
                PixivPreview();
            }
        }
        catch (e) {
            DoLog(LogLevel.Error, 'Unknown error: ' + e);
        }
    }, 500);
}
function startLoad() {
    loadInterval = setInterval(Load, 1000);
    setInterval(function () {
        if (location.href != initialUrl) {
            // 排序中点击搜索tag，可能导致进行中的排序出现混乱，加取消太麻烦，直接走刷新
            if (!g_sortComplete) {
                location.href = location.href;
                return;
            }
            // fix 主页预览图出现后点击图片，进到详情页，预览图不消失的问题
            if ($('.pp-main').length > 0) {
                $('.pp-main').remove();
            }
            initialUrl = location.href;
            clearInterval(loadInterval);
            clearInterval(itv);
            clearInterval(autoLoadInterval);
            autoLoadInterval = null;
            g_pageType = -1;
            loadInterval = setInterval(Load, 300);
        }
    }, 1000);
}
let inChecking = false;
let jqItv = setInterval(function () {
    if (inChecking) {
        return;
    }
    inChecking = true;
    checkJQuery().then(function (isLoad) {
        if (isLoad) {
            clearInterval(jqItv);
            startLoad();
        }
        inChecking = false;
    });
}, 1000);