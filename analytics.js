/* Attribution only: no email, telephone, IP address, or persistent user identifier. */
(() => {
  'use strict';
  const KEY = 'aburto_campaign_v1';
  const params = new URLSearchParams(location.search);
  const fresh = {
    source: String(params.get('utm_source') || '').slice(0, 100),
    campaign: String(params.get('utm_campaign') || '').slice(0, 100),
    medium: String(params.get('utm_medium') || '').slice(0, 100),
  };
  try {
    if (fresh.source || fresh.campaign || fresh.medium) {
      sessionStorage.setItem(KEY, JSON.stringify(fresh));
    }
  } catch { /* Attribution storage may be disabled by the browser. */ }
  function getCampaign() {
    const live = new URLSearchParams(location.search);
    let stored = {};
    try { stored = JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; } catch {}
    return {
      source: String(live.get('utm_source') || stored.source || '').slice(0, 100),
      campaign: String(live.get('utm_campaign') || stored.campaign || '').slice(0, 100),
      medium: String(live.get('utm_medium') || stored.medium || '').slice(0, 100),
    };
  }
  window.AbProAnalytics = Object.freeze({ getCampaign });
})();
