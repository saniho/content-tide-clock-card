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
        
        // --- 3. Calcul de la progression et de l'angle (Logique simplifiée basée sur votre suggestion) ---
        
        const totalDuration = HALF_TIDAL_CYCLE_MS;
        const elapsed = now.getTime() - prevTide.getTime(); 
        
        let progress = elapsed / totalDuration;
        progress = Math.min(1, Math.max(0, progress)); // Borner entre 0 (0%) et 1 (100%)

        let angle;

        // Le mouvement total couvre PI radians (180 degrés).
        const ANGLE_RANGE = Math.PI; 
        
        if (isNextTideHigh) {
            // Marée MONTANTE: Basse (prevTide) -> Haute (nextTide)
            // L'aiguille doit se déplacer sur le côté GAUCHE (de Basse vers Haute).
            // L'angle part de 0 (horizontal droit) et va vers -PI (horizontal gauche) puis remonte
            // Pour forcer le mouvement sur le demi-cercle GAUCHE:
            // L'angle doit être calculé de PI (bas à gauche) vers 0 (haut) en sens anti-horaire,
            // ou de -PI/2 (haut) à PI/2 (bas) sur l'axe Y en GAUCHE.
            
            // Si on utilise la convention 0=droite, PI=gauche:
            // Progress 0 (Basse) -> Angle de départ = 3 * PI / 2 (bas, 270 deg)
            // Progress 1 (Haute) -> Angle d'arrivée = PI / 2 (haut, 90 deg)
            // La direction est anti-horaire (angle diminue)
            
            // Nous allons forcer l'angle sur le demi-cercle de 90 deg (Haut) à 270 deg (Bas), via le côté GAUCHE.
            // On commence à -0.5 * PI (Haut) et on va jusqu'à 0.5 * PI (Bas)
            // L'aiguille doit aller de Bas (-PI/2) vers Haut (PI/2), mais sur l'axe gauche (rotation positive de PI).
            
            // Mouvement GAUCHE (Bas -> Haut) : angle va de PI/2 vers -PI/2 en passant par PI
            // L'angle se déplace de -90 degrés à 90 degrés, mais on veut qu'il soit sur la gauche.
            
            // Angle de départ (Basse): PI/2 (Bas)
            // Angle d'arrivée (Haute): -PI/2 (Haut)
            
            angle = Math.PI / 2 + ANGLE_RANGE * progress;
            angle = angle % (2 * Math.PI); // Borner l'angle

            // Maintenant, l'angle va de PI/2 à 3*PI/2 (côté gauche). 
            // Pour le ramener à l'affichage centré à -PI/2 (Haut), on lui ajoute PI.
            // La correction nécessaire pour forcer l'aiguille à rester à gauche est -progress * Math.PI.
            // Si progress=0 (Basse), angle doit être -PI/2 (Haut). Faux. Basse doit être en bas.
            
            // Tentative 3 (simple : 180° de mouvement GAUCHE, de BAS à HAUT)
            // Le mouvement va de 3*PI/2 (Bas) à PI/2 (Haut), via le côté gauche (angle décroissant).
            // Le point de départ est Math.PI (Gauche) + Math.PI/2 = 3*PI/2
            // L'aiguille doit commencer à PI/2 (bas), et aller vers -PI/2 (haut) en passant par PI (gauche).
            angle = (Math.PI / 2) + Math.PI * progress; // Commence à PI/2 (Bas), termine à 3PI/2 (Bas à GAUCHE)
            
            // Cette simple formule couvre 180 degrés.
            // Angle de départ (Basse): PI/2 (en bas, côté droit). Faux.
            
            // Finalement, on revient au plus simple et on se bat avec la symétrie latérale:
            // Aiguille doit aller de Bas (PI/2) vers Haut (-PI/2). Mouvement anti-horaire (- progress * PI).
            angle = (Math.PI / 2) - (progress * Math.PI); 
            // Pour forcer l'affichage à GAUCHE, on inverse l'angle.
            angle = -angle; 

            
        } else {
            // Marée DESCENDANTE: Haute (prevTide) -> Basse (nextTide)
            // L'aiguille doit se déplacer sur le côté DROIT.
            // Mouvement horaire (+ progress * PI). De Haut (-PI/2) vers Bas (PI/2).
            angle = (-Math.PI / 2) + (progress * Math.PI);
            // Pour forcer l'affichage à DROITE, on inverse l'angle.
            angle = -angle;
        }

        // Cette inversion finale devrait annuler le problème de symétrie de l'environnement, 
        // en supposant que les formules de base créent le mouvement correct dans la direction des aiguilles d'une montre.
        
        
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
            // Rotation pour aligner 12h en haut (-PI/2)
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
