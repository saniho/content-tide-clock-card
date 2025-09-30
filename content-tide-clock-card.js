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

    if (!tideHighRaw || !tideLowRaw) return;

    const tideHigh = new Date(tideHighRaw);
    const tideLow = new Date(tideLowRaw);

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
    ctx.fillText(`🌊 Marée haute: ${tideHigh.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`, centerX, 40);
    ctx.fillText(`🌊 Marée basse: ${tideLow.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`, centerX, 260);

    // Calcul de l'angle relatif
    const totalDuration = tideLow - tideHigh;
    const elapsed = now - tideHigh;
    const progress = Math.max(0, Math.min(1, elapsed / totalDuration)); // clamp entre 0 et 1
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
