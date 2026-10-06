# JFT-Basic Mock Test 01

Static GitHub Pages package. Keep index.html and .nojekyll at the repository root alongside data/ and vendor/.
No build or server is required. All 13 original 0.9x recordings are included.

Google Sheets result delivery is optional and requires setting the public Apps Script /exec URL in result-delivery-config.js. It is currently unset. Never add a Spreadsheet ID or credentials to these files. Deploy the separate google-apps-script/Code.gs following the supplied setup guide; do not publish that backend folder.

Progress and pending results use localStorage in the current browser and site origin. PDF results download using the unchanged bundled PDF generator. Browser or OS settings may independently open downloaded files.

The public question JSON contains answer keys and scripts. This is a practice test without login or access control. Future Question Bank, Teacher and JLPT features are not included.
