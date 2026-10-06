# JFT-Basic Mock Test 01

Static GitHub Pages package. The completed application files and all 13 original 0.9x MP3 recordings are unchanged.

## Publish

Keep index.html and .nojekyll at the repository root, alongside data/ and vendor/.
Repository Settings → Pages → Deploy from a branch → main → / (root) → Save.
No build command, Node.js server, or package installation is required.

Open the URL shown in Settings → Pages, usually https://USERNAME.github.io/jft-basic-mock-test-01/.

## Notes

Progress is saved in localStorage in the current browser. Localhost and the published site use separate storage. Reloading the same site restores progress, the choice order and play counts; the timer continues from the saved start time.

The result PDF uses the bundled local PDF library. Student details and results are not submitted to a backend by this application.

This browser-side version includes the answer keys and listening scripts in the public question JSON. It is a practice test, with no teacher access control or server-side grading.

Question Bank, Teacher, JLPT and other future features are not included.
