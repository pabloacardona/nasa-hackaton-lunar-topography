@echo off
REM Lunar Mission Navigator - arranque local (doble clic)
cd /d "%~dp0"
echo Instalando/actualizando dependencias...
call npm install
if errorlevel 1 (
  echo Error en npm install. Revisa que Node.js este instalado: https://nodejs.org
  pause
  exit /b 1
)
if not exist ".env.local" copy ".env.example" ".env.local" >nul
echo Abriendo http://localhost:3005 en unos segundos...
start "" cmd /c "timeout /t 15 >nul && start http://localhost:3005"
call npm run dev -- -p 3005
pause
