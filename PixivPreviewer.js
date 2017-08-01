// ==UserScript==
// @name         Pixiv动图预览
// @namespace
// @version      0.35
// @description  在搜索页右侧显示预览图(非动图适用)，分辨率低慎用。View preview of anime(pictures also supported.)
// @author       Ocrosoft
// @match        https://www.pixiv.net/search.php*
// @match        https://www.pixiv.net/member_illust.php*
// @match        https://www.pixiv.net/ranking.php*
// @match        https://www.pixiv.net/member.php?id=*
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
        var div=document.createElement('div');
        div.innerHTML='<p class="worksShareTitle">下载</p><div class="embed"><dl><form class="_comment-form" style="width:100%;text-align:center;"><input id="dl_normal" type="button" value="普通版" class="submit-button" style="width:45%; padding:0px;"><input id="dl_full" type="button" value="全屏版" class="submit-button" style="width:45%; padding:0px;margin-left:5px;"></form></dl></div>';
        $(_class).append(div);
        $('#dl_normal').click(function(){
            window.open(normal);
        });
        $('#dl_full').click(function(){
            window.open(full);
        });
        $('.works_display').css('width','100%');
    }
    catch(e){}
}

function addSidePreview() {
    'use strict';
    //console.log($('._layout-thumbnail').parent());
    $('._layout-thumbnail').parent().mouseover(function(e){
        var imgNode=this.children[0];
        if(e.ctrlKey)return;
        if($('#preview_div').attr('data-id')==$(imgNode.children[0]).attr('data-id'))return;
        var ifr=document.createElement('iframe');
        $(ifr).css({'width':'100%','height':'100%'});
        if($(imgNode.parentNode.parentNode).children('a').hasClass('multiple'))ifr.src='https://www.pixiv.net/member_illust.php?mode=manga&illust_id='+$(imgNode.children[0]).attr('data-id')+'#preview'; // 多图
        else ifr.src='https://www.pixiv.net/member_illust.php?mode=medium&illust_id='+$(imgNode.children[0]).attr('data-id')+'#preview'; // 单图
        $('#preview_div').children().remove();
        $('#preview_div').append(ifr);
        $('#preview_div').attr('data-id',$(imgNode.children[0]).attr('data-id'));
    });
    $('._layout-thumbnail').addClass('prev');
}

function clearOtherElements(){
    if(location.href.indexOf('#preview')==-1)return;
    if(location.href.indexOf('=manga')!=-1){ // 多图
        $('body').children().each(function(i,d){
            if(d.id!='main')d.remove();
        });
        $('#main').children().each(function(i,d){
            if(!$(d).hasClass('manga'))d.remove();
        });
        return;
    }
    // 2
    var anime=false;
    if($('.player').children('canvas').length>0)anime=true;

    if(anime)downloadAnime('.works_display');
    if(!anime){
        // 显示原图
        $('._illust_modal').removeClass('_hidden');
        $('._illust_modal').css('display','');
        var t=$('._illust_modal').children().children();
        t.each(function(i,d){
            if($(d).hasClass('original-image'))$(d).attr('src',$(d).attr('data-src'));
        });
        $('body').append($('._illust_modal'));
        $('body').children().each(function(i,d){
            if(!$(d).hasClass('_illust_modal'))d.remove();
        });
        $('img').attr({'height':'100%','width':'100%'});
        $('span').remove();
    }
    $('body').append($('.works_display')[0]);
    $('body').children().each(function(i,d){
        if(!$(d).hasClass('works_display')&&!$(d).hasClass('_illust_modal'))d.remove();
    });
    // 1
    /*var c=$('body').children();
    c.each(function(i,d){
        if(d.id!='wrapper')d.remove();
        else{
            $(d).children().each(function(j,e){
                if(!$(e).hasClass('layout-a'))e.remove();
                else{
                    $('.layout-column-1').remove();
                }
            });
        }
    });
    c=$('.layout-column-2').children();
    c.each(function(i,d){
        if(!$(d).hasClass('_unit'))d.remove();
        else{
            $(d).children().each(function(j,e){
                if(!$(e).hasClass('works_display'))e.remove();
            });
        }
    });*/
    //$('body').css('display','');
}

if(location.href.indexOf('member_illust.php?mode')!=-1){
    //$('body').css('display','none');
    $('document').ready(clearOtherElements());
}else {
    setInterval(function(){
        if($('#preview_div').length<=0){
            try{$($('.popular-introduction-block')[0].parentNode).remove();}catch(e){}
            var d=document.createElement('div');
            d.id="preview_div";
            $(d).css({"right":"0px","position":"fixed","top":"0px","width":"25%","height":"100%"});
            //d.innerHTML='<iframe style="width:100%;height:100%;"></iframe>';
            $('body').append(d);
            //https://www.pixiv.net/member_illust.php?mode=medium&illust_id=62814980
        }
        var t=$('._layout-thumbnail');
        if(!$(t[t.length-1]).hasClass('prev'))addSidePreview();
    },500);
}