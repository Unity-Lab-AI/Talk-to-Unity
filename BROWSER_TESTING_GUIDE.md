# Browser Testing Guide

## Chrome/Edge Testing
1. Open the application in Chrome or Edge.
2. Grant microphone permission.
3. Click the mute indicator to unmute the microphone.
4. Speak a command, such as "hello unity".
5. Verify that the application transcribes your speech and responds.

## Firefox Testing
1. Open the application in Firefox.
2. Grant microphone permission.
3. The first time you use the application, a 50MB Vosklet model will be downloaded. Verify that the download completes successfully.
4. Click the mute indicator to unmute the microphone.
5. Speak a command, such as "hello unity".
6. Verify that the application transcribes your speech and responds.

## Cross-Browser Comparison
- **Chrome/Edge**: Speech recognition is continuous and real-time.
- **Firefox**: Speech recognition operates in 8-second polling windows, so there may be a slight delay before your speech is recognized.

## Troubleshooting
- **Microphone permission denied**: If you accidentally deny microphone permission, you will need to grant it in your browser's settings.
- **Vosklet model not downloading**: If the Vosklet model does not download, check your browser's console for errors.

## Performance Metrics
- **Load time**: The application should load within a few seconds.
- **Accuracy**: The speech recognition should be at least 85% accurate.
- **Memory usage**: The application should not use an excessive amount of memory.