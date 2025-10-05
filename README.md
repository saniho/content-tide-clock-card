# 🌊 Tide Clock Card

Une carte Home Assistant personnalisée qui affiche une horloge des marées avec une interface visuelle élégante inspirée des horloges de marée traditionnelles.

![Tide Clock Card](./images/tide-clock-preview.png)
*Exemple d'affichage de l'horloge des marées*

## ✨ Fonctionnalités

- 🕐 **Affichage visuel** : Horloge analogique avec aiguille indiquant la progression de la marée
- 🌊 **Indication de tendance** : Affiche si la marée est montante ou descendante
- 📊 **Coefficient** : Affiche automatiquement le coefficient de la prochaine marée
- 🎨 **Deux thèmes** : 
  - **Classic** : Design bleu marine avec accents dorés
  - **Light** : Design épuré avec fond blanc
- ⚙️ **Configuration visuelle** : Interface de configuration intuitive dans l'éditeur Home Assistant
- 📱 **Responsive** : S'adapte parfaitement à tous les écrans

## 📋 Prérequis

Cette carte nécessite l'intégration **API Marée Info** pour récupérer les données de marées :

👉 [saniho/apiMareeInfo](https://github.com/saniho/apiMareeInfo)

Cette intégration créera automatiquement les sensors nécessaires :
- `sensor.maree_haute` : Heure de la prochaine marée haute (avec attribut `coeff`)
- `sensor.maree_basse` : Heure de la prochaine marée basse

## 📦 Installation

### Via HACS (recommandé)

1. Ouvrez HACS dans Home Assistant
2. Allez dans "Frontend"
3. Cliquez sur le menu "⋮" en haut à droite
4. Sélectionnez "Dépôts personnalisés"
5. Ajoutez l'URL de ce dépôt
6. Cliquez sur "Télécharger"
7. Redémarrez Home Assistant

### Installation manuelle

1. Téléchargez le fichier `tide-clock-card.js`
2. Copiez-le dans le dossier `config/www/` de votre Home Assistant
3. Ajoutez la ressource dans votre configuration :
   - Allez dans **Configuration** → **Lovelace Dashboards** → **Ressources**
   - Cliquez sur **Ajouter une ressource**
   - URL : `/local/tide-clock-card.js`
   - Type : **Module JavaScript**
4. Redémarrez Home Assistant

## 🔧 Configuration

### Configuration via l'interface visuelle

1. En mode édition du dashboard, cliquez sur **+ Ajouter une carte**
2. Recherchez **Tide Clock Card**
3. Configurez les options :
   - **Thème** : Choisissez entre Classic ou Light
   - **Entité marée haute** : Sélectionnez votre sensor de marée haute
   - **Entité marée basse** : Sélectionnez votre sensor de marée basse

### Configuration YAML

```yaml
type: custom:tide-clock-card
tide_high: sensor.maree_haute
tide_low: sensor.maree_basse
theme: classic  # ou 'light'
```

## 📊 Format des données

Les entités doivent retourner :
- **État (state)** : Heure au format `HH:MM` (ex: `14:32`)
- **Attribut `coeff`** : Coefficient de marée (nombre entier, ex: `95`)

Exemple d'état d'entité :
```yaml
state: "14:32"
attributes:
  coeff: 95
```

## 🎨 Thèmes disponibles

### Classic (par défaut)
- Fond : Gris (#e0e0e0)
- Cadran : Bleu marine (#1A237E)
- Bordure : Beige/Sable (#C8A878)
- Aiguille : Dorée (#E0B55E)
- Accent : Or (#FFD700)

### Light
- Fond : Blanc (#FFFFFF)
- Cadran : Blanc avec bordure grise
- Éléments : Gris foncé (#333333)
- Aiguille : Bleu (#0066CC)
- Accent : Bleu (#0066CC)

## 🔍 Comment ça marche ?

L'horloge affiche un cycle complet de marée (environ 6h12min) :
- **Côté gauche** : Progression de la marée montante (de 6h à 0h)
- **Côté droit** : Progression de la marée descendante (de 6h à 0h)
- **Aiguille** : Indique le temps restant jusqu'à la prochaine marée
- **Centre** : Affiche la tendance (Montante/Descendante)
- **Coefficient** : Affiché sous "MARÉE HAUTE"

## 🐛 Dépannage

### La carte ne s'affiche pas
- Vérifiez que la ressource est bien chargée dans **Configuration** → **Lovelace Dashboards** → **Ressources**
- Videz le cache de votre navigateur (Ctrl+Shift+R ou Cmd+Shift+R)
- Vérifiez les logs de Home Assistant pour d'éventuelles erreurs

### Le coefficient ne s'affiche pas
- Vérifiez que votre sensor de marée haute possède bien un attribut `coeff`
- Utilisez **Outils de développement** → **États** pour inspecter votre entité

### Les horaires ne sont pas corrects
- Assurez-vous que vos sensors retournent bien des heures au format `HH:MM`
- Vérifiez la configuration de l'intégration API Marée Info

## 🤝 Contribuer

Les contributions sont les bienvenues ! N'hésitez pas à :
- Signaler des bugs via les [Issues](../../issues)
- Proposer des améliorations
- Soumettre des Pull Requests

## 📝 Licence

Ce projet est sous licence MIT - voir le fichier LICENSE pour plus de détails.

## 🙏 Remerciements

- [saniho/apiMareeInfo](https://github.com/saniho/apiMareeInfo) pour l'intégration des données de marées
- La communauté Home Assistant pour son support

---

**Note** : Cette carte nécessite Home Assistant 2021.3.0 ou supérieur.
