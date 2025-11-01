const dependencyLight = document.querySelector('[data-role="dependency-light"]');
const dependencySummary = document.getElementById('dependency-summary');
const dependencyList = document.getElementById('dependency-list');
const launchButton = document.getElementById('launch-app');
const recheckButton = document.getElementById('recheck-dependencies');
const statusMessage = document.getElementById('status-message');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;

const LOOPBACK_HOST_PATTERN = /^(?:localhost|127(?:\.\d{1,3}){3}|::1|\[::1\])$/;

const dependencyChecks = [
    {
        id: 'secure-context',
        label: 'Secure connection (HTTPS or localhost)',
        friendlyName: 'secure connection light',
        check: () =>
            Boolean(window.isSecureContext) || LOOPBACK_HOST_PATTERN.test(window.location.hostname)
    },
    {
        id: 'speech-recognition',
        label: 'Web Speech Recognition API',
        friendlyName: 'speech listening light',
        check: () => Boolean(SpeechRecognition)
    },
    {
        id: 'speech-synthesis',
        label: 'Speech synthesis voices',
        friendlyName: 'talk-back voice light',
        check: () => typeof synth !== 'undefined' && typeof synth.speak === 'function'
    },
    {
        id: 'microphone',
        label: 'Microphone access',
        friendlyName: 'microphone light',
        check: () => Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    }
];

let landingInitialized = false;

function formatDependencyList(items) {
    const labels = items
        .map((item) => item.friendlyName ?? item.label ?? item.id)
        .filter(Boolean);

    if (labels.length === 0) {
        return '';
    }

    if (labels.length === 1) {
        return labels[0];
    }

    const head = labels.slice(0, -1).join(', ');
    const tail = labels[labels.length - 1];
    return `${head} and ${tail}`;
}

function getDependencyStatuses(item) {
    if (!item) {
        return {
            passStatus: 'Ready',
            failStatus: 'Check settings'
        };
    }

    const { passStatus = 'Ready', failStatus = 'Check settings' } = item.dataset;
    return { passStatus, failStatus };
}

function setStatusMessage(message, tone = 'info') {
    if (!statusMessage) {
        return;
    }

    statusMessage.textContent = message;
    if (message) {
        statusMessage.dataset.tone = tone;
    } else {
        delete statusMessage.dataset.tone;
    }
}

function updateLaunchButtonState({ allMet, missing }) {
    if (!launchButton) {
        return;
    }

    launchButton.disabled = false;
    launchButton.setAttribute('aria-disabled', 'false');
    launchButton.dataset.state = allMet ? 'ready' : 'warn';

    if (missing.length > 0) {
        const summary = formatDependencyList(missing);
        launchButton.title = `Talk to Unity with limited support: ${summary}`;
    } else {
        launchButton.removeAttribute('title');
    }
}

function showRecheckInProgress() {
    setLaunchButtonState(false);
    if (launchButton) {
        launchButton.dataset.state = 'pending';
    }

    if (dependencyLight) {
        dependencyLight.dataset.state = 'pending';
        dependencyLight.setAttribute('aria-label', 'Re-checking requirements');
    }

    if (dependencySummary) {
        dependencySummary.textContent = 'Re-checking your setup…';
    }

    if (dependencyList) {
        dependencyList.querySelectorAll('.dependency-item').forEach((item) => {
            item.dataset.state = 'pending';
            const statusElement = item.querySelector('.dependency-status');
            if (statusElement) {
                statusElement.textContent = 'Checking…';
            }
        });
    }

    setStatusMessage('Running the readiness scan again…', 'info');
}

function handleLaunchButtonClick() {
    const result = evaluateDependencies({ announce: true });
    if (!result) {
        return;
    }

    const { allMet, missing, results } = result;
    const mode = allMet ? 'standard' : 'compatibility';

    window.dispatchEvent(
        new CustomEvent('talk-to-unity:launch', {
            detail: { allMet, missing, results, mode }
        })
    );
}

function handleRecheckClick() {
    showRecheckInProgress();
    evaluateDependencies({ announce: true });
}

function bootstrapLandingExperience() {
    if (landingInitialized) {
        return;
    }

    landingInitialized = true;

    evaluateDependencies();

    launchButton?.addEventListener('click', handleLaunchButtonClick);
    recheckButton?.addEventListener('click', handleRecheckClick);
}

document.addEventListener('DOMContentLoaded', bootstrapLandingExperience);

if (document.readyState !== 'loading') {
    bootstrapLandingExperience();
}

function ensureTrailingSlash(value) {
    if (typeof value !== 'string' || !value) {
        return '';
    }
    return value.endsWith('/') ? value : `${value}/`;
}

function resolveAppLaunchUrl() {
    const configuredBase =
        typeof window.__talkToUnityAssetBase === 'string' && window.__talkToUnityAssetBase
            ? window.__talkToUnityAssetBase
            : '';

    let base = ensureTrailingSlash(configuredBase);

    if (!base) {
        try {
            base = ensureTrailingSlash(new URL('.', window.location.href).toString());
        } catch (error) {
            console.warn('Unable to determine Talk to Unity base path. Falling back to relative navigation.', error);
            base = '';
        }
    }

    try {
        return new URL('AI/index.html', base || window.location.href).toString();
    } catch (error) {
        console.warn('Failed to resolve Talk to Unity application URL. Using a relative fallback.', error);
        return 'AI/index.html';
    }
}

function handleLaunchEvent(event) {
    const detail = event?.detail ?? {};
    const { allMet = false, missing = [], mode = 'standard' } = detail;

    const launchUrl = resolveAppLaunchUrl();
    if (!launchUrl) {
        return;
    }

    const summary = formatDependencyList(missing);
    const launchMessage = allMet
        ? 'All systems look good. Redirecting to Talk to Unity…'
        : summary
        ? `Launching Talk to Unity in compatibility mode. Some features may be limited: ${summary}.`
        : 'Launching Talk to Unity in compatibility mode. Some features may be limited.';

    setStatusMessage(launchMessage, allMet ? 'success' : 'warning');

    document.cookie = 'checks-passed=true;path=/';

    if (mode === 'compatibility') {
        dependencyLight?.setAttribute('aria-label', 'Launching Talk to Unity in compatibility mode');
    }

    if (launchButton) {
        launchButton.disabled = true;
        launchButton.setAttribute('aria-disabled', 'true');
        launchButton.dataset.state = 'pending';
    }

    window.location.assign(launchUrl);
}

window.addEventListener('talk-to-unity:launch', handleLaunchEvent);

window.addEventListener('focus', () => {
    evaluateDependencies();
});

function setLaunchButtonState(allMet) {
    if (!launchButton) {
        return;
    }

    launchButton.disabled = !allMet;
    launchButton.setAttribute('aria-disabled', String(!allMet));
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

    const missing = results.filter((result) => !result.met);
    const allMet = missing.length === 0;

    updateDependencyUI(results, allMet, { announce, missing });
    updateLaunchButtonState({ allMet, missing });

    setLaunchButtonState(allMet);

    if (announce) {
        if (allMet) {
            setStatusMessage('All systems look good. Launching Talk to Unity…', 'success');
        } else {
            const summary = formatDependencyList(missing);
            const message = summary
                ? `Starting Talk to Unity in compatibility mode. Some features may be limited: ${summary}.`
                : 'Starting Talk to Unity in compatibility mode. Some browser features may be limited.';
            setStatusMessage(message, 'warning');
        }
    } else if (allMet && statusMessage?.textContent) {
        setStatusMessage('');
    }

    return { results, allMet, missing };
}

function updateDependencyUI(results, allMet, { announce = false, missing = [] } = {}) {
    if (dependencyList) {
        results.forEach((result) => {
            const item = dependencyList.querySelector(`[data-dependency="${result.id}"]`);
            if (!item) {
                return;
            }

            item.dataset.state = result.met ? 'pass' : 'fail';
            const statusElement = item.querySelector('.dependency-status');
            if (statusElement) {
                const { passStatus, failStatus } = getDependencyStatuses(item);
                statusElement.textContent = result.met ? passStatus : failStatus;
            }
        });
    }

    if (dependencyLight) {
        dependencyLight.dataset.state = allMet ? 'pass' : 'fail';
        const summary = formatDependencyList(missing);
        dependencyLight.setAttribute(
            'aria-label',
            allMet
                ? 'All dependencies satisfied'
                : summary
                ? `Missing requirements: ${summary}`
                : 'Missing one or more requirements'
        );
    }

    if (dependencySummary) {
        if (missing.length === 0) {
            dependencySummary.textContent = 'All the lights are green! Press "Talk to Unity" to start chatting.';
        } else {
            const summary = formatDependencyList(missing);
            dependencySummary.textContent = summary
                ? `Alerts: ${summary}. Follow the fix steps below, then press "Check again."`
                : 'Alerts detected. Follow the fix steps below, then press "Check again."';
        }
    }

    if (!announce && !allMet) {
        setStatusMessage('');
    }
}

if (typeof window !== 'undefined') {
    Object.defineProperty(window, '__unityLandingTestHooks', {
        value: {
            initialize: () => bootstrapLandingExperience(),
            evaluateDependencies: (options) => evaluateDependencies(options),
            markAllDependenciesReady: () => {
                const readyResults = dependencyChecks.map((descriptor) => ({ ...descriptor, met: true }));
                updateDependencyUI(readyResults, true, { announce: false, missing: [] });
                updateLaunchButtonState({ allMet: true, missing: [] });
                setLaunchButtonState(true);
            }
        },
        configurable: true,
        enumerable: false
    });
}
