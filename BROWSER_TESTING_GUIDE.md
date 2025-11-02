# Browser Testing Guide for Speech Recognition

This guide provides step-by-step instructions for testing the dual-path speech recognition implementation across Chrome-based browsers and Firefox.

---

## Prerequisites

1. **Start the local server**:
   ```bash
   python -m http.server 8080
   ```

2. **Access the application**:
   - Open `http://localhost:8080/index.html`

3. **Requirements**:
   - Working microphone
   - Speakers or headphones
   - Quiet environment for testing

---

## Chrome/Edge Testing (Native Web Speech API)

### Initial Load Test

1. **Open Chrome or Edge**
2. **Navigate to** `http://localhost:8080/index.html`
3. **Check browser console** (F12):
   - Should see: `"Using native SpeechRecognition."`
   - Should NOT see any Vosklet-related messages

4. **Verify landing page**:
   - All 4 dependency checks should show green "Ready" status:
     - ✓ Secure context
     - ✓ Web Speech Recognition API
     - ✓ Speech synthesis voices
     - ✓ Microphone access

5. **Click "Talk to Unity"**
   - Should navigate to `AI/index.html`
   - Should see the main interface

### Speech Recognition Test

6. **Click "Unmute microphone"** or click anywhere
   - Permission prompt may appear (grant access)
   - Console should show:
     ```
     [SpeechRecognition Native] Starting native SpeechRecognition
     ```

7. **Check UI feedback**:
   - Status should change to "Listening for your voice"
   - Visual circle indicator should show listening state

8. **Speak clearly**: "Hello Unity"
   - Console should show: `User said: hello unity`
   - UI should show "Hearing you speak" while speaking
   - After stopping, should show "Processing what you said"
   - AI should respond with text and speech

9. **Verify auto-restart**:
   - After AI response completes
   - Console should show:
     ```
     [Auto-restart] Scheduling recognition restart in 280ms
     [Auto-restart] Attempting to restart recognition
     [SpeechRecognition Native] Starting native SpeechRecognition
     ```

10. **Test mute/unmute**:
    - Click to mute
    - Status should change to "Tap or click anywhere to unmute"
    - Console should show:
      ```
      [SpeechRecognition Native] Stopping native SpeechRecognition
      ```
    - Click to unmute
    - Should restart recognition automatically

### Error Handling Tests

11. **Test permission denial**:
    - Clear site permissions in browser settings
    - Reload page
    - Deny microphone permission
    - Landing page should show microphone check as failed

12. **Test in background tab**:
    - Start recognition
    - Switch to another tab
    - Return to tab
    - Verify recognition still works or restarts properly

---

## Firefox Testing (Vosklet Fallback)

### Initial Load Test

1. **Open Firefox**
2. **Navigate to** `http://localhost:8080/index.html`
3. **First-time users**:
   - A loading indicator should appear with text: "Loading speech recognition model..."
   - This downloads ~50MB model (one-time only)
   - Takes 10-60 seconds depending on connection
   - Loading indicator should disappear when complete

4. **Check browser console** (F12):
   - Should see: `"Vosklet initialized successfully."`
   - Should NOT see: `"Using native SpeechRecognition."`

5. **Verify landing page**:
   - All 4 dependency checks should eventually show green (after Vosklet loads)
   - Note: Speech recognition check may be amber initially, then turn green after Vosklet loads

### Speech Recognition Test

6. **Click "Talk to Unity"**
   - Navigate to AI interface

7. **Click "Unmute microphone"**
   - Permission prompt may appear (grant access)
   - Console should show:
     ```
     [SpeechRecognition Vosklet] Starting Vosklet listening loop
     ```

8. **Check UI feedback**:
   - Status: "Listening for your voice"
   - Visual indicator shows listening state

9. **Speak clearly and wait**: "Hello Unity"
   - **Important**: Vosklet has 8-second listening windows
   - Speak clearly and pause after your phrase
   - Console may show (normal behavior):
     ```
     [SpeechRecognition Vosklet] Listen timeout (no speech detected in 8s window)
     ```
   - When speech is detected:
     ```
     [SpeechRecognition Vosklet] Speech detected: "hello unity"
     User said: hello unity
     ```

10. **Verify polling loop behavior**:
    - Vosklet uses 8-second listening windows
    - After each window (timeout or speech), it automatically starts a new window
    - This is normal and expected behavior

11. **Verify auto-restart**:
    - After AI response
    - Should see auto-restart logs in console
    - Recognition should resume polling loop

12. **Test mute/unmute**:
    - Click to mute
    - Console should show:
      ```
      [SpeechRecognition Vosklet] Stopping Vosklet listening loop
      [SpeechRecognition Vosklet] Listen loop ended
      ```
    - Click to unmute
    - Should restart with:
      ```
      [SpeechRecognition Vosklet] Starting Vosklet listening loop
      ```

### Vosklet-Specific Tests

13. **Test model caching** (second visit):
    - Close Firefox completely
    - Reopen and navigate to application
    - Should NOT show loading indicator (model cached)
    - Should initialize much faster

14. **Test offline behavior** (after initial load):
    - Load application with internet
    - Once Vosklet loaded, disconnect internet
    - Speech recognition should still work (model is cached locally)

15. **Test model download failure**:
    - Clear Firefox cache completely
    - Block `unpkg.com` in hosts file or firewall
    - Reload application
    - Should show error in console
    - Landing page should indicate speech recognition unavailable

---

## Cross-Browser Comparison Tests

### Event Sequence Verification

**Chrome - Expected Console Output**:
```
[SpeechRecognition Native] Starting native SpeechRecognition
Voice recognition stopped.
[Auto-restart] Scheduling recognition restart in 280ms
[Auto-restart] Attempting to restart recognition
[SpeechRecognition Native] Starting native SpeechRecognition
User said: [your speech]
```

**Firefox - Expected Console Output**:
```
[SpeechRecognition Vosklet] Starting Vosklet listening loop
[SpeechRecognition Vosklet] Listen timeout (no speech detected in 8s window)
[SpeechRecognition Vosklet] Speech detected: "[your speech]"
User said: [your speech]
[SpeechRecognition Vosklet] Listen loop ended
[Auto-restart] Scheduling recognition restart in 280ms
```

### UI Behavior Comparison

| Feature | Chrome/Edge | Firefox |
|---------|-------------|---------|
| **Initial load** | Instant | 10-60s first time |
| **Listening mode** | Continuous | 8s polling windows |
| **Speech detection** | Immediate | Within 8s window |
| **Timeout behavior** | N/A | Logs debug message every 8s |
| **UI feedback** | Should be identical | Should be identical |
| **Accuracy** | Very high (cloud-based) | Good (local model) |

---

## Common Issues & Troubleshooting

### Chrome/Edge Issues

**Issue**: "SpeechRecognition is not defined"
- **Cause**: Not using HTTPS or localhost
- **Fix**: Ensure using `http://localhost` or `https://`

**Issue**: Microphone permission denied
- **Cause**: User denied permission or browser blocked
- **Fix**: Clear site data, reload, grant permission

**Issue**: Recognition stops unexpectedly
- **Check**: Console for errors
- **Check**: Auto-restart logs (should restart in 280ms)

### Firefox Issues

**Issue**: Loading indicator stuck
- **Cause**: Network issue downloading model
- **Fix**: Check internet connection, check console for errors

**Issue**: Model won't cache
- **Cause**: Browser cache disabled or full
- **Fix**: Check Firefox cache settings, clear space

**Issue**: Low accuracy
- **Cause**: Vosklet uses smaller model for browser compatibility
- **Fix**: Speak clearly and slowly, reduce background noise

**Issue**: 8-second timeouts in console
- **Status**: This is normal! Vosklet polls every 8 seconds
- **No action needed**: Timeouts are expected when silent

---

## Performance Metrics

### Chrome/Edge
- **Initialization**: < 100ms
- **Speech detection latency**: 200-500ms
- **Recognition accuracy**: 95%+
- **Memory usage**: ~10MB
- **Network**: Requires internet for recognition

### Firefox
- **Initialization (first time)**: 10-60 seconds
- **Initialization (cached)**: < 1 second
- **Speech detection latency**: 500ms - 8 seconds
- **Recognition accuracy**: 85-90%
- **Memory usage**: ~100MB (includes model)
- **Network**: Only for initial download, offline after

---

## Test Checklist

### Chrome/Edge
- [ ] Landing page loads, all checks green
- [ ] Console shows "Using native SpeechRecognition"
- [ ] Navigation to AI interface works
- [ ] Microphone permission requested
- [ ] Speech is recognized accurately
- [ ] UI feedback correct during speech
- [ ] Auto-restart works after recognition ends
- [ ] Mute/unmute transitions cleanly
- [ ] Background tab behavior acceptable
- [ ] No console errors

### Firefox
- [ ] Landing page loads
- [ ] Loading indicator appears (first time only)
- [ ] Vosklet initializes successfully
- [ ] All dependency checks eventually green
- [ ] Console shows "Vosklet initialized successfully"
- [ ] Navigation works
- [ ] Microphone permission requested
- [ ] Speech recognized within 8-second windows
- [ ] Polling loop visible in console (timeouts are OK)
- [ ] UI feedback correct during speech
- [ ] Auto-restart works
- [ ] Mute/unmute works
- [ ] Model caching works (second visit faster)
- [ ] No errors (timeouts are expected, not errors)

---

## Debug Logging Reference

All speech recognition events are now logged with timestamps for debugging:

### Logging Patterns

**Start/Stop**:
```
[SpeechRecognition Native/Vosklet] Starting [type] listening [loop]
[SpeechRecognition Native/Vosklet] Stopping [type]
```

**State Warnings**:
```
[SpeechRecognition Native/Vosklet] start() called but already listening, ignoring
[SpeechRecognition Native/Vosklet] stop() called but not listening, ignoring
```

**Vosklet Speech Detection**:
```
[SpeechRecognition Vosklet] Speech detected: "[transcript]"
[SpeechRecognition Vosklet] Listen timeout (no speech detected in 8s window)
```

**Auto-Restart**:
```
[Auto-restart] Scheduling recognition restart in 280ms
[Auto-restart] Attempting to restart recognition
[Auto-restart] Skipping restart because microphone is muted
```

---

## Reporting Issues

When reporting issues, please include:

1. **Browser & Version**: Chrome 120, Firefox 121, etc.
2. **First time or returning user?** (affects Vosklet caching)
3. **Console logs**: Full console output from page load to issue
4. **Steps to reproduce**: Exact steps that trigger the issue
5. **Expected vs Actual**: What should happen vs what happened
6. **Network state**: Online/offline during test

---

## Next Steps After Testing

Once manual testing is complete:

1. Review console logs for any unexpected warnings
2. Compare behavior between browsers
3. Document any browser-specific quirks
4. Report issues with detailed logs
5. Consider automated tests for critical paths
