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
- **Challenges.** Background jobs that could not run (the Kaymbu inbox, menus, Google Drive, backups), keys about to
  run out, a day with much more trouble than the week before.

## Each morning

1. `npm ci` if node_modules is missing, then `node tools/watch-check.js > /tmp/watch-check.json` and read it. It checks
   every script parses, the generated pages match src, the size of the first page, the server's health and, when
   WATCH_KEY is set, the program watch's own findings from the last day.
2. `npm test`. A test that fails is a glitch. Read the failure and find the commit that caused it with `git log`.
3. If the Render connector is available, read the last day of the TREE service's logs, its deploys and its metrics.
   Look for lines with "could not", "Request error", "Unexpected", "Slow request" and "refused", and for a failed deploy.
   If the connector is not available, say so in the report and go on.
4. Read the commits of the last day (`git log --since="26 hours ago" -p`) for anything that could break: a change to
   server.js without a test, src changed without building, a writing rule broken (see Writing rules in README.md).
5. Put the findings together. Leave out anything the server's program watch already sent that has not happened again.
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
