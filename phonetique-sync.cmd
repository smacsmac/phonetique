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
REM
REM  Sur Android, le raccourci cree a l'installation revendique l'hote
REM  entier SANS regarder le port. Deux applis servies depuis la meme
REM  adresse se marchent donc dessus : la seconde ne peut plus s'installer,
REM  le navigateur proposant d'ouvrir la premiere a la place.
REM
REM  D'ou une adresse par appli. Phonetique prend le NOM de la machine,
REM  noter garde l'adresse en chiffres.
REM
REM  Si le nom change un jour, remplace simplement smac ci-dessous.
REM ---------------------------------------------------------------------
set PHON_HOST=smac

REM ---------------------------------------------------------------------
REM  AFFICHAGE UNE FOIS INSTALLEE
REM    standalone  (defaut) plus de barre d'adresse, l'heure reste visible
REM    fullscreen  l'ecran entier, barre d'etat d'Android comprise
REM  Retire le REM ci-dessous pour le plein ecran total.
REM  Apres changement : desinstalle puis reinstalle l'appli sur le telephone,
REM  le mode d'affichage est fige au moment de l'installation.
REM ---------------------------------------------------------------------
REM set PHON_DISPLAY=fullscreen

REM ---------------------------------------------------------------------
REM  OU RANGER LES IMAGES SAUVEGARDEES
REM  Par defaut : phonetique-images\ a cote de ce fichier.
REM  Les images generees par l'appli vivent dans une base interne du
REM  navigateur, liee a l'adresse d'ouverture et sauvegardee nulle part.
REM  Ici, elles deviennent de vrais fichiers.
REM ---------------------------------------------------------------------
REM set PHON_IMAGES=D:\Sauvegardes\Phonetique\images

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
