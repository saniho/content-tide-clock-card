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

        // Durée moyenne d’un demi-cycle (6h12m30s)
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

        let angle;
        if (isNextTideHigh) {
            // Angle pour marée montante (de bas en haut)
            angle = Math.PI - (progress * Math.PI); 
        } else {
            // Angle pour marée descendante (de haut en bas)
            angle = progress * Math.PI;
        }

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

        // Chiffres
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        const markerRadius = radius - 15;
        const angleStep = Math.PI / 6;

        // Chiffres côté gauche (1 à 5, de haut en bas)
        for (let i = 1; i <= 5; i++) {
            const angle = (Math.PI / 2) + (i * angleStep) - (Math.PI / 12);
            const x = centerX + markerRadius * Math.cos(angle);
            const y = centerY + markerRadius * Math.sin(angle);
            ctx.fillText(i, x, y);
        }

        // Chiffres côté droit (5 à 1, de haut en bas)
        for (let i = 1; i <= 5; i++) {
            const angle = (3 * Math.PI / 2) - (i * angleStep) + (Math.PI / 12);
            const x = centerX + markerRadius * Math.cos(angle);
            const y = centerY + markerRadius * Math.sin(angle);
            ctx.fillText(6 - i, x, y);
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

        // Aiguille
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(-Math.PI / 2);
        ctx.rotate(angle);
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
        ctx.fillText(tideHighRaw, centerX, centerY - radius + 18);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(centerX - boxWidth/2, centerY + radius - 35, boxWidth, boxHeight);
        ctx.fillStyle = '#000000';
        ctx.fillText(tideLowRaw, centerX, centerY + radius - 22);
    }

    getCardSize() {
        return 5;
    }
}

customElements.define('tide-clock-card', TideClockCard);
