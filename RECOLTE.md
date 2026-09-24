# La Récolte — tes mots surlignés en lisant

Tu surlignes un mot en lisant. Il arrive dans Phonétique avec **la phrase du
livre** où tu l'as rencontré, prête à devenir le contexte d'une carte.

```
Kindle ──┬── documents/My Clippings.txt      ce que tu as SURLIGNÉ  (intention)
         └── system/vocabulary/vocab.db      ce que tu as CHERCHÉ   (matière)
                      │
                      ▼
             La Récolte  ──►  Mot en Focus  ──►  Le Grenier
```

> Le nom fait pendant au **Grenier** : on récolte en lisant, on engrange
> ensuite. C'est exactement le trajet d'un mot dans l'appli.

## Pourquoi deux fichiers

Chercher un mot est un réflexe : tu le fais des milliers de fois, pour tout et
n'importe quoi — y compris `que`, `autant`, `dessus`. Surligner est un choix.

`My Clippings.txt` porte donc l'**intention**, mais il ne contient que le mot
nu. `vocab.db` porte la **matière** — le lemme, la langue, le livre, et la
phrase exacte du texte — mais sans distinguer ce qui compte.

La Récolte croise les deux. Sur une bibliothèque réelle, 97 % des mots
surlignés en français retrouvent ainsi leur phrase.

> Le croisement rattrape l'élision : tu surlignes « l'objectif », le Kindle a
> rangé « objectif ». Les deux sortes d'apostrophe (`'` et `’`) sont traitées.

## Mettre les fichiers à disposition

Branche la liseuse en USB et copie les deux fichiers dans le dossier de
Phonétique sur le PC, à côté de `index.html` :

| fichier | où le trouver sur la liseuse |
|---|---|
| `My Clippings.txt` | `documents\` |
| `vocab.db` | `system\vocabulary\` — **dossier masqué**, à afficher dans l'Explorateur |

Puis, dans l'appli : **Le Labo › La Récolte › Depuis le serveur**. C'est tout.
À la semaine suivante, tu remplaces les deux fichiers et tu réappuies.

### Le faire en un double-clic

`phonetique-kindle.cmd`, posé **dans le dossier de Phonétique**, fait la copie
tout seul : branche la liseuse, double-clique, ouvre La Récolte.

Il ne contient aucun chemin en dur. Il copie vers **son propre dossier**, donc
tu peux renommer ou déplacer le dossier sans y toucher — et l'accent de
`Phonétique` ne risque pas de casser le script selon l'encodage.

Il **cherche la liseuse** au lieu de supposer `D:` : la lettre change selon ce
qui est branché. Il scanne `D:` à `Z:` en quête de `system\vocabulary\vocab.db`.

Enfin, il **archive l'ancien `vocab.db`** dans `kindle-archives\` avant de
l'écraser, et seulement si son contenu a changé. Comme la liseuse élague, ces
copies datées sont ce qui te rendra un jour des phrases perdues : réimporte-les
par **Fichiers…**, elles s'additionnent.

Le nom exact importe peu : `MyClippings.txt`, `My_Clippings.txt` ou une copie
renommée `vocab-2026.db` sont reconnus. Un sous-dossier `kindle\` marche aussi.
Pour ranger les fichiers ailleurs, pose `PHON_KINDLE` dans le lanceur.

## Les couvertures

Chaque livre s'affiche avec sa couverture, à gauche de son titre.

Elle ne vient pas d'Internet : **la liseuse la garde déjà**, dans
`system\thumbnails\`, nommée d'après l'identifiant du livre —
`thumbnail_B0CB1V3PW7_EBOK_portrait.jpg` pour un livre acheté,
`thumbnail_<guid>_PDOC_portrait.jpg` pour un livre chargé à la main. Et
`vocab.db` porte ce même identifiant pour chaque livre : le rapprochement est
exact, pas une recherche approximative par titre. C'est donc bien la couverture
de ton exemplaire.

`phonetique-kindle.cmd` les copie dans `kindle-couvertures\` (`xcopy /d` : seuls
les nouveaux fichiers passent, les lancements suivants sont rapides). Le serveur
les expose, l'appli prend celles qui lui manquent et s'arrête là.

Une vignette de liseuse pèse ~20 Ko. L'appli la **réduit à la taille affichée**,
soit ~3 Ko, avant de la garder : assez léger pour voyager avec la synchro, donc
le téléphone voit les couvertures **sans avoir les fichiers**.

Seuls les livres visibles dans La Récolte sont habillés — inutile de garder la
couverture d'un livre dont aucun mot n'est surligné.

Un livre sans couverture reçoit une **pastille** portant ses initiales, dans une
couleur tirée de son titre. Elle occupe exactement la même place, pour que la
liste garde son alignement.

Pour ranger les vignettes ailleurs, pose `PHON_COUVERTURES` dans le lanceur.

**Sans serveur** — le bouton **Fichiers…** ouvre un sélecteur ordinaire. Utile
sur le Chromebook, ou quand le PC est éteint.

## Les imports s'additionnent

La liseuse **élague** `vocab.db` : les entrées anciennes finissent par
disparaître. Un import ne remplace donc jamais le précédent, il s'y ajoute.
Garder les vieux exports quelque part et les réimporter un jour rend les
phrases perdues.

## Trier

La Récolte montre d'abord tes **livres**, le plus récemment lu en haut. Tu peux
trier par nombre de mots ou par titre, et ne garder qu'une année.

Dans un livre, deux onglets :

- **Surlignés** — ce que tu as choisi. C'est la vue par défaut.
- **Tous les mots** — tout ce que tu as cherché dans ce livre, phrase comprise.
  Des centaines de mots : à ouvrir quand tu veux miner un livre à fond.

Le bouton à droite de **Tout cocher** renverse l'ordre : d'abord l'ordre de
lecture (les premiers surlignés en haut), puis **les plus récents d'abord**,
pour reprendre là où tu t'es arrêté. Le choix tient jusqu'à la fin de la séance.

Trois gestes :

| geste | effet |
|---|---|
| toucher le mot | l'ouvre dans **Mot en Focus**, sa phrase déjà en place |
| cocher | prépare un envoi groupé |
| **✕** | écarte le mot — il ne reviendra plus |

Le **✕** est ce qui rend l'outil tenable. `My Clippings.txt` ne s'efface
jamais : il grossit. Sans mémoire des refus, chaque import te represente tout,
pour toujours. Avec elle, le deuxième import ne montre que le nouveau.

Rien ne disparaît vraiment : **Afficher les mots traités** remet les mots
écartés et envoyés sous les yeux, avec un **↺** pour les remettre en attente.

## Revenir en arrière

Les trois vues — livres, mots d'un livre, carnet — sont des étapes de
navigation à part entière. Le bouton Retour de l'appli comme le geste d'Android
remontent donc **d'un cran**, et non de l'écran entier : depuis les mots d'un
livre, tu reviens à la liste des livres, pas au Labo.

## Le carnet d'un livre

Toucher **la couverture** ouvre une page propre à ce livre ; toucher le reste
de la ligne mène toujours à ses mots.

En haut, ce que les fichiers du Kindle savent réellement : l'auteur, la langue,
**les dates de ta lecture** (première et dernière rencontre d'un mot), combien
de mots tu as surlignés, cherchés, et combien sont partis au Grenier.

La **date de parution n'est nulle part** dans les fichiers du Kindle. Plutôt que
de la deviner, le champ est à toi : tape-la si tu la veux.

Le reste de la page est une feuille réglée, pour résumer ce que tu as lu.

- Le texte se **replie tout seul** sur la ligne suivante, sans que tu aies à
  faire quoi que ce soit.
- Toucher **n'importe quelle ligne plus bas** y amène le curseur : la page se
  complète du nombre de retours à la ligne qu'il faut, comme sur un vrai carnet.
- L'écriture s'enregistre seule, une demi-seconde après la dernière frappe.

> L'alignement tient à une seule chose : la hauteur de ligne du texte vaut
> exactement la période de la trame de fond (30 px des deux côtés). Changer
> l'une sans l'autre ferait dériver l'écriture ligne après ligne.

Un livre annoté porte une **pastille verte** sur sa couverture dans la liste.

Les notes voyagent avec la synchro. Elles se rédigent sur un appareil à la
fois, donc en cas de conflit **la version modifiée le plus récemment gagne**,
entière — fusionner deux textes ferait plus de dégâts que de bien.

## Envoyer au Grenier

Coche, puis **Envoyer au Grenier**. Le paquet proposé porte le nom du livre
(créé au besoin, avec son dossier miroir dans Le Répertoire) ; tu peux viser un
paquet existant à la place.

Chaque carte reçoit :

- le mot ;
- **la phrase du livre**, en contexte — visible au verso, et reprise par la
  génération de définition et d'image ;
- **le livre d'où il vient**, dont la couverture s'affiche au verso, à gauche
  de la phrase ;
- le titre du livre en étiquette.

La carte ne garde que l'**identifiant** du livre, jamais son image : une
couverture pèse 3 Ko, et cinquante cartes du même livre la porteraient
cinquante fois, dans le stockage comme dans la synchro.

Le chemin compte peu : cocher puis **Envoyer**, ou toucher un mot pour
l'ouvrir dans Mot en Focus et l'envoyer de là — dans les deux cas la carte
garde son livre. La provenance est attachée **au mot**, pas à l'écran : taper
un autre mot dans Mot en Focus avant d'envoyer ne lui colle pas la couverture
du précédent.

Les cartes parties avant cette version retrouvent leur livre toutes seules :
au démarrage, l'appli rapproche mot et phrase de La Récolte. Un mot présent
dans deux livres sans phrase pour trancher reste sans couverture — mieux vaut
rien qu'une fausse.

Les définitions ne sont pas générées en masse : tu les fais carte par carte,
quand tu y viens.

Un mot déjà présent dans le paquet n'est pas dupliqué — il est simplement
marqué comme traité.

### Le verso d'une carte

Le bandeau du haut porte **le mot seul** ; trop long, il est coupé par « … »
avant d'atteindre le bouton **Aa**, dont la place est réservée en permanence —
c'est pour ça qu'il ne bouge pas d'un pixel quand les − et + paraissent.

**Aa** règle la taille de la définition. **Appui long sur Aa** : ce sont la
phrase du livre et sa boîte qu'on règle à la place — le bouton passe au violet
pour le dire. Les deux tailles sont retenues séparément, carte par carte.

## Ce qui se synchronise

Seuls les **mots surlignés** voyagent entre appareils, avec les livres et tes
décisions de tri (écarté / envoyé) : environ 130 Ko. L'archive complète des
mots cherchés reste locale — elle pèse cinq fois plus et se reconstruit en
réimportant les fichiers, qui vivent sur le PC.

Écarter un mot sur le téléphone l'écarte donc partout.

## Si ça ne marche pas

| symptôme | cause probable |
|---|---|
| « Aucun fichier Kindle dans le dossier du serveur » | les fichiers ne sont pas à côté de `index.html`, ou `vocab.db` est resté dans le dossier masqué de la liseuse |
| « Déjà à jour » alors que tu viens de copier | Windows a gardé la date de l'ancien fichier : recopie-le, ou passe par **Fichiers…** |
| Des mots sans phrase | `vocab.db` a été élagué depuis : réimporte un export plus ancien si tu en as gardé un |
| Un livre anglais dans la liste | normal s'il porte des surlignements ; le filtre par année l'écarte |
| Rien ne se passe au bouton « Depuis le serveur » | l'appli n'est pas ouverte depuis le serveur — vois Paramètres › Synchro |
| Une pastille au lieu d'une couverture | le bouton **Depuis le serveur** le dit : serveur à relancer, dossier vide, ou livre sans identifiant |
| « Serveur à relancer » | `phonetique-sync.mjs` a été remplacé mais le serveur tourne encore sur l'ancien code — ferme la fenêtre et relance le lanceur |

## Ce que La Récolte ne fait pas

Il ne lit pas les **notes** ni les **signets**, ni les passages de plus de
trois mots : ce sont des repères de lecture, pas du vocabulaire.

Il ne devine pas non plus ce qui mérite une carte. Les mots que tu as cherchés
plusieurs fois sont surtout des mots **ambigus** (`que`, `faut`, `dessus`), pas
des mots difficiles — un classement automatique par ce critère trierait mal.
Le surlignement, lui, dit ce que tu veux vraiment. C'est toi qui tries.
