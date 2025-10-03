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

        // --- 1. Marée haute/basse données ---
        const baseHigh = this.parseTideTime(tideHighRaw, now);
        const baseLow = this.parseTideTime(tideLowRaw, now);

        // Durée moyenne d'un demi-cycle (6h12m30s)
        const HALF_TIDAL_MS = (6 * 60 * 60 * 1000) + (12.5 * 60 * 1000);

        // --- 2. Générer 4 marées sur 24h ---
        const tides = [];
        tides.push({ time: baseHigh, isHigh: true });
        tides.push({ time: new Date(baseHigh.getTime() + HALF_TIDAL_MS), isHigh: false });
        tides.push({ time: new Date(baseHigh.getTime() + 2 * HALF_TIDAL_MS), isHigh: true });
        tides.push({ time: new Date(baseHigh.getTime() + 3 * HALF_TIDAL_MS), isHigh: false });
        tides.push({ time: baseLow, isHigh: false });
        tides.push({ time: new Date(baseLow.getTime() + HALF_TIDAL_MS), isHigh: true });
        tides.push({ time: new Date(baseLow.getTime() + 2 * HALF_TIDAL_MS), isHigh: false });
        tides.push({ time: new Date(baseLow.getTime() + 3 * HALF_TIDAL_MS), isHigh: true });

        tides.sort((a, b) => a.time - b.time);

        // --- 3. Marée précédente / suivante ---
        let nextTide = tides.find(t => t.time > now);
        if (!nextTide) return;
        let idx = tides.indexOf(nextTide);
        let prevTide = tides[idx - 1] ?? tides[tides.length - 1];
        let isNextTideHigh = nextTide.isHigh;

        // --- 4. Progression ---
        const totalDuration = nextTide.time.getTime() - prevTide.time.getTime();
        const elapsed = now.getTime() - prevTide.time.getTime();
        let progress = elapsed / totalDuration;
        progress = Math.min(1, Math.max(0, progress));

        // Calcul du temps restant en heures
        const timeRemaining = (nextTide.time.getTime() - now.getTime()) / (60 * 60 * 1000);

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
        const markerRadius = radius - 20;

        // Côté DROIT (marée montante) : 5 en haut → 1 en bas
        for (let i = 1; i <= 5; i++) {
            const anglePos = Math.PI - (i / 6) * Math.PI; // De π à π/6
            const x = centerX + markerRadius * Math.cos(anglePos);
            const y = centerY - markerRadius * Math.sin(anglePos);
            ctx.fillText(6 - i, x, y); // Affiche 5, 4, 3, 2, 1
        }

        // Côté GAUCHE (marée descendante) : 1 en haut → 5 en bas
        for (let i = 1; i <= 5; i++) {
            const anglePos = (i / 6) * Math.PI; // De π/6 à π
            const x = centerX - markerRadius * Math.cos(anglePos);
            const y = centerY - markerRadius * Math.sin(anglePos);
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

        // Calcul de l'angle de l'aiguille (basé sur le temps restant)
        let needleAngle;
        if (isNextTideHigh) {
            // Marée montante : de bas (0°) vers haut (180°)
            needleAngle = progress * Math.PI;
        } else {
            // Marée descendante : de haut (180°) vers bas (0°)
            needleAngle = Math.PI - (progress * Math.PI);
        }

        // Aiguille
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(-Math.PI / 2); // Référence à midi
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
