/* =========================================
   ANALYTICS / TRACKING
   Μεταφέρθηκε από το main.js
========================================= */

/* =========================================
   1. CORE SETTINGS & TRACKING
   ========================================= */
const GA_MEASUREMENT_ID = 'G-LHQ9SHKY6J';
const TRACKED_OFFERS = Object.freeze({
    vodaChoiceModal: 'Επιλογή Vodafone CU',
    novaChoiceModal: 'Επιλογή NOVA Q',
    vodaModal: 'Vodafone CU',
    novaModal: 'NOVA Q',
    novaLinePhone: 'Σταθερό και Internet',
    internetChoiceModal: 'Επιλογή Σταθερής & Internet',
    vodafoneFixedModal: 'Vodafone Σταθερή & Internet',
    novaEonModal: 'NOVA EON TV',
    gprotasisModal: 'GProtasis',
});

function loadAllTracking() {
    if (window.trackingLoaded) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () {
        window.dataLayer.push(arguments);
    };

    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.async = true;
    document.head.appendChild(script);

    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID, {
        anonymize_ip: true,
        send_page_view: false,
    });
    window.trackingLoaded = true;
    trackEvent('page_view', {
        page_title: document.title,
        page_location: window.location.href,
        page_path: window.location.pathname,
    });
}

function hasAnalyticsConsent() {
    return localStorage.getItem('cookieConsent') === 'accepted';
}

function trackEvent(eventName, params = {}, legacyLabel, legacyParams = {}) {
    let normalizedEventName = eventName;
    let normalizedParams = params;

    if (typeof params === 'string') {
        normalizedEventName = params;
        normalizedParams = {
            event_category: eventName,
            event_label: legacyLabel,
            ...legacyParams,
        };
    }

    if (!hasAnalyticsConsent() || typeof window.gtag !== 'function') return;

    window.gtag('event', normalizedEventName, normalizedParams || {});
}

function getOfferName(modalId) {
    return TRACKED_OFFERS[modalId] || '';
}

function getOpenOfferContext() {
    const openOffer = Object.keys(TRACKED_OFFERS).find((modalId) => {
        const modal = document.getElementById(modalId);
        return modal && !modal.classList.contains('hidden');
    });

    return openOffer ? { offer_id: openOffer, offer_name: getOfferName(openOffer) } : {};
}

function getOpenTrackedModalId() {
    return Object.keys(TRACKED_OFFERS).find((modalId) => {
        const modal = document.getElementById(modalId);
        return modal && !modal.classList.contains('hidden');
    }) || '';
}
