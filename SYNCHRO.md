# Synchro de Phonétique sur le réseau local

Tes cartes, mots et scores partagés entre le PC, le Chromebook et le téléphone,
**sans nuage** : tout reste chez toi. Chaque appareil garde ses données et
fonctionne sans réseau ; la synchro est une étape séparée qui ne bloque jamais.

```
PC Windows ── phonetique-sync.mjs (Node, zéro dépendance)
                ├─ http  :8790  → appli + /ca.crt + données
                └─ https :8791  → appli installable (PWA), certificat auto-généré

Source de vérité : un seul phonetique-donnees.json sur le PC
```

## Mise en route sur le PC

1. Node 18 ou plus récent.
2. Mets dans un même dossier : `index.html`, `phonetique-sync.mjs`,
   `phonetique-cert.mjs`, `phonetique-sync.cmd`.
3. Double-clique **`phonetique-sync.cmd`** (ou `node phonetique-sync.mjs`).
4. Au premier lancement, Windows demande l'autorisation réseau :
   accepte pour les réseaux **privés**.

La fenêtre affiche les adresses à utiliser. Laisse-la ouverte ; `Ctrl+C` arrête.

> Le port par défaut est **8790** (https sur 8791), différent de `noter` pour
> que les deux serveurs tournent en même temps sans se marcher dessus.

## Réglages du serveur

Tous facultatifs, à poser dans `phonetique-sync.cmd` :

| réglage | rôle |
|---|---|
| `PORT` | http ; https = `PORT+1` (défaut 8790) |
| `PHON_HOST` | l'adresse ou le nom mis en avant, et ajouté au certificat |
| `PHON_DISPLAY` | `standalone` (défaut) ou `fullscreen` une fois installée |
| `PHON_IMAGES` | où ranger les images sauvegardées |
| `PHON_KINDLE` | où chercher `My Clippings.txt` et `vocab.db` (défaut : le dossier de l'appli) |
| `PHON_COUVERTURES` | où chercher les vignettes de couverture (défaut : `kindle-couvertures/`) |
| `PHON_APP` / `PHON_DATA` | chemins du `.html` servi et du json partagé |

## Sur chaque appareil

Ouvre l'appli, va dans **Paramètres › Synchro**, et choisis un mode.

![le panneau Synchro](apercu-synchro.png)

### sauvegarde — le plus sûr

L'appareil **envoie** son état, sans jamais rien reprendre. Aucune fusion,
donc rien ne bouge dans ton dos. C'est le mode à choisir quand **un seul
appareil** fait autorité et que le serveur ne sert que de coffre.

⚠️ La sauvegarde **écrase** ce que le serveur contenait. Un seul appareil doit
donc envoyer — sinon le dernier à parler efface le précédent. Sur les autres,
décoche la sauvegarde automatique.

La sauvegarde automatique n'envoie que si **quelque chose a changé** : sans
cela elle écrirait toutes les 45 secondes, et comme le serveur archive une
copie horodatée à chaque écriture en n'en gardant que 30, l'historique
entier tournerait en vingt minutes. Un envoi manuel, lui, part toujours.

Deux boutons de retour en arrière : **restaurer depuis le serveur** et
**restaurer depuis un fichier** (pour piocher dans `phonetique-copies/`). Les
deux *remplacent* tout, et téléchargent d'abord une copie de l'état actuel.

### réseau local — la vraie synchro

Tous les appareils fusionnent, dans les deux sens. Puissant, mais c'est là que
les surprises arrivent si plusieurs appareils modifient les mêmes dossiers.

- **synchro automatique** : au retour du réseau, au retour sur l'appli, et
  toutes les 45 secondes.
- La ligne d'état indique `à jour · 20:40`, ou `hors réseau · 3 modifications
  en attente` quand le PC est éteint — ce n'est pas une erreur, juste une
  attente.

### fichier partagé — sans serveur

**Fusionne** un `.json` venu d'ailleurs, au lieu d'écraser comme le fait
l'import classique.

### Chromebook et PC

Une copie locale du `.html` fonctionne et s'ouvre même hors réseau. Vise
`http://<IP-du-PC>:8790`.

### Une adresse par application

Sur Android, le raccourci que crée le navigateur à l'installation revendique
**l'hôte entier, sans regarder le port**. Deux applications servies depuis la
même adresse se marchent donc dessus : la seconde ne peut plus s'installer, le
navigateur proposant d'ouvrir la première à la place.

D'où la répartition :

| application | adresse |
|---|---|
| `noter` | `192.168.50.184` — l'adresse en chiffres |
| Phonétique | `smac` — le nom de la machine |

Le nom vient de l'annuaire de la box, qui inscrit les appareils qu'elle
connaît. `PHON_HOST=smac` dans le lanceur suffit : le serveur met ce nom en
tête et **l'ajoute au certificat**, sans toucher à l'autorité déjà installée
sur le téléphone.

N'ouvre pas Phonétique par l'adresse en chiffres, ni `noter` par le nom, sinon
le conflit se reforme dans l'autre sens.

> ⚠️ Ne cherche pas à donner une deuxième adresse IP au PC avec
> `New-NetIPAddress` : sur une carte en DHCP, cette commande bascule la carte
> en statique et **efface l'adresse, la passerelle et les DNS**. Le PC perd sa
> connexion. Pour réparer : `Set-NetIPInterface -InterfaceAlias "Ethernet"
> -Dhcp Enabled` puis `ipconfig /renew`. Le nom d'hôte fait le même travail
> sans aucun risque.

### Téléphone Android

1. Installe l'autorité : ouvre `http://<IP>:8790/ca.crt`, puis
   Paramètres › Sécurité › Chiffrement et identifiants › Installer un
   certificat › **Certificat CA**. Android exige un code de verrouillage.
2. Ouvre `https://<IP>:8791`.
3. Menu du navigateur › **Installer l'application**.

**Prends l'adresse en chiffres**, pas le nom en `.local` : Android ne sait
généralement pas le résoudre, même si le certificat le couvre et qu'il marche
depuis le PC.

⚠️ Installer une autorité sur un téléphone signifie que la clé privée restée
sur le PC peut usurper n'importe quel site auprès de cet appareil. Le dossier
`phonetique-certs/` ne doit jamais quitter ta machine — il est exclu du dépôt
par `.gitignore`.

## Mode « fichier partagé »

Sans serveur : **fusionner un fichier…** prend un `.json` exporté depuis un
autre appareil (clé USB, dossier partagé, nuage) et le **fusionne** au lieu
d'écraser — contrairement à l'import classique. Puis **exporter l'état
fusionné** pour le rapporter.

## Les fichiers de la liseuse

Dépose `My Clippings.txt` et `vocab.db` à côté de `index.html` : le serveur les
recense sur `/kindle`, et **Le Labo › Le Liseur › Depuis le serveur** met tes
mots surlignés à jour sans rien téléverser depuis le téléphone.

Le serveur ne publie que les fichiers qu'il a lui-même recensés, jamais un
chemin venu du réseau. Voir [LISEUR.md](LISEUR.md).

## Les images

Les images générées par l'appli **ne sont pas dans un dossier** : elles vivent
dans une base interne du navigateur (IndexedDB, `pho_images`). Deux
conséquences qui surprennent :

- **Elles sont liées à l'adresse d'ouverture.** Passer de
  `https://192.168.50.184:8791` à `https://smac:8791` change d'origine : les
  images restent sur l'appareil, mais deviennent invisibles pour la nouvelle
  adresse. Les cartes s'affichent alors avec « ⚠ image introuvable ».
- **Rien ne les sauvegarde**, ni l'export, ni la synchro des cartes.

Le serveur leur donne donc de vrais fichiers, dans `phonetique-images/`
(modifiable par `PHON_IMAGES`), nommés d'après leur clé : `img_….png`.

**Envoyer** — Paramètres › Synchro › sauvegarde › **envoyer les images**. Le
panneau indique combien il en reste à envoyer et où elles atterrissent sur le
PC. Une sauvegarde de données les emporte aussi, automatiquement.

**Récupérer** — rien à faire : quand une carte réclame une image absente de la
base locale, l'appli va la chercher sur le serveur et la remet en base. Une
carte reçue d'un autre appareil retrouve donc son image toute seule.

### Récupérer des images d'une ancienne adresse

Si des images ont disparu après un changement d'adresse, elles sont encore là,
sous l'ancienne origine — y compris un ancien lien GitHub Pages. Il faut donc
ouvrir l'appli **à cette ancienne adresse** pour les atteindre.

Elles ne sont pas trouvables comme fichiers sur l'appareil : le navigateur les
garde dans son stockage privé, inaccessible sans rooter le téléphone.

**Par un fichier** (marche partout, même sans serveur joignable) :

1. Ouvre l'appli à l'**ancienne** adresse.
2. Paramètres › Synchro › **exporter les images vers un fichier**.
3. Ouvre l'appli à la **nouvelle** adresse.
4. Paramètres › Synchro › **importer des images depuis un fichier…**

**Par le serveur** (si l'ancienne adresse peut le joindre) : à l'étape 2,
utilise plutôt le mode **sauvegarde** › **envoyer les images**. Rien à faire à
l'arrivée : les images reviennent d'elles-mêmes au fil de l'affichage.

> Une page servie depuis une adresse publique (GitHub Pages) vers un serveur
> du réseau local se heurte parfois au blocage « réseau privé » d'Android.
> D'où la voie par fichier, qui ne dépend d'aucun réseau.

## Hors du réseau

L'appli s'ouvre et fonctionne sans le PC : les données vivent sur l'appareil,
la synchro n'est qu'une étape séparée.

Encore faut-il qu'elle n'attende pas le serveur pour s'afficher. Un PC absent
du réseau ne **refuse** pas la connexion — il ne répond pas. Les paquets
partent, rien ne revient, et le système attend sa minute entière avant
d'abandonner. Le service worker s'arrête donc au bout de **trois secondes** et
sert sa copie.

Ces trois secondes couvrent l'**établissement** de la réponse, pas le
transfert : `fetch` rend la main dès que les en-têtes arrivent, et le corps
continue ensuite à son rythme. Un téléchargement lent n'est pas pénalisé ;
seule une connexion qui ne s'établit jamais l'est. Remplacer `index.html` et
rouvrir montre donc toujours le neuf du premier coup.

La requête partie continue en arrière-plan et rafraîchit la copie : même
quand le délai a joué, l'ouverture suivante aura la dernière version.

> ⚠️ Le service worker ne se met à jour qu'au chargement suivant. Après avoir
> remplacé `phonetique-sync.mjs`, **relance le serveur et ouvre l'appli une
> fois en étant chez toi** : sans ça, l'ancien service worker reste aux
> commandes et l'attente sans limite avec lui.

## Le bouton Retour d'Android

Il fait exactement ce que fait le bouton Retour de l'appli : revenir à l'écran
précédent. Une fenêtre ouverte (nouveau paquet, choix de dossier) se ferme
d'abord — sinon elle flotterait par-dessus l'écran suivant, vivant hors de la
zone que l'appli redessine.

Une fois à l'accueil, l'appli lâche prise et Android la ferme comme avant.

## Comment la fusion décide

Enregistrement par enregistrement, jamais fichier par fichier. Chaque carte
porte **trois horodatages indépendants** :

| horodatage | ce qu'il couvre |
|---|---|
| `uContent` | mot, API, définition, genre, étiquettes, couleur, suppression |
| `uReview`  | intervalle, facilité, répétitions, prochaine échéance |
| `uPlace`   | paquet d'appartenance |

Réviser une carte sur le téléphone pendant que tu corriges sa définition sur le
PC ne fait donc rien perdre : chaque groupe se compare séparément, et le plus
récent gagne — indépendamment des autres.

Le reste : scores et bilans fusionnent en **gardant le meilleur** ; les
réglages forment un bloc unique où le dernier appareil qui les modifie gagne ;
l'historique de recherche est une union dédoublonnée plafonnée à 30.

Les suppressions laissent une **pierre tombale** horodatée, purgée après
90 jours. Sans elle, l'autre appareil renverrait l'enregistrement à la synchro
suivante et il ressusciterait.

## Ce que le serveur ne fait pas

Il ne fusionne rien : il garde le dernier état complet envoyé par un appareil,
qui a déjà fusionné le distant avec son local. Il vérifie seulement que ce
qu'il reçoit ressemble à des données de Phonétique — un JSON valide mais
étranger écraserait tout.

Avant chaque écriture il fait une **copie horodatée** dans
`phonetique-copies/` (les 30 dernières), et l'écriture est **atomique** :
fichier temporaire puis renommage, pour qu'une coupure de courant ne laisse
jamais un fichier à moitié écrit.

## Si ça ne marche pas

| symptôme | cause probable |
|---|---|
| Marche sur le Chromebook, échoue sur le téléphone | l'en-tête `Access-Control-Allow-Private-Network` — le serveur l'envoie déjà ; vérifie que tu passes bien par lui |
| `DNS_PROBE_FINISHED_NXDOMAIN` sur Android | tu as utilisé un nom `.local` ; prends l'IP |
| L'appli installée ne s'ouvre plus | l'IP du PC a changé — réserve-la dans ta box |
| Bandeau rouge « ne peut rien enregistrer » | fichier ouvert depuis les Téléchargements Android (`content://`) : passe par l'adresse du serveur |
| L'appli servie ne s'ouvre pas hors réseau | c'est attendu en `http://` : utilise le lien de téléchargement du panneau, ou installe la version https |
| Le navigateur propose « ouvrir *l'autre appli* » au lieu d'installer | les deux applis partagent le même hôte — voir « Une adresse par application » |
| Avertissement de certificat sur `https://smac:8791` | le nom n'est pas encore dans le certificat : mets `PHON_HOST=smac` et relance |
| « ⚠ image introuvable » sur des cartes | l'image appartient à une autre adresse — voir « Récupérer des images d'une ancienne adresse » |
| Le port 8790 est pris | `PORT=8792 node phonetique-sync.mjs` |
| Le Liseur ne trouve aucun fichier | `My Clippings.txt` et `vocab.db` ne sont pas dans le dossier servi — voir `PHON_KINDLE` |
| `'ode' n'est pas reconnu` au lancement | le `.cmd` a perdu ses fins de ligne Windows ; reprends le fichier fourni sans le réenregistrer depuis un éditeur Unix |
| L'appli met une minute à s'ouvrir hors de chez toi | l'ancien service worker est encore actif : relance le serveur et ouvre l'appli une fois chez toi |
| Le bouton Retour d'Android ferme l'appli | même cause — l'ancienne version est encore en place |

## Sauvegardes

Le fichier de données et ses copies vivent à côté du script et sont exclus du
dépôt. Ils sont ta vraie sauvegarde : pense à les copier ailleurs de temps en
temps.
