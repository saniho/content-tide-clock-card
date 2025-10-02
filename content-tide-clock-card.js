class TideClockCard extends HTMLElement {
    
    /**
     * Parse l'heure HH:MM en un objet Date pour la journée actuelle/spécifiée.
     * Définie à l'extérieur de set hass pour éviter l'erreur de pile d'appels.
     */
    parseTideTime(timeStr, baseDate) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes, 0, 0);
        return date;
    }

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
        // Définition des variables principales
        const tideHighRaw = hass.states[this.config.tide_high]?.state ?? null;
        const tideLowRaw = hass.states[this.config.tide_low]?.state ?? null;
        const now = new Date(); // Heure actuelle

        if (!tideHighRaw || !tideLowRaw) {
            this.innerHTML = `<ha-card><div style="padding:1em; color: black; text-align: center;">Erreur: Entités marée non disponibles.</div></ha-card>`;
            return;
        }

        // --- Logique de calcul des marées ---
        
        // Durée exacte d'un demi-cycle lunaire (6h 12m 30s) en millisecondes
        const HALF_TIDAL_CYCLE_MS = (6 * 60 * 60 * 1000) + (12.5 * 60 * 1000); 
        const FULL_TIDAL_CYCLE_MS = HALF_TIDAL_CYCLE_MS * 2;
        
        let tideHigh = this.parseTideTime(tideHighRaw, now);
        let tideLow = this.parseTideTime(tideLowRaw, now);


        // --- 1. Positionnement des marées autour de l'heure actuelle (Normalisation) ---
        
        // 1a. Normaliser tideHigh: trouver la marée haute la plus proche de l'heure actuelle
        let currentHigh = new Date(tideHigh.getTime());
        while (currentHigh.getTime() - now.getTime() > HALF_TIDAL_CYCLE_MS) {
            currentHigh.setTime(currentHigh.getTime() - FULL_TIDAL_CYCLE_MS);
        }
        while (currentHigh.getTime() - now.getTime() < -HALF_TIDAL_CYCLE_MS) {
            currentHigh.setTime(currentHigh.getTime() + FULL_TIDAL_CYCLE_MS);
        }

        // 1b. Normaliser tideLow: trouver la marée basse la plus proche de l'heure actuelle
        let currentLow = new Date(tideLow.getTime());
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

        // Trouver la marée la plus récente qui est PASSÉE
        const pastTides = [currentHigh, currentLow].filter(t => t.getTime() <= now.getTime());
        
        if (pastTides.length === 0) {
            // Si aucune marée n'est passée (très peu probable si les marées sont normalisées), prenons la plus éloignée dans le futur et reculons.
            const futureTide = [currentHigh, currentLow].reduce((a, b) => (a.getTime() < b.getTime() ? a : b));
            nextTide = futureTide;
            prevTide = new Date(futureTide.getTime() - HALF_TIDAL_CYCLE_MS);
            isNextTideHigh = (nextTide.getTime() === currentHigh.getTime());
            
        } else {
            // La marée précédente est la plus récente dans le passé
            prevTide = pastTides.reduce((a, b) => (a.getTime() > b.getTime() ? a : b));
            
            // La marée suivante est un demi-cycle après la précédente
            nextTide = new Date(prevTide.getTime() + HALF_TIDAL_CYCLE_MS);
            
            // Déterminer si la prochaine marée est une marée haute ou une marée basse (pour l'angle)
            
            // Comme prevTide est la plus récente passée, si elle était basse, la prochaine est haute.
            const wasPrevTideHigh = (Math.abs(prevTide.getTime() - currentHigh.getTime()) < 1000); // 1s tolerance
            isNextTideHigh = !wasPrevTideHigh; 
        }

        // --- 3. Calcul de la progression et de l'angle ---
        
        const totalDuration = HALF_TIDAL_CYCLE_MS;
        const elapsed = now.getTime() - prevTide.getTime();
        
        let progress = elapsed / totalDuration;
        progress = Math.min(1, Math.max(0, progress)); // Borner entre 0 et 1

        // 12h = -Math.PI / 2 (Marée Haute)
        // 6h = Math.PI / 2 (Marée Basse)

        let angle;

        if (isNextTideHigh) {
            // Cycle: Basse -> Haute (de +PI/2 vers -PI/2). L'angle diminue (sens anti-horaire).
            angle = (Math.PI / 2) - (progress * Math.PI); 
        } else {
            // Cycle: Haute -> Basse (de -PI/2 vers +PI/2). L'angle augmente (sens horaire).
            angle = (-Math.PI / 2) + (progress * Math.PI);
        }
        
        // --- 4. Dessin du Cadran ---
        const canvas = this.querySelector('#tideClock');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const centerX = 150, centerY = 150;
        const radius = 140; 
        const outerRadius = 150; 

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Cadre Simulé (Bois/Clair)
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
        ctx.fillStyle = '#C8A878'; 
        ctx.fill();

        // Ajout d'une ombre
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        ctx.fill(); 
        ctx.restore(); 

        // Cadran Intérieur (Bleu Nuit)
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#1A237E'; 
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Points et Chiffres (Heures restantes)
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        
        const markerRadius = radius - 15;
        for (let i = 0; i < 12; i++) {
            const currentAngle = (i * Math.PI / 6) - Math.PI / 2;
            
            let label = '';
            
            // Côté gauche (indices 1 à 5)
            if (i >= 1 && i <= 5) {
                 // Montée (anti-horaire): 5, 4, 3, 2, 1 (i=1 est 5h restantes, i=5 est 1h restante)
                 label = (6 - i).toString();
            } 
            // Côté droit (indices 7 à 11)
            else if (i >= 7 && i <= 11) {
                 // Descente (horaire): 5, 4, 3, 2, 1 (i=7 est 1h restante, i=11 est 5h restantes)
                 // Correction: Nous inversons l'ordre de calcul pour que 7=5, 8=4, etc.
                 // i=7 -> (12 - 7) = 5
                 // i=11 -> (12 - 11) = 1 (FAUX, doit être 5)
                 
                 // L'ordre correct est (12 - i) pour i=7 -> 5, i=8 -> 4... i=11 -> 1.
                 // POUR OBTENIR 5, 4, 3, 2, 1 :
                 // i=7 doit donner 5.
                 // i=11 doit donner 1.
                 label = (12 - i).toString(); 
            }
            
            if (label) {
                const x = centerX + markerRadius * Math.cos(currentAngle);
                const y = centerY + markerRadius * Math.sin(currentAngle);
                ctx.fillText(label, x, y + 5);
            }
        }

        // Texte de Marée (Haut et Bas)
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        
        // Marée Haute (Haut, position 12h)
        const hauteYText = centerY - radius + 40;
        ctx.fillText("MARÉE HAUTE", centerX, hauteYText);
        
        // Marée Basse (Bas, position 6h)
        const basseYText = centerY + radius - 40; 
        ctx.fillText("MARÉE BASSE", centerX, basseYText); 

        // Titre Central
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText("HORAIRES DES MARÉES", centerX, centerY + 10);
        
        // --- Aiguille ---
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + 110 * Math.cos(angle), centerY + 110 * Math.sin(angle));
        ctx.strokeStyle = '#E0B55E'; 
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

        // --- Affichage des heures (rectangles blancs) ---
        
        const boxWidth = 50;
        const boxHeight = 20;
        const fontHour = 'bold 12px sans-serif';
        const textColor = '#000000';

        // Marée Haute (Heure AU-DESSUS du texte)
        const hauteYBox = centerY - radius + 5; 
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(centerX - boxWidth / 2, hauteYBox, boxWidth, boxHeight);
        ctx.font = fontHour;
        ctx.fillStyle = textColor;
        ctx.fillText(tideHighRaw, centerX, hauteYBox + 13);

        // Marée Basse (Heure EN-DESSOUS du texte)
        const basseYBox = basseYText + 5; 
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(centerX - boxWidth / 2, basseYBox, boxWidth, boxHeight); 
        ctx.font = fontHour;
        ctx.fillStyle = textColor;
        ctx.fillText(tideLowRaw, centerX, basseYBox + 13);
    }

    getCardSize() {
        return 5;
    }
}

customElements.define('tide-clock-card', TideClockCard);
