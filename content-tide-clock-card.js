class TideClockCard extends HTMLElement {
  set hass(hass) {
    const tideHigh = hass.states['sensor.maree_haute'].state;
    const tideLow = hass.states['sensor.maree_basse'].state;
    const now = new Date();

    this.innerHTML = `
      <canvas id="tideClock" width="300" height="300"></canvas>
      <style>
        canvas { display: block; margin: auto; }
      </style>
    `;

    const canvas = this.querySelector('#tideClock');
    const ctx = canvas.getContext('2d');
    const centerX = 150, centerY = 150;

    // Draw clock face
    ctx.beginPath();
    ctx.arc(centerX, centerY, 140, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw tide labels
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🌊 Marée haute: ${tideHigh}`, centerX, 40);
    ctx.fillText(`🌊 Marée basse: ${tideLow}`, centerX, 260);

    // Draw hour and minute hands
    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    const hourAngle = (Math.PI / 6) * hours + (Math.PI / 360) * minutes;
    const minuteAngle = (Math.PI / 30) * minutes;

    // Hour hand
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + 60 * Math.cos(hourAngle - Math.PI/2), centerY + 60 * Math.sin(hourAngle - Math.PI/2));
    ctx.stroke();

    // Minute hand
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
