# Fulton Planning Studio

Weekly curriculum planning for Fulton Community School & Farm. Educators complete the Classroom and Individual Curriculum Plans, upload paper plans to have them transcribed, follow threads across weeks, and download printable PDF or Word forms.

## How it runs

- **Web page** `index.html`, published with GitHub Pages at https://renee-creator.github.io/fulton-planning/
- **Server** `server.js`, running on Render at https://fulton-planning.onrender.com. Open that address in a browser to see a status page.
- **Plans** are kept as files in the private repository `fulton-planning-records`. Every change is saved there with the educator's name, so earlier versions can always be recovered from GitHub's history.

This repository holds code only. It never holds plans, children's names, or keys.

## Server settings on Render

| Setting | What it holds |
|---|---|
| `TEACHER_PASSCODES` | Each educator's name and passcode, separated by commas, like `Maren=maple garden 42,Tobin=river stone 7`. Passcodes need at least 6 characters. Removing an educator signs them out. |
| `DIRECTOR_NAMES` | Names from `TEACHER_PASSCODES` who may change Program settings and delete plans or followed threads. Defaults to `Renee`. |
| `GITHUB_TOKEN` | A fine-grained GitHub token with Contents read and write on `fulton-planning-records` only |
| `ANTHROPIC_API_KEY` | The same key TREE uses |
| `RECORDS_REPO` | Optional. Defaults to `renee-creator/fulton-planning-records` |
| `ALLOWED_ORIGINS` | Optional. Extra websites allowed to use the server |
| `READS_PER_HOUR`, `CAREFUL_PER_HOUR` | Optional. Hourly Claude request limits, 800 and 400 by default, sized for a whole-school scan |

## Who can do what

Every educator can write, edit, upload, and download plans, add educator names, and use Claude assist. Any educator can stop following a thread, which moves it to No longer following, and anyone can follow it again. Only the director can change Program settings, delete plans, and remove a thread permanently. The server enforces this, not just the page.

## Claude assist

Drafting from notes, Strengthen wording, family updates and transcribing everyday plans use Claude Haiku. Sorting scanned pages, finding threads, project stories and transcribing handwritten scans use Claude Sonnet. Every Claude request the server turns away is written to the Render log with the reason. Plans are sent to Anthropic only to answer each request, and Anthropic does not use them to train its AI.

## Editing the page

The page is built from two parts in `src`. `app.html` is Planning Studio and `shim.html` adds sign-in and the connection to the server. After changing either one, run `python3 tools/build.py` to rebuild `index.html`.

## Free plan notes

The Render server sleeps after 15 quiet minutes. The first visit after that takes about a minute while it wakes, and the page says so. Typing is gathered and saved to GitHub within about 15 seconds.
