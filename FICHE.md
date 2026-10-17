# Fiche technique — Phonétique

Fiche à l'usage d'un **hub** qui lance et surveille l'application sans rien
y changer. Tout ce qui suit a été relevé dans le code de ce dépôt, pas de
mémoire ; les renvois `fichier:ligne` permettent de revérifier.

Ce que le dépôt ne peut pas savoir est marqué **à compléter**.

---

## 1. Identité

| | |
|---|---|
| **Nom** | Phonétique |
| **Dépôt** | `smacsmac/phonetique` — branche de travail `claude/korean-language-support-12zmdu` |
| **Dossier sur le PC** | **à compléter** — le lanceur fait `cd /d "%~dp0"`, donc le dossier est celui où tu as posé les fichiers |
| **Fichier du serveur** | `phonetique-sync.mjs` |
| **Module appelé** | `phonetique-cert.mjs` (importé par le serveur, pas lancé seul) |
| **Lanceur Windows** | `phonetique-sync.cmd` |
| **Page servie** | `index.html` — l'application entière, un seul fichier |
| **Dépendances npm** | **aucune.** Pas de `package.json`, pas de `node_modules`. Node 18 ou plus récent suffit |

Les quatre fichiers (`index.html`, `phonetique-sync.mjs`, `phonetique-cert.mjs`,
`phonetique-sync.cmd`) doivent être **dans le même dossier**, sauf à poser les
variables d'environnement de la section 2.

Un cinquième, `phonetique-kindle.cmd`, est un utilitaire manuel sans rapport
avec le serveur — voir section 8, il se termine par `pause`.

---

## 2. Démarrage

### La commande

```
node phonetique-sync.mjs
```

ou, en double-cliquant, `phonetique-sync.cmd` — qui ne fait rien de plus que
`chcp 65001`, `cd /d "%~dp0"`, poser `PHON_HOST=smac` et appeler la même
commande.

### Le serveur dépend-il du dossier de travail ?

**Non pour ses chemins par défaut, oui pour les chemins relatifs qu'on lui
passe.** C'est la nuance qui compte pour un hub.

Le serveur calcule son dossier depuis `import.meta.url`
(`phonetique-sync.mjs:27`) :

```js
const HERE = dirname(fileURLToPath(import.meta.url));
const APP  = resolve(process.env.PHON_APP  || join(HERE, 'index.html'));
const DATA = resolve(process.env.PHON_DATA || join(HERE, 'phonetique-donnees.json'));
```

Donc `node C:\chemin\vers\phonetique-sync.mjs` lancé depuis **n'importe quel
dossier** trouve son `index.html` et ses données. Le hub n'a pas besoin de
changer de dossier.

**Mais** chaque variable passe par `resolve()`, qui résout une valeur relative
**contre le dossier de travail du processus**. Si le hub pose
`PHON_DATA=donnees.json`, le fichier atterrira dans *le* dossier du hub.
→ **Ne passer que des chemins absolus.**

Le lanceur `.cmd`, lui, appelle `node phonetique-sync.mjs` en relatif : c'est
son `cd /d "%~dp0"` qui le sauve. Un hub qui appellerait le `.cmd` depuis
ailleurs est donc couvert ; un hub qui recopierait juste la ligne `node …` ne
le serait pas.

### Les variables d'environnement

Toutes facultatives (`phonetique-sync.mjs:28-55`).

| variable | défaut | rôle |
|---|---|---|
| `PORT` | `8790` | port http. **Le port https est `PORT+1`**, pas réglable séparément |
| `PHON_HOST` | vide | l'adresse mise en tête des listes, utilisée dans les instructions du téléphone, et **ajoutée au certificat**. Le lanceur pose `smac` |
| `PHON_DISPLAY` | `standalone` | `standalone`, `fullscreen` ou `minimal-ui`. Toute autre valeur retombe sur `standalone`. Figé au moment de l'installation sur le téléphone |
| `PHON_APP` | `<HERE>/index.html` | le `.html` servi |
| `PHON_DATA` | `<HERE>/phonetique-donnees.json` | le json partagé. **Attention : il entraîne avec lui le dossier des copies ET celui des certificats** — voir section 8 |
| `PHON_IMAGES` | `<dossier de PHON_DATA>/phonetique-images` | où ranger les images reçues |
| `PHON_KINDLE` | `<dossier de PHON_APP>` | où chercher `My Clippings.txt` et `vocab.db` |
| `PHON_COUVERTURES` | `<PHON_KINDLE>/kindle-couvertures` | les vignettes de couverture |

Constantes non réglables : corps de requête plafonné à **64 Mio** (`MAX_BODY`),
**30** copies de sauvegarde gardées (`KEEP`).

### À préparer au premier lancement

1. **Node 18+** installé et dans le `PATH`. Le lanceur vérifie (`where node`)
   et s'arrête proprement sinon — **à compléter** : version présente sur le PC.
2. `index.html` à côté du serveur (ou `PHON_APP` posé). Sans lui le serveur
   démarre quand même : `/` répond 404 « index.html introuvable à côté de ce
   script » (`phonetique-sync.mjs:535`).
3. **Le pare-feu Windows** demande l'autorisation réseau au tout premier
   lancement : accepter pour les réseaux **privés**. Sans ça, seul le PC voit
   le serveur.
4. Les certificats se créent **tout seuls** au premier démarrage, dans
   `phonetique-certs/`. Rien à préparer.
5. Côté téléphone, une fois pour toutes : installer l'autorité (section 4).

Aucun dossier n'est créé d'avance : `phonetique-certs/` l'est au démarrage,
`phonetique-copies/` à la première sauvegarde, `phonetique-images/` à la
première image reçue.

### Comment on l'arrête proprement

**Ctrl+C dans la fenêtre.** C'est ce que dit la dernière ligne du démarrage.

Il n'y a **aucun gestionnaire de signal** dans le code — pas de
`process.on('SIGINT')`, pas de `SIGTERM`. Node s'arrête donc immédiatement.

Pour un hub, cela veut dire qu'**un arrêt brutal est sans danger pour les
données** : toute écriture passe par un fichier temporaire suivi d'un
renommage (`writeAtomic`, `phonetique-sync.mjs:59`), et une copie datée est
prise avant chaque écrasement. Au pire, un fichier `…tmp-<pid>` orphelin reste
à côté des données ou dans le dossier des images. Il est inoffensif et le
comptage des images l'ignore déjà (`phonetique-sync.mjs:617`).

### Ce qu'il écrit sur la console (et qu'on perdrait sans fenêtre)

Au démarrage (`phonetique-sync.mjs:612-648`) :

- le chemin du fichier de données et **le nombre de cartes** qu'il contient ;
- le chemin des copies et combien sont gardées ;
- le chemin des images et combien il y en a ;
- `autorité locale créée (à installer une fois sur le téléphone)` — **une seule
  fois dans la vie de l'installation** ;
- `certificat serveur renouvelé (adresses changées ou expiration proche)` ;
- **toutes les adresses d'ouverture**, http puis https ;
- les trois étapes d'installation sur le téléphone.

En marche :

- `← 14:32:07  48 cartes, 310 mots` à chaque `PUT /donnees` ;
- `← 14:32:09  image img_ab12.png (214 Ko)` à chaque image reçue ;
- `! sauvegarde impossible : …` si la copie datée échoue — **l'écriture a lieu
  quand même** ;
- `! https indisponible : …` si le port 8791 est pris ;
- `! certificat impossible à préparer : …` ;
- `Le port 8790 est déjà pris. Essaie : PORT=8792 …` puis **`process.exit(1)`**.

Tout cela part sur `stdout` sauf les `!` et les erreurs, qui partent sur
`stderr`. Un hub qui capture les deux ne perd rien — mais voir section 8 pour
l'encodage.

### Le lanceur se termine-t-il par « pause » ?

**Non en marche normale.** `phonetique-sync.cmd` finit par :

```
node phonetique-sync.mjs
if errorlevel 1 pause
```

Le `pause` n'arrive donc **que si le serveur sort en erreur** (port pris, par
exemple), et il y en a un autre si Node est introuvable (ligne 51). En
fonctionnement normal, le `.cmd` reste simplement bloqué sur le processus Node
au premier plan jusqu'à Ctrl+C.

Conséquence pour le hub : **un `.cmd` qui ne rend pas la main après une erreur
n'est pas planté, il attend une touche.** Voir section 8.

---

## 3. Adresses et ports

| | |
|---|---|
| **http** | `8790` (`PORT`) |
| **https** | `8791` (`PORT + 1`) |
| **Interface d'écoute** | `0.0.0.0` — toutes les cartes réseau |

Le serveur https n'est monté **qu'après** la préparation des certificats, à
l'intérieur du rappel d'écoute du serveur http (`phonetique-sync.mjs:620-628`).
Les deux servent **exactement le même gestionnaire** : toutes les routes
existent sur les deux ports.

### L'adresse par laquelle l'application s'ouvre réellement

**`https://smac:8791`** — `smac` étant le nom de la machine, inscrit dans
l'annuaire de la box. C'est le sens de `PHON_HOST=smac` dans le lanceur.

L'installation de l'autorité, elle, se fait en clair : **`http://smac:8790/ca.crt`**.

> **à compléter** — l'adresse IP actuelle du PC, et confirmation que `smac` se
> résout bien depuis le téléphone sur ton réseau.

### Les adresses à NE PAS utiliser

- **L'adresse en chiffres (`192.168.…`) pour Phonétique.** Elle est réservée à
  `noter`. Les deux applications doivent avoir chacune la sienne : sur Android,
  le raccourci créé à l'installation revendique l'hôte entier **sans regarder
  le port**. Ouvrir Phonétique par l'IP reforme le conflit dans l'autre sens.
- **Le nom en `.local`** (`smac.local`) depuis le téléphone : Android ne sait
  généralement pas le résoudre, même si le certificat le couvre et que ça
  marche depuis le PC. Le serveur le propose quand même dans sa liste, car il
  survit à un changement d'IP.
- **`http://` pour installer l'application** : ce n'est pas un contexte
  sécurisé, donc pas de service worker, donc rien ne s'ouvre hors du réseau.

### Toutes les routes servies

| méthode | route | réponse |
|---|---|---|
| `OPTIONS` | n'importe laquelle | `204`, en-têtes CORS |
| `GET` | `/` et `/index.html` | le `.html`, avec `__BUILD__` remplacé par la date du fichier. `?download=1` ajoute un `Content-Disposition` pour le garder sur l'appareil |
| `GET` | `/manifest.webmanifest` | le manifeste (section 4) |
| `GET` | `/sw.js` | le service worker (section 4) |
| `GET` | `/icon-512.png` | l'icône, un PNG fabriqué en mémoire au premier appel |
| `GET` | `/ca.crt` | l'autorité à installer sur le téléphone, en pièce jointe. `404` si elle n'existe pas encore |
| `GET` | `/donnees` | le json partagé. `404 {"error":"aucune donnée encore"}` s'il n'existe pas |
| `PUT` | `/donnees` | remplace le json après vérification. `400` si JSON invalide ou données étrangères, `413` au-delà de 64 Mio |
| *autre* | `/donnees` | `405` |
| `GET` | `/kindle` | `{dossier, files:[{name,kind,size,mtime}]}` |
| `GET` | `/kindle/<nom>` | le fichier, **seulement si son nom figure dans le recensement** |
| `GET` | `/kindle/couvertures` | `{dossier, files:[{name,size}]}` |
| `GET` | `/kindle/couvertures/<nom>` | la vignette, même règle |
| `GET` | `/images` | `{dossier, cles:[…]}` |
| `GET` | `/images/<clé>` | l'image. `400` si la clé n'est pas `[A-Za-z0-9._-]{1,120}` |
| `PUT` | `/images/<clé>` | enregistre l'image. `415` si le type n'est pas png/jpeg/webp/gif/avif |
| *autre* | `/images/<clé>` | `405` |
| *n'importe laquelle* | `/health` | voir section 6 |
| | tout le reste | `404 {"error":"introuvable"}` |

Toutes les réponses portent `Cache-Control: no-store`,
`Access-Control-Allow-Origin: *` et `Access-Control-Allow-Private-Network: true`.

---

## 4. Installation sur le téléphone

### Les étapes, dans l'ordre

1. **Installer l'autorité.** Ouvrir `http://smac:8790/ca.crt` dans le
   navigateur du téléphone, puis *Paramètres › Sécurité › Chiffrement et
   identifiants › Installer un certificat › **Certificat CA***. Android exige
   un code de verrouillage sur l'appareil pour accepter.
2. **Ouvrir `https://smac:8791`.** Le cadenas doit être propre ; un
   avertissement signifie que l'adresse n'est pas couverte par le certificat
   (section 5).
3. **Menu du navigateur › « Installer l'application ».**

L'application installée reste **liée à cette adresse**. Réserver l'IP du PC
dans la box pour qu'elle ne change pas.

### Le manifeste

Servi sur `/manifest.webmanifest`, construit en mémoire
(`phonetique-sync.mjs:164-179`) :

| champ | valeur |
|---|---|
| `id` | `phonetique-app` |
| `name` / `short_name` | `Phonétique` |
| `description` | `Entraînement à la prononciation française et coréenne` |
| `start_url` | `/?app=phonetique` |
| `scope` | `/` |
| `display` | la valeur de `PHON_DISPLAY`, `standalone` par défaut |
| `background_color` / `theme_color` | `#05060F` |
| `lang` | `fr` |
| `icons` | `/icon-512.png`, 512×512, deux entrées : `any` et `maskable` |

L'`id` explicite n'est pas décoratif : sans lui, le navigateur déduit
l'identité de l'application installée de `start_url`, qui valait `/` — la même
valeur que `noter`. Voir section 8.

### Le service worker

Servi sur `/sw.js`. Enregistré par `index.html:19206` **seulement** si
`window.isSecureContext` et que le protocole commence par `http` — donc jamais
sur `http://192.168…`, ni sur une copie locale du fichier. C'est attendu : à
ces adresses l'application marche, elle ne s'installe pas.

**Cache : `phonetique-shell-v5`.** Changer ce nom purge tous les anciens à
l'activation.

**Mis en cache** — le « shell », capturé à l'installation avec
`cache: 'reload'` pour court-circuiter le cache HTTP du navigateur :

- `/`
- `/manifest.webmanifest`
- `/icon-512.png`

Puis, au fil de l'eau, toute réponse `GET` de même origine qui réussit.
Les navigations et `/index.html` sont rangées **sous la clé `/`**.

**Jamais mis en cache** (`phonetique-sync.mjs:216-217`) :

- `/donnees` — les données doivent venir du serveur ou pas du tout ;
- `/health` ;
- `/kindle` et tout `/kindle/…` — `vocab.db` pèse plus d'un mégaoctet et il
  peut y avoir des centaines de vignettes, que l'application digère aussitôt ;
- **tout ce qui n'est pas de la même origine** (polices, SDK vocal) : laissé
  passer sans y toucher ;
- **toute requête qui n'est pas `GET`**.

**Stratégie : réseau d'abord, cache en secours.** Avec une copie en réserve, le
réseau n'a que **3 secondes** pour répondre, car un PC absent du réseau ne
refuse pas la connexion — il ne répond pas. Le délai porte sur
l'*établissement* de la réponse, pas sur le transfert : un gros
téléchargement lent n'est pas pénalisé.

Dans tous les cas, la réponse du réseau met la copie à jour, même si la course
est perdue — et cette mise à jour est protégée par `e.waitUntil()`. Voir
section 8, c'est une erreur qui a coûté cher.

---

## 5. Certificat

| | |
|---|---|
| **Fabriqué par** | `phonetique-cert.mjs`, appelé par `ensureCerts()` au démarrage |
| **Rangé dans** | `phonetique-certs/`, **à côté du fichier de données** (`CERTDIR = join(dirname(DATA), 'phonetique-certs')`) |
| **À installer sur le téléphone** | `phonetique-ca.crt` — et lui seul |
| **Partagé avec une autre application ?** | **Non.** L'autorité est créée sous le nom `phonetique (autorité locale)`. `noter` a la sienne, séparée |

### Les cinq fichiers

| fichier | rôle |
|---|---|
| `phonetique-ca.crt` | l'autorité. Servie sur `/ca.crt`, installée une fois sur le téléphone |
| `ca.key` | **la clé privée de l'autorité.** Ne doit jamais quitter le PC |
| `server.crt` | le certificat du serveur, chaîne complète |
| `server.key` | sa clé privée |
| `meta.json` | `{hosts, expires}` — sert à décider s'il faut refaire le certificat |

### Les adresses couvertes

Dans cet ordre (`certHosts()`, `phonetique-sync.mjs:587-594`) :

1. `PHON_HOST` s'il est posé — donc **`smac`** ;
2. toutes les adresses IPv4 non internes des cartes réseau ;
3. `<nom-de-machine>.local` ;
4. `localhost` et `127.0.0.1`.

Les adresses en chiffres sont inscrites comme `iPAddress`, les noms comme
`dNSName` (`phonetique-cert.mjs:84-85`).

### Quand il est renouvelé

- **L'autorité : jamais.** Créée une seule fois, valable **3650 jours**, puis
  relue telle quelle à chaque démarrage. C'est délibéré : si elle changeait à
  chaque nouvelle IP du PC, il faudrait la réinstaller sur le téléphone à
  chaque fois.
- **Le certificat du serveur : refait automatiquement** si la liste des
  adresses a changé, **ou** s'il expire dans moins de 30 jours. Il est valable
  **397 jours** — Chrome refuse au-delà.

Un renouvellement du certificat serveur **ne demande rien au téléphone** :
l'autorité qu'il a déjà suffit à le valider.

---

## 6. Signe de vie

```
GET http://smac:8790/health
GET https://smac:8791/health
```

Disponible sur les deux ports, et sans vérification de méthode — mais un `GET`
est ce qu'il faut.

Réponse (`phonetique-sync.mjs:559-568`) :

```json
{
  "ok": true,
  "name": "smac",
  "app": "phonetique",
  "secure": false,
  "build": "2026-10-13 21:04:17",
  "images": "C:\\...\\phonetique-images",
  "addresses": ["http://smac:8790", "http://192.168.50.184:8790"],
  "https":    ["https://smac:8791", "https://192.168.50.184:8791"]
}
```

| champ | ce qu'il dit |
|---|---|
| `app` | **`"phonetique"` — c'est le champ qui distingue ce serveur d'un autre sur le même port.** À vérifier avant de conclure quoi que ce soit |
| `ok` | toujours `true` : la route n'existe que si le serveur répond |
| `name` | le nom de machine vu par Node |
| `secure` | `true` si la requête est arrivée par https |
| `build` | **la date du `index.html` sur le disque**, à la seconde près |
| `addresses` | les adresses dans le protocole de la requête |
| `https` | les adresses https, toujours |

**Pourquoi c'est plus qu'un port ouvert :** répondre à `/health` suppose que le
processus Node tourne, qu'il a chargé sa configuration et qu'il vient de lire
l'horodatage de `index.html` sur le disque.

**Ce que ça ne prouve pas :** si `index.html` est absent ou illisible, `build`
vaut `"inconnue"` et `ok` reste `true`. Un hub qui veut vérifier que
l'application est réellement servie doit donc **tester `build !== "inconnue"`**,
ou demander `/` et regarder le code de retour.

---

## 7. Données et sauvegardes

### Où vivent les données

| quoi | où | créé quand |
|---|---|---|
| **Les données** | `phonetique-donnees.json` (`PHON_DATA`) | à la première réception |
| **Les copies** | `phonetique-copies/` à côté des données | à la première sauvegarde |
| **Les images** | `phonetique-images/` (`PHON_IMAGES`) | à la première image reçue |
| **Les certificats** | `phonetique-certs/` à côté des données | au premier démarrage |

Le serveur **ne fusionne rien** : il garde le dernier état complet envoyé par
un appareil, qui a déjà fusionné le distant avec son local.

Avant d'écrire, il vérifie que le contenu **ressemble à des données de
Phonétique** (`looksLikePhonetique`, `phonetique-sync.mjs:354`) : un objet,
avec `grenier.cards`, `grenier.decks`, `repertoire.words`, `repertoire.folders`
en tableaux, et un `_app` qui ne soit pas celui d'une autre application. Un
JSON valide mais étranger est refusé avec `400` et **n'écrase rien**.

### Les copies

- **Quand :** à chaque `PUT /donnees`, **avant** l'écrasement. Jamais au
  démarrage, jamais sur un `GET`.
- **Quoi :** le contenu *précédent* du fichier de données.
- **Nom :** `donnees-<horodatage ISO>.json`, les `:` et `.` remplacés par des
  `-` — par exemple `donnees-2026-10-17T14-03-55-123Z.json`.
- **Combien :** les **30 dernières**. Le ménage trie les `.json` par nom (ce
  qui, pour de l'ISO, revient à trier par date) et supprime les plus anciens.
- **Si la copie échoue**, le serveur affiche `! sauvegarde impossible` et
  **écrit quand même** les nouvelles données.

### Les images

Reçues par `PUT /images/<clé>`, écrites `<clé>.<ext>` dans `phonetique-images/`,
en écriture atomique elles aussi. Elles existent parce que, côté navigateur,
les images vivent dans IndexedDB : une base **liée à l'adresse d'ouverture**,
que ni l'export ni la synchro des cartes n'emportent.

### Les fichiers de la liseuse

Entrées, pas sorties : `My Clippings.txt` et `vocab.db` dans `PHON_KINDLE`,
les vignettes dans `kindle-couvertures/`. Le serveur les lit, ne les écrit
jamais. `phonetique-kindle.cmd` les copie depuis la liseuse et archive
l'ancien `vocab.db` dans `kindle-archives/` quand son contenu a changé.

### À ne JAMAIS supprimer

| | pourquoi |
|---|---|
| `phonetique-donnees.json` | la seule source de vérité : cartes, Répertoire, scores, réglages |
| `phonetique-copies/` | le seul filet si un appareil envoie un état appauvri |
| `phonetique-images/` | les images ne sont sauvegardées nulle part ailleurs — ni l'export ni la synchro ne les emportent |
| `phonetique-certs/` | perdre `ca.key` et `phonetique-ca.crt` oblige à **réinstaller l'autorité sur le téléphone**, et l'application installée casse en attendant |
| `kindle-archives/` | contient des `vocab.db` que la liseuse a depuis élagués : des phrases qui n'existent plus nulle part |

Les quatre premiers sont exclus du dépôt par `.gitignore`, donc **aucune
opération git ne les restaurera**.

Recréables sans drame : `kindle-couvertures/` (relancer
`phonetique-kindle.cmd`), les fichiers `…tmp-<pid>` orphelins, `server.crt` /
`server.key` / `meta.json` (refaits au démarrage suivant — mais **pas**
`ca.key` ni `phonetique-ca.crt`).

---

## 8. Ce qui la casserait

### Pièges qui touchent directement le hub

**Le `.cmd` bloque sur `pause` après une erreur.** `if errorlevel 1 pause`, plus
un autre si Node est introuvable. Un hub qui lance le `.cmd` et attend la fin
du processus attendra **indéfiniment** une touche que personne ne tapera, et
lira « le serveur tourne » alors qu'il est mort. → Lancer `node
phonetique-sync.mjs` directement, ou prévoir un délai et une entrée standard
fermée.

**`phonetique-kindle.cmd` se termine *toujours* par `pause`** (ligne 164). Ce
n'est pas le serveur, mais si le hub propose de le lancer, même remarque.

**La console est en UTF-8**, via `chcp 65001` dans le lanceur. Un hub qui
capture `stdout` en page de code Windows par défaut (cp850/cp1252) affichera du
charabia sur les accents. Et s'il lance `node` directement sans passer par le
`.cmd`, le `chcp` n'a pas eu lieu du tout.

**Les fins de ligne du `.cmd` doivent rester Windows (CRLF).** Avec des fins de
ligne Unix, `cmd.exe` **avale le premier caractère de certaines lignes** et
sort des erreurs du genre `'ode' n'est pas reconnu`. C'est arrivé, et c'est
pour ça que `.gitattributes` force `eol=crlf` sur `*.cmd`. Un hub qui
régénérerait ou réécrirait ce fichier doit respecter ça.

**Port pris : le serveur sort avec `process.exit(1)`** après un message. Mais
si c'est **le port https (8791)** qui est pris, le serveur **continue de
tourner en http** et se contente d'un `! https indisponible` sur la console.
→ Un hub ne doit pas conclure « tout va bien » parce que 8790 répond :
interroger aussi `https://…:8791/health`.

**Un chemin relatif dans une variable d'environnement se résout contre le
dossier de travail du hub**, pas contre celui du script. Toujours des chemins
absolus.

**`PHON_DATA` entraîne trois dossiers avec lui** : les copies, les images *et*
les certificats sont calculés depuis `dirname(DATA)`. Déplacer le fichier de
données déplace donc le dossier des certificats — le serveur n'y trouve plus
d'autorité, **en fabrique une nouvelle**, et le téléphone cesse de faire
confiance au serveur jusqu'à réinstallation de la nouvelle autorité. C'est le
piège le plus coûteux de cette liste. (De même, `PHON_KINDLE` suit `PHON_APP`.)

**Le serveur n'a aucune authentification**, et répond
`Access-Control-Allow-Origin: *`. N'importe quoi sur le réseau local peut lire
`/donnees` et en écrire un remplaçant — la seule barrière est la vérification
de forme. C'est assumé pour un réseau domestique. Mais **un hub ne doit en
aucun cas relayer ces ports vers l'extérieur** ni les publier au-delà du LAN.

### Pièges découverts en se cognant dedans

**Une adresse par application.** Sur Android, le raccourci créé à
l'installation **revendique l'hôte entier sans regarder le port**. Deux
applications servies depuis la même adresse se marchent dessus : la seconde ne
s'installe plus, le navigateur proposant d'ouvrir la première. D'où
`PHON_HOST=smac` pour Phonétique et l'adresse en chiffres pour `noter`.
**Changer le port ne résout rien** — c'est l'erreur de diagnostic qu'on a
faite.

**Le manifeste sans `id`.** Le navigateur déduisait alors l'identité de
`start_url`, qui valait `/` — identique à celle de `noter`. Il proposait
« ouvrir noter » au lieu d'installer Phonétique.

**`New-NetIPAddress` sur une carte en DHCP.** Donner une deuxième IP au PC avec
cette commande bascule silencieusement la carte en statique et **efface
l'adresse, la passerelle et les DNS** : le PC perd le réseau. Réparation :
`Set-NetIPInterface -InterfaceAlias "Ethernet" -Dhcp Enabled` puis
`ipconfig /renew`. Le nom d'hôte fait le même travail sans risque.

**`e.waitUntil()` autour de l'écriture en cache du service worker.** Sans lui,
le navigateur peut arrêter le worker dès que `respondWith` a rendu sa réponse —
avant la fin de l'écriture. Sur téléphone il ne s'en prive pas : la copie
gardée restait celle de l'installation **indéfiniment**, et remplacer
`index.html` ne changeait rien hors réseau.

**`Access-Control-Allow-Private-Network`.** Chrome traite une page ouverte en
fichier local comme « publique » et bloque ses requêtes vers une adresse privée
sans cet en-tête. Android l'applique strictement, ChromeOS beaucoup moins —
d'où un Chromebook qui marchait et un téléphone qui échouait avec exactement la
même configuration.

**`localStorage` muet sur une page `content://`.** Sous Android, une page
ouverte par ce schéma accepte les écritures et perd tout à la fermeture. D'où
le témoin écrit-relu-effacé au démarrage, et le bandeau bloquant si ça échoue.

**Changer d'adresse change d'origine.** Passer de
`https://192.168.50.184:8791` à `https://smac:8791` ne supprime pas les images
d'IndexedDB mais les rend invisibles : les cartes affichent « ⚠ image
introuvable ». C'est la raison d'être de `phonetique-images/`.

**Le `.local` depuis Android.** Le serveur le propose, le certificat le couvre,
ça marche depuis le PC — et Android ne le résout pas.

### Incohérence connue, laissée telle quelle

Quand `PHON_HOST` est un **nom** (notre cas : `smac`), le serveur affiche les
instructions du téléphone avec ce nom, puis ajoute juste en dessous :
« Prends bien l'adresse en chiffres ci-dessus ». Les deux lignes se
contredisent — l'avertissement vise les noms en `.local`, pas un nom
d'annuaire. Signalé ici plutôt que corrigé : cette fiche ne change rien à
l'application. Si le hub réaffiche ces lignes, autant le savoir.
