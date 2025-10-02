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
            // Crée une date pour aujourd'hui avec l'heure spécifiée
            const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes, 0, 0);
            return date;
        }

        let tideHigh = parseTideTime(tideHighRaw);
        let tideLow = parseTideTime(tideLowRaw);

        // Durée exacte d'un demi-cycle lunaire (6h 12m 30s) en millisecondes
        const HALF_TIDAL_CYCLE_MS = (6 * 60 * 60 * 1000) + (12.5 * 60 * 1000); 
        const FULL_TIDAL_CYCLE_MS = HALF_TIDAL_CYCLE_MS * 2;
        
        // --- 1. Positionnement des marées autour de l'heure actuelle ---
        
        // 1a. Normaliser tideHigh: trouver la marée haute la plus proche de l'heure actuelle
        let currentHigh = new Date(tideHigh.getTime());
        // Ajuster l'heure de la MH pour qu'elle soit dans la fenêtre de +/- 6h 12m 30s de l'heure actuelle
        while (currentHigh.getTime() - now.getTime() > HALF_TIDAL_CYCLE_MS) {
            currentHigh.setTime(currentHigh.getTime() - FULL_TIDAL_CYCLE_MS);
        }
        while (currentHigh.getTime() - now.getTime() < -HALF_TIDAL_CYCLE_MS) {
            currentHigh.setTime(currentHigh.getTime() + FULL_TIDAL_CYCLE_MS);
        }

        // 1b. Normaliser tideLow: trouver la marée basse la plus proche de l'heure actuelle
        let currentLow = new Date(tideLow.getTime());
        // Ajuster l'heure de la MB pour qu'elle soit dans la fenêtre de +/- 6h 12m 30s de l'heure actuelle
        while (currentLow.getTime() - now.getTime() > HALF_TIDAL_CYCLE_MS) {
            currentLow.setTime(currentLow.getTime() - FULL_TIDAL_CYCLE_MS);
        }
        while (currentLow.getTime() - now.getTime() < -HALF_TIDAL_CYCLE_MS) {
            currentLow.setTime(currentLow.getTime() + FULL_TIDAL_CYCLE_MS);
        }

        // --- 2. Détermination du cycle précédent et suivant ---
        
        let nextTide;
        let prevTide;
        let isNextTideHigh;

        // Toutes les marées futures proches
        const futureTides = [currentHigh, currentLow].filter(t => t.getTime() > now.getTime());
        
        if (futureTides.length === 0) {
            // Toutes les marées sont passées (ex: 23:59 après une marée de 23:30)
            const lastTide = currentHigh.getTime() > currentLow.getTime() ? currentHigh : currentLow;
            
            // Déterminer le type de la prochaine marée: si la dernière était Basse, la prochaine est Haute (et vice-versa)
            const wasLastTideHigh = (lastTide.getTime() === currentHigh.getTime());
            isNextTideHigh = !wasLastTideHigh;

            nextTide = new Date(lastTide.getTime() + HALF_TIDAL_CYCLE_MS);
            prevTide = lastTide;
            
        } else {
            // Trouver la prochaine marée dans le futur
            nextTide = futureTides.reduce((a, b) => (a.getTime() < b.getTime() ? a : b));
            // isNextTideHigh est VRAI si la prochaine marée trouvée correspond à l'heure de la Marée Haute
            isNextTideHigh = (nextTide.getTime() === currentHigh.getTime());
            
            // La marée précédente est nextTide moins un demi-cycle
            prevTide = new Date(nextTide.getTime() - HALF_TIDAL_CYCLE_MS);
        }

        // --- 3. Calcul de la progression de l'aiguille ---
        
        const totalDuration = HALF_TIDAL_CYCLE_MS;
        const elapsed = now.getTime() - prevTide.getTime();
        
        let progress = elapsed / totalDuration;
        
        // Sécurité pour s'assurer que progress est entre 0 et 1
        if (progress < 0 || progress > 1) {
            progress = ((elapsed % totalDuration) + totalDuration) % totalDuration;
            progress = progress / totalDuration;
        }
        
        // La position 12h correspond à l'angle -Math.PI / 2
        // La position 6h correspond à l'angle Math.PI / 2

        let angle;

        if (isNextTideHigh) {
            // Cycle: Basse (prevTide) -> Haute (nextTide)
            // Aiguille va de 6h (Math.PI / 2) à 12h (-Math.PI / 2)
            // L'angle diminue au fur et à mesure que le temps s'écoule.
            angle = (Math.PI / 2) - (progress * Math.PI); 

        } else {
            // Cycle: Haute (prevTide) -> Basse (nextTide)
            // Aiguille va de 12h (-Math.PI / 2) à 6h (Math.PI / 2)
            // L'angle augmente au fur et à mesure que le temps s'écoule.
            angle = (-Math.PI / 2) + (progress * Math.PI);
        }


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
        const hauteYBox = centerY - radius + 5; 
        ctx.fillStyle = '#FFFFFF'; // Fond blanc
        ctx.fillRect(centerX - boxWidth / 2, hauteYBox, boxWidth, boxHeight);
        ctx.font = fontHour;
        ctx.fillStyle = textColor;
        // Texte heure centré dans la boîte
        ctx.fillText(tideHighRaw, centerX, hauteYBox + 13);

        // --- 7b. Marée Basse (Heure EN-DESSOUS du texte) ---
        // Boîte placée SOUS le texte "MARÉE BASSE"
        const basseYBox = basseYText + 5; 
        
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
