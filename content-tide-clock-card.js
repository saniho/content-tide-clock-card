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

    // Convertit "HH:mm" en Date, avec +1 jour si nécessaire
    function parseTimeToDate(timeStr, baseDate = new Date()) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes);
      if (date < baseDate) {
        date.setDate(date.getDate() + 1);
      }
      return date;
    }

    let tideHigh = parseTimeToDate(tideHighRaw, now);
    let tideLow = parseTimeToDate(tideLowRaw, tideHigh);

    if (tideLow <= tideHigh) {
      tideLow.setDate(tideLow.getDate() + 1);
    }

    // Détermine le cycle actif pour l’aiguille
    let cycleStart, cycleEnd;

    if (now < tideHigh) {
      // Cycle précédent : MB estimée à -6h
      cycleEnd = tideHigh;
      cycleStart = new Date(tideHigh);
      cycleStart.setHours(cycleStart.getHours() - 6);
    } else if (now >= tideHigh && now <= tideLow) {
      // Cycle actuel : MH → MB
      cycleStart = tideHigh;
      cycleEnd = tideLow;
    } else {
      // Cycle suivant : MB → MH estimée à +6h
      cycleStart = tideLow;
      cycleEnd = new Date(tideLow);
      cycleEnd.setHours(cycleEnd.getHours() + 6);
    }

    const totalDuration = cycleEnd - cycleStart;
    const elapsed = now - cycleStart;
    const progress = Math.max(0, Math.min(1, elapsed / totalDuration));
    const angle = progress * 2 * Math.PI;

    // Détermine la prochaine marée
    let nextTideLabel = '';
    let nextTideTime;

    if (now < tideHigh && (tideHigh < tideLow || now < tideLow)) {
      nextTideLabel = 'Marée haute';
      nextTideTime = tideHigh;
    } else {
      nextTideLabel = 'Marée basse';
      nextTideTime = tideLow;
    }

    const diffMs = nextTideTime - now;
    const diffMinutes = Math.floor(diffMs / 60000);
    const hoursLeft = Math.floor(diffMinutes / 60);
    const minutesLeft = diffMinutes % 60;
    const countdownText = `${nextTideLabel} dans ${hoursLeft}h ${minutesLeft}min`;

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
    ctx.fillText(countdownText, centerX, 220);

    // Aiguille centrale
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + 90 * Math.cos(angle - Math.PI/2), centerY + 90 * Math.sin(angle - Math.PI/2));
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
