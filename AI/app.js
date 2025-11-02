const landingSection = document.getElementById('landing');
const appRoot = document.getElementById('app-root');
const heroStage = document.getElementById('hero-stage');
const heroImage = document.getElementById('hero-image');
const muteIndicator = document.getElementById('mute-indicator');
const indicatorText = muteIndicator?.querySelector('.indicator-text') ?? null;
const aiCircle = document.querySelector('[data-role="ai"]');
const userCircle = document.querySelector('[data-role="user"]');
const dependencyLight = document.querySelector('[data-role="dependency-light"]');
const dependencySummary = document.getElementById('dependency-summary');
const dependencyList = document.getElementById('dependency-list');
const launchButton = document.getElementById('launch-app');
const recheckButton = document.getElementById('recheck-dependencies');

if (heroImage) {
    heroImage.setAttribute('crossorigin', 'anonymous');
    heroImage.decoding = 'async';
}

const bodyElement = document.body;
if (bodyElement) {
    bodyElement.classList.remove('no-js');
    bodyElement.classList.add('js-enabled');
}

let currentImageModel = 'flux';
let chatHistory = [];

function appendToChatHistory(entry) {
    if (!entry || typeof entry !== 'object') {
        return;
    }

    chatHistory.push(entry);

    if (chatHistory.length > 12) {
        chatHistory.splice(0, chatHistory.length - 12);
    }
}
let systemPrompt = '';
let recognition = null;
let isMuted = true;
let hasMicPermission = false;
let currentHeroUrl = '';
let pendingHeroUrl = '';
let currentTheme = 'dark';
let recognitionRestartTimeout = null;
let appStarted = false;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const synth = window.speechSynthesis;

const dependencyChecks = [
    {
        id: 'secure-context',
        label: 'Secure context (HTTPS or localhost)',
        check: () =>
            Boolean(window.isSecureContext) ||
            /^localhost$|^127(?:\.\d{1,3}){3}$|^\[::1\]$/.test(window.location.hostname)
    },
    {
        id: 'speech-recognition',
        label: 'Web Speech Recognition API',
        check: () => Boolean(SpeechRecognition)
    },
    {
        id: 'speech-synthesis',
        label: 'Speech synthesis voices',
        check: () => typeof synth !== 'undefined' && typeof synth.speak === 'function'
    },
    {
        id: 'microphone',
        label: 'Microphone access',
        check: () => Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    }
];

if (heroStage && !heroStage.dataset.state) {
    heroStage.dataset.state = 'empty';
}

const currentScript = document.currentScript;
const directoryUrl = (() => {
    if (currentScript?.src) {
        try {
            return new URL('./', currentScript.src).toString();
        } catch (error) {
            console.error('Failed to derive directory from script src:', error);
        }
    }

    const href = window.location.href;
    const pathname = window.location.pathname || '';
    const lastSegment = pathname.substring(pathname.lastIndexOf('/') + 1);

    if (href.endsWith('/')) {
        return href;
    }

    if (lastSegment && lastSegment.includes('.')) {
        return href.substring(0, href.lastIndexOf('/') + 1);
    }

    return `${href}/`;
})();

function resolveAssetPath(relativePath) {
    try {
        return new URL(relativePath, directoryUrl).toString();
    } catch (error) {
        console.error('Failed to resolve asset path:', error);
        return relativePath;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    evaluateDependencies();

    launchButton?.addEventListener('click', async () => {
        evaluateDependencies({ announce: true });
        await startApplication();
    });

    recheckButton?.addEventListener('click', () => {
        evaluateDependencies({ announce: true });
    });
});

window.addEventListener('focus', () => {
    if (!appStarted) {
        evaluateDependencies();
    }
});

function normalizeLaunchResults(detail) {
    if (!detail || typeof detail !== 'object') {
        return null;
    }

    const normalizedResults = Array.isArray(detail.results)
        ? detail.results
              .map((item) => {
                  if (!item || typeof item !== 'object') {
                      return null;
                  }

                  const id = typeof item.id === 'string' ? item.id : undefined;
                  if (!id) {
                      return null;
                  }

                  return {
                      id,
                      label: item.label || item.friendlyName || id,
                      met: Boolean(item.met)
                  };
              })
              .filter(Boolean)
        : null;

    if (!normalizedResults || normalizedResults.length === 0) {
        return null;
    }

    const inferredAllMet = normalizedResults.every((result) => result.met);
    const allMet = typeof detail.allMet === 'boolean' ? detail.allMet : inferredAllMet;

    return {
        results: normalizedResults,
        allMet
    };
}

async function handleTalkToUnityLaunch(detail) {
    const normalized = normalizeLaunchResults(detail);

    if (normalized) {
        updateDependencyUI(normalized.results, normalized.allMet, { announce: false });
    } else if (!appStarted) {
        evaluateDependencies();
    }

    if (appStarted) {
        if (typeof window !== 'undefined') {
            delete window.__talkToUnityLaunchIntent;
        }
        return;
    }

    try {
        await startApplication();
    } catch (error) {
        console.error('Failed to start the Talk to Unity experience:', error);
        appStarted = false;
        throw error;
    } finally {
        if (typeof window !== 'undefined') {
            delete window.__talkToUnityLaunchIntent;
        }
    }
}

window.addEventListener('talk-to-unity:launch', (event) => {
    handleTalkToUnityLaunch(event?.detail).catch((error) => {
        console.error('Error while handling Talk to Unity launch event:', error);
    });
});

if (typeof window !== 'undefined' && window.__talkToUnityLaunchIntent) {
    handleTalkToUnityLaunch(window.__talkToUnityLaunchIntent).catch((error) => {
        console.error('Failed to honor pending Talk to Unity launch intent:', error);
    });
}

function evaluateDependencies({ announce = false } = {}) {
    const results = dependencyChecks.map((descriptor) => {
        let met = false;
        try {
            met = Boolean(descriptor.check());
        } catch (error) {
            console.error(`Dependency check failed for ${descriptor.id}:`, error);
        }

        return {
            ...descriptor,
            met
        };
    });

    const allMet = results.every((result) => result.met);
    updateDependencyUI(results, allMet, { announce });

    if (launchButton) {
        launchButton.disabled = false;
        launchButton.setAttribute('aria-disabled', 'false');
    }

    return { results, allMet };
}

function updateDependencyUI(results, allMet, { announce = false } = {}) {
    if (dependencyList) {
        results.forEach((result) => {
            const item = dependencyList.querySelector(`[data-dependency="${result.id}"]`);
            if (!item) {
                return;
            }

            item.dataset.state = result.met ? 'pass' : 'fail';
            const statusElement = item.querySelector('.dependency-status');
            if (statusElement) {
                statusElement.textContent = result.met ? 'Ready' : 'Action required';
            }
        });
    }

    if (dependencyLight) {
        dependencyLight.dataset.state = allMet ? 'pass' : 'fail';
        dependencyLight.setAttribute(
            'aria-label',
            allMet ? 'All dependencies satisfied' : 'One or more dependencies are missing'
        );
    }

    if (dependencySummary) {
        const unmet = results.filter((result) => !result.met);
        if (unmet.length === 0) {
            dependencySummary.textContent =
                'All systems are ready. Launch the Voice Lab to begin your Unity AI conversation.';
        } else if (unmet.length === 1) {
            const [missingCapability] = unmet;
            dependencySummary.textContent =
                `${missingCapability.label} is unavailable. You can launch now, but some features may be limited until it is resolved.`;
        } else {
            const missingLabels = unmet.map((result) => result.label).join(', ');
            dependencySummary.textContent =
                `Multiple capabilities are unavailable (${missingLabels}). You can launch now, but some features may be limited until they are resolved.`;
        }
    }

    if (announce && !allMet) {
        const missingNames = results
            .filter((result) => !result.met)
            .map((result) => result.label)
            .join(', ');

        if (missingNames) {
            speak(`Missing dependencies: ${missingNames}`);
        }
    }
}

async function startApplication() {
    if (appStarted) {
        return;
    }

    appStarted = true;

    if (appRoot?.hasAttribute('hidden')) {
        appRoot.removeAttribute('hidden');
    }

    if (bodyElement) {
        bodyElement.dataset.appState = 'experience';
    }

    if (landingSection) {
        landingSection.setAttribute('aria-hidden', 'true');
    }

    if (heroStage) {
        if (!heroStage.dataset.state) {
            heroStage.dataset.state = 'idle';
        }
        heroStage.classList.add('is-visible');
    }

    applyTheme(currentTheme);
    await loadSystemPrompt();
    setupSpeechRecognition();
    updateMuteIndicator();
    await initializeVoiceControl();
    applyTheme(currentTheme, { force: true });
}

async function setMutedState(muted, { announce = false } = {}) {
    if (!recognition) {
        isMuted = muted;
        updateMuteIndicator();
        if (muted) {
            setCircleState(userCircle, {
                listening: false,
                speaking: false,
                label: 'Microphone is muted'
            });
            if (announce) {
                speak('Microphone muted.');
            }
        } else {
            setCircleState(userCircle, {
                listening: true,
                label: 'Listening for your voice'
            });
            if (announce) {
                speak('Microphone unmuted.');
            }
        }
        return;
    }

    if (muted) {
        if (!isMuted) {
            isMuted = true;
            setCircleState(userCircle, {
                listening: false,
                speaking: false,
                label: 'Microphone is muted'
            });
            updateMuteIndicator();
            try {
                recognition.stop();
            } catch (error) {
                console.error('Failed to stop recognition:', error);
            }
        } else {
            updateMuteIndicator();
        }

        if (announce) {
            speak('Microphone muted.');
        }

        return;
    }

    if (!hasMicPermission) {
        hasMicPermission = await requestMicPermission();
        if (!hasMicPermission) {
            updateMuteIndicator();
            if (announce) {
                speak('Microphone permission is required to unmute.');
            }
            return;
        }
    }

    if (!isMuted) {
        setCircleState(userCircle, {
            listening: true,
            label: 'Listening for your voice'
        });
        updateMuteIndicator();

        if (announce) {
            speak('Microphone is already listening.');
        }
        return;
    }

    isMuted = false;
    setCircleState(userCircle, {
        listening: true,
        label: 'Listening for your voice'
    });
    updateMuteIndicator();

    try {
        recognition.start();
    } catch (error) {
        console.error('Failed to start recognition:', error);
        setCircleState(userCircle, {
            error: true,
            listening: false,
            label: 'Unable to start microphone recognition'
        });
        isMuted = true;
        updateMuteIndicator();
        if (announce) {
            speak('Unable to start microphone recognition.');
        }
        return;
    }

    if (announce) {
        speak('Microphone unmuted.');
    }
}

function applyTheme(theme, { announce = false, force = false } = {}) {
    const normalizedTheme = theme === 'light' ? 'light' : 'dark';
    const body = document.body;
    const root = document.documentElement;

    if (!body) {
        currentTheme = normalizedTheme;
        if (root) {
            root.dataset.theme = normalizedTheme;
        }
        return;
    }

    const previousTheme = currentTheme;
    const wasThemeChanged =
        force ||
        previousTheme !== normalizedTheme ||
        body.dataset.theme !== normalizedTheme ||
        (root?.dataset.theme ?? previousTheme) !== normalizedTheme;

    currentTheme = normalizedTheme;
    body.dataset.theme = normalizedTheme;
    if (root) {
        root.dataset.theme = normalizedTheme;
    }

    if (announce) {
        if (!wasThemeChanged) {
            speak(normalizedTheme === 'light' ? 'Light theme is already active.' : 'Dark theme is already active.');
        } else {
            speak(normalizedTheme === 'light' ? 'Light theme activated.' : 'Dark theme activated.');
        }
    }
}

function setCircleState(circle, { speaking = false, listening = false, error = false, label = '' } = {}) {
    if (!circle) {
        return;
    }

    if (speaking) {
        if (circle.classList.contains('is-speaking')) {
            circle.classList.remove('is-speaking');
            void circle.offsetWidth;
        }
        circle.classList.add('is-speaking');
    } else {
        circle.classList.remove('is-speaking');
    }
    circle.classList.toggle('is-listening', listening);
    circle.classList.toggle('is-error', error);

    if (label) {
        circle.setAttribute('aria-label', label);
    }
}

async function loadSystemPrompt() {
    try {
        const response = await fetch(resolveAssetPath('ai-instruct.txt'));
        systemPrompt = await response.text();
    } catch (error) {
        console.error('Error fetching system prompt:', error);
        systemPrompt = 'You are Unity, a helpful AI assistant.';
    }
}

function setupSpeechRecognition() {
    if (!SpeechRecognition) {
        console.error('Speech recognition is not supported in this browser.');
        alert('Speech recognition is not supported in this browser.');
        setCircleState(userCircle, {
            label: 'Speech recognition is not supported in this browser',
            error: true
        });
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        console.log('Voice recognition started.');
        setCircleState(userCircle, {
            listening: true,
            label: 'Listening for your voice'
        });
    };

    recognition.onaudiostart = () => {
        setCircleState(userCircle, {
            listening: true,
            label: 'Listening for your voice'
        });
    };

    recognition.onspeechstart = () => {
        setCircleState(userCircle, {
            speaking: true,
            listening: true,
            label: 'Hearing you speak'
        });
    };

    recognition.onspeechend = () => {
        setCircleState(userCircle, {
            listening: true,
            speaking: false,
            label: 'Processing what you said'
        });
    };

    recognition.onend = () => {
        console.log('Voice recognition stopped.');
        setCircleState(userCircle, {
            listening: false,
            speaking: false,
            label: isMuted ? 'Microphone is muted' : 'Listening for your voice'
        });

        if (recognitionRestartTimeout) {
            clearTimeout(recognitionRestartTimeout);
            recognitionRestartTimeout = null;
        }

        if (!isMuted) {
            recognitionRestartTimeout = window.setTimeout(() => {
                recognitionRestartTimeout = null;
                try {
                    recognition.start();
                } catch (error) {
                    console.error('Failed to restart recognition:', error);
                    setCircleState(userCircle, {
                        error: true,
                        label: 'Unable to restart microphone recognition'
                    });

                    if (!isMuted) {
                        recognitionRestartTimeout = window.setTimeout(() => {
                            recognitionRestartTimeout = null;
                            try {
                                recognition.start();
                            } catch (retryError) {
                                console.error('Retry to restart recognition failed:', retryError);
                            }
                        }, 800);
                    }
                }
            }, 280);
        }
    };

    recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim();
        console.log('User said:', transcript);

        setCircleState(userCircle, {
            listening: true,
            speaking: false,
            label: 'Processing what you said'
        });

        const isLocalCommand = handleVoiceCommand(transcript);
        if (!isLocalCommand) {
            getAIResponse(transcript);
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setCircleState(userCircle, {
            error: true,
            listening: false,
            speaking: false,
            label: `Microphone error: ${event.error}`
        });
    };
}

async function initializeVoiceControl() {
    if (!recognition) {
        return;
    }

    hasMicPermission = await requestMicPermission();
    if (!hasMicPermission) {
        alert('Microphone access is required for voice control.');
        updateMuteIndicator();
        return;
    }

    if (!isMuted) {
        try {
            recognition.start();
        } catch (error) {
            console.error('Failed to start recognition:', error);
        }
    }
}

async function requestMicPermission() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Microphone access is not supported in this browser.');
        setCircleState(userCircle, {
            error: true,
            label: 'Microphone access is not supported in this browser'
        });
        return false;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        setCircleState(userCircle, {
            label: 'Microphone is muted'
        });
        return true;
    } catch (error) {
        console.error('Microphone permission denied:', error);
        setCircleState(userCircle, {
            error: true,
            label: 'Microphone permission denied'
        });
        return false;
    }
}

function updateMuteIndicator() {
    if (!muteIndicator) {
        return;
    }

    muteIndicator.classList.add('is-visible');
    muteIndicator.setAttribute('aria-hidden', 'false');

    if (isMuted) {
        const message = hasMicPermission
            ? 'Tap or click anywhere to unmute'
            : 'Allow microphone access to start';
        indicatorText && (indicatorText.textContent = message);
        muteIndicator.dataset.state = 'muted';
        muteIndicator.setAttribute('aria-label', 'Microphone muted. Tap to enable listening.');
    } else {
        indicatorText && (indicatorText.textContent = 'Listening… tap to mute');
        muteIndicator.dataset.state = 'listening';
        muteIndicator.setAttribute('aria-label', 'Microphone active. Tap to mute.');
    }
}

async function attemptUnmute() {
    await setMutedState(false);
}

function handleMuteToggle(event) {
    event?.stopPropagation();

    if (isMuted) {
        attemptUnmute();
        return;
    }

    setMutedState(true);
}

muteIndicator?.addEventListener('click', handleMuteToggle);

document.addEventListener('click', () => {
    if (isMuted) {
        attemptUnmute();
    }
});

document.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && isMuted) {
        event.preventDefault();
        attemptUnmute();
    }
});


function isLikelyUrlSegment(segment) {
    if (typeof segment !== 'string' || segment.trim() === '') {
        return false;
    }

    const cleaned = segment
        .replace(/^[<({\[\s'"“”‘’`]+/g, '')
        .replace(/[>)}\]\s'"“”‘’`]+$/g, '')
        .replace(/[.,!?;:]+$/g, '')
        .trim();

    if (cleaned === '') {
        return false;
    }

    const normalized = cleaned.toLowerCase();

    if (
        normalized.startsWith('http://') ||
        normalized.startsWith('https://') ||
        normalized.startsWith('www.') ||
        normalized.includes('://')
    ) {
        return true;
    }

    if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/?#].*)?$/.test(normalized)) {
        return true;
    }

    return false;
}

function removeMarkdownLinkTargets(value) {
    return value
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, altText, url) => {
            return isLikelyUrlSegment(url) ? altText : _match;
        })
        .replace(/\[([^\]]*)\]\(([^)]+)\)/g, (_match, linkText, url) => {
            return isLikelyUrlSegment(url) ? linkText : _match;
        })
        .replace(/\[(?:command|action)[^\]]*\]\([^)]*\)/gi, ' ');
}

function removeCommandArtifacts(value) {
    if (typeof value !== 'string') {
        return '';
    }

    let result = value
        .replace(/\[[^\]]*\bcommand\b[^\]]*\]/gi, ' ')
        .replace(/\([^)]*\bcommand\b[^)]*\)/gi, ' ')
        .replace(/<[^>]*\bcommand\b[^>]*>/gi, ' ')
        .replace(/\bcommands?\s*[:=-]\s*[a-z0-9_,\s-]+/gi, ' ')
        .replace(/\bactions?\s*[:=-]\s*[a-z0-9_,\s-]+/gi, ' ')
        .replace(/\b(?:execute|run)\s+command\s*(?:[:=-]\s*)?[a-z0-9_-]*/gi, ' ')
        .replace(/\bcommand\s*(?:[:=-]\s*|\s+)(?:[a-z0-9_-]+(?:\s+[a-z0-9_-]+)*)?/gi, ' ');

    result = result.replace(/^\s*[-*]?\s*(?:command|action)[^\n]*$/gim, ' ');

    return result;
}

function sanitizeForSpeech(text) {
    if (typeof text !== 'string') {
        return '';
    }

    const withoutDirectives = text
        .replace(/\[command:[^\]]*\]/gi, ' ')
        .replace(/\{command:[^}]*\}/gi, ' ')
        .replace(/<command[^>]*>[^<]*<\/command>/gi, ' ')
        .replace(/\b(?:command|action)\s*[:=]\s*([a-z0-9_\-]+)/gi, ' ')
        .replace(/\bcommands?\s*[:=]\s*([a-z0-9_\-]+)/gi, ' ')
        .replace(/\b(?:command|action)\s*(?:->|=>|::)\s*([a-z0-9_\-]+)/gi, ' ')
        .replace(/\b(?:command|action)\b\s*[()\-:=]*\s*[a-z0-9_\-]+/gi, ' ')
        .replace(/\bcommand\s*\([^)]*\)/gi, ' ');

    const withoutPollinations = withoutDirectives
        .replace(/https?:\/\/\S*images?\.pollinations\.ai\S*/gi, '')
        .replace(/\b\S*images?\.pollinations\.ai\S*\b/gi, '');

    const withoutMarkdownTargets = removeMarkdownLinkTargets(withoutPollinations);
    const withoutCommands = removeCommandArtifacts(withoutMarkdownTargets);

    const withoutGenericUrls = withoutCommands
        .replace(/https?:\/\/\S+/gi, ' ')
        .replace(/\bwww\.[^\s)]+/gi, ' ');

    const withoutSpacedUrls = withoutGenericUrls
        .replace(/h\s*t\s*t\s*p\s*s?\s*:\s*\/\s*\/\s*[\w\-./?%#&=]+/gi, ' ')
        .replace(/\bhttps?\b/gi, ' ')
        .replace(/\bwww\b/gi, ' ');

    const withoutSpelledUrls = withoutSpacedUrls
        .replace(/h\s*t\s*t\s*p\s*s?\s*(?:[:=]|colon)\s*\/\s*\/\s*[\w\-./?%#&=]+/gi, ' ')
        .replace(/\b(?:h\s*t\s*t\s*p\s*s?|h\s*t\s*t\s*p)\b/gi, ' ')
        .replace(/\bcolon\b/gi, ' ')
        .replace(/\bslash\b/gi, ' ');

    const parts = withoutSpelledUrls.split(/(\s+)/);
    const sanitizedParts = parts.map((part) => {
        if (isLikelyUrlSegment(part)) {
            return '';
        }

        if (/(?:https?|www|:\/\/|\.com|\.net|\.org|\.io|\.ai|\.co|\.gov|\.edu)/i.test(part)) {
            return '';
        }

        if (/\bcommand\b/i.test(part)) {
            return '';
        }

        if (/(?:image|artwork|photo)\s+(?:url|link)/i.test(part)) {
            return '';
        }

        return part;
    });

    const commandTokens = [
        'open_image',
        'save_image',
        'copy_image',
        'mute_microphone',
        'unmute_microphone',
        'stop_speaking',
        'shutup',
        'set_model_flux',
        'set_model_turbo',
        'set_model_kontext',
        'clear_chat_history',
        'theme_light',
        'theme_dark'
    ];

    let sanitized = sanitizedParts
        .join('')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([.,!?;:])/g, '$1')
        .replace(/\(\s*\)/g, '')
        .replace(/\[\s*\]/g, '')
        .replace(/\{\s*\}/g, '')
        .replace(/\b(?:https?|www)\b/gi, '')
        .replace(/\b[a-z0-9]+\s+dot\s+[a-z0-9]+\b/gi, '')
        .replace(/\b(?:dot\s+)(?:com|net|org|io|ai|co|gov|edu|xyz)\b/gi, '')

        .replace(/<\s*>/g, '')
        .replace(/\bcommand\b/gi, '')
        .replace(/\b(?:image|artwork|photo)\s+(?:url|link)\b.*$/gim, '')
        .trim();

    return sanitized;
}

function sanitizeImageUrl(rawUrl) {
    if (typeof rawUrl !== 'string') {
        return '';
    }

    return rawUrl
        .trim()
        .replace(/^["'<\[({]+/, '')
        .replace(/["'>)\]}]+$/, '')
        .replace(/[,.;!]+$/, '');
}

const FALLBACK_IMAGE_KEYWORDS = [
    'show',
    'picture',
    'image',
    'photo',
    'illustration',
    'draw',
    'paint',
    'render',
    'display',
    'visual',
    'wallpaper',
    'generate'
];

function shouldRequestFallbackImage({ userInput = '', assistantMessage = '', fallbackPrompt = '', existingImageUrl = '' }) {
    if (existingImageUrl || !fallbackPrompt) {
        return false;
    }

    const combined = `${userInput} ${assistantMessage}`.toLowerCase();
    if (combined.includes('[image]')) {
        return true;
    }

    const keywordPattern = new RegExp(`\\b(?:${FALLBACK_IMAGE_KEYWORDS.join('|')})\\b`, 'i');
    if (keywordPattern.test(combined)) {
        return true;
    }

    const descriptiveCuePattern = /(here\s+(?:is|'s)|displaying|showing)\s+(?:an?\s+)?(?:image|picture|photo|visual)/i;
    return descriptiveCuePattern.test(combined);
}

function cleanFallbackPrompt(text) {
    return text
        .replace(/^["'\s]+/, '')
        .replace(/["'\s]+$/, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function buildFallbackImagePrompt(userInput = '', assistantMessage = '') {
    const sources = [assistantMessage, userInput];
    for (const source of sources) {
        if (!source) {
            continue;
        }

        const explicitPromptMatch = source.match(/(?:image\s+prompt|prompt)\s*[:=]\s*"?([^"\n]+)"?/i);
        if (explicitPromptMatch?.[1]) {
            const sanitized = cleanFallbackPrompt(explicitPromptMatch[1]);
            if (sanitized) {
                return sanitized;
            }
        }
    }

    const rawCandidate = userInput || assistantMessage || '';
    if (!rawCandidate) {
        return '';
    }

    const cleaned = cleanFallbackPrompt(
        rawCandidate
            .replace(/\b(?:please|kindly)\b/gi, '')
            .replace(/\b(?:can|could|would|will|may|might|let's)\b\s+(?:you\s+)?/gi, '')
            .replace(
                /\b(?:show|display|draw|paint|generate|create|make|produce|render|give|find|display)\b\s+(?:me\s+|us\s+)?/gi,
                ''
            )
            .replace(
                /\b(?:an?\s+)?(?:image|picture|photo|visual|illustration|render|drawing|art|shot|wallpaper)\b\s*(?:of|showing)?\s*/gi,
                ''
            )
    );

    if (!cleaned) {
        return '';
    }

    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function buildPollinationsImageUrl(prompt, { model = currentImageModel } = {}) {
    if (typeof prompt !== 'string') {
        return '';
    }

    const sanitized = cleanFallbackPrompt(prompt);
    if (!sanitized) {
        return '';
    }

    const params = new URLSearchParams({
        model: model || 'flux',
        width: '1024',
        height: '1024',
        nologo: 'true',
        enhance: 'true',
        seed: Math.floor(Math.random() * 1_000_000_000).toString()
    });

    return `https://image.pollinations.ai/prompt/${encodeURIComponent(sanitized)}?${params.toString()}`;
}

function extractImageUrl(text) {
    if (typeof text !== 'string' || text.trim() === '') {
        return '';
    }

    const markdownMatch = text.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/i);
    if (markdownMatch && markdownMatch[1]) {
        return sanitizeImageUrl(markdownMatch[1]);
    }

    const urlMatch = text.match(/https?:\/\/[^\s)]+/i);
    if (urlMatch && urlMatch[0]) {
        return sanitizeImageUrl(urlMatch[0]);
    }

    return '';
}

function escapeRegExp(value) {
    return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function removeImageReferences(text, imageUrl) {
    if (typeof text !== 'string') {
        return '';
    }

    if (!imageUrl) {
        return text.trim();
    }

    const sanitizedUrl = sanitizeImageUrl(imageUrl);
    if (!sanitizedUrl) {
        return text.trim();
    }

    let result = text;
    const escapedUrl = escapeRegExp(sanitizedUrl);

    const markdownImageRegex = new RegExp(`!\\[[^\\]]*\\]\\(${escapedUrl}\\)`, 'gi');
    result = result.replace(markdownImageRegex, '');

    const markdownLinkRegex = new RegExp(`\\[[^\\]]*\\]\\(${escapedUrl}\\)`, 'gi');
    result = result.replace(markdownLinkRegex, '');

    const rawUrlRegex = new RegExp(escapedUrl, 'gi');
    result = result.replace(rawUrlRegex, '');

    result = result
        .replace(/\bimage\s+url\s*:?/gi, '')
        .replace(/\bimage\s+link\s*:?/gi, '')
        .replace(/\bart(?:work)?\s+(?:url|link)\s*:?/gi, '')
        .replace(/<\s*>/g, '')
        .replace(/\(\s*\)/g, '')
        .replace(/\[\s*\]/g, '');

    return result
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\s+([.,!?;:])/g, '$1')
        .trim();
}

function normalizeCommandValue(value) {
    return value.replace(/[\s-]+/g, '_').trim().toLowerCase();
}

function parseAiDirectives(responseText) {
    if (typeof responseText !== 'string' || responseText.trim() === '') {
        return { cleanedText: '', commands: [] };
    }

    const commands = [];
    let workingText = responseText;

    const patterns = [
        /\[command:\s*([^\]]+)\]/gi,
        /\{command:\s*([^}]+)\}/gi,
        /<command[^>]*>\s*([^<]*)<\/command>/gi,
        /\bcommand\s*[:=]\s*([a-z0-9_\-]+)/gi,
        /\bcommands?\s*[:=]\s*([a-z0-9_\-]+)/gi,
        /\baction\s*[:=]\s*([a-z0-9_\-]+)/gi,
        /\b(?:command|action)\s*(?:->|=>|::)\s*([a-z0-9_\-]+)/gi,
        /\bcommand\s*\(\s*([^)]+?)\s*\)/gi
    ];

    for (const pattern of patterns) {
        workingText = workingText.replace(pattern, (_match, commandValue) => {
            if (commandValue) {
                const normalized = normalizeCommandValue(commandValue);
                if (normalized) {
                    commands.push(normalized);
                }
            }
            return ' ';
        });
    }

    const slashCommandRegex = /(?:^|\s)\/(open_image|save_image|copy_image|mute_microphone|unmute_microphone|stop_speaking|shutup|set_model_flux|set_model_turbo|set_model_kontext|clear_chat_history|theme_light|theme_dark|playwrite)\b/gi;
    workingText = workingText.replace(slashCommandRegex, (_match, commandValue) => {
        const normalized = normalizeCommandValue(commandValue);
        if (normalized) {
            commands.push(normalized);
        }
        return ' ';
    });

    const directiveBlockRegex = /(?:^|\n)\s*(?:commands?|actions?)\s*:?\s*(?:\n|$)((?:\s*[-*•]?\s*[a-z0-9_\-]+\s*(?:\(\))?\s*(?:\n|$))+)/gi;
    workingText = workingText.replace(directiveBlockRegex, (_match, blockContent) => {
        const lines = blockContent
            .split(/\n+/)
            .map((line) => line.replace(/^[^a-z0-9]+/i, '').trim())
            .filter(Boolean);

        for (const line of lines) {
            const normalized = normalizeCommandValue(line.replace(/\(\)/g, ''));
            if (normalized) {
                commands.push(normalized);
            }
        }

        return '\n';
    });

    const cleanedText = workingText.replace(/\n{3,}/g, '\n\n').trim();
    const uniqueCommands = [...new Set(commands)];

    return { cleanedText, commands: uniqueCommands };
}

async function executeAiCommand(command, options = {}) {
    if (!command) {
        return false;
    }

    const normalized = normalizeCommandValue(command);

    switch (normalized) {
        case 'mute_microphone':
            await setMutedState(true, { announce: true });
            return true;
        case 'unmute_microphone':
            await setMutedState(false, { announce: true });
            return true;
        case 'stop_speaking':
        case 'shutup':
            synth.cancel();
            setCircleState(aiCircle, {
                speaking: false,
                label: 'Unity is idle'
            });
            return true;
        case 'copy_image':
            await copyImageToClipboard(options.imageUrl);
            return true;
        case 'save_image':
            await saveImage(options.imageUrl);
            return true;
        case 'open_image':
            openImageInNewTab(options.imageUrl);
            return true;
        case 'set_model_flux':
            currentImageModel = 'flux';
            speak('Image model set to flux.');
            return true;
        case 'set_model_turbo':
            currentImageModel = 'turbo';
            speak('Image model set to turbo.');
            return true;
        case 'set_model_kontext':
            currentImageModel = 'kontext';
            speak('Image model set to kontext.');
            return true;
        case 'clear_chat_history':
            chatHistory = [];
            speak('Chat history cleared.');
            return true;
        case 'theme_light':
            applyTheme('light', { announce: true });
            return true;
        case 'theme_dark':
            applyTheme('dark', { announce: true });
            return true;
        case 'playwrite':
            await handlePlaywriteAbility(options);
            return true;
        default:
            return false;
    }
}

function speak(text) {
    if (synth.speaking) {
        synth.cancel();
        setCircleState(aiCircle, {
            speaking: false,
            label: 'Unity is idle'
        });
    }

    const sanitizedText = sanitizeForSpeech(text);

    if (sanitizedText === '') {
        return;
    }

    const utterance = new SpeechSynthesisUtterance(sanitizedText);
    const voices = synth.getVoices();
    const ukFemaleVoice = voices.find((voice) =>
        voice.name.includes('Google UK English Female') || (voice.lang === 'en-GB' && voice.gender === 'female')
    );

    if (ukFemaleVoice) {
        utterance.voice = ukFemaleVoice;
    } else {
        console.warn('UK English female voice not found, using default.');
    }

    utterance.onstart = () => {
        console.log('AI is speaking...');
        setCircleState(aiCircle, {
            speaking: true,
            label: 'Unity is speaking'
        });
    };

    utterance.onend = () => {
        console.log('AI finished speaking.');
        setCircleState(aiCircle, {
            speaking: false,
            label: 'Unity is idle'
        });
    };

    synth.speak(utterance);
}


function handleVoiceCommand(command) {
    const lowerCaseCommand = command.toLowerCase();

    if (
        lowerCaseCommand.includes('mute my mic') ||
        lowerCaseCommand.includes('mute microphone') ||
        lowerCaseCommand === 'mute'
    ) {
        setMutedState(true, { announce: true });
        return true;
    }

    if (
        lowerCaseCommand.includes('unmute my mic') ||
        lowerCaseCommand.includes('unmute microphone') ||
        lowerCaseCommand.includes('turn on the mic') ||
        lowerCaseCommand === 'unmute'
    ) {
        setMutedState(false, { announce: true });
        return true;
    }

    if (lowerCaseCommand.includes('shut up') || lowerCaseCommand.includes('be quiet')) {
        synth.cancel();
        setCircleState(aiCircle, {
            speaking: false,
            label: 'Unity is idle'
        });
        return true;
    }

    if (
        lowerCaseCommand.includes('light mode') ||
        lowerCaseCommand.includes('light theme') ||
        lowerCaseCommand.includes('day mode')
    ) {
        applyTheme('light', { announce: true });
        return true;
    }

    if (
        lowerCaseCommand.includes('dark mode') ||
        lowerCaseCommand.includes('dark theme') ||
        lowerCaseCommand.includes('night mode')
    ) {
        applyTheme('dark', { announce: true });
        return true;
    }

    if (lowerCaseCommand.includes('copy image') || lowerCaseCommand.includes('copy this image')) {
        copyImageToClipboard();
        return true;
    }

    if (lowerCaseCommand.includes('save image') || lowerCaseCommand.includes('download image')) {
        saveImage();
        return true;
    }

    if (lowerCaseCommand.includes('open image') || lowerCaseCommand.includes('open this image')) {
        openImageInNewTab();
        return true;
    }

    if (lowerCaseCommand.includes('use flux model') || lowerCaseCommand.includes('switch to flux')) {
        currentImageModel = 'flux';
        speak('Image model set to flux.');
        return true;
    }

    if (lowerCaseCommand.includes('use turbo model') || lowerCaseCommand.includes('switch to turbo')) {
        currentImageModel = 'turbo';
        speak('Image model set to turbo.');
        return true;
    }

    if (lowerCaseCommand.includes('use kontext model') || lowerCaseCommand.includes('switch to kontext')) {
        currentImageModel = 'kontext';
        speak('Image model set to kontext.');
        return true;
    }

    if (
        lowerCaseCommand.includes('clear history') ||
        lowerCaseCommand.includes('delete history') ||
        lowerCaseCommand.includes('clear chat') ||
        lowerCaseCommand.includes('clear chat history')
    ) {
        chatHistory = [];
        speak('Chat history cleared.');
        return true;
    }

    if (
        lowerCaseCommand.includes('light mode') ||
        lowerCaseCommand.includes('light theme') ||
        lowerCaseCommand.includes('change to light') ||
        lowerCaseCommand.includes('switch to light') ||
        lowerCaseCommand.includes('change them to light')
    ) {
        const wasUpdated = currentTheme !== 'light';
        applyTheme('light');
        speak(wasUpdated ? 'Switched to the light theme.' : 'Light theme is already active.');
        return true;
    }

    if (
        lowerCaseCommand.includes('dark mode') ||
        lowerCaseCommand.includes('dark theme') ||
        lowerCaseCommand.includes('change to dark') ||
        lowerCaseCommand.includes('switch to dark') ||
        lowerCaseCommand.includes('change them to dark')
    ) {
        const wasUpdated = currentTheme !== 'dark';
        applyTheme('dark');
        speak(wasUpdated ? 'Switched to the dark theme.' : 'Dark theme is already active.');
        return true;
    }

    return false;
}

const POLLINATIONS_TEXT_URL = 'https://text.pollinations.ai/openai';
const UNITY_REFERRER = 'https://www.unityailab.com/';
const PLAYWRITE_EXECUTION_URL = '/api/tools/playwrite';
const PLAYWRITE_PLAN_PROMPT = [
    'TOOL REQUEST: Playwrite automation has been activated.',
    'Respond only with a JSON object containing the following keys:',
    '"objective" — a short description of the research goal.',
    '"queries" — an array with one to three precise search queries.',
    '"followUpQuestion" — optional question to ask after reviewing the results.',
    '"sites" — optional array of preferred domains to visit.',
    'Do not include commentary outside the JSON object.'
].join('\n');
const PLAYWRITE_MAX_RESULTS = 5;

async function fetchPollinationsText(messages) {
    const pollinationsPayload = JSON.stringify({
        messages,
        model: 'unity'
    });

    const textResponse = await fetch(POLLINATIONS_TEXT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        // Explicitly identify the Unity AI Lab referrer so the public
        // Pollinations endpoint treats the request as coming from the
        // approved web client even when running the app from localhost.
        referrer: UNITY_REFERRER,
        referrerPolicy: 'strict-origin-when-cross-origin',
        body: pollinationsPayload
    });

    if (!textResponse.ok) {
        throw new Error(`Pollinations text API returned ${textResponse.status}`);
    }

    const data = await textResponse.json();
    const aiText = data.choices?.[0]?.message?.content ?? '';

    if (!aiText) {
        throw new Error('Received empty response from Pollinations AI');
    }

    return aiText;
}

async function processAiReply(aiText, { userInput }) {
    const { cleanedText, commands } = parseAiDirectives(aiText);
    const assistantMessage = cleanedText || aiText;
    const imageUrlFromResponse = extractImageUrl(aiText) || extractImageUrl(assistantMessage);

    const imageCommandQueue = [];
    const commandContext = {
        userInput,
        assistantMessage,
        rawText: aiText
    };

    for (const command of commands) {
        const normalizedCommand = normalizeCommandValue(command);
        if (['copy_image', 'save_image', 'open_image'].includes(normalizedCommand)) {
            imageCommandQueue.push(normalizedCommand);
            continue;
        }

        await executeAiCommand(normalizedCommand, commandContext);
    }

    const fallbackPrompt = buildFallbackImagePrompt(userInput, assistantMessage);
    let fallbackImageUrl = '';
    if (
        shouldRequestFallbackImage({
            userInput,
            assistantMessage,
            fallbackPrompt,
            existingImageUrl: imageUrlFromResponse
        })
    ) {
        fallbackImageUrl = buildPollinationsImageUrl(fallbackPrompt, { model: currentImageModel });
    }

    const selectedImageUrl = imageUrlFromResponse || fallbackImageUrl;

    const assistantMessageWithoutImage = selectedImageUrl
        ? removeImageReferences(assistantMessage, selectedImageUrl)
        : assistantMessage;

    const finalAssistantMessage = assistantMessageWithoutImage.replace(/\n{3,}/g, '\n\n').trim();
    const chatAssistantMessage = finalAssistantMessage || '[image]';

    appendToChatHistory({ role: 'assistant', content: chatAssistantMessage });

    let heroImagePromise = Promise.resolve(false);
    if (selectedImageUrl) {
        heroImagePromise = updateHeroImage(selectedImageUrl);
    }

    const shouldSuppressSpeech = commands.includes('shutup') || commands.includes('stop_speaking');

    if (imageCommandQueue.length > 0) {
        await heroImagePromise;
        const imageTarget = selectedImageUrl || getImageUrl() || pendingHeroUrl;
        for (const command of imageCommandQueue) {
            await executeAiCommand(command, { ...commandContext, imageUrl: imageTarget });
        }
    }

    if (!shouldSuppressSpeech) {
        const spokenText = sanitizeForSpeech(finalAssistantMessage);
        if (spokenText) {
            await heroImagePromise;
            speak(spokenText);
        }
    }

    return {
        text: finalAssistantMessage,
        rawText: aiText,
        imageUrl: selectedImageUrl,
        commands
    };
}

async function getAIResponse(userInput) {
    console.log(`Sending to AI: ${userInput}`);

    appendToChatHistory({ role: 'user', content: userInput });

    try {
        const messages = [{ role: 'system', content: systemPrompt }, ...chatHistory];
        const aiText = await fetchPollinationsText(messages);
        return await processAiReply(aiText, { userInput });
    } catch (error) {
        console.error('Error getting text from Pollinations AI:', error);
        setCircleState(aiCircle, {
            error: true,
            label: 'Unity could not respond'
        });
        speak("Sorry, I couldn't get a text response.");
        setTimeout(() => {
            setCircleState(aiCircle, {
                error: false,
                label: 'Unity is idle'
            });
        }, 2400);

        return { error };
    }
}

function resolvePlaywriteEndpoint() {
    if (typeof window !== 'undefined' && typeof window.__unityPlaywriteEndpoint === 'string') {
        return window.__unityPlaywriteEndpoint;
    }

    return PLAYWRITE_EXECUTION_URL;
}

function parseJsonFromText(text) {
    if (typeof text !== 'string') {
        return null;
    }

    const trimmed = text.trim();
    if (!trimmed) {
        return null;
    }

    const candidates = new Set();

    const fencedMatch = trimmed.match(/```json?\s*([\s\S]*?)```/i);
    if (fencedMatch && fencedMatch[1]) {
        candidates.add(fencedMatch[1].trim());
    }

    if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
        candidates.add(trimmed.replace(/^```json?/i, '').replace(/```$/, '').trim());
    }

    candidates.add(trimmed);

    for (const candidate of candidates) {
        if (!candidate) {
            continue;
        }

        try {
            return JSON.parse(candidate);
        } catch (error) {
            continue;
        }
    }

    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const snippet = trimmed.slice(firstBrace, lastBrace + 1);
        try {
            return JSON.parse(snippet);
        } catch (error) {
            // Ignore parse failure and fall through to null.
        }
    }

    return null;
}

function normalizePlaywritePlan(plan) {
    if (!plan || typeof plan !== 'object') {
        return null;
    }

    const objective = typeof plan.objective === 'string' ? plan.objective.trim() : '';

    const queries = [];
    if (Array.isArray(plan.queries)) {
        for (const entry of plan.queries) {
            if (typeof entry === 'string' && entry.trim()) {
                queries.push(entry.trim());
            }
        }
    }

    if (typeof plan.query === 'string' && plan.query.trim()) {
        queries.push(plan.query.trim());
    }

    const uniqueQueries = [...new Set(queries)].slice(0, 3);

    if (uniqueQueries.length === 0) {
        return null;
    }

    const siteCandidates = [];
    if (Array.isArray(plan.sites)) {
        siteCandidates.push(...plan.sites);
    }
    if (Array.isArray(plan.sources)) {
        siteCandidates.push(...plan.sources);
    }

    const sites = siteCandidates
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry)
        .slice(0, 5);

    const followUpQuestion =
        typeof plan.followUpQuestion === 'string'
            ? plan.followUpQuestion.trim()
            : typeof plan.followupquestion === 'string'
            ? plan.followupquestion.trim()
            : '';

    return {
        objective,
        queries: uniqueQueries,
        sites,
        followUpQuestion
    };
}

async function requestPlaywritePlan() {
    const planPromptMessage = {
        role: 'user',
        content: PLAYWRITE_PLAN_PROMPT
    };

    const messages = [{ role: 'system', content: systemPrompt }, ...chatHistory, planPromptMessage];
    const aiText = await fetchPollinationsText(messages);
    const parsedPlan = parseJsonFromText(aiText);

    appendToChatHistory(planPromptMessage);
    appendToChatHistory({ role: 'assistant', content: aiText.trim() || '[playwrite-plan]' });

    const normalizedPlan = normalizePlaywritePlan(parsedPlan);

    if (!normalizedPlan) {
        throw new Error('Playwrite plan was not provided in the expected JSON format.');
    }

    return {
        ...normalizedPlan,
        raw: parsedPlan,
        rawResponse: aiText
    };
}

function describeError(error) {
    if (error instanceof Error && typeof error.message === 'string') {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    if (error && typeof error === 'object' && typeof error.toString === 'function') {
        return error.toString();
    }

    return 'Unknown error';
}

async function executePlaywritePlan(plan) {
    const endpoint = resolvePlaywriteEndpoint();
    const payload = {
        objective: plan.objective,
        queries: plan.queries,
        sites: plan.sites,
        followUpQuestion: plan.followUpQuestion
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Playwrite endpoint returned ${response.status}`);
    }

    const data = await response.json();

    const results = Array.isArray(data?.results)
        ? data.results
              .map((entry) => {
                  const title = typeof entry?.title === 'string' ? entry.title.trim() : '';
                  const url = typeof entry?.url === 'string' ? entry.url.trim() : '';
                  const snippet = typeof entry?.snippet === 'string' ? entry.snippet.trim() : '';

                  if (!title && !url && !snippet) {
                      return null;
                  }

                  return {
                      title,
                      url,
                      snippet
                  };
              })
              .filter(Boolean)
              .slice(0, PLAYWRITE_MAX_RESULTS)
        : [];

    const summary = typeof data?.summary === 'string' ? data.summary.trim() : '';
    const notes = typeof data?.notes === 'string' ? data.notes.trim() : '';
    const followUp = typeof data?.followUp === 'string' ? data.followUp.trim() : '';

    return {
        results,
        summary,
        notes,
        followUp,
        raw: data
    };
}

function formatPlaywriteResultsForAI(plan, findings) {
    const lines = ['TOOL RESULT: Playwrite automation completed.'];

    if (plan.objective) {
        lines.push(`Objective: ${plan.objective}`);
    }

    if (plan.queries.length > 0) {
        lines.push('Queries:');
        plan.queries.forEach((query, index) => {
            lines.push(`${index + 1}. ${query}`);
        });
    }

    if (plan.sites.length > 0) {
        lines.push(`Preferred sites: ${plan.sites.join(', ')}`);
    }

    lines.push('Findings:');

    if (findings.results.length === 0) {
        lines.push('- No relevant pages were discovered.');
    } else {
        findings.results.forEach((result, index) => {
            const pieces = [];
            if (result.title) {
                pieces.push(result.title);
            }
            if (result.url) {
                pieces.push(result.url);
            }

            const heading = pieces.length > 0 ? pieces.join(' — ') : `Result ${index + 1}`;
            lines.push(`${index + 1}. ${heading}`);

            if (result.snippet) {
                lines.push(`   ${result.snippet}`);
            }
        });
    }

    if (findings.summary) {
        lines.push(`Summary: ${findings.summary}`);
    }

    if (findings.notes) {
        lines.push(`Notes: ${findings.notes}`);
    }

    if (plan.followUpQuestion) {
        lines.push(`Follow-up question from plan: ${plan.followUpQuestion}`);
    }

    if (findings.followUp) {
        lines.push(`Tool follow-up: ${findings.followUp}`);
    }

    return lines.join('\n');
}

function formatPlaywriteFailureReport({ stage, plan, error }) {
    const lines = ['TOOL RESULT: Playwrite automation failed.'];
    lines.push(`Stage: ${stage}`);

    if (plan?.objective) {
        lines.push(`Objective: ${plan.objective}`);
    }

    if (plan?.queries?.length) {
        lines.push('Queries:');
        plan.queries.forEach((query, index) => {
            lines.push(`${index + 1}. ${query}`);
        });
    }

    if (plan?.sites?.length) {
        lines.push(`Preferred sites: ${plan.sites.join(', ')}`);
    }

    if (plan?.followUpQuestion) {
        lines.push(`Follow-up question from plan: ${plan.followUpQuestion}`);
    }

    const errorDescription = describeError(error);
    if (errorDescription) {
        lines.push(`Error: ${errorDescription}`);
    }

    return lines.join('\n');
}

async function reportPlaywriteOutcome(reportMessage, userInput) {
    appendToChatHistory({ role: 'user', content: reportMessage });

    const messages = [{ role: 'system', content: systemPrompt }, ...chatHistory];
    const aiText = await fetchPollinationsText(messages);
    return processAiReply(aiText, { userInput });
}

async function handlePlaywriteAbility(options = {}) {
    const userInput = typeof options.userInput === 'string' ? options.userInput : '';

    let plan;
    let planError = null;

    try {
        plan = await requestPlaywritePlan();
    } catch (error) {
        planError = error;
    }

    if (!plan) {
        const failureReport = formatPlaywriteFailureReport({ stage: 'plan', plan: null, error: planError });

        try {
            await reportPlaywriteOutcome(failureReport, userInput);
        } catch (reportError) {
            console.error('Failed to report Playwrite planning error:', reportError);
            speak('I could not gather details for Playwrite.');
        }

        return true;
    }

    let findings = null;
    let executionError = null;

    try {
        findings = await executePlaywritePlan(plan);
    } catch (error) {
        executionError = error;
    }

    const reportMessage = findings
        ? formatPlaywriteResultsForAI(plan, findings)
        : formatPlaywriteFailureReport({ stage: 'execution', plan, error: executionError });

    try {
        await reportPlaywriteOutcome(reportMessage, userInput);
    } catch (error) {
        console.error('Failed to report Playwrite results:', error);
        speak('I ran into trouble sharing the Playwrite findings.');
    }

    return true;
}

function getImageUrl() {
    if (currentHeroUrl) {
        return currentHeroUrl;
    }

    if (heroImage?.getAttribute('src')) {
        return heroImage.getAttribute('src');
    }

    return '';
}

function updateHeroImage(imageUrl) {
    if (!heroStage || !heroImage || !imageUrl) {
        return Promise.resolve(false);
    }

    heroStage.classList.add('is-visible');

    if (imageUrl === currentHeroUrl && heroStage.dataset.state === 'loaded') {
        heroStage.setAttribute('aria-hidden', heroStage.classList.contains('has-image') ? 'false' : 'true');
        return Promise.resolve(true);
    }

    heroStage.setAttribute('aria-hidden', 'true');

    const hadImage = heroStage.classList.contains('has-image');

    pendingHeroUrl = imageUrl;
    heroStage.dataset.state = 'loading';
    if (!hadImage) {
        heroStage.classList.remove('has-image');
        heroImage.removeAttribute('src');
    }

    return new Promise((resolve) => {
        const image = new Image();
        image.decoding = 'async';
        image.crossOrigin = 'anonymous';

        image.onload = () => {
            if (pendingHeroUrl !== imageUrl) {
                resolve(false);
                return;
            }

            currentHeroUrl = imageUrl;
            pendingHeroUrl = '';
            heroImage.src = imageUrl;
            heroStage.dataset.state = 'loaded';
            heroStage.classList.add('has-image');
            heroStage.setAttribute('aria-hidden', 'false');
            resolve(true);
        };

        image.onerror = (error) => {
            if (pendingHeroUrl === imageUrl) {
                pendingHeroUrl = '';
            }
            if (!hadImage) {
                heroStage.dataset.state = 'error';
                heroStage.classList.remove('has-image');
                heroImage.removeAttribute('src');
                heroStage.setAttribute('aria-hidden', 'true');
            } else {
                heroStage.dataset.state = 'loaded';
                heroStage.setAttribute('aria-hidden', 'false');
            }
            console.error('Failed to load hero image:', error);
            resolve(false);
        };

        image.src = imageUrl;
    });
}

async function copyImageToClipboard(imageUrlOverride) {
    const imageUrl = imageUrlOverride || getImageUrl() || pendingHeroUrl;
    if (!imageUrl) {
        return;
    }

    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        speak('Image copied to clipboard.');
    } catch (error) {
        console.error('Failed to copy image: ', error);
        speak('Sorry, I could not copy the image. This might be due to browser limitations.');
    }
}

async function saveImage(imageUrlOverride) {
    const imageUrl = imageUrlOverride || getImageUrl() || pendingHeroUrl;
    if (!imageUrl) {
        return;
    }

    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.style.display = 'none';
        link.href = url;
        link.download = 'pollination_image.png';
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
        speak('Image saved.');
    } catch (error) {
        console.error('Failed to save image: ', error);
        speak('Sorry, I could not save the image.');
    }
}

function openImageInNewTab(imageUrlOverride) {
    const imageUrl = imageUrlOverride || getImageUrl() || pendingHeroUrl;
    if (!imageUrl) {
        return;
    }

    window.open(imageUrl, '_blank');
    speak('Image opened in new tab.');
}

if (!launchButton && !landingSection) {
    startApplication().catch((error) => {
        console.error('Failed to auto-start the Unity voice experience:', error);
    });
}

if (typeof window !== 'undefined') {
    const setMutedStateHandler = setMutedState;
    window.setMutedState = (muted, options) => setMutedStateHandler(muted, options);

    Object.defineProperty(window, '__unityTestHooks', {
        value: {
            isAppReady: () => appStarted,
            getChatHistory: () => chatHistory.map((entry) => ({ ...entry })),
            getCurrentHeroImage: () => getImageUrl(),
            setHeroImage: (dataUrl) => updateHeroImage(dataUrl),
            sendUserInput: async (input) => {
                if (typeof input !== 'string' || !input.trim()) {
                    return { error: new Error('Input must be a non-empty string.') };
                }

                if (!appStarted) {
                    await startApplication();
                }

                return getAIResponse(input.trim());
            }
        },
        configurable: true,
        enumerable: false
    });
}
