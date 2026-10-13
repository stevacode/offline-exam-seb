# OfflineTest — uputstvo

Aplikacija je 100% offline (radi na 127.0.0.1, ne koristi internet).
Svaki lab računar pokreće svoj mali server; Node.js NE mora biti instaliran,
jer u folderu nosimo prenosivi `node.exe`.

## 1) Priprema (SAMO jednom, na svom računaru gde je Node.js instaliran)

U folderu projekta dvoklik na **`pripremi.bat`**. On:
- instalira `express` (u `node_modules\`),
- kopira prenosivi `node.exe` u folder.

Posle ovoga folder radi i na mašinama gde Node NIJE instaliran.

## 2) Šta je u folderu

    node.exe              <- prenosivi Node (iz koraka 1)
    node_modules\         <- samo express (mali)
    server.js             <- server i ocenjivanje
    public\               <- izgled: index.html, app.js, admin.html
    tests\                <- .json testovi (tvoji)
    results\              <- rezultati (pravi se sam)
    config.json           <- TVOJA podešavanja i lozinka (nije na GitHubu)
    config.example.json   <- primer podešavanja, bez lozinke
    Exam.seb              <- SEB konfiguracija (nije na GitHubu)
    pokreni.vbs           <- OVO dvoklik za pokretanje (sve skriveno)
    pokreni.bat
    pripremi.bat

Na lab mašine kopiraš CEO folder. Na lab mašinama NE treba instalirati Node.

## 3) Pokretanje testa

Dvoklik na **`pokreni.vbs`**. On:
1. ugasi zaostali server na portu 3000 (ako postoji),
2. pokrene server preko `node.exe` skriveno (nema crnog prozora),
3. sačeka da server stvarno proradi (rešava „connection refused"),
4. otvori SEB sa `Exam.seb`.

Učenik na kraju klikne **IZLAZ**, što gasi server.

## 4) Rezultati

U `results\` pored `server.js`: jedan `.json` po učeniku + zbirni `rezultati.csv`.
Ako nalog nema pravo upisa tu, server sam pređe na:
`C:\Users\<nalog>\AppData\Local\OfflineTestSEB\results\`
Da rezultati uvek ostanu pored aplikacije: daj nalogu „Ucenik" pravo upisa
nad tim folderom (desni klik → Properties → Security → Edit → Modify).

## 5) Admin — pregled rezultata

1. Pokreni server BEZ SEB-a: u folderu aplikacije klikni u adresnu traku foldera,
   ukucaj `cmd`, Enter, pa u crnom prozoru: `node.exe server.js`
   (prozor ostavi otvoren dok koristiš admin).
2. U običnom pretraživaču otvori **http://127.0.0.1:3000/admin**
   (ili Ctrl+Alt+A / link „· admin ·" na početnom ekranu testa).
3. Uloguj se lozinkom iz `config.json` (polje `admin_password`).
4. U panelu: tabela rezultata, statistika po pitanju, „Preuzmi CSV" (otvara se u Excelu),
   „Odjava" i „← Nazad na test" (ili taster Esc).

---

## 6) PODEŠAVANJA — šta gde menjaš

Sve fajlove menjaš u Notepadu (desni klik → Open with → Notepad),
a čuvaš sa **File → Save** (kodiranje UTF-8).
**Posle svake izmene `config.json` ili testa restartuj server**
(zatvori crni prozor / završi SEB, pa ponovo pokreni) — server čita podešavanja samo pri pokretanju.

### Pravila za JSON fajlove (config.json i testovi)
- tekst ide pod navodnike `"..."`, brojevi i `true`/`false` bez navodnika,
- između stavki ide **zarez**, ali **posle poslednje stavke NEMA zareza**,
- ako pogrešiš, server koristi podrazumevana podešavanja i admin ostaje zaključan —
  proveri zareze i navodnike.

### Lozinka za admin
U `config.json`:

    "admin_password": "ovde_tvoja_lozinka",

Promeni vrednost između navodnika. Velika i mala slova se razlikuju.
Ako je polje prazno (`""`) ili ga nema, admin piše „Lozinka nije podesena".

### Pragovi za ocene
U `config.json`, `grade_thresholds` — od koliko procenata počinje koja ocena:

    { "min_percent": 51, "grade": 2 },

Npr. da dvojka počinje od 50%, promeni `51` u `50`.

### Da li učenik posle testa vidi tačne odgovore
U `config.json`:

    "show_correct_answers_to_student": true,

`true` = vidi pregled (svoj i tačan odgovor), `false` = vidi samo ocenu.

### Port (menjaj samo ako je 3000 zauzet nečim drugim)
Port se pominje na 3 mesta i MORA biti isti svuda:
1. `config.json` → `"port": 3000`
2. `pokreni.bat` → dva puta `3000` (red sa `findstr ":3000"` i red sa `TcpClient('127.0.0.1',3000)`)
3. `Exam.seb` → početna adresa `http://127.0.0.1:3000` (vidi dole)

### Putanja do Safe Exam Browsera
Ako je SEB instaliran negde drugde, u `pokreni.bat` ispravi poslednji `start` red:

    start "" "C:\Program Files\SafeExamBrowser\Application\SafeExamBrowser.exe" "%~dp0Exam.seb"

### Exam.seb (podešavanja SEB-a)
Otvori ga **SEB Configuration Toolom** (dolazi uz SEB). Fajl je zaštićen lozinkom
za podešavanja — treba ti ta lozinka. Bitno:
- **Start URL**: `http://127.0.0.1:3000`
- **Security → Allow to run inside virtual machine**: uključi SAMO za probu u virtuelnoj mašini, za pravi test isključi
- posle izmene: **File → Save Settings** i isti `Exam.seb` kopiraj na sve lab mašine

### Testovi
Svaki test je jedan `.json` fajl u `tests\`. Učenik u listi vidi ime fajla bez `.json`
(npr. `SEB_Excel_Test_15min.json` → „SEB_Excel_Test_15min").

    {
      "title": "Naziv testa",
      "duration_minutes": 15,
      "questions": [
        {
          "id": 1,
          "text": "Tekst pitanja",
          "options": ["Odgovor A", "Odgovor B", "Odgovor C", "Odgovor D"],
          "correct_index": 0,
          "points": 1
        }
      ]
    }

- `duration_minutes` — trajanje testa u minutima
- `id` — različit broj za svako pitanje
- `correct_index` — koji je odgovor tačan, **brojanje kreće od 0** (prvi = 0, drugi = 1, treći = 2...)
- `points` — koliko pitanje nosi (ako izostaviš, nosi 1)
- kod u pitanju: stavi ga između tri apostrofa unazad, npr.
  `"text": "Šta ispisuje?\n```cpp\ncout << 2 + 3;\n```"` (`\n` = novi red)

Novi test: kopiraj postojeći `.json`, preimenuj ga i izmeni. Da test nestane iz liste,
izvadi ga iz `tests\`. Ako je test neispravan, učenik pri pokretanju dobije poruku
„Neispravan test: ..." sa opisom greške.

---

## 7) Ažuriranje aplikacije (nova verzija preko fleša)

Kad dobiješ novu verziju, na lab mašini **kopiraj preko starog** samo:

    server.js
    public\              (ceo folder)
    pokreni.bat, pokreni.vbs, pripremi.bat
    config.example.json, UPUTSTVO.md, README.md, package.json

**NE diraj** (to su tvoji podaci):

    config.json      <- tvoja lozinka i podešavanja
    tests\           <- tvoji testovi
    results\         <- rezultati učenika
    Exam.seb         <- SEB podešavanja
    node.exe, node_modules\

Ako na nekoj mašini `config.json` ne postoji, server ga pri pokretanju sam napravi
iz `config.example.json` — ali tada BEZ lozinke, pa je upiši (odeljak 6).

## 8) Kad nešto ne radi

| Problem | Rešenje |
|---|---|
| Admin: „Lozinka nije podesena" | Dodaj `admin_password` u `config.json`, restartuj server |
| Admin: „Pogresna lozinka", a sigurno je tačna | Proveri da li `config.json` ima grešku (zarez, navodnik); restartuj server |
| Browser: „ERR_CONNECTION_REFUSED" / ne može da se pristupi | Server ne radi — pokreni `pokreni.vbs` ili `node.exe server.js` |
| Test se ne pojavljuje u listi | Fajl nije u `tests\` ili nema nastavak `.json`; klikni „Osveži listu" |
| SEB se ne otvara | Proveri putanju do SEB-a u `pokreni.bat` i da `Exam.seb` postoji u folderu |
| Rezultat „NIJE sačuvan" kod učenika | Nalog nema pravo upisa — vidi odeljak 4 |

## Provera da je offline
Na jednoj mašini isključi WiFi (ostavi mrežnu karticu omogućenu u Device Manageru),
dvoklik na `pokreni.vbs`, prođi test do „Kraj testa". Ako rezultat legne — dokazano.

## Napomena
node.exe i lokalni server ponekad zna da označi antivirus/SmartScreen.
Ako se desi, dodaj izuzetak za folder na lab mašinama.
