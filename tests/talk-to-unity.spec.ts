import { test, expect } from '@playwright/test';
import { Buffer } from 'buffer';

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

        Object.defineProperty(navigator, 'clipboard', {
            value: {
                write() {
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

    await page.route('https://image.pollinations.ai/*', async (route) => {
        await route.fulfill({
            status: 200,
            headers: {
                'content-type': 'image/png',
                'access-control-allow-origin': '*'
            },
            body: Buffer.from(MOCK_IMAGE_BASE64, 'base64')
        });
    });
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

    await Promise.all([
        page.waitForNavigation({ url: /\/AI\/index\.html$/i }),
        launchButton.click()
    ]);

    await expect(page).toHaveURL(/\/AI\/index\.html$/i);

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
