const fs = require('node:fs');
const { dependencies, script } = require('./dependencies');

function jquerySource() {
    return fs.readFileSync(require.resolve('jquery/dist/jquery.min.js'), 'utf8');
}

async function installUserscript(page, { jquery = true } = {}) {
    const libraries = dependencies.map(({ file }) => fs.readFileSync(file, 'utf8')).join('\n;\n');
    // Use one scope in @require order, with the page DOM available at script startup.
    await page.addInitScript({ content: `if (window === window.top && location.hostname === 'www.pixiv.net') {
        document.addEventListener('DOMContentLoaded', function () {
            ${jquery ? jquerySource() : ''}
            ;(function () {
                const unsafeWindow = window;
                const GM_info = { scriptHandler: 'Tampermonkey', version: '5.3.3' };
                let GM_xmlhttpRequest = () => { throw Error('Unexpected GM request'); };
                let GM = { xmlHttpRequest: GM_xmlhttpRequest };
                ${libraries}
                ;${script}
            }).call(window);
        }, { once: true });
    }` });
}

module.exports = { installUserscript, jquerySource };
