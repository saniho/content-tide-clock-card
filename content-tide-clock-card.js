class TideClockCard extends HTMLElement {
    
    /**
     * Parse l'heure HH:MM en un objet Date pour la journée actuelle/spécifiée.
     */
    parseTideTime(timeStr, baseDate) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        // Utilise la date fournie (baseDate), mais l'heure HH:MM
        const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes, 0, 0);
        return date;
    }

    setConfig(config) {
        this.config = config;
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
        const now = new Date(); // Heure actuelle
        const DAY_MS = 24 * 60 * 60 * 1000;
        // Durée exacte d'un demi-cycle lunaire (6h 12m 30s) en millisecondes
        const HALF_TIDAL_CYCLE_MS = (6 * 60 * 60 * 1000) + (12.5 * 60 * 1000); 

        if (!tideHighRaw || !tideLowRaw) {
            this.innerHTML = `<ha-card><div style="padding:1em; color: black; text-align: center;">Erreur: Entités marée non disponibles.</div></ha-card>`;
            return;
        }

        // --- 1. Création et tri des marées candidates sur une fenêtre de 48h ---
        
        const tideCandidates = [];
        
        // On génère les marées Haute et Basse pour les jours J-1, J et J+1
        for (let i = -1; i <= 1; i++) { 
            const dateOffset = new Date(now.getTime() + (i * DAY_MS));
            
            tideCandidates.push({ time: this.parseTideTime(tideHighRaw, dateOffset), isHigh: true });
            tideCandidates.push({ time: this.parseTideTime(tideLowRaw, dateOffset), isHigh: false });
        }
        
        // Trie chronologique
        tideCandidates.sort((a, b) => a.time.getTime() - b.time.getTime());

        // --- 2. Identification du cycle actuel : (prevTide) -> (nextTide) ---
        
        // 2a. Trouver la prochaine marée (nextTide)
        let nextTideData = tideCandidates.find(t => t.time.getTime() > now.getTime());
        if (!nextTideData) return; 

        let nextTide = nextTideData.time;
        let isNextTideHigh = nextTideData.isHigh;
        
        // 2b. Déduire la marée précédente (prevTide)
        // La marée précédente est EXACTEMENT un demi-cycle avant la prochaine marée.
        let prevTide = new Date(nextTide.getTime() - HALF_TIDAL_CYCLE_MS);
        
        // 2c. Assurer que (prevTide) est la plus proche marée passée
        
        // Tant que la marée précédente déduite est antérieure à now par plus d'un demi-cycle:
        // (La différence est très petite, on utilise une tolérance)
        while ((now.getTime() - prevTide.getTime()) > HALF_TIDAL_CYCLE_MS + 1000) {
            // Cela signifie que nous avons sauté un cycle (prevTide est trop ancienne)
            // On avance tout le cycle d'un demi-cycle.
            prevTide.setTime(prevTide.getTime() + HALF_TIDAL_CYCLE_MS);
            nextTide.setTime(nextTide.getTime() + HALF_TIDAL_CYCLE_MS);
            isNextTideHigh = !isNextTideHigh;
        }

        // Cette boucle garantit que: prevTide < now < nextTide, et que l'intervalle
        // prevTide -> nextTide est exactement un demi-cycle lunaire.
        
        // --- 3. Calcul de la progression et de l'angle ---
        
        const totalDuration = HALF_TIDAL_CYCLE_MS;
        const elapsed = now.getTime() - prevTide.getTime(); 
        
        let progress = elapsed / totalDuration;
        progress = Math.min(1, Math.max(0, progress)); // Borner entre 0 et 1

        let angle;

        // Note: Dans le système de coordonnées Canvas standard, 0 rad est à droite, +PI/2 est en bas, -PI/2 est en haut.
        
        if (isNextTideHigh) {
            // Marée MONTANTE: Basse (prevTide) -> Haute (nextTide)
            // Le mouvement doit être anti-horaire (côté gauche du cadran).
            // Le point de départ (progress=0) doit être +PI/2 (Bas).
            // Le point d'arrivée (progress=1) doit être -PI/2 (Haut).
            // Pour forcer l'aiguille sur le côté GAUCHE, nous utilisons la formule de la marée DESCENDANTE et nous la faisons pivoter de 180 degrés.
            
            // Formule de marée descendante : (-PI/2) + (progress * PI) (côté droit)
            // Pour la faire passer à gauche, nous soustrayons le progrès à partir de +PI/2 (comme une horloge normale)
            angle = (Math.PI / 2) - (progress * Math.PI); 

            
        } else {
            // Marée DESCENDANTE: Haute (prevTide) -> Basse (nextTide)
            // Le mouvement doit être horaire (côté droit du cadran).
            // Le point de départ (progress=0) doit être -PI/2 (Haut).
            // Le point d'arrivée (progress=1) doit être +PI/2 (Bas).
            // Pour forcer l'aiguille sur le côté DROIT, nous utilisons la formule de la marée MONTANTE et nous la faisons pivoter de 180 degrés.

            // Formule de marée montante : (PI/2) - (progress * PI) (côté gauche)
            // Pour la faire passer à droite, nous ajoutons le progrès à partir de -PI/2
            angle = (-Math.PI / 2) + (progress * Math.PI);
        }
        
        // Je pense que l'environnement d'exécution inverse l'axe X.
        // Tentons une symétrie par rapport à l'axe Y pour inverser gauche/droite (angle = -angle)
        // Si la marée est montante, elle est sur le côté gauche. Si elle est descendante, elle est sur le côté droit.
        
        // Vérification de la position pour votre cas (Montante) :
        // Si Montante: nous utilisons la formule (PI/2) - (progress * PI) (ce qui donne normalement côté GAUCHE)
        // Si elle apparaît à droite, c'est que l'axe des X est inversé.
        angle = -angle; // Appliquer la symétrie latérale

        
        // --- 4. Dessin du Cadran (Aucun changement) ---
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
                 // Montée (anti-horaire): 5, 4, 3, 2, 1 
                 label = (6 - i).toString();
            } 
            // Côté droit (indices 7 à 11)
            else if (i >= 7 && i <= 11) {
                 // Descente (horaire): 5, 4, 3, 2, 1
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
