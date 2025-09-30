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

    // Si la marée basse est avant la marée haute, on suppose qu'elle est le lendemain
    if (tideLow <= tideHigh) {
      tideLow.setDate(tideLow.getDate() + 1);
    }

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

    // Calcul de l'angle relatif
    let progress = 0;
    if (now >= tideHigh && now <= tideLow) {
      const totalDuration = tideLow - tideHigh;
      const elapsed = now - tideHigh;
      progress = elapsed / totalDuration;
    } else if (now < tideHigh) {
      progress = 0;
    } else {
      progress = 1;
    }

    const angle = progress * 2 * Math.PI;

    // Aiguille centrale (relative marée)
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
