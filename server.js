const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

// IZMENA: podrska za pakovanje u jedan .exe (@yao-pkg/pkg).
// Kad radi kao .exe, fajlovi koje menjas (tests, results, config) stoje PORED .exe,
// dok je 'public' (UI) ugradjen UNUTAR .exe.
const isPkg = typeof process.pkg !== "undefined";
const APP_DIR = isPkg ? path.dirname(process.execPath) : __dirname;
const TESTS_DIR = path.join(APP_DIR, "tests");
const RESULTS_DIR = path.join(APP_DIR, "results");
const CONFIG_PATH = path.join(APP_DIR, "config.json");
// IZMENA: u repou je samo config.example.json (bez lozinke); pravi config.json je lokalan
const CONFIG_EXAMPLE_PATH = path.join(APP_DIR, "config.example.json");
const PUBLIC_DIR = path.join(__dirname, "public");

// IZMENA: CSV zaglavlje na jednom mestu (umesto unutar /api/submit handlera)
const CSV_HEADER = [
  "datum_vreme",
  "pokusaj_id",
  "naziv_testa",
  "fajl_testa",
  "ucenik",
  "odeljenje",
  "osvojeni_poeni",
  "max_poena",
  "procenat",
  "ocena",
  "vreme_sek",
  "istekao"
];

function ensureDirs() {
  if (!fs.existsSync(TESTS_DIR)) fs.mkdirSync(TESTS_DIR, { recursive: true });
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// IZMENA: bira folder za rezultate u koji nalog SME da pise.
// Resava HTTP 500 na "Kraj testa" kad ograniceni nalog ne moze da pise u C:\...\results
function pickWritableResultsDir() {
  const candidates = [
    RESULTS_DIR,
    path.join(process.env.LOCALAPPDATA || os.homedir(), "OfflineTestSEB", "results"),
    path.join(os.tmpdir(), "OfflineTestSEB", "results")
  ];
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const probe = path.join(dir, ".write_test");
      fs.writeFileSync(probe, "ok");
      fs.unlinkSync(probe);
      return dir;
    } catch (e) {
      console.warn("UPOZORENJE: ne mogu da pisem u:", dir, "->", e.code || e.message);
    }
  }
  return RESULTS_DIR; // poslednja nada
}

function loadConfig() {
  const def = {
    port: 3000,
    show_correct_answers_to_student: true,
    grade_thresholds: [
      { min_percent: 0, grade: 1 },
      { min_percent: 51, grade: 2 },
      { min_percent: 66, grade: 3 },
      { min_percent: 81, grade: 4 },
      { min_percent: 91, grade: 5 }
    ]
  };
  // IZMENA: ako config.json ne postoji, napravi ga iz config.example.json
  if (!fs.existsSync(CONFIG_PATH) && fs.existsSync(CONFIG_EXAMPLE_PATH)) {
    try {
      fs.copyFileSync(CONFIG_EXAMPLE_PATH, CONFIG_PATH);
      console.warn("config.json nije postojao - napravljen je iz config.example.json.");
    } catch (e) {
      console.warn("UPOZORENJE: ne mogu da napravim config.json:", e.code || e.message);
    }
  }
  let cfg = def;
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      cfg = { ...def, ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) };
    }
  } catch (e) {
    // IZMENA: greska u config.json (npr. zaboravljen zarez) se vise ne guta tiho
    console.error("GRESKA u config.json (koriste se podrazumevana podesavanja):", e.message);
  }
  if (!cfg.admin_password) {
    console.warn("UPOZORENJE: admin_password nije podesen u config.json - admin stranica je zakljucana.");
  }
  return cfg;
}

function listJsonFiles(dir) {
  ensureDirs();
  return fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith(".json")).sort();
}

function loadTest(fileName) {
  const p = path.join(TESTS_DIR, fileName);
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

// IZMENA: validacija testa da neispravan JSON ne obara server sa 500
function validateTest(test) {
  if (!test || typeof test !== "object") throw new Error("Test nije ispravan objekat.");
  if (!Array.isArray(test.questions) || test.questions.length === 0) {
    throw new Error("Test nema pitanja.");
  }
  for (const q of test.questions) {
    if (q.id === undefined || q.id === null) throw new Error("Postoji pitanje bez polja 'id'.");
    if (!Array.isArray(q.options) || q.options.length < 2) {
      throw new Error(`Pitanje ${q.id}: mora imati bar 2 opcije.`);
    }
    if (typeof q.correct_index !== "number" || q.correct_index < 0 || q.correct_index >= q.options.length) {
      throw new Error(`Pitanje ${q.id}: neispravan 'correct_index'.`);
    }
  }
  return test;
}

function computeGrade(percent, thresholds) {
  const sorted = [...thresholds].sort((a, b) => a.min_percent - b.min_percent);
  let grade = sorted[0]?.grade ?? 1;
  for (const t of sorted) if (percent >= t.min_percent) grade = t.grade;
  return grade;
}

function csvEscape(v) {
  const s = (v ?? "").toString().replaceAll('"', '""');
  return `"${s}"`;
}

function appendCsvRow(csvPath, header, rowObj) {
  const exists = fs.existsSync(csvPath);
  if (!exists) fs.writeFileSync(csvPath, header.join(",") + "\n", "utf-8");
  const line = header.map(h => csvEscape(rowObj[h])).join(",") + "\n";
  fs.appendFileSync(csvPath, line, "utf-8");
}

const cfg = loadConfig();

ensureDirs();

// IZMENA: odredi folder za rezultate u koji se SME pisati (sa fallback-om)
const resultsDir = pickWritableResultsDir();
console.log("Rezultati se snimaju u:", resultsDir);

const app = express();
app.use(express.json({ limit: "1mb" }));
// IZMENA: UI fajlove serviramo eksplicitno (citanjem sa diska/snapshot-a),
// da rade i kad je aplikacija spakovana u .exe.
function sendPublic(res, file, type) {
  try {
    res.type(type).send(fs.readFileSync(path.join(PUBLIC_DIR, file)));
  } catch {
    res.status(404).send("Nije pronadjeno: " + file);
  }
}
app.get(["/", "/index.html"], (_req, res) => sendPublic(res, "index.html", "html"));
app.get("/app.js", (_req, res) => sendPublic(res, "app.js", "application/javascript"));
app.use(express.static(PUBLIC_DIR));

const attempts = new Map(); // attemptId -> {deadlineMs, testFile, student, startedAt}

app.get("/api/tests", (_req, res) => {
  res.json({ files: listJsonFiles(TESTS_DIR) });
});

app.post("/api/start", (req, res) => {
  const { testFile, student } = req.body || {};
  if (!testFile || !student?.name || !student?.class) {
    return res.status(400).json({ error: "Nedostaju podaci (test ili ime/odeljenje)." });
  }

  // IZMENA: provera da test postoji u listi (sprečava i pokušaj čitanja van foldera)
  if (!listJsonFiles(TESTS_DIR).includes(testFile)) {
    return res.status(400).json({ error: "Izabrani test ne postoji." });
  }

  // IZMENA: bezbedno učitavanje i validacija
  let test;
  try {
    test = validateTest(loadTest(testFile));
  } catch (e) {
    return res.status(400).json({ error: "Neispravan test: " + e.message });
  }

  const attemptId = crypto.randomUUID();
  const startedAt = Date.now();
  const durationMs = (test.duration_minutes ?? 10) * 60 * 1000;
  const deadlineMs = startedAt + durationMs;

  attempts.set(attemptId, { deadlineMs, testFile, student, startedAt });

  // IZMENA: klijentu NE šaljemo correct_index (ocenjivanje je ionako na serveru)
  const clientTest = {
    ...test,
    questions: test.questions.map(({ correct_index, ...rest }) => rest)
  };

  res.json({
    attemptId,
    deadlineMs,
    test: clientTest,
    config: { show_correct_answers_to_student: cfg.show_correct_answers_to_student }
  });
});

app.post("/api/submit", (req, res) => {
  const { attemptId, answers } = req.body || {};
  const a = attempts.get(attemptId);
  if (!a) return res.status(400).json({ error: "Nevažeći pokušaj (možda je već predat)." });

  // IZMENA: provera oblika podataka
  if (answers != null && !Array.isArray(answers)) {
    return res.status(400).json({ error: "Polje 'answers' mora biti niz." });
  }

  // IZMENA: bezbedno učitavanje testa i ovde
  let test;
  try {
    test = validateTest(loadTest(a.testFile));
  } catch (e) {
    return res.status(500).json({ error: "Greška pri učitavanju testa: " + e.message });
  }

  const now = Date.now();
  const expired = now > a.deadlineMs;

  const ansMap = new Map((answers || []).map(x => [x.qid, x.selectedIndex]));

  const detailed = test.questions.map(q => {
    const selected = ansMap.has(q.id) ? ansMap.get(q.id) : null;
    const ok = (selected !== null && selected === q.correct_index);
    const points = q.points ?? 1;
    return {
      id: q.id,
      text: q.text,
      options: q.options,
      correct_index: q.correct_index,
      selected_index: selected,
      points,
      earned_points: ok ? points : 0
    };
  });

  const totalPoints = detailed.reduce((s, r) => s + r.points, 0);
  const earnedPoints = detailed.reduce((s, r) => s + r.earned_points, 0);
  const percent = totalPoints ? (earnedPoints / totalPoints) * 100 : 0;
  const thresholds =
    Array.isArray(test.grade_thresholds) && test.grade_thresholds.length
      ? test.grade_thresholds
      : cfg.grade_thresholds;
  const grade = computeGrade(percent, thresholds);

  const usedSeconds = Math.round((Math.min(now, a.deadlineMs) - a.startedAt) / 1000);
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

  const payload = {
    attempt_id: attemptId,
    timestamp,
    test_title: test.title,
    test_file: a.testFile,
    student: a.student,
    expired,
    score: {
      earned_points: earnedPoints,
      total_points: totalPoints,
      percent: Number(percent.toFixed(2)),
      grade,
      used_seconds: usedSeconds
    },
    answers: detailed
  };

  // IZMENA: upis rezultata vise NIKAD ne obara predaju.
  // Ako upis padne (npr. nema prava pisanja), ucenik svejedno dobije ocenu,
  // a u konzoli pise sta je poslo naopako.
  let saved = false;
  let saveError = null;
  try {
    fs.writeFileSync(
      path.join(resultsDir, `${attemptId}.json`),
      JSON.stringify(payload, null, 2),
      "utf-8"
    );
    appendCsvRow(path.join(resultsDir, "rezultati.csv"), CSV_HEADER, {
      datum_vreme: timestamp,
      pokusaj_id: attemptId,
      naziv_testa: test.title,
      fajl_testa: a.testFile,
      ucenik: a.student.name,
      odeljenje: a.student.class,
      osvojeni_poeni: earnedPoints,
      max_poena: totalPoints,
      procenat: percent.toFixed(2),
      ocena: grade,
      vreme_sek: usedSeconds,
      istekao: expired ? "DA" : "NE"
    });
    saved = true;
  } catch (e) {
    saveError = e.code || e.message;
    console.error("GRESKA pri upisu rezultata u", resultsDir, "->", saveError);
  }

  attempts.delete(attemptId);

  res.json({
    attemptId,
    expired,
    saved,
    saveError,
    student: a.student,
    summary: {
      earnedPoints, totalPoints, percent: Number(percent.toFixed(2)), grade, usedSeconds
    },
    showCorrect: cfg.show_correct_answers_to_student,
    detailed
  });
});

// ===== ADMIN: pregled rezultata, statistika, preuzimanje CSV =====
function adminOk(req, res) {
  const pw = (req.body && req.body.password) || req.query.password || "";
  if (!cfg.admin_password) {
    res.status(401).json({ error: "Lozinka nije podesena: dodaj admin_password u config.json i restartuj server." });
    return false;
  }
  if (pw !== cfg.admin_password) {
    res.status(401).json({ error: "Pogresna lozinka." });
    return false;
  }
  return true;
}

app.get("/admin", (_req, res) => sendPublic(res, "admin.html", "html"));

app.post("/api/admin/results", (req, res) => {
  if (!adminOk(req, res)) return;
  let files = [];
  try { files = fs.readdirSync(resultsDir).filter(f => f.toLowerCase().endsWith(".json")); } catch {}
  const rows = [];
  const perQuestion = {}; // test_file -> { qid -> {text, correct, total} }
  for (const f of files) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(resultsDir, f), "utf-8"));
      rows.push({
        timestamp: d.timestamp,
        name: d.student && d.student.name,
        klasa: d.student && d.student.class,
        test: d.test_title,
        earned: d.score && d.score.earned_points,
        total: d.score && d.score.total_points,
        percent: d.score && d.score.percent,
        grade: d.score && d.score.grade,
        used_seconds: d.score && d.score.used_seconds,
        expired: d.expired
      });
      const tf = d.test_title || d.test_file || "?";
      perQuestion[tf] = perQuestion[tf] || {};
      (d.answers || []).forEach(a => {
        const q = perQuestion[tf][a.id] = perQuestion[tf][a.id] || { text: a.text, correct: 0, total: 0 };
        q.total++;
        if (a.selected_index != null && a.selected_index === a.correct_index) q.correct++;
      });
    } catch {}
  }
  rows.sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
  res.json({ resultsDir, count: rows.length, rows, perQuestion });
});

app.get("/api/admin/csv", (req, res) => {
  if (!adminOk(req, res)) return;
  const csvPath = path.join(resultsDir, "rezultati.csv");
  if (!fs.existsSync(csvPath)) return res.status(404).json({ error: "Jos nema rezultata." });
  res.setHeader("Content-Disposition", 'attachment; filename="rezultati.csv"');
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  // BOM da Excel ispravno procita nasa slova (c, c, s, z, dj)
  res.send("\uFEFF" + fs.readFileSync(csvPath, "utf-8"));
});

app.get("/quit", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end("<h2>Završeno.</h2><p>Zatvaranje...</p>");
  setTimeout(() => process.exit(0), 800);
});

// IZMENA: svaka neuhvacena greska vraca JSON poruku (ne praznu HTML 500 stranicu),
// pa ucenik na ekranu vidi razlog umesto golog "HTTP 500".
app.use((err, _req, res, _next) => {
  console.error("Neuhvacena greska:", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Greska na serveru: " + (err.message || "nepoznato") });
});

app.listen(cfg.port, "127.0.0.1", () => {
  console.log(`Offline test running on http://127.0.0.1:${cfg.port}`);
});
