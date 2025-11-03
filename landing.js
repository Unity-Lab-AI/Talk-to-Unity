(() => {
    const dependencyLight = document.querySelector('[data-role="dependency-light"]');
    const dependencySummary = document.getElementById('dependency-summary');
    const dependencyList = document.getElementById('dependency-list');
    const launchButton = document.getElementById('launch-app');
    const recheckButton = document.getElementById('recheck-dependencies');
    const statusMessage = document.getElementById('status-message');

    const speechSynthesisInstance = window.speechSynthesis;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;

    const LOOPBACK_HOST_PATTERN = /^(?:localhost|127(?:\.\d{1,3}){3}|::1|\[::1\])$/;

    const dependencyChecks = [
        {
            id: 'secure-context',
            label: 'Secure connection (HTTPS or localhost)',
            friendlyName: 'secure connection light',
            check: () => Boolean(window.isSecureContext) || LOOPBACK_HOST_PATTERN.test(window.location.hostname)
        },
        {
            id: 'speech-recognition',
            label: 'Web Speech Recognition API',
            friendlyName: 'speech listening light',
            check: () => {
                const userAgent = (navigator.userAgent || '').toLowerCase();
                if (userAgent.includes('firefox')) {
                    // Firefox uses a fallback implementation (Vosklet) inside the application.
                    return true;
                }
                return Boolean(SpeechRecognition);
            }
        },
        {
            id: 'speech-synthesis',
            label: 'Speech synthesis voices',
            friendlyName: 'talk-back voice light',
            check: () => Boolean(speechSynthesisInstance && typeof speechSynthesisInstance.speak === 'function')
        },
        {
            id: 'microphone',
            label: 'Microphone access',
            friendlyName: 'microphone light',
            check: () => Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
        }
    ];

    let landingInitialized = false;

    function setStatusMessage(message, tone = 'info') {
        if (!statusMessage) return;
        statusMessage.textContent = message || '';
        if (message) {
            statusMessage.dataset.tone = tone;
        } else {
            delete statusMessage.dataset.tone;
        }
    }

    function formatDependencyList(items) {
        const labels = (items || [])
            .map((item) => item.friendlyName ?? item.label ?? item.id)
            .filter(Boolean);
        if (labels.length === 0) return '';
        if (labels.length === 1) return labels[0];
        const head = labels.slice(0, -1).join(', ');
        const tail = labels[labels.length - 1];
        return `${head} and ${tail}`;
    }

    function getDependencyStatuses(item) {
        if (!item) return { passStatus: 'Ready', failStatus: 'Check settings' };
        const { passStatus = 'Ready', failStatus = 'Check settings' } = item.dataset;
        return { passStatus, failStatus };
    }

    function updateLaunchButtonState({ allMet, missing }) {
        if (!launchButton) return;
        launchButton.disabled = false;
        launchButton.setAttribute('aria-disabled', 'false');
        launchButton.dataset.state = allMet ? 'ready' : 'warn';
        if (missing.length > 0) {
            const summary = formatDependencyList(missing);
            launchButton.title = summary
                ? `Talk to Unity with limited support: ${summary}`
                : 'Talk to Unity with limited support';
        } else {
            launchButton.removeAttribute('title');
        }
    }

    function showRecheckInProgress() {
        if (launchButton) {
            launchButton.disabled = true;
            launchButton.setAttribute('aria-disabled', 'true');
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

    function ensureTrailingSlash(value) {
        if (typeof value !== 'string' || !value) return '';
        return value.endsWith('/') ? value : `${value}/`;
    }

    function resolveAppLaunchUrl() {
        const explicitLaunchHref = launchButton?.getAttribute('data-launch-url') || launchButton?.getAttribute('href');
        if (explicitLaunchHref) {
            try {
                return new URL(explicitLaunchHref, window.location.href).toString();
            } catch (error) {
                console.warn('Failed to resolve launch URL from link element. Falling back to computed base.', error);
            }
        }

        const configuredBase =
            typeof window.__talkToUnityAssetBase === 'string' && window.__talkToUnityAssetBase
                ? window.__talkToUnityAssetBase
                : '';
        let base = ensureTrailingSlash(configuredBase);

        if (!base) {
            try {
                base = ensureTrailingSlash(new URL('./', window.location.href).toString());
            } catch (error) {
                console.warn('Unable to determine Talk to Unity base path. Falling back to relative navigation.', error);
                base = '';
            }
        }

        const fallbackPath = './AI/index.html';

        try {
            return new URL(fallbackPath, base || window.location.href).toString();
        } catch (error) {
            console.warn('Failed to resolve Talk to Unity application URL. Using a relative fallback.', error);
            return fallbackPath;
        }
    }

    function syncLaunchButtonHref() {
        if (!launchButton) return;
        const resolvedHref = resolveAppLaunchUrl();
        if (!resolvedHref) return;

        try {
            const currentHref = launchButton.href;
            if (currentHref !== resolvedHref) {
                launchButton.href = resolvedHref;
            }
        } catch (error) {
            console.warn('Failed to sync launch button href. Using attribute fallback.', error);
            launchButton.setAttribute('href', resolvedHref);
        }
    }

    function handleLaunchEvent(event) {
        const detail = event?.detail ?? {};
        const { allMet = false, missing = [] } = detail;
        if (typeof window !== 'undefined') {
            window.__talkToUnityLaunchIntent = detail;
        }

        const summary = formatDependencyList(missing);
        const tone = allMet ? 'success' : 'warning';
        const launchMessage = allMet
            ? 'All systems look good. Launching Talk to Unity…'
            : summary
            ? `Launching Talk to Unity. Some features may be limited until we resolve: ${summary}.`
            : 'Launching Talk to Unity. Some features may be limited because certain capabilities are unavailable.';

        setStatusMessage(launchMessage, tone);
        document.cookie = 'checks-passed=true;path=/';
        if (dependencyLight) {
            dependencyLight.setAttribute(
                'aria-label',
                allMet
                    ? 'All dependencies satisfied. Launching Talk to Unity'
                    : summary
                    ? `Launching with limited functionality: ${summary}`
                    : 'Launching with limited functionality'
            );
        }

        if (launchButton) {
            launchButton.disabled = true;
            launchButton.setAttribute('aria-disabled', 'true');
            launchButton.dataset.state = 'pending';
        }

        const appRoot = document.getElementById('app-root');
        const landingPage = document.getElementById('landing');
        if (appRoot && landingPage) {
            landingPage.setAttribute('hidden', 'true');
            appRoot.removeAttribute('hidden');
            document.body?.setAttribute('data-app-state', 'experience');
        } else {
            syncLaunchButtonHref();
            const launchUrl = launchButton?.href || resolveAppLaunchUrl();
            if (launchUrl) {
                window.location.href = launchUrl;
            }
        }
    }

    function handleLaunchButtonClick(event) {
        if (event) {
            event.preventDefault();
        }
        const result = evaluateDependencies({ announce: true });
        if (!result) return;
        const { allMet, missing, results } = result;
        const launchEvent = new CustomEvent('talk-to-unity:launch', {
            detail: { allMet, missing, results }
        });
        window.dispatchEvent(launchEvent);
    }

    function handleRecheckClick() {
        showRecheckInProgress();
        evaluateDependencies({ announce: true });
    }

    function updateDependencyUI(results, allMet, { missing = [] } = {}) {
        if (dependencyList) {
            results.forEach((result) => {
                const item = dependencyList.querySelector(`[data-dependency="${result.id}"]`);
                if (!item) return;
                item.dataset.state = result.met ? 'pass' : 'fail';
                const statusElement = item.querySelector('.dependency-status');
                if (statusElement) {
                    const { passStatus, failStatus } = getDependencyStatuses(item);
                    statusElement.textContent = result.met ? passStatus : failStatus;
                }
            });
        }

        const summary = formatDependencyList(missing);

        if (dependencyLight) {
            dependencyLight.dataset.state = allMet ? 'pass' : 'fail';
            dependencyLight.setAttribute(
                'aria-label',
                allMet
                    ? 'All dependencies satisfied'
                    : summary
                    ? `Missing requirements: ${summary}`
                    : 'Missing requirements detected'
            );
        }

        if (dependencySummary) {
            if (missing.length === 0) {
                dependencySummary.textContent = 'All the lights are green! Press "Talk to Unity" to start chatting.';
            } else {
                dependencySummary.textContent = summary
                    ? `Alerts: ${summary}. You can still launch, but features may be limited until these are resolved.`
                    : 'Alerts detected. You can still launch, but features may be limited.';
            }
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
            return { ...descriptor, met };
        });

        const missing = results.filter((result) => !result.met);
        const allMet = missing.length === 0;
        updateDependencyUI(results, allMet, { missing });
        updateLaunchButtonState({ allMet, missing });

        if (announce) {
            if (allMet) {
                setStatusMessage('All systems look good. Launching Talk to Unity…', 'success');
            } else {
                const summary = formatDependencyList(missing);
                setStatusMessage(
                    summary
                        ? `Some browser features are unavailable: ${summary}. You can continue, but certain Unity abilities may be limited.`
                        : 'Some browser features are unavailable. You can continue, but certain Unity abilities may be limited.',
                    'warning'
                );
            }
        } else if (allMet && statusMessage?.textContent) {
            setStatusMessage('');
        }

        return { results, allMet, missing };
    }

    function bootstrapLandingExperience() {
        if (landingInitialized) return;
        landingInitialized = true;
        evaluateDependencies();
        launchButton?.addEventListener('click', handleLaunchButtonClick);
        recheckButton?.addEventListener('click', handleRecheckClick);
        syncLaunchButtonHref();
    }

    document.addEventListener('DOMContentLoaded', bootstrapLandingExperience);
    if (document.readyState !== 'loading') {
        bootstrapLandingExperience();
    }

    window.addEventListener('talk-to-unity:launch', handleLaunchEvent);
    window.addEventListener('focus', () => evaluateDependencies());
    window.addEventListener('load', () => {
        evaluateDependencies();
        syncLaunchButtonHref();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            evaluateDependencies();
            syncLaunchButtonHref();
        }
    });
})();
