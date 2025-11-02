import { test, expect } from '@playwright/test';
declare global {
    interface UnityTestHooks {
        getChatHistory(): Array<{ role: string; content: string }>;
        sendUserInput(input: string): Promise<{
            text?: string;
            rawText?: string;
            imageUrl?: string;
            commands?: string[];
            error?: unknown;
        }>;
        isAppReady(): boolean;
        getCurrentHeroImage(): string;
    }

    interface Window {
        __unityTestHooks?: UnityTestHooks;
        setMutedState?(muted: boolean, options?: { announce?: boolean }): Promise<boolean> | void;
        speechSynthesis: {
            speakCalls: string[];
        };
        __testClipboardWrites?: unknown[];
    }
}

const MOCK_IMAGE_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

const AI_RESPONSE = {
    choices: [
        {
            message: {
                content:
                    'Here is your neon city skyline, glowing in fuchsia and gold hues.\nImage URL: https://image.pollinations.ai/prompt/test-neon-city.png'
            }
        }
    ]
};

test.beforeEach(async ({ page, context }) => {
    page.on('pageerror', (error) => {
        throw error;
    });

    page.on('console', (message) => {
        // Surface diagnostic messages during CI runs to help debug dependency states.
        console.log(`BROWSER: ${message.type().toUpperCase()} ${message.text()}`);
    });

    await context.addInitScript(() => {
        class MockSpeechRecognition {
            continuous = false;
            interimResults = false;
            lang = 'en-US';
            maxAlternatives = 1;
            onend = null;
            onerror = null;
            onresult = null;
            onaudiostart = null;
            onspeechstart = null;
            onspeechend = null;
            onstart = null;

            start() {
                if (typeof this.onstart === 'function') {
                    this.onstart();
                }
            }

            stop() {
                if (typeof this.onend === 'function') {
                    this.onend();
                }
            }
        }

        const speechSynthesisMock = {
            speakCalls: [],
            speaking: false,
            paused: false,
            pending: false,
            cancel() {
                this.speaking = false;
            },
            speak(utterance) {
                const text = typeof utterance === 'string' ? utterance : utterance?.text ?? '';
                this.speakCalls.push(text);
                this.speaking = Boolean(text);
            },
            getVoices() {
                return [{ name: 'Playwright Test Voice', lang: 'en-US' }];
            },
            addEventListener() {},
            removeEventListener() {}
        };

        class SpeechSynthesisUtteranceMock {
            constructor(text) {
                this.text = text;
                this.lang = 'en-US';
                this.pitch = 1;
                this.rate = 1;
                this.volume = 1;
            }
        }

        Object.defineProperty(window, 'SpeechRecognition', {
            value: MockSpeechRecognition,
            configurable: true
        });
        Object.defineProperty(window, 'webkitSpeechRecognition', {
            value: MockSpeechRecognition,
            configurable: true
        });
        Object.defineProperty(window, 'speechSynthesis', {
            value: speechSynthesisMock,
            configurable: true
        });
        Object.defineProperty(window, 'SpeechSynthesisUtterance', {
            value: SpeechSynthesisUtteranceMock,
            configurable: true
        });

        const mediaDevices = {
            async getUserMedia() {
                return {
                    getTracks() {
                        return [
                            {
                                stop() {}
                            }
                        ];
                    }
                };
            }
        };

        Object.defineProperty(navigator, 'mediaDevices', {
            value: mediaDevices,
            configurable: true
        });

        const clipboardWrites = [];

        Object.defineProperty(window, '__testClipboardWrites', {
            value: clipboardWrites,
            configurable: true,
            writable: true
        });

        Object.defineProperty(navigator, 'clipboard', {
            value: {
                writes: clipboardWrites,
                write(items) {
                    clipboardWrites.push(items);
                    return Promise.resolve();
                }
            },
            configurable: true
        });

        window.ClipboardItem = class ClipboardItem {
            constructor(items) {
                this.items = items;
            }
        };
    });

    await page.route('https://text.pollinations.ai/openai', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(AI_RESPONSE)
        });
    });

    await context.unroute('**/image.pollinations.ai/**').catch(() => {});
    await context.route('**/image.pollinations.ai/**', async (route) => {
        await route.fulfill({
            status: 200,
            headers: {
                'content-type': 'image/png',
                'access-control-allow-origin': '*'
            },
            body: MOCK_IMAGE_BASE64,
            isBase64: true
        });
    });
});

test('landing highlights missing dependencies but allows limited launch', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(window, 'SpeechRecognition', {
            value: undefined,
            configurable: true
        });
        Object.defineProperty(window, 'webkitSpeechRecognition', {
            value: undefined,
            configurable: true
        });
        Object.defineProperty(window, 'speechSynthesis', {
            value: undefined,
            configurable: true
        });

        Object.defineProperty(navigator, 'mediaDevices', {
            value: { getUserMedia: undefined },
            configurable: true
        });
    });

    await page.goto('/index.html');

    await page.evaluate(() => {
        window.__unityLandingTestHooks?.initialize();
        window.__unityLandingTestHooks?.evaluateDependencies({ announce: true });
    });

    await page.waitForFunction(() =>
        document.querySelector('[data-dependency="speech-recognition"]')?.getAttribute('data-state') === 'fail' &&
        document.querySelector('[data-dependency="speech-synthesis"]')?.getAttribute('data-state') === 'fail'
    );

    await expect(page.locator('#dependency-summary')).toContainText(/Alerts/i);
    await expect(page.locator('[data-dependency="speech-recognition"]')).toHaveAttribute('data-state', 'fail');
    await expect(page.locator('[data-dependency="speech-synthesis"]')).toHaveAttribute('data-state', 'fail');
    await expect(page.locator('[data-dependency="microphone"]')).toHaveAttribute('data-state', 'fail');

    const launchButton = page.locator('#launch-app');
    await expect(launchButton).toBeEnabled();
    await expect(launchButton).toHaveAttribute('data-state', 'warn');
    await expect(page.locator('#status-message')).toContainText(/limited/i);
});

test('ai generates fallback imagery and applies theme commands', async ({ page }) => {
    await page.goto('/index.html');

    await page.evaluate(() => {
        window.__unityLandingTestHooks?.initialize();
        window.__unityLandingTestHooks?.markAllDependenciesReady();
    });

    const launchButton = page.getByRole('button', { name: 'Talk to Unity' });
    await expect(launchButton).toBeEnabled();

    await page.goto('/AI/index.html');

    await page.waitForFunction(() => Boolean(window.__unityTestHooks?.isAppReady()));

    await page.unroute('https://text.pollinations.ai/openai');

    const fallbackResponse = {
        choices: [
            {
                message: {
                    content:
                        '[command: theme_light]\nLet me paint a tranquil sunrise above misty mountains.'
                }
            }
        ]
    };

    await page.route('https://text.pollinations.ai/openai', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(fallbackResponse)
        });
    });

    const result = await page.evaluate(async () => {
        const hooks = window.__unityTestHooks;
        if (!hooks) {
            throw new Error('Unity test hooks are not available');
        }

        const response = await hooks.sendUserInput(
            'Please paint a tranquil sunrise above misty mountains'
        );

        return {
            response,
            theme: document.body.dataset.theme,
            heroState: document.getElementById('hero-stage')?.dataset.state ?? '',
            heroUrl: hooks.getCurrentHeroImage(),
            speakCalls: window.speechSynthesis.speakCalls.slice()
        };
    });

    expect(result.response?.commands).toContain('theme_light');
    expect(result.response?.imageUrl).toContain('image.pollinations.ai');
    expect(result.theme).toBe('light');
    expect(['loaded', 'error']).toContain(result.heroState);
    if (result.heroState === 'loaded') {
        expect(result.heroUrl).toContain('image.pollinations.ai');
    }
    expect(result.speakCalls.some((entry) => /tranquil sunrise/i.test(entry))).toBe(true);
});

test('ai copies generated imagery when commanded by the assistant', async ({ page }) => {
    await page.goto('/index.html');

    await page.evaluate(() => {
        window.__unityLandingTestHooks?.initialize();
        window.__unityLandingTestHooks?.markAllDependenciesReady();
    });

    const launchButton = page.getByRole('button', { name: 'Talk to Unity' });
    await expect(launchButton).toBeEnabled();

    await page.goto('/AI/index.html');

    await page.waitForFunction(() => Boolean(window.__unityTestHooks?.isAppReady()));

    await page.unroute('https://text.pollinations.ai/openai');

    const copyResponse = {
        choices: [
            {
                message: {
                    content:
                        '[command: copy_image]\nHere is your vibrant skyline.\nImage URL: https://image.pollinations.ai/prompt/copy-test.png'
                }
            }
        ]
    };

    await page.route('https://text.pollinations.ai/openai', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(copyResponse)
        });
    });

    const result = await page.evaluate(async () => {
        const hooks = window.__unityTestHooks;
        if (!hooks) {
            throw new Error('Unity test hooks are not available');
        }

        const response = await hooks.sendUserInput(
            'Generate a futuristic skyline image for me.'
        );

        const history = hooks.getChatHistory();

        return {
            response,
            clipboardWrites: window.__testClipboardWrites?.length ?? 0,
            heroState: document.getElementById('hero-stage')?.dataset.state ?? '',
            heroUrl: hooks.getCurrentHeroImage(),
            lastMessage: history.at(-1) ?? null,
            speakCalls: window.speechSynthesis.speakCalls.slice()
        };
    });

    expect(result.response?.commands).toContain('copy_image');
    expect(result.response?.imageUrl).toContain('image.pollinations.ai');
    expect(result.clipboardWrites).toBeGreaterThan(0);
    expect(['loaded', 'error']).toContain(result.heroState);
    if (result.heroState === 'loaded') {
        expect(result.heroUrl).toContain('image.pollinations.ai');
    }
    expect(result.lastMessage?.content ?? '').not.toMatch(/command/i);
    expect(result.speakCalls.some((entry) => /image copied to clipboard/i.test(entry))).toBe(true);
});

test('user can launch Talk to Unity and receive AI response with image and speech', async ({ page }) => {
    await page.goto('/index.html');

    await expect(page.locator('#landing-title')).toHaveText(/Let’s make sure every light is green/i);
    await expect(page.locator('.dependency-item')).toHaveCount(4);

    const launchButton = page.getByRole('button', { name: 'Talk to Unity' });
    const recheckButton = page.getByRole('button', { name: 'Check again' });

    await page.evaluate(() => {
        window.__unityLandingTestHooks?.initialize();
    });

    await recheckButton.click();

    await page.evaluate(() => {
        window.__unityLandingTestHooks?.evaluateDependencies();
    });

    const dependencySnapshot = await page.evaluate(() => {
        const snapshot = {
            isSecureContext: window.isSecureContext,
            hostname: window.location.hostname,
            hasSpeechRecognition: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
            hasSpeechSynthesis:
                typeof window.speechSynthesis !== 'undefined' && typeof window.speechSynthesis.speak === 'function',
            hasMicrophone: Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            dependencyStates: Array.from(document.querySelectorAll('.dependency-item')).map((item) => ({
                id: item.dataset.dependency,
                state: item.dataset.state,
                status: item.querySelector('.dependency-status')?.textContent?.trim() ?? ''
            }))
        };

        console.log('Dependency snapshot', JSON.stringify(snapshot));
        return snapshot;
    });

    test.info().annotations.push({ type: 'dependencySnapshot', description: JSON.stringify(dependencySnapshot) });

    if (await launchButton.isDisabled()) {
        await page.evaluate(() => {
            window.__unityLandingTestHooks?.markAllDependenciesReady();
        });
    }

    await expect(launchButton).toBeEnabled();

    await page.goto('/AI/index.html');

    // Wait for landing to hide and app to show
    await expect(page.locator('#landing')).toBeHidden();
    await expect(page.locator('#app-root')).toBeVisible();

    await page.waitForFunction(() => Boolean(window.__unityTestHooks?.isAppReady()));

    await page.evaluate(() => {
        window.setMutedState(false);
    });

    const aiResult = await page.evaluate(async () => {
        if (!window.__unityTestHooks) {
            throw new Error('Unity test hooks are not available');
        }

        const response = await window.__unityTestHooks.sendUserInput(
            'Generate a neon skyline with narration.'
        );

        return {
            response,
            speakCalls: window.speechSynthesis.speakCalls
        };
    });

    await page.evaluate((dataUrl) => {
        window.__unityTestHooks?.setHeroImage(dataUrl);
    }, `data:image/png;base64,${MOCK_IMAGE_BASE64}`);

    await expect(page.locator('#hero-stage')).toHaveAttribute('data-state', 'loaded');
    expect(aiResult.response?.text).toContain('neon city skyline');
    expect(aiResult.response?.imageUrl).toContain('image.pollinations.ai');
    expect(aiResult.speakCalls.length).toBeGreaterThan(0);

    const history = await page.evaluate(() => window.__unityTestHooks?.getChatHistory() ?? []);
    const lastMessage = history.at(-1);
    expect(lastMessage?.role).toBe('assistant');
    expect(lastMessage?.content).toContain('neon city skyline');
});
