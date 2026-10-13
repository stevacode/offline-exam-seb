# OfflineTest — prenosiva verzija (bez instalacije Node-a na lab mašinama)

Aplikacija je 100% offline (radi na 127.0.0.1, ne koristi internet).
Umesto pakovanja u jedan .exe (što na Windowsu traži alate za kompajliranje),
nosimo prenosivi `node.exe` u folderu — radi iz prve, bez kompajliranja.

## 1) Priprema (SAMO jednom, na svom računaru gde je Node.js instaliran)

U folderu projekta dvoklik na **`pripremi.bat`**. On:
- instalira `express` (u `node_modules\`),
- kopira prenosivi `node.exe` u folder.

Posle ovoga folder radi i na mašinama gde Node NIJE instaliran.

## 2) Šta kopiraš na svaku lab mašinu

Najlakše: kopiraj CEO folder. Ili bar ove stavke u jedan folder:

    node.exe          <- prenosivi Node (iz koraka 1)
    server.js
    public\           (app.js, index.html) — UI
    node_modules\     <- samo express (mali)
    tests\            <- .json testovi (slobodno menjaš)
    config.json       <- podešavanja (port, pragovi ocena)
    Exam.seb          <- SEB konfiguracija
    pokreni.vbs       <- OVO dvoklik za pokretanje (sve skriveno)
    pokreni.bat

Na lab mašinama NE treba instalirati Node.

## 3) Pokretanje

Dvoklik na **`pokreni.vbs`**. On:
1. pokrene server preko `node.exe` skriveno (nema crnog prozora),
2. sačeka da server stvarno proradi na portu 3000 (rešava „connection refused"),
3. otvori SEB sa `Exam.seb`.

Ako ti je SEB na drugoj putanji, ispravi liniju sa `SafeExamBrowser.exe` u `pokreni.bat`.

## 4) Gde su rezultati

U `results\` pored `server.js` (JSON po pokušaju + zbirni `rezultati.csv`).
Ako nalog nema pravo upisa tu, server sam pređe na:
`C:\Users\<nalog>\AppData\Local\OfflineTestSEB\results\`
Da rezultati uvek ostanu pored aplikacije: daj nalogu „Ucenik" pravo upisa
nad tim folderom (desni klik → Properties → Security → Edit → Modify).

## 5) Admin — pregled rezultata

1. U `config.json` dodaj polje `"admin_password": "tvoja_lozinka"`.
   Bez tog polja admin je zaključan (nijedna lozinka ne prolazi).
2. Dok server radi, u **običnom pretraživaču** otvori `http://127.0.0.1:3000/admin`
   (ili Ctrl+Alt+A / link „· admin ·" sa početnog ekrana).
3. U panelu: tabela rezultata, statistika po pitanju, „Preuzmi CSV",
   „Odjava" i „← Nazad na test" (ili taster Esc).

Pravu lozinku ne stavljaj u repozitorijum — `config.json` na lab mašinama drži lokalno.

## Provera da je offline
Na jednoj mašini isključi WiFi (ostavi mrežnu karticu omogućenu u Device Manageru),
dvoklik na `pokreni.vbs`, prođi test do „Kraj testa". Ako rezultat legne — dokazano.

## Napomena
node.exe i lokalni server ponekad zna da označi antivirus/SmartScreen.
Ako se desi, dodaj izuzetak za folder na lab mašinama.
