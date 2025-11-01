const background = document.getElementById('background');
const backgroundImage = document.getElementById('background-image');
const muteIndicator = document.getElementById('mute-indicator');
const indicatorText = muteIndicator?.querySelector('.indicator-text') ?? null;
const aiCircle = document.querySelector('[data-role="ai"]');
const userCircle = document.querySelector('[data-role="user"]');

let currentImageModel = 'flux';
let chatHistory = [];
let systemPrompt = '';
let recognition = null;
let isMuted = true;
let hasMicPermission = false;
let currentBackgroundUrl = '';
let pendingBackgroundUrl = '';
let currentTheme = 'dark';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const synth = window.speechSynthesis;

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

window.addEventListener('load', async () => {
    applyTheme(currentTheme);
    await loadSystemPrompt();
    setupSpeechRecognition();
    updateMuteIndicator();
    await initializeVoiceControl();
    applyTheme(currentTheme, { force: true });
});

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

        if (!isMuted) {
            try {
                recognition.start();
            } catch (error) {
                console.error('Failed to restart recognition:', error);
                setCircleState(userCircle, {
                    error: true,
                    label: 'Unable to restart microphone recognition'
                });
            }
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
        });
}

function sanitizeForSpeech(text) {
    if (typeof text !== 'string') {
        return '';
    }

    const withoutPollinations = text
        .replace(/https?:\/\/\S*image\.pollinations\.ai\S*/gi, '')
        .replace(/\b\S*image\.pollinations\.ai\S*\b/gi, '');

    const withoutMarkdownTargets = removeMarkdownLinkTargets(withoutPollinations);

    const withoutGenericUrls = withoutMarkdownTargets
        .replace(/https?:\/\/\S+/gi, ' ')
        .replace(/\bwww\.[^\s)]+/gi, ' ');

    const withoutSpacedUrls = withoutGenericUrls
        .replace(/h\s*t\s*t\s*p\s*s?\s*:\s*\/\s*\/\s*[\w\-./?%#&=]+/gi, ' ')
        .replace(/\bhttps?\b/gi, ' ')
        .replace(/\bwww\b/gi, ' ');

    const parts = withoutSpacedUrls.split(/(\s+)/);
    const sanitizedParts = parts.map((part) => {
        if (isLikelyUrlSegment(part)) {
            return '';
        }

        if (/(?:https?|www|:\/\/|\.com|\.net|\.org|\.io|\.ai|\.co|\.gov|\.edu)/i.test(part)) {
            return '';
        }

        return part;
    });
    const sanitized = sanitizedParts
        .join('')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([.,!?;:])/g, '$1')
        .replace(/\(\s*\)/g, '')
        .replace(/\[\s*\]/g, '')
        .replace(/\{\s*\}/g, '')
        .replace(/\b(?:https?|www)\b/gi, '')
        .replace(/\b[a-z0-9]+\s+dot\s+[a-z0-9]+\b/gi, '')
        .replace(/\b(?:dot\s+)(?:com|net|org|io|ai|co|gov|edu|xyz)\b/gi, '')
        .trim();

    return sanitized;
}

function sanitizeImageUrl(rawUrl) {
    if (typeof rawUrl !== 'string') {
        return '';
    }

    return rawUrl
        .trim()
        .replace(/^["'<\[(]+/, '')
        .replace(/["'>)\]]+$/, '')
        .replace(/[,.;!]+$/, '');
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

function normalizeCommandValue(value) {
    return value.replace(/[\s-]+/g, '_').trim().toLowerCase();
}

function parseAiDirectives(responseText) {
    if (typeof responseText !== 'string' || responseText.trim() === '') {
        return { cleanedText: '', commands: [] };
    }

    const commands = [];
    const cleanedText = responseText
        .replace(/\[command:\s*([^\]]+)\]/gi, (_match, commandValue) => {
            if (commandValue) {
                const normalized = normalizeCommandValue(commandValue);
                if (normalized) {
                    commands.push(normalized);
                }
            }
            return '';
        })
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return { cleanedText, commands };
}

async function executeAiCommand(command) {
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
            await copyImageToClipboard();
            return true;
        case 'save_image':
            await saveImage();
            return true;
        case 'open_image':
            openImageInNewTab();
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

function shouldUseUnityReferrer() {
    if (typeof window === 'undefined') {
        return true;
    }

    try {
        const unityOrigin = new URL(UNITY_REFERRER).origin;
        return window.location.origin === unityOrigin;
    } catch (error) {
        console.error('Failed to parse UNITY_REFERRER:', error);
        return false;
    }
}

async function getAIResponse(userInput) {
    console.log(`Sending to AI: ${userInput}`);

    chatHistory.push({ role: 'user', content: userInput });

    if (chatHistory.length > 12) {
        chatHistory.splice(0, chatHistory.length - 12);
    }

    let aiText = '';

    try {
        const messages = [{ role: 'system', content: systemPrompt }, ...chatHistory];

        const pollinationsPayload = JSON.stringify({
            messages,
            model: 'unity'
        });

        const useUnityReferrer = shouldUseUnityReferrer();

        if (!useUnityReferrer) {
            console.warn(
                'Pollinations referrer header disabled because the app is not '
                + 'being served from https://www.unityailab.com/'
            );
        }

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
            body: pollinationsPayload,
            ...(useUnityReferrer
                ? {}
                : {
                      referrer: 'no-referrer',
                      referrerPolicy: 'no-referrer'
                  })
        });

        if (!textResponse.ok) {
            throw new Error(`Pollinations text API returned ${textResponse.status}`);
        }

        const data = await textResponse.json();
        aiText = data.choices?.[0]?.message?.content ?? '';

        if (!aiText) {
            throw new Error('Received empty response from Pollinations AI');
        }

        const { cleanedText, commands } = parseAiDirectives(aiText);

        for (const command of commands) {
            await executeAiCommand(command);
        }

        const assistantMessage = cleanedText || aiText;
        chatHistory.push({ role: 'assistant', content: assistantMessage });

        const shouldSuppressSpeech = commands.includes('shutup') || commands.includes('stop_speaking');

        if (!shouldSuppressSpeech) {
            const spokenText = sanitizeForSpeech(assistantMessage);
            if (spokenText) {
                speak(spokenText);
            }
        }

        const imageUrlFromResponse = extractImageUrl(aiText) || extractImageUrl(assistantMessage);
        if (imageUrlFromResponse) {
            updateBackgroundImage(imageUrlFromResponse);
        }
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
    }
}

function getImageUrl() {
    if (currentBackgroundUrl) {
        return currentBackgroundUrl;
    }

    if (backgroundImage?.getAttribute('src')) {
        return backgroundImage.getAttribute('src');
    }

    return '';
}

function updateBackgroundImage(imageUrl) {
    if (!background || !backgroundImage || !imageUrl) {
        return;
    }

    if (imageUrl === currentBackgroundUrl && background.dataset.state === 'loaded') {
        return;
    }

    const hadImage = background.classList.contains('has-image');

    pendingBackgroundUrl = imageUrl;
    background.dataset.state = 'loading';
    if (!hadImage) {
        background.classList.remove('has-image');
        backgroundImage.removeAttribute('src');
    }

    const image = new Image();
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';

    image.onload = () => {
        if (pendingBackgroundUrl !== imageUrl) {
            return;
        }

        currentBackgroundUrl = imageUrl;
        pendingBackgroundUrl = '';
        backgroundImage.src = imageUrl;
        background.dataset.state = 'loaded';
        background.classList.add('has-image');
    };

    image.onerror = (error) => {
        if (pendingBackgroundUrl === imageUrl) {
            pendingBackgroundUrl = '';
        }
        if (!hadImage) {
            background.dataset.state = 'error';
            background.classList.remove('has-image');
            backgroundImage.removeAttribute('src');
        } else {
            background.dataset.state = 'loaded';
        }
        console.error('Failed to load background image:', error);
    };

    image.src = imageUrl;
}

async function copyImageToClipboard() {
    const imageUrl = getImageUrl();
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

async function saveImage() {
    const imageUrl = getImageUrl();
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

function openImageInNewTab() {
    const imageUrl = getImageUrl();
    if (!imageUrl) {
        return;
    }

    window.open(imageUrl, '_blank');
    speak('Image opened in new tab.');
}
