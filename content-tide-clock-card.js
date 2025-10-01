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

        if (tideHigh < now) {
            tideHigh.setDate(tideHigh.getDate() + 1);
        }
        if (tideLow < now) {
            tideLow.setDate(tideLow.getDate() + 1);
        }

        const nextTide = tideHigh < tideLow ? tideHigh : tideLow;
        const prevTide = tideHigh < tideLow ? tideLow : tideHigh;
        prevTide.setDate(prevTide.getDate() - 1);

        const totalDuration = nextTide.getTime() - prevTide.getTime();
        const elapsed = now.getTime() - prevTide.getTime();
        const progress = elapsed / totalDuration;
        const angle = (progress * 2 * Math.PI) - Math.PI / 2;

        const canvas = this.querySelector('#tideClock');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const centerX = 150, centerY = 150;
        const radius = 140;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Cadran
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Texte des marées
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#0077be';
        ctx.fillText("MARÉE HAUTE", centerX, centerY - radius + 30);
        ctx.fillStyle = '#666';
        ctx.fillText("MARÉE BASSE", centerX, centerY + radius - 10);

        // Chiffres de l'horloge (1 à 5)
        ctx.font = '24px sans-serif';
        ctx.fillStyle = '#333';
        for (let i = 1; i <= 5; i++) {
            const numAngle = (i * Math.PI / 3) - Math.PI / 2;
            const x = centerX + (radius - 50) * Math.cos(numAngle);
            const y = centerY + (radius - 50) * Math.sin(numAngle);
            ctx.fillText(i.toString(), x, y + 8);
        }

        // Aiguille
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + 110 * Math.cos(angle), centerY + 110 * Math.sin(angle));
        ctx.strokeStyle = '#0077be';
        ctx.lineWidth = 6;
        ctx.stroke();

        // Cercle central
        ctx.beginPath();
        ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#0077be';
        ctx.fill();

        // Texte de la prochaine marée
        const diffMs = nextTide.getTime() - now.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);
        const hoursLeft = Math.floor(diffMinutes / 60);
        const minutesLeft = diffMinutes % 60;
        const countdownText = `Prochaine marée dans ${hoursLeft}h ${minutesLeft}min`;

        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#333';
        ctx.fillText(countdownText, centerX, centerY + 30);
    }

    getCardSize() {
        return 5;
    }
}

customElements.define('tide-clock-card', TideClockCard);
