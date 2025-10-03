class TideClockCard extends HTMLElement {
    
    parseTideTime(timeStr, baseDate) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes, 0, 0);
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
        const now = new Date();

        if (!tideHighRaw || !tideLowRaw) {
            this.innerHTML = `<ha-card><div style="padding:1em; color: black; text-align: center;">Erreur: Entités marée non disponibles.</div></ha-card>`;
            return;
        }

        // --- 1. Marée haute/basse données (ce sont les PROCHAINES marées) ---
        let nextHigh = this.parseTideTime(tideHighRaw, now);
        let nextLow = this.parseTideTime(tideLowRaw, now);
        
        // Si l'heure est passée aujourd'hui, c'est pour demain
        if (nextHigh < now) nextHigh = new Date(nextHigh.getTime() + 24 * 60 * 60 * 1000);
        if (nextLow < now) nextLow = new Date(nextLow.getTime() + 24 * 60 * 60 * 1000);

        // Durée moyenne d'un demi-cycle (6h12m30s)
        const HALF_TIDAL_MS = (6 * 60 * 60 * 1000) + (12.5 * 60 * 1000);

        // --- 2. Déterminer la prochaine marée et calculer la précédente ---
        let nextTide, prevTide, isNextTideHigh;
        
        if (nextHigh < nextLow) {
            // La prochaine marée est HAUTE
            nextTide = { time: nextHigh, isHigh: true };
            // La marée précédente était BASSE (6h12m avant)
            prevTide = { time: new Date(nextHigh.getTime() - HALF_TIDAL_MS), isHigh: false };
            isNextTideHigh = true;
        } else {
            // La prochaine marée est BASSE
            nextTide = { time: nextLow, isHigh: false };
            // La marée précédente était HAUTE (6h12m avant)
            prevTide = { time: new Date(nextLow.getTime() - HALF_TIDAL_MS), isHigh: true };
            isNextTideHigh = false;
        }

        // --- 4. Progression ---
        const totalDuration = nextTide.time.getTime() - prevTide.time.getTime();
        const elapsed = now.getTime() - prevTide.time.getTime();
        let progress = elapsed / totalDuration;
        progress = Math.min(1, Math.max(0, progress));

        // Calcul de l'angle par heure (180° divisé par le nombre d'heures du demi-cycle)
        const totalHours = totalDuration / (60 * 60 * 1000);
        const degreesPerHour = 180 / totalHours;

        // --- 5. Dessin du cadran ---
        const canvas = this.querySelector('#tideClock');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const centerX = 150, centerY = 150;
        const radius = 140, outerRadius = 150;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Bordure extérieure
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
        ctx.fillStyle = '#C8A878';
        ctx.fill();

        // Cadran
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#1A237E';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        // Calcul des positions des chiffres
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const markerRadius = radius - 30; // Plus loin du bord pour éviter la coupure

        // Côté GAUCHE (marée montante) : 5 (bas) → 4 → 3 → 2 → 1 (haut)
        // Représente le temps RESTANT avant la marée haute
        for (let i = 1; i <= 5; i++) {
            const angle = (270 - (i - 1) * degreesPerHour) * (Math.PI / 180);
            const x = centerX + markerRadius * Math.cos(angle);
            const y = centerY + markerRadius * Math.sin(angle);
            ctx.fillText(6 - i, x, y); // Affiche 5, 4, 3, 2, 1
        }

        // Côté DROIT (marée descendante) : 5 (haut) → 4 → 3 → 2 → 1 (bas)
        // Représente le temps RESTANT avant la marée basse
        for (let i = 1; i <= 5; i++) {
            const angle = (90 - (i - 1) * degreesPerHour) * (Math.PI / 180);
            const x = centerX + markerRadius * Math.cos(angle);
            const y = centerY + markerRadius * Math.sin(angle);
            ctx.fillText(6 - i, x, y); // Affiche 5, 4, 3, 2, 1
        }

        // Texte fixe
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText("MARÉE HAUTE", centerX, centerY - radius + 40);
        ctx.fillText("MARÉE BASSE", centerX, centerY + radius - 40);
        ctx.font = '14px sans-serif';
        ctx.fillText("HORAIRES DES MARÉES", centerX, centerY + 10);

        // Texte dynamique Montante/Descendante
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = '#FFD700';
        const tendance = isNextTideHigh ? "Montante" : "Descendante";
        ctx.fillText(tendance, centerX, centerY + 30);

        // Calcul de l'angle de l'aiguille
        let needleAngle;
        if (isNextTideHigh) {
            // Marée montante : de 180° (bas) vers 0° (haut) en passant par la GAUCHE (sens antihoraire)
            // 180° → 270° → 0°
            needleAngle = (180 + progress * 180) * (Math.PI / 180);
        } else {
            // Marée descendante : de 0° (haut) vers 180° (bas) en passant par la DROITE (sens horaire)
            // 0° → 90° → 180°
            needleAngle = (progress * 180) * (Math.PI / 180);
        }

        // Aiguille
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(needleAngle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(110, 0);
        ctx.strokeStyle = '#E0B55E';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();

        // Centre
        ctx.beginPath();
        ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#E0B55E';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        // Heures affichées
        const boxWidth = 50, boxHeight = 20;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(centerX - boxWidth/2, centerY - radius + 5, boxWidth, boxHeight);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 12px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(tideHighRaw, centerX, centerY - radius + 15);
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(centerX - boxWidth/2, centerY + radius - 25, boxWidth, boxHeight);
        ctx.fillStyle = '#000000';
        ctx.fillText(tideLowRaw, centerX, centerY + radius - 15);
    }

    getCardSize() {
        return 5;
    }
}

customElements.define('tide-clock-card', TideClockCard);
