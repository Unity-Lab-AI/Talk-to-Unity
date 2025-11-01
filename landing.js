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
        launchButton.disabled = !allMet;
        launchButton.setAttribute('aria-disabled', String(!allMet));
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
                'All the lights are green! Press "Launch Unity Voice Lab" to start chatting.';
        } else {
            const firstMissing = unmet[0];
            const friendlyName = firstMissing?.friendlyName ?? firstMissing?.label ?? 'missing light';
            dependencySummary.textContent = `The ${friendlyName} is still red. Follow the tip below, then press "Check again."`;
        }
    }

    if (announce && !allMet) {
        const missingNames = results
            .filter((result) => !result.met)
            .map((result) => result.friendlyName ?? result.label)
            .join(', ');

        if (statusMessage) {
            statusMessage.textContent = missingNames
                ? `Still missing: ${missingNames}. Work through the tips below and try again.`
                : 'One or more requirements are still missing. Please review the tips and try again.';
        }
    } else if (statusMessage) {
        statusMessage.textContent = '';
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
        statusMessage.textContent =
            'We redirected you back here because one or more requirements were missing. Review the tips below and run the check again.';
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    evaluateDependencies();

    launchButton?.addEventListener('click', () => {
        const { allMet } = evaluateDependencies({ announce: true });
        if (!allMet) {
            return;
        }

        redirectToExperience();
    });

    recheckButton?.addEventListener('click', () => {
        evaluateDependencies({ announce: true });
    });
});

window.addEventListener('focus', () => {
    evaluateDependencies();
});
