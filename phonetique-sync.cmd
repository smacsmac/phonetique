@echo off
REM Lanceur Windows pour le serveur de synchro de Phonétique.
REM chcp 65001 : sans ça, les accents s'affichent en charabia dans la console.
chcp 65001 >nul
cd /d "%~dp0"
node phonetique-sync.mjs
REM Si la fenêtre se ferme trop vite pour lire l'erreur, on la retient ici.
if errorlevel 1 pause
