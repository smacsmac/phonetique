@echo off
REM Lanceur Windows pour le serveur de synchro de Phonetique.
REM Ce fichier DOIT garder des fins de ligne Windows (CRLF) : avec des fins
REM de ligne Unix, cmd.exe avale le premier caractere de certaines lignes
REM et affiche des erreurs du genre "'ode' n'est pas reconnu".

REM chcp 65001 : sans ca, les accents s'affichent en charabia dans la console.
chcp 65001 >nul
cd /d "%~dp0"

REM ---------------------------------------------------------------------
REM  ADRESSE DEDIEE A PHONETIQUE
REM  Sur Android, le raccourci cree a l'installation revendique l'hote
REM  entier sans regarder le port : deux applis servies depuis la meme
REM  adresse se marchent dessus. Donne donc a Phonetique son adresse a elle.
REM  Retire le REM ci-dessous et mets ta deuxieme adresse IP.
REM ---------------------------------------------------------------------
REM set PHON_HOST=192.168.50.240

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
