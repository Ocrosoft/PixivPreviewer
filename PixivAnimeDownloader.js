// ==UserScript==
// @name         Pixiv动图下载
// @namespace    //
// @version      0.33
// @description  Pixiv anime downloader
// @author       Ocrosoft
// @match        https://www.pixiv.net/member_illust.php?mode=*
// @grant        none
// @require      http://code.jquery.com/jquery-2.1.4.min.js
// ==/UserScript==

function downloadAnime(_class){

    try{
        if(!_class)_class='.worksShare';
        console.log('append to '+_class);
        var t = $('#wrapper')[0].innerHTML;
        var reg = new RegExp('<script>[^<]*</script>');
        t = reg.exec(t)[0];
        reg = new RegExp('http[^"]*','g');
        var matches;
        var normal = reg.exec(t)[0],full = reg.exec(t)[0];
        /*while((matches = reg.exec(t)) !== null){
        console.log(matches[0]);
        }*/
        normal = normal.replace('/\\/g','');
        full = full.replace('/\\/g','');
        $(_class)[0].innerHTML += '<p class="worksShareTitle">下载</p><div class="embed"><dl><form class="_comment-form" style="width:100%;text-align:center;"><input id="dl_normal" type="button" value="普通版" class="submit-button" style="width:45%; padding:0px;"><input id="dl_full" type="button" value="全屏版" class="submit-button" style="width:45%; padding:0px;margin-left:5px;"></form></dl></div>';
        $('#dl_normal').click(function(){
            window.open(normal);
        });
        $('#dl_full').click(function(){
            window.open(full);
        });
    }
    catch(e){
        console.log(e);
        $('.worksShare')[0].innerHTML += '<p style="text-align:center;">此页是动图？<br/>如果是请<a target="_blank" href="https://greasyfork.org/zh-CN/scripts/30681-pixiv%E5%8A%A8%E5%9B%BE%E4%B8%8B%E8%BD%BD">报错</a>，<br/>不是请忽略。<br/>&nbsp</p>';
    }
}

downloadAnime();