// ==UserScript==
// @name         PixivPreviewer
// @namespace
// @version      1.14
// @description  在搜索页显示较大的预览图（请注意阅读详细信息）。Show preview of pictures in serach page.
// @author       Ocrosoft
// @match        https://www.pixiv.net/search.php*
// @match        https://www.pixiv.net/member_illust.php?mode=medium*
// @match        https://www.pixiv.net/member_illust.php?mode=ugoira_view*
// @match        https://www.pixiv.net/ranking.php*
// @grant        none
// @require      http://code.jquery.com/jquery-2.1.4.min.js
// @namespace
// @namespace 
// ==/UserScript==

var mousePos; // 鼠标位置
/*
 * 节点结构
 * -div, [picList]
 * --div
 * ---figure
 * ----div, [picDiv]
 * -----a, [picHref]
 * ------img(图片节点), [picNode]
 * -----div(菜单)
*/
var dataDiv, picList, picDiv = [], picHref = [], picNode = []; // 相关元素，含义见上
var dataStr; // 更新后图片信息使用 json 保存在了 dataDiv 的 data-items 属性中
var imgData; // 保存解析后的 json

// 获取相关的元素
function getImageElements() {
    $('.popular-introduction').remove();
    dataDiv = $('#js-mount-point-search-result-list');
    dataStr = dataDiv.attr('data-items');
    imgData = eval(dataStr);
    picList = dataDiv.children()[0];
    var pics = $(picList).children();
    picDiv = [], picHref = [], picNode = [];
    for (var i = 0; i < pics.length; i++) {
        picDiv.push(pics[i].childNodes[0].childNodes[0]);
        $(picDiv[i]).attr('data-index', i);
        picHref.push(picDiv[i].childNodes[0]);
        $(picHref[i]).attr('data-index', i);
        picNode.push($(picHref[i]).children('img')[0]);
        $(picNode[i]).attr('data-index', i);
        $(picNode[i]).attr('data-id', imgData[i].illustId);
    }
}

function log(text) {
    console.log(text);
}

function activePreview() {
    $(picHref).mouseover(function (e) {
        if (e.ctrlKey) {
            return;
        }
        try {
            if ($(e.relatedTarget.parentNode).hasClass('pixivPreview')) {
                return;
            }
        } catch (e) { }
        var dataIndex = $(this).attr('data-index');
        var imgNode = picNode[dataIndex];
        // 鼠标位置
        mousePos = { x: e.pageX, y: e.pageY };
        // Div
        var previewDiv = document.createElement('div');
        $(previewDiv).css({ 'position': 'absolute', 'z-index': '999999' });
        $(previewDiv).addClass('pixivPreview');
        $(previewDiv).attr('data-index', dataIndex);
        // 添加Div
        $('.pixivPreview').remove();
        $('body')[0].appendChild(previewDiv);
        // 加载中图片
        var loadingImg = new Image();
        loadingImg.src = 'https://raw.githubusercontent.com/shikato/pixiv_sk/master/loading.gif';
        $(loadingImg).css('position', 'absolute');
        $(loadingImg).attr('data-index', dataIndex);
        previewDiv.appendChild(loadingImg);
        // 要显示图片
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
                    for (var i = 0; i < imgs.length; ++i) {
                        imgsOrigin.push(imgs[i].replace('img-master', 'img-original'));
                        imgsOrigin[i] = imgsOrigin[i].replace('_master1200', '');
                        // ?
                        //imgsOrigin[i] = imgsOrigin[i].replace('.jpg', '.png');
                    }
                    viewImages(imgs, 0, imgsOrigin);
                    return;
                } catch (e) {
                    // empty
                }
            }
        };
        // 动图的 img 是第一个孩子，多图的 img 是第二个孩子，单图的 img 是第一个也是唯一的孩子
        // 动图
        if (picHref[dataIndex].childNodes.length == 3 && $(picHref[dataIndex].childNodes[0]).attr('data-index')==dataIndex) {
            $(previewDiv).children().remove();
            previewDiv.innerHTML = '<iframe width="600px" height="50%" src="https://www.pixiv.net/member_illust.php?mode=ugoira_view&illust_id=' +
                $(picNode[dataIndex]).attr('data-id') + '#animePreview"/>';
            $(previewDiv).children('iframe').css('display', 'none');
            $(previewDiv).children('iframe').attr('data-index', dataIndex);
            var loadingImg = new Image();
            loadingImg.src = 'https://raw.githubusercontent.com/shikato/pixiv_sk/master/loading.gif';
            $(loadingImg).css('position', 'absolute');
            previewDiv.appendChild(loadingImg);
            return;
        }
        // 多图
        else if (picHref[dataIndex].childNodes.length==3) {
            xmlHttp.open('GET', 'https://www.pixiv.net/member_illust.php?mode=manga&illust_id=' +
                $(picNode[dataIndex]).attr('data-id'), true);
        }
        // 单图
        else {
            xmlHttp.open('GET', 'https://www.pixiv.net/member_illust.php?mode=medium&illust_id=' +
                $(picNode[dataIndex]).attr('data-id'), true);
        }
        xmlHttp.send(null);
    });
    $(picHref).mouseout(function (e) {
        // 鼠标移动到预览图上
        if ($(e.relatedTarget).attr('data-index')==$(this).attr('data-index')) {
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
    $(picHref).mousemove(function (e) {
        if (e.ctrlKey) {
            return;
        }
        var screenWidth = document.documentElement.clientWidth;
        var screenHeight = document.documentElement.clientHeight;
        mousePos.x = e.pageX; mousePos.y = e.pageY;
        adjustDivPos($('.pixivPreview').children('img')[1], $('.pixivPreview')[0], screenWidth, screenHeight);
    });
    $(picDiv).addClass('prev');
}
function adjustDivPos(loadImg,previewDiv,screenWidth, screenHeight) {
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

(function () {
    // 动图预览辅助
    if (location.href.indexOf('medium') != -1 && location.href.indexOf('animePreview') != -1) {
        location.href = location.href.replace('medium', 'ugoira_view');
        return;
    }
    else if (location.href.indexOf('ugoira_view') != -1 && location.href.indexOf('animePreview') != -1) {
        var height = parseInt($('canvas').css('height').split('px'));
        var width = parseInt($('canvas').css('width').split('px'));
        var newHeight = 580 / width * height;
        $('canvas').css({ 'height': newHeight + 'px', 'width': 580 + 'px' });
        window.parent.iframeLoaded(newHeight, 580);
        return;
    }
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
                // <a>移动进Div
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
            var screenWidth = document.documentElement.clientWidth;
            var screenHeight = document.documentElement.clientHeight;
            $('#fb-root')[0].innerHTML = '<p style="text-align:center;color:white;font-size:50px;">处理中<br/><span id="per">1/1</span></p>';
            $($('#fb-root').children()).css('margin-top', parseInt(screenHeight) / 2 - 40+'px');
            $('#fb-root').css({
                'width': screenWidth + 'px', 'height': screenHeight + 'px', 'position': 'fixed',
                'z-index': 999999, 'background-color': 'rgba(0,0,0,0.8)',
                'left': '0px', 'top': '0px'
            });
            // 关闭下载模式
            var imgOriginList = []; var linkList = []; var imgCount = 0;
            for (var i = 0; i < picHref.length; ++i) {
                if (picHref[i].lastChild.src.indexOf('unchecked') != -1) continue;
                if (picHref[i].childNodes.length == 3 && $(picHref[i].childNodes[0]).attr('data-index') == i) {
                    linkList.push('https://www.pixiv.net/member_illust.php?mode=medium&illust_id=' +
                        $(picNode[i]).attr('data-id'));
                }
                else if (picHref[i].childNodes.length == 3){
                    linkList.push('https://www.pixiv.net/member_illust.php?mode=manga&illust_id=' +
                        $(picNode[i]).attr('data-id'));
                }
                else {
                    linkList.push('https://www.pixiv.net/member_illust.php?mode=medium&illust_id=' +
                        $(picNode[i]).attr('data-id'));
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
                            for (var i = 0; i < imgs.length; ++i) {
                                imgsOrigin.push(imgs[i].replace('img-master', 'img-original'));
                                imgsOrigin[i] = imgsOrigin[i].replace('_master1200', '');
                                // ?
                                imgsOrigin[i] = imgsOrigin[i].replace('.jpg', '.png');
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
            }
        }
    });
    // 主要功能
    setInterval(function () {
        getImageElements();
        if (!$(picDiv[picDiv.length - 1]).hasClass('prev')) {
            // 开启预览
            activePreview();
            // 表示是否选中的图标
            $(picHref).each(function () {
                var checkIcon = new Image();
                checkIcon.src = 'https://raw.githubusercontent.com/Ocrosoft/PixivPreviewer/master/unchecked.png';
                $(checkIcon).css({ 'position': 'absolute', 'top': '0px', 'left': '0px', 'display': 'none' });
                this.appendChild(checkIcon);
            });
        }
    }, 500);
})();

function iframeLoaded(height, width) {
    $('.pixivPreview').children('iframe').css({ 'width': width + 20 + 'px', 'height': height + 20 + 'px' });
    // 调整位置
    var divX = mousePos.x, divY = mousePos.y;
    var screenWidth = document.documentElement.clientWidth;
    var screenHeight = document.documentElement.clientHeight;
    if (mousePos.x > screenWidth / 2) {
        divX -= width;
    }
    if ((mousePos.y - document.body.scrollTop) >
        screenHeight / 2) {
        divY -= height;
    }
    $('.pixivPreview').css({ 'left': divX + 'px', 'top': divY + 'px' });
    $('.pixivPreview').children('iframe').css('display', '');
    $('.pixivPreview').children('img').remove();
}