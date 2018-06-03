// ==UserScript==
// @name         Pixiv Previewer
// @namespace
// @version      1.66
// @description  显示大图预览，按热门度排序(pixiv_sk)。Show Preview, Sort by favorite numbers(pixiv_sk).
// @author       Ocrosoft
// @match        https://www.pixiv.net/search.php*
// @match        https://www.pixiv.net/member_illust.php?id=*
// @match        https://www.pixiv.net/member_illust.php?mode=*
// @match        https://www.pixiv.net/ranking.php*
// @match        https://www.pixiv.net/bookmark_new_illust.php*
// @match        https://www.pixiv.net/discovery*
// @match        https://www.pixiv.net
// @match        https://www.pixiv.net/new_illust.php*
// @grant        none
// @namespace    https://github.com/Ocrosoft/PixivPreviewer
// ==/UserScript==

//function $(){}

/**
 * ---------------------------------------- 以下为 设置 部分 ----------------------------------------
 * -------------------------------------------- Settings --------------------------------------------
 */
// 注意: 修改设置请使用设置页面，此处修改无效
// 是否开启预览功能
var ENABLE_PREVIEW = true;
// 预览的图片质量，0：普通；1：原图
var PREVIEW_QUALITY = 0;
// 是否开启排序功能
var ENABLE_SORT = true;
// 每次加载的页数
var GETTING_PAGE_COUNT = 3;
// 收藏量在此以下的不显示
var FAV_FILTER = 3;
// true，使用新标签页打开图片；false，保持默认
var IS_LINK_BLANK = true;
// 语言，根据页面自动确定，其他不支持的语言默认使用简体中文，可以修改成1使用English
// 0：简体中文
// 1：English
var lang = 0; // zh_CN
/**
 * ---------------------------------------- 以下为 预览功能 部分 ----------------------------------------
 */
/**
* 搜索页、发现页节点结构
* section, [dataDiv]
* -div, [picList]
* --div
* ---figure
* ----div, [picDiv]
* -----a, [picHref]
* -----div(菜单)
* ==================
* 关注页节点结构
* div, [dataDiv], [infoDiv]
* -div, [picList]
* --div,
* ---figure
* ----div, [picDiv]
* -----a, [picHref]
* -----div(菜单)
* ==================
* 作品页、主页节点结构
* div, [dataDiv]
* -ul, [picList]
* --li
* ---a, [picHref]
* ----div, [picDiv]
* -----img
* -----div(菜单)
* 排行榜页
* div, [dataDiv]
* -div, [picList]
* --section
* ---div(这是排名)
* ---div
* ----a, [picHref]
* -----div, [picDiv]
* ------img
* ------div(菜单)
*/
var SearchPage = 0, FollowPage = 1, DiscoveryPage = 2, MemberPage = 3, HomePage = 4, RankingPage = 5, NewIllustPage = 6; // 页面Id
var CurrentPage = SearchPage; // 该页面属于什么页面
var dataDivSelector = ['#js-react-search-mid', '#js-mount-point-latest-following', '#js-mount-point-discovery', '...', '...', '...', '...'];
var infoDivSelector = ['#js-mount-point-search-result-list', '#js-mount-point-latest-following', '...', '...', '...', '...', '...'];

var dataDiv, infoDiv, picList, picDiv = [], picHref = []; // 相关元素，含义见上
var dataStr; // 更新后图片信息使用 json 保存在了 dataDiv 的 data-items 属性中
var imgData; // 保存解析后的 json
var mousePos; // 鼠标位置
var SORT_END = false; // 是否排序完成
var show_origin = false; // 默认预览使用原图
var i;
// 获取相关的元素
function getImageElements() {
    if (infoDivSelector[CurrentPage] == '...') {
        return;
    }
    dataDiv = $(dataDivSelector[CurrentPage]);
    infoDiv = $(infoDivSelector[CurrentPage]);
    dataStr = infoDiv.attr('data-items');
    imgData = eval(dataStr);
    picList = dataDiv.children()[0];
    var pics = $(picList).children();
    picDiv = [];
    picHref = [];
    for (var i = 0; i < pics.length; i++) {
        if(pics[i].className != pics[0].className){
            pics[i].remove();
            pics.splice(i--,1);
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
    // 动图下载
    if (location.href.indexOf('medium') != -1 && $('._ugoku-illust-player-container').length > 0) {
        var script = document.createElement('script');
        script.src = 'https://greasyfork.org/scripts/30681/code/Pixiv.user.js';
        document.body.appendChild(script);
    }
    // 普通查看转换为全屏查看
    if (location.href.indexOf('medium') != -1 && location.href.indexOf('animePreview') != -1) {
        location.href = location.href.replace('medium', 'ugoira_view');
        return;
    }
    // 全图预览调节并返回 canvas 大小
    if (location.href.indexOf('ugoira_view') != -1 && location.href.indexOf('animePreview') != -1) {
        var itv = setInterval(function(){
            if ($('canvas').length > 0) {
                clearInterval(itv);
                var e, mouseX, mouseY, screenWidth, screenHeight, height, width, newHeight, newWidth, scale;
                scale = 1.0;
                mouseY = screenHeight = location.href.split('animePreview')[1];
                mouseX = mouseY.split(',')[0];
                mouseY = mouseY.split(',')[1];
                screenWidth = screenHeight.split(',')[2];
                screenHeight = screenHeight.split(',')[3];
                height = parseInt($('canvas').css('height').split('px'));
                width = parseInt($('canvas').css('width').split('px'));

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
                newHeight -= 50;
                newWidth -= 25;

                $('canvas').css({ 'height': newHeight + 'px', 'width': newWidth + 'px' });
                var div = document.createElement('div');
                $(div).addClass('embed');
                div.innerHTML = '<dl><form class="_comment-form" style="width:100%;text-align:center;"><input id="dl_full" type="button" value="全屏版" class="submit-button" style="width:45%; padding:0px;margin-left:5px;"></form></dl>';
                $('canvas').parent()[0].appendChild(div);
                window.parent.iframeLoaded(newHeight + 25, newWidth + 25);
                var reg = new RegExp('src.*zip');
                var tmp = $('html')[0].innerHTML;
                var full = reg.exec(tmp)[0];
                full = full.split(':"')[1];
                $('#dl_full').click(function () {
                    window.open(full);
                });
            }
        }, 500);
        return;
    }
})();
// iframe 加载完成时调用（动图预览）
// arg: canvas 元素高，canvas 元素宽
var callbackScript = document.createElement('script');
callbackScript.innerHTML = "function iframeLoaded(height,width){$('.pixivPreview').children('iframe').attr({'width':width,'height':height});$('.pixivPreview').children('iframe').css('display','');$('.pixivPreview').children('img').remove();}";
document.body.appendChild(callbackScript);
// 测试图片是否有效
function validateImage(url) {
    url = url.replace('manga', 'manga_big');
    url += '&page=0';
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open('GET', url, false);
    xmlHttp.send(null);
    var src = $($(xmlHttp.responseText)[$(xmlHttp.responseText).length - 1]).attr('src');
    if (src.indexOf('.png') == -1) return true;
    else return false;
}
function preLoad(urls) {
    for (i = 0; i < urls.length; i++) {
        var image = new Image();
        image.src = urls[i];
    }
}
function pixivPreviewer() {
    // 开启预览功能
    function activePreview() {
        // 鼠标移动到图片上显示预览图
        $(picHref).mouseover(function (e) {
            // 按住 Ctrl键 不显示预览图
            if (e.ctrlKey) {
                return;
            }
            // 图片索引
            var dataIndex = $(this).attr('data-index');
            // 从预览图移动到图片上，不应再次显示
            var tar = $(e.relatedTarget);
            var fFromPreviewElement = false;
            for (var i = 0; i < 3; i++) {
                if (tar.hasClass('pixivPreview') && tar.attr('data-index') == dataIndex) {
                    fFromPreviewElement = true;
                    break;
                }
                tar = tar.parent();
            }
            if (fFromPreviewElement) {
                return;
            }
            // 鼠标位置
            mousePos = { x: e.pageX, y: e.pageY };
            // 预览 Div
            var previewDiv = document.createElement('div');
            $(previewDiv).css({ 'position': 'absolute', 'z-index': '999999' });
            $(previewDiv).addClass('pixivPreview');
            $(previewDiv).attr('data-index', dataIndex);
            // 添加 Div 到 body
            $('.pixivPreview').remove();
            $('body')[0].appendChild(previewDiv);
            // 加载中图片节点
            var loadingImg = new Image();
            loadingImg.src = 'https://raw.githubusercontent.com/shikato/pixiv_sk/master/loading.gif';
            $(loadingImg).css('position', 'absolute');
            $(loadingImg).attr('data-index', dataIndex);
            previewDiv.appendChild(loadingImg);
            // 要显示的预览图节点
            var loadImg = new Image();
            $(loadImg).attr('data-index', dataIndex).css({'height':'0px', 'width':'0px'});
            previewDiv.appendChild(loadImg);
            // 表示显示的是原图的图标
            var originIcon = new Image();
            originIcon.src = 'https://source.pixiv.net/www/images/pixivcomic-favorite.png';
            $(originIcon).css({ 'position': 'absolute', 'bottom': '0px', 'right': '0px', 'display': 'none' });
            $(originIcon).attr('data-index', dataIndex);
            previewDiv.appendChild(originIcon);
            // 点击图标新网页打开原图
            $(originIcon).click(function () {
                window.open($(previewDiv).children('img')[1].src);
            });
            $(previewDiv).css({ 'left': mousePos.x + 'px', 'top': mousePos.y + 'px' });
            if ($(picDiv[dataIndex]).find('._work').length > 0){
                $($(picDiv[dataIndex]).find('._work')[0]).addClass('prev');
            }
            else $(picDiv[dataIndex]).addClass('prev');

            // 显示预览图
            // args: 图片地址数组，下标，原图地址数组
            function viewImages(imgs, index, imgsOrigin) {
                if (!imgs || imgs.length == 0) return;
                if (index < 0) return;
                if (!imgsOrigin || imgsOrigin.length == 0 || imgs.length != imgsOrigin.length) return;
                if (!index) index = 0;

                // 绑定点击事件，Ctrl+左键 单击切换原图
                if ($(previewDiv).children('script').length == 0) {
                    loadImg.addEventListener('click', function (ev) {
                        // 按住 Ctrl 来回切换原图
                        if (ev.ctrlKey) {
                            show_origin = !show_origin;
                            viewImages(imgs, index, imgsOrigin);
                        }
                        // 按住 Shift 点击图片新标签页打开原图
                        else if (ev.shiftKey) {
                            window.open(allImgsOrigin[parseInt($($('.pixivPreview').children('img')[1]).attr('img-index'))]);
                        }
                    });
                }
                // 多图时绑定点击事件，点击图片切换到下一张
                if (index == 0 && imgs.length != 1 && $(previewDiv).children('._work').length == 0) {
                    loadImg.addEventListener('click', function (e) {
                        if (e.ctrlKey || e.shiftKey) return;
                        var newIndex = parseInt($($('.pixivPreview').children('img')[1]).attr('img-index')) + 1;
                        if (newIndex == allImgs.length) newIndex = 0;
                        $('.pixivPreview').children('div').children('div').children('span')[0].innerHTML = (newIndex + 1) + '/' + allImgs.length;
                        viewImages(allImgs, newIndex, allImgsOrigin);
                        if (newIndex + 3 <= allImgs.length) {
                            preLoad((show_origin ? allImgsOrigin : allImgs).slice(newIndex + 3, newIndex + 4));
                        }
                    });
                }

                // 右上角张数标记
                if (imgs.length != 1 && index == 0 && $(previewDiv).children('._work').length == 0) {
                    var iconDiv = document.createElement('div');
                    iconDiv.innerHTML = '<div class="page-count"><div class="icon"></div><span>1/' + imgs.length + '</span></div>';
                    $(iconDiv).addClass('_work');
                    $(iconDiv).css({ 'position': 'absolute', 'top': '0px', 'display': 'none', 'right': '0px'});
                    $(iconDiv).attr('data-index', dataIndex);
                    $(iconDiv.childNodes).attr('data-index', dataIndex);
                    previewDiv.appendChild(iconDiv);
                }

                // 预加载
                //if (loadImg.src == '') {
                    loadImg.src = '';
                    $(loadImg).css({ 'display': 'none', 'height':'', 'width':'' });
                //}
                $(loadingImg).css('display', '');
                $(originIcon).css('display', 'none');
                $(iconDiv).css({ 'display': 'none' });
                // 图片预加载完成
                loadImg.addEventListener('load', function () {
                    if (loadImg.src == '') return;
                    // 调整图片大小
                    var screenWidth = document.documentElement.clientWidth;
                    var screenHeight = document.documentElement.clientHeight;
                    var viewHeight, viewWidth;
                    // 调整图片位置和大小
                    var ret = adjustDivPos(loadImg, previewDiv, screenWidth, screenHeight);
                    viewWidth = ret[0];
                    viewHeight = ret[1];

                    $(loadingImg).css({ 'left': viewWidth / 2 - 24 + 'px', 'top': viewHeight / 2 - 24 + 'px' });
                    $(loadImg).css('display', '');
                    $(loadingImg).css('display', 'none');
                    $(iconDiv).css({ 'display': '' });
                    if (loadImg.src.indexOf('origin') != -1) {
                        $(originIcon).css({ 'display': '' });
                    } else {
                        $(originIcon).css({ 'display': 'none' });
                    }
                    // 第一次显示预览时将图片列表添加到末尾
                    if ($(previewDiv).children('script').length == 0) {
                        var s = document.createElement('script');
                        // 输出预览图URL
                        var tmp = "var allImgs=['";
                        tmp += imgs[0];
                        for (var i = 1; i < imgs.length; ++i) {
                            tmp += "','" + imgs[i];
                        }
                        tmp += "'];";
                        // 输出原图URL
                        tmp += "var allImgsOrigin=['";
                        tmp += imgsOrigin[0];
                        for (i = 1; i < imgsOrigin.length; ++i) {
                            tmp += "','" + imgsOrigin[i];
                        }
                        tmp += "'];";
                        // 输出
                        s.innerHTML = tmp;
                        previewDiv.appendChild(s);
                    }
                });
                $(loadImg).attr('img-index', index);
                loadImg.src = show_origin ? imgsOrigin[index] : imgs[index];
            }
            // 进行 http 请求，获取预览图链接
            var xmlHttp = new XMLHttpRequest();
            xmlHttp.onreadystatechange = function () {
                if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
                    var resText = xmlHttp.responseText;
                    // 单图
                    try {
                        // 取得图片地址
                        // 预览图
                        var imgSource = RegExp('<div class="_layout-thumbnail ui-modal-trigger">[^>]*>').
                        exec(resText)[0].split('<')[2].split('\"')[1];
                        // 原图
                        var imgOrigin = RegExp('<div class="_illust_modal.*class="original-image').
                        exec(resText)[0].split('data-src="')[1].split('\"')[0];
                        viewImages([imgSource], 0, [imgOrigin]);
                        return;
                    } catch (e) {
                        // empty
                    }
                    // 多图
                    try {
                        var img, imgs = [];
                        var reg = new RegExp('https://i.pximg.net/img-master[^\"]*', 'g');
                        while ((img = reg.exec(resText.split('<section class=\"manga\">')[1].
                                               split('</section>')[0])) !== null) {
                            imgs.push(img[0]);
                        }
                        // 推出来的原图URL，暂时没有想到效率高的办法（imgs.length 次xmlHttpRequest）
                        var imgsOrigin = [];
                        var is_jpg = validateImage(xmlHttp.responseURL);
                        for (var i = 0; i < imgs.length; ++i) {
                            imgsOrigin.push(imgs[i].replace('img-master', 'img-original'));
                            imgsOrigin[i] = imgsOrigin[i].replace('_master1200', '');
                            if (!is_jpg) imgsOrigin[i] = imgsOrigin[i].replace('.jpg', '.png');
                        }
                        viewImages(imgs, 0, imgsOrigin);
                        // 显示第0张，预加载1,2,3张
                        var urls = show_origin ? imgsOrigin : imgs;
                        if (urls.length > 4) urls = urls.slice(1, 4);
                        else urls = urls.slice(1);
                        preLoad(urls);
                        return;
                    } catch (e) {
                        // empty
                    }
                }
            };
            // 动图，illustType 值为2
            if (imgData[dataIndex].illustType == 2) {
                $(previewDiv).children().remove();
                var screenWidth = document.documentElement.clientWidth;
                var screenHeight = document.documentElement.clientHeight;
                previewDiv.innerHTML = '<iframe width="600px" height="50%" src="https://www.pixiv.net/member_illust.php?mode=ugoira_view&illust_id=' +
                    $(picHref[dataIndex]).attr('data-id') + '#animePreview' + mousePos.x + ',' + mousePos.y + ',' + screenWidth + ',' + screenHeight + '"/>';
                $(previewDiv).children('iframe').css('display', 'none');
                $(previewDiv).children('iframe').attr('data-index', dataIndex);
                loadingImg = new Image();
                loadingImg.src = 'https://raw.githubusercontent.com/shikato/pixiv_sk/master/loading.gif';
                $(loadingImg).css('position', 'absolute');
                previewDiv.appendChild(loadingImg);
                return;
            }
            // 多图， pageCount 不为1
            else if (imgData[dataIndex].pageCount != 1) {
                xmlHttp.open('GET', 'https://www.pixiv.net/member_illust.php?mode=manga&illust_id=' +
                             $(picHref[dataIndex]).attr('data-id'), true);
            }
            // 单图
            else {
                xmlHttp.open('GET', 'https://www.pixiv.net/member_illust.php?mode=medium&illust_id=' +
                             $(picHref[dataIndex]).attr('data-id'), true);
            }
            xmlHttp.send(null);
        });
        // 鼠标移出图片
        $(picHref).mouseout(function (e) {
            var tar = $(e.relatedTarget);
            var fIsPreviewElement = false;
            // 鼠标移动到预览图上
            for (var i = 0; i < 3; i++) { // 最多上溯3次
                if (tar.hasClass('pixivPreview')/* || tar.hasClass('prev')*/) {
                    fIsPreviewElement = true;
                    break;
                }
                tar = tar.parent();
            }
            if (fIsPreviewElement) {
                $('.pixivPreview').mouseleave(function (ev) {
                    var tar = $(ev.relatedTarget);
                    if (ev.relatedTarget == null) return;
                    var fIsHasClassPrev = false;
                    for (var i = 0; i < 3; i++) { // 最多上溯3次
                        if (tar.hasClass('prev') || tar.hasClass('pixivPreview')) {
                            fIsHasClassPrev = true;
                            break;
                        }
                        tar = tar.parent();
                    }
                    if (!fIsHasClassPrev) {
                        $('.pixivPreview').remove();
                        $('.prev').removeClass('prev');
                    }
                });
            }
            // 非预览图上
            else {
                $('.pixivPreview').remove();
                $('.prev').removeClass('prev');
            }
        });
        // 鼠标移动，调整预览图位置
        $(picHref).mousemove(function (e) {
            if (e.ctrlKey) {
                return;
            }
            var screenWidth = document.documentElement.clientWidth;
            var screenHeight = document.documentElement.clientHeight;
            mousePos.x = e.pageX; mousePos.y = e.pageY;
            if ($('.pixivPreview').find('iframe').length > 0) {
                adjustDivPos($('.pixivPreview').children('iframe')[0], $('.pixivPreview')[0], screenWidth, screenHeight);
            }
            else {
                adjustDivPos($('.pixivPreview').children('img')[1], $('.pixivPreview')[0], screenWidth, screenHeight);
            }
        });
        // 添加执行标记
        //$(picDiv).addClass('prev');
    }
    // 调整预览 Div 的位置
    // arg: Div 中 <img> 标签，预览 Div，屏幕可视区宽，屏幕可视区高
    function adjustDivPos(loadImg, previewDiv, screenWidth, screenHeight) {
        var st = document.body.scrollTop + document.documentElement.scrollTop;
        var divX = mousePos.x + 5, divY = mousePos.y + 5;
        // 调整图片大小
        var height, width, newHeight, newWidth, scale = 1.0;
        height = loadImg.height;
        width = loadImg.width;
        // 长图
        if (height > width) {
            // 计算宽高
            newHeight = screenHeight;
            newWidth = newHeight / height * width;
            if (mousePos.x > screenWidth / 2) {
                while (newWidth * scale > mousePos.x - 5) {
                    scale -= 0.01;
                }
            } else {
                while (newWidth * scale > screenWidth - mousePos.x - 5) {
                    scale -= 0.01;
                }
            }
            newHeight *= scale;
            newWidth *= scale;
            // 设置新的宽高
            $(loadImg).css({'height':newHeight + 'px', 'width': newWidth + 'px'});
        } else {
            // 计算宽高
            if (mousePos.x > screenWidth / 2) {
                newWidth = mousePos.x - 5;
            } else {
                newWidth = screenWidth - mousePos.x - 5;
            }
            newHeight = newWidth / width * height;
            while (newHeight * scale > screenHeight) {
                scale -= 0.01;
            }
            newHeight *= scale;
            newWidth *= scale;
            // 设置新的宽高
            $(loadImg).css({'height': newHeight + 'px', 'width': newWidth + 'px'});
        }
        // 调整DIV的位置
        if (mousePos.x > screenWidth / 2) {
            divX = mousePos.x - 5 - newWidth;
            divY = st;
        } else {
            divX = mousePos.x + 5;
            divY = st;
        }
        $(previewDiv).css({ 'left': divX + 'px', 'top': divY + 'px', 'width': newWidth, 'height': newHeight});
        // 返回新的宽高
        return [newWidth, newHeight];
    }

    getImageElements();
    // 开启预览
    activePreview();
}
/**
 * ---------------------------------------- 以下为 排序功能 部分 ----------------------------------------
 */
function pixiv_sk(callback) {
    // 仅搜索页启用
    if (CurrentPage != SearchPage) {
        if (callback) {
            callback();
        }
        return;
    }

    // 加载中图片
    var LOADING_IMG = 'https://raw.githubusercontent.com/shikato/pixiv_sk/master/loading.gif';
    // 不合理的设定
    if (GETTING_PAGE_COUNT < 1 || FAV_FILTER < 0) return;
    // 当前已经取得的页面数量
    var mCurrentGettingPageCount = null;
    // 当前加载的页面 URL
    var mCurrentUrl = null;
    // 当前加载的是第几张页面
    var mCurrentPage = null;
    // 获取到的作品
    var mWorks = [];

    // 获取第 mCurrentPage 页的作品
    var getWorks = function (onloadCallback) {
        // 更新 URL
        var url = mCurrentUrl;
        if (mCurrentPage === 1 && mCurrentUrl.indexOf('p=1') == -1) {
            url += ('&p=' + mCurrentPage);
        } else {
            url = mCurrentUrl.replace(/p=\d+/, 'p=' + mCurrentPage);
        }
        mCurrentUrl = url;

        var req = new XMLHttpRequest();
        req.open('GET', mCurrentUrl, true);
        req.onload = function (event) {
            // 加载成功，调用回调函数
            onloadCallback(req);
            req = null;
        };
        // 加载失败
        req.onerror = function (event) {
            alert('获取作品失败!');
            req = null;
        };

        req.send(null);
    };

    // 排序和筛选
    var filterAndSort = function () {
        // 收藏量低于 FAV_FILTER 的作品不显示
        var tmp = [];
        mWorks.forEach(function (work, i) {
            var fav = work.bookmarkCount;
            if (fav >= FAV_FILTER) {
                tmp.push(work);
            }
        });
        mWorks = tmp;

        // 排序
        mWorks.sort(function (a, b) {
            var favA = a.bookmarkCount;
            var favB = b.bookmarkCount;
            if (favA === '') {
                favA = 0;
            } else {
                favA = parseInt(favA);
            }
            if (favB === '') {
                favB = 0;
            } else {
                favB = parseInt(favB);
            }
            if (favA > favB) {
                return -1;
            }
            if (favA < favB) {
                return 1;
            }
            return 0;
        });
    };

    mCurrentGettingPageCount = 0;
    mCurrentUrl = location.href;
    mCurrentPage = mCurrentUrl.match(/p=(\d+)/);

    if (mCurrentPage !== null) {
        mCurrentPage = parseInt(mCurrentPage[1]);
    }
    else {
        mCurrentPage = 1;
    }

    if (GETTING_PAGE_COUNT > 1) {
        // 显示加载中图片
        $(dataDivSelector[CurrentPage]).children('div').hide();
        $(dataDivSelector[CurrentPage]).prepend(
            '<div id="loading" style="width:50px;margin-left:auto;margin-right:auto;">'
            + '<img src="' + LOADING_IMG + '" /></div>'
        );

        // 翻页
        if(GETTING_PAGE_COUNT != 1) {
            if (mCurrentPage === 1) {
                if(mCurrentUrl.indexOf('p=1') == -1) {
                    $('.pager-container').empty().append(
                        '<a href="' + mCurrentUrl + '" style="margin-right:15px;">&lt;&lt;</a>'
                        + '<a href="' + mCurrentUrl + '&p=' + (mCurrentPage + GETTING_PAGE_COUNT) + '">&gt;</a>'
                    );
                } else {
                    $('.pager-container').empty().append(
                        '<a href="' + mCurrentUrl + '" style="margin-right:15px;">&lt;&lt;</a>'
                        + '<a href="' + mCurrentUrl.replace(/p=\d+/, 'p=' + (mCurrentPage + GETTING_PAGE_COUNT)) + '" style="margin-right:10px;">&gt;</a>'
                    );
                }
            }
            else {
                $('.pager-container').empty().append(
                    '<a href="' + mCurrentUrl.replace(/&p=\d+/, '') + '" style="margin-right:15px;">&lt;&lt;</a>'
                    + '<a href="' + mCurrentUrl.replace(/p=\d+/, 'p=' + (mCurrentPage - GETTING_PAGE_COUNT)) + '" style="margin-right:10px;">&lt;</a>'
                    + '<a href="' + mCurrentUrl.replace(/p=\d+/, 'p=' + (mCurrentPage + GETTING_PAGE_COUNT)) + '" style="margin-right:10px;">&gt;</a>'
                );
            }
        }

        var onloadCallback = function (req) {
            mWorks.push($(req.responseText).find(infoDivSelector[CurrentPage]).attr('data-items'));

            mCurrentPage++;
            mCurrentGettingPageCount++;
            // 设定数量的页面加载完成
            if (mCurrentGettingPageCount == GETTING_PAGE_COUNT) {
                $('#loading').remove();
                clearAndUpdateWorks();
            } else {
                getWorks(onloadCallback);
            }
        };

        getWorks(onloadCallback);
    }
    else {
        mWorks.push($(infoDivSelector[CurrentPage]).attr('data-items'));
        clearAndUpdateWorks(mWorks);
    }

    function clearAndUpdateWorks() {
        var tmp = [];
        for (var i = 0; i < mWorks.length; i++) {
            if(!mWorks[i])continue;
            var imgsOnePage = eval(mWorks[i]);
            for (var j = 0; j < imgsOnePage.length; j++) {
                tmp.push(imgsOnePage[j]);
            }
        }
        mWorks = tmp;
        filterAndSort();
        $(infoDivSelector[CurrentPage]).attr('data-items', JSON.stringify(mWorks));

        var divs = $($(dataDivSelector[CurrentPage]).children()[0]).children();
        var divHTML = divs[0].outerHTML;
        $('#js-react-search-mid').children('div').empty();
        for (i = 0; i < mWorks.length; i++) {
            // 新建一个 DIV
            var div = document.createElement('div');
            $(dataDivSelector[CurrentPage]).children('div').append(div);
            div.outerHTML = divHTML;
            // 修改 outerHTML 后要重新获取对象
            div = $(dataDivSelector[CurrentPage]).children()[0].lastChild;
            // 图片的 <a> 标签
            var a = $(div).children('figure').children('div').children('a')[0];
            $(a).attr('href', $(a).attr('href').split('id=')[0] + 'id=' + mWorks[i].illustId);
            if (IS_LINK_BLANK) {
                $(a).attr('target', '_blank');
            }
            // 移除多图/动图标签
            $(a).children('div').remove();
            // 如果是多图添加多图标签
            if (mWorks[i].pageCount != 1) {
                var pageDiv = document.createElement('div');
                $(pageDiv).css({ '-webkit-box-flex': '0', '-ms-flex': 'none', 'flex': 'none', 'display': '-webkit-box', 'display': '-ms-flexbox', 'display': 'flex', '-webkit-box-align': 'center', '-ms-flex-align': 'center', 'align-items': 'center', 'z-index': '1', '-webkit-box-sizing': 'border-box', 'box-sizing': 'border-box', 'margin': '0 0 -24px auto', 'padding': '6px', 'height': '24px', 'background': 'rgba(0,0,0,.4)', 'border-radius': '0 0 0 4px', 'color': '#fff', 'font-size': '12px', 'line-height': '1', 'font-weight': '700' });
                var pageSpan = document.createElement('span');
                pageSpan.innerText = mWorks[i].pageCount;
                pageDiv.appendChild(pageSpan);
                var pageSpan2 = document.createElement('span');
                $(pageSpan2).css({ 'display': 'inline-block', 'margin-right': '4px', 'width': '10px', 'height': '12px', 'background': 'url(//source.pixiv.net/www/images/icon/multiple-pages-icon.svg)' });
                pageSpan.insertBefore(pageSpan2, pageSpan.firstChild);
                a.insertBefore(pageDiv, a.firstChild);
            }
            // 如果是动图添加动图标签
            if (mWorks[i].illustType == 2) {
                var animeDiv = document.createElement('div');
                $(animeDiv).css({ 'position': 'absolute', '-webkit-box-flex': '0', '-ms-flex': 'none', 'flex': 'none', 'width': '40px', 'height': '40px', 'background': 'url(//source.pixiv.net/www/js/bundle/f608d897f389e8161e230b817068526d.svg) 50% no-repeat', 'top': '50%', 'left': '50%', 'margin': '-20px 0 0 -20px' });
                a.appendChild(animeDiv);
            }
            // 图片 <img> 标签
            $(a).css('background-image', 'url(' + mWorks[i].url + ')');
            $(a).css('background-size', 'cover');
            if (parseInt(mWorks[i].width) > parseInt(mWorks[i].height)) {
                $(a).css({ 'width': '198px', 'height': 198.0 / mWorks[i].width * mWorks[i].height + 'px' });
            } else {
                $(a).css({ 'height': '198px', 'width':198.0 / mWorks[i].height * mWorks[i].width + 'px' });
            }
            // 喜欢按钮 <div> 标签
            $($(a).parent().children('div').children('div')[0]).attr('data-id', mWorks[i].illustId);
            $($(a).parent().children('div').children('div')[0]).attr('data-click-label', mWorks[i].illustId);
            // 举报按钮 <a> 标签
            a = $(a).parent().children('div').find('a');
            a.attr('href', a.attr('href').split('=')[0] + '=' + mWorks[i].illustId);
            // 标题、作者栏 <ul> 标签
            var ul = $(div).find('figcaption').children()[0];
            // 标题 <a> 标签
            a = $($(ul).children('li')[0]).children('a');
            a.attr('href', a.attr('href').split('id=')[0] + 'id=' + mWorks[i].illustId);
            a.attr('title', mWorks[i].illustTitle);
            a[0].innerText = mWorks[i].illustTitle;
            // 作者 <a> 标签
            a = $($(ul).children('li')[1]).children('a');
            a.attr('href', a.attr('href').split('=')[0] + '=' + mWorks[i].userId);
            a.attr('title', mWorks[i].userName);
            a.attr('data-user_id', mWorks[i].userId);
            a.attr('data-user_name', mWorks[i].userName);
            a.find('div').css('background', 'url(' + mWorks[i].userImage + ') center top / cover no-repeat');
            a[0].lastChild.innerText = mWorks[i].userName;
            // 收藏量
            if ($(ul.lastChild).css('position') == 'relative') {
                $(ul.lastChild).remove();
            }
            if (mWorks[i].bookmarkCount != 0) {
                var li = document.createElement('li');
                ul.appendChild(li);
                li.outerHTML = '<li style="position: relative;"><ul class="count-list"><li><a href="/bookmark_detail.php?illust_id=' + mWorks[i].illustId + '" class="_ui-tooltip bookmark-count" data-tooltip="' + mWorks[i].bookmarkCount + '件のブックマーク"><i class="_icon sprites-bookmark-badge"></i>' + mWorks[i].bookmarkCount + '</a></li></ul></li>';
            }
        }
        if (mWorks.length === 0){
            $('.column-search-result')[0].innerHTML = '<div class="_no-item">未找到任何相关结果</div>';
        }
        // 恢复显示
        SORT_END = true;
        // 翻页部分
        if ($(dataDivSelector[CurrentPage]).parent().children('.column-order-menu')) {
            try{
                $(dataDivSelector[CurrentPage]).parent()[0].insertBefore(($(dataDivSelector[CurrentPage]).parent().children('.column-order-menu')[0].cloneNode(true)),$(dataDivSelector[CurrentPage])[0]);
            } catch(e) {}
        }
        $(dataDivSelector[CurrentPage]).children('div').show();

        if (callback) {
            callback();
        }
    }
}
/**
 * ---------------------------------------- 以下为 Cookie 部分 ----------------------------------------
 */
// 设置 Cookie
// arg: Cookie 名称，Cookie 值
function setCookie(name, value) {
    var Days = 30;
    var exp = new Date();
    exp.setTime(exp.getTime() + Days * 24 * 60 * 60 * 1000);
    document.cookie = name + "=" + escape(value) + ";expires=" + exp.toGMTString();
}
// 读取 Cookie
// arg: Cookie 名称
function getCookie(name) {
    var arr, reg = new RegExp("(^| )" + name + "=([^;]*)(;|$)");
    if (arr = document.cookie.match(reg)) {
        return unescape(arr[2]);
    }
    else {
        return null;
    }
}
// 读取设置
function getSettings() {
    var settings = getCookie('pixivPreviewerSetting');
    if (!settings || settings == 'null') {
        return null;
    }
    settings = eval('[' + settings + ']')[0];

    if (!settings.previewQuality) {
        alert('更新后如果发现预览模糊，请到设置中将“预览功能图片质量”选项修改为“原图”');
        settings.previewQuality = '0';
        setCookie('pixivPreviewerSetting', JSON.stringify(settings));
    }

    return settings;
}
/**
 * ---------------------------------------- 以下为 教程设置 部分 ----------------------------------------
 */
// 显示设置
function showSetting(settings) {
    var guide;

    if (!settings || settings == 'null') {
        settings = getSettings();
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

    if ($('.home').children()[0].innerText == 'Home') {
        lang = 1; // en_US
    }
    // 中文
    var settingHTML =
        '<p style="text-align:center;color:white;font-size:25px;">' +
        '<span style="position:absolute; right:1%; top:1%; cursor: pointer;" id="pp-close">X</span>' +
        '<span>是否开启预览功能 </span>' +
        '<label><input id="inputEnablePreview" type="radio" name="enablePreview" value="true" checked="">开启&nbsp</label>' +
        '<label><input id="inputEnablePreview2" type="radio" name="enablePreview" value="false">关闭</label><br>' +
        '<span>预览功能图片质量 </span>' +
        '<label><input id="inputPreviewQuality" type="radio" name="previewQuality" value="0" checked="">普通&nbsp</label>' +
        '<label><input id="inputPreviewQuality2" type="radio" name="previewQuality" value="1">原图</label><br>' +
        '<span>是否开启排序功能 </span>' +
        '<label><input id="inputEnableSort" type="radio" name="enableSort" value="true" checked="">开启&nbsp</label>' +
        '<label><input id="inputEnableSort2" type="radio" name="enableSort" value="false">关闭</label><br>' +
        '<br><span>以下设置需要开启排序功能才能生效</span><br>' +
        '<span>排序功能每次加载的页面数</span>' +
        '<input type="text" style="height:28px;position:relative;top:-5px;left:5px;width:135px;text-align:center;" id="inputPageCount"><br>' +
        '<span>隐藏收藏量低于该值的作品</span>' +
        '<input type="text" style="height:28px;position:relative;top:-5px;left:5px;width:135px;text-align:center;" id="inputFilter"><br>' +
        '<span>是否使用新标签页打开图片 </span>' +
        '<label><input id="inputHrefBlank" type="radio" name="hrefBlank" value="true" checked="">开启&nbsp</label>' +
        '<label><input id="inputHrefBlank2" type="radio" name="hrefBlank" value="false">关闭</label><br><br><br></p>';
    // 英文
    if (lang == 1) {
        settingHTML =
            '<p style="text-align:center;color:white;font-size:25px;">' +
            '<span style="position:absolute; right:1%; top:1%; cursor: pointer;" id="pp-close">X</span>' +
            '<span>Preview Works </span>' +
            '<label><input id="inputEnablePreview" type="radio" name="enablePreview" value="true" checked="">On&nbsp</label>' +
            '<label><input id="inputEnablePreview2" type="radio" name="enablePreview" value="false">Off</label><br>' +
            '<span>Preview Quality </span>' +
            '<label><input id="inputPreviewQuality" type="radio" name="previewQuality" value="0" checked="">Normal&nbsp</label>' +
            '<label><input id="inputPreviewQuality2" type="radio" name="previewQuality" value="1">Origin</label><br>' +
            '<span>Sort by favorite </span>' +
            '<label><input id="inputEnableSort" type="radio" name="enableSort" value="true" checked="">On&nbsp</label>' +
            '<label><input id="inputEnableSort2" type="radio" name="enableSort" value="false">Off</label><br>' +
            '<br><span>Following settings take effect when "Sort" is On</span><br>' +
            '<span>The number of pages loaded each time</span>' +
            '<input type="text" style="height:28px;position:relative;top:-5px;left:5px;width:135px;text-align:center;" id="inputPageCount"><br>' +
            '<span>Hide work which favorite number lower than</span>' +
            '<input type="text" style="height:28px;position:relative;top:-5px;left:5px;width:135px;text-align:center;" id="inputFilter"><br>' +
            '<span>Open work with a new browser tab </span>' +
            '<label><input id="inputHrefBlank" type="radio" name="hrefBlank" value="true" checked="">On&nbsp</label>' +
            '<label><input id="inputHrefBlank2" type="radio" name="hrefBlank" value="false">Off</label><br><br><br></p>';
    }

    guide.innerHTML = settingHTML;
    guide = $('#pp-guide')[0];
    $(guide).children().css('margin-top', parseInt(screenHeight) / 5 + 'px');
    if (settings.enablePreview == 'true') $(guide).find('#inputEnablePreview').attr('checked', true);
    else $(guide).find('#inputEnablePreview2').attr('checked', true);
    if (settings.previewQuality == '0') $(guide).find('#inputPreviewQuality').attr('checked', true);
    else $(guide).find('#inputPreviewQuality2').attr('checked', true);
    if (settings.enableSort == 'true') $(guide).find('#inputEnableSort').attr('checked', true);
    else $(guide).find('#inputEnableSort2').attr('checked', true);
    $(guide).find('#inputPageCount').attr('value', settings.pageCount);
    $(guide).find('#inputFilter').attr('value', settings.favFilter);
    if (settings.linkBlank == 'true') $(guide).find('#inputHrefBlank').attr('checked', true);
    else $(guide).find('#inputHrefBlank2').attr('checked', true);
    // 保存按钮
    var button = document.createElement('li');
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
            'enableSort': $("input[name='enableSort']:checked").val(),
            'pageCount': $('#inputPageCount').val(),
            'favFilter': $('#inputFilter').val(),
            'linkBlank': $("input[name='hrefBlank']:checked").val(),
        };
        setCookie('pixivPreviewerSetting', JSON.stringify(settings));
        $(guide).remove();
        location.href = location.href;
    });
    button.innerText = '保存设置';
    if (lang == 1) {
        button.innerText = 'Save';
    }
    // 重置按钮
    button = document.createElement('li');
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
            setCookie('pixivPreviewerSetting', null);
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
    $('#pp-close').bind('mouseover', function(){
        $(this).css('color', 'rgb(18, 123, 255)');
    }).bind('mouseout', function(){
        $(this).css('color', '');
    }).bind('click', function(){
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
// 添加设置按钮
function addSettingButton() {
    var toolbar = $('._toolmenu')[0];
    toolbar.appendChild(toolbar.firstChild.cloneNode(true));
    toolbar.lastChild.innerHTML = '<i class="_icon-12" style="border-radius: 100%;background:url(\'https://raw.githubusercontent.com/Ocrosoft/PixivPreviewer/master/settings.png\') top / cover no-repeat; "></i>';
    $(toolbar.lastChild)[0].className = 'item';
    $(toolbar.lastChild).css('margin-top', '10px');
    $(toolbar.lastChild).css('opacity', '0.8');
    $(toolbar.lastChild).click(function () {
        showSetting();
    });
}
// 帮助
function guideStep(step) {
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
    var step6=function (){
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
                'enableSort': ENABLE_SORT.toString(),
                'pageCount': GETTING_PAGE_COUNT.toString(),
                'favFilter': FAV_FILTER.toString(),
                'linkBlank': IS_LINK_BLANK.toString()
            };
            showSetting(settings);
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
$(document).ready(function (){
    // 作品详情页不操作，由animePreview()处理
    if(location.href.indexOf('member_illust.php?mode') != -1) {
        return;
    }

    $('.popular-introduction').remove();
    $('.ads_area_no_margin').remove();
    $('.multi-ads-area').remove();
    $('.ad-footer').remove();
    $('._premium-lead-tag-search-bar').remove();

    // 设置按钮
    addSettingButton();
    // 读取设置
    var settings = getSettings();
    if (!settings) {
        var screenWidth = document.documentElement.clientWidth;
        var screenHeight = document.documentElement.clientHeight;
        settings = {
            'enablePreview': ENABLE_PREVIEW.toString(),
            'previewQuality': PREVIEW_QUALITY.toString(),
            'enableSort': ENABLE_SORT.toString(),
            'pageCount': GETTING_PAGE_COUNT.toString(),
            'favFilter': FAV_FILTER.toString(),
            'linkBlank': IS_LINK_BLANK.toString()
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
            guideStep();
        });
        $(li[1]).click(function () { // 是，仅设置
            showSetting(settings);
        });
        $(li[2]).click(function () { // 否
            setCookie('pixivPreviewerSetting', JSON.stringify(settings));
            $(guide).remove();
        });

        $(guide).css({
            'width': screenWidth + 'px', 'height': screenHeight + 'px', 'position': 'fixed',
            'z-index': 999999, 'background-color': 'rgba(0,0,0,0.8)',
            'left': '0px', 'top': '0px'
        });

        if (location.href.indexOf('pp=guide') != -1) {
            guideStep();
        }
    }
    else {
        ENABLE_PREVIEW = settings.enablePreview == 'true' ? true : false;
        show_origin = settings.previewQuality == '0' ? false : true;
        ENABLE_SORT = settings.enableSort == 'true' ? true : false;
        GETTING_PAGE_COUNT = parseInt(settings.pageCount);
        FAV_FILTER = parseInt(settings.favFilter);
        IS_LINK_BLANK = settings.linkBlank == 'true' ? true : false;
    }

    // 设置页面
    if (location.href.indexOf('bookmark_new_illust') != -1) {
        CurrentPage = FollowPage;
    } else if (location.href.indexOf('discovery') != -1) {
        CurrentPage = DiscoveryPage;
    } else if (location.href.indexOf('member') != -1) {
        CurrentPage = MemberPage;
    } else if (location.href == 'https://www.pixiv.net/') {
        CurrentPage = HomePage;
    } else if (location.href.indexOf('ranking') != -1) {
        CurrentPage = RankingPage;
    } else if (location.href.indexOf('new_illust.php') != -1) {
        CurrentPage = NewIllustPage;
    }

    var itv;
    // 怎么都得单独处理，好麻烦...
    // 发现页单独处理
    if (CurrentPage == DiscoveryPage) {
        (function discoveryFunc() {
            if (ENABLE_PREVIEW) {
                var itv = setInterval(function(){
                    dataDiv = $(dataDivSelector[CurrentPage]);
                    imgData = []; // 得自己生成imgData
                    if(dataDiv.find('figure').length > 0){
                        clearInterval(itv);
                        picList = dataDiv.children()[0];
                        var pics = $($(picList).children()[1]).children();
                        pics = $($(pics.children()[1]).children()[0]).children();
                        picDiv = []; picHref = [];
                        for (var i = 0; i < pics.length; i++) {
                            if(pics[i].className != pics[0].className){
                                pics[i].remove();
                                pics.splice(i--,1);
                                continue;
                            }
                            picDiv.push(pics[i].childNodes[0].childNodes[0]);
                            $(picDiv[i]).attr('data-index', i);
                            picHref.push(picDiv[i].childNodes[0]);
                            $(picHref[i]).attr('data-index', i);
                            var id = $(picHref[i]).attr('href').split('illust_id')[1].split('=')[1].split('&')[0];
                            $(picHref[i]).attr('data-id', id);
                            var divs = $(picHref[i]).find('div');
                            var spans = $(picHref[i]).find('span');
                            var illustType = 0, pageCount = 1;
                            if (divs.length == 2 && spans.length != 0) {
                                illustType = 1;
                                pageCount = parseInt(spans[1].innerText);
                            }
                            else if (divs.length == 1){
                                illustType = 0;
                            }
                            else {
                                illustType = 2;
                            }
                            imgData.push({'illustType': illustType, 'pageCount': pageCount});
                        }
                        pixivPreviewer();
                    }
                }, 500);
            }
        })();
        return;
    }
    // 作品页单独处理
    else if (CurrentPage == MemberPage || CurrentPage == NewIllustPage) {
        if (ENABLE_PREVIEW) {
            itv = setInterval(function(){
                dataDiv = $('._image-items').parent();
                imgData = []; // 得自己生成imgData
                if(dataDiv.find('._layout-thumbnail').length > 0){
                    clearInterval(itv);
                    //picList = dataDiv.children()[0];
                    //picList = dataDiv.find('ul._image-items')[0];
                    picList = $('._image-items')[0];
                    var pics = $(picList).children();
                    picDiv = []; picHref = [];
                    for (var i = 0; i < pics.length; i++) {
                        picDiv.push(pics[i]);
                        $(picDiv[i]).attr('data-index', i);
                        picHref.push($(pics[i]).find('._work')[0]);
                        $(picHref[i]).attr('data-index', i);
                        var id = $(picHref[i]).attr('href').split('illust_id')[1].split('=')[1].split('&')[0];
                        $(picHref[i]).attr('data-id', id);
                        var illustType = 0, pageCount = 1;
                        if ($(picHref[i]).hasClass('ugoku-illust')){
                            illustType = 2;
                        }
                        else if ($(picHref[i]).find('.page-count').length > 0) {
                            illustType = 1;
                            pageCount = $(picHref[i]).find('.page-count').find('span')[0].innerText;
                        }
                        imgData.push({'illustType': illustType, 'pageCount': pageCount});
                    }
                    pixivPreviewer();
                }
            }, 500);
        }
        return;
    }
    // 主页单独处理
    else if (CurrentPage == HomePage) {
        if (ENABLE_PREVIEW) {
            itv = setInterval(function(){
                dataDiv = $('._image-items').parent();
                imgData = []; // 得自己生成imgData
                if(dataDiv.find('._layout-thumbnail').length > 0){
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
                            id = $(picHref[i]).attr('href').split('illust_id')[1].split('=')[1].split('&')[0]
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
                        imgData.push({'illustType': illustType, 'pageCount': pageCount});
                    }
                    pixivPreviewer();
                }
            }, 500);
        }
        return;
    }
    // 排行榜单独处理
    else if (CurrentPage == RankingPage) {
        if (ENABLE_PREVIEW) {
            itv = setInterval(function(){
                dataDiv = $('.ranking-items-container');
                imgData = []; // 得自己生成imgData
                if(dataDiv.find('.ranking-item').length > 0){
                    clearInterval(itv);
                    picList = dataDiv.children()[0];
                    var pics = $(picList).children();
                    picDiv = []; picHref = [];
                    for (var i = 0; i < pics.length; i++) {
                        picDiv.push($(pics[i]).find('.ranking-image-item'));
                        $(picDiv[i]).attr('data-index', i);
                        picHref.push($(pics[i]).find('._work')[0]);
                        $(picHref[i]).attr('data-index', i);
                        var id = $(picHref[i]).attr('href').split('illust_id')[1].split('=')[1].split('&')[0];
                        $(picHref[i]).attr('data-id', id);
                        var illustType = 0, pageCount = 1;
                        if ($(picHref[i]).hasClass('ugoku-illust')) {
                            illustType = 2;
                        }
                        else if ($(picHref[i]).find('.page-count').length > 0) {
                            illustType = 1;
                            pageCount = $(picHref[i]).find('.page-count').find('span')[0].innerText;
                        }
                        imgData.push({'illustType': illustType, 'pageCount': pageCount});
                    }
                    pixivPreviewer();
                }
            }, 500);
        }
        return;
    }

    // 预览，下载
    itv = setInterval(function () {
        try {
            getImageElements();
        }
        catch (e) {
            console.log(e);
            return;
        }
        try {
            // 排序
            if (picDiv.length > 0) {
                clearInterval(itv);
                if (ENABLE_SORT && ENABLE_PREVIEW) {
                    pixiv_sk(pixivPreviewer); // 排序完成后调用预览
                }
                else if (ENABLE_SORT) {
                    pixiv_sk(); // 仅排序
                }
                else if (ENABLE_PREVIEW) {
                    pixivPreviewer();
                }
            }
        }
        catch (e) {
            console.log(e);
            alert('出现错误!');
            clearInterval(itv);
        }
    }, 500);
});
