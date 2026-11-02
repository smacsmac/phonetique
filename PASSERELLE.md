# Passerelle — faire entrer des livres dans La Récolte

Fiche à l'usage d'une **autre application** (le liseur de bandes dessinées)
qui veut déposer des titres et des couvertures pour qu'ils paraissent dans la
chronologie de Phonétique. Tout ce qui suit a été relevé dans le code de ce
dépôt, pas de mémoire ; les renvois `fichier:ligne` permettent de revérifier.

Ce que le dépôt ne peut pas savoir est marqué **à compléter**.

> **Le serveur a changé.** Cette passerelle ajoute des routes à
> `phonetique-sync.mjs`. Il ne suffit plus de remplacer `index.html` :
> il faut remplacer **les deux fichiers** et redémarrer le serveur.

---

## 1. Le principe en trois phrases

Le serveur de Phonétique tient une **boîte aux lettres** : un fichier JSON que
l'autre appli écrit en entier, et que Phonétique lit. Les couvertures sont des
fichiers image posés dans un dossier à côté, servis par leur nom.

L'autre appli n'écrit jamais dans les données de Phonétique, et Phonétique
n'écrit jamais dans la boîte. Personne ne peut abîmer les données de l'autre.

Phonétique relève la boîte toute seule, sans rien demander, chaque fois que tu
arrives sur la liste des livres de La Récolte (`index.html:19041`).

---

## 2. Les deux fichiers sur le PC

| | |
|---|---|
| **La boîte** | `phonetique-entrees.json`, à côté du fichier de données — donc, par défaut, à côté de `phonetique-donnees.json` |
| **Les couvertures** | dossier `entrees-couvertures/`, à côté de `phonetique-sync.mjs` |
| **Pour les déplacer** | variables d'environnement `PHON_ENTREES` et `PHON_ENTREES_IMG` (`phonetique-sync.mjs:48-49`) |

Le serveur crée le dossier des couvertures au premier dépôt ; il n'a pas
besoin d'exister d'avance. Une boîte jamais remplie se lit quand même : la
route rend `{"entrees":[]}` au lieu d'une erreur (`phonetique-sync.mjs:560-562`).

Au démarrage, le serveur affiche le chemin de la boîte et le nombre d'entrées
qu'elle contient (`phonetique-sync.mjs:714-715`) — de quoi vérifier d'un coup
d'œil qu'on parle bien du même fichier.

**À compléter** : le dossier exact sur ton PC, qui dépend de l'endroit où tu as
posé les fichiers.

---

## 3. Les routes

L'adresse du serveur est la même que celle de Phonétique — **à compléter**
(typiquement `https://<nom-du-pc>:8790`, voir `FICHE.md` section 3).

### `GET /recolte`

Rend la boîte telle quelle. Phonétique s'en sert ; l'autre appli peut s'en
servir pour relire ce qu'elle a déposé.

```
curl -k https://<serveur>/recolte
```

### `PUT /recolte`

Remplace **toute** la boîte. Corps : du JSON, type `application/json`.

```
curl -k -X PUT https://<serveur>/recolte \
  -H 'content-type: application/json' \
  -d '{"entrees":[{"id":"tintin-lune","titre":"On a marché sur la Lune","couverture":"tintin.png","at":1762070400000}]}'
```

Réponse : `{"ok":true,"entrees":1}`.

C'est un **remplacement, pas un ajout** : la liste envoyée devient la boîte.
L'autre appli doit donc toujours envoyer son catalogue entier. Le serveur
horodate le dépôt dans un champ `_at` qu'il ajoute lui-même.

Avant d'écrire, le serveur vérifie la forme (`phonetique-sync.mjs:374-383`) et
répond `400` sans rien toucher si :

- ce n'est pas du JSON, ou pas un objet ;
- il manque le tableau `entrees` ;
- une entrée n'est pas un objet, ou n'a pas d'`id` qui soit une chaîne non
  vide ;
- il y a plus de 2000 entrées (`MAX_ENTREES`, `phonetique-sync.mjs:50`).

Un dépôt refusé laisse la boîte exactement comme elle était.

### `GET /recolte/couvertures`

Rend la liste des images présentes dans le dossier :
`{"dossier":"…","files":[{"name":"tintin.png","size":4096}]}`.
Seules les extensions `.jpg`, `.jpeg`, `.png`, `.webp` sont recensées
(`phonetique-sync.mjs:385-397`).

### `PUT /recolte/couvertures/<nom>`

Dépose une image. Type obligatoire : `image/png`, `image/jpeg` ou `image/webp`
— autre chose donne `415`.

```
curl -k -X PUT https://<serveur>/recolte/couvertures/tintin.png \
  -H 'content-type: image/png' --data-binary @tintin.png
```

Le nom doit tenir dans `^[A-Za-z0-9._-]{1,120}$` et ne pas contenir `..`
(`phonetique-sync.mjs:404`) — donc pas d'accent, pas d'espace, pas de barre
oblique. Le nom est refusé (`400`) plutôt que corrigé. Taille maximale du
corps : 64 Mo (`MAX_BODY`, `phonetique-sync.mjs:51`).

L'écriture est atomique : fichier temporaire puis `rename`. Une image en cours
de dépôt n'est jamais servie à moitié.

### `GET /recolte/couvertures/<nom>`

Rend l'image. `404` si elle n'existe pas. Seuls les noms **réellement présents
dans le dossier** peuvent être demandés : impossible de remonter ailleurs sur
le disque.

Si l'autre appli a déjà ses images sur ce PC, elle peut aussi les **copier
directement dans le dossier** `entrees-couvertures/` sans passer par le réseau.
Le serveur les sert dès qu'elles y sont — il relit le dossier à chaque demande.

---

## 4. La forme d'une entrée

```json
{
  "id":         "tintin-lune",
  "titre":      "On a marché sur la Lune",
  "couverture": "tintin.png",
  "at":         1762070400000
}
```

| Champ | Obligatoire | Ce que c'est |
|---|---|---|
| `id` | **oui** | Identifiant stable, propre à l'autre appli. Chaîne non vide. Phonétique le préfixe de `bd:` chez lui (`index.html:19051`), donc `tintin-lune` devient `bd:tintin-lune`. Il doit **ne jamais changer** pour un même livre : c'est lui qui dit « c'est le même ». |
| `titre` | non, mais sans lui la ligne reste sans nom | Le titre affiché. Un titre vide ne remplace pas celui déjà en place. |
| `couverture` | non | Le **nom de fichier** de l'image, pas une URL, pas des données. |
| `at` | fortement conseillé | Millisecondes depuis 1970 (`Date.now()`), au moment où l'autre appli a modifié cette entrée. |
| `efface` | non | `1` pour retirer le livre (voir section 6). |

Tout autre champ est ignoré, sans erreur. Tu peux donc y mettre ce qui t'arrange
pour tes propres besoins.

### À quoi sert `at`, exactement

C'est le seul garde-fou contre l'écrasement. Phonétique garde pour chaque livre
reçu le `at` de la dernière relève appliquée (`bdAt`), et **ignore une entrée
dont le `at` n'a pas monté** (`index.html:19092`).

Conséquence pratique : si tu redéposes dix fois le même catalogue avec le même
`at`, Phonétique ne touche à rien les neuf fois suivantes. Si tu corriges un
titre, **monte le `at`**, sinon la correction ne passera pas.

Sans `at` du tout, chaque relève considère l'entrée comme neuve et réécrit le
titre et la couverture à chaque passage. Ça marche, mais c'est du travail pour
rien.

---

## 5. Qui est propriétaire de quoi

C'est le point le plus important de cette fiche.

| Champ, chez Phonétique | Propriétaire |
|---|---|
| `titre` | **l'autre appli** — un dépôt plus récent le corrige |
| la couverture | **l'autre appli** — changer `couverture` fait retélécharger l'image |
| `mots` (nombre de mots lus) | **toi, à la main** dans Phonétique |
| `d` et `f` (début et fin de lecture) | **toi, à la main** dans Phonétique |

La relève est donc **champ par champ**, jamais un remplacement en bloc
(`index.html:19053-19111`). Un livre qui arrive pour la première fois est créé
avec `mots: 0` et des dates posées sur le **mois courant** — à toi de les
corriger ensuite, en touchant la couverture dans la chronologie.

Tu peux redéposer le même livre autant de fois que tu veux : ton compte de mots
et tes dates ne partiront pas. C'est vérifié par le test
`Ce que tu tapes ne se fait jamais écraser`.

---

## 6. Retirer un livre

Deux façons, et une seule est propre.

**Propre** : laisser l'entrée dans la boîte avec `efface: 1` et un `at` plus
grand.

```json
{ "id": "tintin-lune", "efface": 1, "at": 1762080000000 }
```

Phonétique marque alors le livre effacé chez lui, et il disparaît de la
chronologie. Comme c'est une pierre tombale et non une disparition, la
suppression voyage aussi entre tes appareils par la synchro.

**Pas propre** : retirer simplement la ligne du tableau. Phonétique ne verra
rien passer et gardera le livre indéfiniment, puisque la relève ne conclut
jamais « ce qui a disparu de la boîte doit disparaître chez moi ». C'est
volontaire : une boîte momentanément vide — fichier recréé, appli réinstallée —
ne doit pas effacer ta bibliothèque.

Tu peux garder les pierres tombales pour toujours, ou les retirer de la boîte
une fois que tous tes appareils ont relevé. Dans le doute, garde-les : 2000
entrées sont permises.

---

## 7. Les couvertures, côté Phonétique

À la relève, Phonétique télécharge chaque image manquante, la **réduit à 192 px
de large** et la garde en `data:` dans le navigateur
(`index.html:19115-19128`, `_kdShrinkCover` en `index.html:18645`). C'est le même
chemin que les vignettes de la liseuse.

Donc :

- l'image n'a pas besoin d'être petite au départ, elle sera réduite ;
- une fois relevée, elle s'affiche **même hors réseau** ;
- une image illisible ne fait pas tomber la relève : le titre passe quand même
  et l'image sera retentée au prochain passage ;
- l'image **ne voyage pas** par la synchro entre appareils. Chaque appareil la
  prend dans la boîte lui-même. C'est voulu : un téléphone qui vient de
  télécharger une image ne doit pas devenir « le plus récent » et renvoyer aux
  autres son compte de mots vide.

Format conseillé : la couverture telle que l'autre appli l'a déjà, en JPEG ou
PNG. Inutile de viser une taille précise.

---

## 8. Voir ou cacher les bandes dessinées

Les livres venus de la boîte portent un marqueur `source: 'bd'`. La chronologie
a un bouton qui les montre ou les cache (`index.html:19168`,
`index.html:19282`) :

- il n'apparaît **que s'il y a au moins une bande dessinée** ;
- allumé par défaut ;
- quand il est éteint, les BD disparaissent des vignettes **et** du total de
  mots en haut — le total décrit toujours ce que tu vois ;
- le choix est retenu d'une fois sur l'autre (`settings.kdChronoBd`).

---

## 9. Ce qui casserait la passerelle

**Changer l'`id` d'un livre déjà envoyé.** Phonétique le prendra pour un
nouveau livre : tu auras deux lignes, et le compte de mots que tu avais tapé
restera sur l'ancienne. L'`id` est la seule chose qui ne doit jamais bouger.

**Déposer sans monter le `at`.** La correction ne passera pas, et rien ne le
signalera : la relève est silencieuse par construction.

**Envoyer un catalogue partiel.** `PUT /recolte` remplace tout. Un dépôt qui ne
contient que les nouveautés fait perdre les pierres tombales des anciennes —
sans conséquence immédiate, mais une suppression déjà annoncée peut alors
revenir sur un appareil qui n'avait pas encore relevé.

**Un nom de fichier avec un accent, un espace ou une barre oblique.** Refusé en
dépôt (`400`). Phonétique demandera ensuite une image qui n'existe pas et
laissera la ligne sans vignette, sans se plaindre.

**Mettre l'image dans le champ `couverture`.** Ce champ attend un **nom de
fichier**. Des données `base64` y seraient traitées comme un nom, donc refusées
à la demande suivante.

**Écrire dans `phonetique-donnees.json`.** Ce fichier est à Phonétique. La
boîte, et seulement la boîte, est l'endroit où l'autre appli écrit.

**Oublier de remplacer `phonetique-sync.mjs`.** Avec l'ancien serveur,
`GET /recolte` rend une page `404` au lieu de JSON. Phonétique ne dit rien et
la relève rend zéro : rien n'arrive, et aucun message n'explique pourquoi. Le
signe à chercher : la ligne `entrées …` manque au démarrage du serveur.

**Déposer plus de 2000 entrées.** Refusé en bloc (`400`). La limite est là pour
qu'un bogue dans l'autre appli ne remplisse pas le disque.

---

## 10. Pour vérifier que ça marche

1. Démarrer le serveur. La console doit afficher une ligne `entrées` avec le
   chemin de la boîte.
2. `PUT /recolte` avec une entrée, puis `GET /recolte` : on relit la même
   chose, avec un `_at` ajouté.
3. Poser l'image, soit par `PUT /recolte/couvertures/<nom>`, soit à la main dans
   le dossier. `GET /recolte/couvertures` doit la voir.
4. Dans Phonétique, ouvrir La Récolte, attendre une seconde, ouvrir la
   chronologie : le livre est là, à l'année courante, sans compte de mots.
5. Taper un compte de mots et une date sur ce livre.
6. Redéposer le même catalogue avec un `at` plus grand et un titre corrigé :
   le titre change, le compte de mots et les dates restent.

Les tests automatiques qui couvrent tout ceci sont décrits dans `RECOLTE.md`.
