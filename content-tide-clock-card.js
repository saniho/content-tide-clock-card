class TideClockCard extends HTMLElement {
    setConfig(config) {
        this.config = config;
        // La carte doit avoir un fond sombre pour faire ressortir le cadran.
        this.innerHTML = `
            <ha-card style="background: #e0e0e0; padding: 20px;">
                <canvas id="tideClock" width="300" height="300"></canvas>
            </ha-card>
            <style>
                canvas { display: block; margin: auto; }
            </style>
        `;
    }

    set hass(hass) {
        const tideHighRaw = hass.states[this.config.tide_high]?.state ?? null;
        const tideLowRaw = hass.states[this.config.tide_low]?.state ?? null;
        const now = new Date();

        if (!tideHighRaw || !tideLowRaw) {
            this.innerHTML = `<ha-card><div style="padding:1em;">Entités marée non disponibles</div></ha-card>`;
            return;
        }

        // --- Logique de calcul des marées ---
        function parseTideTime(timeStr, baseDate = now) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes, 0, 0);
            return date;
        }

        let tideHigh = parseTideTime(tideHighRaw);
        let tideLow = parseTideTime(tideLowRaw);

        // Assurer que les marées sont dans le futur
        if (tideHigh < now) {
            tideHigh.setDate(tideHigh.getDate() + 1);
        }
        if (tideLow < now) {
            tideLow.setDate(tideLow.getDate() + 1);
        }

        // Déterminer le cycle actuel
        const nextTide = tideHigh < tideLow ? tideHigh : tide low;
        const prevTide = tideHigh < tideLow ? tideLow : tideHigh;
        prevTide.setDate(prevTide.getDate() - 1);

        const totalDuration = nextTide.getTime() - prevTide.getTime();
        const elapsed = now.getTime() - prevTide.getTime();
        const progress = elapsed / totalDuration;
        const angle = (progress * 2 * Math.PI) - Math.PI / 2;

        const canvas = this.querySelector('#tideClock');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const centerX = 150, centerY = 150;
        const radius = 140; // Rayon du cadran intérieur
        const outerRadius = 150; // Rayon du cadre extérieur

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // --- 1. Cadre Simulé (Bois/Clair) ---
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
        ctx.fillStyle = '#C8A878'; // Couleur bois clair
        ctx.fill();

        // Ajout d'une ombre pour simuler la profondeur
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        ctx.fill(); 
        ctx.restore(); // Réinitialise les ombres pour le dessin intérieur

        // --- 2. Cadran Intérieur (Bleu Nuit) ---
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#1A237E'; // Bleu Nuit
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF'; // Bordure blanche fine
        ctx.lineWidth = 1;
        ctx.stroke();

        // --- 3. Points et Chiffres (Symétrie 5 à 1) ---
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        
        // Points et chiffres sur le cadran
        const markerRadius = radius - 15;
        for (let i = 0; i < 12; i++) {
            const currentAngle = (i * Math.PI / 6) - Math.PI / 2; // Angle en radians (commence à 12h)
            
            let label = '';
            // Côté droit (de 1h à 5h) : 5, 4, 3, 2, 1 (i=1 -> 5, i=5 -> 1)
            if (i >= 1 && i <= 5) label = (6 - i).toString();
            // Côté gauche (de 7h à 11h) : 5, 4, 3, 2, 1 (i=7 -> 5, i=11 -> 1)
            if (i >= 7 && i <= 11) label = (12 - i).toString();
            
            if (label) {
                const x = centerX + markerRadius * Math.cos(currentAngle);
                const y = centerY + markerRadius * Math.sin(currentAngle);
                ctx.fillText(label, x, y + 5);
            }
        }

        // --- 4. Texte de Marée (Haut et Bas) - Police réduite à 12px ---
        ctx.font = 'bold 12px sans-serif'; // Police réduite
        ctx.fillStyle = '#FFFFFF';
        
        // --- 4a. Marée Haute (Haut, position 12h) ---
        const hauteYText = centerY - radius + 40;
        ctx.fillText("MARÉE HAUTE", centerX, hauteYText);
        
        // --- 4b. Marée Basse (Bas, position 6h) - Texte centré ---
        // Position X du texte Marée Basse (symétrique à la Marée Haute)
        const basseYText = centerY + radius - 40; // Symétrique à hauteYText
        ctx.fillText("MARÉE BASSE", centerX, basseYText); 

        // --- 5. Titre Central ---
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText("HORAIRES DES MARÉES", centerX, centerY + 10);
        
        // --- 6. Aiguille ---
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + 110 * Math.cos(angle), centerY + 110 * Math.sin(angle));
        ctx.strokeStyle = '#E0B55E'; // Couleur Or/Jaune clair
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Cercle central de l'aiguille
        ctx.beginPath();
        ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#E0B55E';
        ctx.fill();
        
        // Petit cercle intérieur (blanc)
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        // --- 7. Affichage des heures dans le cadran (petits rectangles blancs SANS bordure) ---
        
        // Paramètres des boîtes
        const boxWidth = 50;
        const boxHeight = 20;
        const fontHour = 'bold 12px sans-serif';
        const textColor = '#000000'; // Noir pour le contraste

        // --- 7a. Marée Haute (Heure AU-DESSUS du texte) ---
        const hauteYBox = centerY - radius + 5; // Boîte (position Y inchangée : très haut)
        ctx.fillStyle = '#FFFFFF'; // Fond blanc
        ctx.fillRect(centerX - boxWidth / 2, hauteYBox, boxWidth, boxHeight);
        ctx.font = fontHour;
        ctx.fillStyle = textColor;
        // Texte heure centré dans la boîte
        ctx.fillText(tideHighRaw, centerX, hauteYBox + 13);

        // --- 7b. Marée Basse (Heure EN-DESSOUS du texte) ---
        // Boîte placée SOUS le texte "MARÉE BASSE", en utilisant la même logique d'espacement que pour la Marée Haute.
        const basseYBox = basseYText + 5; // 5 pixels sous le texte basseYText (pour que la boîte commence juste après)
        
        ctx.fillStyle = '#FFFFFF'; // Fond blanc
        ctx.fillRect(centerX - boxWidth / 2, basseYBox, boxWidth, boxHeight); 
        ctx.font = fontHour;
        ctx.fillStyle = textColor;
        // Texte heure centré dans la boîte
        ctx.fillText(tideLowRaw, centerX, basseYBox + 13);
    }

    getCardSize() {
        return 5;
    }
}

customElements.define('tide-clock-card', TideClockCard);
