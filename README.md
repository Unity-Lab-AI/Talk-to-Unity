# Talk to Unity

Talk to Unity is a browser-based voice companion that connects visitors with the Unity AI Lab experience. The project ships as a static site, so it can be hosted on GitHub Pages or any web server that can serve HTML, CSS, and JavaScript.

## What you get

- A guided landing page with live dependency checks for secure context, speech recognition, speech synthesis, and microphone access.
- A voice-first interface where users can unmute the microphone, talk to Unity, and hear spoken responses.
- Lightweight assets that run fully in the browser with no additional backend services required.

## Requirements

To enjoy the full experience make sure you have:

- A modern browser with support for the Web Speech APIs (Chrome or Edge work best, Safari on desktop also supports the features).
- HTTPS hosting or `localhost` so the secure-context check passes.
- Speakers or headphones so you can hear Unity’s replies.
- A microphone that the browser is allowed to access.

## Running locally

1. Clone this repository.  
   `git clone https://github.com/Unity-Lab-AI/Talk-to-Unity.git`
2. Serve the files from a local web server so the secure-context requirement is satisfied. Any simple static server works, for example:  
   `python -m http.server 8000`
3. Visit `http://localhost:8000` in a compatible browser, open `index.html`, and follow the landing page instructions to launch the voice lab.

## Project structure

- `index.html` – landing page markup and the application shell.
- `style.css` – theme styles for both the landing page and the voice interface.
- `app.js` – dependency checks, voice controls, and Unity interaction logic.
- `ai-instruct.txt` – system prompt loaded by the application.

## Helpful links

- Unity AI Lab home: https://unityailab.online
- Repository on GitHub: https://github.com/Unity-Lab-AI/Talk-to-Unity

Feel free to customize the landing copy, extend the dependency checks, or swap in different voice prompts to match your own deployment.
