import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [tag, previous, outputDir, revision = tag] = process.argv.slice(2);
const version = /^v(\d+\.\d+\.\d+)$/.exec(tag)?.[1];
if (!version || !/^v\d+\.\d+\.\d+$/.test(previous) ||
    tag.localeCompare(previous, 'en', { numeric: true }) <= 0) {
    throw new Error(`Expected a stable release newer than ${previous}, got ${tag}.`);
}

function git(...args) {
    return execFileSync('git', args, { encoding: 'utf8' });
}

const source = git('show', `${revision}:pixiv previewer.user.js`);
const header = /^\/\/ ==UserScript==\r?\n[\s\S]*?^\/\/ ==\/UserScript==\r?$/m.exec(source)?.[0];
const scriptVersion = header?.match(/^\/\/\s+@version[ \t]+(\S+)[ \t]*\r?$/m)?.[1];
if (scriptVersion !== version) {
    throw new Error(`Tag ${tag} requires @version ${version}, found ${scriptVersion}.`);
}
const stableHeader = header.replace(/^(\/\/[ \t]+@name(?::[\w-]+)?[ \t]+[^\r\n]+?) \(Dev\)(?=[ \t]*\r?$)/gm, '$1');
const asset = source.replace(header, () => stableHeader);
writeFileSync(join(outputDir, 'pixiv-previewer.user.js'), asset);

const commits = git('log', '--first-parent', '--reverse', '-z', '--format=%s%n%b', `${previous}..${revision}`);
const sections = { '新功能': [], '修复': [], '其他变更': [] };
for (const commit of commits.split('\0')) {
    const [title, ...body] = commit.trim().split('\n');
    const pullRequest = /^Merge pull request (#\d+)\b/.exec(title);
    const prTitle = body.find(line => line.trim());
    const subject = pullRequest && prTitle ? `${prTitle} (${pullRequest[1]})` : title;
    if (!subject || /^chore(?:\([^)]*\))?:\s*升级版本号/.test(subject)) continue;
    const change = /^(feat|fix)(?:\([^)]*\))?!?:\s*(.+)$/.exec(subject);
    if (change) {
        sections[change[1] === 'feat' ? '新功能' : '修复'].push(change[2]);
    } else {
        sections['其他变更'].push(subject);
    }
}
const notes = Object.entries(sections)
    .filter(([, entries]) => entries.length)
    .map(([heading, entries]) => `## ${heading}\n\n${entries.map(entry => `- ${entry}`).join('\n')}\n`)
    .join('\n');
writeFileSync(join(outputDir, 'release-notes.md'), notes);
