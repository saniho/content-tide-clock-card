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
    const tideHigh = hass.states[this.config.tide_high].state;
    const tideLow = hass.states[this.config.tide_low].state;
    const now = new Date();

    const canvas = this.querySelector('#tideClock');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const centerX = 150, centerY = 150;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Cadran
    ctx.beginPath();
    ctx.arc(centerX, centerY, 140, 0, 2 * Math.PI);
    ctx.stroke();

    // Marées
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🌊 Marée haute: ${tideHigh}`, centerX, 40);
    ctx.fillText(`🌊 Marée basse: ${tideLow}`, centerX, 260);

    // Aiguilles
    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    const hourAngle = (Math.PI / 6) * hours + (Math.PI / 360) * minutes;
    const minuteAngle = (Math.PI / 30) * minutes;

    // Heure
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + 60 * Math.cos(hourAngle - Math.PI/2), centerY + 60 * Math.sin(hourAngle - Math.PI/2));
    ctx.stroke();

    // Minute
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + 90 * Math.cos(minuteAngle - Math.PI/2), centerY + 90 * Math.sin(minuteAngle - Math.PI/2));
    ctx.stroke();
  }

  getCardSize() {
    return 3;
  }
}

customElements.define('tide-clock-card', TideClockCard);
