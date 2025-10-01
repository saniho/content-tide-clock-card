class TideClockCard extends HTMLElement {
    setConfig(config) {
        this.config = config;
        // La carte doit avoir un fond sombre pour faire ressortir le cadran.
        this.innerHTML = `
            <ha-card style="background: #e0e0e0; padding: 20px;">
                <canvas id="tideClock" width="300" height="300"></canvas>
                <div id="tideInfo" style="text-align: center; font-family: sans-serif; padding-top: 10px; color: #333;"></div>
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
            this.innerHTML = `<ha-card><div style="padding:1em;">Entités marée non disponibles</div></ha-card>`;
            return;
        }

        // --- Logique de calcul des marées ---
        function parseTideTime(timeStr, baseDate = now) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes, 0, 0);
            return date;
        }

        let tideHigh = parseTideTime(tideHighRaw);
        let tideLow = parseTideTime(tideLowRaw);

        // Assurer que les marées sont dans le futur
        if (tideHigh < now) {
            tideHigh.setDate(tideHigh.getDate() + 1);
        }
        if (tideLow < now) {
            tideLow.setDate(tideLow.getDate() + 1);
        }

        // Déterminer le cycle actuel
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
        const radius = 140; // Rayon du cadran intérieur
        const outerRadius = 150; // Rayon du cadre extérieur

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // --- 1. Cadre Simulé (Bois/Clair) ---
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
        ctx.fillStyle = '#C8A878'; // Couleur bois clair
        ctx.fill();

        // Ajout d'une ombre pour simuler la profondeur
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        ctx.fill(); 
        ctx.restore(); // Réinitialise les ombres pour le dessin intérieur

        // --- 2. Cadran Intérieur (Bleu Nuit) ---
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#1A237E'; // Bleu Nuit
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF'; // Bordure blanche fine
        ctx.lineWidth = 1;
        ctx.stroke();

        // --- 3. Points et Chiffres ---
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        
        // Points et chiffres sur le cadran
        const markerRadius = radius - 15;
        for (let i = 0; i < 12; i++) {
            const currentAngle = (i * Math.PI / 6) - Math.PI / 2; // Angle en radians (commence à 12h)
            
            let label = '';
            if (i >= 1 && i <= 5) label = i.toString();
            if (i >= 7 && i <= 11) label = (12 - i).toString();
            
            if (label) {
                const x = centerX + markerRadius * Math.cos(currentAngle);
                const y = centerY + markerRadius * Math.sin(currentAngle);
                ctx.fillText(label, x, y + 5);
            }
        }

        // --- 4. Texte de Marée (Haut et Bas) ---
        ctx.font = 'bold 24px sans-serif';
        // Marée Haute (Haut, position 12h)
        ctx.fillText("MARÉE HAUTE", centerX, centerY - radius + 40);
        // Marée Basse (Bas, position 6h)
        ctx.fillText("MARÉE BASSE", centerX, centerY + radius - 15);

        // --- 5. Titre Central ---
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText("HORAIRES DE MARÉE", centerX, centerY + 10);
        
        // --- 6. Aiguille ---
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + 110 * Math.cos(angle), centerY + 110 * Math.sin(angle));
        ctx.strokeStyle = '#E0B55E'; // Couleur Or/Jaune clair
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

        // --- 7. Affichage des heures sous la carte ---
        const tideInfoDiv = this.querySelector('#tideInfo');
        if (tideInfoDiv) {
            tideInfoDiv.innerHTML = `
                <div style="display: flex; justify-content: space-around; font-size: 14px; margin-top: 10px;">
                    <span>Marée Haute: <strong>${tideHighRaw}</strong></span>
                    <span>Marée Basse: <strong>${tideLowRaw}</strong></span>
                </div>
            `;
        }
    }

    getCardSize() {
        return 5;
    }
}

customElements.define('tide-clock-card', TideClockCard);
