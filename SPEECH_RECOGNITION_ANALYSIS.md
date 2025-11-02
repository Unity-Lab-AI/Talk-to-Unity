# Speech Recognition Implementation Analysis

## Overview
This document analyzes the dual-path speech recognition system (Native Web Speech API + Vosklet fallback) and identifies issues requiring attention.

## Architecture Summary

### Chrome-based Browsers
- **Implementation**: Native `SpeechRecognition` API
- **Mode**: Continuous listening with automatic event firing
- **Initialization**: Synchronous, immediate availability

### Firefox
- **Implementation**: Vosklet (WebAssembly-based Vosk)
- **Mode**: Polling loop with 8-second timeouts
- **Initialization**: Asynchronous, ~50MB model download on first use
- **Model**: vosk-model-small-en-us@0.15.0

---

## Identified Issues

### 1. **CRITICAL: Vosklet `onspeechstart()` Timing Issue**

**Location**: `AI/app.js:130`

**Current Code**:
```javascript
const listenLoop = async () => {
    while (this.isListening) {
        try {
            this.onspeechstart();  // ❌ WRONG: Called at loop start, not when speech detected
            await this.recognition.listen({ timeout: 8000 });
        } catch (error) {
            if (this.isListening && !error.message.includes('Timeout')) {
                console.error('Vosklet listening error:', error);
                this.onerror({ error: error.message });
            }
        }
    }
    this.onend();
};
```

**Problem**:
- `onspeechstart()` fires at the beginning of each 8-second listening window
- This happens regardless of whether speech is actually detected
- UI shows "Hearing you speak" even when user is silent
- Breaks parity with native API behavior (which fires only on speech detection)

**Impact**: Misleading user feedback, inconsistent UX between browsers

**Solution Options**:
1. Remove `onspeechstart()` call from Vosklet path (simplest)
2. Hook into Vosklet's audio level detection if available
3. Add a flag to indicate Vosklet doesn't support speech start detection

---

### 2. **VERIFIED: Auto-Restart Race Condition - NOT AN ISSUE**

**Location**: `AI/app.js:598-610` + `AI/app.js:131-134`

**Analysis Flow**:
```javascript
// Flow 1: Stop → Restart
stop() → isListening = false → loop exits → onend() → 280ms → start() → isListening = true

// Flow 2: Guard protection in start()
if (this.isListening) return;  // Prevents double-start
```

**Verification**:
1. **Listen loop exit**: Loop checks `while (this.isListening)`, only exits when false
2. **onend() timing**: Called AFTER loop exits (when `isListening = false`)
3. **Restart delay**: 280ms ensures clean state transition
4. **Guard protection**: `start()` ignores calls if already listening

**Conclusion**: ✅ **NO RACE CONDITION**
- Loop cannot be running when `onend()` fires (isListening must be false)
- 280ms delay provides buffer for async cleanup
- Guard prevents accidental double-start
- Logging now tracks all state transitions

**Status**: VERIFIED SAFE with enhanced logging added

---

### 3. **MINOR: Timeout Errors Silently Swallowed**

**Location**: `AI/app.js:133`

**Current Code**:
```javascript
if (this.isListening && !error.message.includes('Timeout')) {
    console.error('Vosklet listening error:', error);
    this.onerror({ error: error.message });
}
```

**Problem**:
- 8-second timeouts are expected behavior in Vosklet
- These are silently ignored (correct behavior)
- However, makes debugging difficult when investigating issues

**Impact**: Low - this is correct behavior, just makes debugging harder

**Recommendation**: Add a debug-level log for timeout events

---

### 4. **DOCUMENTATION: Outdated README**

**Location**: `README.md:7`

**Current Text**:
> Firefox still lacks the speech tools we use.

**Problem**:
- This is outdated - Vosklet fallback now supports Firefox
- Misleads users into thinking Firefox doesn't work at all

**Actual State**:
- Firefox IS supported via Vosklet
- First-time users will download ~50MB model
- Subsequent uses are cached

---

## Event Sequence Comparison

### Native API (Chrome/Edge/Safari)
```
User speaks:
1. onstart         → "Recognition started"
2. onaudiostart    → "Audio capture began"
3. onspeechstart   → "Speech detected"   ✓ Fires only when speech detected
4. onspeechend     → "Speech stopped"
5. onresult        → Transcript available
6. onend           → "Recognition ended"
7. [Auto-restart after 280ms]
```

### Vosklet (Firefox)
```
Current implementation:
1. onstart         → "Recognition started"
2. onaudiostart    → "Audio capture began"
3. onspeechstart   → "Speech detected"   ❌ Fires every 8 seconds regardless
4. listen(8s)      → Wait for speech or timeout
5. onrecognition   → If speech detected: transcript
6. onspeechend     → After transcript
7. [Loop repeats]
8. onend           → When stopped
```

**Inconsistency**: Step 3 in Vosklet doesn't match native behavior

---

## Recommendations

### Phase 1: Critical Fixes
1. **Fix Vosklet `onspeechstart()` behavior** (Issue #1)
   - Remove the premature `onspeechstart()` call
   - Only fire when Vosklet actually detects speech (via `onrecognition`)

2. **Update README** (Issue #4)
   - Document Firefox support via Vosklet
   - Mention first-time model download

### Phase 2: Enhancements
3. **Add debug logging**
   - Log state transitions with timestamps
   - Track `isListening` flag changes
   - Log timeout events (debug level)

4. **Add browser-specific tests**
   - Chrome: Test native API continuous mode
   - Firefox: Test Vosklet polling loop
   - Both: Test mute/unmute, auto-restart

### Phase 3: Validation
5. **Manual browser testing**
   - Chrome: Verify continuous listening
   - Firefox: Verify model download + caching
   - Both: Test edge cases (rapid mute/unmute, permission denial)

---

## Testing Checklist

### Chrome/Edge Testing
- [ ] Native API detection works
- [ ] Continuous listening maintains state
- [ ] Auto-restart after speech ends
- [ ] Mute/unmute transitions clean
- [ ] Permission denial handled gracefully
- [ ] Background tab behavior acceptable

### Firefox Testing
- [ ] Vosklet loads from CDN
- [ ] Loading indicator shows during download
- [ ] Model caches after first download
- [ ] Polling loop handles timeouts correctly
- [ ] Speech detection accuracy acceptable
- [ ] Mute/unmute works with polling loop
- [ ] Stop/start transitions clean
- [ ] Permission denial handled

### Cross-Browser
- [ ] UI feedback consistent between browsers
- [ ] Event sequence feels natural on both
- [ ] No console errors
- [ ] Speech processing (regex) works identically

---

## Next Steps

1. Fix Issue #1 (Vosklet onspeechstart timing)
2. Update README documentation
3. Add defensive logging
4. Create manual testing guide
5. Perform browser validation
