(() => {
    const dependencyLight = document.querySelector('[data-role="dependency-light"]');
    const dependencySummary = document.getElementById('dependency-summary');
    const launchButton = document.getElementById('launch-app');
    const statusMessage = document.getElementById('status-message');

    const LOOPBACK_HOST_PATTERN = /^(?:localhost|127(?:\.\d{1,3}){3}|::1|\[::1\])$/;

    const dependencyChecks = [
        {
            id: 'secure-context',
            label: 'Secure connection (HTTPS or localhost)',
            friendlyName: 'secure connection light',
            check: () =>
                Boolean(window.isSecureContext) || LOOPBACK_HOST_PATTERN.test(window.location.hostname)
        }
    ];

    let landingInitialized = false;

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

    function handleLaunchButtonClick() {
        const result = evaluateDependencies({ announce: true });
        if (!result) {
            return;
        }

        const { allMet, missing, results } = result;

        window.dispatchEvent(
            new CustomEvent('talk-to-unity:launch', {
                detail: { allMet, missing, results }
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

        if (!allMet) {
            dependencyLight?.setAttribute(
                'aria-label',
                summary
                    ? `Launching with limited functionality while we address: ${summary}`
                    : 'Launching with limited functionality while some requirements are addressed'
            );
        } else {
            dependencyLight?.setAttribute('aria-label', 'All dependencies satisfied. Launching Talk to Unity');
        }

        if (launchButton) {
            launchButton.disabled = true;
            launchButton.setAttribute('aria-disabled', 'true');
            launchButton.dataset.state = 'pending';
        }

        const appRoot = document.getElementById('app-root');
        if (!appRoot) {
            const launchUrl = resolveAppLaunchUrl();
            if (launchUrl) {
                window.location.assign(launchUrl);
            }
        }
    }

    window.addEventListener('talk-to-unity:launch', handleLaunchEvent);

    window.addEventListener('focus', () => {
        evaluateDependencies();
    });

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

        updateDependencyUI(results, allMet);

        return { results, allMet, missing };
    }

    function updateDependencyUI(results, allMet) {
        if (dependencyLight) {
            dependencyLight.dataset.state = allMet ? 'pass' : 'fail';
            dependencyLight.setAttribute(
                'aria-label',
                allMet
                    ? 'All dependencies satisfied'
                    : 'Missing secure connection'
            );
        }

        if (dependencySummary) {
            if (allMet) {
                dependencySummary.textContent = 'Click the button below to start talking to Unity.';
            } else {
                dependencySummary.textContent = 'Please use a secure connection (HTTPS or localhost) to talk to Unity.';
            }
        }

        if (launchButton) {
            launchButton.href = allMet ? '/AI' : '#';
            if(!allMet) {
                launchButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    setStatusMessage('Please use a secure connection (HTTPS or localhost) to talk to Unity.', 'warning');
                });
            }
        }
    }

    function bootstrapLandingExperience() {
        if (landingInitialized) {
            return;
        }

        landingInitialized = true;

        evaluateDependencies();
    }

    document.addEventListener('DOMContentLoaded', bootstrapLandingExperience);

    if (document.readyState !== 'loading') {
        bootstrapLandingExperience();
    }
})();
