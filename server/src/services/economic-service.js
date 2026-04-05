const config = require('../config');

class EconomicService {
  constructor() {
    this.cache = null;
    this.lastFetch = 0;
    this.FETCH_INTERVAL = 60000; // 60 seconds
    this.RETRY_INTERVAL = 120000; // 120 seconds on failure
  }

  async fetchData() {
    try {
      const res = await fetch(`${config.coingeckoUrl}?ids=bitcoin&vs_currencies=usd,eur&include_24hr_change=true`);
      if (!res.ok) {
        if (res.status === 429) {
          console.warn('[economic] Rate limited by CoinGecko, retrying in 120s');
          setTimeout(() => this.fetchData(), this.RETRY_INTERVAL);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      this.cache = this._format(data);
      this.lastFetch = Date.now();
    } catch (err) {
      console.error('[economic] Fetch failed:', err.message);
      // Keep serving stale cache
    }
  }

  _format(raw) {
    const btc = raw.bitcoin;
    return {
      usd: { value: btc.usd, change: btc.usd_24h_change },
      eur: { value: btc.eur, change: btc.eur_24h_change },
      btc: { value: btc.usd, change: btc.usd_24h_change },
      lastUpdated: this.lastFetch,
    };
  }

  getData() {
    return this.cache;
  }

  startAutoFetch() {
    this.fetchData(); // initial fetch
    setInterval(() => this.fetchData(), this.FETCH_INTERVAL);
  }
}

module.exports = new EconomicService();
