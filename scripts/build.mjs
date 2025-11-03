import { cp, mkdir, rm, writeFile } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

const aiSourceDir = path.join(projectRoot, 'AI');
const excludedDirectories = new Set(['tests', 'playwright']);
const excludedExtensions = new Set(['.md', '.py']);

async function prepareDistDirectory() {
    await rm(distDir, { recursive: true, force: true });
    await mkdir(distDir, { recursive: true });
}

async function copyStaticEntry(relativePath) {
    const source = path.join(projectRoot, relativePath);
    const destination = path.join(distDir, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination, { recursive: true });
}

function shouldCopyAiEntry(sourcePath) {
    const relative = path.relative(aiSourceDir, sourcePath);
    if (!relative || relative === '') {
        return true;
    }

    const segments = relative.split(path.sep);
    if (segments.some((segment) => excludedDirectories.has(segment))) {
        return false;
    }

    if (fs.statSync(sourcePath).isDirectory()) {
        return true;
    }

    const extension = path.extname(sourcePath).toLowerCase();
    if (excludedExtensions.has(extension)) {
        return false;
    }

    return true;
}

async function copyApplicationAssets() {
    const entries = ['index.html', 'landing.js', 'style.css', 'ai-instruct.txt'];
    for (const entry of entries) {
        await copyStaticEntry(entry);
    }

    // Copy scripts directory
    const scriptsSourceDir = path.join(projectRoot, 'scripts');
    const scriptsDestDir = path.join(distDir, 'scripts');
    await mkdir(scriptsDestDir, { recursive: true });
    await cp(path.join(scriptsSourceDir, 'shared.js'), path.join(scriptsDestDir, 'shared.js'));

    await cp(aiSourceDir, path.join(distDir, 'AI'), {
        recursive: true,
        filter: (source) => shouldCopyAiEntry(source)
    });
}

async function finalizeDist() {
    await writeFile(path.join(distDir, '.nojekyll'), '', 'utf8');
}

async function build() {
    await prepareDistDirectory();
    await copyApplicationAssets();
    await processHtmlFiles();
    await finalizeDist();
    console.log('Static site ready in dist/.');
}

async function processHtmlFiles() {
    const aiIndexPath = path.join(distDir, 'AI', 'index.html');
    let aiIndexContent = fs.readFileSync(aiIndexPath, 'utf8');
    aiIndexContent = aiIndexContent.replace(
        '<link rel="stylesheet" href="./style.css">',
        '<link rel="stylesheet" href="../style.css">'
    );
    await writeFile(aiIndexPath, aiIndexContent, 'utf8');
}

build().catch((error) => {
    console.error('Static build failed:', error);
    process.exitCode = 1;
});
