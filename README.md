# Générateur de Code QR

Application React moderne pour générer des codes QR facilement. Supporte les URLs, le texte libre et les cartes de contact vCard.

![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.3-06B6D4?logo=tailwindcss)
![License](https://img.shields.io/badge/License-MIT-green)

## 🚀 Fonctionnalités

- **3 modes de génération** :
  - 🔗 **URL** : Génère un QR pour liens web (ajout automatique de https://)
  - 📝 **Texte** : Génère un QR pour du texte libre
  - 👤 **Contact** : Génère un QR vCard avec informations de contact complètes

- **Actions disponibles** :
  - 📥 Téléchargement en PNG
  - 📋 Copie des données dans le presse-papier
  - 🗑️ Effacement du formulaire

- **Caractéristiques techniques** :
  - Génération QR en temps réel avec [QRious](https://github.com/neocotic/qrious)
  - Fallback automatique vers l'API qrserver.com si QRious échoue
  - Interface 100% en français
  - Design responsive et moderne
  - Aucun backend requis

## 📦 Installation

```bash
# Cloner le dépôt
git clone <url-du-repo>
cd generateur-qr

# Installer les dépendances
npm install

# Lancer en développement
npm start
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000)

## 🏗️ Build pour production

```bash
npm run build
```

Les fichiers de production seront générés dans le dossier `build/`.

## 🚀 Déploiement sur AWS Amplify

### Option 1 : Déploiement via GitHub

1. Pousser le code sur GitHub
2. Connecter le dépôt à AWS Amplify Console
3. Amplify détectera automatiquement la configuration via `amplify.yml`
4. Le déploiement se fera automatiquement à chaque push

### Option 2 : Déploiement manuel

```bash
# Installer Amplify CLI
npm install -g @aws-amplify/cli

# Configurer Amplify
amplify configure

# Initialiser le projet
amplify init

# Déployer
amplify publish
```

## 🛠️ Stack technique

- **React 18** - Bibliothèque UI
- **Tailwind CSS 3** - Framework CSS utilitaire
- **Lucide React** - Icônes modernes
- **QRious** - Génération de codes QR (via CDN)

## 📁 Structure du projet

```
generateur-qr/
├── public/
│   └── index.html          # HTML principal avec CDN QRious
├── src/
│   ├── App.js              # Composant principal
│   ├── index.js            # Point d'entrée React
│   └── index.css           # Styles Tailwind + custom
├── package.json            # Dépendances npm
├── tailwind.config.js      # Configuration Tailwind
├── postcss.config.js       # Configuration PostCSS
├── amplify.yml             # Configuration AWS Amplify
└── README.md               # Documentation
```

## 🎨 Personnalisation

### Couleurs

Les couleurs principales sont définies dans `tailwind.config.js` :

```javascript
colors: {
  primary: { /* violet */ },
  accent: { /* bleu */ }
}
```

### Styles des composants

Les classes utilitaires personnalisées sont dans `src/index.css` :
- `.input-field` - Champs de saisie
- `.btn-primary` / `.btn-secondary` / `.btn-outline` - Boutons
- `.card` - Cartes avec effet glass
- `.tab-button` - Onglets de navigation

## 📱 Format vCard

Le format vCard généré suit la spécification VERSION:3.0 :

```
BEGIN:VCARD
VERSION:3.0
N:Nom;Prénom;;;
FN:Prénom Nom
TEL;TYPE=CELL:+1234567890
EMAIL:email@exemple.com
ORG:Organisation
URL:https://site.com
END:VCARD
```

## 🔒 Confidentialité

- Toutes les données sont traitées localement dans le navigateur
- Aucune information n'est envoyée à des serveurs externes (sauf fallback API)
- Aucun cookie ou tracking

## 📄 Licence

MIT License - Libre d'utilisation et de modification.

---

Fait avec ❤️ au Québec 🍁

