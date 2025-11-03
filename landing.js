(() => {
    
    
    
    
    // const recheckButton = document.getElementById('recheck-dependencies'); // Moved to shared.js
    // const statusMessage = document.getElementById('status-message'); // Moved to shared.js
    // const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; // Moved to shared.js
    // const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined; // Moved to shared.js

    // const LOOPBACK_HOST_PATTERN = /^(?:localhost|127(?:\.\d{1,3}){3}|::1|\[::1\])$/i; // Moved to shared.js

    
    let landingInitialized = false;











    function showRecheckInProgress() {
        if (window.launchButton) {
            window.launchButton.disabled = true;
            window.launchButton.setAttribute('aria-disabled', 'true');
            window.launchButton.dataset.state = 'pending';
        }
        if (window.dependencyLight) {
            window.dependencyLight.dataset.state = 'pending';
            window.dependencyLight.setAttribute('aria-label', 'Re-checking requirements');
        }
        if (window.dependencySummary) window.dependencySummary.textContent = 'Re-checking your setup…';
        if (window.dependencyList) {
            window.dependencyList.querySelectorAll('.dependency-item').forEach((item) => {
                item.dataset.state = 'pending';
                const statusElement = item.querySelector('.dependency-status');
                if (statusElement) statusElement.textContent = 'Checking…';
            });
        }
        window.setStatusMessage('Running the readiness scan again…', 'info');
    }

    function handleLaunchButtonClick(event) {
        console.log('handleLaunchButtonClick event:', event);
        event.preventDefault(); // Prevent default button behavior (e.g., scrolling)
        const result = window.evaluateDependencies({ announce: true });
        if (!result) return;
        const { allMet, missing, results } = result;
        window.dispatchEvent(new CustomEvent('talk-to-unity:launch', { detail: { allMet, missing, results } }));
    }

    function handleRecheckClick() {
        showRecheckInProgress();
        window.evaluateDependencies({ announce: true });
    }

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

        const summary = window.formatDependencyList(missing);
        const tone = allMet ? 'success' : 'warning';
        const launchMessage = allMet
            ? 'All systems look good. Launching Talk to Unity…'
            : summary
            ? `Launching Talk to Unity. Some features may be limited until we resolve: ${summary}.`
            : 'Launching Talk to Unity. Some features may be limited because certain capabilities are unavailable.';

        window.setStatusMessage(launchMessage, tone);
        document.cookie = 'checks-passed=true;path=/';
        window.dependencyLight?.setAttribute('aria-label', allMet
            ? 'All dependencies satisfied. Launching Talk to Unity'
            : `Launching with limited functionality: ${summary}`
        );

        if (window.launchButton) {
            window.launchButton.disabled = true;
            window.launchButton.setAttribute('aria-disabled', 'true');
            window.launchButton.dataset.state = 'pending';
        }

        if (window.startApplication) {
            window.startApplication();
        } else {
            const launchUrl = resolveAppLaunchUrl();
            if (launchUrl) {
                window.location.href = launchUrl;
            }
        }
    }

    window.addEventListener('talk-to-unity:launch', handleLaunchEvent);

    
    })();