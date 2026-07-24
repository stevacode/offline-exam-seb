# offline-exam-seb

Offline exam delivery app for Windows computer labs, designed to run locally with Safe Exam Browser.

The app starts a local Express server on `127.0.0.1`, serves a browser-based test interface, keeps answer keys on the server, applies a time limit, grades submissions, and writes results locally as JSON plus a CSV summary.

## Why This Project Exists

This project was built for a secondary-school environment where tests need to run reliably on lab machines, without internet access, and with a locked-down browser experience.

It focuses on:

- fully offline operation
- Safe Exam Browser launch flow
- server-side answer-key protection
- timed test attempts
- local result export
- portable Windows deployment
- fallback result storage when the current Windows account cannot write to the app folder

## Tech Stack

- JavaScript
- Node.js
- Express
- HTML/CSS
- Safe Exam Browser integration
- Windows batch/VBS launch scripts

## Project Structure

```text
public/
  index.html      Browser UI
  app.js          Test flow, timer, submission, result rendering
tests/
  proba.json      Demo test only
config.json       Port and grading settings
server.js         Express API and grading logic
pokreni.bat       Starts local server and launches Safe Exam Browser
pokreni.vbs       Hidden Windows launcher
pripremi.bat      Prepares portable Windows folder
UPUTSTVO.md       Serbian deployment notes
```

## Quick Start

```bash
npm install
npm start
```

Open:

```text
http://127.0.0.1:3000
```

The included `tests/proba.json` is a safe demo file. Real exam files should stay private.

## Test File Format

Each test is a JSON file in `tests/`.

```json
{
  "title": "Demo test",
  "duration_minutes": 15,
  "questions": [
    {
      "id": 1,
      "text": "Question text",
      "options": ["A", "B", "C", "D"],
      "correct_index": 0,
      "points": 1
    }
  ]
}
```

Important: `correct_index` is intentionally kept on the server and stripped from `/api/start` responses before the test reaches the browser.

## Windows Lab Usage

For the portable Windows workflow, see [UPUTSTVO.md](UPUTSTVO.md).

In short:

1. Run `pripremi.bat` once on a machine with Node.js installed.
2. Copy the prepared folder to lab machines.
3. Start the test with `pokreni.vbs`.
4. The launcher starts the local server, waits until it is ready, then opens Safe Exam Browser.

## Privacy And Repository Safety

Do not commit:

- real exam JSON files
- student names or result exports
- `results/`
- `.seb` configuration files
- `node_modules/`
- `node.exe` or generated `.exe` files

The repository is intended to contain source code and a demo test only.
