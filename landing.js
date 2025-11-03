(() => {
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
            check: () => {
                const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
                // Firefox uses Vosklet fallback
                return Boolean(SpeechRecognition) || isFirefox;
            }
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
    const dependencyOverrides = new Map();

    function clearDependencyOverrides() {
        dependencyOverrides.clear();
    }

    function setDependencyOverride(id, met) {
        if (!id) return;
        dependencyOverrides.set(id, Boolean(met));
    }

    function getDependencyOverride(id) {
        return dependencyOverrides.has(id) ? dependencyOverrides.get(id) : undefined;
    }

    function formatDependencyList(items) {
        const labels = items.map((item) => item.friendlyName ?? item.label ?? item.id).filter(Boolean);
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

    function setStatusMessage(message, tone = 'info') {
        if (!statusMessage) return;
        statusMessage.textContent = message;
        if (message) statusMessage.dataset.tone = tone;
        else delete statusMessage.dataset.tone;
    }

    function updateLaunchButtonState({ allMet, missing }) {
        if (!launchButton) return;

        const shouldDisable = !allMet;
        launchButton.disabled = shouldDisable;
        launchButton.setAttribute('aria-disabled', String(shouldDisable));
        launchButton.dataset.state = allMet ? 'ready' : 'warn';

        if (shouldDisable) {
            const summary = formatDependencyList(missing);
            launchButton.title = summary
                ? `Finish the checks: resolve ${summary} to unlock Talk to Unity.`
                : 'Finish the checks to unlock Talk to Unity.';
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
        if (dependencySummary) dependencySummary.textContent = 'Re-checking your setup…';
        if (dependencyList) {
            dependencyList.querySelectorAll('.dependency-item').forEach((item) => {
                item.dataset.state = 'pending';
                const statusElement = item.querySelector('.dependency-status');
                if (statusElement) statusElement.textContent = 'Checking…';
            });
        }
        setStatusMessage('Running the readiness scan again…', 'info');
    }

    function handleLaunchButtonClick(event) {
        console.log('handleLaunchButtonClick event:', event);
        event.preventDefault(); // Prevent default button behavior (e.g., scrolling)
        const result = evaluateDependencies({ announce: true });
        if (!result) return;
        const { allMet, missing, results } = result;
        window.dispatchEvent(new CustomEvent('talk-to-unity:launch', { detail: { allMet, missing, results } }));
    }

    function handleRecheckClick() {
        showRecheckInProgress();
        evaluateDependencies({ announce: true });
    }

    function bootstrapLandingExperience() {
        if (landingInitialized) return;
        landingInitialized = true;
        evaluateDependencies();
        launchButton?.addEventListener('click', handleLaunchButtonClick);
        recheckButton?.addEventListener('click', handleRecheckClick);
    }

    document.addEventListener('DOMContentLoaded', bootstrapLandingExperience);
    if (document.readyState !== 'loading') bootstrapLandingExperience();

    function ensureTrailingSlash(value) {
        if (typeof value !== 'string' || !value) return '';
        return value.endsWith('/') ? value : `${value}/`;
    }

    function resolveAppLaunchUrl() {
        // Fixed version — ensures the correct relative path works on all browsers
        const configuredBase =
            typeof window.__talkToUnityAssetBase === 'string' && window.__talkToUnityAssetBase
                ? window.__talkToUnityAssetBase
                : '';
        let base = ensureTrailingSlash(configuredBase);

        if (!base) {
            try {
                base = ensureTrailingSlash(new URL('.', window.location.href).toString());
            } catch {
                console.warn('Unable to determine Talk to Unity base path. Falling back to relative navigation.');
                base = '';
            }
        }

        try {
            // ✅ Fixed: Always points to ./AI/index.html with proper slash
            return new URL('./AI/index.html', base || window.location.href).toString();
        } catch (error) {
            console.warn('Failed to resolve Talk to Unity application URL. Using a relative fallback.', error);
            return './AI/index.html';
        }
    }

    function handleLaunchEvent(event) {
        const detail = event?.detail ?? {};
        const { allMet = false, missing = [] } = detail;
        if (typeof window !== 'undefined') window.__talkToUnityLaunchIntent = detail;

        const summary = formatDependencyList(missing);
        const tone = allMet ? 'success' : 'warning';
        const launchMessage = allMet
            ? 'All systems look good. Launching Talk to Unity…'
            : summary
            ? `Launching Talk to Unity. Some features may be limited until we resolve: ${summary}.`
            : 'Launching Talk to Unity. Some features may be limited because certain capabilities are unavailable.';

        setStatusMessage(launchMessage, tone);
        document.cookie = 'checks-passed=true;path=/';
        dependencyLight?.setAttribute('aria-label', allMet
            ? 'All dependencies satisfied. Launching Talk to Unity'
            : `Launching with limited functionality: ${summary}`
        );

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
            console.log('Transitioning to AI app view.');
        } else {
            const launchUrl = resolveAppLaunchUrl();
            if (launchUrl) {
                console.log('Launching AI app at:', launchUrl);
                window.location.href = launchUrl;
            }
        }
    }

    window.addEventListener('talk-to-unity:launch', handleLaunchEvent);
    window.addEventListener('focus', () => evaluateDependencies());

    function evaluateDependencies({ announce = false } = {}) {
        const results = dependencyChecks.map((descriptor) => {
            let met = false;
            const override = getDependencyOverride(descriptor.id);
            if (typeof override !== 'undefined') met = Boolean(override);
            else {
                try {
                    met = Boolean(descriptor.check());
                } catch (error) {
                    console.error(`Dependency check failed for ${descriptor.id}:`, error);
                }
            }
            return { ...descriptor, met };
        });

        const missing = results.filter((r) => !r.met);
        const allMet = missing.length === 0;
        updateDependencyUI(results, allMet, { announce, missing });
        updateLaunchButtonState({ allMet, missing });

        if (announce) {
            if (allMet) setStatusMessage('All systems look good. Launching Talk to Unity…', 'success');
            else {
                const summary = formatDependencyList(missing);
                setStatusMessage(
                    summary
                        ? `Some browser features are unavailable: ${summary}. Fix these to unlock Talk to Unity.`
                        : 'Some browser features are unavailable. Fix the highlighted alerts to unlock Talk to Unity.',
                    'warning'
                );
            }
        } else if (allMet && statusMessage?.textContent) setStatusMessage('');

        return { results, allMet, missing };
    }

    function updateDependencyUI(results, allMet, { announce = false, missing = [] } = {}) {
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

        if (dependencyLight) {
            dependencyLight.dataset.state = allMet ? 'pass' : 'fail';
            const summary = formatDependencyList(missing);
            dependencyLight.setAttribute(
                'aria-label',
                allMet ? 'All dependencies satisfied' : `Missing requirements: ${summary}`
            );
        }

        if (dependencySummary) {
            if (missing.length === 0)
                dependencySummary.textContent = 'All the lights are green! Press "Talk to Unity" to start chatting.';
            else {
                const summary = formatDependencyList(missing);
                dependencySummary.textContent = summary
                    ? `Alerts: ${summary}. Fix these to unlock Talk to Unity.`
                    : 'Alerts detected. Fix the highlighted items to unlock Talk to Unity.';
            }
        }

        if (!announce && !allMet) setStatusMessage('');
    }

    function createLandingTestHooks() {
        if (typeof window === 'undefined') return;
        const hooks = {
            initialize() {
                clearDependencyOverrides();
                bootstrapLandingExperience();
                return evaluateDependencies();
            },
            evaluateDependencies(options) {
                return evaluateDependencies(options);
            },
            markAllDependenciesReady() {
                dependencyChecks.forEach((descriptor) => setDependencyOverride(descriptor.id, true));
                return evaluateDependencies({ announce: true });
            },
            setDependencyState(id, met) {
                if (!id) return null;
                setDependencyOverride(id, met);
                return evaluateDependencies({ announce: true });
            },
            resetOverrides() {
                clearDependencyOverrides();
                return evaluateDependencies();
            }
        };

        Object.defineProperty(window, '__unityLandingTestHooks', {
            value: hooks,
            configurable: true,
            enumerable: false
        });
    }

    createLandingTestHooks();
})();
