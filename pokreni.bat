@echo off
REM Oslobodi port 3000 (ugasi zaostali server), pokreni svoj server preko node.exe,
REM saceka da proradi, pa otvori SEB. Pokrece se preko pokreni.vbs (skriveno).
cd /d "%~dp0"

REM 1) Ako nesto vec drzi port 3000 - ugasi ga (sprecava da te stari server prevari)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000" ^| findstr LISTENING') do taskkill /f /pid %%p >nul 2>&1

REM 2) Koristi lokalni node.exe ako postoji; u suprotnom instalirani 'node'
set NODE="%~dp0node.exe"
if not exist "%~dp0node.exe" set NODE=node

REM 3) Pokreni server iz OVOG foldera
start "" /b %NODE% "%~dp0server.js"

REM 4) Cekaj da server proradi na 127.0.0.1:3000 (max ~40s)
set /a tries=0
:wait
powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient('127.0.0.1',3000); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 goto ready
set /a tries+=1
if %tries% GEQ 40 exit /b 1
timeout /t 1 /nobreak >nul
goto wait

:ready
REM Prilagodi putanju do SEB-a ako je drugacija:
start "" "C:\Program Files\SafeExamBrowser\Application\SafeExamBrowser.exe" "%~dp0Exam.seb"
exit /b 0
