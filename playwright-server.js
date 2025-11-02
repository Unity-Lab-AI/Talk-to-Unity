const http = require('http');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const candidateRoot = process.env.PLAYWRIGHT_SERVE_DIR
    ? path.resolve(projectRoot, process.env.PLAYWRIGHT_SERVE_DIR)
    : '';

const hasCustomRoot = candidateRoot && fs.existsSync(candidateRoot);

if (candidateRoot && !hasCustomRoot) {
    console.warn(
        `Requested Playwright serve directory "${candidateRoot}" was not found. Falling back to project root.`
    );
}

const root = hasCustomRoot ? candidateRoot : projectRoot;
const port = process.env.PORT ? Number(process.env.PORT) : 4173;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.map': 'application/json; charset=utf-8'
};

function safeJoin(base, target) {
    const targetPath = target.startsWith('/') ? target : `/${target}`;
    const resolvedPath = path.resolve(base, '.' + targetPath);
    if (!resolvedPath.startsWith(base)) {
        return null;
    }
    return resolvedPath;
}

const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let filePath = safeJoin(root, urlPath === '/' ? '/index.html' : urlPath);

    if (!filePath) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Bad request');
        return;
    }

    fs.stat(filePath, (statErr, stats) => {
        if (statErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
        }

        if (stats.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        }

        fs.readFile(filePath, (readErr, data) => {
            if (readErr) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Internal server error');
                return;
            }

            const extension = path.extname(filePath).toLowerCase();
            const mimeType = MIME_TYPES[extension] || 'application/octet-stream';
            res.writeHead(200, {
                'Content-Type': mimeType,
                'Cache-Control': 'no-cache'
            });
            res.end(data);
        });
    });
});

server.listen(port, () => {
    console.log(`Static server listening on http://127.0.0.1:${port} (serving ${root})`);
});

function shutdown() {
    server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
