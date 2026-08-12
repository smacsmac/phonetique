@echo off
REM Lanceur Windows pour le serveur de synchro de Phonetique.
REM Ce fichier DOIT garder des fins de ligne Windows (CRLF) : avec des fins
REM de ligne Unix, cmd.exe avale le premier caractere de certaines lignes
REM et affiche des erreurs du genre "'ode' n'est pas reconnu".

REM chcp 65001 : sans ca, les accents s'affichent en charabia dans la console.
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js est introuvable.
  echo   Installe-le depuis https://nodejs.org puis relance ce fichier.
  echo.
  pause
  exit /b 1
)

node phonetique-sync.mjs

REM Si la fenetre se ferme trop vite pour lire l'erreur, on la retient ici.
if errorlevel 1 pause
