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
        
        // Créer une copie modifiable de la config
        this.config = {
            ...config,
            theme: config.theme || 'classic',
            size: config.size || 'medium'
        };
        
        const sizes = {
            tiny: { canvas: 150, padding: 10 },
            xsmall: { canvas: 200, padding: 12 },
            small: { canvas: 250, padding: 15 },
            medium: { canvas: 300, padding: 20 },
            large: { canvas: 400, padding: 25 },
            xlarge: { canvas: 500, padding: 30 }
        };
        
        const sizeConfig = sizes[config.size] || sizes.medium;
        
        const bgColors = {
            classic: '#e0e0e0',
            light: '#ffffff',
            maritime: '#e0e0e0',
            dark: '#1a1a1a'
        };
        const bgColor = bgColors[config.theme] || '#e0e0e0';
        
        this.innerHTML = `
            <ha-card style="background: ${bgColor}; padding: ${sizeConfig.padding}px;">
                <canvas id="tideClock" width="${sizeConfig.canvas}" height="${sizeConfig.canvas}"></canvas>
            </ha-card>
            <style>
                canvas { display: block; margin: auto; }
            </style>
        `;
    }

    drawNauticalFlag(ctx, x, y, angle, type) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        
        const w = 8, h = 10;
        
        switch(type) {
            case 'red':
                ctx.fillStyle = '#D32F2F';
                ctx.fillRect(-w/2, -h/2, w, h);
                break;
            case 'yellow':
                ctx.fillStyle = '#FBC02D';
                ctx.fillRect(-w/2, -h/2, w, h);
                break;
            case 'blue':
                ctx.fillStyle = '#1976D2';
                ctx.fillRect(-w/2, -h/2, w, h);
                break;
            case 'split-red-white':
                ctx.fillStyle = '#D32F2F';
                ctx.fillRect(-w/2, -h/2, w/2, h);
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, -h/2, w/2, h);
                break;
            case 'split-blue-yellow':
                ctx.fillStyle = '#1976D2';
                ctx.fillRect(-w/2, -h/2, w/2, h);
                ctx.fillStyle = '#FBC02D';
                ctx.fillRect(0, -h/2, w/2, h);
                break;
            case 'tricolor':
                ctx.fillStyle = '#1976D2';
                ctx.fillRect(-w/2, -h/2, w, h/3);
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(-w/2, -h/2 + h/3, w, h/3);
                ctx.fillStyle = '#D32F2F';
                ctx.fillRect(-w/2, -h/2 + 2*h/3, w, h/3);
                break;
            case 'cross':
                ctx.fillStyle = '#D32F2F';
                ctx.fillRect(-w/2, -h/2, w, h);
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(-w/2, -h/2 + h/2 - 1, w, 2);
                ctx.fillRect(-w/2 + w/3, -h/2, 2, h);
                break;
        }
        
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(-w/2, -h/2, w, h);
        ctx.restore();
    }

    set hass(hass) {
        const tideHighRaw = hass.states[this.config.tide_high]?.state ?? null;
        const tideLowRaw = hass.states[this.config.tide_low]?.state ?? null;
        const now = new Date();

        if (!tideHighRaw || !tideLowRaw) {
            this.innerHTML = `<ha-card><div style="padding:1em; color: ${this.config.theme === 'dark' ? 'white' : 'black'}; text-align: center;">Erreur: Entités marée non disponibles.</div></ha-card>`;
            return;
        }

        const tideCoeff = hass.states[this.config.tide_high]?.attributes?.coeff ?? null;

        let nextHigh = this.parseTideTime(tideHighRaw, now);
        let nextLow = this.parseTideTime(tideLowRaw, now);
        
        if (nextHigh < now) nextHigh = new Date(nextHigh.getTime() + 24 * 60 * 60 * 1000);
        if (nextLow < now) nextLow = new Date(nextLow.getTime() + 24 * 60 * 60 * 1000);

        const HALF_TIDAL_MS = (6 * 60 * 60 * 1000) + (12.5 * 60 * 1000);

        let nextTide, prevTide, isNextTideHigh;
        
        if (nextHigh < nextLow) {
            nextTide = { time: nextHigh, isHigh: true };
            prevTide = { time: new Date(nextHigh.getTime() - HALF_TIDAL_MS), isHigh: false };
            isNextTideHigh = true;
        } else {
            nextTide = { time: nextLow, isHigh: false };
            prevTide = { time: new Date(nextLow.getTime() - HALF_TIDAL_MS), isHigh: true };
            isNextTideHigh = false;
        }

        const totalDuration = nextTide.time.getTime() - prevTide.time.getTime();
        const timeRemaining = nextTide.time.getTime() - now.getTime();
        const elapsed = now.getTime() - prevTide.time.getTime();
        let progress = elapsed / totalDuration;
        progress = Math.min(1, Math.max(0, progress));

        const totalHours = totalDuration / (60 * 60 * 1000);
        const degreesPerHour = 180 / totalHours;

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
            },
            maritime: {
                border: '#2E7D9A',
                dial: '#F5F5F5',
                dialStroke: '#1A237E',
                numbers: '#000000',
                textFixed: '#000000',
                textDynamic: '#1A237E',
                needle: '#000000',
                needleSecondary: '#D4AF37',
                center: '#1A237E',
                centerInner: '#FFFFFF',
                timeBox: '#FFFFFF',
                timeText: '#000000',
                sectorColor: '#1A4D7C',
                triangleColor: '#1A237E'
            },
            dark: {
                border: '#2a2a2a',
                dial: '#0d0d0d',
                dialStroke: '#404040',
                numbers: '#e0e0e0',
                textFixed: '#b0b0b0',
                textDynamic: '#00d4ff',
                needle: '#00d4ff',
                needleGlow: 'rgba(0, 212, 255, 0.5)',
                center: '#00d4ff',
                centerInner: '#0d0d0d',
                timeBox: '#1a1a1a',
                timeText: '#e0e0e0'
            }
        };

        const theme = themes[this.config.theme] || themes.classic;

        const sizes = {
            tiny: { canvas: 150, center: 75, radius: 67, outer: 75, font: 10, fontSmall: 8, fontMedium: 9 },
            xsmall: { canvas: 200, center: 100, radius: 90, outer: 100, font: 12, fontSmall: 9, fontMedium: 10 },
            small: { canvas: 250, center: 125, radius: 112, outer: 125, font: 14, fontSmall: 10, fontMedium: 12 },
            medium: { canvas: 300, center: 150, radius: 135, outer: 150, font: 16, fontSmall: 12, fontMedium: 14 },
            large: { canvas: 400, center: 200, radius: 180, outer: 200, font: 22, fontSmall: 16, fontMedium: 18 },
            xlarge: { canvas: 500, center: 250, radius: 225, outer: 250, font: 28, fontSmall: 20, fontMedium: 24 }
        };
        
        const size = sizes[this.config.size] || sizes.medium;
        const scaleFactor = size.canvas / 300;

        const canvas = this.querySelector('#tideClock');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const centerX = size.center, centerY = size.center;
        const radius = size.radius, outerRadius = size.outer;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
        ctx.fillStyle = theme.border;
        ctx.fill();

        if (this.config.theme === 'dark') {
            ctx.shadowColor = 'rgba(0, 212, 255, 0.3)';
            ctx.shadowBlur = 15 * scaleFactor;
        }

        if (this.config.theme === 'maritime') {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius + 5 * scaleFactor, 0, 2 * Math.PI);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();

            const flags = [
                { angle: 0, type: 'red' }, { angle: 30, type: 'yellow' },
                { angle: 60, type: 'blue' }, { angle: 90, type: 'split-red-white' },
                { angle: 120, type: 'red' }, { angle: 150, type: 'split-blue-yellow' },
                { angle: 180, type: 'tricolor' }, { angle: 210, type: 'yellow' },
                { angle: 240, type: 'cross' }, { angle: 270, type: 'blue' },
                { angle: 300, type: 'split-red-white' }, { angle: 330, type: 'red' }
            ];

            const flagRadius = radius + 10 * scaleFactor;
            flags.forEach(flag => {
                const angle = flag.angle * (Math.PI / 180);
                const x = centerX + flagRadius * Math.cos(angle - Math.PI/2);
                const y = centerY + flagRadius * Math.sin(angle - Math.PI/2);
                this.drawNauticalFlag(ctx, x, y, angle, flag.type);
            });

            const numTriangles = 24;
            const triangleSize = 6 * scaleFactor;
            const triangleRadius = radius + 2.5 * scaleFactor;
            
            for (let i = 0; i < numTriangles; i++) {
                const angle = (i * 360 / numTriangles) * (Math.PI / 180);
                const x = centerX + triangleRadius * Math.cos(angle);
                const y = centerY + triangleRadius * Math.sin(angle);
                
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(angle + Math.PI / 2);
                
                ctx.beginPath();
                ctx.moveTo(0, -triangleSize);
                ctx.lineTo(-triangleSize * 0.6, triangleSize * 0.5);
                ctx.lineTo(triangleSize * 0.6, triangleSize * 0.5);
                ctx.closePath();
                
                ctx.fillStyle = theme.triangleColor;
                ctx.fill();
                ctx.restore();
            }
        }

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = theme.dial;
        ctx.fill();
        ctx.strokeStyle = theme.dialStroke;
        ctx.lineWidth = 2 * scaleFactor;
        ctx.stroke();

        if (this.config.theme === 'maritime') {
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius - 25 * scaleFactor, Math.PI/2, 3*Math.PI/2, false);
            ctx.closePath();
            ctx.fillStyle = theme.sectorColor;
            ctx.globalAlpha = 0.15;
            ctx.fill();
            ctx.globalAlpha = 1.0;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius - 25 * scaleFactor, -Math.PI/2, Math.PI/2, false);
            ctx.closePath();
            ctx.fillStyle = theme.sectorColor;
            ctx.globalAlpha = 0.15;
            ctx.fill();
            ctx.globalAlpha = 1.0;

            for (let i = 1; i <= 5; i++) {
                const angleLeft = (90 + (i * 30)) * (Math.PI / 180);
                ctx.beginPath();
                ctx.moveTo(centerX + (radius - 55 * scaleFactor) * Math.cos(angleLeft), 
                          centerY + (radius - 55 * scaleFactor) * Math.sin(angleLeft));
                ctx.lineTo(centerX + (radius - 25 * scaleFactor) * Math.cos(angleLeft), 
                          centerY + (radius - 25 * scaleFactor) * Math.sin(angleLeft));
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2 * scaleFactor;
                ctx.stroke();

                const angleRight = (270 + (i * 30)) * (Math.PI / 180);
                ctx.beginPath();
                ctx.moveTo(centerX + (radius - 55 * scaleFactor) * Math.cos(angleRight), 
                          centerY + (radius - 55 * scaleFactor) * Math.sin(angleRight));
                ctx.lineTo(centerX + (radius - 25 * scaleFactor) * Math.cos(angleRight), 
                          centerY + (radius - 25 * scaleFactor) * Math.sin(angleRight));
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2 * scaleFactor;
                ctx.stroke();
            }
        }

        ctx.font = `bold ${size.font}px sans-serif`;
        ctx.fillStyle = theme.numbers;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const markerRadius = this.config.theme === 'maritime' ? radius - 40 * scaleFactor : radius - 15 * scaleFactor;

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

        ctx.font = `bold ${size.fontSmall}px sans-serif`;
        ctx.fillStyle = theme.textFixed;
        ctx.fillText("MARÉE HAUTE", centerX, centerY - radius + 40 * scaleFactor);
        ctx.fillText("MARÉE BASSE", centerX, centerY + radius - 40 * scaleFactor);
        
        if (this.config.theme !== 'maritime') {
            ctx.font = `${size.fontMedium}px sans-serif`;
            ctx.fillText("HORAIRES DES MARÉES", centerX, centerY + 10 * scaleFactor);
        }

        if (tideCoeff) {
            const coeffBoxWidth = 35 * scaleFactor;
            const coeffBoxHeight = 18 * scaleFactor;
            const coeffBoxY = centerY - radius + 55 * scaleFactor;
            
            ctx.fillStyle = theme.timeBox;
            ctx.fillRect(centerX - coeffBoxWidth/2, coeffBoxY, coeffBoxWidth, coeffBoxHeight);
            
            ctx.fillStyle = theme.timeText;
            ctx.font = `bold ${size.fontMedium}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tideCoeff, centerX, coeffBoxY + coeffBoxHeight/2);
        }

        const tendanceY = this.config.theme === 'maritime' ? centerY - 10 * scaleFactor : centerY + 30 * scaleFactor;
        ctx.font = `bold ${size.fontMedium}px sans-serif`;
        ctx.fillStyle = theme.textDynamic;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const tendance = isNextTideHigh ? "Montante" : "Descendante";
        
        if (this.config.theme === 'dark') {
            ctx.shadowColor = 'rgba(0, 212, 255, 0.6)';
            ctx.shadowBlur = 10 * scaleFactor;
        }
        ctx.fillText(tendance, centerX, tendanceY);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        const hoursElapsed = elapsed / (60 * 60 * 1000);
        let needleAngle;
        
        if (isNextTideHigh) {
            needleAngle = (90 + hoursElapsed * degreesPerHour) * (Math.PI / 180);
        } else {
            needleAngle = (270 + hoursElapsed * degreesPerHour) * (Math.PI / 180);
        }

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(needleAngle);
        
        if (this.config.theme === 'dark') {
            ctx.shadowColor = theme.needleGlow;
            ctx.shadowBlur = 20 * scaleFactor;
        }
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(110 * scaleFactor, 0);
        ctx.strokeStyle = theme.needle;
        ctx.lineWidth = 6 * scaleFactor;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        if (this.config.theme === 'maritime') {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.moveTo(-15 * scaleFactor, 0);
            ctx.lineTo(90 * scaleFactor, 0);
            ctx.strokeStyle = theme.needleSecondary || '#D4AF37';
            ctx.lineWidth = 3 * scaleFactor;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
        
        ctx.restore();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.arc(centerX, centerY, 8 * scaleFactor, 0, 2 * Math.PI);
        ctx.fillStyle = theme.center;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4 * scaleFactor, 0, 2 * Math.PI);
        ctx.fillStyle = theme.centerInner;
        ctx.fill();

        const boxWidth = 50 * scaleFactor, boxHeight = 20 * scaleFactor;
        ctx.fillStyle = theme.timeBox;
        ctx.fillRect(centerX - boxWidth/2, centerY - radius + 5 * scaleFactor, boxWidth, boxHeight);
        ctx.fillStyle = theme.timeText;
        ctx.font = `bold ${size.fontSmall}px sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText(tideHighRaw, centerX, centerY - radius + 15 * scaleFactor);
        
        ctx.fillStyle = theme.timeBox;
        ctx.fillRect(centerX - boxWidth/2, centerY + radius - 25 * scaleFactor, boxWidth, boxHeight);
        ctx.fillStyle = theme.timeText;
        ctx.fillText(tideLowRaw, centerX, centerY + radius - 15 * scaleFactor);
    }

    getCardSize() {
        const sizes = { small: 4, medium: 5, large: 7, xlarge: 9 };
        return sizes[this.config.size] || 5;
    }

    static getConfigElement() {
        return document.createElement("tide-clock-card-editor");
    }

    static getStubConfig() {
        return { tide_high: "", tide_low: "", theme: "classic", size: "medium" };
    }
}

class TideClockCardEditor extends HTMLElement {
    setConfig(config) {
        this._config = config;
        this.render();
    }

    configChanged(newConfig) {
        const event = new Event('config-changed', { bubbles: true, composed: true });
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
        const currentSize = this._config.size || 'medium';

        this.innerHTML = `
            <div style="padding: 20px;">
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Taille de l'horloge :</label>
                    <select id="size_select" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                        <option value="small" ${currentSize === 'small' ? 'selected' : ''}>📱 Petite (250x250px)</option>
                        <option value="medium" ${currentSize === 'medium' ? 'selected' : ''}>💻 Moyenne (300x300px)</option>
                        <option value="large" ${currentSize === 'large' ? 'selected' : ''}>🖥️ Grande (400x400px)</option>
                        <option value="xlarge" ${currentSize === 'xlarge' ? 'selected' : ''}>📺 Très grande (500x500px)</option>
                    </select>
                    <small style="color: #666; display: block; margin-top: 4px;">Choisissez la taille d'affichage de votre horloge</small>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Thème de l'horloge :</label>
                    <select id="theme_select" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                        <option value="classic" ${currentTheme === 'classic' ? 'selected' : ''}>🌊 Classic (Bleu marine)</option>
                        <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>☀️ Light (Fond blanc)</option>
                        <option value="maritime" ${currentTheme === 'maritime' ? 'selected' : ''}>⚓ Maritime (Style horloge nautique avec drapeaux)</option>
                        <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>🌙 Dark (Noir avec effets lumineux)</option>
                    </select>
                    <small style="color: #666; display: block; margin-top: 4px;">Choisissez le style visuel de votre horloge des marées</small>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Entité marée haute :</label>
                    <select id="tide_high_select" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin-bottom: 8px;">
                        ${createOptions(this._config.tide_high)}
                    </select>
                    <input type="text" id="tide_high_input" value="${this._config.tide_high || ''}" placeholder="sensor.maree_haute"
                        style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; display: none;" />
                    <small style="color: #666; display: block; margin-top: 4px;">L'entité doit retourner une heure au format HH:MM</small>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Entité marée basse :</label>
                    <select id="tide_low_select" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin-bottom: 8px;">
                        ${createOptions(this._config.tide_low)}
                    </select>
                    <input type="text" id="tide_low_input" value="${this._config.tide_low || ''}" placeholder="sensor.maree_basse"
                        style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; display: none;" />
                    <small style="color: #666; display: block; margin-top: 4px;">L'entité doit retourner une heure au format HH:MM</small>
                </div>

                <div style="margin-top: 16px; padding: 12px; background-color: #f0f8ff; border-left: 4px solid #0066CC; border-radius: 4px;">
                    <small style="color: #333;">ℹ️ <strong>Info :</strong> Le coefficient sera automatiquement lu depuis l'attribut <code>coeff</code> de l'entité marée haute.</small>
                </div>
            </div>
        `;

        const sizeSelect = this.querySelector('#size_select');
        sizeSelect.addEventListener('change', (e) => {
            this._config = { ...this._config, size: e.target.value };
            this.configChanged(this._config);
        });

        const themeSelect = this.querySelector('#theme_select');
        themeSelect.addEventListener('change', (e) => {
            this._config = { ...this._config, theme: e.target.value };
            this.configChanged(this._config);
        });

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
