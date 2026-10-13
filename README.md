# offline-exam-seb

Offline exam delivery app for Windows computer labs, built to run locally behind Safe Exam Browser (SEB).

Each lab machine runs its own small Express server on `127.0.0.1`. The browser UI loads the test, the server keeps the answer keys, enforces the time limit, grades the submission and writes the result to disk as JSON plus a CSV summary. No internet connection, database or Node.js installation is needed on the lab machines.

The app is in real use at a secondary school: around 73 students take at least three tests per semester with it, in OOP (C++), databases and web programming classes.

## Features

**For students**
- one question at a time, with a visible countdown that turns red in the last minute
- code snippets in questions and answers (fenced with triple backticks, rendered in monospace)
- confirmation before finishing, with a count of unanswered questions
- automatic submission when time runs out, keeping the currently selected answer
- optional review of correct answers after submission (configurable)

**For the teacher**
- admin page at `/admin`, protected by a password from `config.json`
- results table with points, percentage, grade, time used and timeout flag
- per-question statistics: how many students answered each question correctly
- CSV export with a UTF-8 BOM so Excel shows Serbian characters correctly

**Reliability and security**
- answer keys never reach the browser: `correct_index` is stripped from `/api/start` and grading happens on the server
- every request has an 8-second timeout, so the UI never hangs on "Finish"
- a failed result write never blocks the student; they still get their grade and a visible warning
- if the app folder is not writable for the current Windows account, results fall back to `%LOCALAPPDATA%\OfflineTestSEB\results`
- test files are validated on load, so a broken JSON file shows a clear error instead of crashing the server
- student-entered text is escaped before it is rendered in the admin table

## Tech Stack

- Node.js + Express (backend, grading, file storage)
- vanilla HTML, CSS and JavaScript (no framework, no build step)
- JSON files for tests and results (no database server)
- Safe Exam Browser
- Windows batch and VBS launch scripts, portable `node.exe`

## Project Structure

```text
public/
  index.html      Student UI
  app.js          Test flow, timer, submission, result rendering
  admin.html      Teacher page: results, per-question stats, CSV export
tests/
  proba.json      Demo test (real exams are git-ignored)
config.example.json  Settings template (copied to config.json on first run)
server.js         Express API, grading and result storage
pokreni.bat       Starts the server, waits for port 3000, opens SEB with Exam.seb
pokreni.vbs       Runs pokreni.bat without a console window
pripremi.bat      Builds the portable folder (copies node.exe)
UPUTSTVO.md       Deployment guide for lab machines (Serbian)
```

## Quick Start

```bash
npm install
npm start
```

Open `http://127.0.0.1:3000` for the test and `http://127.0.0.1:3000/admin` for results.

On first run the server copies `config.example.json` to `config.json`. The admin page stays locked until you set `admin_password` there (see below). `config.json` is git-ignored, so your real password never ends up in the repository.

## Configuration

`config.json` (created from `config.example.json`, local only):

```json
{
  "port": 3000,
  "admin_password": "change-me",
  "show_correct_answers_to_student": true,
  "grade_thresholds": [
    { "min_percent": 0,  "grade": 1 },
    { "min_percent": 51, "grade": 2 },
    { "min_percent": 66, "grade": 3 },
    { "min_percent": 81, "grade": 4 },
    { "min_percent": 91, "grade": 5 }
  ]
}
```

| Field | Meaning |
|---|---|
| `port` | Local port the server listens on |
| `admin_password` | Password for `/admin`; if missing, the admin page rejects every login |
| `show_correct_answers_to_student` | Show the answer review after submission |
| `grade_thresholds` | Minimum percentage for each grade (Serbian 1–5 scale) |

## Test File Format

Each test is a JSON file in `tests/`. The file name (without `.json`) is what students see in the test list.

````json
{
  "title": "Demo test",
  "duration_minutes": 15,
  "questions": [
    {
      "id": 1,
      "text": "What does this print?\n```cpp\ncout << 2 + 3;\n```",
      "options": ["5", "23", "2 + 3", "Compile error"],
      "correct_index": 0,
      "points": 1
    }
  ]
}
````

- `id` must be unique within the test
- each question needs at least two options and a valid `correct_index` (0-based)
- `points` defaults to 1, `duration_minutes` defaults to 10

## Results

Each submission is saved to `results/` next to `server.js`:

- `<attempt-id>.json` with the student, score, grade, time used and every answer
- `rezultati.csv`, one row per submission

If that folder isn't writable, the server picks the fallback folder above and logs its path on startup.

## Windows Lab Usage

The full guide is in [UPUTSTVO.md](UPUTSTVO.md). In short:

1. Run `pripremi.bat` once on a machine with Node.js installed. It installs Express and copies `node.exe` into the project folder.
2. Create your SEB configuration with the SEB Configuration Tool (start URL `http://127.0.0.1:3000`) and save it as `Exam.seb` in the project folder. It is git-ignored, so it isn't in this repository.
3. Copy the folder (with `node_modules/`) to each lab machine.
4. Start a test with `pokreni.vbs`. It frees port 3000 if needed, starts the server, waits until it responds and opens Safe Exam Browser with `Exam.seb`.
5. After the test, open `/admin` in a regular browser to see results or download the CSV.

Single-executable packaging with `pkg` (`npm run build`) was tried and dropped. It needs build tools that the lab machines don't have, so the portable `node.exe` approach is the supported one.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/tests` | List available test files |
| POST | `/api/start` | Start an attempt; returns the test without answer keys |
| POST | `/api/submit` | Grade and save an attempt |
| POST | `/api/admin/results` | Results and per-question stats (password required) |
| GET | `/api/admin/csv` | Download `rezultati.csv` (password required) |
| GET | `/quit` | Shut down the local server |

## Known Limitations

- **Results stay on each machine.** Since every computer runs its own server, the teacher has to collect `results/` from each one. Central collection over the local network is planned.
- **Active attempts are kept in memory.** If the server restarts during a test, that attempt can't be submitted.
- **Retakes are not blocked.** The same student can take a test more than once.
- **Single-choice questions only.**
- **The admin password is plain text** in `config.json`, and the CSV download passes it as a URL parameter. This is acceptable on a local-only server but not suitable for network use.

## Privacy And Repository Safety

Never commit:

- real exam JSON files (they contain answer keys)
- student names or result exports, including `results/` and `*.csv`
- your real `admin_password`
- `.seb` configuration files
- `node_modules/`, `node.exe` or generated `.exe` files

`.gitignore` already covers all of the above, including `config.json`. The repository is meant to hold source code and the demo test only.
