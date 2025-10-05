class TideClockCard extends HTMLElement {
    
    parseTideTime(timeStr, baseDate) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes, 0, 0);
    }

    setConfig(config) {
        if (!config.tide_high) {
            throw new Error('Vous devez définir une entité tide_high');
        }
        if (!config.tide_low) {
            throw new Error('Vous devez définir une entité tide_low');
        }
        
        // Définir un thème par défaut si non spécifié
        if (!config.theme) {
            config.theme = 'classic';
        }
        
        this.config = config;
        
        // Couleur de fond selon le thème
        const bgColor = config.theme === 'light' ? '#ffffff' : '#e0e0e0';
        
        this.innerHTML = `
            <ha-card style="background: ${bgColor}; padding: 20px;">
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

        // Récupérer le coefficient depuis l'attribut de la marée haute
        const tideCoeff = hass.states[this.config.tide_high]?.attributes?.coeff ?? null;

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

        // --- 3. Progression ---
        const totalDuration = nextTide.time.getTime() - prevTide.time.getTime();
        const timeRemaining = nextTide.time.getTime() - now.getTime();
        const elapsed = now.getTime() - prevTide.time.getTime();
        let progress = elapsed / totalDuration;
        progress = Math.min(1, Math.max(0, progress));

        // Calcul de l'angle par heure (180° divisé par le nombre d'heures du demi-cycle)
        const totalHours = totalDuration / (60 * 60 * 1000);
        const degreesPerHour = 180 / totalHours;
        const hoursRemaining = timeRemaining / (60 * 60 * 1000);

        // --- Définition des thèmes de couleurs ---
        const themes = {
            classic: {
                border: '#C8A878',
                dial: '#1A237E',
                dialStroke: '#FFFFFF',
                numbers: '#FFFFFF',
                textFixed: '#FFFFFF',
                textDynamic: '#FFD700',
                needle: '#E0B55E',
                center: '#E0B55E',
                centerInner: '#FFFFFF',
                timeBox: '#FFFFFF',
                timeText: '#000000'
            },
            light: {
                border: '#E0E0E0',
                dial: '#FFFFFF',
                dialStroke: '#333333',
                numbers: '#333333',
                textFixed: '#333333',
                textDynamic: '#0066CC',
                needle: '#0066CC',
                center: '#0066CC',
                centerInner: '#FFFFFF',
                timeBox: '#F0F0F0',
                timeText: '#000000'
            }
        };

        const theme = themes[this.config.theme] || themes.classic;

        // --- 4. Dessin du cadran ---
        const canvas = this.querySelector('#tideClock');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const centerX = 150, centerY = 150;
        const radius = 140, outerRadius = 150;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Bordure extérieure
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
        ctx.fillStyle = theme.border;
        ctx.fill();

        // Cadran
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = theme.dial;
        ctx.fill();
        ctx.strokeStyle = theme.dialStroke;
        ctx.stroke();

        // Calcul des positions des chiffres
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = theme.numbers;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const markerRadius = radius - 15;

        // Côté GAUCHE (marée montante) : 6 (bas-gauche) → 5 → 4 → 3 → 2 → 1 (haut-gauche)
        const startAngleLeft = 90;
        const endAngleLeft = 270;
        const angleRangeLeft = endAngleLeft - startAngleLeft;
        
        for (let i = 1; i < 6; i++) {
            const chiffre = 6 - i;
            const angleDegrees = startAngleLeft + (i / 6) * angleRangeLeft;
            const angle = angleDegrees * (Math.PI / 180);
            const x = centerX + markerRadius * Math.cos(angle);
            const y = centerY + markerRadius * Math.sin(angle);
            ctx.fillText(chiffre, x, y);
        }

        // Côté DROIT (marée descendante) : 6 (haut-droite) → 5 → 4 → 3 → 2 → 1 (bas-droite)
        const startAngleRight = 270;
        const endAngleRight = 90;
        
        for (let i = 1; i < 6; i++) {
            const chiffre = 6 - i;
            const angleDegrees = startAngleRight + (i / 6) * (endAngleRight + 360 - startAngleRight);
            const angle = (angleDegrees % 360) * (Math.PI / 180);
            const x = centerX + markerRadius * Math.cos(angle);
            const y = centerY + markerRadius * Math.sin(angle);
            ctx.fillText(chiffre, x, y);
        }

        // Texte fixe
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = theme.textFixed;
        ctx.fillText("MARÉE HAUTE", centerX, centerY - radius + 40);
        ctx.fillText("MARÉE BASSE", centerX, centerY + radius - 40);
        ctx.font = '14px sans-serif';
        ctx.fillText("HORAIRES DES MARÉES", centerX, centerY + 10);

        // Affichage du coefficient si disponible - dans un cadre sous MARÉE HAUTE
        if (tideCoeff) {
            const coeffBoxWidth = 35;
            const coeffBoxHeight = 18;
            const coeffBoxY = centerY - radius + 55;
            
            // Cadre du coefficient
            ctx.fillStyle = theme.timeBox;
            ctx.fillRect(centerX - coeffBoxWidth/2, coeffBoxY, coeffBoxWidth, coeffBoxHeight);
            
            // Bordure du cadre
            ctx.strokeStyle = theme.textDynamic;
            ctx.lineWidth = 2;
            ctx.strokeRect(centerX - coeffBoxWidth/2, coeffBoxY, coeffBoxWidth, coeffBoxHeight);
            
            // Nombre du coefficient
            ctx.fillStyle = theme.textDynamic;
            ctx.font = 'bold 14px sans-serif';
            ctx.textBaseline = 'middle';
            ctx.fillText(tideCoeff, centerX, coeffBoxY + coeffBoxHeight/2);
        }

        // Texte dynamique Montante/Descendante
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = theme.textDynamic;
        ctx.textBaseline = 'middle';
        const tendance = isNextTideHigh ? "Montante" : "Descendante";
        ctx.fillText(tendance, centerX, centerY + 30);

        // Calcul de l'angle de l'aiguille basé sur les heures écoulées
        const hoursElapsed = elapsed / (60 * 60 * 1000);
        let needleAngle;
        
        if (isNextTideHigh) {
            // Marée montante : l'aiguille part de 90° (bas) et va vers 270° (haut) par la gauche
            needleAngle = (90 + hoursElapsed * degreesPerHour) * (Math.PI / 180);
        } else {
            // Marée descendante : l'aiguille part de 270° (haut) et va vers 90° (bas) par la droite
            needleAngle = (270 + hoursElapsed * degreesPerHour) * (Math.PI / 180);
        }

        // Aiguille
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(needleAngle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(110, 0);
        ctx.strokeStyle = theme.needle;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();

        // Centre
        ctx.beginPath();
        ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
        ctx.fillStyle = theme.center;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
        ctx.fillStyle = theme.centerInner;
        ctx.fill();

        // Heures affichées
        const boxWidth = 50, boxHeight = 20;
        ctx.fillStyle = theme.timeBox;
        ctx.fillRect(centerX - boxWidth/2, centerY - radius + 5, boxWidth, boxHeight);
        ctx.fillStyle = theme.timeText;
        ctx.font = 'bold 12px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(tideHighRaw, centerX, centerY - radius + 15);
        
        ctx.fillStyle = theme.timeBox;
        ctx.fillRect(centerX - boxWidth/2, centerY + radius - 25, boxWidth, boxHeight);
        ctx.fillStyle = theme.timeText;
        ctx.fillText(tideLowRaw, centerX, centerY + radius - 15);
    }

    getCardSize() {
        return 5;
    }

    static getConfigElement() {
        return document.createElement("tide-clock-card-editor");
    }

    static getStubConfig() {
        return {
            tide_high: "",
            tide_low: "",
            theme: "classic"
        };
    }
}

// Éditeur de configuration
class TideClockCardEditor extends HTMLElement {
    setConfig(config) {
        this._config = config;
        this.render();
    }

    configChanged(newConfig) {
        const event = new Event('config-changed', {
            bubbles: true,
            composed: true
        });
        event.detail = { config: newConfig };
        this.dispatchEvent(event);
    }

    getEntitiesList() {
        if (!this._hass) return [];
        return Object.keys(this._hass.states).sort();
    }

    render() {
        if (!this._config) return;

        const entities = this.getEntitiesList();
        
        const createOptions = (selectedValue) => {
            let options = '<option value="">-- Sélectionner une entité --</option>';
            entities.forEach(entity => {
                const selected = entity === selectedValue ? 'selected' : '';
                options += `<option value="${entity}" ${selected}>${entity}</option>`;
            });
            options += '<option value="custom">✏️ Saisie manuelle</option>';
            return options;
        };

        const currentTheme = this._config.theme || 'classic';

        this.innerHTML = `
            <div style="padding: 20px;">
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">
                        Thème de l'horloge :
                    </label>
                    <select 
                        id="theme_select"
                        style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;"
                    >
                        <option value="classic" ${currentTheme === 'classic' ? 'selected' : ''}>🌊 Classic (Bleu marine)</option>
                        <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>☀️ Light (Fond blanc)</option>
                    </select>
                    <small style="color: #666; display: block; margin-top: 4px;">
                        Choisissez le style visuel de votre horloge des marées
                    </small>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">
                        Entité marée haute :
                    </label>
                    <select 
                        id="tide_high_select"
                        style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin-bottom: 8px;"
                    >
                        ${createOptions(this._config.tide_high)}
                    </select>
                    <input 
                        type="text" 
                        id="tide_high_input" 
                        value="${this._config.tide_high || ''}"
                        placeholder="sensor.maree_haute"
                        style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; display: none;"
                    />
                    <small style="color: #666; display: block; margin-top: 4px;">
                        L'entité doit retourner une heure au format HH:MM
                    </small>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">
                        Entité marée basse :
                    </label>
                    <select 
                        id="tide_low_select"
                        style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin-bottom: 8px;"
                    >
                        ${createOptions(this._config.tide_low)}
                    </select>
                    <input 
                        type="text" 
                        id="tide_low_input" 
                        value="${this._config.tide_low || ''}"
                        placeholder="sensor.maree_basse"
                        style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; display: none;"
                    />
                    <small style="color: #666; display: block; margin-top: 4px;">
                        L'entité doit retourner une heure au format HH:MM
                    </small>
                </div>

                <div style="margin-top: 16px; padding: 12px; background-color: #f0f8ff; border-left: 4px solid #0066CC; border-radius: 4px;">
                    <small style="color: #333;">
                        ℹ️ <strong>Info :</strong> Le coefficient sera automatiquement lu depuis l'attribut <code>coeff</code> de l'entité marée haute.
                    </small>
                </div>
            </div>
        `;

        // Gestion du thème
        const themeSelect = this.querySelector('#theme_select');
        themeSelect.addEventListener('change', (e) => {
            this._config = { ...this._config, theme: e.target.value };
            this.configChanged(this._config);
        });

        // Gestion marée haute
        const tideHighSelect = this.querySelector('#tide_high_select');
        const tideHighInput = this.querySelector('#tide_high_input');
        
        if (this._config.tide_high && !entities.includes(this._config.tide_high)) {
            tideHighSelect.value = 'custom';
            tideHighSelect.style.display = 'none';
            tideHighInput.style.display = 'block';
        }

        tideHighSelect.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                tideHighSelect.style.display = 'none';
                tideHighInput.style.display = 'block';
                tideHighInput.focus();
            } else {
                this._config = { ...this._config, tide_high: e.target.value };
                this.configChanged(this._config);
            }
        });

        tideHighInput.addEventListener('input', (e) => {
            this._config = { ...this._config, tide_high: e.target.value };
            this.configChanged(this._config);
        });

        tideHighInput.addEventListener('blur', (e) => {
            if (!e.target.value) {
                tideHighSelect.style.display = 'block';
                tideHighInput.style.display = 'none';
                tideHighSelect.value = '';
            }
        });

        // Gestion marée basse
        const tideLowSelect = this.querySelector('#tide_low_select');
        const tideLowInput = this.querySelector('#tide_low_input');
        
        if (this._config.tide_low && !entities.includes(this._config.tide_low)) {
            tideLowSelect.value = 'custom';
            tideLowSelect.style.display = 'none';
            tideLowInput.style.display = 'block';
        }

        tideLowSelect.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                tideLowSelect.style.display = 'none';
                tideLowInput.style.display = 'block';
                tideLowInput.focus();
            } else {
                this._config = { ...this._config, tide_low: e.target.value };
                this.configChanged(this._config);
            }
        });

        tideLowInput.addEventListener('input', (e) => {
            this._config = { ...this._config, tide_low: e.target.value };
            this.configChanged(this._config);
        });

        tideLowInput.addEventListener('blur', (e) => {
            if (!e.target.value) {
                tideLowSelect.style.display = 'block';
                tideLowInput.style.display = 'none';
                tideLowSelect.value = '';
            }
        });
    }

    set hass(hass) {
        this._hass = hass;
    }
}

customElements.define('tide-clock-card', TideClockCard);
customElements.define('tide-clock-card-editor', TideClockCardEditor);
