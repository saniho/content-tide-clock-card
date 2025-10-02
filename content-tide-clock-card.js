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

        // Toutes les marées futures proches
        const futureTides = [currentHigh, currentLow].filter(t => t.getTime() > now.getTime());
        
        if (futureTides.length === 0) {
            // Cas où les deux marées normalisées sont dans le passé, on prend la plus récente et on projette la suivante
            const lastTide = currentHigh.getTime() > currentLow.getTime() ? currentHigh : currentLow;
            
            const wasLastTideHigh = (lastTide.getTime() === currentHigh.getTime());
            isNextTideHigh = !wasLastTideHigh;

            nextTide = new Date(lastTide.getTime() + HALF_TIDAL_CYCLE_MS);
            prevTide = lastTide;
            
        } else {
            // Trouver la prochaine marée dans le futur
            nextTide = futureTides.reduce((a, b) => (a.getTime() < b.getTime() ? a : b));
            isNextTideHigh = (nextTide.getTime() === currentHigh.getTime());
            
            // La marée précédente est nextTide moins un demi-cycle
            prevTide = new Date(nextTide.getTime() - HALF_TIDAL_CYCLE_MS);
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
            // Cycle: Basse -> Haute (de Math.PI / 2 vers -Math.PI / 2). L'angle diminue.
            angle = (Math.PI / 2) - (progress * Math.PI); 
        } else {
            // Cycle: Haute -> Basse (de -Math.PI / 2 vers Math.PI / 2). L'angle augmente.
            angle = (-Math.PI / 2) + (progress * Math.PI);
        }
        
        // --- 4. Dessin du Cadran (Identique au script fourni) ---
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

        // Points et Chiffres (Symétrie 5 à 1)
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        
        const markerRadius = radius - 15;
        for (let i = 0; i < 12; i++) {
            const currentAngle = (i * Math.PI / 6) - Math.PI / 2;
            
            let label = '';
            if (i >= 1 && i <= 5) label = (6 - i).toString();
            if (i >= 7 && i <= 11) label = (12 - i).toString();
            
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
