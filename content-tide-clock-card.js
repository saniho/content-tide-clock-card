class TideClockCard extends HTMLElement {
    
    /**
     * Parse l'heure HH:MM en un objet Date pour la journée actuelle/spécifiée.
     */
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

        // --- 1. Définition des marées haute et basse du jour ---
        const tideHigh = this.parseTideTime(tideHighRaw, now);
        const tideLow = this.parseTideTime(tideLowRaw, now);

        let prevTide, nextTide, isNextTideHigh;

        // --- 2. Déterminer la plage actuelle (montante ou descendante) ---
        if (tideLow < now && now < tideHigh) {
            // Montée : basse -> haute
            prevTide = tideLow;
            nextTide = tideHigh;
            isNextTideHigh = true;
        } else if (tideHigh < now && now < tideLow) {
            // Descente : haute -> basse
            prevTide = tideHigh;
            nextTide = tideLow;
            isNextTideHigh = false;
        } else {
            // Cas où "now" est avant la première ou après la dernière du jour
            // On estime en décalant d'un jour
            if (now < tideLow && now < tideHigh) {
                prevTide = new Date(tideHigh.getTime() - 12 * 60 * 60 * 1000);
                nextTide = tideLow < tideHigh ? tideLow : tideHigh;
                isNextTideHigh = nextTide.getTime() === tideHigh.getTime();
            } else {
                prevTide = tideLow > tideHigh ? tideLow : tideHigh;
                nextTide = new Date(prevTide.getTime() + 12 * 60 * 60 * 1000);
                isNextTideHigh = nextTide.getTime() === tideHigh.getTime();
            }
        }

        // --- 3. Progression réelle entre prevTide et nextTide ---
        const totalDuration = nextTide.getTime() - prevTide.getTime();
        const elapsed = now.getTime() - prevTide.getTime();
        let progress = elapsed / totalDuration;
        progress = Math.min(1, Math.max(0, progress));

        let angle;
        if (isNextTideHigh) {
            // Montée : Basse (PI/2) -> Haute (-PI/2)
            angle = (Math.PI / 2) - (progress * Math.PI);
        } else {
            // Descente : Haute (-PI/2) -> Basse (PI/2)
            angle = (-Math.PI / 2) + (progress * Math.PI);
        }

        // --- 4. Dessin du cadran ---
        const canvas = this.querySelector('#tideClock');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const centerX = 150, centerY = 150;
        const radius = 140;
        const outerRadius = 150;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Bordure extérieure
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
        ctx.fillStyle = '#C8A878';
        ctx.fill();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        ctx.fill();
        ctx.restore();

        // Cadran intérieur
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#1A237E';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Marqueurs heures restantes
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        const markerRadius = radius - 15;
        for (let i = 0; i < 12; i++) {
            const currentAngle = (i * Math.PI / 6) - Math.PI / 2;
            let label = '';
            if (i >= 1 && i <= 5) {
                label = (6 - i).toString();
            } else if (i >= 7 && i <= 11) {
                label = (12 - i).toString();
            }
            if (label) {
                const x = centerX + markerRadius * Math.cos(currentAngle);
                const y = centerY + markerRadius * Math.sin(currentAngle);
                ctx.fillText(label, x, y + 5);
            }
        }

        // Texte marées
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText("MARÉE HAUTE", centerX, centerY - radius + 40);
        ctx.fillText("MARÉE BASSE", centerX, centerY + radius - 40);
        ctx.font = '14px sans-serif';
        ctx.fillText("HORAIRES DES MARÉES", centerX, centerY + 10);

        // Aiguille
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(-1, 1);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(110 * Math.cos(angle), 110 * Math.sin(angle));
        ctx.strokeStyle = '#E0B55E';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();

        // Centre de l'aiguille
        ctx.beginPath();
        ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#E0B55E';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        // Affichage heures haute/basse
        const boxWidth = 50;
        const boxHeight = 20;
        const fontHour = 'bold 12px sans-serif';
        const textColor = '#000000';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(centerX - boxWidth / 2, centerY - radius + 5, boxWidth, boxHeight);
        ctx.font = fontHour;
        ctx.fillStyle = textColor;
        ctx.fillText(tideHighRaw, centerX, centerY - radius + 5 + 13);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(centerX - boxWidth / 2, centerY + radius - 35, boxWidth, boxHeight);
        ctx.fillStyle = textColor;
        ctx.fillText(tideLowRaw, centerX, centerY + radius - 35 + 13);
    }

    getCardSize() {
        return 5;
    }
}

customElements.define('tide-clock-card', TideClockCard);
