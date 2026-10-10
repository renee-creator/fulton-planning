# Fulton Planning Studio

Weekly curriculum planning for Fulton Community School & Farm. Educators complete the Classroom and Individual Curriculum Plans, upload paper plans to have them transcribed, follow threads across weeks, and download printable PDF or Word forms. The Lens page reads the year's plans through one lens, this year Graphic Languages, and gathers moments in educators' own words by classroom and week. Threads the team decides to follow further become projects, which belong to a classroom, can be joined by other classrooms, and can also begin school-wide.

## How it runs

- **Web page** `index.html`, published with GitHub Pages at https://renee-creator.github.io/fulton-planning/
- **Server** `server.js`, running on Render at https://fulton-planning.onrender.com. Open that address in a browser to see a status page.
- **Plans**, followed threads and projects are kept as files in the private repository `fulton-planning-records`. Every change is saved there with the educator's name, so earlier versions can always be recovered from GitHub's history.

This repository holds code only. It never holds plans, children's names, or keys.

## Server settings on Render

| Setting | What it holds |
|---|---|
| `TEACHER_PASSCODES` | Each educator's name and passcode, separated by commas, like `Hannah=maple garden 42,Chris=river stone 7`. Passcodes need at least 6 characters. Removing an educator signs them out. |
| `DIRECTOR_NAMES` | Names from `TEACHER_PASSCODES` who may change Program settings and delete plans or followed threads. Defaults to `Renee`. |
| `GITHUB_TOKEN` | A fine-grained GitHub token with Contents read and write on `fulton-planning-records` only |
| `ANTHROPIC_API_KEY` | The same key TREE uses |
| `RECORDS_REPO` | Optional. Defaults to `renee-creator/fulton-planning-records` |
| `ALLOWED_ORIGINS` | Optional. Extra websites allowed to use the server |
| `READS_PER_HOUR`, `CAREFUL_PER_HOUR` | Optional. Hourly Claude request limits, 800 and 400 by default, sized for a whole-school scan |

## Who can do what

Every educator can write, edit, upload, and download plans, add educator names, and use Claude assist. Any educator can stop following a thread, which moves it to No longer following, and anyone can follow it again. A thread followed by mistake can be undone, which puts it back among the threads Claude found as if it had never been followed. Any educator can connect a plan to a thread the school is following, or disconnect it. A connected plan shows a Following the thread note at the top, and the thread's name prints on the PDF and Word form. A plan is also connected when it was started from the thread or when the thread quotes it. Any educator can delete a plan. The page asks twice before it does, and every deletion is written to the Render log with the educator's name. Any educator can start a project from a followed thread, start a school-wide project, add threads and classrooms to a project, write its stories, and close it. A thread shows what children keep returning to. A project is the team's reading of what lies underneath. Starting one records the experience it grew from, what may lie underneath, the educators' intent, and who decided. The reading and the intent can be revised, and earlier versions are kept with their dates. A project holds possible directions as hypotheses and has no end date or steps to complete. Claude never starts a project or adds a thread to one. It only points out a new thread that may be related. Only the director writes Director feedback on a plan. Educators see it read-only, are told in the sidebar when a note is waiting, and can reply under it. Everyone can open the Lens page. Only the director can run Find threads with Claude, ask Claude to read through the lens, change the lens wording in Program settings, change Program settings, remove a thread permanently, and remove a project. The server enforces this, not just the page.

## Claude assist

Drafting from notes, Strengthen wording, family updates and transcribing everyday plans use Claude Haiku. Sorting scanned pages, finding threads, reading through the lens, project stories and transcribing handwritten scans use Claude Sonnet. The lens reading is told to read for children's thinking, never to rate how a product looks, and to leave an answer empty when the plans say nothing. Every Claude request the server turns away is written to the Render log with the reason. Plans are sent to Anthropic only to answer each request, and Anthropic does not use them to train its AI.

## Editing the page

The page is built from two parts in `src`. `app.html` is Planning Studio and `shim.html` adds sign-in and the connection to the server. After changing either one, run `python3 tools/build.py` to rebuild `index.html`.

## Free plan notes

The Render server sleeps after 15 quiet minutes. The first visit after that takes about a minute while it wakes, and the page says so. Typing is gathered and saved to GitHub within about 15 seconds.
