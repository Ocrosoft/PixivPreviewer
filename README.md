<a href="https://greasyfork.org/zh-CN/scripts/30766">->Greasyfork<-</a>

关于 v3.0 版本：
P站对搜索页进行了大的改版，导致脚本的排序功能直接挂掉，此次更新主要修复了排序功能。
因为觉得之前的代码比较丑，也趁着这次机会重构了一下，对设置、预览的样式等做了较大的修改。
由于修改了设置，如果从 v2.x 版本更新，原来设置将不会被带到新版本，需要再配置一遍。
暂时删除了多语言和首次使用的教程，推荐阅读后面的内容，以了解脚本的功能和用法。

小版本更新历史：github，欢迎 star/fork。
动图下载的压缩包转 Gif 工具：github

预览支持页面：
1.搜索页 (Example: https://www.pixiv.net/tags/miku/artworks?s_mode=s_tag)
2.关注页 (https://www.pixiv.net/bookmark_new_illust.php)
3.发现页 (https://www.pixiv.net/discovery)
4.用户页 (Example: https://www.pixiv.net/users/648285)
5.主页 (https://www.pixiv.net/)
6.排行榜 (Example: https://www.pixiv.net/ranking.php?mode=daily)
7.大家的新作品页 (https://www.pixiv.net/new_illust.php)
9.收藏页 (Example: https://www.pixiv.net/users/648285/bookmarks/artworks)
10.动态页 (https://www.pixiv.net/stacc?mode=unify)
11.作品页（下方的“相关作品”）(Example: https://www.pixiv.net/artworks/80943778)

预览/Preview/プレビュー
在支持的页面中，将鼠标移动到图片，就会显示对应的预览图。
预览多图时，点击预览图切换下一张。
预览动图时，点击对应按钮可以暂停/播放、下载。
In the supported pages, move the mouse to the picture, and the corresponding preview will be displayed.
When previewing multiple images, click the preview image to switch to the next one.
When previewing the animation, click the corresponding button to pause / play and download.
サポートされているページで、画像にマウスを移動すると、対応するプレビューが表示されます。
複数の画像をプレビューする場合は、プレビュー画像をクリックして次の画像に切り替えます。
アニメーションをプレビューするとき、対応するボタンをクリックして一時停止/再生およびダウンロードします。

Ctrl 键：
1.如果当前没有显示预览，按住将临时禁用预览。（按住鼠标中键也可以）
2.如果当时正在显示预览，按住将禁止预览图跟随鼠标移动。
3.按住 Ctrl 并点击预览图，可以在 普通画质/最高画质 间切换。（动图除外）
Shift 键：
1.按住 Shift 并点击预览图，会在新标签页打开最高画质的图像。（动图除外）

排序（仅搜索页）/Sort/並べ替え
收集一定页数内的作品收藏量，并按从高到低的顺序重新排序。
Collect the collection of works within a certain number of pages, and reorder them from high to low.
一定数のページ内の作品のコレクションを収集し、それらを高から低に並べ替えます。
收藏量筛选（仅搜索页）
进行排序时，收藏量低于设定值的作品不显示。
收藏筛选（仅搜索页）
进行排序时，已收藏的作品不显示。

设置/Settings/設定
所有页面右下角都会显示脚本的设置（齿轮），点击打开设置页面。
* 保存或重置设置会刷新当前页面。
* 清理 Cookie 会导致设置重置到默认值。
*“使用新标签页打开作品详情页”在某些自动加载的页面，如果关闭了预览功能，新加载的图片将可能无法以新标签页打开。
The script settings (gears) will be displayed in the lower right corner of all pages. Click to open the settings page.
* Saving or resetting the settings will refresh the current page.
* Clearing cookies will reset the settings to default values.
スクリプト設定（ギア）が全ページ右下に表示されますので、クリックすると設定ページが開きます。
* 設定を保存またはリセットすると、現在のページが更新されます。
* Cookieをクリアすると、設定がデフォルト値にリセットされます。