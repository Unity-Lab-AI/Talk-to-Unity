DEPRICATED APPLICATION try instead: [https://github.com/Unity-Lab-AI/Talk-to-Unity](https://github.com/Unity-Lab-AI/Talking-with-Unity.git)
http://www.unityailab.com/Talking-with-Unity/
# Talk to Unity in Plain English

![Main Branch Workflow Status](https://github.com/Unity-Lab-AI/Talk-to-Unity/actions/workflows/main.yml/badge.svg?branch=main)
![Pull Request Workflow Status](https://github.com/Unity-Lab-AI/Talk-to-Unity/actions/workflows/pull-request.yml/badge.svg)

Talk to Unity is a single web page that acts like a friendly concierge. The landing screen double-checks that your browser has everything it needs (secure connection, microphone, speech tools). Once every light turns green, a voice assistant named **Unity** wakes up so you can talk out loud and hear it answer back.

## What you need

- A recent version of Chrome, Edge, or Safari. (Firefox still lacks the speech tools we use.)
- A secure address — either `https://` on the web or `http://localhost` while testing.
- Speakers or headphones so you can hear Unity talk.
- A microphone and permission to use it.

If any of these are missing, the landing page will highlight what to fix and share a short tip.

## Fastest way to try it

1. Download the project or clone it with Git.
   ```bash
   git clone https://github.com/Unity-Lab-AI/Talk-to-Unity.git
   cd Talk-to-Unity
   ```
2. Start a basic web server. Python is an easy option:
   ```bash
   python -m http.server 8000
   ```
3. Open `http://localhost:8000` in a supported browser and load `index.html`.
4. Watch the landing page run its checks. When everything shows **Ready**, press the button to enter the AI lab and start talking to Unity.

## Understanding the landing page

- **System lights**: Secure context, speech recognition, speech playback, and microphone access each get a color. Green means you are good to go. Amber means you will see clear instructions to fix the problem.
- **Status message**: The box at the top always tells you what Unity is waiting on. When all lights are green it invites you into the lab.
- **Help links**: Quick links back to the Unity AI Lab website and this repository sit near the top so you can jump out for more info.

## Using the voice assistant

1. Enter the lab once the landing checks pass.
2. Click **Unmute microphone** to let Unity listen.
3. Speak naturally. Unity will transcribe, respond with text, and also read its answer aloud.
4. Use the on-screen controls to mute, stop, or reset the conversation if you want to start over.

All of this runs in the browser — no extra servers or databases are required.

## Customizing the experience

- **Prompt and personality**: Edit `ai-instruct.txt` to change Unity’s default instructions.
- **Landing behavior**: Adjust the readiness checks or UI copy inside `landing.js`.
- **Voice interface**: Modify `AI/app.js` for how Unity listens, thinks, and speaks.
- **Styling**: Tweak the look across the landing page and chat area in `style.css` and `AI/style.css`.

## File map

| File | Purpose |
| --- | --- |
| `index.html` | Loads the landing page, pulls in the styles, and boots both scripts. |
| `landing.js` | Handles the pre-flight checks and controls the landing layout. |
| `style.css` | Shared styling for the landing screen. |
| `AI/app.js` | Runs the live voice conversation. |
| `AI/style.css` | Styles for the in-lab chat interface. |
| `ai-instruct.txt` | Text prompt that shapes how Unity responds. |

## Need more help?

- Unity AI Lab: <https://unityailab.online>
- GitHub issues: <https://github.com/Unity-Lab-AI/Talk-to-Unity/issues>

Share feedback, swap in your own prompt, or dress up the visuals — just keep it simple and have fun chatting with Unity.
