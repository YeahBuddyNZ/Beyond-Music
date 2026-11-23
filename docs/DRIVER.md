# Driver: standing answers

Claude reads this before asking you anything. If the answer is here, it acts and tells you which line it used. When you answer a question this file did not cover, Claude adds your answer here in the same change, so you are never asked the same thing twice.

Write in plain words. Short lines beat paragraphs. Delete anything that stops being true.

## Vision

<!-- What this project is for, in one or two lines. Who it serves. What "done" looks like. -->

## Priorities right now

<!-- In order. Claude works on the top one unless told otherwise. -->

1.

## Defaults when unsure

- A clear ask gets done. No menu of options, no do-it-yourself steps. Ask only when a wrong guess can't be undone, and then one question with your pick.
- A broken connector: tell me once, in one line, which one to reconnect, and carry on with the rest. No manual workarounds unless I ask.
- Design and UI: ReUI only (https://reui.io). Nothing else, in any app.
- Brand name: Beyond is a registered trade mark (IPONZ 1251473). Customer-facing copy (sites, emails, newsletters, chat, socials) writes it Beyond™ every time, ™ not ®, and products the same way (Beyond™ TV). Leave it plain in URLs, code, screen reader text, Wi-Fi names and legal names.
- Recommended option: always take it, on a card or in text, and carry on. Not when it spends money, deletes data or needs something only I have.
- Never wait on me. Do it first, then tell me what you did and ask if anything is left. Not when it spends money, deletes data or needs something only I have.
- Keys, secrets and env vars: never send me dashboard steps. Ask for one short phrase ("set the keys") and do it yourself.
- Security: every new site or app is hosted where the hourly security sweep can see it (the shared Vercel team behind its firewall, with managed rules on, and the shared Supabase org). Never switch the firewall or its managed rules off to get something working; fix the request instead. Never block an address by hand without a credible published source.
- TestFlight testers: always send the app's public TestFlight link (https://testflight.apple.com/join/...), never an email invite. A tester added by email still installs nothing until the external group has a build, so add the newest build to the group with the public link on.
- Act like staff: a staff member would not come to me for any of these, so you do not either:
  - Verification codes: read them from my mail tab yourself. Never ask me to paste one.
  - My business details (email, address, company name, website): fill them in from these files or public records. Never ask me to confirm them.
  - Anything I already said yes to, in any thread: do it. Never ask twice.
  - "Which account or option?": take the business one, or the obvious one, and say which.
  - Additive database migrations, routine merges on green CI: just do them.
- Things only I can do (sign up an account, tick terms the safety check will not tick, a password, a payment, a click on my own device): do not ping me one at a time. Add the item to my list, keep working on everything else, and the Driver sends me the whole list in one message a few times a day.

<!-- "If X, do Y." Examples:
- Copy or wording: match the tone of the existing pages; do not invent claims.
- A library choice between two good options: pick the one already used in my other apps.
- A design detail: follow the existing components; flag it in the summary.
- Tests failing on something unrelated: note it and carry on with the task. -->

## Always ask me first

<!-- On top of the payload's rules (money, deploys, live data, legal). Examples:
- Anything that emails a real customer.
- Price changes. -->

## Answers I have given

<!-- Claude appends here: date, the question, your answer. -->

- 2026-10-22: Should a thread wait for my answer before acting? No: "Never wait on me, do it first then ask".
