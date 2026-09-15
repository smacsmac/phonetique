@echo off
REM ---------------------------------------------------------------------
REM  Phonetique - recuperer les mots surlignes du Kindle
REM
REM  POSE CE FICHIER DANS LE DOSSIER DE PHONETIQUE, a cote d'index.html.
REM  Il copie les deux fichiers de la liseuse ICI, dans son propre dossier
REM  (%~dp0) : rien n'est ecrit en dur, donc tu peux renommer ou deplacer
REM  le dossier sans toucher au script.
REM
REM  Branche la liseuse en USB, double-clique ce fichier, puis ouvre
REM  Le Labo > Le Liseur dans l'appli. C'est tout.
REM
REM  Ce fichier DOIT garder des fins de ligne Windows (CRLF) : avec des
REM  fins de ligne Unix, cmd.exe avale le premier caractere de certaines
REM  lignes et affiche "'cho' n'est pas reconnu". Ne le reenregistre pas
REM  depuis un editeur regle en Unix.
REM ---------------------------------------------------------------------

chcp 65001 >nul
setlocal enabledelayedexpansion
title Phonetique - mots du Kindle
cd /d "%~dp0"
set "DEST=%CD%"
set "ARCHIVES=%DEST%\kindle-archives"

echo.
echo   ================================================
echo     Phonetique - mots surlignes du Kindle
echo   ================================================
echo.
echo   Destination : %DEST%
echo.

REM --- Trouver la liseuse -------------------------------------------
REM  Le lecteur n'est pas toujours D: : Windows donne la lettre libre du
REM  moment. On cherche donc le marqueur le plus sur d'un Kindle.

set "KINDLE="
for %%D in (D E F G H I J K L M N O P Q R S T U V W X Y Z) do (
  if not defined KINDLE (
    if exist "%%D:\system\vocabulary\vocab.db" set "KINDLE=%%D:"
  )
)
if not defined KINDLE (
  for %%D in (D E F G H I J K L M N O P Q R S T U V W X Y Z) do (
    if not defined KINDLE (
      if exist "%%D:\documents\My Clippings.txt" set "KINDLE=%%D:"
    )
  )
)

if not defined KINDLE goto introuvable

echo   Liseuse trouvee sur %KINDLE%
echo.

REM --- Horodatage pour l'archive ------------------------------------
set "STAMP="
for /f "usebackq delims=" %%T in (`powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"`) do set "STAMP=%%T"
if not defined STAMP set "STAMP=copie"

set /a FAITS=0

REM --- vocab.db -----------------------------------------------------
REM  La liseuse ELAGUE vocab.db : les entrees anciennes finissent par
REM  disparaitre. On garde donc une copie datee de l'ancien avant de
REM  l'ecraser - elle peut rendre des phrases perdues plus tard.
REM  On n'archive que si le contenu a vraiment change (fc /b compare
REM  octet par octet), sinon lancer le script deux fois empilerait des
REM  copies identiques.

set "SRC_DB=%KINDLE%\system\vocabulary\vocab.db"
if exist "%SRC_DB%" (
  if exist "%DEST%\vocab.db" (
    fc /b "%DEST%\vocab.db" "%SRC_DB%" >nul 2>&1
    if errorlevel 1 (
      if not exist "%ARCHIVES%" mkdir "%ARCHIVES%" >nul 2>&1
      copy /y "%DEST%\vocab.db" "%ARCHIVES%\vocab-!STAMP!.db" >nul
      if not errorlevel 1 echo   Ancien vocab.db archive : kindle-archives\vocab-!STAMP!.db
    )
  )
  copy /y "%SRC_DB%" "%DEST%\vocab.db" >nul
  if errorlevel 1 (
    echo   ECHEC    vocab.db
  ) else (
    echo   Copie    vocab.db
    set /a FAITS+=1
  )
) else (
  echo   ABSENT   system\vocabulary\vocab.db sur la liseuse
)

REM --- My Clippings.txt ---------------------------------------------
REM  Le nom contient une espace : c'est le CHEMIN ENTIER qui se met
REM  entre guillemets doubles, pas le seul bout qui contient l'espace.

set "SRC_TXT=%KINDLE%\documents\My Clippings.txt"
if exist "%SRC_TXT%" (
  copy /y "%SRC_TXT%" "%DEST%\My Clippings.txt" >nul
  if errorlevel 1 (
    echo   ECHEC    My Clippings.txt
  ) else (
    echo   Copie    My Clippings.txt
    set /a FAITS+=1
  )
) else (
  echo   ABSENT   documents\My Clippings.txt sur la liseuse
)

echo.
if !FAITS!==0 (
  echo   Rien n'a ete copie.
  goto fin
)

REM --- Ce qu'on a maintenant ----------------------------------------
echo   ------------------------------------------------
for %%F in ("%DEST%\vocab.db" "%DEST%\My Clippings.txt") do (
  if exist %%F echo   %%~nxF   %%~zF octets   %%~tF
)
echo   ------------------------------------------------
echo.
echo   Ouvre maintenant Le Labo ^> Le Liseur dans l'appli.
echo   Les nouveaux mots arrivent tout seuls.
goto fin

:introuvable
echo   Aucune liseuse trouvee.
echo.
echo   Verifie que :
echo     - le Kindle est branche en USB et deverrouille ;
echo     - il apparait comme un lecteur dans l'Explorateur ;
echo     - il n'est pas en mode "charge seulement".
echo.
echo   Le script cherche, sur chaque lecteur de D: a Z: :
echo     system\vocabulary\vocab.db
echo     documents\My Clippings.txt

:fin
echo.
pause
endlocal
