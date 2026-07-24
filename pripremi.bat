@echo off
REM ============================================================
REM  Priprema "prenosive" verzije (bez instalacije Node-a na lab masinama).
REM  Pokrenuti SAMO jednom, na svom racunaru gde je Node.js instaliran.
REM ============================================================
cd /d "%~dp0"

echo [1/2] Instaliram express...
call npm install --omit=dev --no-audit --no-fund
if errorlevel 1 (
  echo GRESKA pri npm install. Da li je Node.js instaliran?
  pause & exit /b 1
)

echo.
echo [2/2] Kopiram prenosivi node.exe u folder...
where node >nul 2>&1
if errorlevel 1 (
  echo node nije pronadjen. Instaliraj Node.js pa probaj ponovo.
  pause & exit /b 1
)
for /f "delims=" %%i in ('where node') do (
  copy /Y "%%i" "%~dp0node.exe" >nul
  goto done
)
:done

echo.
echo ============================================================
echo  Gotovo! Folder sada radi i bez instaliranog Node-a.
echo  Za lab masine kopiraj CEO folder (ili samo ove stavke):
echo    node.exe, server.js, public\, node_modules\, tests\,
echo    config.json, Exam.seb, pokreni.vbs, pokreni.bat
echo ============================================================
pause
