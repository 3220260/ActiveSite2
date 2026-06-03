/* =========================================
   Mobile offers renderer
   Uses SYNETELAS_MOBILE_OFFERS and keeps compatibility with existing delegated modal handlers.
========================================= */
(function () {
  const THEMES = Object.freeze({
    red: Object.freeze({
      bg: 'bg-red-600',
      hoverBg: 'hover:bg-red-700',
    }),
    blue: Object.freeze({
      bg: 'bg-blue-600',
      hoverBg: 'hover:bg-blue-700',
    }),
  });

  function getOffers() {
    return Array.isArray(window.SYNETELAS_MOBILE_OFFERS)
      ? window.SYNETELAS_MOBILE_OFFERS
      : [];
  }

  function createProcedureButton(offer, procedure) {
    const theme = THEMES[offer.color] || THEMES.blue;

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.modalClose = offer.choiceModalId;
    button.dataset.modalTarget = procedure.modalId || offer.processModalId;
    button.dataset.openTabShow = procedure.show;
    button.dataset.openTabHide = procedure.hide;
    button.dataset.openTabActive = procedure.active;
    button.dataset.openTabInactive = procedure.inactive;
    button.textContent = procedure.label;

    if (procedure.style === 'brand') {
      button.className = `w-full min-h-[72px] px-5 py-5 ${theme.bg} text-white rounded-2xl font-black text-sm md:text-base ${theme.hoverBg} shadow-lg transition flex items-center justify-center text-center`;
    } else {
      button.className = 'w-full min-h-[72px] px-5 py-5 bg-slate-800 text-white rounded-2xl font-black text-sm md:text-base hover:bg-slate-900 shadow-lg transition flex items-center justify-center text-center';
    }

    return button;
  }

  function renderChoiceModalOptions() {
    getOffers().forEach((offer) => {
      const targetId = offer.id === 'vodafone-cu' ? 'vodaChoiceOptions' : 'novaChoiceOptions';
      const target = document.getElementById(targetId);
      if (!target) return;

      target.textContent = '';
      offer.procedures.forEach((procedure) => {
        target.appendChild(createProcedureButton(offer, procedure));
      });
    });
  }

  function renderMobileOffers() {
    renderChoiceModalOptions();
  }

  window.renderMobileOffers = renderMobileOffers;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderMobileOffers, { once: true });
  } else {
    renderMobileOffers();
  }
})();
