/* Entropy — website analytics consent (Google Consent Mode v2)
   Loaded once per page via <script src="/consent.js"></script> in <head>.
   Consent defaults to denied (no cookies on load), then either auto-grants
   outside consent-required regions or shows an accept/decline banner inside
   the EU/EEA/UK/Switzerland. The banner can also be re-opened from any page
   via ecConsentManage() / ecConsentReset() so visitors can change their mind. */
(function () {
  var GA_ID = 'G-SDYXJ6EC4K';
  var STORE_KEY = 'ec_consent_v1';

  /* Regions where prior opt-in consent is required before setting analytics cookies. */
  var CONSENT_REQUIRED = [
    'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT',
    'LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE', /* EU 27 */
    'IS','LI','NO',                                              /* EEA */
    'GB','CH'                                                    /* UK + Switzerland */
  ];

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }

  /* Deny everything until a choice is made — nothing is stored on the device yet. */
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500
  });
  gtag('js', new Date());
  gtag('config', GA_ID);

  /* Load the Google tag. It honours the denied default and stays cookieless until granted. */
  var tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(tag);

  function remember(v) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {}
  }
  function recall() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { return null; }
  }
  function currentChoice() {
    var p = recall();
    return p && p.v ? p.v : 'unset';
  }

  function grant() { gtag('consent', 'update', { analytics_storage: 'granted' }); }

  function deny() {
    gtag('consent', 'update', { analytics_storage: 'denied' });
    clearGaCookies();
  }

  /* Best-effort removal of any _ga cookies already set, so "Decline" is a true opt-out. */
  function clearGaCookies() {
    var host = location.hostname;
    var domains = ['', host, '.' + host];
    var parts = host.split('.');
    if (parts.length > 2) { domains.push('.' + parts.slice(-2).join('.')); }
    document.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (name.indexOf('_ga') === 0) {
        domains.forEach(function (d) {
          document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + (d ? '; domain=' + d : '');
        });
      }
    });
  }

  /* Re-open the banner on demand from any page (e.g. the "Review my cookie choice"
     button on the cookies page). Works in every region. */
  window.ecConsentManage = function () { showBanner(true); };
  window.ecConsentReset = window.ecConsentManage; /* backwards-compatible alias */

  var prior = recall();
  if (prior) {
    if (prior.v === 'granted') grant();
    /* a choice already exists — no banner on load */
  } else {
    /* No prior choice: decide by region using Cloudflare's edge trace. */
    fetch('/cdn-cgi/trace')
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var m = t.match(/\bloc=([A-Z]{2})\b/);
        var loc = m ? m[1] : null;
        if (loc && CONSENT_REQUIRED.indexOf(loc) === -1) {
          grant();            /* outside consent-required regions: enable, no banner */
          remember('granted');
        } else {
          showBanner(false);  /* consent required, or region unknown (fail safe) */
        }
      })
      .catch(function () { showBanner(false); });
  }

  function injectStyle() {
    if (document.getElementById('ec-consent-style')) return;
    var css = document.createElement('style');
    css.id = 'ec-consent-style';
    css.textContent =
      '#ec-consent{position:fixed;left:1rem;right:1rem;bottom:1rem;z-index:9999;max-width:540px;margin:0 auto;' +
      'background:var(--panel,#181c26);color:var(--text,#eceef4);border:1px solid var(--border-strong,rgba(255,255,255,.14));' +
      'border-radius:14px;padding:1.05rem 1.2rem;box-shadow:0 12px 44px rgba(0,0,0,.5);' +
      'font-family:"Source Sans 3",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.6;' +
      'opacity:0;transform:translateY(10px);transition:opacity .25s,transform .25s}' +
      '#ec-consent.in{opacity:1;transform:none}' +
      '#ec-consent p{margin:0 0 .85rem;font-size:.92rem;color:#c7cbd8}' +
      '#ec-consent .ec-state{font-size:.82rem;color:var(--muted,#878da0);margin-bottom:.5rem}' +
      '#ec-consent .ec-state strong{color:#fff;font-weight:600}' +
      '#ec-consent a{color:var(--accent,#64b4ff);text-decoration:none}' +
      '#ec-consent a:hover{text-decoration:underline}' +
      '#ec-consent .row{display:flex;gap:.6rem;justify-content:flex-end;flex-wrap:wrap}' +
      '#ec-consent button{font:inherit;font-size:.9rem;font-weight:500;cursor:pointer;border-radius:9px;' +
      'padding:.55rem 1.15rem;border:1px solid var(--border-strong,rgba(255,255,255,.14))}' +
      '#ec-consent .decline{background:transparent;color:#c7cbd8}' +
      '#ec-consent .decline:hover{background:var(--panel-2,#1f2430);color:#fff}' +
      '#ec-consent .accept{background:var(--accent,#64b4ff);color:#0a1422;border-color:var(--accent,#64b4ff)}' +
      '#ec-consent .accept:hover{background:#7cc2ff}';
    document.head.appendChild(css);
  }

  function showBanner(forced) {
    if (document.getElementById('ec-consent')) return;
    injectStyle();

    var box = document.createElement('div');
    box.id = 'ec-consent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Analytics consent');

    var stateLine = '';
    if (forced) {
      var choice = currentChoice();
      var label = choice === 'granted' ? 'Analytics on' : choice === 'denied' ? 'Analytics off' : 'Not set yet';
      stateLine = '<p class="ec-state">Current setting: <strong>' + label + '</strong></p>';
    }

    box.innerHTML = stateLine +
      '<p>We use Google Analytics to see how many people visit and where they come from. ' +
      'No ads, no profiling. Details in our <a href="/privacy-policy/website">website privacy &amp; cookies</a> notice.</p>' +
      '<div class="row">' +
      '<button class="decline" type="button">Decline</button>' +
      '<button class="accept" type="button">Accept</button>' +
      '</div>';
    document.body.appendChild(box);
    requestAnimationFrame(function () { box.classList.add('in'); });

    function dismiss() {
      box.classList.remove('in');
      setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 260);
    }
    box.querySelector('.accept').addEventListener('click', function () {
      grant(); remember('granted'); dismiss();
    });
    box.querySelector('.decline').addEventListener('click', function () {
      deny(); remember('denied'); dismiss();
    });
  }
})();
