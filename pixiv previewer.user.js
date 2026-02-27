// ==UserScript==
// @name                Pixiv Previewer (Dev)
// @name:ja             Pixiv Previewer (Dev)
// @name:ru             Pixiv Previewer (Dev)
// @name:zh-CN          Pixiv Previewer (Dev)
// @name:zh-TW          Pixiv Previewer (Dev)
// @namespace           https://github.com/Ocrosoft/PixivPreviewer
// @version             3.8.4
// @description         Display preview images (support single image, multiple images, moving images); Download animation(.zip); Sorting the search page by favorite count(and display it).
// @description:zh-CN   显示预览图（支持单图，多图，动图）；动图压缩包下载；搜索页按热门度（收藏数）排序并显示收藏数。
// @description:ja      プレビュー画像の表示（単一画像、複数画像、動画のサポート）; アニメーションのダウンロード（.zip）; お気に入りの数で検索ページをソートします（そして表示します）。
// @description:zh-TW   顯示預覽圖像（支持單幅圖像，多幅圖像，運動圖像）； 下載動畫（.zip）; 按收藏夾數對搜索頁進行排序（並顯示）。
// @description:ru      Отображение превью изображений (поддержка одиночных, множественных и анимированных изображений); Скачивание анимаций (.zip); Сортировка страницы поиска по количеству добавлений в закладки (с отображением количества).
// @author              Ocrosoft
// @match               *://www.pixiv.net/*
// @grant               unsafeWindow
// @grant               GM.xmlHttpRequest
// @grant               GM_xmlhttpRequest
// @license             GPLv3
// @icon                https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=32&url=https://www.pixiv.net
// @icon64              https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64&url=https://www.pixiv.net
// @require             https://update.greasyfork.org/scripts/515994/1478507/gh_2215_make_GM_xhr_more_parallel_again.js
// @require             https://openuserjs.org/src/libs/sizzle/GM_config.js
// ==/UserScript==

// https://greasyfork.org/zh-CN/scripts/417761-ilog
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

    let level = this.LogLevel.Warning;
}
var iLog = new ILog();

var GM__xmlHttpRequest;
if ("undefined" != typeof (GM_xmlhttpRequest)) {
    GM__xmlHttpRequest = GM_xmlhttpRequest;
} else {
    GM__xmlHttpRequest = GM.xmlHttpRequest;
}

//
// Required for iOS <6, where Blob URLs are not available. This is slow...
// Source: https://gist.github.com/jonleighton/958841
function base64ArrayBuffer(arrayBuffer, off, byteLength) {
    var base64 = '';
    var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var bytes = new Uint8Array(arrayBuffer);
    var byteRemainder = byteLength % 3;
    var mainLength = off + byteLength - byteRemainder;
    var a, b, c, d;
    var chunk;
    // Main loop deals with bytes in chunks of 3
    for (var i = off; i < mainLength; i = i + 3) {
        // Combine the three bytes into a single integer
        chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];

        // Use bitmasks to extract 6-bit segments from the triplet
        a = (chunk & 16515072) >> 18; // 16515072 = (2^6 - 1) << 18
        b = (chunk & 258048) >> 12; // 258048   = (2^6 - 1) << 12
        c = (chunk & 4032) >> 6; // 4032     = (2^6 - 1) << 6
        d = chunk & 63;               // 63       = 2^6 - 1

        // Convert the raw binary segments to the appropriate ASCII encoding
        base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d];
    }

    // Deal with the remaining bytes and padding
    if (byteRemainder == 1) {
        chunk = bytes[mainLength];

        a = (chunk & 252) >> 2; // 252 = (2^6 - 1) << 2

        // Set the 4 least significant bits to zero
        b = (chunk & 3) << 4; // 3   = 2^2 - 1

        base64 += encodings[a] + encodings[b] + '==';
    } else if (byteRemainder == 2) {
        chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];

        a = (chunk & 64512) >> 10; // 64512 = (2^6 - 1) << 10
        b = (chunk & 1008) >> 4; // 1008  = (2^6 - 1) << 4

        // Set the 2 least significant bits to zero
        c = (chunk & 15) << 2; // 15    = 2^4 - 1

        base64 += encodings[a] + encodings[b] + encodings[c] + '=';
    }

    return base64;
}

function ZipImagePlayer(options) {
    this.op = options;
    this._URL = (window.URL || window.webkitURL || window.MozURL
        || window.MSURL);
    this._Blob = (window.Blob || window.WebKitBlob || window.MozBlob
        || window.MSBlob);
    this._BlobBuilder = (window.BlobBuilder || window.WebKitBlobBuilder
        || window.MozBlobBuilder || window.MSBlobBuilder);
    this._Uint8Array = (window.Uint8Array || window.WebKitUint8Array
        || window.MozUint8Array || window.MSUint8Array);
    this._DataView = (window.DataView || window.WebKitDataView
        || window.MozDataView || window.MSDataView);
    this._ArrayBuffer = (window.ArrayBuffer || window.WebKitArrayBuffer
        || window.MozArrayBuffer || window.MSArrayBuffer);
    this._maxLoadAhead = 0;
    if (!this._URL) {
        this._debugLog("No URL support! Will use slower data: URLs.");
        // Throttle loading to avoid making playback stalling completely while
        // loading images...
        this._maxLoadAhead = 10;
    }
    if (!this._Blob) {
        this._error("No Blob support");
    }
    if (!this._Uint8Array) {
        this._error("No Uint8Array support");
    }
    if (!this._DataView) {
        this._error("No DataView support");
    }
    if (!this._ArrayBuffer) {
        this._error("No ArrayBuffer support");
    }
    this._isSafari = Object.prototype.toString.call(
        window.HTMLElement).indexOf('Constructor') > 0;
    this._loadingState = 0;
    this._dead = false;
    this._context = options.canvas.getContext("2d");
    this._files = {};
    this._frameCount = this.op.metadata.frames.length;
    this._debugLog("Frame count: " + this._frameCount);
    this._frame = 0;
    this._loadFrame = 0;
    this._frameImages = [];
    this._paused = false;
    this._loadTimer = null;
    this._startLoad();
    if (this.op.autoStart) {
        this.play();
    } else {
        this._paused = true;
    }
}

ZipImagePlayer.prototype = {
    _trailerBytes: 30000,
    _failed: false,
    _mkerr: function (msg) {
        var _this = this;
        return function () {
            _this._error(msg);
        }
    },
    _error: function (msg) {
        this._failed = true;
        throw Error("ZipImagePlayer error: " + msg);
    },
    _debugLog: function (msg) {
        if (this.op.debug) {
            console.log(msg);
        }
    },
    _load: function (offset, length, callback) {
        var _this = this;
        // Unfortunately JQuery doesn't support ArrayBuffer XHR
        var xhr = new XMLHttpRequest();
        xhr.addEventListener("load", function (ev) {
            if (_this._dead) {
                return;
            }
            _this._debugLog("Load: " + offset + " " + length + " status=" +
                xhr.status);
            if (xhr.status == 200) {
                _this._debugLog("Range disabled or unsupported, complete load");
                offset = 0;
                length = xhr.response.byteLength;
                _this._len = length;
                _this._buf = xhr.response;
                _this._bytes = new _this._Uint8Array(_this._buf);
            } else {
                if (xhr.status != 206) {
                    _this._error("Unexpected HTTP status " + xhr.status);
                }
                if (xhr.response.byteLength != length) {
                    _this._error("Unexpected length " +
                        xhr.response.byteLength +
                        " (expected " + length + ")");
                }
                _this._bytes.set(new _this._Uint8Array(xhr.response), offset);
            }
            if (callback) {
                callback.apply(_this, [offset, length]);
            }
        }, false);
        xhr.addEventListener("error", this._mkerr("Fetch failed"), false);
        xhr.open("GET", this.op.source);
        xhr.responseType = "arraybuffer";
        if (offset != null && length != null) {
            var end = offset + length;
            xhr.setRequestHeader("Range", "bytes=" + offset + "-" + (end - 1));
            if (this._isSafari) {
                // Range request caching is broken in Safari
                // https://bugs.webkit.org/show_bug.cgi?id=82672
                xhr.setRequestHeader("Cache-control", "no-cache");
                xhr.setRequestHeader("If-None-Match", Math.random().toString());
            }
        }
        /*this._debugLog("Load: " + offset + " " + length);*/
        xhr.send();
    },
    _startLoad: function () {
        var _this = this;
        if (!this.op.source) {
            // Unpacked mode (individiual frame URLs) - just load the frames.
            this._loadNextFrame();
            return;
        }
        $.ajax({
            url: this.op.source,
            type: "HEAD"
        }).done(function (data, status, xhr) {
            if (_this._dead) {
                return;
            }
            _this._pHead = 0;
            _this._pNextHead = 0;
            _this._pFetch = 0;
            var len = parseInt(xhr.getResponseHeader("Content-Length"));
            if (!len) {
                _this._debugLog("HEAD request failed: invalid file length.");
                _this._debugLog("Falling back to full file mode.");
                _this._load(null, null, function (off, len) {
                    _this._pTail = 0;
                    _this._pHead = len;
                    _this._findCentralDirectory();
                });
                return;
            }
            _this._debugLog("Len: " + len);
            _this._len = len;
            _this._buf = new _this._ArrayBuffer(len);
            _this._bytes = new _this._Uint8Array(_this._buf);
            var off = len - _this._trailerBytes;
            if (off < 0) {
                off = 0;
            }
            _this._pTail = len;
            _this._load(off, len - off, function (off, len) {
                _this._pTail = off;
                _this._findCentralDirectory();
            });
        }).fail(this._mkerr("Length fetch failed"));
    },
    _findCentralDirectory: function () {
        // No support for ZIP file comment
        var dv = new this._DataView(this._buf, this._len - 22, 22);
        if (dv.getUint32(0, true) != 0x06054b50) {
            this._error("End of Central Directory signature not found");
        }
        var cd_count = dv.getUint16(10, true);
        var cd_size = dv.getUint32(12, true);
        var cd_off = dv.getUint32(16, true);
        if (cd_off < this._pTail) {
            this._load(cd_off, this._pTail - cd_off, function () {
                this._pTail = cd_off;
                this._readCentralDirectory(cd_off, cd_size, cd_count);
            });
        } else {
            this._readCentralDirectory(cd_off, cd_size, cd_count);
        }
    },
    _readCentralDirectory: function (offset, size, count) {
        var dv = new this._DataView(this._buf, offset, size);
        var p = 0;
        for (var i = 0; i < count; i++) {
            if (dv.getUint32(p, true) != 0x02014b50) {
                this._error("Invalid Central Directory signature");
            }
            var compMethod = dv.getUint16(p + 10, true);
            var uncompSize = dv.getUint32(p + 24, true);
            var nameLen = dv.getUint16(p + 28, true);
            var extraLen = dv.getUint16(p + 30, true);
            var cmtLen = dv.getUint16(p + 32, true);
            var off = dv.getUint32(p + 42, true);
            if (compMethod != 0) {
                this._error("Unsupported compression method");
            }
            p += 46;
            var nameView = new this._Uint8Array(this._buf, offset + p, nameLen);
            var name = "";
            for (var j = 0; j < nameLen; j++) {
                name += String.fromCharCode(nameView[j]);
            }
            p += nameLen + extraLen + cmtLen;
            /*this._debugLog("File: " + name + " (" + uncompSize +
                           " bytes @ " + off + ")");*/
            this._files[name] = { off: off, len: uncompSize };
        }
        // Two outstanding fetches at any given time.
        // Note: the implementation does not support more than two.
        if (this._pHead >= this._pTail) {
            this._pHead = this._len;
            $(this).triggerHandler("loadProgress", [this._pHead / this._len]);
            this._loadNextFrame();
        } else {
            this._loadNextChunk();
            this._loadNextChunk();
        }
    },
    _loadNextChunk: function () {
        if (this._pFetch >= this._pTail) {
            return;
        }
        var off = this._pFetch;
        var len = this.op.chunkSize;
        if (this._pFetch + len > this._pTail) {
            len = this._pTail - this._pFetch;
        }
        this._pFetch += len;
        this._load(off, len, function () {
            if (off == this._pHead) {
                if (this._pNextHead) {
                    this._pHead = this._pNextHead;
                    this._pNextHead = 0;
                } else {
                    this._pHead = off + len;
                }
                if (this._pHead >= this._pTail) {
                    this._pHead = this._len;
                }
                /*this._debugLog("New pHead: " + this._pHead);*/
                $(this).triggerHandler("loadProgress",
                    [this._pHead / this._len]);
                if (!this._loadTimer) {
                    this._loadNextFrame();
                }
            } else {
                this._pNextHead = off + len;
            }
            this._loadNextChunk();
        });
    },
    _fileDataStart: function (offset) {
        var dv = new DataView(this._buf, offset, 30);
        var nameLen = dv.getUint16(26, true);
        var extraLen = dv.getUint16(28, true);
        return offset + 30 + nameLen + extraLen;
    },
    _isFileAvailable: function (name) {
        var info = this._files[name];
        if (!info) {
            this._error("File " + name + " not found in ZIP");
        }
        if (this._pHead < (info.off + 30)) {
            return false;
        }
        return this._pHead >= (this._fileDataStart(info.off) + info.len);
    },
    _loadNextFrame: function () {
        if (this._dead) {
            return;
        }
        var frame = this._loadFrame;
        if (frame >= this._frameCount) {
            return;
        }
        var meta = this.op.metadata.frames[frame];
        if (!this.op.source) {
            // Unpacked mode (individiual frame URLs)
            this._loadFrame += 1;
            this._loadImage(frame, meta.file, false);
            return;
        }
        if (!this._isFileAvailable(meta.file)) {
            return;
        }
        this._loadFrame += 1;
        var off = this._fileDataStart(this._files[meta.file].off);
        var end = off + this._files[meta.file].len;
        var url;
        var mime_type = this.op.metadata.mime_type || "image/png";
        if (this._URL) {
            var slice;
            if (!this._buf.slice) {
                slice = new this._ArrayBuffer(this._files[meta.file].len);
                var view = new this._Uint8Array(slice);
                view.set(this._bytes.subarray(off, end));
            } else {
                slice = this._buf.slice(off, end);
            }
            var blob;
            try {
                blob = new this._Blob([slice], { type: mime_type });
            }
            catch (err) {
                this._debugLog("Blob constructor failed. Trying BlobBuilder..."
                    + " (" + err.message + ")");
                var bb = new this._BlobBuilder();
                bb.append(slice);
                blob = bb.getBlob();
            }
            /*_this._debugLog("Loading " + meta.file + " to frame " + frame);*/
            url = this._URL.createObjectURL(blob);
            this._loadImage(frame, url, true);
        } else {
            url = ("data:" + mime_type + ";base64,"
                + base64ArrayBuffer(this._buf, off, end - off));
            this._loadImage(frame, url, false);
        }
    },
    _loadImage: function (frame, url, isBlob) {
        var _this = this;
        var image = new Image();
        var meta = this.op.metadata.frames[frame];
        image.addEventListener('load', function () {
            _this._debugLog("Loaded " + meta.file + " to frame " + frame);
            if (isBlob) {
                _this._URL.revokeObjectURL(url);
            }
            if (_this._dead) {
                return;
            }
            _this._frameImages[frame] = image;
            $(_this).triggerHandler("frameLoaded", frame);
            if (_this._loadingState == 0) {
                _this._displayFrame.apply(_this);
            }
            if (frame >= (_this._frameCount - 1)) {
                _this._setLoadingState(2);
                _this._buf = null;
                _this._bytes = null;
            } else {
                if (!_this._maxLoadAhead ||
                    (frame - _this._frame) < _this._maxLoadAhead) {
                    _this._loadNextFrame();
                } else if (!_this._loadTimer) {
                    _this._loadTimer = setTimeout(function () {
                        _this._loadTimer = null;
                        _this._loadNextFrame();
                    }, 200);
                }
            }
        });
        image.src = url;
    },
    _setLoadingState: function (state) {
        if (this._loadingState != state) {
            this._loadingState = state;
            $(this).triggerHandler("loadingStateChanged", [state]);
        }
    },
    _displayFrame: function () {
        if (this._dead) {
            return;
        }
        var _this = this;
        var meta = this.op.metadata.frames[this._frame];
        this._debugLog("Displaying frame: " + this._frame + " " + meta.file);
        var image = this._frameImages[this._frame];
        if (!image) {
            this._debugLog("Image not available!");
            this._setLoadingState(0);
            return;
        }
        if (this._loadingState != 2) {
            this._setLoadingState(1);
        }
        if (this.op.autosize) {
            if (this._context.canvas.width != image.width || this._context.canvas.height != image.height) {
                // make the canvas autosize itself according to the images drawn on it
                // should set it once, since we don't have variable sized frames
                this._context.canvas.width = image.width;
                this._context.canvas.height = image.height;
            }
        };
        this._context.clearRect(0, 0, this.op.canvas.width,
            this.op.canvas.height);
        this._context.drawImage(image, 0, 0);
        $(this).triggerHandler("frame", this._frame);
        if (!this._paused) {
            this._timer = setTimeout(function () {
                _this._timer = null;
                _this._nextFrame.apply(_this);
            }, meta.delay);
        }
    },
    _nextFrame: function (frame) {
        if (this._frame >= (this._frameCount - 1)) {
            if (this.op.loop) {
                this._frame = 0;
            } else {
                this.pause();
                return;
            }
        } else {
            this._frame += 1;
        }
        this._displayFrame();
    },
    play: function () {
        if (this._dead) {
            return;
        }
        if (this._paused) {
            $(this).triggerHandler("play", [this._frame]);
            this._paused = false;
            this._displayFrame();
        }
    },
    pause: function () {
        if (this._dead) {
            return;
        }
        if (!this._paused) {
            if (this._timer) {
                clearTimeout(this._timer);
            }
            this._paused = true;
            $(this).triggerHandler("pause", [this._frame]);
        }
    },
    rewind: function () {
        if (this._dead) {
            return;
        }
        this._frame = 0;
        if (this._timer) {
            clearTimeout(this._timer);
        }
        this._displayFrame();
    },
    stop: function () {
        this._debugLog("Stopped!");
        this._dead = true;
        if (this._timer) {
            clearTimeout(this._timer);
        }
        if (this._loadTimer) {
            clearTimeout(this._loadTimer);
        }
        this._frameImages = null;
        this._buf = null;
        this._bytes = null;
        $(this).triggerHandler("stop");
    },
    getCurrentFrame: function () {
        return this._frame;
    },
    getLoadedFrames: function () {
        return this._frameImages.length;
    },
    getFrameCount: function () {
        return this._frameCount;
    },
    hasError: function () {
        return this._failed;
    }
}

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
    // 日本語-日本
    ja_JP: 3,
};
let Texts = {};
Texts[Lang.zh_CN] = {
    // 安装或更新后弹出的提示
    install_title: '欢迎使用 PixivPreviewer',
    install_body: '<div style="position: absolute;left: 50%;top: 30%;font-size: 20px; color: white;transform:translate(-50%,0);"><p style="text-indent: 2em;">欢迎反馈问题和提出建议！ ☞<a style="color: green;" href="https://greasyfork.org/zh-CN/scripts/30766-pixiv-previewer/feedback" target="_blank">反馈页面</a></p><br><p style="text-indent: 2em;">如果您是第一次使用，推荐到 ☞<a style="color: green;" href="https://greasyfork.org/zh-CN/scripts/30766-pixiv-previewer" target="_blank">详情页</a> 查看脚本介绍。</p></div>',
    upgrade_body: '<h3>新的设置菜单!</h3>&nbsp&nbsp<p style="text-indent: 2em;">感谢各位使用 Pixiv Previewer,本次更新调整了设置菜单的视觉效果,欢迎反馈问题和提出建议! ☞<a style="color: green;" href="https://greasyfork.org/zh-CN/scripts/30766-pixiv-previewer/feedback" target="_blank">反馈页面</a></p>',
    // 设置项
    setting_settingSection: '设置',
    setting_language: '语言',
    setting_preview: '预览',
    setting_animePreview: '动图预览',
    setting_sortSection: '排序',
    setting_sort: '排序（仅搜索页生效）',
    setting_anime: '动图下载（动图预览及详情页生效）',
    setting_origin: '预览时优先显示原图（慢）',
    setting_previewDelay: '延迟显示预览图（毫秒）',
    setting_previewByKey: '使用按键控制预览图展示（Ctrl）',
    setting_previewByKeyHelp: '开启后鼠标移动到图片上不再展示预览图，按下Ctrl键才展示，同时“延迟显示预览”设置项不生效。',
    setting_maxPage: '每次排序时统计的最大页数',
    setting_hideWork: '隐藏收藏数少于设定值的作品',
    setting_hideAiWork: '隐藏 AI 生成作品',
    setting_onlyAiWork: '只显示 AI 生成作品',
    setting_hideFav: '排序时隐藏已收藏的作品',
    setting_hideFollowed: '排序时隐藏已关注画师作品',
    setting_hideByTag: '排序时隐藏指定标签的作品',
    setting_hideByTagPlaceholder: '输入标签名，如 "tag1|tag2"，支持正则',
    setting_hideByUser: '排序时隐藏指定用户的作品',
    setting_hideByUserPlaceholder: '输入用户ID，如 "12345|67890"',
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
    setting_novelHideWork: '隐藏收藏数少于设定值的作品',
    setting_novelHideFav: '排序时隐藏已收藏的作品',
    setting_previewFullScreen: '全屏预览',
    setting_scrollLockWhenPreview: '预览时阻止页面滚动',
    setting_logLevel: '日志等级',
    setting_novelSection: '小说排序',
    setting_close: '关闭',
    setting_maxXhr: '收藏数并发（推荐 64）',
    setting_hideByCountLessThan: '隐藏图片张数少于设定值的作品',
    setting_hideByCountMoreThan: '隐藏图片张数多于设定值的作品',
    // 搜索时过滤值太高
    sort_noWork: '没有可以显示的作品（隐藏了 %1 个作品）',
    sort_getWorks: '正在获取第%1/%2页作品',
    sort_getBookmarkCount: '获取收藏数：%1/%2',
    sort_getPublicFollowing: '获取公开关注画师',
    sort_getPrivateFollowing: '获取私有关注画师',
    sort_filtering: '过滤%1收藏量低于%2的作品',
    sort_filteringHideFavorite: '已收藏和',
    sort_fullSizeThumb: '全尺寸缩略图（搜索页、用户页）',
    sort_sortByBookmark: '按❤️排序',
    sort_sortByLike: '按👍排序',
    sort_sortByView: '按👀排序',
    // 小说排序
    nsort_getWorks: '正在获取第1%/2%页作品',
    nsort_sorting: '正在按收藏量排序',
    nsort_hideFav: '排序时隐藏已收藏的作品',
    nsort_hideFollowed: '排序时隐藏已关注作者作品',
    text_sort: '排序'
};
// translate by google
Texts[Lang.en_US] = {
    install_title: 'Welcome to PixivPreviewer',
    install_body: '<div style="position: absolute;left: 50%;top: 30%;font-size: 20px; color: white;transform:translate(-50%,0);"><p style="text-indent: 2em;">Feedback questions and suggestions are welcome! ☞<a style="color: green;" href="https://greasyfork.org/zh-CN/scripts/30766-pixiv-previewer/feedback" target="_blank">Feedback Page</a></p><br><p style="text-indent: 2em;">If you are using it for the first time, it is recommended to go to the ☞<a style="color: green;" href="https://greasyfork.org/zh-CN/scripts/30766-pixiv-previewer" target="_blank">Details Page</a> to see the script introduction.</p></div>',
    upgrade_body: '<h3>New settings menu!</h3>&nbsp&nbsp<p style="text-indent: 2em;">Thanks to all Pixiv Previewer users, this update adjusts the visual effect of the settings menu, and feedback questions and suggestions are welcome! ☞<a style="color: green;" href="https://greasyfork.org/zh-CN/scripts/30766-pixiv-previewer/feedback" target="_blank">Feedback Page</a></p>',
    setting_settingSection: 'Settings',
    setting_language: 'Language',
    setting_preview: 'Preview',
    setting_animePreview: 'Animation preview',
    setting_sortSection: 'Sorting',
    setting_sort: 'Sorting (Search page)',
    setting_anime: 'Animation download (Preview and Artwork page)',
    setting_origin: 'Display original image when preview (slow)',
    setting_previewDelay: 'Delay of display preview image(Million seconds)',
    setting_previewByKey: 'Use keys to control the preview image display (Ctrl)',
    setting_previewByKeyHelp: 'After enabling it, move the mouse to the picture and no longer display the preview image. Press the Ctrl key to display it, and the "Delayed Display Preview" setting item does not take effect.',
    setting_maxPage: 'Maximum number of pages counted per sort',
    setting_hideWork: 'Hide works with bookmark count less than set value',
    setting_hideAiWork: 'Hide AI works',
    setting_onlyAiWork: 'Show only AI-generated works',
    setting_hideFav: 'Hide favorites when sorting',
    setting_hideFollowed: 'Hide artworks of followed artists when sorting',
    setting_hideByTag: 'Hide artworks by tag',
    setting_hideByTagPlaceholder: 'Input tag name, e.g. "tag1|tag2", regular expressions supported',
    setting_hideByUser: 'Hide artworks by user',
    setting_hideByUserPlaceholder: 'Input user ID, e.g. "12345|67890"',
    setting_clearFollowingCache: 'Clear Cache',
    setting_clearFollowingCacheHelp: 'The folloing artists info. will be saved locally for one day, if you want to update immediately, please click this to clear cache',
    setting_followingCacheCleared: 'Success, please refresh the page.',
    setting_blank: 'Open works\' details page in new tab',
    setting_turnPage: 'Use ← → to turn pages (Search page)',
    setting_save: 'Save',
    setting_reset: 'Reset',
    setting_resetHint: 'This will delete all settings and set it to default. Are you sure?',
    setting_novelSort: 'Sorting (Novel)',
    setting_novelMaxPage: 'Maximum number of pages counted for novel sorting',
    setting_novelHideWork: 'Hide works with bookmark count less than set value',
    setting_novelHideFav: 'Hide favorites when sorting',
    setting_previewFullScreen: 'Full screen preview',
    setting_scrollLockWhenPreview: 'Prevent page scrolling during preview',
    setting_logLevel: 'Log Level',
    setting_novelSection: 'Novel Sorting',
    setting_close: 'Close',
    setting_maxXhr: 'Bookmark count concurrency (recommended 64)',
    setting_hideByCountLessThan: 'Hide works with image count less than set value',
    setting_hideByCountMoreThan: 'Hide works with image count more than set value',
    sort_noWork: 'No works to display (%1 works hideen)',
    sort_getWorks: 'Getting artworks of page: %1 of %2',
    sort_getBookmarkCount: 'Getting bookmark count of artworks：%1 of %2',
    sort_getPublicFollowing: 'Getting public following list',
    sort_getPrivateFollowing: 'Getting private following list',
    sort_filtering: 'Filtering%1works with bookmark count less than %2',
    sort_filteringHideFavorite: ' favorited works and ',
    sort_fullSizeThumb: 'Display not cropped images.(Search page and User page only.)',
    sort_sortByBookmark: 'Sort by ❤️',
    sort_sortByLike: 'Sort by 👍',
    sort_sortByView: 'Sort by 👀',
    nsort_getWorks: 'Getting novels of page: 1% of 2%',
    nsort_sorting: 'Sorting by bookmark cound',
    nsort_hideFav: 'Hide favorites when sorting',
    nsort_hideFollowed: 'Hide artworks of followed authors when sorting',
    text_sort: 'sort',
};
// RU: перевод от  vanja-san
Texts[Lang.ru_RU] = {
    install_title: 'Добро пожаловать в PixivPreviewer',
    install_body: '<div style="position: absolute;left: 50%;top: 30%;font-size: 20px; color: white;transform:translate(-50%,0);"><p style="text-indent: 2em;">Вопросы и предложения приветствуются! ☞<a style="color: green;" href="https://greasyfork.org/zh-CN/scripts/30766-pixiv-previewer/feedback" target="_blank">Страница обратной связи</a></p><br><p style="text-indent: 2em;">Если вы используете это впервые, рекомендуется перейти к ☞<a style="color: green;" href="https://greasyfork.org/zh-CN/scripts/30766-pixiv-previewer" target="_blank">Странице подробностей</a>, чтобы посмотреть введение в скрипт.</p></div>',
    upgrade_body: '<h3>Новое меню настроек!</h3>&nbsp&nbsp<p style="text-indent: 2em;">Спасибо всем пользователям Pixiv Previewer, это обновление изменило визуальный эффект меню настроек, вопросы и предложения приветствуются! ☞<a style="color: green;" href="https://greasyfork.org/zh-CN/scripts/30766-pixiv-previewer/feedback" target="_blank">Страница обратной связи</a></p>',
    setting_settingSection: 'Настройки',
    setting_language: 'Язык',
    setting_preview: 'Предпросмотр',
    setting_animePreview: 'Анимация предпросмотра',
    setting_sortSection: 'Сортировка',
    setting_sort: 'Сортировка (Страница поиска)',
    setting_anime: 'Анимация скачивания (Страницы предпросмотра и Artwork)',
    setting_origin: 'При предпросмотре, показывать изображения с оригинальным качеством (медленно)',
    setting_previewDelay: 'Задержка отображения предпросмотра изображения (Миллион секунд)',
    setting_previewByKey: 'Использовать клавиши для управления отображением предпросмотра изображения (Ctrl)',
    setting_previewByKeyHelp: 'После включения, перемещение мыши к изображению больше не отображает предпросмотр изображения. Нажмите клавишу Ctrl, чтобы отобразить его, и параметр "Задержка отображения предпросмотра" не будет действовать.',
    setting_maxPage: 'Максимальное количество страниц, подсчитанных за сортировку',
    setting_hideWork: 'Скрыть работы с количеством закладок меньше установленного значения',
    setting_hideAiWork: 'Скрыть работы, созданные ИИ',
    setting_onlyAiWork: 'Показывать только работы, созданные ИИ',
    setting_hideFav: 'При сортировке, скрыть избранное',
    setting_hideFollowed: 'При сортировке, скрыть работы художников на которых подписаны',
    setting_hideByTag: 'При сортировке, скрыть работы с указанным тегом',
    setting_hideByTagPlaceholder: 'Введите имя тега, например "tag1|tag2", поддерживается регулярное выражение',
    setting_hideByUser: 'При сортировке, скрыть работы от указанного пользователя',
    setting_hideByUserPlaceholder: 'Введите ID пользователя, например "12345|67890"',
    setting_clearFollowingCache: 'Очистить кэш',
    setting_clearFollowingCacheHelp: 'Следующая информация о художниках будет сохранена локально в течение одного дня, если вы хотите обновить её немедленно, нажмите на эту кнопку, чтобы очистить кэш',
    setting_followingCacheCleared: 'Готово, обновите страницу.',
    setting_blank: 'Открывать страницу с описанием работы на новой вкладке',
    setting_turnPage: 'Использовать ← → для перелистывания страниц (Страница поиска)',
    setting_save: 'Сохранить',
    setting_reset: 'Сбросить',
    setting_resetHint: 'Это удалит все настройки и установит их по умолчанию. Продолжить?',
    setting_novelSort: 'Сортировка (Роман)',
    setting_novelMaxPage: 'Максимальное количество страниц, подсчитанных за сортировку романа',
    setting_novelHideWork: 'Скрыть работы с количеством закладок меньше установленного значения',
    setting_novelHideFav: 'При сортировке, скрыть избранное',
    setting_previewFullScreen: 'Предпросмотр в полноэкранном режиме',
    setting_scrollLockWhenPreview: 'Блокировать прокрутку страницы при предпросмотре',
    setting_novelSection: 'Сортировка (Роман)',
    setting_close: 'Закрыть',
    setting_maxXhr: 'Количество закладок (рекомендуется 64)',
    setting_hideByCountLessThan: 'Скрыть работы с количеством изображений меньше установленного значения',
    setting_hideByCountMoreThan: 'Скрыть работы с количеством изображений больше установленного значения',
    sort_noWork: 'Нет работ для отображения (%1 works hidden)',
    sort_getWorks: 'Получение иллюстраций страницы: %1 из %2',
    sort_getBookmarkCount: 'Получение количества закладок artworks：%1 из %2',
    sort_getPublicFollowing: 'Получение публичного списка подписок',
    sort_getPrivateFollowing: 'Получение приватного списка подписок',
    sort_filtering: 'Фильтрация %1 работ с количеством закладок меньше чем %2',
    sort_filteringHideFavorite: ' избранные работы и ',
    sort_fullSizeThumb: 'Показать неотредактированное изображение (Страницы поиска и Artwork)',
    sort_sortByBookmark: 'Сортировать по ❤️',
    sort_sortByLike: 'Сортировать по 👍',
    sort_sortByView: 'Сортировать по 👀',
    nsort_getWorks: 'Получение романов страницы: 1% из 2%',
    nsort_sorting: 'Сортировка по количеству закладок',
    nsort_hideFav: 'При сортировке, скрыть избранное',
    nsort_hideFollowed: 'При сортировке, скрыть работы художников на которых подписаны',
    text_sort: 'Сортировать'
};
Texts[Lang.ja_JP] = {
    install_title: 'Welcome to PixivPreviewer',
    install_body: '<div style="position: absolute;left: 50%;top: 30%;font-size: 20px; color: white;transform:translate(-50%,0);"><p style="text-indent: 2em;">ご意見や提案は大歓迎です! ☞<a style="color: green;" href="https://greasyfork.org/ja/scripts/30766-pixiv-previewer/feedback" target="_blank">フィードバックページ</a></p><br><p style="text-indent: 2em;">初めて使う場合は、☞<a style="color: green;" href="https://greasyfork.org/ja/scripts/30766-pixiv-previewer" target="_blank">詳細ページ</a> でスクリプトの紹介を見ることをお勧めします。</p></div>',
    upgrade_body: '<h3>新しい設定メニュー!</h3>&nbsp&nbsp<p style="text-indent: 2em;">Pixiv Previewerをご利用いただきありがとうございます。このアップデートでは、設定メニューのビジュアルエフェクトが調整されました。問題や提案をお待ちしております! ☞<a style="color: green;" href="https://greasyfork.org/ja/scripts/30766-pixiv-previewer/feedback" target="_blank">フィードバックページ</a></p>',
    setting_settingSection: '設定',
    setting_language: '言語',
    setting_preview: 'プレビュー機能',
    setting_animePreview: 'うごイラプレビュー',
    setting_sortSection: 'ソート',
    setting_sort: 'ソート',
    setting_anime: 'うごイラダウンロード',
    setting_origin: '最大サイズの画像を表示する(遅くなる可能性がある)',
    setting_previewDelay: 'カーソルを重ねてからプレビューするまでの遅延(ミリ秒)',
    setting_previewByKey: 'キーでプレビュー画像の表示を制御する (Ctrl)',
    setting_previewByKeyHelp: 'これを有効にすると、画像にマウスを移動してもプレビュー画像が表示されなくなります。Ctrlキーを押すと表示され、 \"遅延表示プレビュー\" の設定項目は無効になります。',
    setting_maxPage: 'ソートするときに取得する最大ページ数',
    setting_hideWork: '一定以下のブクマーク数の作品を非表示にする',
    setting_hideAiWork: 'AIの作品を非表示にする',
    setting_onlyAiWork: 'AI生成作品のみ表示',
    setting_hideFav: 'ブックマーク数をソート時に非表示にする',
    setting_hideFollowed: 'ソート時にフォローしているアーティストの作品を非表示',
    setting_hideByTag: 'ソート時に指定したタグの作品を非表示',
    setting_hideByTagPlaceholder: 'タグ名を入力してください（例："tag1|tag2"、正規表現対応）',
    setting_hideByUser: 'ソート時に指定したユーザーの作品を非表示',
    setting_hideByUserPlaceholder: 'ユーザーIDを入力してください（例："12345|67890"）',
    setting_clearFollowingCache: 'キャッシュをクリア',
    setting_clearFollowingCacheHelp: 'フォローしているアーティストの情報がローカルに1日保存されます。すぐに更新したい場合は、このキャッシュをクリアしてください。',
    setting_followingCacheCleared: '成功しました。ページを更新してください。',
    setting_blank: '作品の詳細ページを新しいタブで開く',
    setting_turnPage: '← → を使用してページをめくる（検索ページ）',
    setting_save: 'Save',
    setting_reset: 'Reset',
    setting_resetHint: 'これにより、すべての設定が削除され、デフォルトに設定されます。よろしいですか？',
    setting_novelSort: 'ソート（小説）',
    setting_novelMaxPage: '小説のソートのページ数の最大値',
    setting_novelHideWork: '設定値未満のブックマーク数の作品を非表示',
    setting_novelHideFav: 'ソート時にお気に入りを非表示',
    setting_previewFullScreen: '全画面プレビュー',
    setting_scrollLockWhenPreview: 'プレビュー時にページのスクロールをロックする',
    setting_novelSection: 'ソート（小説）',
    setting_close: '閉じる',
    setting_maxXhr: 'ブックマーク数の同時リクエスト数（推奨64）',
    setting_hideByCountLessThan: '画像数が設定値未満の作品を非表示',
    setting_hideByCountMoreThan: '画像数が設定値を超える作品を非表示',
    sort_noWork: '表示する作品がありません（%1 作品が非表示）',
    sort_getWorks: 'ページの作品を取得中：%1 / %2',
    sort_getBookmarkCount: '作品のブックマーク数を取得中：%1 / %2',
    sort_getPublicFollowing: '公開フォロー一覧を取得中',
    sort_getPrivateFollowing: '非公開フォロー一覧を取得中',
    sort_filtering: 'ブックマーク数が%2未満の作品%1件をフィルタリング',
    sort_filteringHideFavorite: ' お気に入り登録済みの作品および  ',
    sort_fullSizeThumb: 'トリミングされていない画像を表示（検索ページおよびユーザーページのみ）。',
    sort_sortByBookmark: '❤️ でソート',
    sort_sortByLike: '👍 でソート',
    sort_sortByView: '👀 でソート',
    nsort_getWorks: '小説のページを取得中：1% / 2%',
    nsort_sorting: 'ブックマーク数で並べ替え',
    nsort_hideFav: 'ソート時にお気に入りを非表示',
    nsort_hideFollowed: 'ソート時にフォロー済み作者の作品を非表示',
    text_sort: 'ソート'
};

// 语言
let g_language = Lang.auto;
// 版本号，第三位不需要跟脚本的版本号对上，第三位更新只有需要弹更新提示的时候才需要更新这里
let g_version = '3.7.37';
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
// 设置
let g_settings;
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
    // 搜索顶部 tab
    SearchTop: 12,

    // 总数
    PageTypeCount: 13,
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
    let toolbar = $('#pp-toolbar');
    if (toolbar.length > 0) {
        return toolbar.get(0);
    }
    $('body').append('<div id="pp-toolbar" style="position:fixed;right:28px;bottom:160px;"></div>')
    return $('#pp-toolbar').get(0);
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
function processElementListCommon(lis, controlFinder) {
    $.each(lis, function (i, e) {
        let li = $(e);

        // 只填充必须的几个，其他的目前用不着
        let ctlAttrs = {
            illustId: 0,
            illustType: 0,
            pageCount: 1,
        };

        let links = li.find('a');
        let imageLink = null;
        for (let i = 0; i < links.length; ++i) {
            imageLink = $(links[i]);
            let link = imageLink.attr('href');
            if (link == null) {
                iLog.w('Invalid href, skip this.');
                continue;
            }
            let linkMatched = link.match(/artworks\/(\d+)/);
            if (linkMatched) {
                ctlAttrs.illustId = linkMatched[1];
                break;
            } else {
                iLog.e('Get illustId failed, skip this list item!');
                continue;
            }
        }
        if (imageLink == null) {
            iLog.w('Can not found img or imageLink, skip this.');
            return;
        }

        let animationSvg = imageLink.children('div:first').find('svg:first');
        let pageCountSpan = imageLink.children('div:last').find('span:last');

        if (animationSvg.length > 0) {
            ctlAttrs.illustType = 2;
        }
        if (pageCountSpan.length > 0) {
            ctlAttrs.pageCount = parseInt(pageCountSpan.text());
        }

        // 添加 attr
        let control;
        if (controlFinder) {
            control = controlFinder(li);
        } else {
            control = li.find('div:first>div:first');
        }
        // 兜底部分页面，如 hover 作者头像弹出的作品预览
        if (control.length == 0) {
            control = li;
        }
        control.attr({
            'illustId': ctlAttrs.illustId,
            'illustType': ctlAttrs.illustType,
            'pageCount': ctlAttrs.pageCount
        });
        control.addClass('pp-control');
    });
}
function replaceThumbCommon(elements) {
    $.each(elements, (i, e) => {
        e = $(e);
        let img = e.find('img');
        if (img.length == 0) {
            iLog.w('No img in the control element.');
            return true;
        }
        let src = img.attr('src');
        let fullSizeSrc = convertThumbUrlToSmall(src);
        if (src != fullSizeSrc) {
            img.attr('src', fullSizeSrc).css('object-fit', 'contain');
        }
    });
}
function findLiByImgTag() {
    let lis = [];
    $.each($('img'), (i, e) => {
        let el = $(e);
        let p = el;
        for (let i = 0; i < 3; ++i) {
            p = p.parent();
            if (p.length == 0) break;
            if (p.attr('data-gtm-value') == '') continue;
            let href = p.attr('href');
            if (undefined == href || href == '') continue;
            if (href.indexOf('/artwork') == -1) continue;
            for (let i = 0; i < 10; ++i) {
                el = el.parent();
                if (el.length == 0) {
                    break;
                }
                // 常用的 <li>
                if (el.get(0).tagName == 'LI') {
                    lis.push(el);
                    break;
                }
                // <ul> 套 <div>（当 ul 用） 再套 <div>
                // 作品页收藏后弹出的推荐作品
                // <ul>
                //  <div>
                //    <div></div>
                //    <div></div>
                //  </div>
                // </ul>
                if (el.parent().parent().length > 0 &&
                    el.parent().parent().get(0).tagName == 'UL' &&
                    el.parent().parent().children().length == 1) {
                    lis.push(el);
                    break;
                }
                // <ul> 套 <div>
                // <ul>
                //  <div></div>
                //  <div></div>
                // </ul>
                if (el.parent().length > 0 &&
                    el.parent().get(0).tagName == 'UL' &&
                    el.parent().children().length > 1) {
                    lis.push(el);
                    break;
                }
                // 主页、作品页的翻页列表
                if (el.parent().parent().length > 0 && el.parent().parent().get(0).tagName == 'NAV') {
                    lis.push(el);
                    break;
                }
                // 推荐用户列表
                if (el.get(0).tagName == 'DIV' && el.attr('type') == 'illust') {
                    lis.push(el);
                    break;
                }
            }
        }
    });
    return lis;
}

// Replaces deleted artwork indicators with search engine links.
function showSearchLinksForDeletedArtworks() {
    // Array of search engines.
    const searchEngines = [
        { name: 'Google', url: 'https://www.google.com/search?q=' },
        { name: 'Bing', url: 'https://www.bing.com/search?q=' },
        { name: 'Baidu', url: 'https://www.baidu.com/s?wd=' }
    ];
    // Find all <span> elements with a "to" attribute.
    const spans = document.querySelectorAll('span[to]');
    spans.forEach(span => {
        const artworkPath = span.getAttribute('to');
        // Check if the span indicates that it is a deleted artwork
        if (span.textContent.trim() === "-----" && artworkPath.startsWith("/artworks/")) {
            // Extract ID from artworkPath by slicing off "/artworks/".
            const keyword = `pixiv "${artworkPath.slice(10)}"`
            // Create a container element to hold the links.
            const container = document.createElement('span');
            container.className = span.className;
            // For each search engine, create an <a> element and append it to the container.
            searchEngines.forEach((engine, i) => {
                const link = document.createElement("a");
                link.href = engine.url + encodeURIComponent(keyword);
                link.textContent = engine.name; // Display the search engine's name.
                link.target = "_blank"; // Open in a new tab.
                container.appendChild(link);
                // Append a separator between links, except after the last one.
                if (i < searchEngines.length - 1) {
                    container.appendChild(document.createTextNode(' | '));
                }
            });
            // Replace the original <span> with the container holding the links.
            span.parentNode.replaceChild(container, span);
        }
    });
}

Pages[PageType.Search] = {
    PageTypeString: 'SearchPage',
    CheckUrl: function (url) {
        return /^https?:\/\/www\.pixiv\.net\/(en\/)?search\?.*type=(artwork|manga|illust_ugoira)/.test(url) ||
            /^https?:\/\/www\.pixiv\.net\/(en\/)?tags\/.*\/(artworks|illustrations|manga)/.test(url);
    },
    ProcessPageElements: function () {
        let returnMap = {
            loadingComplete: false,
            controlElements: [],
        };

        let sections = $('section');
        iLog.d('Page has ' + sections.length + ' <section>.');
        iLog.d(sections);

        let premiumSectionIndex = -1;
        let resultSectionIndex = 0;

        $.each(sections, (i, e) => {
            if ($(e).find('aside').length > 0) {
                premiumSectionIndex = i;
            } else {
                resultSectionIndex = i;
            }
        });

        iLog.v('premium: ' + premiumSectionIndex);
        iLog.v('result: ' + resultSectionIndex);

        if (premiumSectionIndex != -1) {
            let aside = $(sections[premiumSectionIndex]).find('aside');
            $.each(aside.children(), (i, e) => {
                if (e.tagName.toLowerCase() != 'ul') {
                    e.remove();
                } else {
                    $(e).css('-webkit-mask', '0');
                }
            });
            aside.next().remove();
        }

        // 兼容新版本
        let lis = [];
        if (sections.length == 0 || premiumSectionIndex == resultSectionIndex) {
            let imageContainer = $('div[data-ga4-label="works_content"]');
            lis = imageContainer.children('div:last').children('div').toArray();
            if (premiumSectionIndex != -1) {
                let lis2 = $(sections[premiumSectionIndex]).find('ul').find('li');
                lis = lis.concat(lis2.toArray());
            }
            this.private.pageSelector = imageContainer.next('nav').get(0);
            this.private.imageListContainer = imageContainer.children('div:last').get(0);
        } else {
            let ul = $(sections[resultSectionIndex]).find('ul');
            lis = ul.find('li').toArray();
            if (premiumSectionIndex != -1) {
                let lis2 = $(sections[premiumSectionIndex]).find('ul').find('li');
                lis = lis.concat(lis2.toArray());
            }
            this.private.pageSelector = ul.next().get(0);
            // fix: 除了“顶部”，“插画”、“漫画”的页选择器挪到了外面，兼容这种情况
            if (this.private.pageSelector == null) {
                this.private.pageSelector = ul.parent().next().get(0);
            }
            this.private.imageListContainer = ul.get(0);
        }

        processElementListCommon(lis);
        returnMap.controlElements = $('.pp-control');
        returnMap.loadingComplete = true;

        iLog.d('Process page elements complete.');
        iLog.d(returnMap);

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
        return this.private.imageListContainer;
    },
    GetFirstImageElement: function () {
        let li = $(this.private.imageListContainer).find('li');
        if (li.length > 0) {
            return li.get(0);
        }
        return $(this.private.imageListContainer).children('div:first').get(0);
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

        let sections = $('section');
        iLog.d('Page has ' + sections.length + ' <section>.');
        iLog.d(sections);

        let lis = sections.find('ul').find('li');
        processElementListCommon(lis);
        returnMap.controlElements = $('.pp-control');
        returnMap.loadingComplete = true;

        iLog.d('Process page elements complete.');
        iLog.d(returnMap);

        this.private.returnMap = returnMap;

        // 全尺寸缩略图
        if (g_settings.fullSizeThumb) {
            if (!this.private.returnMap.loadingComplete) {
                return;
            }
            replaceThumbCommon(this.private.returnMap.controlElements);
        }

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
            iLog.d('Found container div.');
            iLog.d(containerDiv);
        } else {
            iLog.e('Can not found container div.');
            return returnMap;
        }

        let lis = containerDiv.find('ul').children('li');
        processElementListCommon(lis);
        returnMap.controlElements = $('.pp-control');
        returnMap.loadingComplete = true;

        iLog.d('Process page elements complete.');
        iLog.d(returnMap);

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
Pages[PageType.Member] = {
    PageTypeString: 'MemberPage/MemberIllustPage/MemberBookMark',
    CheckUrl: function (url) {
        return /^https?:\/\/www.pixiv.net\/(en\/)?users\/\d+/.test(url)
    },
    ProcessPageElements: function () {
        showSearchLinksForDeletedArtworks();
        let returnMap = {
            loadingComplete: false,
            controlElements: [],
        };

        let lis = findLiByImgTag();
        iLog.d(lis);

        let sections = $('section');
        iLog.d('Page has ' + sections.length + ' <section>.');
        iLog.d(sections);

        processElementListCommon(lis);
        returnMap.controlElements = $('.pp-control');
        returnMap.loadingComplete = true;

        iLog.d('Process page elements complete.');
        iLog.d(returnMap);

        this.private.returnMap = returnMap;

        // 全尺寸缩略图
        if (g_settings.fullSizeThumb) {
            if (!this.private.returnMap.loadingComplete) {
                return;
            }
            replaceThumbCommon(this.private.returnMap.controlElements);
        }

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
            /https?:\/\/www.pixiv.net\/en\/?$/.test(url) ||
            /https?:\/\/www.pixiv.net\/illustration\/?$/.test(url) ||
            /https?:\/\/www.pixiv.net\/manga\/?$/.test(url) ||
            /https?:\/\/www.pixiv.net\/cate_r18\.php$/.test(url) ||
            /https?:\/\/www.pixiv.net\/en\/cate_r18\.php$/.test(url);
    },
    ProcessPageElements: function () {
        let returnMap = {
            loadingComplete: false,
            controlElements: [],
        };

        let lis = findLiByImgTag();

        processElementListCommon(lis);
        returnMap.controlElements = $('.pp-control');
        returnMap.loadingComplete = true;

        iLog.d('Process page elements complete.');
        iLog.d(returnMap);

        if (this.private.returnMap) {
            let oldIds = new Set();
            $.each(this.private.returnMap.controlElements, (i, e) => {
                oldIds.add($(e).attr('illustId'));
            });
            $.each(returnMap.controlElements, (i, e) => {
                if (!oldIds.has($(e).attr('illustId'))) {
                    returnMap.forceUpdate = true;
                    return false;
                }
            });
        }

        this.private.returnMap = returnMap;

        // 全尺寸缩略图
        if (g_settings.fullSizeThumb) {
            if (!this.private.returnMap.loadingComplete) {
                return;
            }
            replaceThumbCommon(this.private.returnMap.controlElements);
        }

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

        let lis = findLiByImgTag();

        processElementListCommon(lis, (e) => $(e.children().get(1)));
        returnMap.controlElements = $('.pp-control');
        returnMap.loadingComplete = true;

        iLog.d('Process page elements complete.');
        iLog.d(returnMap);

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

        let lis = findLiByImgTag();

        processElementListCommon(lis);
        returnMap.controlElements = $('.pp-control');
        returnMap.loadingComplete = true;

        iLog.d('Process page elements complete.');
        iLog.d(returnMap);

        this.private.returnMap = returnMap;

        // 全尺寸缩略图
        if (g_settings.fullSizeThumb) {
            if (!this.private.returnMap.loadingComplete) {
                return;
            }
            replaceThumbCommon(this.private.returnMap.controlElements);
        }

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
        iLog.d('Found images, length: ' + images.length);
        iLog.d(images);

        images.each(function (i, e) {
            let _this = $(e);

            let work = _this.find('._work');
            if (work.length === 0) {
                iLog.w('Can not found ._work, skip this.');
                return;
            }

            let ctlAttrs = {
                illustId: 0,
                illustType: 0,
                pageCount: 1,
            };

            let href = work.attr('href');
            if (href == null || href === '') {
                iLog.w('Can not found illust id, skip this.');
                return;
            }

            let matched = href.match(/artworks\/(\d+)/);
            if (matched) {
                ctlAttrs.illustId = matched[1];
            } else {
                iLog.w('Can not found illust id, skip this.');
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

        iLog.d('Process page elements complete.');
        iLog.d(returnMap);

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

        iLog.d('Found .work, length: ' + works.length);
        iLog.d(works);

        works.each(function (i, e) {
            let _this = $(e);

            let ctlAttrs = {
                illustId: 0,
                illustType: 0,
                pageCount: 1,
            };

            let href = _this.attr('href');

            if (href == null || href === '') {
                iLog.w('Can not found illust id, skip this.');
                return;
            }

            let matched = href.match(/illust_id=(\d+)/);
            if (matched) {
                ctlAttrs.illustId = matched[1];
            } else {
                iLog.w('Can not found illust id, skip this.');
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

        iLog.d('Process page elements complete.');
        iLog.d(returnMap);

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
            /^https:\/\/www.pixiv.net\/en\/artworks\/.*/.test(url)
    },
    ProcessPageElements: function () {
        let canvas = $('main').find('figure').find('canvas');
        if ($('main').find('figure').find('canvas').length > 0) {
            this.private.needProcess = true;
            canvas.addClass('pp-canvas');
        }

        let returnMap = {
            loadingComplete: false,
            controlElements: [],
        };

        let lis = findLiByImgTag();

        processElementListCommon(lis);
        returnMap.controlElements = $('.pp-control');
        returnMap.loadingComplete = true;

        iLog.d('Process page elements complete.');
        iLog.d(returnMap);

        this.private.returnMap = returnMap;

        // 全尺寸缩略图
        if (g_settings.fullSizeThumb) {
            if (!this.private.returnMap.loadingComplete) {
                return;
            }
            replaceThumbCommon(this.private.returnMap.controlElements);
        }

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
                iLog.i('offset of download button: ' + offset.offsetTop + ', ' + offset.offsetLeft);
                iLog.d(offset);

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
                    iLog.i('IllustId=' + illustId);
                } else {
                    iLog.e('Can not found illust id!');
                    return;
                }

                $.ajax(g_getUgoiraUrl.replace('#id#', illustId), {
                    method: 'GET',
                    success: function (json) {
                        iLog.d(json);

                        if (json.error == true) {
                            iLog.e('Server response an error: ' + json.message);
                            return;
                        }

                        // 因为浏览器会拦截不同域的 open 操作，绕一下
                        let newWindow = window.open('_blank');
                        newWindow.location = json.body.originalSrc;
                    },
                    error: function () {
                        iLog.e('Request zip file failed!');
                    }
                });
            });
        }

        if (this.private.needProcess) {
            let canvas = $('.pp-canvas');
            // 普通模式，只需要添加下载按钮到内嵌模式的 div 里
            let div = $('div[role="presentation"]:last');
            let button = div.find('button');

            let headerRealHeight = parseInt($('header').css('height')) +
                parseInt($('header').css('padding-top')) + parseInt($('header').css('padding-bottom')) +
                parseInt($('header').css('margin-top')) + parseInt($('header').css('margin-bottom')) +
                parseInt($('header').css('border-bottom-width')) + parseInt($('header').css('border-top-width'));

            AddDownloadButton(button, headerRealHeight);
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
        return /^https?:\/\/www\.pixiv\.net\/(en\/)?search\?.*type=novel/.test(url) ||
            /^https?:\/\/www\.pixiv\.net\/(en\/)?tags\/.*\/novels/.test(url);
    },
    ProcessPageElements: function () {
        let returnMap = {
            loadingComplete: false,
            controlElements: [],
        };
        let worksContent = $('[data-ga4-label="works_content"]');
        if (worksContent.length > 0) {
            returnMap.loadingComplete = true;
        } else {
            let ul = $('section:first').find('ul:first');
            if (ul.length > 0 && ul.children().length > 0) {
                returnMap.loadingComplete = true;
            }
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
    GetPageSelector: function () {
        let nav = $('[data-ga4-label="works_content"]').next('nav');
        if (nav.length > 0) return nav;
        return $('section:first').find('nav:first');
    },
    HasAutoLoad: false,
    private: {
        returnMap: null,
    },
}
Pages[PageType.SearchTop] = {
    PageTypeString: 'SearchTopPage',
    CheckUrl: function (url) {
        return /^https?:\/\/www.pixiv.net(\/en)?\/tags\/[^/*]/.test(url);
    },
    ProcessPageElements: function () {
        let returnMap = {
            loadingComplete: false,
            controlElements: [],
        };

        let sections = $('section');
        iLog.d('Page has ' + sections.length + ' <section>.');
        iLog.d(sections);

        let premiumSectionIndex = -1;
        let resultSectionIndex = 0;
        if (sections.length == 0) {
            iLog.e('No suitable <section>!');
            return returnMap;
        }

        if (sections.length > 1) {
            premiumSectionIndex = 0;
            resultSectionIndex = 1;
        }

        iLog.v('premium: ' + premiumSectionIndex);
        iLog.v('result: ' + resultSectionIndex);

        let ul = $(sections[resultSectionIndex]).find('ul');
        let lis = ul.find('li').toArray();
        if (premiumSectionIndex != -1) {
            let lis2 = $(sections[premiumSectionIndex]).find('ul').find('li');
            lis = lis.concat(lis2.toArray());
        }

        if (premiumSectionIndex != -1) {
            let aside = $(sections[premiumSectionIndex]).find('aside');
            $.each(aside.children(), (i, e) => {
                if (e.tagName.toLowerCase() != 'ul') {
                    e.remove();
                } else {
                    $(e).css('-webkit-mask', '0');
                }
            });
            aside.next().remove();
        }

        processElementListCommon(lis);
        returnMap.controlElements = $('.pp-control');
        this.private.pageSelector = ul.next().get(0);
        // fix: 除了“顶部”，“插画”、“漫画”的页选择器挪到了外面，兼容这种情况
        if (this.private.pageSelector == null) {
            this.private.pageSelector = ul.parent().next().get(0);
        }
        returnMap.loadingComplete = true;
        this.private.imageListConrainer = ul.get(0);

        iLog.d('Process page elements complete.');
        iLog.d(returnMap);

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
    HasAutoLoad: false,
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
        'https://www.pixiv.net/search?q=miku&type=novel',
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
/* ---------------------------------------- scroll_lock ---------------------------------------- */
function preventDefault(e) {
    e.preventDefault();
}

const wheelOpt = { passive: false };
const wheelEvent = 'onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel';

function disableScroll() {
    window.addEventListener(wheelEvent, preventDefault, wheelOpt);
}
function enableScroll() {
    window.removeEventListener(wheelEvent, preventDefault, wheelOpt);
}

/* ---------------------------------------- 配置 ---------------------------------------- */
function gmcBuildFrame() {
    iLog.d('gmcBuildFrame()');

    let div = $('<div id="gmc" class="hidden"></div>');
    let frame = $('<div id="gmc-frame"></div>');
    div.append(frame);
    $('body').append(div);

    gmcBuildStyle();

    return frame.get(0);
}
function gmcBuildStyle() {
    iLog.d('gmcBuildStyle()');

    const gmcFrameStyle = document.createElement('style');
    gmcFrameStyle.textContent += `
      /* Modal */

      #gmc
      {
        display: inline-flex !important;
        justify-content: center !important;
        align-items: center !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 9999;
        background: none !important;

        pointer-events: none;
      }

      #gmc.hidden
      {
        display: none !important;
      }

      #gmc-frame
      {
        font-family: -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji";
        text-align: left;

        inset: initial !important;
        border: none !important;
        max-height: initial !important;
        max-width: initial !important;
        opacity: 1 !important;
        position: static !important;
        z-index: initial !important;

        width: 85% !important;
        height: 75% !important;
        overflow-y: auto !important;

        border: none !important;
        border-radius: 0.375rem !important;

        pointer-events: auto;
      }

      #gmc-frame_wrapper
      {
        display: flow-root !important;
        padding: 2rem !important;
      }

      /* Sections */

      #gmc-frame #gmc-frame_section_0
      {
        width: 100%;
        border-radius: 6px;
        display: table;
      }

      #gmc-frame #gmc-frame_section_1,
      #gmc-frame #gmc-frame_section_2,
      #gmc-frame #gmc-frame_section_3,
      #gmc-frame #gmc-frame_section_4
      {
        margin-top: 2rem;
        width: 49%;
        box-sizing: border-box;
      }

      #gmc-frame #gmc-frame_section_1
      {
        border-radius: 6px;
        float: left;
      }

      #gmc-frame #gmc-frame_section_2
      {
        border-radius: 6px;
        float: right;
      }

      #gmc-frame #gmc-frame_section_3
      {
        width: 49%;
        margin-top: 2rem;
        box-sizing: border-box;
        border-radius: 6px;
        float: left;
      }

      #gmc-frame #gmc-frame_section_4
      {
        display: inline-grid;
        width: 49%;
        margin-top: 2rem;
        box-sizing: border-box;
        border-radius: 6px;
        float: right
      }

      #gmc-frame #gmc-frame_section_3 .config_var:not(:last-child),
      #gmc-frame #gmc-frame_section_4 .config_var:not(:last-child)
      {
        padding-bottom: 1rem;
      }

      /* Fields */

      #gmc-frame .config_header
      {
        font-size: 2em;
        font-weight: 400;
        line-height: 1.25;

        padding-bottom: 0.3em;
        margin-bottom: 16px;
      }

      #gmc-frame #gmc-frame_type_var
      {
        display: inline-flex;
      }

      #gmc-frame .section_header
      {
        font-size: 1.5em;
        font-weight: 600;
        line-height: 1.25;

        margin-bottom: 16px;
        padding: 1rem 1.5rem;
      }

      #gmc-frame .section_desc,
      #gmc-frame h3
      {
        background: none;
        border: none;
        font-size: 1.25em;

        margin-bottom: 16px;
        font-weight: 600;
        line-height: 1.25;
        text-align: left;
      }

      #gmc-frame .config_var
      {
        padding: 0rem 1.5rem;
        margin-bottom: 1rem;
        display: flex;
      }

      #gmc-frame .config_var[id*='flipCreateInbox_var'],
      #gmc-frame .config_var[id*='flipIssuesPullRequests_var']
      {
        display: flex;
      }

      #gmc-frame .field_label
      {
        font-weight: 600;
        margin-right: 0.5rem;
      }

      #gmc-frame .field_label,
      #gmc-frame .gmc-label
      {
        width: 15vw;
      }

      #gmc-frame .radio_label:not(:last-child)
      {
        margin-right: 4rem;
      }

      #gmc-frame .radio_label
      {
        line-height: 17px;
      }

      #gmc-frame .gmc-label
      {
        display: table-caption;
        line-height: 17px;
      }

      #gmc-frame input[type="radio"]
      {
        appearance: none;
        border-style: solid;
        cursor: pointer;
        height: 1rem;
        place-content: center;
        position: relative;
        width: 1rem;
        border-radius: 624rem;
        transition: background-color 0s ease 0s, border-color 80ms cubic-bezier(0.33, 1, 0.68, 1) 0s;
        margin-right: 0.5rem;
        flex: none;
      }

      #gmc-frame input[type="checkbox"]
      {
        appearance: none;
        border-style: solid;
        border-width: 1px;
        cursor: pointer;
        place-content: center;
        position: relative;
        height: 17px;
        width: 17px;
        border-radius: 3px;
        transition: background-color 0s ease 0s, border-color 80ms cubic-bezier(0.33, 1, 0.68, 1) 0s;
      }

      #gmc-frame #gmc-frame_field_type
      {
        display: flex;
      }

      #gmc-frame input[type="radio"]:checked
      {
        border-width: 0.25rem;
      }

      #gmc-frame input[type="radio"]:checked,
      #gmc-frame .gmc-checkbox:checked
      {
        border-color: #2f81f7;
      }

      #gmc-frame .gmc-checkbox:checked
      {
        background-color: #2f81f7;
      }

      #gmc-frame .gmc-checkbox:checked::before
      {
        visibility: visible;
        transition: visibility 0s linear 0s;
      }

      #gmc-frame .gmc-checkbox::before,
      #gmc-frame .gmc-checkbox:indeterminate::before
      {
        animation: 80ms cubic-bezier(0.65, 0, 0.35, 1) 80ms 1 normal forwards running checkmarkIn;
      }

      #gmc-frame .gmc-checkbox::before
      {
        width: 1rem;
        height: 1rem;
        visibility: hidden;
        content: "";
        background-color: #FFFFFF;
        clip-path: inset(0);
        -webkit-mask-image: url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOSIgdmlld0JveD0iMCAwIDEyIDkiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTEuNzgwMyAwLjIxOTYyNUMxMS45MjEgMC4zNjA0MjcgMTIgMC41NTEzMDUgMTIgMC43NTAzMTNDMTIgMC45NDkzMjEgMTEuOTIxIDEuMTQwMTkgMTEuNzgwMyAxLjI4MUw0LjUxODYgOC41NDA0MkM0LjM3Nzc1IDguNjgxIDQuMTg2ODIgOC43NiAzLjk4Nzc0IDguNzZDMy43ODg2NyA4Ljc2IDMuNTk3NzMgOC42ODEgMy40NTY4OSA4LjU0MDQyTDAuMjAxNjIyIDUuMjg2MkMwLjA2ODkyNzcgNS4xNDM4MyAtMC4wMDMzMDkwNSA0Ljk1NTU1IDAuMDAwMTE2NDkzIDQuNzYwOThDMC4wMDM1NTIwNSA0LjU2NjQzIDAuMDgyMzg5NCA0LjM4MDgxIDAuMjIwMDMyIDQuMjQzMjFDMC4zNTc2NjUgNC4xMDU2MiAwLjU0MzM1NSA0LjAyNjgxIDAuNzM3OTcgNC4wMjMzOEMwLjkzMjU4NCA0LjAxOTk0IDEuMTIwOTMgNC4wOTIxNyAxLjI2MzM0IDQuMjI0ODJMMy45ODc3NCA2Ljk0ODM1TDEwLjcxODYgMC4yMTk2MjVDMTAuODU5NSAwLjA3ODk5MjMgMTEuMDUwNCAwIDExLjI0OTUgMEMxMS40NDg1IDAgMTEuNjM5NSAwLjA3ODk5MjMgMTEuNzgwMyAwLjIxOTYyNVoiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=");
        -webkit-mask-size: 75%;
        -webkit-mask-repeat: no-repeat;
        -webkit-mask-position: center center;
        display: block;
      }

      #gmc-frame .gmc-checkbox
      {
        appearance: none;
        border-style: solid;
        border-width: 1px;
        cursor: pointer;

        height: var(--base-size-16,16px);
        margin: 0.125rem 0px 0px;
        place-content: center;
        position: relative;
        width: var(--base-size-16,16px);
        border-radius: 3px;
        transition: background-color 0s ease 0s, border-color 80ms cubic-bezier(0.33, 1, 0.68, 1) 0s;
      }

      #gmc-frame input
      {
        color: fieldtext;
        letter-spacing: normal;
        word-spacing: normal;
        text-transform: none;
        text-indent: 0px;
        text-shadow: none;
        display: inline-block;
        text-align: start;
        appearance: auto;
        -webkit-rtl-ordering: logical;
      }

      #gmc-frame .gmc-checkbox:checked
      {
        transition: background-color 0s ease 0s, border-color 80ms cubic-bezier(0.32, 0, 0.67, 0) 0ms;
      }

      #gmc-frame input[type="text"],
      #gmc-frame textarea,
      #gmc-frame select
      {
        padding: 5px 12px;
        border-radius: 6px;
      }

      #gmc-frame input[type="text"]:focus,
      #gmc-frame textarea:focus,
      #gmc-frame select:focus
      {
        border-color: #2f81f7;
        outline: 1px solid #2f81f7;
      }

      #gmc-frame svg
      {
        height: 17px;
        width: 17px;
        margin-left: 0.5rem;
      }

      #gmc small
      {
        font-size: x-small;
        font-weight: 600;
        margin-left: 3px;
      }

      /* Button bar */

      #gmc-frame #gmc-frame_buttons_holder
      {
        position: fixed;
        width: 85%;
        text-align: right;

        left: 50%;
        bottom: 2%;
        transform: translate(-50%, 0%);
        padding: 1rem;

        border-radius: 0.375rem;

        display: flex;
        align-items: center;
      }

      #gmc-frame #gmc-frame_buttons_holder .left-aligned
      {
        order: 1;
        margin-right: auto;
      }

      #gmc-frame #gmc-frame_buttons_holder > *
      {
        order: 2;
      }

      #gmc-frame .saveclose_buttons
      {
        margin-left: 0.5rem;
      }

      #gmc-frame [type=button],
      #gmc-frame .saveclose_buttons
      {
        position: relative;
        display: inline-block;
        padding: 5px 16px;
        font-size: 14px;
        font-weight: 500;
        line-height: 20px;
        white-space: nowrap;
        vertical-align: middle;
        cursor: pointer;
        -webkit-user-select: none;
        user-select: none;
        border: 1px solid;
        border-radius: 6px;
        -webkit-appearance: none;
        appearance: none;

        font-family: -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji";
      }

      @keyframes fadeOut
      {
        from {
          opacity: 1;
        }
        to {
          opacity: 0;
        }
      }

      #gmc-saved
      {
        display: none;
        margin-right: 10px;
        animation: fadeOut 0.75s ease 2s forwards;
      }

        #gmc-frame
        {
          background-color: #F6F8FA;
          color: #1F2328;
          box-shadow: 0 0 0 1px #D0D7DE, 0 16px 32px rgba(1,4,9,0.2) !important;
        }

        #gmc-frame .section_header_holder
        {
          background-color: #FFFFFF;
          border: 1px solid #D0D7DE;
        }

        #gmc-frame_buttons_holder
        {
          background-color: #FFFFFF;
          box-shadow: 0 0 0 1px #D0D7DE, 0 16px 32px rgba(1,4,9,0.2) !important;
        }

        #gmc-frame input[type="text"],
        #gmc-frame textarea,
        #gmc-frame select
        {
          border: 1px solid #D0D7DE;
        }

        #gmc-frame select
        {
          background-color: #F6F8FA;
        }

        #gmc-frame select:hover
        {
          background-color: #F3F4F6;
          border-color: #1F232826;
        }

        #gmc-frame input[type="text"],
        #gmc-frame textarea
        {
          background-color: #F6F8FA;
          color: #1F2328;
        }

        #gmc-frame input[type="text"]:focus,
        #gmc-frame textarea:focus
        {
          background-color: #FFFFFF;
        }

        #gmc-frame [type=button],
        #gmc-frame .saveclose_buttons
        {
          background-color: #f6f8fa;
          border-color: #1f232826;
          box-shadow: 0 1px 0 rgba(31,35,40,0.04), inset 0 1px 0 rgba(255,255,255,0.25);
          color: #24292f;
        }

        #gmc-frame [type=button]:hover,
        #gmc-frame .saveclose_buttons:hover
        {
          background-color: #f3f4f6;
          border-color: #1f232826;
        }

        #gmc-frame .gmc-checkbox
        {
          border-color: #6E7781;
        }

        #gmc-frame input[type="radio"]
        {
          color: #6E7781;
        }

        #gmc-frame svg
        {
          fill: #000000;
        }

        #gmc-frame .section_header
        {
          border-bottom: 1px solid #D0D7DE;
        }

        #gmc-frame #gmc-frame_section_3 .config_var:not(:last-child),
        #gmc-frame #gmc-frame_section_4 .config_var:not(:last-child)
        {
          border-bottom: 1px solid #D0D7DE;
        }

        #gmc-frame #gmc-frame_saveBtn
        {
          background-color: #1F883D;
          border-color: rgba(31, 35, 40, 0.15);
          box-shadow: rgba(31, 35, 40, 0.1) 0px 1px 0px;
          color: #FFFFFF;
        }

        #gmc-frame #gmc-frame_saveBtn:hover
        {
          background-color: rgb(26, 127, 55);
        }

        #gmc-frame #gmc-frame_section_4
        {
          border: 1px solid #FF818266;
        }

        #gmc-frame #gmc-frame_section_4 input
        {
          background-color: #F6F8FA;
          border-color: #1F232826;
          box-shadow: 0 1px 0 rgba(31,35,40,0.04), inset 0 1px 0 rgba(255,255,255,0.25);
          color: #CF222E;
        }

        #gmc-frame #gmc-frame_section_4 input:hover
        {
          background-color: #A40E26;
          border-color: #1F232826;
          box-shadow: 0 1px 0 rgba(31,35,40,0.04);
          color: #ffffff;
        }

        #gmc-saved
        {
          color: #1a7f37;
        }

        #gmc-saved svg path
        {
          fill: #1a7f37;
        }

        #gmc-frame .reset_holder {
          display: none;
        }

        #gmc-frame_hideByTagList_var {
            display: none !important;
        }
      `;
    document.head.appendChild(gmcFrameStyle);
}
function gmcInitialized() {
    iLog.d('gmcInitialized()');

    GMC.css.basic = '';

    UpdateLogLevel();
    StartLoad();
}
function gmcOpened() {
    iLog.d('gmcOpened()');

    $('#gmc').removeClass('hidden');
    $('#gmc-frame_saveBtn').text(Texts[g_language].setting_save);
    $('#gmc-frame_closeBtn').text(Texts[g_language].setting_close);

    function updateCheckboxes() {
        iLog.d('updateCheckboxes()');

        const checkboxes = $('#gmc-frame input[type="checkbox"]');

        if (checkboxes.length > 0) {
            checkboxes.addClass('gmc-checkbox');
        } else {
            setTimeout(updateCheckboxes, 100);
        }
    }

    updateCheckboxes();
}
function gmcSaved() {
    iLog.d('gmcSaved()');

    // lang
    let lang = GMC.get('lang');
    let settingsLang;
    if (lang == 'Auto') {
        settingsLang = Lang.auto;
    } else if (lang == '简体中文') {
        settingsLang = Lang.zh_CN;
    } else if (lang == 'English') {
        settingsLang = Lang.en_US;
    } else if (lang == 'Русский язык') {
        settingsLang = Lang.ru_RU;
    } else if (lang == '日本語') {
        settingsLang = Lang.ja_JP;
    }
    SetLocalStorage('PixivPreviewLang', settingsLang);

    location.href = location.href;
}
function gmcClosed() {
    iLog.d('gmcClosed()');
}
var GMC;
function gmcInit() {
    iLog.d('gmcInit()');

    GMC = new GM_config({
        id: 'gmc-frame',
        title: 'Pixiv Previewer',
        events: {
            init: gmcInitialized,
            open: gmcOpened,
            save: gmcSaved,
            close: gmcClosed,
        },
        frame: gmcBuildFrame(),
        fields: {
            lang: {
                label: Texts[g_language].setting_language,
                section: [
                    Texts[g_language].setting_settingSection,
                ],
                type: 'select',
                options: [
                    'Auto',
                    '简体中文',
                    'English',
                    'Русский язык',
                    '日本語',
                ],
                default: 'Auto',
            },
            fullSizeThumb: {
                label: Texts[g_language].sort_fullSizeThumb,
                type: 'checkbox',
                default: false,
            },
            linkBlank: {
                label: Texts[g_language].setting_blank,
                type: 'checkbox',
                default: true,
            },
            enableAnimeDownload: {
                label: Texts[g_language].setting_anime,
                type: 'checkbox',
                default: true,
            },
            logLevel: {
                label: Texts[g_language].setting_logLevel,
                type: 'select',
                options: [
                    'error',
                    'warning',
                    'info',
                    'debug',
                ],
                default: 'info',
            },
            clearSettings: {
                label: Texts[g_language].setting_reset,
                type: 'button',
                click: () => {
                    if (confirm(Texts[g_language].setting_resetHint)) {
                        return;
                    }
                    SetLocalStorage('gmc-frame', '');
                    location.href = location.href;
                },
            },
            clearFollowedUserCache: {
                label: Texts[g_language].setting_clearFollowingCache,
                type: 'button',
                click: () => {
                    let user_id = dataLayer[0].user_id;
                    SetLocalStorage('followingOfUid-' + user_id, null, -1);
                },
            },

            enablePreview: {
                label: Texts[g_language].setting_preview,
                section: [
                    Texts[g_language].setting_preview,
                ],
                type: 'checkbox',
                default: true,
            },
            enableAnimePreview: {
                label: Texts[g_language].setting_animePreview,
                type: 'checkbox',
                default: true,
            },
            original: {
                label: Texts[g_language].setting_origin,
                type: 'checkbox',
                default: false,
            },
            previewDelay: {
                label: Texts[g_language].setting_previewDelay,
                type: 'text',
                default: 200,
            },
            previewByKey: {
                label: Texts[g_language].setting_previewByKey,
                type: 'checkbox',
                default: false,
            },
            previewFullScreen: {
                label: Texts[g_language].setting_previewFullScreen,
                type: 'checkbox',
                default: false,
            },
            scrollLockWhenPreview: {
                label: Texts[g_language].setting_scrollLockWhenPreview,
                type: 'checkbox',
                default: true,
            },

            enableSort: {
                label: Texts[g_language].setting_sort,
                section: [
                    Texts[g_language].setting_sortSection,
                ],
                type: 'checkbox',
                default: true,
            },
            pageCount: {
                label: Texts[g_language].setting_maxPage,
                type: 'text',
                default: 3,
            },
            favFilter: {
                label: Texts[g_language].setting_hideWork,
                type: "text",
                default: 0,
            },
            aiFilter: {
                label: Texts[g_language].setting_hideAiWork,
                type: "checkbox",
                default: false,
            },
            aiOnly: {
                label: Texts[g_language].setting_onlyAiWork,
                type: "checkbox",
                default: false,
            },
            hideFavorite: {
                label: Texts[g_language].setting_hideFav,
                type: "checkbox",
                default: false,
            },
            hideFollowed: {
                label: Texts[g_language].setting_hideFollowed,
                type: "checkbox",
                default: false,
            },
            hideByTag: {
                label: Texts[g_language].setting_hideByTag,
                type: "checkbox",
                default: false,
            },
            hideByTagList: {
                label: Texts[g_language].setting_hideByTagPlaceholder,
                type: "hidden",
                default: "",
            },
            hideByTagRegex: {
                label: Texts[g_language].setting_hideByTagPlaceholder,
                type: "text",
                default: "",
            },
            hideByUser: {
                label: Texts[g_language].setting_hideByUser,
                type: "checkbox",
                default: false,
            },
            hideByUserList: {
                label: Texts[g_language].setting_hideByUserPlaceholder,
                type: "text",
                default: "",
            },
            hideCountLessThan: {
                label: Texts[g_language].setting_hideByCountLessThan,
                type: "text",
                default: 0,
            },
            hideCountMoreThan: {
                label: Texts[g_language].setting_hideByCountMoreThan,
                type: "text",
                default: 0,
            },
            pageByKey: {
                label: Texts[g_language].setting_turnPage,
                type: 'checkbox',
                default: false,
            },
            maxXhr: {
                label: Texts[g_language].setting_maxXhr,
                type: 'text',
                default: 64,
            },

            enableNovelSort: {
                label: Texts[g_language].setting_novelSort,
                section: [
                    Texts[g_language].setting_novelSection,
                ],
                type: 'checkbox',
                default: true,
            },
            novelPageCount: {
                label: Texts[g_language].setting_novelMaxPage,
                type: 'text',
                default: 3,
            },
            novelFavFilter: {
                label: Texts[g_language].setting_novelHideWork,
                type: "text",
                default: 0,
            },
            novelHideFavorite: {
                label: Texts[g_language].setting_novelHideFav,
                type: "checkbox",
                default: false,
            },
        },
    });
}

/* ---------------------------------------- 预览 ---------------------------------------- */
let autoLoadInterval = null;
function PixivPreview() {
    // 最终需要显示的预览图ID，用于避免鼠标滑过多张图片时，最终显示的图片错误
    let previewTargetIllustId = '';

    function createPlayer(opts) {
        var canvas = document.createElement('canvas');
        var options = {
            canvas: canvas,
            chunkSize: 300000,
            loop: true,
            autoStart: true,
            debug: false,
        }
        if (opts) {
            for (var name in opts) {
                options[name] = opts[name];
            }
        }
        var p = new ZipImagePlayer(options);
        p.canvas = canvas;
        return p;
    }

    // 开启预览功能
    function ActivePreview() {
        let returnMap = Pages[g_pageType].GetProcessedPageElements();
        if (!returnMap.loadingComplete) {
            iLog.e('Page not load, should not call Preview!');
            return;
        }

        function togglePreviewDiv() {
            let div = $('.pp-main');
            if (div.length == 0) {
                return;
            }
            if (div.css('display') == 'none') {
                iLog.d('Show main.');
                AdjustDivPosition();
                div.show();
                if (g_settings.previewFullScreen) {
                    disableScroll();
                }
            } else {
                iLog.d('Hide main.');
                div.hide();
                if (g_settings.previewFullScreen) {
                    enableScroll();
                }
            }
        }
        function showPreviewDiv() {
            let div = $('.pp-main');
            if (div.length == 0) {
                return;
            }
            if (div.css('display') == 'none') {
                iLog.d('Show main.');
                AdjustDivPosition();
                div.show();
                if (g_settings.scrollLockWhenPreview) {
                    disableScroll();
                }
            }
        }

        if (g_settings.previewByKey) {
            $(document).unbind('keydown');
            $(document).keydown((e) => {
                if (e.keyCode != g_settings.previewKey) {
                    return;
                }
                togglePreviewDiv();
            });
        }

        // 鼠标进入
        $(returnMap.controlElements).mouseenter(function (e) {
            // 按住 Ctrl键 不显示预览图
            if (e.ctrlKey) {
                return;
            }

            let startTime = new Date().getTime();
            let delay = parseInt(g_settings.previewDelay);

            let _this = $(this);
            let illustId = _this.attr('illustId');
            let illustType = _this.attr('illustType');
            let pageCount = _this.attr('pageCount');

            if (illustId == null) {
                iLog.e('Can not found illustId in this element\'s attrbutes.');
                return;
            }
            if (illustType == null) {
                iLog.e('Can not found illustType in this element\'s attrbutes.');
                return;
            }
            if (pageCount == null) {
                iLog.e('Can not found pageCount in this element\'s attrbutes.');
                return;
            }
            previewTargetIllustId = illustId;

            if (illustType == 2 && !g_settings.enableAnimePreview) {
                iLog.d('Anime preview disabled.');
                return;
            }

            // 鼠标位置
            g_mousePos = { x: e.pageX, y: e.pageY };
            // 预览 Div
            let previewDiv = $(document.createElement('div')).addClass('pp-main').attr('illustId', illustId)
                .css({
                    'position': 'absolute', 'z-index': '999999', 'left': g_mousePos.x + 'px', 'top': g_mousePos.y + 'px',
                    'border-style': 'solid', 'border-color': '#6495ed', 'border-width': '2px', 'border-radius': '20px',
                    'width': '48px', 'height': '48px',
                    'background-image': 'url(https://pp-1252089172.cos.ap-chengdu.myqcloud.com/transparent.png)',
                    'display': 'none', 'text-align': 'center'
                });
            // 添加到 body
            $('.pp-main').remove();
            $('body').append(previewDiv);

            if (g_settings.previewFullScreen) {
                previewDiv.css({ 'background': '#ffffff80', 'position': 'fixed' });
                previewDiv.click((e) => {
                    if ($(e.target).hasClass('pp-image')) {
                        return;
                    }
                    togglePreviewDiv();
                });
            }

            if (!g_settings.previewByKey) {
                let waitTime = delay - (new Date().getTime() - startTime);
                if (waitTime > 0) {
                    setTimeout(showPreviewDiv, waitTime);
                } else {
                    showPreviewDiv();
                }
            }

            // 加载中图片
            let loadingImg = $(new Image()).addClass('pp-loading').attr('src', g_loadingImage).css({
                'position': 'absolute', 'border-radius': '20px', 'left': '0px', 'top': '0px'
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
                if (g_settings.previewFullScreen) {
                    return;
                }
                $(this).remove();
            });

            let url = '';
            if (true) {
                if (illustType == 2) {
                    url = g_getUgoiraUrl.replace('#id#', illustId);
                } else {
                    url = g_getArtworkUrl.replace('#id#', illustId);
                }

                // 获取图片链接
                $.ajax(url, {
                    method: 'GET',
                    success: function (json) {
                        iLog.d('Got artwork urls:');
                        iLog.d(json);

                        if (json.error === true) {
                            iLog.e('Server responsed an error: ' + json.message);
                            return;
                        }

                        // 已经不需要显示这个预览图了，直接丢弃
                        if (illustId != previewTargetIllustId) {
                            iLog.d('Drop this preview request.');
                            return;
                        }

                        if (illustType == 2) {
                            let regular = json.body.src;
                            let original = json.body.originalSrc;
                            let mime = json.body.mime_type;
                            let frames = json.body.frames;

                            iLog.d('Process urls complete.');
                            iLog.d(regular);
                            iLog.d(original);

                            ViewUgoira(regular, original, mime, frames, g_settings.original, illustId);
                        } else {
                            let regular = [];
                            let original = [];
                            for (let i = 0; i < json.body.length; i++) {
                                regular.push(json.body[i].urls.regular);
                                original.push(json.body[i].urls.original);
                            }

                            iLog.d('Process urls complete.');
                            iLog.d(regular);
                            iLog.d(original);

                            ViewImages(regular, 0, original, g_settings.original, illustId);
                        }
                    },
                    error: function (data) {
                        iLog.e('Request image urls failed!');
                        if (data) {
                            iLog.d(data);
                        }
                    }
                });
            }
        });

        // 鼠标移出图片
        $(returnMap.controlElements).mouseleave(function (e) {
            if (g_settings.previewByKey) {
                return;
            }

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
                if (g_settings.scrollLockWhenPreview) {
                    enableScroll();
                }
            }
        });

        // 鼠标移动，调整位置
        $(returnMap.controlElements).mousemove(function (e) {
            // Ctrl 和 中键 都可以禁止预览图移动，这样就可以单手操作了
            if (e.ctrlKey || e.buttons & 4) {
                return;
            }
            g_mousePos.x = e.pageX; g_mousePos.y = e.pageY;

            // 启用按键开启关闭预览功能时，不跟随鼠标移动
            if (!(g_settings.previewByKey && $('.pp-main').css('display') != 'none')) {
                AdjustDivPosition();
            }
        });

        // 只有页面不滚动的时候才能支持
        if (g_settings.scrollLockWhenPreview) {
            $(returnMap.controlElements).bind('onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel', function (ev) {
                $('.pp-image').trigger(ev);
            });
        }

        // 这个页面有自动加载
        if (Pages[g_pageType].HasAutoLoad && autoLoadInterval == null) {
            autoLoadInterval = setInterval(ProcessAutoLoad, 1000);
            iLog.d('Auto load interval set.');
        }

        // 插一段回调函数
        unsafeWindow.PreviewCallback = PreviewCallback;
        iLog.d('Callback function was inserted.');
        iLog.d(unsafeWindow.PreviewCallback);

        iLog.i('Preview enable succeed!');
    }

    // 关闭预览功能，不是给外部用的
    function DeactivePreview() {
        let returnMap = Pages[g_pageType].GetProcessedPageElements();
        if (!returnMap.loadingComplete) {
            iLog.e('Page not load, should not call Preview!');
            return;
        }

        // 只需要取消绑定事件， attrs 以及回调都不需要删除
        $(returnMap.controlElements).unbind('mouseenter').unbind('mouseleave').unbind('mousemove');

        if (autoLoadInterval) {
            clearInterval(autoLoadInterval);
            autoLoadInterval = null;
        }

        iLog.i('Preview disable succeed!');
    }

    // iframe 的回调函数
    function PreviewCallback(canvasWidth, canvasHeight) {
        iLog.d('iframe callback, width: ' + canvasWidth + ', height: ' + canvasHeight);

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
        let ugoira = $('.pp-main').find('canvas').length > 0;
        if (ugoira) {
            width = $('.pp-image').get(0) == null ? 0 : $('.pp-image').get(0).width;
            height = $('.pp-image').get(0) == null ? 0 : $('.pp-image').get(0).height;
        } else {
            $('.pp-image').css({ 'width': '', 'height': '' });
            width = $('.pp-image').get(0) == null ? 0 : $('.pp-image').get(0).width;
            height = $('.pp-image').get(0) == null ? 0 : $('.pp-image').get(0).height;
        }

        let newWidth = 48, newHeight = 48;
        if (g_settings.previewFullScreen) {
            newWidth = screenWidth;
            newHeight = height / width * newWidth;
            if (newHeight > screenHeight) {
                newHeight = screenHeight;
                newWidth = newHeight / height * width;
            }
            newHeight -= 5;
            newWidth -= 5;
            $('.pp-image').css({ 'height': newHeight + 'px', 'width': newWidth + 'px' });
            $('.pp-main').css({ 'left': '0px', 'top': '0px', 'width': screenWidth - 5, 'height': screenHeight - 5 });

            // 返回新的宽高
            return {
                width: newWidth,
                height: newHeight,
            };
        }

        let isShowOnLeft = g_mousePos.x > screenWidth / 2;
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
            iLog.e('Regular url array is null, can not view images!');
            return;
        }
        if (index == null || index < 0 || index >= regular.length) {
            iLog.e('Index(' + index + ') out of range, can not view images!');
            return;
        }
        if (original == null || original.length === 0) {
            iLog.w('Original array is null, replace it with regular array.');
            original = regular;
        }
        if (original.length < regular) {
            iLog.w('Original array\'s length is less than regular array, replace it with regular array.');
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
        g_settings.original = isShowOriginal;

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

            // mousewheel event，和上面一樣
            $('.pp-image').bind('onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel', function (ev) {
                let _this = $(this);
                let isOriginal = _this.hasClass('original');
                let index = _this.attr('index');
                if (index == null) {
                    index = 0;
                } else {
                    index = parseInt(index);
                }

                if (regular.length == 1) {
                    return false;
                }
                // 如果是多图，点击切换下一张
                if (ev.originalEvent.wheelDelta < 0) {
                    if (++index >= regular.length) {
                        index = 0;
                    }
                } else {
                    if (--index < 0) {
                        index = regular.length - 1;
                    }
                }
                ViewImages(regular, index, original, isOriginal, illustId);
                // 预加载
                for (let i = index + 1; i < regular.length && i <= index + 3; i++) {
                    let image = new Image();
                    image.src = isOriginal ? original[i] : regular[i];;
                }
                return false;
            });
            if (g_settings.previewFullScreen) {
                $('.pp-main').bind('onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel', function (ev) {
                    $('.pp-image').trigger(ev);
                });
            }

            //  scrollLock
            if (!g_settings.scrollLockWhenPreview) {
                $('.pp-image').mouseenter(disableScroll);
            }
            $(".pp-image").mouseleave(function () {
                enableScroll();
            });

            // 图片预加载完成
            $('.pp-image').on('load', function () {
                // 显示图片前也判断一下是不是目标图片
                if (displayTargetIllustId != previewTargetIllustId) {
                    iLog.i('(2)Drop this preview request.');
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
                iLog.e('Load image failed!');
            });
        }

        $('.pp-image').attr('src', isShowOriginal ? original[index] : regular[index]).attr('index', index);
    }
    // 显示动图
    var g_ugoriaPlayer;
    function ViewUgoira(regular, original, mime, frames, isShowOriginal, illustId) {
        displayTargetIllustId = illustId;
        if (isShowOriginal == null) {
            isShowOriginal = false;
        }

        g_settings.original = isShowOriginal;

        if (!g_settings.previewFullScreen) {
            $(".pp-image").mouseenter(function () {
                disableScroll()
            }).mouseleave(function () {
                enableScroll()
            });
        }

        if (g_ugoriaPlayer) {
            g_ugoriaPlayer.stop();
        }
        g_ugoriaPlayer = createPlayer({
            source: regular,
            metadata: {
                mime_type: mime,
                frames: frames,
            },
        });
        // scrollLock
        $(g_ugoriaPlayer.canvas).mouseenter(function () {
            disableScroll();
        }).mouseleave(function () {
            enableScroll();
        });
        $(g_ugoriaPlayer).on("frameLoaded", function (ev, frame) {
            if (displayTargetIllustId != previewTargetIllustId) {
                return;
            }
            if (frame != 0) {
                return;
            }
            let img = $('.pp-image');
            img.after(g_ugoriaPlayer.canvas);
            img.remove();
            let canvas = $(g_ugoriaPlayer.canvas);
            canvas.addClass('pp-image');
            $('.pp-loading').css('display', 'none');
            let w = ev.currentTarget._frameImages[0].width;
            let h = ev.currentTarget._frameImages[0].height;
            canvas.attr({ 'width': w, 'height': h }).css({ 'border-radius': '20px' });
            canvas.attr({ 'originWidth': w, 'originHeight': h });
            AdjustDivPosition();
        });
    }

    // 处理自动加载
    function ProcessAutoLoad() {
        if (Pages[g_pageType].GetProcessedPageElements() == null) {
            iLog.e('Call ProcessPageElements first!');
            return;
        }

        let oldReturnMap = Pages[g_pageType].GetProcessedPageElements();
        let newReturnMap = Pages[g_pageType].ProcessPageElements();

        if (newReturnMap.loadingComplete) {
            if (oldReturnMap.controlElements.length != newReturnMap.controlElements.length || newReturnMap.forceUpdate) {
                iLog.i('Page loaded ' + (newReturnMap.controlElements.length - oldReturnMap.controlElements.length) + ' new work(s).');

                SetTargetBlank(newReturnMap);
                DeactivePreview();
                ActivePreview();

                return;
            } else if (oldReturnMap.controlElements.length > newReturnMap.controlElements.length) {
                iLog.w('works become less?');

                Pages[g_pageType].private.returnMap = oldReturnMap;

                return;
            }
        }

        iLog.d('Page not change.');
    }

    // 开启预览
    ActivePreview();
}
/* ---------------------------------------- 排序 ---------------------------------------- */
let imageElementTemplate = null;
function PixivSK(callback) {
    // 不合理的设定
    if (g_settings.pageCount < 1 || g_settings.favFilter < 0) {
        g_settings.pageCount = 3;
        g_settings.favFilter = 0;
    }
    // 当前已经取得的页面数量
    let currentGettingPageCount = 0;
    // 当前加载的页面 URL
    let currentUrl = 'https://www.pixiv.net/ajax/search/';
    let currentSearchWord = '';
    let currentApiType = 'artworks';
    let useLegacyArtworkUrlRule = false;
    // 当前加载的是第几张页面
    let currentPage = 0;
    // 获取到的作品
    let works = [];
    // 作品数量
    let worksCount = 0;

    // 仅搜索页启用
    if (g_pageType != PageType.Search) {
        return;
    }

    // 获取第 currentPage 页的作品
    // 这个方法还是用带 cookie 的请求，防止未登录拉不到数据
    function getArtworkAjaxUrl(word, page, apiType, useLegacyUrlRule) {
        let pageParams = new URLSearchParams(location.search);
        let apiParams = new URLSearchParams();
        let sMode = pageParams.get('s_mode') || 's_tag_full';
        let sModeMap = {
            'tag_full': 's_tag_full',
            's_tag_full': 's_tag_full',
            'tag_tc': 's_tag_tc',
            's_tag_tc': 's_tag_tc',
            'tag': 's_tag',
            's_tag': 's_tag',
            'tag_only': 's_tag_only',
            's_tag_only': 's_tag_only',
            'content': 's_tc',
            's_tc': 's_tc'
        };
        sMode = sModeMap[sMode] || 's_tag_full';

        apiParams.set('order', pageParams.get('order') || 'date_d');
        apiParams.set('mode', pageParams.get('mode') || 'all');
        apiParams.set('p', page);
        apiParams.set('ai_type', pageParams.get('ai_type') || '0');
        apiParams.set('csw', pageParams.get('csw') || '0');
        apiParams.set('s_mode', sMode);
        let pageLang = pageParams.get('lang');
        if (!pageLang) {
            pageLang = $('html').attr('lang');
            if (pageLang && pageLang.indexOf('-') != -1) {
                pageLang = pageLang.split('-')[0];
            }
        }
        apiParams.set('lang', pageLang || 'zh');

        if (apiType == 'illustrations') {
            let pageType = pageParams.get('type');
            let illustrationTypeMap = {
                'illust_ugoira': 'illust_and_ugoira',
                'illustrations': 'illust_and_ugoira',
                'illust': 'illust',
                'ugoira': 'ugoira'
            };
            if (pageType && illustrationTypeMap[pageType]) {
                apiParams.set('type', illustrationTypeMap[pageType]);
            }
        }

        ['scd', 'ecd', 'blt', 'bgt', 'wlt', 'wgt', 'hlt', 'hgt', 'tool', 'work_lang']
            .forEach(function (param) {
                let value = pageParams.get(param);
                if (value != null && value !== '') {
                    apiParams.set(param, value);
                }
            });
        if (pageParams.has('ratio')) {
            apiParams.set('ratio', pageParams.get('ratio') || '');
        }

        let passthroughIgnore = ['q', 'type', 'word', 'p', 'order', 'mode', 'ai_type', 'csw', 's_mode', 'lang', 'scd', 'ecd', 'blt', 'bgt', 'wlt', 'wgt', 'hlt', 'hgt', 'ratio', 'tool', 'work_lang'];
        pageParams.forEach(function (value, param) {
            if (passthroughIgnore.includes(param)) {
                return;
            }
            apiParams.set(param, value);
        });

        return location.origin + '/ajax/search/' + apiType + '/' + encodeURIComponent(word) + '?word=' + encodeURIComponent(word) + '&' + apiParams.toString();
    }

    let getWorks = function (onloadCallback) {
        $('#progress').text(Texts[g_language].sort_getWorks.replace('%1', currentGettingPageCount + 1).replace('%2', g_settings.pageCount));
        let url = getArtworkAjaxUrl(currentSearchWord, currentPage, currentApiType, useLegacyArtworkUrlRule);

        iLog.i('getWorks url: ' + url);

        let req = new XMLHttpRequest();
        req.open('GET', url, true);
        req.onload = function (event) {
            onloadCallback(req);
        };
        req.onerror = function (event) {
            iLog.e('Request search page error!');
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
                        iLog.e('Following response contains an error.');
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
                    iLog.e('Request following failed.');
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
                iLog.e('Get user id failed.');
                resolve([]);
                return;
            }

            // show/hide
            $('#progress').text(Texts[g_language].sort_getPublicFollowing);

            let following = GetLocalStorage('followingOfUid-' + user_id);
            if (following != null && following != 'null') {
                resolve(JSON.parse(following));
                return;
            }

            getFollowingOfType(user_id, 'show').then(function (members) {
                $('#progress').text(Texts[g_language].sort_getPrivateFollowing);
                getFollowingOfType(user_id, 'hide').then(function (members2) {
                    let following = members.concat(members2);
                    SetLocalStorage('followingOfUid-' + user_id, following);
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
                return;
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

                iLog.i(hideWorkCount + ' works were hide by followed user.');
                iLog.d(works);
                resolve();
            });
        });
    };

    // 排序和筛选
    // sortType: 0：收藏（喜欢）；1：点赞；2：查看
    let filterAndSort = function (sortType = 0) {
        return new Promise(function (resolve, reject) {
            iLog.i('Start sort.');
            iLog.d(works);

            // 收藏量低于 FAV_FILTER 的作品不显示
            let text = Texts[g_language].sort_filtering.replace('%2', g_settings.favFilter);
            text = text.replace('%1', (g_settings.hideFavorite ? Texts[g_language].sort_filteringHideFavorite : ''));
            $('#progress').text(text); // 实际上这个太快完全看不到
            let tmp = [];
            let bookmarkFilteredCount = 0;
            let aiFilteredCount = 0;
            let tagFilteredCount = 0;
            let userFilteredCount = 0;
            let countFilteredCount = 0;
            $(works).each(function (i, work) {
                let bookmarkCount = work.bookmarkCount ? work.bookmarkCount : 0;
                if (bookmarkCount < g_settings.favFilter) {
                    bookmarkFilteredCount++;
                    return true;
                }
                if (g_settings.hideFavorite && work.bookmarkData) {
                    bookmarkFilteredCount++;
                    return true;
                }

                /* —— Apply AI artworks filter firstly, then check show AI artworks only flag —— */
                if (g_settings.aiFilter == 1 && work.aiType == 2) {
                    aiFilteredCount++;
                    return true;
                }
                if (g_settings.aiOnly && work.aiType != 2) {
                    return true;
                }

                if (g_settings.hideByTag) {
                    let regex = null;
                    try {
                        if (g_settings.hideByTagRegex && g_settings.hideByTagRegex.trim() !== '') {
                            regex = new RegExp(g_settings.hideByTagRegex);
                        }
                    } catch (e) {
                        iLog.w('Invalid hideByTagRegex: ' + g_settings.hideByTagRegex);
                    }
                    if (regex && regex.test(work.tags)) {
                        tagFilteredCount++;
                        return true;
                    }
                }
                if (g_settings.hideByUser) {
                    let users = null;
                    try {
                        users = g_settings.hideByUserList.split('|').map(function (item) {
                            return item.trim();
                        });
                    } catch (e) {
                        iLog.w('Invalid hideByUser: ' + g_settings.hideByUserList);
                    }
                    if (users && users.includes(work.userId)) {
                        userFilteredCount++;
                        return true;
                    }
                }
                if (g_settings.hideCountLessThan >= 0 &&
                    g_settings.hideCountMoreThan >= 0) {
                    let less = g_settings.hideCountLessThan;
                    let more = g_settings.hideCountMoreThan;
                    let pageCount = 1;
                    if (work.pageCount) {
                        pageCount = work.pageCount;
                    }
                    if (less > 0 && pageCount < less) {
                        countFilteredCount++;
                        return true;
                    }
                    if (more > 0 && pageCount > more) {
                        countFilteredCount++;
                        return true;
                    }
                }
                tmp.push(work);
            });
            iLog.i(bookmarkFilteredCount + ' works were hide by bookmark count.');
            iLog.i(aiFilteredCount + ' works were hide by AI type.');
            iLog.i(tagFilteredCount + ' works were hide by tag.');
            iLog.i(userFilteredCount + ' works were hide by user.');
            iLog.i(countFilteredCount + ' works were hide by page count.');
            works = tmp;

            filterByUser().then(function () {
                // 排序
                works.sort(function (a, b) {
                    let favA = 0;
                    let favB = 0;
                    if (sortType == 0) {
                        favA = a.bookmarkCount;
                        favB = b.bookmarkCount;
                    }
                    else if (sortType == 1) {
                        favA = a.likeCount;
                        favB = b.likeCount;
                    } else if (sortType == 2) {
                        favA = a.viewCount;
                        favB = b.viewCount;
                    }
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
                iLog.i('Sort complete.');
                iLog.d(works);
                resolve();
            });
        });
    };

    if (currentPage === 0) {
        let url = location.href;

        if (url.indexOf('&p=') == -1 && url.indexOf('?p=') == -1) {
            iLog.w('Can not found page in url.');
            if (url.indexOf('?') == -1) {
                url += '?p=1';
                iLog.d('Add "?p=1": ' + url);
            } else {
                url += '&p=1';
                iLog.d('Add "&p=1": ' + url);
            }
        }
        let searchWord = '';
        let apiType = 'artworks';
        let useLegacyUrlRule = false;
        let tagsMatch = location.pathname.match(/\/tags\/([^/]+)\/(artworks|illustrations|manga)/);
        if (tagsMatch) {
            searchWord = decodeURIComponent(tagsMatch[1]);
            apiType = tagsMatch[2];
        } else {
            let urlParams = new URLSearchParams(location.search);
            searchWord = urlParams.get('q') || '';
            let typeMap = {
                'artwork': 'artworks',
                'manga': 'manga',
                'illustrations': 'illustrations',
                'illust_ugoira': 'illustrations',
                'illust': 'illustrations',
                'ugoira': 'illustrations'
            };
            apiType = typeMap[urlParams.get('type')] || 'artworks';
        }
        if (!searchWord) {
            iLog.e('Can not found search key word!');
            return;
        }
        iLog.i('Search key word: ' + searchWord);

        // page
        let page = url.match(/p=(\d*)/)[1];
        currentPage = parseInt(page);
        iLog.i('Current page: ' + currentPage);

        currentSearchWord = searchWord;
        currentApiType = apiType;
        useLegacyArtworkUrlRule = false;
        currentUrl = getArtworkAjaxUrl(currentSearchWord, currentPage, currentApiType, useLegacyArtworkUrlRule);
        iLog.i('Current url: ' + currentUrl);
    } else {
        iLog.e('???');
    }

    let imageContainer = Pages[PageType.Search].GetImageListContainer();
    // loading
    $(imageContainer).hide().before('<div id="loading" style="width:100%;text-align:center;"><img src="' + g_loadingImage + '" /><p id="progress" style="text-align: center;font-size: large;font-weight: bold;padding-top: 10px;">0%</p></div>');

    // page
    if (true) {
        let pageSelectorDiv = Pages[PageType.Search].GetPageSelector();
        if (pageSelectorDiv == null) {
            iLog.e('Can not found page selector!');
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
            iLog.i('Previous page url: ' + prevPageUrl);
            iLog.i('Next page url: ' + nextPageUrl);
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
                        iLog.e('ajax error!');
                        return;
                    }
                } else {
                    iLog.e('Key "error" not found!');
                    return;
                }
            } catch (e) {
                iLog.e('A invalid json string!');
                iLog.i(req.responseText);
            }

            currentPage++;
            currentGettingPageCount++;

            // 后面已经没有作品了
            if (no_artworks_found) {
                iLog.w('No artworks found, ignore ' + (g_settings.pageCount - currentGettingPageCount) + ' pages.');
                currentPage += g_settings.pageCount - currentGettingPageCount;
                currentGettingPageCount = g_settings.pageCount;
            }
            // 设定数量的页面加载完成
            if (currentGettingPageCount == g_settings.pageCount) {
                iLog.i('Load complete, start to load bookmark count.');
                iLog.d(works);

                // 获取到的作品里面可能有广告，先删掉，否则后面一些处理需要做判断
                let tempWorks = [];
                let workIdsSet = new Set();
                for (let i = 0; i < works.length; i++) {
                    if (works[i].id && !workIdsSet.has(works[i].id)) {
                        tempWorks.push(works[i]);
                        workIdsSet.add(works[i].id);
                    } else {
                        iLog.w('ignore work: ' + works[i].id);
                    }
                }
                works = tempWorks;
                worksCount = works.length;
                iLog.i('Clear ad container complete.');
                iLog.d(works);

                // GetBookmarkCount(0);
                GetBookmarkCountUsingFetch(0);
            } else {
                getWorks(onloadCallback);
            }
        };

        getWorks(onloadCallback);
    }

    let completeCount = 0;
    let failCount = 0;
    let nextBatchIndex = 0;

    let GetBookmarkCountUsingFetch = function (index) {
        if (index >= works.length) {
            clearAndUpdateWorks();
            return;
        }
        let batchCount = works.length - index;
        if (batchCount > g_maxXhr) batchCount = g_maxXhr;
        nextBatchIndex = index + batchCount;
        let completed = 0;
        for (let i = 0; i < batchCount; i++) {
            let j = index + i;
            let illustId = works[j].id;
            let url = 'https://www.pixiv.net/ajax/illust/' + illustId;
            fetch(url, { credentials: 'omit' })
                .then(response => response.json())
                .then(json => {
                    if (json && !json.error) {
                        works[j].bookmarkCount = json.body.bookmarkCount;
                        works[j].likeCount = json.body.likeCount;
                        works[j].viewCount = json.body.viewCount;
                        iLog.d('IllustId: ' + works[j].id + ', bookmarkCount: ' + works[j].bookmarkCount);
                    } else {
                        iLog.e('Some error occured: ' + (json && json.message));
                        works[j].bookmarkCount = 0;
                    }
                })
                .catch(err => {
                    iLog.e('Fetch failed for illustId ' + illustId + ': ' + err);
                    works[j].bookmarkCount = 0;
                    ++failCount;
                })
                .finally(() => {
                    let text = Texts[g_language].sort_getBookmarkCount.replace('%1', ++completeCount).replace('%2', works.length);
                    if (failCount > 0) {
                        text += ' (' + failCount + ' failed)';
                    }
                    $('#loading').find('#progress').text(text);
                    if (++completed === batchCount) {
                        GetBookmarkCountUsingFetch(nextBatchIndex);
                    }
                });
        }
    }

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
    // sortType: 0：收藏（喜欢）；1：点赞；2：查看
    let clearAndUpdateWorks = function (sortType = 0) {
        filterAndSort(sortType).then(function () {
            let container = Pages[PageType.Search].GetImageListContainer();
            let firstImageElement = Pages[PageType.Search].GetFirstImageElement();
            // 排序兼容 PixivBatchDownloader
            $(firstImageElement).find('[data-mouseover]').removeAttr('data-mouseover');
            if (imageElementTemplate == null) {
                imageElementTemplate = firstImageElement.cloneNode(true);
                //imageElementTemplate = firstImageElement;

                // 清理模板
                // image
                let control = $(imageElementTemplate).find('.pp-control');
                if (control == null) {
                    iLog.w('Cannot found some elements!');
                    return;
                }
                let imageLink = control.find('a:first');
                let img = imageLink.find('img:first');
                let imageDiv = img.parent();
                let imageLinkDiv = imageLink.parent();
                let titleLinkParent = control.next();
                if (img == null || imageDiv == null || imageLink == null || imageLinkDiv == null || titleLinkParent == null) {
                    iLog.e('Can not found some elements!');
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
                let additionTagDiv = imageLink.children('div:last');

                let bookmarkCountDiv = additionTagDiv.clone();
                bookmarkCountDiv.css({ 'top': 'auto', 'bottom': '0px', 'width': '65%' });
                additionTagDiv.parent().append(bookmarkCountDiv);

                // 添加 class，方便后面修改内容
                img.addClass('ppImg');
                imageLink.addClass('ppImageLink');
                titleLink.addClass('ppTitleLink');
                authorLinkProfileImage.addClass('ppAuthorLinkProfileImage');
                authorLink.addClass('ppAuthorLink');
                authorName.addClass('ppAuthorName');
                authorImage.addClass('ppAuthorImage');
                bookmarkSvg.attr('class', bookmarkSvg.attr('class') + ' ppBookmarkSvg');
                additionTagDiv.addClass('ppAdditionTag');
                bookmarkCountDiv.addClass('ppBookmarkCount');

                img.attr('src', '');
                let animationTag = img.next();
                if (animationTag.length != 0 && animationTag.get(0).tagName == 'SVG') {
                    animationTag.remove();
                }
                additionTagDiv.empty();
                bookmarkCountDiv.empty();
                bookmarkSvg.find('path:first').css('fill', 'rgb(31, 31, 31)');
                bookmarkSvg.find('path:last').css('fill', 'rgb(255, 255, 255)');
                imageDiv.find('svg').remove();

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
                li.find('.ppAuthorImage').parent().attr('title', works[i].userName);
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
                let countHtml = '';
                if (sortType == 0) {
                    countHtml = '❤️' + works[i].bookmarkCount;
                } else if (sortType == 1) {
                    countHtml = '👍' + works[i].likeCount;
                } else if (sortType == 2) {
                    countHtml = '👀' + works[i].viewCount;
                }
                let bookmarkCountHTML = '<div style="margin-bottom: 6px; margin-left: 2px;"><div style="color: rgb(7, 95, 166);font-weight: bold;font-size: 13px;line-height: 1;padding: 3px 6px;border-radius: 3px;background: rgb(204, 236, 255);">' + countHtml + '</div></div>';
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
                    iLog.e('No g_csrfToken, failed to add bookmark!');
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
                    iLog.i('Add bookmark, illustId: ' + illustId);
                    $.ajax('/ajax/illusts/bookmarks/add', {
                        method: 'POST',
                        contentType: 'application/json;charset=utf-8',
                        headers: { 'x-csrf-token': g_csrfToken },
                        data: '{"illust_id":"' + illustId + '","restrict":' + restrict + ',"comment":"","tags":[]}',
                        success: function (data) {
                            iLog.d('addBookmark result: ');
                            iLog.d(data);
                            if (data.error) {
                                iLog.e('Server returned an error: ' + data.message);
                                return;
                            }
                            let bookmarkId = data.body.last_bookmark_id;
                            iLog.i('Add bookmark success, bookmarkId is ' + bookmarkId);
                            _this.attr('bookmarkId', bookmarkId);
                            _this.find('path').css('fill', 'rgb(255, 64, 96)');
                        }
                    });
                } else {
                    iLog.i('Delete bookmark, bookmarkId: ' + bookmarkId);
                    $.ajax('/rpc/index.php', {
                        method: 'POST',
                        headers: { 'x-csrf-token': g_csrfToken },
                        data: { "mode": "delete_illust_bookmark", "bookmark_id": bookmarkId },
                        success: function (data) {
                            iLog.d('delete bookmark result: ');
                            iLog.d(data);
                            if (data.error) {
                                iLog.e('Server returned an error: ' + data.message);
                                return;
                            }
                            iLog.i('Delete bookmark success.');
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
                                iLog.d('delete bookmark result: ');
                                iLog.d(data);

                                if (data.type == 'bookuser') {
                                    $('.ppa-follow').get(0).outerHTML = '<button type="button"class="ppa-follow"style=" padding: 9px 25px; line-height: 1; border: none; border-radius: 16px; font-weight: 700; background-color: #0096fa; color: #fff; cursor: pointer;"><span style="margin-right: 4px;"><svg viewBox="0 0 8 8"width="10"height="10"class=""style=" stroke: rgb(255, 255, 255); stroke-linecap: round; stroke-width: 2;"><line x1="1"y1="4"x2="7"y2="4"></line><line x1="4"y1="1"x2="4"y2="7"></line></svg></span>关注</button>';
                                }
                                else {
                                    iLog.e('Delete follow failed!');
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
                                iLog.d('addBookmark result: ');
                                iLog.d(data);
                                // success
                                if (data.length === 0) {
                                    $('.ppa-follow').get(0).outerHTML = '<button type="button" class="ppa-follow followed" data-click-action="click" data-click-label="follow" style="padding: 9px 25px;line-height: 1;border: none;border-radius: 16px;font-size: 14px;font-weight: 700;cursor: pointer;">关注中</button>';
                                } else {
                                    iLog.e('Follow failed!');
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
                $(container).show().get(0).outerHTML = '<div class=""style="display: flex;align-items: center;justify-content: center; height: 408px;flex-flow: column;"><div class=""style="margin-bottom: 12px;color: rgba(0, 0, 0, 0.16);"><svg viewBox="0 0 16 16"size="72"style="fill: currentcolor;height: 72px;vertical-align: middle;"><path d="M8.25739 9.1716C7.46696 9.69512 6.51908 10 5.5 10C2.73858 10 0.5 7.76142 0.5 5C0.5 2.23858 2.73858 0 5.5 0C8.26142 0 10.5 2.23858 10.5 5C10.5 6.01908 10.1951 6.96696 9.67161 7.75739L11.7071 9.79288C12.0976 10.1834 12.0976 10.8166 11.7071 11.2071C11.3166 11.5976 10.6834 11.5976 10.2929 11.2071L8.25739 9.1716ZM8.5 5C8.5 6.65685 7.15685 8 5.5 8C3.84315 8 2.5 6.65685 2.5 5C2.5 3.34315 3.84315 2 5.5 2C7.15685 2 8.5 3.34315 8.5 5Z"transform="translate(2.25 2.25)"fill-rule="evenodd"clip-rule="evenodd"></path></svg></div><span class="sc-LzMCO fLDUzU">'
                    + Texts[g_language].sort_noWork.replace('%1', worksCount) + '</span></div>';
            }

            // 恢复显示
            $('#loading').remove();
            $(container).show();

            if ($('#sortTypeButtons').length == 0) {
                let sortDiv = $('<div id="sortTypeButtons" class="mx-auto [width:calc(var(--columns)*80px+(var(--columns)-1)*24px)] box-border" style="display:flex; margin-bottom: 10px;"></div>');
                let bookmarkSortButton = $('<div style="cursor: pointer; box-sizing: border-box;text-decoration: none;display: flex;-webkit-box-align: center;align-items: center;border-radius: 4px;height: 40px;padding-right: 24px;padding-left: 24px;color: var(--charcoal-text5);background-color: rgb(131, 126, 200);">' + Texts[g_language].sort_sortByBookmark + '</div>');
                let likeSortButton = $('<div style="cursor: pointer; box-sizing: border-box;text-decoration: none;display: flex;-webkit-box-align: center;align-items: center;border-radius: 4px;height: 40px;padding-right: 24px;padding-left: 24px;color: var(--charcoal-text5);background-color: rgb(200, 126, 173); margin-left: 10px;">' + Texts[g_language].sort_sortByLike + '</div>');
                let viewSortButton = $('<div style="cursor: pointer; box-sizing: border-box;text-decoration: none;display: flex;-webkit-box-align: center;align-items: center;border-radius: 4px;height: 40px;padding-right: 24px;padding-left: 24px;color: var(--charcoal-text5);background-color: rgb(130, 200, 126); margin-left:10px">' + Texts[g_language].sort_sortByView + '</div>');
                bookmarkSortButton.click(() => clearAndUpdateWorks(0));
                likeSortButton.click(() => clearAndUpdateWorks(1));
                viewSortButton.click(() => clearAndUpdateWorks(2));
                sortDiv.append(bookmarkSortButton);
                sortDiv.append(likeSortButton);
                sortDiv.append(viewSortButton);
                $(container).before(sortDiv);
            }

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
        let worksContent = $('[data-ga4-label="works_content"]');
        if (worksContent.length > 0) {
            let cols = worksContent.find('[class*="col-span"]');
            if (cols.length > 0) {
                return cols.first().parent();
            }
        }
        let ul = $('section:first').find('ul:first');
        if (ul.length == 0) {
            iLog.e('Can not found novel list.');
            return null;
        }
        return ul;
    }

    function getSearchParamsWithoutPage() {
        return location.search.substr(1)
            .split('&')
            .filter(p => !/^(p|q|type|word)=/.test(p))
            .join('&');
    }

    function isLegacyNovelSearchPage() {
        if (/\/tags\/[^/]+\/novels/.test(location.pathname)) {
            return true;
        }
        return false;
    }

    function getNovelAjaxUrl(key, page, useLegacyUrlRule) {
        let pageParams = new URLSearchParams(location.search);
        let apiParams = new URLSearchParams();
        let sMode = pageParams.get('s_mode') || 's_tag_full';
        let sModeMap = {
            'tag_full': 's_tag_full',
            's_tag_full': 's_tag_full',
            'tag_tc': 's_tag',
            's_tag_tc': 's_tag',
            'tag': 's_tag',
            's_tag': 's_tag',
            'tag_only': 's_tag_only',
            's_tag_only': 's_tag_only',
            'content': 's_tc',
            's_tc': 's_tc'
        };
        sMode = sModeMap[sMode] || 's_tag_full';

        apiParams.set('order', pageParams.get('order') || 'date_d');
        apiParams.set('mode', pageParams.get('mode') || 'all');
        apiParams.set('p', page);
        apiParams.set('ai_type', pageParams.get('ai_type') || '0');
        apiParams.set('csw', pageParams.get('csw') || '0');
        apiParams.set('s_mode', sMode);
        apiParams.set('gs', pageParams.get('gs') || '0');
        let pageLang = pageParams.get('lang');
        if (!pageLang) {
            pageLang = $('html').attr('lang');
            if (pageLang && pageLang.indexOf('-') != -1) {
                pageLang = pageLang.split('-')[0];
            }
        }
        apiParams.set('lang', pageLang || 'zh');

        ['scd', 'ecd', 'blt', 'bgt', 'tlt', 'tgt', 'wlt', 'wgt', 'rlt', 'rgt', 'original_only', 'genre', 'work_lang', 'replaceable_only']
            .forEach(function (param) {
                let value = pageParams.get(param);
                if (value != null && value !== '') {
                    apiParams.set(param, value);
                }
            });

        let passthroughIgnore = ['q', 'type', 'word', 'p', 'order', 'mode', 'ai_type', 'csw', 's_mode', 'gs', 'lang'];
        pageParams.forEach(function (value, param) {
            if (passthroughIgnore.includes(param)) {
                return;
            }
            apiParams.set(param, value);
        });

        return location.origin + '/ajax/search/novels/' + encodeURIComponent(key) + '?' + apiParams.toString();
    }

    function getNovelTemplate(ul) {
        if (!ul) {
            return null;
        }
        if (ul.length == 0 || ul.children().length == 0) {
            iLog.e('Empty list, can not create template.');
            return null;
        }
        let template = ul.children().eq(0).clone(true);
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
        titleDiv.children().eq(1).children().eq(0).addClass('pns-title').addClass('pns-link');
        detailDiv.find('.gtm-novel-searchpage-result-user:first').addClass('pns-author-img');
        detailDiv.find('.gtm-novel-searchpage-result-user:last').addClass('pns-author');
        let tagDiv = detailDiv.children().eq(2).children().eq(0);
        let bookmarkDiv = tagDiv.children().eq(2);
        bookmarkDiv.find('span:first').addClass('pns-text-count');
        if (bookmarkDiv.find('span').length < 3) {
            let lastSpan = bookmarkDiv.find('span:last');
            let newSpan = $('<span class="sc-a2e4344e-0 jYWqxI"><span><div class="sc-a2e4344e-1 qwlUc"><span class="sc-64133715-0 jVVkEz"><svg viewBox="0 0 12 12" size="12" class="sc-64133715-1 iNnScV"><path fill-rule="evenodd" clip-rule="evenodd" d="M9 0.75C10.6569 0.75 12 2.09315 12 3.75C12 7.71703 7.33709 10.7126 6.23256 11.3666C6.08717 11.4526 5.91283 11.4526 5.76744  11.3666C4.6629 10.7126 0 7.71703 0 3.75C0 2.09315 1.34315 0.75 3   0.75C4.1265 0.75 5.33911 1.60202 6 2.66823C6.66089 1.60202 7.8735 0.75 9 0.75Z"></path></svg></span><span class="pns-bookmark-count sc-a2e4344e-2 jjOPpe">1</span></div></span></span>');
            newSpan.addClass(lastSpan.get(0).className);
            lastSpan.after(newSpan);
        } else {
            bookmarkDiv.find('span:last').addClass('pns-bookmark-count').parent().addClass('pns-bookmark-div');
        }
        tagDiv.children().eq(0).empty().addClass('pns-tag-list');
        let descDiv = tagDiv.children().eq(1);
        descDiv.children().eq(0).addClass('pns-desc');
        // 右下角爱心
        let likeDiv = detailDiv.children().eq(2).children().eq(1);
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
        template.find('.pns-title').parent().attr('title', novel.title);
        let authorLink = template.find('.pns-author').attr('href').replace(/\d+$/, novel.userId);
        template.find('.pns-author').text(novel.userName).attr('href', authorLink);
        template.find('.pns-author-img').attr('href', authorLink).find('img').attr('src', novel.profileImageUrl);
        let textCount = Number(novel.textCount);
        let formattedTextCount = Number.isFinite(textCount) ? textCount.toLocaleString('en-US') : novel.textCount;
        template.find('.pns-text-count').text(template.find('.pns-text-count').text().replace(/[\d,]+/, formattedTextCount));
        if (novel.bookmarkCount == 0) {
            template.find('.pns-bookmark-div').hide();
        } else {
            template.find('.pns-bookmark-count').text(novel.bookmarkCount);
        }
        let tagList = template.find('.pns-tag-list');
        let search = getSearchParamsWithoutPage();
        $.each(novel.tags, function (i, tag) {
            let href = '/search?q=' + encodeURIComponent(tag) + '&type=novel' + (search.length > 0 ? '&' + search : '');
            let tagItem = $('<span"><a style="color: rgb(61, 118, 153);" href="' + href + '">' + tag + '</a></span>');
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
        like.click(function () {
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

        let useLegacyUrlRule = isLegacyNovelSearchPage();
        let url = getNovelAjaxUrl(key, from, useLegacyUrlRule);

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
            iLog.i('getNovelByPage url: ' + url);
            $.ajax({
                url: url,
                success: function (data) {
                    onLoadFinish(data, resolve);
                },
                error: function () {
                    iLog.e('get novel page ' + from + ' failed!');
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
        // 筛选
        let filteredList = [];
        $.each(list, function (i, e) {
            // 收藏量筛选
            let bookmark = e.bookmarkCount;
            if (!bookmark) {
                bookmark = 0;
            }
            if (bookmark < g_settings.novelFavFilter) {
                return true;
            }
            // 已收藏筛选
            if (g_settings.novelHideFavorite && e.bookmarkData) {
                return true;
            }
            filteredList.push(e);
        });
        return filteredList;
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
            $(e).css('display', 'block');
            ul.append(e);
        });
        hideLoading();
    }

    function getKeyWord() {
        let tagsMatch = location.pathname.match(/\/tags\/([^/]+)\/novels/);
        if (tagsMatch) {
            return decodeURIComponent(tagsMatch[1]);
        }
        let word = new URLSearchParams(location.search).get('q');
        return word ? word : '';
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
                iLog.d('add novel bookmark result: ');
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
            error: function () {
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
                iLog.d('delete novel bookmark result: ');
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
            error: function () {
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
            iLog.e('Parse key word error.');
            return;
        }
        let currentPage = getCurrentPage();

        if ($('.gtm-novel-searchpage-gs-toggle-button').attr('data-gtm-label') == 'off') {
            showLoading();
            $('.gtm-novel-searchpage-gs-toggle-button').parent().next().text();
            // 不常见，不要多语言了
            $('#loading').find('#progress').text('由于启用了 "' + $('.gtm-novel-searchpage-gs-toggle-button').parent().next().text() + '"，无法进行排序。');
            setTimeout(() => hideLoading(), 3000);
            return;
        }

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
function SetLocalStorage(name, value) {
    localStorage.setItem(name, JSON.stringify(value));
}
function GetLocalStorage(name) {
    const value = localStorage.getItem(name);
    if (!value) return null;
    return value;
}
function ShowInstallMessage() {
    $('#pp-bg').remove();
    let bg = $('<div id="pp-bg"></div>').css({
        'width': document.documentElement.clientWidth + 'px', 'height': document.documentElement.clientHeight + 'px', 'position': 'fixed',
        'z-index': 999999, 'background-color': 'rgba(0,0,0,0.8)',
        'left': '0px', 'top': '0px'
    });
    $('body').append(bg);

    bg.get(0).innerHTML = '<img id="pps-close"src="https://pp-1252089172.cos.ap-chengdu.myqcloud.com/Close.png"style="position: absolute; right: 35px; top: 20px; width: 32px; height: 32px; cursor: pointer;"><div style="position: absolute;width: 40%;left: 30%;top: 25%;font-size: 25px; text-align: center; color: white;">' + Texts[g_language].install_title + '</div><br>' + Texts[g_language].install_body;
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

    let body = Texts[g_language].upgrade_body;
    bg.get(0).innerHTML = '<img id="pps-close"src="https://pp-1252089172.cos.ap-chengdu.myqcloud.com/Close.png"style="position: absolute; right: 35px; top: 20px; width: 32px; height: 32px; cursor: pointer;"><div style="position: absolute;width: 40%;left: 30%;top: 25%;font-size: 25px; text-align: center; color: white;">'
        + Texts[g_language].install_title
        + '</div><br><div style="position:absolute;left:50%;top:30%;font-size:20px;color:white;transform:translate(-50%,0);height:50%;overflow:auto;">'
        + body + '</div>';
    $('#pps-close').click(function () {
        $('#pp-bg').remove();
    });
}
function ConvertSettingsFromGMC() {
    let hideByTagList = GMC.get('hideByTagList');
    if (hideByTagList != null && hideByTagList != '') {
        let hideByTagRegex = hideByTagList.replace(/,|，/g, '|');
        GMC.set('hideByTagRegex', hideByTagRegex);
        GMC.set('hideByTagList', '');
        GMC.save();
    }

    let settings = {
        'enablePreview': GMC.get('enablePreview'),
        'enableAnimePreview': GMC.get('enableAnimePreview'),
        'enableSort': GMC.get('enableSort'),
        'enableAnimeDownload': GMC.get('enableAnimeDownload'),
        'original': GMC.get('original'),
        'previewDelay': parseInt(GMC.get('previewDelay')) || 200,
        'previewByKey': GMC.get('previewByKey'),
        'pageCount': parseInt(GMC.get('pageCount')) || 3,
        'favFilter': parseInt(GMC.get('favFilter')) || 0,
        'aiFilter': GMC.get('aiFilter'),
        'aiOnly': GMC.get('aiOnly'),
        'hideFavorite': GMC.get('hideFavorite'),
        'hideFollowed': GMC.get('hideFollowed'),
        'hideByTag': GMC.get('hideByTag'),
        'hideByTagRegex': GMC.get('hideByTagRegex'),
        'hideByUser': GMC.get('hideByUser'),
        'hideByUserList': GMC.get('hideByUserList'),
        'hideCountLessThan': parseInt(GMC.get('hideCountLessThan')) || 0,
        'hideCountMoreThan': parseInt(GMC.get('hideCountMoreThan')) || 0,
        'linkBlank': GMC.get('linkBlank'),
        'pageByKey': GMC.get('pageByKey'),
        'fullSizeThumb': GMC.get('fullSizeThumb'),
        'enableNovelSort': GMC.get('enableNovelSort'),
        'novelPageCount': parseInt(GMC.get('novelPageCount')) || 3,
        'novelFavFilter': parseInt(GMC.get('novelFavFilter')) || 0,
        'novelHideFavorite': GMC.get('novelHideFavorite'),
        'previewFullScreen': GMC.get('previewFullScreen'),
        'previewKey': 17,
        'scrollLockWhenPreview': GMC.get('scrollLockWhenPreview'),
    };
    return settings;
}
function MigrateFromOldSetting() {
    let oldSettings = GetLocalStorage('PixivPreview');
    if (oldSettings && oldSettings != 'null') {
        let settings = JSON.parse(oldSettings);
        if (settings) {
            // 迁移设置
            GMC.set('enablePreview', settings.enablePreview);
            GMC.set('enableAnimePreview', settings.enableAnimePreview);
            GMC.set('enableSort', settings.enableSort);
            GMC.set('enableAnimeDownload', settings.enableAnimeDownload);
            GMC.set('original', settings.original);
            GMC.set('previewDelay', settings.previewDelay);
            GMC.set('previewByKey', settings.previewByKey);
            GMC.set('pageCount', settings.pageCount);
            GMC.set('favFilter', settings.favFilter);
            GMC.set('aiFilter', settings.aiFilter);
            GMC.set('aiOnly', settings.aiOnly);
            GMC.set('hideFavorite', settings.hideFavorite);
            GMC.set('hideFollowed', settings.hideFollowed);
            GMC.set('hideByTag', settings.hideByTag);
            GMC.set('hideByTagRegex', settings.hideByTagRegex);
            GMC.set('linkBlank', settings.linkBlank);
            GMC.set('pageByKey', settings.pageByKey);
            GMC.set('fullSizeThumb', settings.fullSizeThumb);
            GMC.set('enableNovelSort', settings.enableNovelSort);
            GMC.set('novelPageCount', settings.novelPageCount);
            GMC.set('novelFavFilter', settings.novelFavFilter);
            GMC.set('novelHideFavorite', settings.novelHideFavorite);
            let langString = 'PixivPreviewLang';
            SetLocalStorage(langString, parseInt(settings.lang));
            SetLocalStorage('PixivPreview', null);
            return true;
        }
    }
    return false;
}
function GetSettings() {
    let upgraded = MigrateFromOldSetting();

    let versionString = 'PixivPreviewVersion';
    let oldVersionData = GetLocalStorage(versionString);
    let oldVersion = null;
    if (oldVersionData) {
        oldVersion = JSON.parse(oldVersionData);
    }

    if (upgraded) {
        SetLocalStorage(versionString, g_version);
        ShowUpgradeMessage();
    } else if (oldVersion == null) {
        // 新安装
        SetLocalStorage(versionString, g_version);
        ShowInstallMessage();
    } else if (oldVersion != g_version) {
        // 升级
        SetLocalStorage(versionString, g_version);
        ShowUpgradeMessage();
    }

    return ConvertSettingsFromGMC();
}
function UpdateLogLevel() {
    let level = GMC.get('logLevel');
    if (level == 'error') {
        iLog.setLogLevel(iLog.LogLevel.Error);
    } else if (level == 'warning') {
        iLog.setLogLevel(iLog.LogLevel.Warning);
    } else if (level == 'info') {
        iLog.setLogLevel(iLog.LogLevel.Info);
    } else if (level == 'debug') {
        iLog.setLogLevel(iLog.LogLevel.Verbose);
    }
}
function ShowSetting() {
    GMC.open();
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

        let tempTarget = [];
        $.each(target, (i, e) => {
            let pol = $(e).find('polyline');
            if (pol.length > 0 && pol.get(0).className.baseVal.indexOf('WedgeIcon_arrow') != -1) {
                return true;
            }
            tempTarget.push(e);
        });

        $.each(tempTarget, function (i, e) {
            $(e).attr({ 'target': '_blank', 'rel': 'external' });
            // js监听跳转，特殊处理
            if (g_pageType == PageType.Home || g_pageType == PageType.Member || g_pageType == PageType.Artwork || g_pageType == PageType.BookMarkNew) {
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
function MigrationLanguage() {
    let oldSettings = GetLocalStorage('PixivPreview');
    if (oldSettings && oldSettings != 'null') {
        let settings = JSON.parse(oldSettings);
        if (settings) {
            return parseInt(settings.lang);
        }
    }

    let langString = 'PixivPreviewLang';
    let langData = GetLocalStorage(langString);
    if (langData == null || langData == 'null') {
        return Lang.auto;
    } else {
        return parseInt(langData);
    }
}
function AutoDetectLanguage() {
    g_language = MigrationLanguage();
    if (g_language == Lang.auto) {
        let lang = $('html').attr('lang');
        if (lang && lang.indexOf('zh') != -1) {
            // 简体中文和繁体中文都用简体中文
            g_language = Lang.zh_CN;
        } else if (lang && lang.indexOf('ja') != -1) {
            g_language = Lang.ja_JP;
        } else {
            // 其他的统一用英语，其他语言也不知道谷歌翻译得对不对
            g_language = Lang.en_US;
        }
    }
}
function Load() {
    // 匹配当前页面
    for (let i = 0; i < PageType.PageTypeCount; i++) {
        if (Pages[i].CheckUrl(location.href)) {
            g_pageType = i;
            break;
        }
    }
    if (g_pageType >= 0) {
        iLog.i('Current page is ' + Pages[g_pageType].PageTypeString);
    } else {
        iLog.w('Unsupported page.');
        clearInterval(loadInterval);
        return;
    }

    // 设置按钮
    let toolBar = Pages[g_pageType].GetToolBar();
    if (toolBar) {
        iLog.d(toolBar);
        clearInterval(loadInterval);
    } else {
        iLog.w('Get toolbar failed.');
        return;
    }

    window.onresize = function () {
        if ($('#pp-bg').length > 0) {
            let screenWidth = document.documentElement.clientWidth;
            let screenHeight = document.documentElement.clientHeight;
            $('#pp-bg').css({ 'width': screenWidth + 'px', 'height': screenHeight + 'px' });
        }
    };

    // 读取设置
    g_maxXhr = parseInt(GMC.get('maxXhr'));
    g_settings = GetSettings();

    if ($('#pp-sort').length === 0 && !(g_settings?.enableSort)) {
        const newListItem = document.createElement('div');
        const newButton = document.createElement('button');
        newButton.id = 'pp-sort';
        newButton.style.cssText = 'background-color: rgb(0, 0, 0); margin-top: 5px; opacity: 0.8; cursor: pointer; border: none; padding: 0px; border-radius: 24px; width: 48px; height: 48px;';
        newButton.innerHTML = `<span style="color: white;vertical-align: text-top;">${Texts[g_language].text_sort}</span>`;
        newListItem.appendChild(newButton);
        toolBar.appendChild(newListItem);

        $(newButton).click(function () {
            this.disabled = true;
            runPixivPreview(true);
            setTimeout(() => {
                this.disabled = false;
            }, 7000);
        });
    }

    // A fixed next page button next to the setting button
    if ($('#pp-nextPage-fixed').length === 0) {
        const newListItem = document.createElement('div');
        newListItem.innerHTML = '';
        const newButton = document.createElement('button');
        newButton.id = 'pp-nextPage-fixed';
        newButton.style.cssText = 'background-color: rgb(0, 0, 0); margin-top: 5px; opacity: 0.8; cursor: pointer; border: none; padding: 12px; border-radius: 24px; width: 48px; height: 48px;';
        newButton.innerHTML = '<svg viewBox="0 0 120 120" width="24" height="24" stroke="white" fill="none" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(90deg);"> <polyline points="60,105 60,8"></polyline> <polyline points="10,57 60,8 110,57"></polyline> </svg>';
        newListItem.appendChild(newButton);
        toolBar.appendChild(newListItem);

        $(newButton).click(function () {
            let nextPageHref = null;

            // Try to reuse .pp-nextPage, otherwise fallback to Pixiv native paginator's last link (>)
            let nextPageAnchor = $('.pp-nextPage');
            if (nextPageAnchor.length > 0 && nextPageAnchor.attr('hidden') !== 'hidden') {
                nextPageHref = nextPageAnchor.attr('href');
            } else {
                nextPageHref = [...document.querySelectorAll("nav")].find(nav => [...nav.children].filter(el => el.tagName === "A").every(el => /\?p=\d+$/.test(el.href)))?.lastElementChild?.href ?? null;
            }

            // Open the next page if available
            if (nextPageHref != null) {
                location.href = nextPageHref;
            }
        });
    }

    if ($('#pp-settings').length === 0) {
        const newListItem = document.createElement('div');
        const newButton = document.createElement('button');
        newButton.id = 'pp-settings';
        newButton.style.cssText = 'background-color: rgb(0, 0, 0); margin-top: 5px; opacity: 0.8; cursor: pointer; border: none; padding: 12px; border-radius: 24px; width: 48px; height: 48px;';
        newButton.innerHTML = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 1000 1000" enable-background="new 0 0 1000 1000" xml:space="preserve" style="fill: white;"><metadata> Svg Vector Icons : http://www.sfont.cn </metadata><g><path d="M377.5,500c0,67.7,54.8,122.5,122.5,122.5S622.5,567.7,622.5,500S567.7,377.5,500,377.5S377.5,432.3,377.5,500z"></path><path d="M990,546v-94.8L856.2,411c-8.9-35.8-23-69.4-41.6-100.2L879,186L812,119L689,185.2c-30.8-18.5-64.4-32.6-100.2-41.5L545.9,10h-94.8L411,143.8c-35.8,8.9-69.5,23-100.2,41.5L186.1,121l-67,66.9L185.2,311c-18.6,30.8-32.6,64.4-41.5,100.3L10,454v94.8L143.8,589c8.9,35.8,23,69.4,41.6,100.2L121,814l67,67l123-66.2c30.8,18.6,64.5,32.6,100.3,41.5L454,990h94.8L589,856.2c35.8-8.9,69.4-23,100.2-41.6L814,879l67-67l-66.2-123.1c18.6-30.7,32.6-64.4,41.5-100.2L990,546z M500,745c-135.3,0-245-109.7-245-245c0-135.3,109.7-245,245-245s245,109.7,245,245C745,635.3,635.3,745,500,745z"></path></g></svg>';
        newListItem.appendChild(newButton);
        toolBar.appendChild(newListItem);

        $(newButton).click(function () {
            ShowSetting();
        });
    }

    // g_csrfToken
    if (g_pageType == PageType.Search || g_pageType == PageType.NovelSearch) {
        $.get(location.href, function (data) {
            let matched = data.match(/token\\":\\"([a-z0-9]{32})/);
            if (matched != null && matched.length > 0) {
                g_csrfToken = matched[1];
                iLog.d('Got g_csrfToken: ' + g_csrfToken);
            } else {
                iLog.e('Can not get g_csrfToken, so you can not add works to bookmark when sorting has enabled.');
            }
        });
    }

    // 排序、预览
    itv = setInterval(function () {
        let returnMap = Pages[g_pageType].ProcessPageElements();
        if (!returnMap.loadingComplete) {
            return;
        }

        iLog.d('Process page comlete, sorting and prevewing begin.');
        iLog.d(returnMap);

        clearInterval(itv);

        SetTargetBlank(returnMap);
        runPixivPreview();
    }, 500);
    function runPixivPreview(eventFromButton = false) {
        try {
            if (g_pageType == PageType.Artwork) {
                Pages[g_pageType].Work();
                if (g_settings.enablePreview) {
                    PixivPreview();
                }
            }
            else if (g_pageType == PageType.Search) {
                if (g_settings.enableSort || eventFromButton) {
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
                if (g_settings.enableNovelSort || eventFromButton) {
                    PixivNS();
                }
            } else if (g_settings.enablePreview) {
                PixivPreview();
            }
        }
        catch (e) {
            iLog.e('Unknown error: ' + e);
        }
    }
}
function StartLoad() {
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
function LoadJQ() {
    checkJQuery().then(function (isLoad) {
        if (isLoad) {
            AutoDetectLanguage();
            gmcInit();
        } else {
            setTimeout(LoadJQ, 1000);
        }
    });
}
LoadJQ();