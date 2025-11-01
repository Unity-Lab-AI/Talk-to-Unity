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

document.addEventListener('DOMContentLoaded', () => {
    evaluateDependencies();

    launchButton?.addEventListener('click', () => {
        const { allMet } = evaluateDependencies({ announce: true });
        if (allMet) {
            // Set a cookie to indicate that the checks have passed
            document.cookie = "checks-passed=true;path=/";
            // Redirect to the AI page relative to the current location so the
            // experience keeps working when the site is hosted from a
            // subdirectory (such as GitHub Pages).
            const launchUrl = new URL('./AI/index.html', window.location.href);
            window.location.assign(launchUrl.toString());
        }
    });

    recheckButton?.addEventListener('click', () => {
        showRecheckInProgress();
        evaluateDependencies({ announce: true });
    });
});

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
            dependencySummary.textContent = 'All the lights are green! Press "Talk to Unity" to start chatting.';
        } else {
            const summary = formatDependencyList(missing);
            dependencySummary.textContent = summary
                ? `We spotted a few red lights (${summary}). Talk to Unity will still launch, but those features may be limited until they turn green.`
                : 'We spotted a few red lights. Talk to Unity will still launch, but some features may be limited.';
        }
    }

    if (!announce && !allMet) {
        setStatusMessage('');
    }
}
