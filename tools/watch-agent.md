# TREE program watch, the monitoring agent's playbook

A scheduled Claude Code session runs this every morning. It watches the whole program, the code in this repository, the
server on Render and what the server's own program watch (watch.js) saw people run into, and it tells the director
what needs correcting, with a plan of correction for each thing. It proposes. It never changes TREE by itself.

## What to look for

- **Glitches.** Errors on the server or in a page, tests that fail, generated pages out of step with src, a part of the
  server status that has turned red, a deploy on Render that failed.
- **User errors.** The same refusal or trouble message reaching many people, which means a screen could prevent it or
  say more plainly what to do.
- **Places to improve and to be more efficient.** Slow requests, the first page growing heavy, work done again and
  again that could be kept, steps people take by hand that TREE could take for them.
- **How TREE feels to use.** The program watch's findings on TREE slow to open, pages slow to draw, people hunting
  for something, the observation form left unkept, observations stuck on a phone and pages no one opens any more. Look
  at the code of the page named and propose a concrete change to the screen.
- **Challenges.** Background jobs that could not run (the Kaymbu inbox, menus, Google Drive, backups), keys about to
  run out, a day with much more trouble than the week before.

## Each morning

1. `npm ci` if node_modules is missing, then `node tools/watch-check.js > /tmp/watch-check.json` and read it. It checks
   every script parses, the generated pages match src, the size of the first page, the server's health and, when
   WATCH_KEY is set, the program watch's own findings from the last day.
2. The walk needs Playwright and a Chromium browser, which TREE itself does not install. If
   `node -e "require('playwright')"` fails, run `npm install --no-save playwright` and `npx playwright install chromium`
   first. Then run `node tools/user-walk.js /tmp/user-walk` and read /tmp/user-walk/walk-report.md. It walks through TREE on a made-up
   school as an educator on a phone, the director on a laptop and the kitchen on a tablet, and checks formatting and
   getting around: pages wider than the screen, buttons too small to tap or drawn over one another, text cut off or very
   small, buttons and boxes with no name, slow pages, how many taps each page is from Today, and everyday tasks done by
   tapping. Then act as that person yourself:
   - Look at the screenshots in /tmp/user-walk as an educator would, on their phone between children. Is it clear what
     to do next? Is anything crowded, misaligned, hard to read, cut off or inconsistent with the other pages? Is the
     way back obvious?
   - Before reporting that something could not be reached or done, open its screenshot and the `onScreen` list in
     walk-report.json. If a person could plainly do it and only the walk missed it, leave it out.
   - Report only what would really slow an educator down or confuse them, with the page, what to change, and the file
     in src where it is drawn. Leave out the same finding you already reported in an open program-watch issue.
3. `npm test`. A test that fails is a glitch. Read the failure and find the commit that caused it with `git log`.
4. If the Render connector is available, read the last day of the TREE service's logs, its deploys and its metrics.
   Look for lines with "could not", "Request error", "Unexpected", "Slow request" and "refused", and for a failed deploy.
   If the connector is not available, say so in the report and go on.
5. Read the commits of the last day (`git log --since="26 hours ago" -p`) for anything that could break: a change to
   server.js without a test, src changed without building, a writing rule broken (see Writing rules in README.md).
6. Put the findings together. Leave out anything the server's program watch already sent that has not happened again.
   Order them most urgent first. For each one write:
   - **What happened**, with counts and when, in plain words.
   - **Why it matters** to educators, families or the records.
   - **Plan of correction**, numbered steps, naming the file and the place in it when it is in the code.
   - **How we will know it is corrected.**

## Telling the director

- If there is nothing to correct, end with one line saying so. Nothing is posted.
- Otherwise open one GitHub issue in renee-creator/fulton-planning titled `Program watch, <date>: <n> things to correct`,
  with the label `program-watch` (create the label if it is missing). If an open program-watch issue already names the
  same finding, add a comment to it instead of a new issue.
- End the session's last message with the same plan, short, so the notification that reaches the director carries it.
- Never write children's names, family names, an educator's name, an email address or any record's words into an
  issue, a comment or the final message. Say "an educator" or "a child". The program watch's report already takes names out.
- Never push, merge, deploy, or change settings on Render. A correction is made only after the director asks for it.

## Writing

Follow the Writing rules in README.md. Short plain sentences, no em dashes, educator rather than teacher, and never the
name of the AI model or its maker in anything posted.
