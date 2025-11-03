window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
window.LOOPBACK_HOST_PATTERN = /^(?:localhost|127(?:\.\d{1,3}){3}|::1|\[::1\])$/i;

window.launchButton = document.getElementById('launch-app');

window.dependencyList = document.getElementById('dependency-list');
window.dependencyLight = document.querySelector('[data-role="dependency-light"]');
window.dependencySummary = document.getElementById('dependency-summary');
window.statusMessage = document.getElementById('status-message');

const dependencyChecks = [
    {
        id: 'secure-context',
        label: 'Secure connection (HTTPS or localhost)',
        friendlyName: 'secure connection light',
        check: () =>
            Boolean(window.isSecureContext) || window.LOOPBACK_HOST_PATTERN.test(window.location.hostname)
    },
    {
        id: 'speech-recognition',
        label: 'Web Speech Recognition API',
        friendlyName: 'speech listening light',
        check: () => {
            const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
            // Firefox uses Vosklet fallback
            return Boolean(window.SpeechRecognition) || isFirefox;
        }
    },
    {
        id: 'speech-synthesis',
        label: 'Speech synthesis voices',
        friendlyName: 'talk-back voice light',
        check: () => typeof window.synth !== 'undefined' && typeof window.synth.speak === 'function'
    },
    {
        id: 'microphone',
        label: 'Microphone access',
        friendlyName: 'microphone light',
        check: () => Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    }
];

window.evaluateDependencies = function evaluateDependencies({ announce = false } = {}) {
    const results = dependencyChecks.map((descriptor) => {
        let met = false;
        try {
            met = Boolean(descriptor.check());
        } catch (error) {
            console.error(`Dependency check failed for ${descriptor.id}:`, error);
        }
        return { ...descriptor, met };
    });

    const missing = results.filter((r) => !r.met);
    const allMet = missing.length === 0;
    window.updateDependencyUI(results, allMet, { announce, missing });
    window.updateLaunchButtonState({ allMet, missing });

    if (announce) {
        if (allMet) window.setStatusMessage('All systems look good. Launching Talk to Unity…', 'success');
        else {
            const summary = window.formatDependencyList(missing);
            window.setStatusMessage(
                summary
                    ? `Some browser features are unavailable: ${summary}. You can continue, but certain Unity abilities may be limited.`
                    : 'Some browser features are unavailable. You can continue, but certain Unity abilities may be limited.',
                'warning'
            );
        }
    } else if (!allMet) {
        const summary = window.formatDependencyList(missing);
        window.setStatusMessage(
            summary
                ? `Some browser features are unavailable: ${summary}. You can continue, but certain Unity abilities may be limited.`
                : 'Some browser features are unavailable. You can continue, but certain Unity abilities may be limited.',
            'warning'
        );
    } else {
        window.setStatusMessage('');
    }

    return { results, allMet, missing };
};

window.updateDependencyUI = function updateDependencyUI(results, allMet, { announce = false, missing = [] } = {}) {
    if (window.dependencyList) {
        results.forEach((result) => {
            const item = window.dependencyList.querySelector(`[data-dependency="${result.id}"]`);
            if (!item) return;
            item.dataset.state = result.met ? 'pass' : 'fail';
            const statusElement = item.querySelector('.dependency-status');
            if (statusElement) {
                const { passStatus, failStatus } = window.getDependencyStatuses(item);
                statusElement.textContent = result.met ? passStatus : failStatus;
            }
        });
    }

    if (window.dependencyLight) {
        window.dependencyLight.dataset.state = allMet ? 'pass' : 'fail';
        const summary = window.formatDependencyList(missing);
        window.dependencyLight.setAttribute(
            'aria-label',
            allMet ? 'All dependencies satisfied' : `Missing requirements: ${summary}`
        );
    }

    if (window.dependencySummary) {
        if (missing.length === 0)
            window.dependencySummary.textContent = 'All the lights are green! Press "Talk to Unity" to start chatting.';
        else {
            const summary = window.formatDependencyList(missing);
            window.dependencySummary.textContent = summary
                ? `Alerts: ${summary}. You can still launch, but features may be limited until these are resolved.`
                : 'Alerts detected. You can still launch, but features may be limited.';
        }
    }

    if (!announce && !allMet) window.setStatusMessage('');
};

window.getDependencyStatuses = function getDependencyStatuses(item) {
    return {
        passStatus: item.dataset.passStatus || 'Ready',
        failStatus: item.dataset.failStatus || 'Unavailable'
    };
};

window.formatDependencyList = function formatDependencyList(missing) {
    if (!missing || missing.length === 0) return '';
    if (missing.length === 1) return missing[0].friendlyName || missing[0].label;
    const last = missing[missing.length - 1];
    const rest = missing.slice(0, -1);
    return `${rest.map((item) => item.friendlyName || item.label).join(', ')}, and ${last.friendlyName || last.label}`;
};

window.setStatusMessage = function setStatusMessage(message, state = 'neutral') {
    if (!window.statusMessage) return;
    window.statusMessage.textContent = message;
    window.statusMessage.dataset.state = state;
};

window.updateLaunchButtonState = function updateLaunchButtonState({ allMet, missing = [] }) {
    if (!window.launchButton) return;
    const allowLaunch = missing.length < dependencyChecks.length;
    window.launchButton.disabled = !allowLaunch;
    window.launchButton.setAttribute('aria-disabled', String(!allowLaunch));
    if (allowLaunch) {
        window.launchButton.dataset.state = allMet ? 'ready' : 'warn';
    } else {
        delete window.launchButton.dataset.state;
    }
};

window.handleLaunchButtonClick = function handleLaunchButtonClick(event) {
    console.log('handleLaunchButtonClick event:', event);
    event.preventDefault(); // Prevent default button behavior (e.g., scrolling)
    const result = window.evaluateDependencies({ announce: true });
    if (!result) return;
    const { allMet, missing, results } = result;
    window.dispatchEvent(new CustomEvent('talk-to-unity:launch', { detail: { allMet, missing, results } }));
}

window.initializeSharedDependencies = function() {
    window.synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    window.evaluateDependencies();
    const recheckButton = document.getElementById('recheck-dependencies');
    recheckButton?.addEventListener('click', () => {
        window.evaluateDependencies({ announce: true });
    });
    window.launchButton?.addEventListener('click', (event) => {
        handleLaunchButtonClick(event);
    });
    window.addEventListener('focus', () => {
        if (!window.appStarted) {
            window.evaluateDependencies();
        }
    });
};