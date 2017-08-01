# PixivPreviewer

为方便搜图自己瞎写的一下JavaScript脚本，
必须在浏览器中使用，Chrome推荐配合TamperMonkey。

1.Pixiv 动图下载（https://greasyfork.org/zh-CN/scripts/30681-pixiv%E5%8A%A8%E5%9B%BE%E4%B8%8B%E8%BD%BD）

P站上的动图下载地址其实就写在源代码里面，正则匹配一下就OK了。
另外需要判断一个页面是否包含动图，需要大量测试，慢慢更新。

2.Pixiv 动图预览（https://greasyfork.org/zh-CN/scripts/30766-pixiv%E5%8A%A8%E5%9B%BE%E9%A2%84%E8%A7%88）

在搜图页面和排行榜页面，鼠标移动到图片上会在右侧显示预览图，动图的话可以直接点击下载。
目前做法是直接开一个iframe（很low）。

3.Gifer（https://github.com/Ocrosoft/Gifer）

将Pixiv上下载的zip转换成gif文件。
