// ==UserScript==
// @name         Pixiv Previewer
// @namespace    https://github.com/Ocrosoft/PixivPreviewer
// @version      2.08
// @description  显示大图预览，按热门度排序(pixiv_sk)。Show Preview, ands sort by bookmark count.
// @author       Ocrosoft
// @match        *://www.pixiv.net/*
// @grant        none
// @compatible   Chrome
// ==/UserScript==

// 测试 JQuery，如果不支持就插入
try {
    $();
} catch (e) {
    var script = document.createElement('script');
    script.src = 'https://code.jquery.com/jquery-2.2.4.min.js';
    document.head.appendChild(script);
}

var LogLevel = {
    None: 0,
    Error: 1,
    Warning: 2,
    Info: 3,
    Elements: 4,
}

function DoLog(level, msgOrElement) {
    if (level <= LOG_LEVEL) {
        var prefix = '%c';
        var param = '';

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
            console.clear();
            g_logCount = 0;
        }
    }
}

// 添加收藏需要这个
var g_csrfToken = '';
// 打的日志数量，超过一定数值清空控制台
var g_logCount = 0;
// 当前页面类型
var g_pageType = -1;
// 图片详情页的链接，使用时替换 #id#
var g_artworkUrl = '/artworks/#id#';
// 获取图片链接的链接
var g_getArtworkUrl = '/ajax/illust/#id#/pages';
// 鼠标位置
var g_mousePos = { x: 0, y: 0 };
// 加载中图片
var g_loadingImage = 'https://raw.githubusercontent.com/shikato/pixiv_sk/master/loading.gif';

// 页面相关的一些预定义，包括处理页面元素等
var PageType = {
    // 搜索
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
    // 用户-插画页
    MemberIllust: 10,
    // 用户-收藏页
    MemberBookMark: 11,

    // 总数
    PageTypeCount: 12,
};
var Pages = {};
/*
 * Pages 元素规则，仅包含必须有的内容，可以添加其他内容
 * PageTypeString: string，字符串形式的 PageType
 * bool CheckUrl: function(string url)，用于检查一个 url 是否是当前页面的目标 url
 * ReturnMap ProcessPageElements: function()，处理页面（寻找图片元素、添加属性等），返回 ReturnMap
 * Object GetToolBar: function(), 返回工具栏元素（右下角那个，用来放设置按钮）
 * GetProcessedPageElements: function(), 返回上一次 ProcessPageElements 的返回值（如果没有上次调用则调用一次）
 */
var ReturnMapSample = {
    // 页面是否加载完成，false 意味着后面的成员无效
    loadingComplete: false,
    // 控制元素，每个图片的鼠标响应元素
    controlElements: [],
};
var ControlElementsAttributesSample = {
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

Pages[PageType.Search] = {
    PageTypeString: 'SearchPage',
    CheckUrl: function (url) {
        return /^https?:\/\/www.pixiv.net\/tags\/.*\/artworks/.test(url);
        //return /^https?:\/\/www.pixiv.net\/search.php.*/.test(url);
    },
    ProcessPageElements: function () {
        var returnMap = {
            loadingComplete: false,
            controlElements: [],
        };

        var sections = $('section');
        DoLog(LogLevel.Info, 'Page has ' + sections.length + ' <section>.');
        DoLog(LogLevel.Elements, sections);
        // 先对 section 进行评分
        var sectionIndex = -1;
        var bestScore = -99;
        sections.each(function (i, e) {
            var section = $(e);
            var score = 0;
            if (section.find('ul').length > 0) {
                var childrenCount = section.children().length;
                if (childrenCount != 2) {
                    DoLog(LogLevel.Warning, '<ul> was found in this <section>, but it has ' + childrenCount + ' children!');
                    score--;
                }
                var ul = section.find('ul');
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
                var lis = ul.find('li');
                if (lis.length === 0) {
                    DoLog(LogLevel.Info, 'This <ul> has 0 children, will be skipped.');
                    return false;
                }
                if (lis.length > 4) {
                    score += 5;
                }
                if (score > bestScore) {
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

        var lis = $(sections[sectionIndex]).find('ul').find('li');
        lis.each(function (i, e) {
            var li = $(e);
            var control = li.children('div:first');

            // 只填充必须的几个，其他的目前用不着
            var ctlAttrs = {
                illustId: 0,
                illustTye: 0,
                pageCount: 1,
            };

            // 有 figure 的是 lazy load，读取不到数据
            if (li.find('figure').length === 0) {
                var img = $(li.find('img').get(0));
                var imageLink = img.parent().parent();
                var additionDiv = img.parent().prev();
                var animationSvg = img.parent().find('svg');
                var pageCountSpan = additionDiv.find('span');

                var link = imageLink.attr('href');
                var linkMatched = link.match(/artworks\/(\d+)/);
                var illustId = '';
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
                li.attr({
                    'illustId': ctlAttrs.illustId,
                    'illustType': ctlAttrs.illustTye,
                    'pageCount': ctlAttrs.pageCount
                });
            }

            li.addClass('pp-control');
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
            return ProcessPageElements;
        }
        return this.private.returnMap;
    },
    GetToolBar: function () {
        return $('#root').children('div:last').prev().find('li').get(0);
    },
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
        return /^https:\/\/www.pixiv.net\/bookmark_new_illust.php.*/.test(url);
    },
    ProcessPageElements: function () {
        //
    },
    GetToolBar: function () {
        //
    },
};
Pages[PageType.Discovery] = {
    PageTypeString: 'DiscoveryPage',
    CheckUrl: function (url) {
        return /^https?:\/\/www.pixiv.net\/discovery.*/.test(url);
    },
    ProcessPageElements: function () {
        //
    },
    GetToolBar: function () {
        //
    },
};
Pages[PageType.Member] = {
    PageTypeString: 'MemberPage',
    CheckUrl: function (url) {
        return /^https?:\/\/www.pixiv.net\/member.php\?id=.*/.test(url);
    },
    ProcessPageElements: function () {
        //
    },
    GetToolBar: function () {
        //
    },
};
Pages[PageType.Home] = {
    PageTypeString: 'HomePage',
    CheckUrl: function (url) {
        var patterns = [
            /https?:\/\/www.pixiv.net\/$/,
            /https?:\/\/www.pixiv.net$/,
            /https?:\/\/www.pixiv.net\?.*/,
            /https?:\/\/www.pixiv.net\/\?.*/,
        ];
        for (var i = 0; i < patterns.length; i++) {
            if (patterns[i].test(url)) {
                return true;
            }
        }
        return false;
    },
    ProcessPageElements: function () {
        var returnMap = {
            loadingComplete: false,
            controlElements: [],
        };

        var uls = $('._image-items');

        DoLog(LogLevel.Info, 'This page has ' + uls.length + ' <ul>.');
        if (uls.length < 1) {
            DoLog(LogLevel.Warning, 'Less than 1 <ul>, continue waiting.');
            return returnMap;
        } else if (uls.length != 4) {
            DoLog(LogLevel.Warning, 'Normaly, should found 4 <ul>.');
        }

        uls.each(function (i, e) {
            var _this = $(e);

            var li = _this.find('.image-item');
            if (li.length < 1) {
                DoLog(LogLevel.Warning, 'This <ul> has 0 <li>, will be skipped.');
                return;
            }

            li.each(function (j, ee) {
                var __this = $(ee);

                var ctlAttrs = {
                    illustId: 0,
                    illustTye: 0,
                    pageCount: 1,
                };

                var illustId = __this.find('a:first').attr('data-gtm-recommend-illust-id') || __this.find('img:first').attr('data-id');
                if (illustId == null) {
                    DoLog(LogLevel.Warning, 'Can not found illust id of this image, skip.');
                    return;
                } else {
                    ctlAttrs.illustId = illustId;
                }
                var pageCount = __this.find('.page-count');
                if (pageCount.length > 0) {
                    pageCount = parseInt(pageCount.find('span').text());
                }
                if (__this.find('a:first').hasClass('ugoku-illust')) {
                    ctlAttrs.illustTye = 2;
                }

                __this.attr({
                    'illustId': ctlAttrs.illustId,
                    'illustType': ctlAttrs.illustTye,
                    'pageCount': ctlAttrs.pageCount
                });

                returnMap.controlElements.push(ee);
            });
        });

        DoLog(LogLevel.Info, 'Process page elements complete.');
        DoLog(LogLevel.Elements, returnMap);

        returnMap.loadingComplete = true;
        this.private.returnMap = returnMap;
        return returnMap;
    },
    GetProcessedPageElements: function() {
        return this.private.returnMap;
    },
    GetToolBar: function () {
        return $('._toolmenu').get(0);
    },
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
        //
    },
    GetToolBar: function () {
        //
    },
};
Pages[PageType.NewIllust] = {
    PageTypeString: 'NewIllustPage',
    CheckUrl: function (url) {
        return /^https?:\/\/www.pixiv.net\/new_illust.php.*/.test(url);
    },
    ProcessPageElements: function () {
        //
    },
    GetToolBar: function () {
        //
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
};
Pages[PageType.BookMark] = {
    PageTypeString: 'BookMarkPage',
    CheckUrl: function (url) {
        return /^https:\/\/www.pixiv.net\/bookmark.php\/?$/.test(url);
    },
    ProcessPageElements: function () {
        //
    },
    GetToolBar: function () {
        //
    },
};
Pages[PageType.Stacc] = {
    PageTypeString: 'StaccPage',
    CheckUrl: function (url) {
        return /^https:\/\/www.pixiv.net\/stacc.*/.test(url);
    },
    ProcessPageElements: function () {
        //
    },
    GetToolBar: function () {
        //
    },
};
Pages[PageType.MemberIllust] = {
    PageTypeString: 'MemberIllustPage',
    CheckUrl: function (url) {
        return /^https:\/\/www.pixiv.net\/member_illust.php.*/.test(url);
    },
    ProcessPageElements: function () {
        //
    },
    GetToolBar: function () {
        //
    },
};
Pages[PageType.MemberBookMark] = {
    PageTypeString: 'MemberBookMarkPage',
    CheckUrl: function (url) {
        return /^https:\/\/www.pixiv.net\/bookmark.php\?.*/.test(url);
    },
    ProcessPageElements: function () {
        //
    },
    GetToolBar: function () {
        //
    },
};

function CheckUrlTest() {
    var urls = [
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
    ];

    for (var j = 0; j < urls.length; j++) {
        for (var i = 0; i < PageType.PageTypeCount; i++) {
            if (Pages[i].CheckUrl(urls[j])) {
                console.log(urls[j]);
                console.log('[' + j + '] is ' + Pages[i].PageTypeString);
            }
        }
    }
}
//CheckUrlTest();

/**
 * ---------------------------------------- 以下为 设置 部分 ----------------------------------------
 * -------------------------------------------- Settings --------------------------------------------
 */
// 注意: 此处为默认设置，修改无效。如需修改设置，请使用设置界面。
// 是否开启预览功能
var ENABLE_PREVIEW = true;
// 预览的图片质量，0：普通；1：原图
var PREVIEW_QUALITY = 0;
// 不显示多图切换时的加载图片
var HIDE_LOADING_IN_NEXTPIC = false;
// 是否开启排序功能
var ENABLE_SORT = true;
// 每次加载的页数
var GETTING_PAGE_COUNT = 1;
// 收藏量在此以下的不显示
var FAV_FILTER = 3;
// 隐藏已收藏图片
var HIDE_FAVORITE = false;
// true，使用新标签页打开图片；false，保持默认
var IS_LINK_BLANK = true;
// 语言，根据页面自动确定（其他不支持的语言时该选项生效，默认使用 English，可以修改成 0 使用简体中文）
var LANG = 1;
// 日志等级
var LOG_LEVEL = LogLevel.Elements;
// 排序时同时请求收藏量的 Request 数量，不要太多
var XHR_COUNT = 10;

/**
 * ---------------------------------------- 以下为 预览功能 部分 ----------------------------------------
 */
var dataDivSelector = [
    '#js-react-search-mid',
    '#js-mount-point-latest-following',
    '.gtm-illust-recommend-zone',
    '...',
    '...',
    '.ranking-items-container',
    '...',
    '...',
    '...',
    '...'
];
var infoDivSelector = [
    '#js-mount-point-search-result-list',
    '#js-mount-point-latest-following',
    '...',
    '...',
    '...',
    '...',
    '...',
    '...',
    '...',
    '...'
];

var dataDiv, infoDiv, picList, picDiv = [], picHref = []; // 相关元素，含义见上
var dataStr; // 更新后图片信息使用 json 保存在了 dataDiv 的 data-items 属性中
var imgData; // 保存解析后的 json
var SORT_END = false; // 是否排序完成
var initialUrl = location.href;

// 获取相关的元素
function getImageElements() {
    if (infoDivSelector[g_pageType] == '...') {
        return;
    }
    dataDiv = $(dataDivSelector[g_pageType]);
    infoDiv = $(infoDivSelector[g_pageType]);
    dataStr = infoDiv.attr('data-items');
    imgData = eval(dataStr);
    picList = dataDiv.children()[0];
    var pics = $(picList).children();
    picDiv = [];
    picHref = [];
    for (var i = 0; i < pics.length; i++) {
        if (pics[i].className != pics[0].className) {
            pics[i].remove();
            pics.splice(i--, 1);
            continue;
        }
        picDiv.push(pics[i].childNodes[0].childNodes[0]);
        $(picDiv[i]).attr('data-index', i);
        picHref.push(picDiv[i].childNodes[0]);
        $(picHref[i]).attr('data-index', i);
        $(picHref[i]).attr('data-id', imgData[i].illustId);
    }
}
// 动图预览在相关页面调用的函数(自动执行，非动图页面无操作)
(function animePreview() {
    try {
        // 动图下载
        /*if (location.href.indexOf('medium') != -1 && document.querySelectorAll('._ugoku-illust-player-container').length > 0) {
            var script = document.createElement('script');
            script.src = 'https://greasyfork.org/scripts/30681/code/Pixiv.user.js';
            document.body.appendChild(script);
        }*/
        // 全图预览调节并返回 canvas 大小
        if (location.href.indexOf('/artworks/') != -1 && location.href.indexOf('animePreview') != -1) {
            var itv = setInterval(function () {
                if (document.querySelectorAll('canvas').length > 0) {
                    var canvas = document.querySelectorAll('canvas');
                    // 额，能用 jquery...
                    $(canvas[0]).click();
                    if ($('canvas').length < 2) return;
                    clearInterval(itv);

                    var e, mouseX, mouseY, screenWidth, screenHeight, height, width, newHeight, newWidth, scale;
                    scale = 1.0;
                    mouseY = screenHeight = location.href.split('animePreview')[1];
                    mouseX = mouseY.split(',')[0];
                    mouseY = mouseY.split(',')[1];
                    screenWidth = screenHeight.split(',')[2];
                    screenHeight = screenHeight.split(',')[3];
                    width = parseInt(document.querySelector('canvas').width);
                    height = parseInt(document.querySelector('canvas').height);

                    if (height > width) {
                        newHeight = screenHeight;
                        newWidth = newHeight / height * width;
                        if (mouseX > screenWidth / 2) {
                            while (newWidth * scale > mouseX - 5) {
                                scale -= 0.01;
                            }
                        } else {
                            while (newWidth * scale > screenWidth - mouseX - 5) {
                                scale -= 0.01;
                            }
                        }
                        newHeight *= scale;
                        newWidth *= scale;
                    } else {
                        if (mouseX > screenWidth / 2) {
                            newWidth = mouseX - 5;
                        } else {
                            newWidth = screenWidth - mouseX - 5;
                        }
                        newHeight = newWidth / width * height;
                        while (newHeight * scale > screenHeight) {
                            scale -= 0.01;
                        }
                        newHeight *= scale;
                        newWidth *= scale;
                    }
                    newWidth -= 25;
                    newHeight -= 50;

                    document.querySelectorAll('canvas')[1].style.width = newWidth + 'px';
                    document.querySelectorAll('canvas')[1].style.height = newHeight + 'px';
                    var div = document.createElement('div');
                    div.className = 'embed';

                    div.innerHTML = '<form style="width:100%;text-align:center;"><input id="dl_full" type="button" value="全屏版" style="text-align: center;padding: 9px 0;width: 100%;border-radius: 4px;background-color: #ffecd9;color: #faa200;font-weight: bold;border: 0;margin-bottom: 10px;cursor: pointer;"></form>';
                    $($('canvas')[1]).parent().prepend(div);
                    window.parent.iframeLoaded(newHeight + 30, newWidth + 30);
                    //https://i.pximg.net/img-zip-ugoira/img/2019/03/30/17/13/18/73950472_ugoira1920x1080.zip
                    //original":"https:\/\/i.pximg.net\/img-original\/img\/2019\/03\/30\/17\/13\/18\/73950472_ugoira0.jpg"
                    var reg = new RegExp('original.*?http.*?img-original.*?ugoira.*?"');
                    var tmp = document.querySelector('html').innerHTML;
                    // 去掉头尾不要的部分
                    var full = reg.exec(tmp)[0].split('":"')[1];
                    full = full.substring(0, full.length - 1);
                    // 替换成下载地址
                    full = full.replace(/ugoira.*/, 'ugoira1920x1080.zip');
                    full = full.replace('img-original', 'img-zip-ugoira');
                    $('#dl_full').click(function () {
                        window.open(full);
                        $('canvas').click();
                    });
                }
            }, 500);
            return;
        }
    } catch (e) {
        //
    }
})();
// iframe 加载完成时调用（动图预览）
// arg: canvas 元素高，canvas 元素宽
var callbackScript = document.createElement('script');
callbackScript.innerHTML = "function iframeLoaded(height,width){$('.pixivPreview').children('iframe').attr({'width':width,'height':height});$('.pixivPreview').children('iframe').css('display','');$('.pixivPreview').children('img').remove();}";
document.body.appendChild(callbackScript);
function PixivPreview() {
    // 开启预览功能
    function ActivePreview() {
        var returnMap = Pages[g_pageType].GetProcessedPageElements();
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

            var _this = $(this);
            var illustId = _this.attr('illustId');
            var illustType = _this.attr('illustType');
            var pageCount = _this.attr('pageCount');

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

            // 鼠标位置
            g_mousePos = { x: e.pageX, y: e.pageY };
            // 预览 Div
            var previewDiv = $(document.createElement('div')).addClass('pp-main').attr('illustId', illustId)
                .css({
                    'position': 'absolute', 'z-index': '999999', 'left': g_mousePos.x + 'px', 'top': g_mousePos.y + 'px',
                    'border-style': 'solid', 'border-color': '#6495ed', 'border-width': '2px', 'border-radius': '20px',
                    'width': '48px', 'height': '48px',
                });
            // 添加到 body
            $('.pp-main').remove();
            $('body').append(previewDiv);

            // 加载中图片
            var loadingImg = $(new Image()).addClass('pp-loading').attr('src', g_loadingImage).css({
                'position': 'absolute', 'border-radius': '20px',
            });
            previewDiv.append(loadingImg);

            // 要显示的预览图节点
            var loadImg = $(new Image()).addClass('pp-image').css({ 'height': '0px', 'width': '0px', 'display': 'none', 'border-radius': '20px'});
            previewDiv.append(loadImg);

            // 原图（笑脸）图标
            var originIcon = $(new Image()).addClass('pp-original').attr('src', 'https://source.pixiv.net/www/images/pixivcomic-favorite.png')
                .css({ 'position': 'absolute', 'bottom': '5px', 'right': '5px', 'display': 'none' });
            previewDiv.append(originIcon);

            // 点击图标新网页打开原图
            originIcon.click(function () {
                window.open($(previewDiv).children('img')[1].src);
            });

            // 右上角张数标记
            var pageCountHTML = '<div class="pp-pageCount" style="display: flex;-webkit-box-align: center;align-items: center;box-sizing: border-box;margin-left: auto;height: 20px;color: rgb(255, 255, 255);font-size: 10px;line-height: 12px;font-weight: bold;flex: 0 0 auto;padding: 4px 6px;background: rgba(0, 0, 0, 0.32);border-radius: 10px;margin-top:5px;margin-right:5px;">\<svg viewBox="0 0 9 10" width="9" height="10" style="stroke: none;line-height: 0;font-size: 0px;fill: currentcolor;"><path d="M8,3 C8.55228475,3 9,3.44771525 9,4 L9,9 C9,9.55228475 8.55228475,10 8,10 L3,10 C2.44771525,10 2,9.55228475 2,9 L6,9 C7.1045695,9 8,8.1045695 8,7 L8,3 Z M1,1 L6,1 C6.55228475,1 7,1.44771525 7,2 L7,7 C7,7.55228475 6.55228475,8 6,8 L1,8 C0.44771525,8 0,7.55228475 0,7 L0,2 C0,1.44771525 0.44771525,1 1,1 Z"></path></svg><span style="margin-left:2px;" class="pp-page">0/0</span></div>';
            var pageCountDiv = $(pageCountHTML)
                .css({ 'position': 'absolute', 'top': '0px', 'display': 'none', 'right': '0px', 'display': 'none' });
            previewDiv.append(pageCountDiv);

            $('.pp-main').mouseout(function (e) {
                $(this).remove();
            });

            var url = '';
            if (illustType == 2) {
                // 动图
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

                        var regular = [];
                        var original = [];
                        for (var i = 0; i < json.body.length; i++) {
                            regular.push(json.body[i].urls.regular);
                            original.push(json.body[i].urls.original);
                        }

                        DoLog(LogLevel.Info, 'Process urls complete.');
                        DoLog(LogLevel.Elements, regular);
                        DoLog(LogLevel.Elements, original);

                        ViewImages(regular, 0, original, PREVIEW_QUALITY > 0);
                    },
                    error: function (data) {
                        DoLog(LogLevel.Error, 'Request image urls failed!');
                        if (data) {
                            DoLog(LogLevel.Elements, data);
                        }
                    }
                });
            }

            // 动图，illustType 值为2
            /*if (imgData[dataIndex].illustType == 2) {
                $(previewDiv).children().remove();
                var screenWidth = document.documentElement.clientWidth;
                var screenHeight = document.documentElement.clientHeight;
                previewDiv.innerHTML = '<iframe width="600px" height="50%" src="https://www.pixiv.net/artworks/' +
                    $(picHref[dataIndex]).attr('data-id') + '#animePreview' + g_mousePos.x + ',' + g_mousePos.y + ',' + screenWidth + ',' + screenHeight + '"/>';
                $(previewDiv).children('iframe').css('display', 'none');
                $(previewDiv).children('iframe').attr('data-index', dataIndex);
                loadingImg = new Image();
                loadingImg.src = 'https://raw.githubusercontent.com/shikato/PixivSK/master/loading.gif';
                $(loadingImg).css('position', 'absolute');
                previewDiv.appendChild(loadingImg);
                return;
            }*/
        });

        // 鼠标移出图片
        $(returnMap.controlElements).mouseleave(function (e) {
            var _this = $(this);
            var illustId = _this.attr('illustId');
            var illustType = _this.attr('illustType');
            var pageCount = _this.attr('pageCount');

            var moveToElement = $(e.relatedTarget);
            var isMoveToPreviewElement = false;
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
            var screenWidth = document.documentElement.clientWidth;
            var screenHeight = document.documentElement.clientHeight;
            g_mousePos.x = e.pageX; g_mousePos.y = e.pageY;

            AdjustDivPosition();
        });

        DoLog(LogLevel.Info, 'Preview enable successful!');
    }

    // 调整预览 Div 的位置
    function AdjustDivPosition() {
        // 鼠标到预览图的距离
        var fromMouseToDiv = 30;

        var screenWidth = document.documentElement.clientWidth;
        var screenHeight = document.documentElement.clientHeight;
        var left = 0;
        var top = document.body.scrollTop + document.documentElement.scrollTop;
        $('.pp-image').css({ 'width': '', 'height': '' });
        var width = $('.pp-image').get(0) == null ? 0 : $('.pp-image').get(0).width;
        var height = $('.pp-image').get(0) == null ? 0 : $('.pp-image').get(0).height;

        var isShowOnLeft = g_mousePos.x > screenWidth / 2;

        var newWidth = 48, newHeight = 48;
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
            $('.pp-image').css({ 'height': newHeight + 'px', 'width': newWidth + 'px' });
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

    // 显示预览图
    // args: 图片地址数组，下标，原图地址数组，是否显示原图
    function ViewImages(regular, index, original, isShowOriginal) {
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
        PREVIEW_QUALITY = isShowOriginal ? 1 : 0;

        // 隐藏多图加载中图片
        if (HIDE_LOADING_IN_NEXTPIC) {
            // TODO
        }

        // 隐藏页数和原图标签
        $('.pp-original, .pp-pageCount').hide();

        // 第一次需要绑定事件
        if ($('.pp-image').attr('index') == null) {
            // 绑定点击事件，Ctrl+左键 单击切换原图
            $('.pp-image').on('click', function (ev) {
                var _this = $(this);
                var isOriginal = _this.hasClass('original');
                var index = _this.attr('index');
                if (index == null) {
                    index = 0;
                } else {
                    index = parseInt(index);
                }

                if (ev.ctrlKey) {
                    // 按住 Ctrl 来回切换原图
                    isOriginal = !isOriginal;
                    ViewImages(regular, index, original, isOriginal);
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
                    ViewImages(regular, index, original, isOriginal);
                    // 预加载
                    for (var i = index + 1; i < regular.length && i <= index + 3; i++) {
                        var image = new Image();
                        image.src = isOriginal ? original[i] : regular[i];;
                    }
                }
            });

            // 图片预加载完成
            $('.pp-image').on('load', function () {
                // 调整图片位置和大小
                var _this = $(this);
                var size = AdjustDivPosition();
                var isShowOriginal = _this.hasClass('original');

                // 调整下一次 loading 出现的位置
                $('.pp-loading').css({ 'left': size.width / 2 - 24 + 'px', 'top': size.height / 2 - 24 + 'px' }).css('display', 'none');
                // 显示图像、页数、原图标签
                $('.pp-image').css('display', '');
                if (regular.length > 1) {
                    $('.pp-pageCount').show();
                }
                if (isShowOriginal) {
                    $('.pp-original').show();
                }

                // 预加载
                for (var i = index + 1; i < regular.length && i <= index + 3; i++) {
                    var image = new Image();
                    image.src = isShowOriginal ? original[i] : regular[i];;
                }
            }).on('error', function () {
                DoLog(LogLevel.Error, 'Load image failed!');
            });
        }

        $('.pp-image').attr('src', isShowOriginal ? original[index] : regular[index]).attr('index', index);
    }

    // 开启预览
    ActivePreview();
}
/**
 * ---------------------------------------- 以下为 排序功能 部分 ----------------------------------------
 */
function PixivSK(callback) {
    // 不合理的设定
    if (GETTING_PAGE_COUNT < 1 || FAV_FILTER < 0) {
        GETTING_PAGE_COUNT = 1;
        FAV_FILTER = 0;
    }
    // 当前已经取得的页面数量
    var currentGettingPageCount = 0;
    // 当前加载的页面 URL
    var currentUrl = 'https://www.pixiv.net/ajax/search/artworks/';
    // 当前加载的是第几张页面
    var currentPage = 0;
    // 获取到的作品
    var works = [];

    // 仅搜索页启用
    if (g_pageType != PageType.Search) {
        return;
    }

    // 获取第 currentPage 页的作品
    var getWorks = function (onloadCallback) {
        {
            currentUrl = currentUrl.replace(/p=\d+/, 'p=' + currentPage);
            DoLog(LogLevel.Info, 'Current url: ' + currentUrl);
        }

        var req = new XMLHttpRequest();
        req.open('GET', currentUrl, true);
        req.onload = function (event) {
            onloadCallback(req);
        };
        req.onerror = function (event) {
            DoLog(LogLevel.Error, 'Request search page error!');
        };

        req.send(null);
    };

    // 排序和筛选
    var filterAndSort = function () {
        DoLog(LogLevel.Info, 'Start sort.');
        DoLog(LogLevel.Elements, works);
        // 收藏量低于 FAV_FILTER 的作品不显示
        var tmp = [];
        $(works).each(function (i, work) {
            var bookmarkCount = work.bookmarkCount ? work.bookmarkCount : 0;
            if (bookmarkCount >= FAV_FILTER && !(HIDE_FAVORITE && work.bookmarkData)) {
                tmp.push(work);
            }
        });
        works = tmp;

        // 排序
        works.sort(function (a, b) {
            var favA = a.bookmarkCount;
            var favB = b.bookmarkCount;
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
    };

    if (currentPage === 0) {
        var url = location.href;

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
        var wordMatch = url.match(/\/tags\/([^/]*)\/artworks/);
        var searchWord = '';
        if (wordMatch) {
            DoLog(LogLevel.Info, 'Search key word: ' + searchWord);
            searchWord = wordMatch[1];
        } else {
            DoLog(LogLevel.Error, 'Can not found search key word!');
            return;
        }

        // page
        var page = url.match(/p=(\d*)/)[1];
        currentPage = parseInt(page);
        DoLog(LogLevel.Info, 'Current page: ' + currentPage);

        currentUrl += searchWord + '?word=' + searchWord + '&p=' + currentPage;
        DoLog(LogLevel.Info, 'Current url: ' + currentUrl);
    } else {
        DoLog(LogLevel.Error, '???');
    }

    var imageContainer = Pages[PageType.Search].GetImageListContainer();
    // loading
    $(imageContainer).hide().before('<div id="loading" style="width:50px;margin-left:auto;margin-right:auto;">' + '<img src="' + g_loadingImage + '" />' +
                                    '<p id="progress" style="text-align: center;font-size: large;font-weight: bold;padding-top: 10px;">0%</p></div>');

    // page
    if (true) {
        var pageSelectorDiv = Pages[PageType.Search].GetPageSelector();
        if (pageSelectorDiv == null) {
            DoLog(LogLevel.Error, 'Can not found page selector!');
            return;
        }

        if ($(pageSelectorDiv).find('a').length > 2) {
            var pageButton = $(pageSelectorDiv).find('a').get(1);
            var newPageButtons = [];
            var pageButtonString = 'Previewer';
            for (var i = 0; i < 9; i++) {
                var newPageButton = pageButton.cloneNode(true);
                $(newPageButton).find('span').text(pageButtonString[i]);
                newPageButtons.push(newPageButton);
            }

            $(pageSelectorDiv).find('button').remove();
            while ($(pageSelectorDiv).find('a').length > 2) {
                $(pageSelectorDiv).find('a:first').next().remove();
            }

            for (var i = 0; i < 9; i++)
                $(pageSelectorDiv).find('a:last').before(newPageButtons[i]);

            $(pageSelectorDiv).find('a').attr('href', 'javascript:;');

            var pageUrl = location.href;
            if (pageUrl.indexOf('&p=') == -1 || pageUrl.indexOf('?p=') == -1) {
                if (pageUrl.indexOf('?') == -1) {
                    pageUrl += '?p=1';
                } else {
                    pageUrl += '&p=1';
                }
            }
            var prevPageUrl = pageUrl.replace(/p=\d+/, 'p=' + (currentPage - GETTING_PAGE_COUNT > 1 ? currentPage - GETTING_PAGE_COUNT : 1));
            var nextPageUrl = pageUrl.replace(/p=\d+/, 'p=' + (currentPage + GETTING_PAGE_COUNT));
            DoLog(LogLevel.Info, 'Previous page url: ' + prevPageUrl);
            DoLog(LogLevel.Info, 'Next page url: ' + nextPageUrl);
            // 重新插入一遍清除事件绑定
            var prevButton = $(pageSelectorDiv).find('a:first');
            prevButton.before(prevButton.clone());
            prevButton.remove();
            var nextButton = $(pageSelectorDiv).find('a:last');
            nextButton.before(nextButton.clone());
            nextButton.remove();
            $(pageSelectorDiv).find('a:first').attr('href', prevPageUrl);
            $(pageSelectorDiv).find('a:last').attr('href', nextPageUrl);
        }

        var onloadCallback = function (req) {
            try {
                var json = JSON.parse(req.responseText);
                if (json.hasOwnProperty('error')) {
                    if (json['error'] === false) {
                        var data = json['body']['illustManga']['data'];
                        works = works.concat(data);
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
            // 设定数量的页面加载完成
            if (currentGettingPageCount == GETTING_PAGE_COUNT) {
                GetBookmarkCount(0);
            } else {
                getWorks(onloadCallback);
            }
        };

        getWorks(onloadCallback);
    }

    var xhrs = [];
    var currentRequestGroupMinimumIndex = 0;
    function FillXhrsArray() {
        xhrs.length = 0;
        for (var i = 0; i < XHR_COUNT; i++) {
            xhrs.push({
                xhr: new XMLHttpRequest(),
                illustId: '',
                complete: false,
            });
            xhrs[i].xhr.onload = function (event) {
                var matched = event.currentTarget.responseText.match(/bookmarkCount":(\d+)/);
                if (matched) {
                    var bookmarkCount = matched[1];
                    var illustId = '';
                    var illustIdMatched = event.currentTarget.responseURL.match(/artworks\/(\d+)/);
                    if (illustIdMatched) {
                        illustId = illustIdMatched[1];
                    } else {
                        DoLog(LogLevel.Error, 'Can not get illust id from url!');
                        return;
                    }
                    var indexOfThisRequest = -1;
                    for (var j = 0; j < XHR_COUNT; j++) {
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

                    works[currentRequestGroupMinimumIndex + indexOfThisRequest].bookmarkCount = parseInt(bookmarkCount);
                    DoLog(LogLevel.Info, 'IllustId: ' + illustId + ', bookmarkCount: ' + bookmarkCount);

                    var completeCount = 0;
                    for (var j = 0; j < XHR_COUNT; j++) {
                        if (xhrs[j].complete) {
                            completeCount++;
                        }
                    }
                    if (completeCount == XHR_COUNT) {
                        $('#loading').find('#progress').text(parseInt((currentRequestGroupMinimumIndex + 1) * 1.0 / works.length * 100) + '%');
                        currentRequestGroupMinimumIndex += XHR_COUNT;
                        GetBookmarkCount(currentRequestGroupMinimumIndex);
                    }
                }
            };
            xhrs[i].xhr.onerror = function (event) {
                var illustId = '';
                var illustIdMatched = event.currentTarget.responseUrl.match(/artworks\/(\d+)/);
                if (illustIdMatched) {
                    illustId = illustIdMatched[1];
                } else {
                    DoLog(LogLevel.Error, 'Can not get illust id from url!');
                    return;
                }

                DoLog(LogLevel.Error, 'Send request failed, set this illust(' + illustId + ')\'s bookmark count to 0!');

                var indexOfThisRequest = -1;
                for (var j = 0; j < XHR_COUNT; j++) {
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

                var completeCount = 0;
                for (var j = 0; j < XHR_COUNT; j++) {
                    if (xhrs[j].complete) {
                        completeCount++;
                    }
                }
                if (completeCount == XHR_COUNT) {
                    $('#loading').find('#progress').text(parseInt((currentRequestGroupMinimumIndex + 1) * 1.0 / works.length * 100) + '%');
                    GetBookmarkCount(currentRequestGroupMinimumIndex + XHR_COUNT);
                }
            };
        }
    }

    var GetBookmarkCount = function (index) {
        if (index >= works.length) {
            clearAndUpdateWorks();
            return;
        }

        if (xhrs.length === 0) {
            FillXhrsArray();
        }

        for (var i = 0; i < XHR_COUNT; i++) {
            if (index + i >= works.length) {
                xhrs[i].complete = true;
                continue;
            }

            var illustId = works[index + i].illustId;
            var url = 'https://www.pixiv.net/artworks/' + illustId;
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
    var clearAndUpdateWorks = function () {
        filterAndSort();

        var container = Pages[PageType.Search].GetImageListContainer();
        var firstImageElement = Pages[PageType.Search].GetFirstImageElement();
        var imageElementTemplate = firstImageElement.cloneNode(true);
        // 清理模板
        {
            // image
            var img = $($(imageElementTemplate).find('img').get(0));
            var imageDiv = img.parent();
            var imageLink = imageDiv.parent();
            var imageLinkDiv = imageLink.parent();
            var titleLink = imageLinkDiv.parent().next();
            if (img == null || imageDiv == null || imageLink == null || imageLinkDiv == null || titleLink == null) {
                DoLog(LogLevel.Error, 'Can not found some elements!');
            }

            // author
            var authorDiv = titleLink.next();
            var authorLinks = authorDiv.find('a'); // 点击头像和昵称都可以
            var authorName = $(authorLinks.children('div'));
            authorName.each(function (i, e) {
                if ($(e).children().length === 0) {
                    authorName = $(e);
                    return false;
                }
            });
            var authorImage = $(authorDiv.find('img').get(0));

            // others
            var bookmarkDiv = imageLink.next();
            var bookmarkSvg = bookmarkDiv.find('svg');
            var additionTagDiv = imageDiv.prev();
            var animationTag = imageDiv.find('svg');

            var bookmarkCountDiv = additionTagDiv.clone();
            bookmarkCountDiv.css({ 'top': 'auto', 'bottom': '0px' });
            additionTagDiv.parent().append(bookmarkCountDiv);

            // 添加 class，方便后面修改内容
            img.addClass('ppImg');
            imageLink.addClass('ppImageLink');
            titleLink.addClass('ppTitleLink');
            authorLinks.addClass('ppAuthorLink');
            authorName.addClass('ppAuthorName');
            authorImage.addClass('ppAuthorImage');
            bookmarkSvg.addClass('ppBookmarkSvg');
            additionTagDiv.addClass('ppAdditionTag');
            bookmarkCountDiv.addClass('ppBookmarkCount');

            img.attr('src', '');
            additionTagDiv.empty();
            bookmarkCountDiv.empty();
            animationTag.remove();
            bookmarkSvg.find('path:first').css('fill', 'rgb(31, 31, 31)');
            bookmarkSvg.find('path:last').css('fill', 'rgb(255, 255, 255)');

            if (IS_LINK_BLANK) {
                imageLink.attr('target', '_blank');
                titleLink.attr('target', '_blank');
                authorLinks.attr('target', '_blank');
            }
        }
        $(container).empty();
        for (var i = 0; i < works.length; i++) {
            var li = $(imageElementTemplate.cloneNode(true));

            li.find('.ppImg').attr('src', works[i].url);
            li.find('.ppImageLink').attr('href', '/artworks/' + works[i].illustId);
            li.find('.ppTitleLink').attr('href', '/artworks/' + works[i].illustId).text(works[i].title);
            li.find('.ppAuthorLink').attr('href', '/member.php?id=' + works[i].userId);
            li.find('.ppAuthorName').text(works[i].userName);
            li.find('.ppAuthorImage').attr('src', works[i].profileImageUrl);
            li.find('.ppBookmarkSvg').attr('illustId', works[i].illustId);
            if (works[i].bookmarkData) {
                li.find('.ppBookmarkSvg').find('path').css('fill', 'rgb(255, 64, 96)');
                li.find('.ppBookmarkSvg').attr('bookmarkId', works[i].bookmarkData.id);
            }
            if (works[i].xRestrict !== 0) {
                var R18HTML = '<div style="margin-top: 2px; margin-left: 2px;"><div style="color: rgb(255, 255, 255);font-weight: bold;font-size: 10px;line-height: 1;padding: 3px 6px;border-radius: 3px;background: rgb(255, 64, 96);">R-18</div></div>';
                li.find('.ppAdditionTag').append(R18HTML);
            }
            if (works[i].pageCount > 1) {
                var pageCountHTML = '<div style="display: flex;-webkit-box-align: center;align-items: center;box-sizing: border-box;margin-left: auto;height: 20px;color: rgb(255, 255, 255);font-size: 10px;line-height: 12px;font-weight: bold;flex: 0 0 auto;padding: 4px 6px;background: rgba(0, 0, 0, 0.32);border-radius: 10px;">\<svg viewBox="0 0 9 10" width="9" height="10" style="stroke: none;line-height: 0;font-size: 0px;fill: currentcolor;"><path d="M8,3 C8.55228475,3 9,3.44771525 9,4 L9,9 C9,9.55228475 8.55228475,10 8,10 L3,10 C2.44771525,10 2,9.55228475 2,9 L6,9 C7.1045695,9 8,8.1045695 8,7 L8,3 Z M1,1 L6,1 C6.55228475,1 7,1.44771525 7,2 L7,7 C7,7.55228475 6.55228475,8 6,8 L1,8 C0.44771525,8 0,7.55228475 0,7 L0,2 C0,1.44771525 0.44771525,1 1,1 Z"></path></svg><span class="sc-fzXfOw bAzGJW">' + works[i].pageCount + '</span></div>';
                li.find('.ppAdditionTag').append(pageCountHTML);
            }
            var bookmarkCountHTML = '<div style="margin-bottom: 6px; margin-left: 2px;"><div style="color: rgb(7, 95, 166);font-weight: bold;font-size: 13px;line-height: 1;padding: 3px 6px;border-radius: 3px;background: rgb(204, 236, 255);">' + works[i].bookmarkCount + ' likes</div></div>';
            li.find('.ppBookmarkCount').append(bookmarkCountHTML);
            if (works[i].illustType == 2) {
                var animationHTML = '<svg viewBox="0 0 24 24" style="width: 48px; height: 48px;stroke: none;fill: rgb(255, 255, 255);line-height: 0;font-size: 0px;vertical-align: middle;position:absolute;"><circle cx="12" cy="12" r="10" style="fill: rgb(0, 0, 0);fill-opacity: 0.4;"></circle><path d="M9,8.74841664 L9,15.2515834 C9,15.8038681 9.44771525,16.2515834 10,16.2515834 C10.1782928,16.2515834 10.3533435,16.2039156 10.5070201,16.1135176 L16.0347118,12.8619342 C16.510745,12.5819147 16.6696454,11.969013 16.3896259,11.4929799 C16.3034179,11.3464262 16.1812655,11.2242738 16.0347118,11.1380658 L10.5070201,7.88648243 C10.030987,7.60646294 9.41808527,7.76536339 9.13806578,8.24139652 C9.04766776,8.39507316 9,8.57012386 9,8.74841664 Z"></path></svg>';
                li.find('.ppImg').after(animationHTML);
            }

            $(container).append(li);
        }

        // 监听加入书签点击事件，监听父节点，但是按照 <svg> 节点处理
        $('.ppBookmarkSvg').parent().on('click', function () {
            if (g_csrfToken == '') {
                DoLog(LogLevel.Error, 'No g_csrfToken, failed to add bookmark!');
                alert('获取 Token 失败，无法添加，请到详情页操作。');
                return;
            }

            var _this = $(this).children('svg:first');
            var illustId = _this.attr('illustId');
            var bookmarkId = _this.attr('bookmarkId');
            if (bookmarkId == null || bookmarkId == '') {
                DoLog(LogLevel.Info, 'Add bookmark, illustId: ' + illustId);
                $.ajax('/ajax/illusts/bookmarks/add', {
                    method: 'POST',
                    contentType: 'application/json;charset=utf-8',
                    headers: { 'x-csrf-token': g_csrfToken },
                    data: '{"illust_id":"' + illustId + '","restrict":0,"comment":"","tags":[]}',
                    success: function (data) {
                        DoLog(LogLevel.Info, 'addBookmark result: ');
                        DoLog(LogLevel.Elements, data);
                        if (data.error) {
                            DoLog(LogLevel.Error, 'Server returned an error: ' + data.message);
                            return;
                        }
                        var bookmarkId = data.body.last_bookmark_id;
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
                        DoLog(LogLevel.Info, 'addBookmark result: ');
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

        if (works.length === 0) {
            $('.column-search-result')[0].innerHTML = '<div class="_no-item">未找到任何相关结果</div>';
        }

        // 恢复显示
        SORT_END = true;
        $('#loading').remove();
        $(container).show();

        Pages[PageType.Search].ProcessPageElements();

        if (callback) {
            callback();
        }
    }
}
/**
 * ---------------------------------------- 以下为 Cookie 部分 ----------------------------------------
 */
// 设置 Cookie
function SetCookie(name, value) {
    var Days = 30;
    var exp = new Date();
    exp.setTime(exp.getTime() + Days * 24 * 60 * 60 * 1000);
    document.cookie = name + "=" + escape(value) + ";expires=" + exp.toGMTString();
}
// 读取 Cookie
function GetCookie(name) {
    var arr, reg = new RegExp("(^| )" + name + "=([^;]*)(;|$)");
    if (arr = document.cookie.match(reg)) {
        return unescape(arr[2]);
    }
    else {
        return null;
    }
}
// 读取设置
function GetSettings() {
    var settings = GetCookie('PixivPreviewerSetting');
    if (!settings || settings == 'null') {
        return null;
    }
    settings = eval('[' + settings + ']')[0];

    if (!settings.version) {
        settings.version = 0.0;
    }

    return settings;
}
/**
 * ---------------------------------------- 以下为 教程设置 部分 ----------------------------------------
 */
// 显示设置
function ShowSetting(settings) {
    var guide;

    if (!settings || settings == 'null') {
        settings = GetSettings();
    }
    var screenWidth = document.documentElement.clientWidth;
    var screenHeight = document.documentElement.clientHeight;
    if ($('#pp-guide').length === 0) {
        guide = document.createElement('div');
        guide.id = 'pp-guide';
        document.body.appendChild(guide);
        $(guide).css({
            'width': screenWidth + 'px', 'height': screenHeight + 'px', 'position': 'fixed',
            'z-index': 999999, 'background-color': 'rgba(0,0,0,0.8)',
            'left': '0px', 'top': '0px'
        });
    }
    guide = $('#pp-guide')[0];

    try {
        if ($('.home').children()[0].innerText == '首页') {
            lang = 0;
        }
    } catch (e) {
        var li_a = $('a[href="/"]');
        if ($(li_a[1]).text().indexOf('首页') != -1) {
            lang = 0;
        }
    }
    // 中文
    var settingHTML =
        '<p style="text-align:center;color:white;font-size:25px;">' +
        '<span style="position:absolute; right:1%; top:1%; cursor: pointer;" id="pp-close">X</span>' +
        '<span>是否开启预览功能&emsp;</span>' +
        '<label><input id="inputEnablePreview" type="radio" name="enablePreview" value="true">开启&nbsp</label>' +
        '<label><input id="inputEnablePreview2" type="radio" name="enablePreview" value="false">关闭</label><br>' +
        '<span>预览功能图片质量&emsp;</span>' +
        '<label><input id="inputPreviewQuality" type="radio" name="previewQuality" value="0">普通&nbsp</label>' +
        '<label><input id="inputPreviewQuality2" type="radio" name="previewQuality" value="1">原图</label><br>' +
        '<span>隐藏多图加载图片&emsp;</span>' +
        '<label><input id="inputHideLoading" type="radio" name="hideLoading" value="true">隐藏&nbsp</label>' +
        '<label><input id="inputHideLoading2" type="radio" name="hideLoading" value="false">显示</label><br>' +
        '<span>是否开启排序功能&emsp;</span>' +
        '<label><input id="inputEnableSort" type="radio" name="enableSort" value="true">开启&nbsp</label>' +
        '<label><input id="inputEnableSort2" type="radio" name="enableSort" value="false">关闭</label><br>' +
        '<br><span>以下设置需要开启排序功能才能生效</span><br>' +
        '<span>排序功能每次加载的页面数&emsp;</span>' +
        '<input type="text" style="height:28px;position:relative;top:-5px;left:5px;width:135px;text-align:center;" id="inputPageCount"><br>' +
        '<span>隐藏收藏量低于该值的作品&emsp;</span>' +
        '<input type="text" style="height:28px;position:relative;top:-5px;left:5px;width:135px;text-align:center;" id="inputFilter"><br>' +
        '<span>是否使用新标签页打开图片&emsp;</span>' +
        '<label><input id="inputHrefBlank" type="radio" name="hrefBlank" value="true" checked="">开启&nbsp</label>' +
        '<label><input id="inputHrefBlank2" type="radio" name="hrefBlank" value="false">关闭</label><br>' +
        '<span>在搜索页隐藏已收藏的作品&emsp;</span>' +
        '<label><input id="inputHideFavorite2" type="radio" name="hideFavorite" value="false">显示</label><br><br><br></p>';
    // 英文
    if (lang == 1) {
        settingHTML =
            '<p style="text-align:center;color:white;font-size:25px;">' +
            '<span style="position:absolute; right:1%; top:1%; cursor: pointer;" id="pp-close">X</span>' +
            '<span>Preview Works&emsp;</span>' +
            '<label><input id="inputEnablePreview" type="radio" name="enablePreview" value="true" checked="">On&nbsp</label>' +
            '<label><input id="inputEnablePreview2" type="radio" name="enablePreview" value="false">Off</label><br>' +
            '<span>Preview Quality&emsp;</span>' +
            '<label><input id="inputPreviewQuality" type="radio" name="previewQuality" value="0" checked="">Normal&nbsp</label>' +
            '<label><input id="inputPreviewQuality2" type="radio" name="previewQuality" value="1">Origin</label><br>' +
            '<span>Hide loading image when preview multi pictures&emsp;</span>' +
            '<label><input id="inputHideLoading" type="radio" name="hideLoading" value="true">Hide&nbsp</label>' +
            '<label><input id="inputHideLoading2" type="radio" name="hideLoading" value="false">Show</label><br>' +
            '<span>Sort by favorite&emsp;</span>' +
            '<label><input id="inputEnableSort" type="radio" name="enableSort" value="true" checked="">On&nbsp</label>' +
            '<label><input id="inputEnableSort2" type="radio" name="enableSort" value="false">Off</label><br>' +
            '<br><span>Following settings take effect when "Sort" is On</span><br>' +
            '<span>The number of pages loaded each time&emsp;</span>' +
            '<input type="text" style="height:28px;position:relative;top:-5px;left:5px;width:135px;text-align:center;" id="inputPageCount"><br>' +
            '<span>Hide work which favorite number lower than&emsp;</span>' +
            '<input type="text" style="height:28px;position:relative;top:-5px;left:5px;width:135px;text-align:center;" id="inputFilter"><br>' +
            '<span>Open work with a new browser tab&emsp;</span>' +
            '<label><input id="inputHrefBlank" type="radio" name="hrefBlank" value="true" checked="">On&nbsp</label>' +
            '<label><input id="inputHrefBlank2" type="radio" name="hrefBlank" value="false">Off</label><br>' +
            '<span>Hide favorited works in search page&emsp;</span>' +
            '<label><input id="inputHideFavorite" type="radio" name="hideFavorite" value="true">Hide&nbsp</label>' +
            '<label><input id="inputHideFavorite2" type="radio" name="hideFavorite" value="false">Show</label><br><br><br></p>';
    }

    guide.innerHTML = settingHTML;
    guide = $('#pp-guide')[0];
    $(guide).children().css('margin-top', parseInt(screenHeight) / 5 + 'px');
    if (settings.enablePreview == 'true') $(guide).find('#inputEnablePreview').attr('checked', true);
    else $(guide).find('#inputEnablePreview2').attr('checked', true);
    if (settings.previewQuality == '0') $(guide).find('#inputPreviewQuality').attr('checked', true);
    else $(guide).find('#inputPreviewQuality2').attr('checked', true);
    if (settings.hideLoading == 'true') $(guide).find('#inputHideLoading').attr('checked', true);
    else $(guide).find('#inputHideLoading2').attr('checked', true);
    if (settings.enableSort == 'true') $(guide).find('#inputEnableSort').attr('checked', true);
    else $(guide).find('#inputEnableSort2').attr('checked', true);
    $(guide).find('#inputPageCount').attr('value', settings.pageCount);
    $(guide).find('#inputFilter').attr('value', settings.favFilter);
    if (settings.linkBlank == 'true') $(guide).find('#inputHrefBlank').attr('checked', true);
    else $(guide).find('#inputHrefBlank2').attr('checked', true);
    if (settings.hideFavorite == 'true') $(guide).find('#inputHideFavorite').attr('checked', true);
    else $(guide).find('#inputHideFavorite2').attr('checked', true);
    // 保存按钮
    var button = document.createElement('button');
    $(button).addClass('_order-item _clickable');
    $(button).css({ 'color': 'white', 'margin-right': '10px' });
    $(guide).find('p')[0].appendChild(button);
    $(button).attr('bgc', '#127bb1'); $(button).css('background-color', $(button).attr('bgc'));
    $(button).mouseover(function () { $(this).css({ 'background-color': '#127bff' }); });
    $(button).mouseout(function () { $(this).css({ 'background-color': $(this).attr('bgc') }); });
    $(button).click(function () {
        settings = {
            'enablePreview': $("input[name='enablePreview']:checked").val(),
            'previewQuality': $("input[name='previewQuality']:checked").val(),
            'hideLoading': $("input[name='hideLoading']:checked").val(),
            'enableSort': $("input[name='enableSort']:checked").val(),
            'pageCount': $('#inputPageCount').val(),
            'favFilter': $('#inputFilter').val(),
            'linkBlank': $("input[name='hrefBlank']:checked").val(),
            'hideFavorite': $("input[name='hideFavorite']:checked").val(),
            'version': 1.87,
        };
        SetCookie('PixivPreviewerSetting', JSON.stringify(settings));
        $(guide).remove();
        location.href = location.href;
    });
    button.innerText = '保存设置';
    if (lang == 1) {
        button.innerText = 'Save';
    }
    // 重置按钮
    button = document.createElement('button');
    $(button).addClass('_order-item _clickable');
    $(button).css('color', 'white');
    $(guide).find('p')[0].appendChild(button);
    $(button).attr('bgc', 'red'); $(button).css('background-color', $(button).attr('bgc'));
    $(button).mouseover(function () { $(this).css({ 'background-color': 'red' }); });
    $(button).mouseout(function () { $(this).css({ 'background-color': $(this).attr('bgc') }); });
    $(button).click(function () {
        var comfirmText = "这会删除所有设置，相当于重新安装脚本，确定吗？";
        if (lang == 1) {
            comfirmText = 'Settings will be set to default, are you sure?'
        }
        if (confirm(comfirmText)) {
            SetCookie('PixivPreviewerSetting', null);
            location.href = location.href;
        }
        $(guide).remove();
    });
    button.innerText = '重置脚本';
    if (lang == 1) {
        button.innerText = 'Reset';
    }
    guide.lastChild.appendChild(document.createElement('br'));
    // 关闭按钮
    $('#pp-close').bind('mouseover', function () {
        $(this).css('color', 'rgb(18, 123, 255)');
    }).bind('mouseout', function () {
        $(this).css('color', '');
    }).bind('click', function () {
        $(guide).remove();
    });
    // 刷新声明
    var span = document.createElement('span');
    span.innerHTML = '<p><br/>*保存或重置后会自动刷新使设置生效<br/>*排序功能只在搜索页生效</p>';
    if (lang == 1) {
        span.innerHTML = '<p><br/>*Save or Reset will refresh this page.<br/>*Sort only available in search Page.</p>';
    }
    $(span).css('font-size', '10px');
    guide.lastChild.appendChild(span);
}

// 帮助
function ShowGuide(step) {
    $('#pp-guide').children().remove();
    $('#pp-guide').css('z-index', '999997');
    var step1 = function () {
        $(picDiv[0]).css({ 'position': 'absolute', 'z-index': '999998' });
        $('#pp-guide')[0].innerHTML =
            '<p style="text-align:center;color:white;font-size:25px;">' +
            '将鼠标移动到图片上，稍等片刻便会出现预览图<br/>' +
            '如果不想显示预览图，可以按住 <span style="color:#127bb1;">Ctrl</span> 键<br/>' +
            '这时鼠标移动到图片上便<span style="color:#127bb1;">不会出现</span>预览图<br/>' +
            '<a id="nextStep" href="javascript:;">点击继续</a>' +
            '</p>';
        $('#nextStep').click(function () {
            step2();
        });
    };
    var step2 = function () {
        $('#pp-guide')[0].innerHTML =
            '<p style="text-align:center;color:white;font-size:25px;">' +
            '按住 <span style="color:#127bb1;">Ctrl</span> 再点击预览图，可以切换成<span style="color:#127bb1;">原图模式</span><br/>' +
            '原图模式下右键保存就是最清晰的图片<br/>' +
            '原图模式会在预览图右下角显示一个笑脸<br/>' +
            '按住 Shift 点击预览图，或点击笑脸，可以用新标签页打开原图<br/>' +
            '<a id="nextStep" href="javascript:;">点击继续</a>' +
            '</p>';
        $('#nextStep').click(function () {
            step3();
        });
    };
    var step3 = function () {
        $('#pp-guide')[0].innerHTML =
            '<p style="text-align:center;color:white;font-size:25px;">' +
            '预览图会动鼠标不容易移上去？<br/>' +
            '按住 <span style="color:#127bb1;">Ctrl</span> 键预览图就<span style="color:#127bb1;">不会跟随</span>鼠标移动了<br/>' +
            '<a id="nextStep" href="javascript:;">点击继续</a>' +
            '</p>';
        $('#nextStep').click(function () {
            step4();
        });
    };
    var step4 = function () {
        $('#pp-guide')[0].innerHTML =
            '<p style="text-align:center;color:white;font-size:25px;">' +
            '右上角有显示张数的作品(多图)<br/>' +
            '直接<span style="color:#127bb1;">点击预览图</span>就能查看下一张图片<br/>' +
            '当然如果不是多图，直接点击预览图没有任何效果<br/>' +
            '<a id="nextStep" href="javascript:;">点击继续</a>' +
            '</p>';
        $('#nextStep').click(function () {
            //step5();
            step6();
        });
    };
    var step5 = function () {
        $(picDiv[0]).css({ 'position': 'absolute', 'z-index': '999998' });
        $(picDiv[1]).css({ 'position': 'absolute', 'z-index': '999998' });
        $(picDiv[2]).css({ 'position': 'absolute', 'z-index': '999998' });
        $(picDiv[3]).css({ 'position': 'absolute', 'z-index': '999998' });
        $('._toolmenu').css({ 'z-index': '999998' });
        $('#pp-guide')[0].innerHTML =
            '<p style="text-align:center;color:white;font-size:25px;">' +
            '点击右下角的<span style="color:#127bb1;">向下按钮</span>进入<span style="color:#127bb1;">批量下载模式</span><br/>' +
            '尝试<span style="color:#127bb1;">勾选</span>下方的部分图片，完成后<span style="color:#127bb1;">再次点击</span>该按钮<br/>' +
            '处理完成后将会弹出下载地址<br/>' +
            '<a id="nextStep" href="javascript:;">点击继续</a>' +
            '</p>';
        $('#nextStep').click(function () {
            step6();
        });
    };
    var step6 = function () {
        $(picDiv[0]).css({ 'position': '', 'z-index': '' });
        $(picDiv[1]).css({ 'position': '', 'z-index': '' });
        $(picDiv[2]).css({ 'position': '', 'z-index': '' });
        $(picDiv[3]).css({ 'position': '', 'z-index': '' });
        $('._toolmenu').css({ 'z-index': '' });
        $('#pp-guide')[0].innerHTML =
            '<p style="text-align:center;color:white;font-size:25px;">' +
            '预览功能到这里就介绍完毕了<br/>' +
            '排序功能并没有什么可以介绍的<br/>' +
            '接下来将进入到设置页面<br/>' +
            '如果以后需要修改设置，可以点击<span style="color:#127bb1;">右下角的齿轮按钮</span><br/>' +
            '<a id="nextStep" href="javascript:;">点击继续</a>' +
            '</p>';
        $('#nextStep').click(function () {
            $('#pp-guide').remove();
            var settings = {
                'enablePreview': ENABLE_PREVIEW.toString(),
                'previewQuality': PREVIEW_QUALITY.toString(),
                'hideLoading': HIDE_LOADING_IN_NEXTPIC.toString(),
                'enableSort': ENABLE_SORT.toString(),
                'pageCount': GETTING_PAGE_COUNT.toString(),
                'favFilter': FAV_FILTER.toString(),
                'linkBlank': IS_LINK_BLANK.toString(),
                'hideFavorite': HIDE_FAVORITE.toString()
            };
            ShowSetting(settings);
        });
    }
    var itv = setInterval(function () {
        if (SORT_END) {
            $('#pp-guide').children().remove();
            step1();
            clearInterval(itv);
        }
    }, 500);
}
/**
 * ---------------------------------------- 以下为 主函数 部分 ----------------------------------------
 */
var loadInterval = setInterval(function () {
    // 匹配当前页面
    for (var i = 0; i < PageType.PageTypeCount; i++) {
        if (Pages[i].CheckUrl(location.href)) {
            g_pageType = i;
            break;
        }
    }
    if (g_pageType >= 0) {
        DoLog(LogLevel.Info, 'Current page is ' + Pages[g_pageType].PageTypeString);
    } else {
        DoLog(LogLevel.Info, 'Unsupported page.');
        return;
    }

    // 设置按钮
    var toolBar = Pages[g_pageType].GetToolBar();
    if (toolBar) {
        DoLog(LogLevel.Elements, toolBar);
        clearInterval(loadInterval);
    } else {
        DoLog(LogLevel.Warning, 'Get toolbar failed.');
        return;
    }

    toolBar.appendChild(toolBar.firstChild.cloneNode(true));
    toolBar.lastChild.outerHTML = '<br/><button style="background-color: rgb(0, 0, 0);margin-top: 5px;opacity: 0.8;cursor: pointer;border: none;padding: 12px;border-radius: 24px;width: 48px;height: 48px;" class="_3cJzhTE"><svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 1000 1000" enable-background="new 0 0 1000 1000" xml:space="preserve" style="fill: white;"><metadata> Svg Vector Icons : http://www.sfont.cn </metadata><g><path d="M377.5,500c0,67.7,54.8,122.5,122.5,122.5S622.5,567.7,622.5,500S567.7,377.5,500,377.5S377.5,432.3,377.5,500z"></path><path d="M990,546v-94.8L856.2,411c-8.9-35.8-23-69.4-41.6-100.2L879,186L812,119L689,185.2c-30.8-18.5-64.4-32.6-100.2-41.5L545.9,10h-94.8L411,143.8c-35.8,8.9-69.5,23-100.2,41.5L186.1,121l-67,66.9L185.2,311c-18.6,30.8-32.6,64.4-41.5,100.3L10,454v94.8L143.8,589c8.9,35.8,23,69.4,41.6,100.2L121,814l67,67l123-66.2c30.8,18.6,64.5,32.6,100.3,41.5L454,990h94.8L589,856.2c35.8-8.9,69.4-23,100.2-41.6L814,879l67-67l-66.2-123.1c18.6-30.7,32.6-64.4,41.5-100.2L990,546z M500,745c-135.3,0-245-109.7-245-245c0-135.3,109.7-245,245-245s245,109.7,245,245C745,635.3,635.3,745,500,745z"></path></g></svg></button>';
    $(toolBar.lastChild).css('margin-top', '10px');
    $(toolBar.lastChild).css('opacity', '0.8');
    $(toolBar.lastChild).click(function () {
        ShowSetting();
    });

    // 读取设置
    var settings = GetSettings();
    if (!settings) {
        var screenWidth = document.documentElement.clientWidth;
        var screenHeight = document.documentElement.clientHeight;
        settings = {
            'enablePreview': ENABLE_PREVIEW.toString(),
            'previewQuality': PREVIEW_QUALITY.toString(),
            'hideLoading': HIDE_LOADING_IN_NEXTPIC.toString(),
            'enableSort': ENABLE_SORT.toString(),
            'pageCount': GETTING_PAGE_COUNT.toString(),
            'favFilter': FAV_FILTER.toString(),
            'linkBlank': IS_LINK_BLANK.toString(),
            'hideFavorite': HIDE_FAVORITE.toString()
        };
        // 首次使用
        var guide = document.createElement('div');
        guide.id = 'pp-guide';
        document.body.appendChild(guide);
        guide.innerHTML = '<p style="text-align:center;color:white;font-size:50px;">您是第一次使用<br/>是否愿意花费30秒<br/>阅读帮助及进行相关设置？<br/></p>';
        $(guide).children().css('margin-top', parseInt(screenHeight) / 10 + 'px');
        // 按钮
        var button = document.createElement('li');
        $(button).addClass('_order-item _clickable');
        $(button).css('color', 'white');
        $(guide).find('p')[0].appendChild(button);
        $(guide).find('p')[0].appendChild(button.cloneNode(false));
        $(guide).find('p')[0].appendChild(button.cloneNode(false));
        // 三个按钮
        var li = $(guide).find('li');
        li[0].innerText = '是，阅读帮助并配置'; $(li[0]).attr('bgc', '#127bb1');
        li[1].innerText = '是，但仅进行配置'; $(li[1]).attr('bgc', '#12cdcd');
        li[2].innerText = '否，使用默认设置'; $(li[2]).attr('bgc', '#ff7e48');
        li.css({ 'margin-right': '10px', 'margin-top': '80px', 'font-size': '18px', 'width': '180px' });
        li.each(function () {
            $(this).css('background-color', $(this).attr('bgc'));
        });
        li.mouseover(function () {
            $(this).css({ 'background-color': '#127bff' });
        });
        li.mouseout(function () {
            $(this).css({ 'background-color': $(this).attr('bgc') });
        });
        // 按钮的点击事件
        $(li[0]).click(function () { // 是
            // 不在搜索页的时候跳转到搜索页
            if (location.href.indexOf('search.php') == -1) {
                location.href = 'https://www.pixiv.net/search.php?word=miku&pp=guide';
            }
            ShowGuide();
        });
        $(li[1]).click(function () { // 是，仅设置
            ShowSetting(settings);
        });
        $(li[2]).click(function () { // 否
            SetCookie('PixivPreviewerSetting', JSON.stringify(settings));
            $(guide).remove();
        });

        $(guide).css({
            'width': screenWidth + 'px', 'height': screenHeight + 'px', 'position': 'fixed',
            'z-index': 999999, 'background-color': 'rgba(0,0,0,0.8)',
            'left': '0px', 'top': '0px'
        });

        if (location.href.indexOf('pp=guide') != -1) {
            ShowGuide();
        }
    }
    else {
        ENABLE_PREVIEW = settings.enablePreview == 'true' ? true : false;
        show_origin = settings.previewQuality == '0' ? false : true;
        HIDE_LOADING_IN_NEXTPIC = settings.hideLoading == 'true' ? true : false;
        ENABLE_SORT = settings.enableSort == 'true' ? true : false;
        GETTING_PAGE_COUNT = parseInt(settings.pageCount);
        FAV_FILTER = parseInt(settings.favFilter);
        IS_LINK_BLANK = settings.linkBlank == 'true' ? true : false;
        HIDE_FAVORITE = settings.hideFavorite == 'true' ? true : false;
    }

    // g_csrfToken
    if (g_pageType == PageType.Search) {
        $.get(location.href, function (data) {
            var matched = data.match(/token":"([a-z0-9]{32})/);
            if (matched.length > 0) {
                g_csrfToken = matched[1];
                DoLog(LogLevel.Info, 'Got g_csrfToken: ' + g_csrfToken);
            } else {
                DoLog(LogLevel.Error, 'Can not get g_csrfToken, so you can not add works to bookmark when sorting has enabled.');
            }
        });
    }

    // 现在 P站点击一些按钮不会重新加载页面了，脚本也不会重新加载，会导致一些问题。如果检测到 url 变了，就刷新一下
    setInterval(function () {
        if (location.href != initialUrl) {
            location.href = location.href;
        }
    }, 1000);

    /*var itv;
    // 怎么都得单独处理，好麻烦...
    // 发现页
    if (g_pageType == DiscoveryPage) {
        (function discoveryFunc() {
            if (ENABLE_PREVIEW) {
                var itv = setInterval(function () {
                    dataDiv = $(dataDivSelector[g_pageType]);
                    imgData = []; // 得自己生成imgData
                    if (dataDiv.find('figure').length > 0) {
                        clearInterval(itv);
                        picList = dataDiv;
                        var pics = picList.children();
                        picDiv = []; picHref = [];
                        for (var i = 0; i < pics.length; i++) {
                            if (pics[i].className != pics[0].className) {
                                pics[i].remove();
                                pics.splice(i--, 1);
                                continue;
                            }
                            picDiv.push(pics[i].childNodes[0].childNodes[0]);
                            $(picDiv[i]).attr('data-index', i);
                            picHref.push(picDiv[i].childNodes[0]);
                            $(picHref[i]).attr('data-index', i);
                            var id = $(picHref[i]).attr('href').split('artworks/')[1];
                            $(picHref[i]).attr('data-id', id);
                            var divs = $(picHref[i]).find('div');
                            var spans = $(picHref[i]).find('span');
                            var illustType = 0, pageCount = 1;
                            if (divs.length == 2 && spans.length != 0) {
                                illustType = 1;
                                pageCount = parseInt(spans[1].innerText);
                            }
                            else if (divs.length == 1) {
                                illustType = 0;
                            }
                            else {
                                illustType = 2;
                            }
                            imgData.push({ 'illustType': illustType, 'pageCount': pageCount });
                        }
                        PixivPreviewer();

                        // 标记
                        pics.addClass('processed');

                        // 持续检测是否有新的作品
                        var itvTick;
                        itvTick = setInterval(function () {
                            var dataDivTemp, imgDataTemp, picListTemp, picsTemp, picDivTemp, picHrefTemp;

                            dataDivTemp = $(dataDivSelector[g_pageType]);
                            imgDataTemp = [];
                            if (dataDivTemp.find('figure').length > 0) {
                                picListTemp = dataDivTemp;
                                picsTemp = $(picListTemp).children();

                                // 检查
                                if (picsTemp.last().hasClass('processed'))
                                    return;

                                //clearInterval(itvTick);
                                // 找到最后一个处理过的
                                var i = picsTemp.length - 1;
                                for (; i >= 0 && !$(picsTemp[i]).hasClass('processed') ; i--);
                                // i==-1说明全都没有处理过

                                picDivTemp = []; picHrefTemp = [];
                                // i+1是第一个没有处理过的
                                var newZero = i + 1;
                                // 复制已经处理过的内容
                                picDivTemp = picDiv;
                                picHrefTemp = picHref;
                                imgDataTemp = imgData;
                                for (i = i + 1; i < picsTemp.length; i++) {
                                    if (picsTemp[i].className != picsTemp[newZero].className) {
                                        picsTemp[i].remove();
                                        picsTemp.splice(i--, 1);
                                        continue;
                                    }
                                    picDivTemp.push(picsTemp[i].childNodes[0].childNodes[0]);
                                    $(picDivTemp[i]).attr('data-index', i);
                                    picHrefTemp.push(picDivTemp[i].childNodes[0]);
                                    $(picHrefTemp[i]).attr('data-index', i);
                                    var id = $(picHrefTemp[i]).attr('href').split('artworks/')[1];
                                    $(picHrefTemp[i]).attr('data-id', id);
                                    var divs = $(picHrefTemp[i]).find('div');
                                    var spans = $(picHrefTemp[i]).find('span');
                                    var illustType = 0, pageCount = 1;
                                    if (divs.length == 2 && spans.length != 0) {
                                        illustType = 1;
                                        pageCount = parseInt(spans[1].innerText);
                                    }
                                    else if (divs.length == 1) {
                                        illustType = 0;
                                    }
                                    else {
                                        illustType = 2;
                                    }
                                    imgDataTemp.push({ 'illustType': illustType, 'pageCount': pageCount });
                                }
                                // 更新信息
                                picsTemp.addClass('processed');
                                picDiv = picDivTemp;
                                picHref = picHrefTemp;
                                imgData = imgDataTemp;

                                PixivPreviewer();
                            }
                        }, 2000);
                    }
                }, 500);
            }
        })();
        return;
    }
        // 作品页、插画、收藏页、新作品页
    else if (g_pageType == MemberPage || g_pageType == BookMarkPage || g_pageType == NewIllustPage) {
        if (ENABLE_PREVIEW) {
            itv = setInterval(function () {
                var li_ul = $('#root').find('ul');
                $.each(li_ul, function (i, e) {
                    var li_a = $(e).find('a');
                    var href = li_a.attr('href');
                    if (href && href.indexOf('artworks/') != -1) {
                        dataDiv = $(e);
                        return;
                    }
                });
                //dataDiv = $('.xq6AsQu');
                imgData = [];

                if (dataDiv && dataDiv.children().length > 0) {
                    clearInterval(itv);
                    picList = dataDiv;
                    var pics = $(picList).children();
                    picDiv = []; picHref = [];
                    for (var i = 0; i < pics.length; i++) {
                        picDiv.push(pics[i]);
                        $(picDiv[i]).attr('data-index', i);
                        picHref.push($(pics[i]).find('a')[0]);
                        $(picHref[i]).attr('data-index', i);
                        var id = $(picHref[i]).attr('href').split('artworks/')[1];
                        $(picHref[i]).attr('data-id', id);
                        var illustType = 0, pageCount = 1;
                        if ($(picHref[i]).hasClass('ugoku-illust')) {
                            illustType = 2;
                        }
                        else if ($(picHref[i]).find('span').length > 0) {
                            illustType = 1;
                            pageCount = $(picHref[i]).find('span')[0].innerText;
                        }
                        imgData.push({ 'illustType': illustType, 'pageCount': pageCount });
                    }
                    PixivPreviewer();
                }
            }, 500);
        }
    }
        // 主页
    else if (g_pageType == HomePage || g_pageType == R18Cate) {
        if (ENABLE_PREVIEW) {
            itv = setInterval(function () {
                dataDiv = $('._image-items').parent();
                imgData = []; // 得自己生成imgData
                if (dataDiv.find('._layout-thumbnail').length > 0) {
                    clearInterval(itv);
                    picList = dataDiv.find('._image-items');
                    var pics = $(picList).children();
                    picDiv = []; picHref = [];
                    for (var i = 0; i < pics.length; i++) {
                        picDiv.push(pics[i]);
                        $(picDiv[i]).attr('data-index', i);
                        picHref.push($(pics[i]).find('._work')[0]);
                        $(picHref[i]).attr('data-index', i);
                        var id;
                        // BOOTH最新动态这种没有预览的意义
                        try {
                            id = $(picHref[i]).attr('href').split('artworks/')[1];
                        } catch (e) {
                            picDiv.pop();
                            picHref.pop();
                            continue;
                        }
                        $(picHref[i]).attr('data-id', id);
                        var illustType = 0, pageCount = 1;
                        if ($(picHref[i]).hasClass('ugoku-illust')) {
                            illustType = 2;
                        }
                        else if ($(picHref[i]).find('.page-count').length > 0) {
                            illustType = 1;
                            pageCount = $(picHref[i]).find('.page-count').find('span')[0].innerText;
                        }
                        imgData.push({ 'illustType': illustType, 'pageCount': pageCount });
                    }
                    PixivPreviewer();
                }
            }, 500);
        }
        return;
    }
        // 排行榜
    else if (g_pageType == RankingPage) {
        if (ENABLE_PREVIEW) {
            itv = setInterval(function () {
                dataDiv = $(dataDivSelector[g_pageType]);
                imgData = []; // 得自己生成imgData
                if (dataDiv.find('.ranking-item').length > 0) {
                    clearInterval(itv);
                    picList = dataDiv.children()[0];
                    var pics = $(picList).children();
                    picDiv = []; picHref = [];
                    for (var i = 0; i < pics.length; i++) {
                        picDiv.push($(pics[i]).find('.ranking-image-item'));
                        $(picDiv[i]).attr('data-index', i);
                        picHref.push($(pics[i]).find('._work')[0]);
                        $(picHref[i]).attr('data-index', i);
                        var id = $(picHref[i]).attr('href').split('artworks/')[1];
                        $(picHref[i]).attr('data-id', id);
                        var illustType = 0, pageCount = 1;
                        if ($(picHref[i]).hasClass('ugoku-illust')) {
                            illustType = 2;
                        }
                        else if ($(picHref[i]).find('.page-count').length > 0) {
                            illustType = 1;
                            pageCount = $(picHref[i]).find('.page-count').find('span')[0].innerText;
                        }
                        imgData.push({ 'illustType': illustType, 'pageCount': pageCount });
                    }
                    PixivPreviewer();

                    // 标记
                    pics.addClass('processed');

                    // CV 就 CV 吧，估计不会有重构的机会了，能用就先用着...
                    // 持续检测是否有新的作品
                    var itvTick;
                    itvTick = setInterval(function () {
                        var dataDivTemp, imgDataTemp, picListTemp, picsTemp, picDivTemp, picHrefTemp;

                        dataDivTemp = $(dataDivSelector[g_pageType]);
                        imgDataTemp = [];
                        if (dataDivTemp.find('.ranking-item').length > 0) {
                            picListTemp = dataDivTemp.children()[0];
                            picsTemp = $(picListTemp).children();

                            // 检查
                            if (picsTemp.last().hasClass('processed'))
                                return;

                            //clearInterval(itvTick);
                            // 找到最后一个处理过的
                            var i = picsTemp.length - 1;
                            for (; i >= 0 && !$(picsTemp[i]).hasClass('processed') ; i--);
                            // i==-1说明全都没有处理过

                            picDivTemp = []; picHrefTemp = [];
                            // i+1是第一个没有处理过的
                            var newZero = i + 1;
                            // 复制已经处理过的内容
                            picDivTemp = picDiv;
                            picHrefTemp = picHref;
                            imgDataTemp = imgData;
                            for (i = i + 1; i < picsTemp.length; i++) {
                                if (picsTemp[i].className != picsTemp[newZero].className) {
                                    picsTemp[i].remove();
                                    picsTemp.splice(i--, 1);
                                    continue;
                                }
                                picDivTemp.push($(picsTemp[i]).find('.ranking-image-item'));
                                $(picDivTemp[i]).attr('data-index', i);
                                picHrefTemp.push($(picsTemp[i]).find('._work')[0]);
                                $(picHrefTemp[i]).attr('data-index', i);
                                var id = $(picHrefTemp[i]).attr('href').split('artworks/')[1];
                                $(picHrefTemp[i]).attr('data-id', id);
                                var illustType = 0, pageCount = 1;
                                if ($(picHrefTemp[i]).hasClass('ugoku-illust')) {
                                    illustType = 2;
                                }
                                else if ($(picHrefTemp[i]).find('.page-count').length > 0) {
                                    illustType = 1;
                                    pageCount = $(picHrefTemp[i]).find('.page-count').find('span')[0].innerText;
                                }
                                imgDataTemp.push({ 'illustType': illustType, 'pageCount': pageCount });
                            }
                            // 更新信息
                            picsTemp.addClass('processed');
                            picDiv = picDivTemp;
                            picHref = picHrefTemp;
                            imgData = imgDataTemp;

                            PixivPreviewer();
                        }
                    }, 2000);
                }
            }, 500);
        }
        return;
    }
        // 动态
    else if (g_pageType == StaccPage) {
        if (ENABLE_PREVIEW) {
            itv = setInterval(function () {
                if ($('.stacc_ref_illust_img, .stacc_ref_user_illust_img').find('._layout-thumbnail').last().hasClass('processed')) {
                    return;
                }

                dataDiv = $('#stacc_timeline');
                imgData = []; // 得自己生成imgData

                picList = $('.stacc_ref_illust_img, .stacc_ref_user_illust_img');
                var pics = picList.find('._layout-thumbnail');
                picDiv = []; picHref = [];
                for (var i = 0; i < pics.length; i++) {
                    picDiv.push(pics[i]);
                    $(picDiv[i]).attr('data-index', i);
                    picHref.push($(pics[i]).parent().get(0));
                    $(picHref[i]).attr('data-index', i);
                    var id = $(picHref[i]).attr('href').split('illust_id')[1].split('=')[1].split('&')[0];
                    $(picHref[i]).attr('data-id', id);
                    var illustType = 0, pageCount = 1;
                    if ($(picHref[i]).hasClass('ugoku-illust')) {
                        illustType = 2;
                    }
                    else if ($(picHref[i]).hasClass('multiple')) {
                        illustType = 1;
                        pageCount = -1; // 不知道有几页
                    }
                    imgData.push({ 'illustType': illustType, 'pageCount': pageCount });
                }
                // 标记
                pics.addClass('processed');

                PixivPreviewer();

            }, 1000);
        }
        return;
    }*/

    // 排序、预览
    var itv = setInterval(function () {
        var returnMap = Pages[g_pageType].ProcessPageElements();
        if (!returnMap.loadingComplete) {
            return;
        }

        DoLog(LogLevel.Info, 'Process page comlete, sorting and prevewing begin.');
        DoLog(LogLevel.Elements, returnMap);

        clearInterval(itv);

        try {
            if (g_pageType == PageType.Search) {
                if (ENABLE_SORT) {
                    PixivSK(ENABLE_PREVIEW ? PixivPreview : null);
                } else if (ENABLE_PREVIEW) {
                    PixivPreview();
                }
            } else if (ENABLE_PREVIEW) {
                PixivPreview();
            }

        }
        catch (e) {
            DoLog(LogLevel.Error, 'Unknown error: ' + e);
        }
    }, 500);
}, 1000);