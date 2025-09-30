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

    // Fonction pour convertir "HH:mm" en Date
    function parseTimeToDate(timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      if (date < now) {
        date.setDate(date.getDate() + 1); // si déjà passé, on suppose demain
      }
      return date;
    }

    const tideHigh = parseTimeToDate(tideHighRaw);
    const tideLow = parseTimeToDate(tideLowRaw);

    const canvas = this.querySelector('#tideClock');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
