// ==UserScript==
// @name         Pixiv Previewer
// @namespace
// @version      1.44
// @description  显示大图预览，按热门度排序(pixiv_sk)，批量下载。View Preview, Sort by favorite numbers, Bulk download.(仅搜索排行页生效, Only available in search and rank page)
// @author       Ocrosoft
// @match        https://www.pixiv.net/search.php*
// @match        https://www.pixiv.net/member_illust.php?mode=*
// @match        https://www.pixiv.net/ranking.php*
// @match        https://www.pixiv.net/member.php?id=*
// @match        https://www.pixiv.net/member_illust.php?id=*
// @grant        none

// @namespace    https://github.com/Ocrosoft/PixivPreviewer
// ==/UserScript==

function log(text) {
    console.log(text);
}
/**
 * ---------------------------------------- 以下为 设置 部分 ----------------------------------------
 */
// 注意: 设置部分以 Cookie 为准，此处表示没有 Cookie 时的默认设置
// 是否开启预览功能
var ENABLE_PREVIEW = true;
// 是否开启排序功能
var ENABLE_SORT = true;
// 每次加载的页数
var GETTING_PAGE_COUNT = 3;
// 收藏量在此以下的不显示
var FAV_FILTER = 3;
// true，使用新标签页打开图片；false，保持默认
var IS_LINK_BLANK = true;
/**
 * ---------------------------------------- 以下为 预览功能 部分 ----------------------------------------
 */
/**
* 节点结构
* section, [dataDiv]
* -div, [picList]
* --div
* ---figure
* ----div, [picDiv]
* -----a, [picHref]
* -----div(菜单)
*/
var dataDiv, picList, picDiv = [], picHref = []; // 相关元素，含义见上
var dataStr; // 更新后图片信息使用 json 保存在了 dataDiv 的 data-items 属性中
var imgData; // 保存解析后的 json
var mousePos; // 鼠标位置
var SORT_END = false; // 是否排序完成
// 获取相关的元素
function getImageElements() {
    dataDiv = $('#js-react-search-mid');
    infoDiv = $('#js-mount-point-search-result-list')
    dataStr = infoDiv.attr('data-items');
    imgData = eval(dataStr);
    picList = dataDiv.children()[0];
    var pics = $(picList).children();
    picDiv = [], picHref = [];
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
        script.src = 'https://greasyfork.org/scripts/30681-pixiv%E5%8A%A8%E5%9B%BE%E4%B8%8B%E8%BD%BD/code/Pixiv%E5%8A%A8%E5%9B%BE%E4%B8%8B%E8%BD%BD.user.js';
        document.body.appendChild(script);
    }
    // 普通查看转换为全屏查看
    if (location.href.indexOf('medium') != -1 && location.href.indexOf('animePreview') != -1) {
        location.href = location.href.replace('medium', 'ugoira_view');
        return;
    }
    // 全图预览调节并返回 canvas 大小
    if (location.href.indexOf('ugoira_view') != -1 && location.href.indexOf('animePreview') != -1) {
        $(document).ready(function(){
            var height = parseInt($('canvas').css('height').split('px'));
            var width = parseInt($('canvas').css('width').split('px'));
            var newHeight = window.parent.document.documentElement.clientHeight / 2;
            var newWidth = newHeight / height * width;
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
        });
        return;
    }
})();
// iframe 加载完成时调用（动图预览）
// arg: canvas 元素高，canvas 元素宽
var callbackScript = document.createElement('script');
callbackScript.innerHTML = "function iframeLoaded(height,width){$('.pixivPreview').children('iframe').css({'width':width+20+'px','height':height+20+'px'});$('.pixivPreview').children('iframe').css('display','');$('.pixivPreview').children('img').remove()}";
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
function pixivPreviewer() {
    // 开启预览功能
    function activePreview() {
        // 鼠标移动到图片上显示预览图
        $(picHref).mouseover(function (e) {
            // 按住 Ctrl键 不显示预览图
            if (e.ctrlKey) {
                return;
            }
            // 从预览图移动到图片上，不应再次显示
            try {
                if ($(e.relatedTarget.parentNode).hasClass('pixivPreview')) {
                    return;
                }
            } catch (e) { }
            // 图片索引
            var dataIndex = $(this).attr('data-index');
            // 图片节点
            //var imgNode = picNode[dataIndex];
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
            $(loadImg).attr('data-index', dataIndex);
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
                            if (loadImg.src.indexOf('origin') == -1) {
                                viewImages(allImgsOrigin, parseInt($($('.pixivPreview').children('img')[1]).attr('img-index')), allImgs);
                            } else {
                                viewImages(allImgs, parseInt($($('.pixivPreview').children('img')[1]).attr('img-index')), allImgsOrigin);
                            }
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
                        if (loadImg.src.indexOf('origin') == -1) {
                            viewImages(allImgs, newIndex, allImgsOrigin);
                        } else {
                            viewImages(allImgsOrigin, newIndex, allImgs);
                        }
                    });
                }

                // 右上角张数标记
                if (imgs.length != 1 && index == 0 && $(previewDiv).children('._work').length == 0) {
                    var iconDiv = document.createElement('div');
                    iconDiv.innerHTML = '<div class="page-count"><div class="icon"></div><span>1/' + imgs.length + '</span></div>';
                    $(iconDiv).addClass('_work');
                    $(iconDiv).css({ 'position': 'absolute', 'top': '0px', 'display': 'none' });
                    $(iconDiv).attr('data-index', dataIndex);
                    $(iconDiv.childNodes).attr('data-index', dataIndex);
                    previewDiv.appendChild(iconDiv);
                }

                // 预加载
                loadImg.src = '';
                $(loadImg).css({ 'width': '', 'height': '', 'display': 'none' });
                $(loadingImg).css('display', '');
                $(originIcon).css('display', 'none');
                $(iconDiv).css({ 'display': 'none' });
                // 图片预加载完成
                loadImg.addEventListener('load', function () {
                    if (loadImg.src.indexOf('githubusercontent') != -1) return;
                    // 调整图片大小
                    var width = loadImg.width, screenWidth = document.documentElement.clientWidth;
                    var height = loadImg.height, screenHeight = document.documentElement.clientHeight;
                    var viewHeight, viewWidth;
                    // 长图
                    if (height > width) {
                        viewHeight = screenHeight / 2;
                        viewWidth = viewHeight / height * width;
                        var scale = 1.0;
                        while (viewWidth * scale > screenWidth / 2) {
                            scale -= 0.01;
                        }
                    }
                    // 宽图
                    else {
                        viewWidth = screenWidth / 2;
                        viewHeight = viewWidth / width * height;
                        var scale = 1.0;
                        while (viewHeight * scale > screenHeight / 2) {
                            scale -= 0.01;
                        }
                    }
                    $(loadImg).css({ 'height': viewHeight * scale + 'px', 'width': viewWidth * scale + 'px' });
                    $(previewDiv).css({ 'height': viewHeight * scale + 'px', 'width': viewWidth * scale + 'px' });
                    $(loadingImg).css({ 'left': viewWidth * scale / 2 - 24 + 'px', 'top': viewHeight * scale / 2 - 24 + 'px' });
                    $(loadImg).css('display', '');
                    $(loadingImg).css('display', 'none');
                    $(iconDiv).css({ 'display': '' });
                    if (loadImg.src.indexOf('origin') != -1) {
                        $(originIcon).css({ 'display': '' });
                    } else {
                        $(originIcon).css({ 'display': 'none' });
                    }
                    // 调整图片位置
                    adjustDivPos(loadImg, previewDiv, screenWidth, screenHeight);
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
                        for (var i = 1; i < imgsOrigin.length; ++i) {
                            tmp += "','" + imgsOrigin[i];
                        }
                        tmp += "'];";
                        // 输出
                        s.innerHTML = tmp;
                        previewDiv.appendChild(s);
                    }
                });
                $(loadImg).attr('img-index', index);
                loadImg.src = imgs[index];
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
                        return;
                    } catch (e) {
                        // empty
                    }
                }
            };
            // 动图，illustType 值为2
            if (imgData[dataIndex].illustType == 2) {
                $(previewDiv).children().remove();
                previewDiv.innerHTML = '<iframe width="600px" height="50%" src="https://www.pixiv.net/member_illust.php?mode=ugoira_view&illust_id=' +
                    $(picHref[dataIndex]).attr('data-id') + '#animePreview"/>';
                $(previewDiv).children('iframe').css('display', 'none');
                $(previewDiv).children('iframe').attr('data-index', dataIndex);
                var loadingImg = new Image();
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
            // 鼠标移动到预览图上
            if ($(e.relatedTarget).attr('data-index') == $(this).attr('data-index')) {
                $('.pixivPreview').mouseleave(function (ev) {
                    if ($(ev.relatedTarget).attr('data-index') == $(this).attr('data-index')) {
                        // empty
                    }
                    else {
                        $('.pixivPreview').remove();
                    }
                });
            }
            // 非预览图上
            else {
                $('.pixivPreview').remove();
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
            adjustDivPos($('.pixivPreview').children('img')[1], $('.pixivPreview')[0], screenWidth, screenHeight);
        });
        // 添加执行标记
        $(picDiv).addClass('prev');
    }
    // 调整预览 Div 的位置
    // arg: Div 中 <img> 标签，预览 Div，屏幕可视区宽，屏幕可视区高
    function adjustDivPos(loadImg, previewDiv, screenWidth, screenHeight) {
        // 调整图片位置
        var divX = mousePos.x + 5, divY = mousePos.y + 5;
        if (mousePos.x > screenWidth / 2) {
            try {
                divX -= $(loadImg).css('width').split('px')[0];
            }
            catch (e) {
                divX -= 24;
            }
            divX -= 10;
        }
        if ((mousePos.y - document.body.scrollTop) >
            screenHeight / 2) {
            try {
                divY -= $(loadImg).css('height').split('px')[0];
            }
            catch (e) {
                divY -= 24;
            }
            divY -= 10;
        }
        $(previewDiv).css({ 'left': divX + 'px', 'top': divY + 'px' });
    }
    // 添加多选框，加在 downloadButton() 中容易与其他脚本冲突
    function downloadMultiSelector() {
        // 表示是否选中的图标
        $(picHref).each(function () {
            var checkIcon = new Image();
            checkIcon.src = 'https://raw.githubusercontent.com/Ocrosoft/PixivPreviewer/master/unchecked.png';
            $(checkIcon).css({ 'position': 'absolute', 'top': '0px', 'left': '0px', 'display': 'none' });
            this.appendChild(checkIcon);
        });
    }
    // 添加下载按钮
    function downloadButton() {
        // 其他页面不启用
        if (location.href.indexOf('member_illust') != -1) return;
        // 下载模式按钮
        var downloadButton = document.createElement('li');
        downloadButton.innerHTML = '<i class="_icon-12 _icon-up" style="transform: rotateX(180deg);border-radius: 100%;"></i>';
        downloadButton.className = 'item';
        $(downloadButton).css({ 'margin-bottom': '10px', 'opacity': '0.2' });
        $('#back-to-top').parent()[0].insertBefore(downloadButton, $($('#back-to-top').parent()[0]).children()[0]);
        // 点击开闭下载模式
        $(downloadButton).click(function () {
            if ($(downloadButton).css('opacity') == '0.2') {
                $(downloadButton).css('opacity', '0.5');
                $($(downloadButton).children()[0]).css({ 'background': 'green' });
                // 开启下载模式
                // 显示多选框
                $(picHref).each(function () {
                    $(this.lastChild).css('display', '');
                });
                for (var i = 0; i < picDiv.length; ++i) {
                    // 覆盖在<a>上面的图
                    var layer = new Image();
                    layer.src = 'https://source.pixiv.net/www/images/common/transparent.gif';
                    $(layer).attr('data-index', i);
                    picDiv[i].appendChild(layer);
                    $(layer).css({ 'height': $(layer).parent().css('height'), 'width': $(layer).parent().css('width'), 'position': 'absolute', 'z-index': '999999' });
                    $(layer).click(function () {
                        if (picHref[$(this).attr('data-index')].lastChild.src.indexOf('unchecked') != -1) {
                            picHref[$(this).attr('data-index')].lastChild.src = 'https://raw.githubusercontent.com/Ocrosoft/PixivPreviewer/master/checked.png';
                        } else {
                            picHref[$(this).attr('data-index')].lastChild.src = 'https://raw.githubusercontent.com/Ocrosoft/PixivPreviewer/master/unchecked.png';
                        }
                    });
                }
            } else {
                $(downloadButton).css('opacity', '0.2');
                $($(downloadButton).children()[0]).css({ 'background': '' });
                // 添加覆盖提示层
                var screenWidth = document.documentElement.clientWidth;
                var screenHeight = document.documentElement.clientHeight;
                $('#fb-root')[0].innerHTML = '<p style="text-align:center;color:white;font-size:50px;">处理中<br/><span id="per">1/1</span></p>';
                $($('#fb-root').children()).css('margin-top', parseInt(screenHeight) / 2 - 40 + 'px');
                $('#fb-root').css({
                    'width': screenWidth + 'px', 'height': screenHeight + 'px', 'position': 'fixed',
                    'z-index': 999999, 'background-color': 'rgba(0,0,0,0.8)',
                    'left': '0px', 'top': '0px'
                });
                // 关闭下载模式
                var imgOriginList = []; var linkList = []; var imgCount = 0;
                for (var i = 0; i < picHref.length; ++i) {
                    if (picHref[i].lastChild.src.indexOf('unchecked') != -1) continue;
                    if (imgData[i].illustType == 2) {
                        linkList.push('https://www.pixiv.net/member_illust.php?mode=medium&illust_id=' +
                                      $(picHref[i]).attr('data-id'));
                    }
                    else if (imgData[i].pageCount != 1) {
                        linkList.push('https://www.pixiv.net/member_illust.php?mode=manga&illust_id=' +
                                      $(picHref[i]).attr('data-id'));
                    }
                    else {
                        linkList.push('https://www.pixiv.net/member_illust.php?mode=medium&illust_id=' +
                                      $(picHref[i]).attr('data-id'));
                    }
                }
                $('#per')[0].innerText = '1/' + linkList.length;
                var xmlHttp = new XMLHttpRequest();
                xmlHttp.onreadystatechange = function () {
                    if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
                        var resText = xmlHttp.responseText;
                        // 先尝试匹配动图，再尝试匹配单图，最后匹配多图
                        // while (true) 用来跳出匹配，避免后面的 if 不执行
                        while (true) {
                            // 动图
                            try {
                                var src = RegExp(' <script>pixiv.context.illustId.*</script>').exec(resText)[0];
                                var reg = new RegExp('http[^"]*', 'g');
                                var normal = reg.exec(src)[0], full = reg.exec(src)[0];
                                while (full.indexOf('\\') != -1) full = full.replace('\\', '');
                                if (full) {
                                    imgOriginList.push(full);
                                    break;
                                }
                            } catch (e) {
                                // empty
                            }
                            // 单图
                            try {
                                // 取得图片地址
                                // 预览图
                                var imgSource = RegExp('<div class="_layout-thumbnail ui-modal-trigger">[^>]*>').
                                exec(resText)[0].split('<')[2].split('\"')[1];
                                // 原图
                                var imgOrigin = RegExp('<div class="_illust_modal.*class="original-image').
                                exec(resText)[0].split('data-src="')[1].split('\"')[0];
                                imgOriginList.push(imgOrigin);
                                break;
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
                                    imgOriginList.push(imgsOrigin[i]);
                                }
                                break;
                            } catch (e) {
                                // empty
                            }
                        }
                        if (++imgCount == linkList.length) {
                            // 隐藏多选框
                            $(picHref).each(function () {
                                this.lastChild.src = 'https://raw.githubusercontent.com/Ocrosoft/PixivPreviewer/master/unchecked.png';
                                $(this.lastChild).css('display', 'none');
                            });
                            $(picDiv).each(function () {
                                this.lastChild.remove();
                            });
                            var s = '';
                            $(imgOriginList).each(function () {
                                s += this + '\n';
                            });
                            prompt('复制到下载工具下载', s);
                            $('#fb-root')[0].outerHTML = '<div id="fb-root"></div>';
                        } else {
                            $('#per')[0].innerText = (imgCount + 1) + '/' + linkList.length;
                            xmlHttp.open('GET', linkList[imgCount], true);
                            xmlHttp.send(null);
                        }
                    }
                };
                if (linkList.length != 0) {
                    xmlHttp.open('GET', linkList[0], true);
                    xmlHttp.send(null);
                } else {
                    // 隐藏多选框
                    $(picHref).each(function () {
                        $(this.lastChild).css('display', 'none');
                    });
                    $(picDiv).each(function () {
                        this.lastChild.remove();
                    });
                    $('#fb-root')[0].outerHTML = '<div id="fb-root"></div>';
                }
            }
        });
    }

    getImageElements();
    // 开启预览
    activePreview();
    // 添加多选框
    downloadMultiSelector();
    // 添加下载按钮
    downloadButton();
}
/**
 * ---------------------------------------- 以下为 排序功能 部分 ----------------------------------------
 */
function pixiv_sk(callback) {
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
        $('#js-react-search-mid').children('div').hide();
        $('#js-react-search-mid').prepend(
            '<div id="loading" style="width:50px;margin-left:auto;margin-right:auto;">'
            + '<img src="' + LOADING_IMG + '" /></div>'
        );

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
            mWorks.push($(req.responseText).find('#js-mount-point-search-result-list').attr('data-items'));

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
        mWorks.push($('#js-mount-point-search-result-list').attr('data-items'));
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
        $('#js-mount-point-search-result-list').attr('data-items', JSON.stringify(mWorks));

        var divs = $($('#js-react-search-mid').children()[0]).children();
        var divHTML = divs[0].outerHTML;
        $('#js-react-search-mid').children('div').empty();
        for (var i = 0; i < mWorks.length; i++) {
            // 新建一个 DIV
            var div = document.createElement('div');
            $('#js-react-search-mid').children('div').append(div);
            div.outerHTML = divHTML;
            // 修改 outerHTML 后要重新获取对象
            div = $('#js-react-search-mid').children()[0].lastChild;
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
                $(a).css({ 'height': '198px', 'width':198.0 / mWorks[i].height * mWorks[i].width +  'px' });
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
        if ($('#js-react-search-mid').parent().children('.column-order-menu')) {
            try{
                $('#js-react-search-mid').parent()[0].insertBefore(($('#js-react-search-mid').parent().children('.column-order-menu')[0].cloneNode(true)),$('#js-react-search-mid')[0]);
            } catch(e) {}
        }
        $('#js-react-search-mid').children('div').show();
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
    if (arr = document.cookie.match(reg))
        return unescape(arr[2]);
    else
        return null;
}
/**
 * ---------------------------------------- 以下为 教程设置 部分 ----------------------------------------
 */
// 显示设置
function showSetting(settings) {
    if (!settings || settings == 'null') {
        settings = getCookie('pixivPreviewerSetting');
        settings = eval('[' + settings + ']')[0];
    }
    var screenWidth = document.documentElement.clientWidth;
    var screenHeight = document.documentElement.clientHeight;
    if ($('#pp-guide').length === 0) {
        var guide = document.createElement('div');
        guide.id = 'pp-guide';
        document.body.appendChild(guide);
        $(guide).css({
            'width': screenWidth + 'px', 'height': screenHeight + 'px', 'position': 'fixed',
            'z-index': 999999, 'background-color': 'rgba(0,0,0,0.8)',
            'left': '0px', 'top': '0px'
        });
    }
    var guide = $('#pp-guide')[0];
    var settingHTML =
        '<p style="text-align:center;color:white;font-size:25px;">' +
        '<span>是否开启预览功能 </span>' +
        '<label><input id="inputEnablePreview" type="radio" name="enablePreview" value="true" checked="">开启&nbsp</label>' +
        '<label><input id="inputEnablePreview2" type="radio" name="enablePreview" value="false">关闭</label><br>' +
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
    guide.innerHTML = settingHTML;
    guide = $('#pp-guide')[0];
    $(guide).children().css('margin-top', parseInt(screenHeight) / 5 + 'px');
    if (settings.enablePreview == 'true') $(guide).find('#inputEnablePreview').attr('checked', true);
    else $(guide).find('#inputEnablePreview2').attr('checked', true);
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
            'enableSort': $("input[name='enableSort']:checked").val(),
            'pageCount': $('#inputPageCount').val(),
            'favFilter': $('#inputFilter').val(),
            'linkBlank': $("input[name='hrefBlank']:checked").val(),
        };
        setCookie('pixivPreviewerSetting', JSON.stringify(settings));
        $(guide).remove();
    });
    button.innerText = '保存设置';
    // 重置按钮
    button = document.createElement('li');
    $(button).addClass('_order-item _clickable');
    $(button).css('color', 'white');
    $(guide).find('p')[0].appendChild(button);
    $(button).attr('bgc', 'red'); $(button).css('background-color', $(button).attr('bgc'));
    $(button).mouseover(function () { $(this).css({ 'background-color': 'red' }); });
    $(button).mouseout(function () { $(this).css({ 'background-color': $(this).attr('bgc') }); });
    $(button).click(function () {
        if (confirm("这会删除所有设置，相当于重新安装脚本，确定吗？")) {
            setCookie('pixivPreviewerSetting', null);
        }
        $(guide).remove();
    });
    button.innerText = '重置脚本';
    guide.lastChild.appendChild(document.createElement('br'));
    // 刷新声明
    var span = document.createElement('span');
    span.innerHTML = '<p>*新的设置将在页面刷新后生效<br/>**排序功能只在搜索页生效</p>';
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
            step5();
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

    // 只在搜索页检测旧版P站
    if (location.href.indexOf('search.php') != -1 && $('#js-mount-point-search-result-list').length === 0) {
        if (!getCookie('pixivPreviewerSetting') || getCookie('pixivPreviewerSetting') == 'null') {
            var settings = {
                'enablePreview': ENABLE_PREVIEW.toString(),
                'enableSort': ENABLE_SORT.toString(),
                'pageCount': GETTING_PAGE_COUNT.toString(),
                'favFilter': FAV_FILTER.toString(),
                'linkBlank': IS_LINK_BLANK.toString()
            };
            setCookie('pixivPreviewerSetting', JSON.stringify(settings));

            // 显示旧版P站提示
            if ($('#pp-guide').length === 0) {
                var guide = document.createElement('div');
                guide.id = 'pp-guide';
                document.body.appendChild(guide);
                $(guide).css({
                    'width': '100%', 'height': '100%', 'position': 'fixed',
                    'z-index': 999999, 'background-color': 'rgba(0,0,0,0.8)',
                    'left': '0px', 'top': '0px'
                });
            }
            var guide = $('#pp-guide')[0];
            guide.innerHTML = '<p style="text-align:center;color:white;font-size:25px;padding-top:50px;">检测到正在使用旧版P站(每行5件作品)<br/>建议升级到新版(每行4件作品)<br/><br/>不升级不会影响使用<br/>但部分脚本功能将无法使用<br/><br/>升级方法<br/>安装最新版的谷歌浏览器并清除缓存及Cookie即可<br/><br/>此提示将在 <span id="countDown">15</span> 秒后消失并不再提示</p>';
            var cd = setInterval(function () {
                var val = $('#countDown')[0].innerText;
                val = parseInt(val) - 1;
                $('#countDown')[0].innerText = val;
                if (val <= 0) {
                    clearInterval(cd);
                    $('#pp-guide').remove();
                }
            }, 1000);
        }
        // 使用旧版的脚本
        var settings = eval('[' + getCookie('pixivPreviewerSetting') + ']')[0];
        var previewEnabled = settings.enablePreview == 'true' ? true : false;
        if(!previewEnabled){
            return;
        }
        var oldVersion = 'https://www.ocrosoft.com/PixivPreviewer113.js';
        var ovScript = document.createElement('script');
        ovScript.src = oldVersion;
        document.body.appendChild(ovScript);
        var pixiv_skScript = document.createElement('script');
        pixiv_skScript.src = 'https://www.ocrosoft.com/pixiv_sk_nogoogle.js';
        document.body.appendChild(pixiv_skScript);
        return;
    }
    // 设置按钮
    addSettingButton();
    // 读取设置
    var settings = getCookie('pixivPreviewerSetting');
    if (!settings || settings == 'null') {
        var screenWidth = document.documentElement.clientWidth;
        var screenHeight = document.documentElement.clientHeight;
        settings = {
            'enablePreview': ENABLE_PREVIEW.toString(),
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
    }
    else {
        settings = eval('[' + settings + ']')[0];
        ENABLE_PREVIEW = settings.enablePreview == 'true' ? true : false;
        ENABLE_SORT = settings.enableSort == 'true' ? true : false;
        GETTING_PAGE_COUNT = parseInt(settings.pageCount);
        FAV_FILTER = parseInt(settings.favFilter);
        IS_LINK_BLANK = settings.linkBlank == 'true' ? true : false;
    }
    // 预览，下载
    var itv = setInterval(function () {
        // 作品页使用旧版脚本实现预览
        if(location.href.indexOf('.php?id=') != -1) {
            if(ENABLE_PREVIEW) {
                var oldVersion = 'https://www.ocrosoft.com/PixivPreviewer113.js';
                var ovScript = document.createElement('script');
                ovScript.src = oldVersion;
                document.body.appendChild(ovScript);
            }
            clearInterval(itv);
        }
        try {
            getImageElements();
            // 排序
            if (picDiv.length > 0) {
                if (ENABLE_SORT && ENABLE_PREVIEW) {
                    pixiv_sk(pixivPreviewer); // 排序完成后调用预览
                }
                else if (ENABLE_SORT) {
                    pixiv_sk(); // 仅排序
                }
                else if (ENABLE_PREVIEW) {
                    pixivPreviewer();
                }
                clearInterval(itv);
            }
        }
        catch (e) {
            console.log(e);
            alert('出现错误!');
            clearInterval(itv);
        }
    }, 500);
});
