const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const script = fs.readFileSync(path.join(root, 'pixiv previewer.user.js'), 'utf8');
const dependencies = Array.from(script.matchAll(/^\/\/ @require\s+(\S+)/gm), ([, url]) => ({
    url,
    file: path.join(root, '.test-cache', createHash('sha256').update(url).digest('hex') + '.js'),
}));

function prepareDependencies() {
    fs.mkdirSync(path.join(root, '.test-cache'), { recursive: true });
    for (const { url, file } of dependencies) {
        if (fs.existsSync(file)) continue;
        const partial = file + '.' + process.pid + '.part';
        try {
            if (process.platform === 'win32') {
                // Invoke-WebRequest honors the same system proxy settings as Edge.
                execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
                    "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'; " +
                    'Invoke-WebRequest -UseBasicParsing -TimeoutSec 60 -Uri $env:PIXIV_TEST_URL -OutFile $env:PIXIV_TEST_FILE'],
                { env: { ...process.env, PIXIV_TEST_URL: url, PIXIV_TEST_FILE: partial } });
            } else {
                execFileSync('curl', ['--fail', '--location', '--silent', '--show-error',
                    '--max-time', '60', '--retry', '2', '--output', partial, url]);
            }
            const source = fs.readFileSync(partial, 'utf8').trimStart();
            if (!source || source.startsWith('<')) throw new Error(`Expected JavaScript from ${url}`);
            fs.renameSync(partial, file);
        } finally {
            fs.rmSync(partial, { force: true });
        }
    }
}

module.exports = prepareDependencies;
module.exports.dependencies = dependencies;
module.exports.script = script;
