# Privacy and permissions

Albert Enhancer stores settings, Schedule Lab data, registration-simulator state, learned campus options, and Degree Planner data locally. It does not upload academic data by default and contains no analytics or remote-code loader.

The Chrome manifest requests:

- `storage`, for local extension state;
- `https://*.nyu.edu/*`, so the content script can annotate NYU course and Albert pages.

The extension does not request cookies, browsing history, web-request interception, downloads, clipboard-read, or broad all-site access.

The registration boundary is deliberate: the extension may read, highlight, recommend, navigate, plan, and simulate. It does not submit Enroll, Drop, Swap, or Waitlist operations and does not replay enrollment POST requests.
