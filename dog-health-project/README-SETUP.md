# How to Set Up Your "Dog Health" Project on Claude.ai (3 minutes)

This package contains everything needed to create a dedicated Claude Project for
managing your 15-year-old Pit Bull's health.

## What's in this package

| File | What it is | Where it goes |
|---|---|---|
| `PROJECT-INSTRUCTIONS.md` | The "brain" — how Claude should behave in this project | Paste into **Project Instructions** |
| `01-health-record.md` | Her full medical history & problem list | Upload to **Project Knowledge** |
| `02-current-protocol.md` | Active daily protocol, doses, red flags | Upload to **Project Knowledge** |
| `03-clinical-reference.md` | Drug/supplement reference & options assessed | Upload to **Project Knowledge** |
| `04-care-log.md` | Daily log template + entries so far | Upload to **Project Knowledge** (re-upload as you update it) |

## Setup steps

1. Go to **claude.ai** and log in.
2. In the left sidebar, click **Projects** → **+ New Project**.
3. Name it: **🐶 [Her Name] — Health** (put her real name in!).
4. Click **"Set custom instructions"** (or the Instructions box) → open
   `PROJECT-INSTRUCTIONS.md` from this package, copy ALL of it, paste, save.
5. In the **Project knowledge** panel, click **+ Add content → Upload file** and
   upload these 4 files:
   - `01-health-record.md`
   - `02-current-protocol.md`
   - `03-clinical-reference.md`
   - `04-care-log.md`
6. Done. Start any new chat **inside the project** — Claude will automatically
   know her full history, current meds, doses, and red flags.

## How to use it day to day

- **Quick questions:** "Her stool today looks like X — normal?" (attach photos;
  Claude has her baseline to compare against)
- **Med checks:** "Can I give her X with her current meds?"
- **Updates:** Tell Claude what changed ("she finished the omeprazole course") and
  ask it to give you an updated `04-care-log.md` / `02-current-protocol.md` —
  then **delete the old file from Project knowledge and upload the new one.**
  That keeps the project's memory current.
- **Second opinions:** "Compile her current status into a report for review."

## Keeping it accurate (important)

The project is only as good as its files. Once a week (or after any change),
ask in the project chat: *"Update her health record and protocol files with
everything from this conversation, give them to me as downloadable files"* —
then swap them into Project knowledge.

## One privacy note

This package was generated inside a coding session attached to your GitHub repo.
After you've set up the claude.ai project, you may want to delete the
`dog-health-project/` folder and `dog-health-report.md` from the repo so her
medical details don't live in your codebase.
