import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    timeout: 60_000,
    expect: {
        timeout: 10_000
    },
    fullyParallel: false,
    use: {
        baseURL: 'http://127.0.0.1:4173',
        headless: true,
        viewport: { width: 1280, height: 720 }
    },
    webServer: {
        command: 'PLAYWRIGHT_SERVE_DIR=dist node playwright-server.mjs',
        port: 4173,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
    },
    reporter: [
        ['junit', { outputFile: 'playwright-report/results.xml' }],
        ['line']
    ]
});
