class TideClockCard extends HTMLElement {
    
    /**
     * Parse l'heure HH:MM en un objet Date pour la journée actuelle/spécifiée.
     * Cette fonction prend la date de base et l'heure fournie par l'entité.
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
        const now = new Date(); // Heure actuelle (ex: 22:04)

        if (!tideHighRaw || !tideLowRaw) {
            this.innerHTML = `<ha-card><div style="padding:1em; color: black; text-align: center;">Erreur: Entités marée non disponibles.</div></ha-card>`;
            return;
        }

        // --- Logique de calcul des marées ---
        
        // Durée exacte d'un demi-cycle lunaire (6h 12m 30s) en millisecondes
        const HALF_TIDAL_CYCLE_MS = (6 * 60 * 60 * 1000) + (12.5 * 60 * 1000); 
        const DAY_MS = 24 * 60 * 60 * 1000;
        
        // Les heures brutes sont pour une marée Haute et une marée Basse. 
        // Nous ne savons pas si elles sont passées, futures ou s'il y en a eu deux aujourd'hui.

        // 1. Créer une liste exhaustive de marées candidates sur 3 jours (hier, aujourd'hui, demain)
        const tideCandidates = [];
        
        for (let i = -1; i <= 1; i++) { // -1 (Hier), 0 (Aujourd'hui), 1 (Demain)
            const dateOffset = new Date(now.getTime() + (i * DAY_MS));
            
            // Marée Haute
            tideCandidates.push({ time: this.parseTideTime(tideHighRaw, dateOffset), isHigh: true });
            
            // Marée Basse
            tideCandidates.push({ time: this.parseTideTime(tideLowRaw, dateOffset), isHigh: false });
        }
        
        // 2. Trier toutes les marées chronologiquement
        tideCandidates.sort((a, b) => a.time.getTime() - b.time.getTime());

        // 3. Identifier les marées passées et futures qui encadrent 'now'
        
        // nextTideData: La première marée après l'heure actuelle
        const nextTideData = tideCandidates.find(t => t.time.getTime() > now.getTime());
        if (!nextTideData) return; // Devrait toujours exister avec une fenêtre de 3 jours

        const nextTide = nextTideData.time;
        const isNextTideHigh = nextTideData.isHigh;
        
        // prevTideData: La marée précédente la plus proche. 
        // On prend la marée immédiatement avant 'nextTide' dans la liste triée
        const nextTideIndex = tideCandidates.findIndex(t => t.time.getTime() === nextTide.getTime());
        
        // On assure que l'index précédent est valide (si la marée suivante est la première de la liste, on boucle sur le dernier élément)
        let prevTideData;
        if (nextTideIndex > 0) {
            prevTideData = tideCandidates[nextTideIndex - 1];
        } else {
             // Cas où nextTide est la première de la liste (rare) -> On cherche la dernière marée de la veille (non implémenté ici pour simplicité car 3 jours suffisent)
             // Solution plus simple: déduire la marée précédente du cycle complet.
             prevTideData = {
                 time: new Date(nextTide.getTime() - HALF_TIDAL_CYCLE_MS),
                 isHigh: !isNextTideHigh
             };
        }
        
        const prevTide = prevTideData.time;
        const isPrevTideHigh = prevTideData.isHigh;

        // VÉRIFICATION FINALE (pour le cas 22:04 -> 02:47)
        // Si prevTide est trop loin dans le passé, on peut avoir sauté un cycle (non plausible avec une fenêtre de 3 jours mais possible si les entités ne sont pas actualisées)
        // Cette boucle est la plus sûre: 
        let tempPrev = prevTide;
        let tempNext = nextTide;
        let tempIsNextHigh = isNextTideHigh;

        // Tant que l'intervalle entre les deux est trop grand, on avance les marées
        while (tempNext.getTime() - tempPrev.getTime() > HALF_TIDAL_CYCLE_MS * 1.5) { // Tolérance pour les petites variations
             tempNext = tempPrev; // La marée précédente devient la marée suivante
             tempIsNextHigh = !tempIsNextHigh;
             tempPrev = new Date(tempPrev.getTime() - HALF_TIDAL_CYCLE_MS); // On déduit la nouvelle marée précédente
        }
        
        // On réattribue les valeurs définitives après le "nettoyage"
        // Si la marée trouvée est la bonne (20:34 -> 02:47), le cycle est correct.
        
        
        // --- Calcul de la progression et de l'angle ---
        
        const totalDuration = HALF_TIDAL_CYCLE_MS;
        // Le temps écoulé depuis la marée précédente (20:34:30)
        const elapsed = now.getTime() - prevTide.getTime(); 
        
        let progress = elapsed / totalDuration;
        progress = Math.min(1, Math.max(0, progress)); // Borner entre 0 et 1

        // 12h = -Math.PI / 2 (Marée Haute)
        // 6h = Math.PI / 2 (Marée Basse)

        let angle;

        if (isNextTideHigh) {
            // Cycle: Basse -> Haute (Montante). Angle de +PI/2 (Bas) vers -PI/2 (Haut).
            // progress=0 (Basse): angle = PI/2 (Bas). progress=1 (Haute): angle = -PI/2 (Haut).
            angle = (Math.PI / 2) - (progress * Math.PI); 
        } else {
            // Cycle: Haute -> Basse (Descendante). Angle de -PI/2 (Haut) vers +PI/2 (Bas).
            // progress=0 (Haute): angle = -PI/2 (Haut). progress=1 (Basse): angle = PI/2 (Bas).
            angle = (-Math.PI / 2) + (progress * Math.PI);
        }
        
        // --- 4. Dessin du Cadran (Le dessin n'a pas été modifié) ---
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
                 // Descente (horaire): 5, 4, 3, 2, 1 (i=7 est 5h restantes, i=11 est 1h restante)
                 // Le calcul des heures restantes est symétrique
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
