# Talk to Unity

[![Main Branch Workflow](https://img.shields.io/github/actions/workflow/status/UnityAILab/Talk-to-Unity/main-branch.yml?branch=main&label=Main%20Branch%20Workflow)](https://github.com/UnityAILab/Talk-to-Unity/actions/workflows/main-branch.yml)
[![Pull Request Validation](https://img.shields.io/github/actions/workflow/status/UnityAILab/Talk-to-Unity/pull-request.yml?branch=main&label=Pull%20Request%20Validation)](https://github.com/UnityAILab/Talk-to-Unity/actions/workflows/pull-request.yml)

Automated workflows manage the Talk to Unity static site:

- **Pull Request Validation** runs the test suite for every pull request event and publishes a summary with the outcome of each test file.
- **Main Branch Workflow** builds the static assets, uploads them for GitHub Pages deployment, executes the tests again, and reports build and test summaries without blocking deployments.

The current regression test asserts that the live deployment at [unityailab.com/Talk-to-Unity](http://www.unityailab.com/Talk-to-Unity) remains available and still renders the call-to-action button for microphone access.
