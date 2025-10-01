class TideClockCard extends HTMLElement {
    setConfig(config) {
        this.config = config;
        this.innerHTML = `
            <canvas id="tideClock" width="300" height="300"></canvas>
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

        function parseTideTime(timeStr, baseDate = now) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes, 0, 0);
            return date;
        }

        let tideHigh = parseTideTime(tideHighRaw);
        let tideLow = parseTideTime(tideLowRaw);

        // Si l'une des marées est en arrière de l'autre, on la décale au jour suivant
        // pour s'assurer que les deux sont dans le futur par rapport à maintenant
        if (tideHigh < now) {
            tideHigh.setDate(tideHigh.getDate() + 1);
        }
        if (tideLow < now) {
            tideLow.setDate(tideLow.getDate() + 1);
        }

        // Déterminer la prochaine marée à venir (la plus proche)
        const nextTide = tideHigh < tideLow ? tideHigh : tideLow;
        const prevTide = tideHigh < tideLow ? tideLow : tideHigh;
        prevTide.setDate(prevTide.getDate() - 1); // La marée du cycle précédent

        // Calculer l'angle de l'aiguille
        const totalDuration = nextTide.getTime() - prevTide.getTime();
        const elapsed = now.getTime() - prevTide.getTime();
        const progress = elapsed / totalDuration;
        const angle = (progress * 2 * Math.PI) - Math.PI / 2; // -PI/2 pour l'orientation verticale

        const canvas = this.querySelector('#tideClock');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const centerX = 150, centerY = 150;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Cadran
        ctx.beginPath();
        ctx.arc(centerX, centerY, 140, 0, 2 * Math.PI);
        ctx.stroke();

        // Marées (textes)
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`🌊 Marée haute: ${tideHighRaw}`, centerX, 40);
        ctx.fillText(`🌊 Marée basse: ${tideLowRaw}`, centerX, 260);

        // Aiguille centrale
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + 90 * Math.cos(angle), centerY + 90 * Math.sin(angle));
        ctx.strokeStyle = '#0077be';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Cercle central
        ctx.beginPath();
        ctx.arc(centerX, centerY, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#0077be';
        ctx.fill();
    }

    getCardSize() {
        return 3;
    }
}

customElements.define('tide-clock-card', TideClockCard);
