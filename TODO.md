# TODO

- [x] Separate the application into `index.html` and `ai/index.html`.
- [x] Implement cookie-based access control.
- [x] Split the JavaScript logic into `landing.js` and `ai/app.js`.
- [x] Enhance image generation parameters.
- [x] Implement a new theme for the `/ai` page.
- [x] Implement broader browser support for speech recognition using Hugging Face Whisper-tiny.en.
- [ ] Fix JavaScript errors on the `/ai` page:
    - [ ] `Unexpected token 'export'`
    - [ ] `Invalid regular expression`
- [ ] Review and address the GitHub workflows to ensure they build and deploy the page properly.

## Current State

The application is split into a landing page (`index.html`) and the main AI page (`ai/index.html`). The landing page correctly checks for dependencies and redirects to the AI page. The AI page (`ai/index.html`) is failing to load correctly due to two JavaScript errors: `Unexpected token 'export'` and `Invalid regular expression`.

I have tried several approaches to fix these errors, including:
- Adding `type="module"` to the script tag.
- Removing the `import` statement and loading the library from a CDN.
- Wrapping the code in an IIFE.
- Correcting all the regular expressions I could find.

None of these approaches have worked. I am going to take a break and come back to this later.
