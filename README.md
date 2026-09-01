# Game Sites - Aperçu Screenshots

Extension pour navigateur permettant d'afficher directement les captures d'écran, vidéos/trailers, configurations requises, comparateur PC, taille des jeux et liens de téléchargement sur divers sites (SkidrowReloaded, IGG-Games, PCGamesTorrents) avec synchronisation Steam.

> [!NOTE]
> **Compatibilité des sites :** L'extension est principalement conçue et optimisée pour **Skidrow / SkidrowReloaded**. Bien que le support pour **IGG-Games** et **PCGamesTorrents** soit présent, il est possible que certaines fonctionnalités ne soient pas totalement disponibles ou fonctionnelles sur ces deux sites.

---

## 📥 Téléchargement

- ⚡ **[Télécharger directement l'extension (.ZIP)](https://github.com/Traycken/Crack-Game-Screenshots/archive/refs/heads/main.zip)** *(téléchargement direct instantané)*
- 📦 **[Voir la dernière version sur GitHub (Releases)](https://github.com/Traycken/Crack-Game-Screenshots/releases/latest)**

---

## 🚀 Installation manuelle sur Google Chrome

Suivez ces étapes pour installer l'extension en mode développeur sur Google Chrome (compatible également avec Brave, Edge, Opera, Vivaldi, etc.) :

### 1. Télécharger et extraire l'extension
1. Cliquez sur ce lien pour **[télécharger directement l'archive ZIP](https://github.com/Traycken/Crack-Game-Screenshots/archive/refs/heads/main.zip)** (ou rendez-vous sur le [dépôt GitHub](https://github.com/Traycken/Crack-Game-Screenshots)).
2. Décompressez l'archive ZIP dans un dossier permanent sur votre ordinateur (par exemple dans vos documents ou votre dossier de scripts).  
   > ⚠️ **Important :** Ne supprimez pas ce dossier après l'installation, Chrome en a besoin pour faire fonctionner l'extension.

---

### 2. Activer le mode développeur dans Chrome
1. Ouvrez Google Chrome.
2. Dans la barre d'adresse, tapez :
   ```text
   chrome://extensions/
   ```
   *(ou allez dans le menu `⋮` en haut à droite > **Extensions** > **Gérer les extensions**).*
3. En haut à droite de la page, activez l'interrupteur **Mode développeur**.

---

### 3. Charger l'extension
1. Cliquez sur le bouton **Charger l'extension non empaquetée** (*Load unpacked*) apparu en haut à gauche.
2. Dans la fenêtre de sélection de dossier, choisissez le dossier décompressé contenant le fichier `manifest.json`.
3. Validez : l'extension **Game Sites - Aperçu Screenshots** apparaît désormais dans votre liste d'extensions et est prête à l'emploi !

---

## 🔄 Mise à jour de l'extension

Pour mettre à jour l'extension manuellement lorsqu'une nouvelle version est disponible :
1. Téléchargez la dernière version depuis [GitHub](https://github.com/Traycken/Crack-Game-Screenshots).
2. Remplacez les anciens fichiers du dossier par les nouveaux.
3. Retournez sur `chrome://extensions/` et cliquez sur l'icône de **rafraîchissement** (🔄) sur la carte de l'extension.

---

## 🌟 Fonctionnalités

- 📸 **Captures d'écran & Vidéos** : Aperçu direct des galeries d'images et bandes-annonces/trailers (YouTube/Steam/HLS) sous chaque carte de jeu.
- ♾️ **Défilement infini (*Infinite Scroll*)** : Chargement automatique des jeux suivants en faisant défiler la page, avec séparateurs visuels élégants (*Page 2*, *Page 3*, etc.).
- 🧭 **Navigation dynamique (SPA)** : Changement de page instantané et recherche en tâche de fond sans rechargement de la fenêtre du navigateur.
- 🔢 **Saut direct de page (Input INT)** : Accès direct à n'importe quelle page en tapant manuellement son numéro dans la barre de pagination.
- 🔍 **Barre de recherche optimisée** : Recherche fluide avec historique des termes et bouton d'effacement rapide (croix ✕).
- 💾 **Gestion Intelligente du Cache API (L1/L2)** :
  - Mise en cache persistante des fiches Steam, requêtes de recherche et pages scrapées pour réduire de 90% à 95% les requêtes HTTP.
  - Algorithme d'éviction intelligent **LRU / LFU** : suppression automatique des éléments les plus anciens et les moins utilisés lorsque la taille limite est atteinte.
  - Réglage de la limite de taille (5 Mo à 200 Mo), de la durée de validité (TTL) et bouton de purge complète dans le panneau de paramètres (`⚙️`).
- 🛡️ **Optimisation de la RAM & GPU (Scroll Virtualizer)** :
  - Déchargement automatique de la mémoire vive des captures et vidéos des cartes situées loin hors de l'écran lors du défilement.
  - **Zéro décalage de mise en page (*Cumulative Layout Shift = 0*)** : les dimensions de chaque élément sont strictement préservées.
  - Réhydratation anticipée et transparente dès que vous remontez vers une carte précédente.
- ⚡ **Classement & Évaluation des Liens de Téléchargement** :
  - Analyse et double notation de chaque hébergeur (Sécurité / Anti-pub et Débit gratuit non-abonné) avec badges de niveau (*Tier S, A, B, C, D*).
  - Tri automatique des meilleurs hébergeurs en tête de liste et gestion des hébergeurs favoris (⭐).
- ⚙️ **Configurations requises & Comparateur PC** : Vérification immédiate de la compatibilité de votre matériel avec les spécifications minimales et recommandées.
- 🎮 **Synchronisation Steam** : Badges dynamiques indiquant si le jeu est possédé ou présent dans votre liste de souhaits Steam, avis des joueurs, prix et modes de jeu.
- 🌐 **Activation / Désactivation par site** : Interrupteur dédié dans le popup pour désactiver ou réactiver l'extension à la volée sur n'importe quel site pris en charge (SkidrowReloaded, IGG-Games, PCGamesTorrents).
- 🎛️ **Personnalisation complète** : Réglage du nombre de colonnes, de lignes, du nombre maximal de captures, de la largeur d'affichage et de l'échelle des textes via le popup.
