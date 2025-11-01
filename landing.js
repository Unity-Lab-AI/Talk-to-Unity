const bodyElement = document.body;
if (bodyElement) {
    bodyElement.classList.remove('no-js');
    bodyElement.classList.add('js-enabled');
    if (!bodyElement.dataset.appState) {
        bodyElement.dataset.appState = 'landing';
    }
}

const dependencyLight = document.querySelector('[data-role="dependency-light"]');
const dependencySummary = document.getElementById('dependency-summary');
const dependencyList = document.getElementById('dependency-list');
const launchButton = document.getElementById('launch-app');
const recheckButton = document.getElementById('recheck-dependencies');
const statusMessage = document.getElementById('status-message');

const dependencyChecks = [
    {
        id: 'secure-context',
        label: 'Secure connection (HTTPS or localhost)',
        friendlyName: 'secure connection light',
        check: () =>
            Boolean(window.isSecureContext) ||
            /^localhost$|^127(?:\.\d{1,3}){3}$|^\[::1\]$/.test(window.location.hostname)
    },
    {
        id: 'speech-recognition',
        label: 'Web Speech Recognition API',
        friendlyName: 'speech listening light',
        check: () => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
    },
    {
        id: 'speech-synthesis',
        label: 'Speech synthesis voices',
        friendlyName: 'talk-back voice light',
        check: () => typeof window.speechSynthesis !== 'undefined' && typeof window.speechSynthesis.speak === 'function'
    },
    {
        id: 'microphone',
        label: 'Microphone access',
        friendlyName: 'microphone light',
        check: () => Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    }
];

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
        launchButton.title = `Launch anyway with limited support: ${summary}`;
    } else {
        launchButton.removeAttribute('title');
    }
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

    if (announce) {
        if (allMet) {
            setStatusMessage('All systems look good. Launching Unity Voice Lab…', 'success');
        } else {
            const summary = formatDependencyList(missing);
            setStatusMessage(
                summary
                    ? `Launching in compatibility mode. Some features may be limited: ${summary}.`
                    : 'Launching in compatibility mode. Some browser features may be limited.',
                'warning'
            );
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

            item.dataset.state = result.met ? 'pass' : 'warn';
            const statusElement = item.querySelector('.dependency-status');
            if (statusElement) {
                statusElement.textContent = result.met ? 'Ready' : 'Check settings';
            }
        });
    }

    if (dependencyLight) {
        dependencyLight.dataset.state = allMet ? 'pass' : 'warn';
        const summary = formatDependencyList(missing);
        dependencyLight.setAttribute(
            'aria-label',
            allMet
                ? 'All dependencies satisfied'
                : summary
                ? `Compatibility mode enabled because ${summary} is unavailable`
                : 'Compatibility mode enabled. Some requirements are missing'
        );
    }

    if (dependencySummary) {
        if (missing.length === 0) {
            dependencySummary.textContent =
                'All the lights are green! Press "Launch Unity Voice Lab" to start chatting.';
        } else {
            const summary = formatDependencyList(missing);
            dependencySummary.textContent = summary
                ? `We spotted a few red lights (${summary}). Unity will still launch, but those features may be limited until they turn green.`
                : 'We spotted a few red lights. Unity will still launch, but some features may be limited.';
        }
    }

    if (!announce && !allMet) {
        setStatusMessage('');
    }
}

function redirectToExperience() {
    const targetUrl = new URL('./AI/', window.location.href);
    window.location.assign(targetUrl.toString());
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const redirected = params.get('missing');
    if (redirected && statusMessage) {
        setStatusMessage(
            'We redirected you back here because one or more requirements were missing. Review the tips below and run the check again.',
            'warning'
        );
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    evaluateDependencies();

    launchButton?.addEventListener('click', () => {
        const { allMet } = evaluateDependencies({ announce: true });
        const delay = allMet ? 120 : 360;
        window.setTimeout(() => {
            redirectToExperience();
        }, delay);
    });

    recheckButton?.addEventListener('click', () => {
        evaluateDependencies({ announce: true });
    });
});

window.addEventListener('focus', () => {
    evaluateDependencies();
});
