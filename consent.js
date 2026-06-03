/* Entropy — website analytics consent (Google Consent Mode v2)
   Single source of truth: loaded once per page via <script src="/consent.js"></script>
   in <head>. Sets consent to denied by default (no cookies on load), loads the
   Google tag, then either auto-grants outside consent-required regions or shows a
   banner inside the EU/EEA/UK/Switzerland. */
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

  /* Load the Google tag. It honours the denied default above and stays cookieless
     until analytics_storage is granted. */
  var tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(tag);

  function grant() { gtag('consent', 'update', { analytics_storage: 'granted' }); }
  function remember(v) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {}
  }
  function recall() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { return null; }
  }

  /* Lets a "Review my cookie choice" control re-open the banner from any page. */
  window.ecConsentReset = function () {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    location.reload();
  };

  var prior = recall();
  if (prior) {
    if (prior.v === 'granted') grant();
    return; /* already decided — no banner */
  }

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
        showBanner();       /* consent required, or region unknown (fail safe) */
      }
    })
    .catch(function () { showBanner(); });

  function showBanner() {
    if (document.getElementById('ec-consent')) return;

    var css = document.createElement('style');
    css.textContent =
      '#ec-consent{position:fixed;left:1rem;right:1rem;bottom:1rem;z-index:9999;max-width:540px;margin:0 auto;' +
      'background:var(--panel,#181c26);color:var(--text,#eceef4);border:1px solid var(--border-strong,rgba(255,255,255,.14));' +
      'border-radius:14px;padding:1.05rem 1.2rem;box-shadow:0 12px 44px rgba(0,0,0,.5);' +
      'font-family:"Source Sans 3",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.6;' +
      'opacity:0;transform:translateY(10px);transition:opacity .25s,transform .25s}' +
      '#ec-consent.in{opacity:1;transform:none}' +
      '#ec-consent p{margin:0 0 .85rem;font-size:.92rem;color:#c7cbd8}' +
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

    var box = document.createElement('div');
    box.id = 'ec-consent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Analytics consent');
    box.innerHTML =
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
      remember('denied'); dismiss();
    });
  }
})();
