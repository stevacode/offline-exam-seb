const ui = {
  start: document.getElementById("screen-start"),
  test: document.getElementById("screen-test"),
  result: document.getElementById("screen-result"),

  testSelect: document.getElementById("testSelect"),
  refreshBtn: document.getElementById("refreshBtn"),

  studentName: document.getElementById("studentName"),
  className: document.getElementById("className"),
  startBtn: document.getElementById("startBtn"),

  progress: document.getElementById("progressPill"),
  timer: document.getElementById("timerPill"),
  qText: document.getElementById("questionText"),
  options: document.getElementById("options"),
  nextBtn: document.getElementById("nextBtn"),
  finishBtn: document.getElementById("finishBtn"),

  summary: document.getElementById("summary"),
  details: document.getElementById("details")
};
const overlay = document.getElementById("confirmOverlay");
const confirmText = document.getElementById("confirmText");
const btnYes = document.getElementById("btnYes");
const btnNo = document.getElementById("btnNo");

function openConfirm() {
  overlay.style.display = "flex"; // IZMENA: flex za centriranje
}
function closeConfirm() {
  overlay.style.display = "none";
}
btnNo.addEventListener("click", closeConfirm);
btnYes.addEventListener("click", () => {
  closeConfirm();
  submit();
});

let attemptId = null;
let test = null;
let deadlineMs = 0;

let currentIndex = 0;
// IZMENA: odgovori se čuvaju po qid-u (umesto niza sa push) -> rešava gubljenje odgovora
let answersByQid = {}; // { [qid]: { qid, selectedIndex } }
let timerHandle = null;
let submitting = false; // IZMENA: sprečava dvostruko slanje

let studentLocal = { name: "", class: "" };

function show(which) {
  ui.start.style.display = which === "start" ? "" : "none";
  ui.test.style.display = which === "test" ? "" : "none";
  ui.result.style.display = which === "result" ? "" : "none";
}

function fmt(sec) {
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// IZMENA: fetch sa tajmautom -> aplikacija se NIKAD ne zaglavi zauvek na "Završi"
async function fetchJson(url, options = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...options, signal: ctrl.signal });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || ("HTTP " + r.status));
    return data;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("Server ne odgovara (istekao tajmaut).");
    throw e;
  } finally {
    clearTimeout(t);
  }
}

function renderRich(parent, raw) {
  parent.innerHTML = "";
  const text = String(raw ?? "");

  // Split by triple backticks: even parts = text, odd parts = code
  const parts = text.split("```");

  parts.forEach((part, idx) => {
    if (!part) return;

    if (idx % 2 === 1) {
      // code part (optionally starts with language like "cpp\n")
      let code = part.replace(/\r\n/g, "\n");
      const lines = code.split("\n");
      if (lines.length > 1 && /^[a-zA-Z0-9#+-]{1,12}$/.test(lines[0].trim())) {
        lines.shift(); // remove language tag line (cpp/sql/js/...)
        code = lines.join("\n");
      }
      code = code.replace(/^\n+/, "").replace(/\n+$/, "");

      const pre = document.createElement("pre");
      pre.className = "codeblock";
      pre.textContent = code;
      parent.appendChild(pre);
    } else {
      const div = document.createElement("div");
      div.className = "textblock";
      div.textContent = part;
      parent.appendChild(div);
    }
  });
}

async function refreshTests() {
  try {
    const data = await fetchJson("/api/tests", {}, 5000);
    ui.testSelect.innerHTML = "";
    data.files.forEach(f => {
      const opt = document.createElement("option");
      opt.value = f;                          // server i dalje dobija "test1.json"
      opt.textContent = f.replace(/\.json$/i, ""); // učenik vidi "test1"
      ui.testSelect.appendChild(opt);
    });
  } catch (e) {
    alert("Ne mogu da učitam listu testova. Da li server radi?");
  }
}

function currentQuestion() {
  return test.questions[currentIndex];
}

function renderQuestion() {
  const q = currentQuestion();
  ui.progress.textContent = `Pitanje ${currentIndex + 1}/${test.questions.length}`;
  renderRich(ui.qText, q.text);
  ui.options.innerHTML = "";

  const prev = answersByQid[q.id]?.selectedIndex;

  q.options.forEach((opt, idx) => {
    const label = document.createElement("label");
    label.className = "opt";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "opt";
    input.value = String(idx);
    if (prev === idx) {
      input.checked = true;
      label.classList.add("opt-selected");
    }
    input.addEventListener("change", () => {
      ui.nextBtn.disabled = false;
      document.querySelectorAll(".opt").forEach(l => l.classList.remove("opt-selected"));
      label.classList.add("opt-selected");
    });
    label.appendChild(input);

    const content = document.createElement("div");
    content.className = "opt-content";
    renderRich(content, opt);
    label.appendChild(content);

    ui.options.appendChild(label);
  });

  ui.nextBtn.disabled = (prev == null);
  // IZMENA: jasna labela na poslednjem pitanju
  const isLast = currentIndex === test.questions.length - 1;
  ui.nextBtn.textContent = isLast ? "Potvrdi i završi" : "Potvrdi i sledeće";
}

// IZMENA: snima trenutno izabran odgovor pre svake navigacije/završetka
function captureCurrentAnswer() {
  const checked = document.querySelector("input[name='opt']:checked");
  if (!checked) return;
  const q = currentQuestion();
  answersByQid[q.id] = { qid: q.id, selectedIndex: Number(checked.value) };
}

function answeredCount() {
  return Object.keys(answersByQid).length;
}

function pickAnswerAndNext() {
  const checked = document.querySelector("input[name='opt']:checked");
  if (!checked) return;
  captureCurrentAnswer();

  currentIndex++;
  if (currentIndex >= test.questions.length) submit();
  else renderQuestion();
}

async function submit() {
  if (submitting) return;        // IZMENA: zaštita od duplog slanja
  submitting = true;
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }

  // IZMENA: niz odgovora iz mape (qid zadržava originalni tip)
  const answers = Object.values(answersByQid);

  let data;
  try {
    data = await fetchJson("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId, answers })
    }, 8000);
  } catch (e) {
    submitting = false; // dozvoli ponovni pokušaj
    alert('Slanje nije uspelo: ' + e.message + '\nKlikni ponovo na „Kraj testa" pa „Da, završi".');
    return;
  }

  renderResult(data);
  show("result");
}

function renderResult(data) {
  const s = data.summary;
  ui.summary.innerHTML =
    `Učenik: <b>${escapeHtml(studentLocal.name)}</b> (${escapeHtml(studentLocal.class)})<br>` +
    `Poeni: <b>${s.earnedPoints}/${s.totalPoints}</b> · ` +
    `Procenat: <b>${s.percent}%</b> · Ocena: <b>${s.grade}</b> · Vreme: <b>${fmt(s.usedSeconds)}</b>` +
    (data.expired ? `<br><b>NAPOMENA:</b> vreme je isteklo.` : "") +
    (data.saved === false ? `<br><b style="color:#b3261e">PAŽNJA: rezultat NIJE sačuvan na server (${escapeHtml(data.saveError || "greška")}). Obavesti nastavnika.</b>` : "");

  ui.details.innerHTML = "";

  // IZMENA: poštuje config show_correct_answers_to_student
  if (!data.showCorrect) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Detaljan pregled odgovora nije dostupan.";
    ui.details.appendChild(p);
    return;
  }

  // IZMENA: kartice u boji umesto jednog <pre> bloka
  data.detailed.forEach((d, i) => {
    const answered = d.selected_index != null;
    const ok = answered && d.selected_index === d.correct_index;

    const card = document.createElement("div");
    card.className = "result-item " + (ok ? "ri-ok" : "ri-bad");

    const head = document.createElement("div");
    head.className = "ri-head";
    head.innerHTML =
      `<span class="ri-badge">${ok ? "✓" : "✗"}</span>` +
      `<span class="ri-num">${i + 1}.</span>` +
      `<span class="ri-points">${d.earned_points}/${d.points} poena</span>`;
    card.appendChild(head);

    const qd = document.createElement("div");
    qd.className = "ri-q";
    renderRich(qd, d.text);
    card.appendChild(qd);

    const yours = document.createElement("div");
    yours.className = "ri-line";
    const yLabel = document.createElement("div");
    yLabel.className = "ri-label";
    yLabel.textContent = "Tvoj odgovor:";
    yours.appendChild(yLabel);
    const yVal = document.createElement("div");
    renderRich(yVal, answered ? d.options[d.selected_index] : "(nije odgovoreno)");
    yours.appendChild(yVal);
    card.appendChild(yours);

    if (!ok) {
      const corr = document.createElement("div");
      corr.className = "ri-line";
      const cLabel = document.createElement("div");
      cLabel.className = "ri-label";
      cLabel.textContent = "Tačan odgovor:";
      corr.appendChild(cLabel);
      const cVal = document.createElement("div");
      renderRich(cVal, d.options[d.correct_index] ?? "(?)");
      corr.appendChild(cVal);
      card.appendChild(corr);
    }

    ui.details.appendChild(card);
  });
}

function startTimer() {
  const tick = () => {
    const left = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
    ui.timer.textContent = `Vreme: ${fmt(left)}`;
    ui.timer.classList.toggle("pill-danger", left <= 60); // IZMENA: vizuelno upozorenje
    if (left <= 0) {
      clearInterval(timerHandle);
      timerHandle = null;
      captureCurrentAnswer(); // IZMENA: ne gubi trenutni odgovor pri isteku
      submit();
    }
  };
  tick();
  timerHandle = setInterval(tick, 250);
}

async function startTest() {
  const name = ui.studentName.value.trim();
  const cls = ui.className.value.trim();
  if (!name || !cls) return alert("Ime i odeljenje su obavezni.");

  const testFile = ui.testSelect.value;
  if (!testFile) return alert("Izaberi test.");

  studentLocal = { name, class: cls };

  ui.startBtn.disabled = true; // IZMENA: spreci dvoklik
  let data;
  try {
    data = await fetchJson("/api/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testFile, student: studentLocal })
    }, 8000);
  } catch (e) {
    ui.startBtn.disabled = false;
    return alert("Pokretanje nije uspelo: " + e.message + "\nProveri da li je server pokrenut.");
  }

  attemptId = data.attemptId;
  test = data.test;
  deadlineMs = data.deadlineMs;
  currentIndex = 0;
  answersByQid = {};
  submitting = false;

  startTimer();
  renderQuestion();
  show("test");
}

ui.refreshBtn.addEventListener("click", refreshTests);
ui.startBtn.addEventListener("click", startTest);
ui.nextBtn.addEventListener("click", pickAnswerAndNext);
ui.finishBtn.addEventListener("click", () => {
  captureCurrentAnswer(); // IZMENA: snimi trenutni odgovor pre završetka
  const total = test.questions.length;
  const done = answeredCount();
  confirmText.textContent = done < total
    ? `Odgovoreno je ${done}/${total} pitanja. Neodgovorena pitanja nose 0 poena. Nakon završetka nema povratka.`
    : `Odgovorio/la si na sva pitanja (${done}/${total}). Nakon završetka nema povratka.`;
  openConfirm();
});

// IZMENA: Enter u poljima pokreće test
[ui.studentName, ui.className].forEach(el =>
  el.addEventListener("keydown", e => { if (e.key === "Enter") startTest(); })
);

// IZMENA: tajna precica za admin stranicu (Ctrl+Alt+A)
document.addEventListener("keydown", e => {
  if (e.ctrlKey && e.altKey && (e.key === "a" || e.key === "A")) {
    window.location = "/admin";
  }
});

(async () => {
  await refreshTests();
  show("start");
  ui.studentName.focus(); // IZMENA: fokus na ime
})();
