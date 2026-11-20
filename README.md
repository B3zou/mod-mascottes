# mod-mascottes

Un mod pour Claude Code qui affiche deux mascottes en pixel art dans un pane, dessinées en direct dans le terminal (pas de sprite sheets) :

- **La sorcière** représente le **contexte** de la session. À 0 %, elle est debout. Plus le contexte se remplit, plus elle porte de grimoires au-dessus de la tête (de 0 à 14), son chapeau s'écrase, elle transpire, plie les genoux puis panique. À 100 %, elle est écrasée au sol.
- **Le chat noir** représente l'**usage restant sur la fenêtre de 5 heures**. Il est assis au sommet d'une tour de 100 pièces, une pièce par pourcent restant. À chaque baisse d'1 %, il lance une pièce d'un coup de patte. À 0 %, il dort en boule au sol.

## Installation

Dans une session Claude Code, dans un terminal :

```
/plugin install mod-mascottes --marketplace B3zou/mod-mascottes
```

Claude Code demande d'abord d'ajouter le dépôt comme marketplace (réponds `y`), puis de choisir la portée (Entrée pour la portée utilisateur), puis propose les réglages du mod. Le mod est actif tout de suite, sans redémarrage, et dans les sessions suivantes.

Depuis un shell :

```
claude plugin install mod-mascottes --marketplace B3zou/mod-mascottes
```

Dans l'application Desktop, `/plugin` ne s'exécute pas : clique sur **+** à côté de la zone de saisie, puis **Plugins**, **Add marketplace** avec `B3zou/mod-mascottes`, puis **Add plugin**. Le pane n'y affiche que deux lignes de texte, car les mascottes demandent un terminal.

## Commandes

| Commande | Effet |
|---|---|
| `/mascottes` | Ouvre le pane des mascottes (il s'ouvre aussi tout seul au démarrage d'une session). |
| `/mascottes-demo` | Lance une démo qui rejoue tout le cycle avec de fausses valeurs, ou l'arrête si elle tourne. |
| `/mascottes-demo 3` | Lance la démo 3 fois plus vite (vitesse de 0,5 à 20). |
| `/mascottes-demo stop` | Arrête la démo et remet les vraies valeurs. |

La démo ne fait aucun appel au modèle : elle ne consomme ni contexte ni quota. À vitesse 1, un cycle dure 96 secondes : le contexte monte de 0 à 100 %, l'usage restant descend de 100 à 0 % (une pièce toutes les 0,9 s, le temps d'un lancer), puis une pause de 6 secondes avec le chat endormi, et ça repart. À vitesse élevée, certains lancers sont sautés pour rattraper la valeur.

## Réglages

Ouvre `/config` et cherche le mod :

| Réglage | Valeurs | Effet |
|---|---|---|
| `size` | `full` (défaut), `half` | `full` : chaque mascotte fait 40 x 33 cellules (tous les détails). `half` : 20 x 17 cellules, pour un pane étroit. |

## Ce qu'il faut savoir

- **Terminal.** Les mascottes sont dessinées avec des demi-blocs (`▀`) colorés, ce qui marche dans les terminaux en couleurs 24 bits. Testé dans Windows Terminal. Avec `size: full`, les deux mascottes côte à côte demandent environ 82 colonnes de large et 35 lignes de haut. Si le pane est plus étroit, le chat passe sous la sorcière.
- **Source des données.** Le contexte vient de la mesure de la session. L'usage restant est `100 moins le pourcentage utilisé` de la fenêtre `five_hour` rapportée par Claude Code. Cette fenêtre n'existe que sur un abonnement : sans abonnement, le chat reste à 100 %.
- **Pourcentages entiers.** Le contexte arrive en pourcentage entier, donc la sorcière change au mieux tous les 1 %. Son nombre de grimoires suit une interpolation continue (un de plus environ tous les 7 %), alors que sa pose et son visage changent par paliers de 10 %.
- **Lancers.** Si l'usage restant tombe de plusieurs pourcents d'un coup, le chat ne rejoue que 3 lancers puis rattrape la valeur. Si la fenêtre se renouvelle, le tas se remplit d'un coup.

## Développement

Les sprites sont portés de scripts Python qui dessinent pixel par pixel : rectangles de couleur, contour automatique, éclairage de bord, puis détails du visage posés après le contour.

- `hooks/pixels.ts` : moteur de pixels (canevas, contour, conversion en demi-blocs, réduction 2x2).
- `hooks/witch.ts` : la sorcière (40 x 66 px, 11 paliers x 6 frames, interpolation continue).
- `hooks/cat.ts` : le chat et sa tour de pièces (40 x 66 px, idle de 6 frames, lancer de 8 frames).
- `hooks/catmachine.ts` : la machine à états du chat (idle, lancer, rattrapage).
- `hooks/register.tsx` : le pane, la minuterie d'animation, les commandes et la lecture des mesures.
- `test/mascottes.test.ts` : les tests.

Lancer la validation et les tests depuis le dossier du mod :

```
claude plugin validate .
claude plugin test .
```

Pour essayer le mod sans l'installer : `claude --plugin-dir <dossier du mod>`.

## Licence

Pas encore définie.
