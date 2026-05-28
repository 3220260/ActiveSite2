const ASSISTANT_CHAT_URL = 'https://chat-kj4xqngk0-built-to-fail-inc.vercel.app/#';
const wizardStepViewedKeys = new Set();
const wizardCompletedKeys = new Set();
let assistantChatPreviousFocus = null;
let activeCategory = 'all';
let activeSearchQuery = '';

function getFileName(path) {
    return (path || '').split('/').pop() || path || 'unknown';
}

function startOfferView(modalId, options = {}) {
    const offerName = getOfferName(modalId);
    if (!offerName || activeOfferViews[modalId]) return;

    activeOfferViews[modalId] = Date.now();
    if (options.trackOpen !== false) {
        trackEvent('Offer Engagement', 'offer_open', offerName, {
            offer_id: modalId,
            offer_name: offerName,
        });
    }
}

function stopOfferView(modalId, options = {}) {
    const offerName = getOfferName(modalId);
    const startedAt = activeOfferViews[modalId];
    if (!offerName || !startedAt) return;

    const seconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    delete activeOfferViews[modalId];

    trackEvent('Offer Engagement', 'offer_close', offerName, {
        offer_id: modalId,
        offer_name: offerName,
        engagement_time_sec: seconds,
        ...(options.beacon ? { transport_type: 'beacon' } : {}),
    });

    if (seconds > 0) {
        trackEvent('Offer Engagement', 'offer_time_spent', offerName, {
            offer_id: modalId,
            offer_name: offerName,
            engagement_time_sec: seconds,
            value: seconds,
            ...(options.beacon ? { transport_type: 'beacon' } : {}),
        });
    }
}

function stopAllOfferViews(options = {}) {
    Object.keys(activeOfferViews).forEach((modalId) => stopOfferView(modalId, options));
}

function resumeOpenOfferViews() {
    Object.keys(TRACKED_OFFERS).forEach((modalId) => {
        const modal = document.getElementById(modalId);
        if (modal && !modal.classList.contains('hidden')) startOfferView(modalId, { trackOpen: false });
    });
}

function getOfferCardContext(card) {
    const modalId = card?.dataset?.modalTarget || card?.querySelector?.('[data-modal-target]')?.dataset?.modalTarget || '';
    const offerName = card?.dataset?.offer || getOfferName(modalId);
    const category = card?.dataset?.category || '';
    return offerName ? { offer_id: modalId || offerName, offer_name: offerName, category } : null;
}

function startOfferCardView(card) {
    const context = getOfferCardContext(card);
    if (!context || offerCardViewStarts.has(card) || hasOpenBlockingLayer()) return;
    offerCardViewStarts.set(card, Date.now());

    if (!offerCardViewed.has(context.offer_id)) {
        offerCardViewed.add(context.offer_id);
        trackEvent('offer_view', context);
    }
}

function stopOfferCardView(card, options = {}) {
    const context = getOfferCardContext(card);
    const startedAt = offerCardViewStarts.get(card);
    if (!context || !startedAt) return;

    offerCardViewStarts.delete(card);
    const seconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    if (seconds < MIN_CARD_VIEW_SECONDS) return;

    trackEvent('offer_card_time_spent', {
        ...context,
        engagement_time_sec: seconds,
        value: seconds,
        ...(options.beacon ? { transport_type: 'beacon' } : {}),
    });
}

function stopAllOfferCardViews(options = {}) {
    Array.from(offerCardViewStarts.keys()).forEach((card) => stopOfferCardView(card, options));
}

function isElementMostlyVisible(element) {
    const rect = element.getBoundingClientRect();
    const visibleWidth = Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
    const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
    const visibleArea = Math.max(0, visibleWidth) * Math.max(0, visibleHeight);
    const totalArea = Math.max(1, rect.width * rect.height);
    return visibleArea / totalArea >= 0.5;
}

function refreshVisibleOfferCards() {
    if (hasOpenBlockingLayer()) return;
    trackedOfferCards.forEach((card) => {
        if (isElementMostlyVisible(card)) startOfferCardView(card);
        else stopOfferCardView(card);
    });
}

function initializeOfferCardTracking() {
    trackedOfferCards = Array.from(document.querySelectorAll('[data-offer-card]'));
    if (!trackedOfferCards.length || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.intersectionRatio >= 0.5) startOfferCardView(entry.target);
            else stopOfferCardView(entry.target);
        });
    }, { threshold: [0, 0.5] });

    trackedOfferCards.forEach((card) => observer.observe(card));
    refreshVisibleOfferCards();
}

function initializeOfferCardReveal() {
    const cards = Array.from(document.querySelectorAll('[data-offer-card]'));
    if (!cards.length || !('IntersectionObserver' in window)) {
        cards.forEach((card) => card.classList.add('is-visible'));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            const index = cards.indexOf(entry.target);
            entry.target.style.transitionDelay = `${Math.min(index * 80, 320)}ms`;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.18 });

    cards.forEach((card) => observer.observe(card));
}

function trackLinkClick(link) {
    const href = link.getAttribute('href') || '';
    const context = getOpenOfferContext();

    if (href.startsWith('assets/docs/')) {
        const documentName = getFileName(href);
        trackEvent('pdf_download', {
            ...context,
            document_name: documentName,
            label: link.dataset.label || documentName,
            offer_name: link.dataset.offer || context.offer_name,
        });
        return;
    }

    if (href.startsWith('tel:')) {
        trackEvent('phone_click', {
            ...context,
            contact_type: 'phone',
            label: link.dataset.label || 'phone',
        });
        return;
    }

    if (href.startsWith('mailto:')) {
        trackEvent('email_click', {
            ...context,
            contact_type: 'email',
            label: link.dataset.label || 'email',
        });
        return;
    }

    if (href.includes('invite.viber.com')) {
        trackEvent('viber_click', {
            destination: 'viber_community',
            label: link.dataset.label || 'Viber Community',
        });
    }
}

/* =========================================
   2. UI FUNCTIONS (MODALS, TOASTS, TABS)
   ========================================= */

// Ειδοποιήσεις (Toasts) - Απαραίτητο για την αντιγραφή IBAN
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function resetSwipeBackTracking() {
    swipeBackTracking = false;
    swipeBackStartX = 0;
    swipeBackStartY = 0;
    swipeBackStartTime = 0;
}

function shouldIgnoreSwipeBackTarget(target) {
    if (!target || !target.closest) return false;

    // Όταν είμαστε μέσα σε οποιοδήποτε modal, το γενικό browser swipe-back
    // δεν πρέπει να τρέχει ποτέ, γιατί στέλνει τον χρήστη στην αρχική/προηγούμενη σελίδα.
    // Τα modals/οδηγοί έχουν δική τους πλοήγηση.
    if (target.closest('.modal-backdrop')) {
        return true;
    }

    // Μην αφήνεις το γενικό swipe-back να δουλεύει μέσα στον Οδηγό Ενεργοποίησης.
    if (target.closest('#vodaModal, #novaModal, #v-port, #v-new, #n-port, #n-new, [data-process-wizard], [data-process-step]')) {
        return true;
    }

    if (target.closest('input, textarea, select, button, a, [role="button"], [contenteditable="true"]')) {
        return true;
    }

    if (target.closest('[data-preview-zoom], [data-preview-reset], [data-copy-text], [data-copy-iban], [data-tab-show]')) {
        return true;
    }

    let node = target;
    while (node && node !== document.body) {
        if (node.scrollWidth > node.clientWidth + 12) {
            const style = window.getComputedStyle(node);
            if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
                return true;
            }
        }

        node = node.parentElement;
    }

    return false;
}

function handleSwipeBackTouchStart(event) {
    if (!event.touches || event.touches.length !== 1) {
        resetSwipeBackTracking();
        return;
    }

    if (imagePreviewPinchDistance > 0 || imagePreviewDragging || (isImagePreviewOpen() && imagePreviewZoom > 1)) {
        resetSwipeBackTracking();
        return;
    }

    if (shouldIgnoreSwipeBackTarget(event.target)) {
        resetSwipeBackTracking();
        return;
    }

    const touch = event.touches[0];

    if (touch.clientX <= SWIPE_BACK_EDGE_GUARD || touch.clientX >= window.innerWidth - SWIPE_BACK_EDGE_GUARD) {
        resetSwipeBackTracking();
        return;
    }

    swipeBackStartX = touch.clientX;
    swipeBackStartY = touch.clientY;
    swipeBackStartTime = Date.now();
    swipeBackTracking = true;
}

function handleProcessWizardSwipeBack() {
    if (
        typeof PROCESS_WIZARDS === 'undefined' ||
        typeof processWizardState === 'undefined' ||
        typeof showProcessWizardStep !== 'function'
    ) {
        return false;
    }

    const activeProcess = Array.from(document.querySelectorAll('#v-port, #v-new, #n-port, #n-new')).find((element) => {
        const modal = element.closest('.modal-backdrop');

        return modal &&
            !modal.classList.contains('hidden') &&
            !element.classList.contains('hidden') &&
            PROCESS_WIZARDS[element.id];
    });

    if (!activeProcess) return false;

    const currentIndex = processWizardState[activeProcess.id] || 0;

    if (currentIndex > 0) {
        showProcessWizardStep(activeProcess.id, currentIndex - 1);
        return true;
    }

    const currentModal = activeProcess.closest('.modal-backdrop');
    const choiceModalId = activeProcess.id.startsWith('v-') ? 'vodaChoiceModal' : 'novaChoiceModal';

    if (currentModal && document.getElementById(choiceModalId)) {
        closeModal(currentModal.id, false);
        openModal(choiceModalId);
        return true;
    }

    return false;
}

function handleSwipeBackTouchEnd(event) {
    if (!swipeBackTracking || !event.changedTouches || event.changedTouches.length !== 1) {
        resetSwipeBackTracking();
        return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - swipeBackStartX;
    const deltaY = Math.abs(touch.clientY - swipeBackStartY);
    const duration = Date.now() - swipeBackStartTime;

    resetSwipeBackTracking();

    if (
        deltaX >= SWIPE_BACK_MIN_DISTANCE &&
        deltaY <= SWIPE_BACK_MAX_VERTICAL_DISTANCE &&
        duration <= SWIPE_BACK_MAX_DURATION_MS
    ) {
        trackEvent('Navigation', 'swipe_back', 'touch_gesture', {
            direction: 'right',
        });

        if (handleProcessWizardSwipeBack()) {
            return;
        }

        // Extra ασφάλεια: αν υπάρχει ανοιχτό modal, μη χρησιμοποιείς browser history back.
        // Αλλιώς σε Safari/iPhone μπορεί να πετάξει τον χρήστη στην αρχική.
        if (document.querySelector('.modal-backdrop:not(.hidden)')) {
            return;
        }

        window.history.back();
    }
}


const PROCESS_WIZARDS = Object.freeze({
    'v-port': { title: 'Vodafone CU', subtitle: 'Φορητότητα', color: 'red' },
    'v-new': { title: 'Vodafone CU', subtitle: 'Νέος αριθμός', color: 'red' },
    'n-port': { title: 'NOVA Q', subtitle: 'Φορητότητα', color: 'orange' },
    'n-new': { title: 'NOVA Q', subtitle: 'Νέος αριθμός', color: 'orange' },
});

const processWizardState = {};
function getProcessWizardTheme(color) {
    if (color === 'blue') {
        return {
            border: 'border-blue-100',
            bg: 'bg-blue-50',
            text: 'text-blue-700',
            button: 'bg-blue-600 hover:bg-blue-700',
            dotActive: 'bg-blue-600',
            dotInactive: 'bg-slate-300',
        };
    }

    if (color === 'orange') {
        return {
            border: 'border-orange-100',
            bg: 'bg-orange-50',
            text: 'text-orange-700',
            button: 'bg-orange-500 hover:bg-orange-600',
            dotActive: 'bg-orange-500',
            dotInactive: 'bg-slate-300',
        };
    }

    return {
        border: 'border-red-100',
        bg: 'bg-red-50',
        text: 'text-red-700',
        button: 'bg-red-600 hover:bg-red-700',
        dotActive: 'bg-red-600',
        dotInactive: 'bg-slate-300',
    };
}

function makeEl(tag, className = '', text = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
}

function getProcessTimeline(container) {
    return Array.from(container.children).find((child) => child.classList.contains('relative'));
}

function getProcessSteps(container) {
    return Array.from(container.querySelectorAll('[data-process-step]'));
}

function getProcessStepTitle(step, index) {
    return step.dataset.stepTitle || `Βήμα ${index + 1}`;
}

function moveDownloadBlockToPreparation(container, firstStep) {
    if (!container || !firstStep) return;
    if (firstStep.querySelector('[data-downloads-moved="true"]')) return;

    const downloadBlocks = Array.from(container.querySelectorAll('div, section, footer')).filter((element) => {
        if (element === container || firstStep.contains(element)) return false;

        const text = element.textContent.replace(/\s+/g, ' ').trim();

        return (
            text.includes('Κατεβάστε τα') ||
            text.includes('Κατεβάστε το') ||
            text.includes('Κατεβάστε την')
        ) && element.querySelector('a[href]');
    });

    if (!downloadBlocks.length) return;

    const downloadBlock = downloadBlocks.sort((a, b) => a.textContent.length - b.textContent.length)[0];
    const preparationCard = firstStep.querySelector('h4')?.parentElement || firstStep;

    downloadBlock.dataset.downloadsMoved = 'true';
    downloadBlock.classList.remove('sticky', 'bottom-0', 'z-20');
    downloadBlock.classList.add('mt-5', 'pt-4', 'border-t', 'border-slate-100');

    downloadBlock.innerHTML = downloadBlock.innerHTML
        .replaceAll('Κατεβάστε τα 3 απαραίτητα εντυπα:', 'Κατέβασε τα έγγραφα:')
        .replaceAll('Κατεβάστε τα 2 απαραίτητα εντυπα:', 'Κατέβασε τα έγγραφα:')
        .replaceAll('Κατεβάστε το 1 απαραίτητο εντυπο:', 'Κατέβασε το έγγραφο:')
        .replaceAll('Κατεβάστε τα 3 απαραίτητα έντυπα:', 'Κατέβασε τα έγγραφα:')
        .replaceAll('Κατεβάστε τα 2 απαραίτητα έντυπα:', 'Κατέβασε τα έγγραφα:')
        .replaceAll('Κατεβάστε το 1 απαραίτητο έντυπο:', 'Κατέβασε το έγγραφο:');

    const documentLinks = Array.from(downloadBlock.querySelectorAll('a[href]'));

    downloadBlock.textContent = '';
    downloadBlock.className = 'mt-5 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 shadow-sm';
    downloadBlock.dataset.downloadsMoved = 'true';

    const downloadTitle = makeEl(
        'p',
        'text-sm font-black text-amber-900 mb-3 flex items-center gap-2',
        'Πρώτα κατέβασε και συμπλήρωσε αυτά:'
    );

    const downloadIcon = document.createElement('i');
    downloadIcon.className = 'fa-solid fa-download text-amber-600';
    downloadTitle.prepend(downloadIcon);

    const linksGrid = makeEl(
        'div',
        'flex flex-wrap justify-center items-start gap-4'
    );

    documentLinks.forEach((link) => {
        link.classList.remove('text-xs', 'w-full', 'min-h-[46px]');
        link.classList.add(
            'w-[150px]',
            'h-[150px]',
            'flex',
            'flex-col',
            'items-center',
            'justify-center',
            'text-center',
            'text-[11px]',
            'md:text-xs',
            'shadow-sm',
            'rounded-full'
        );

        linksGrid.appendChild(link);
    });

    const nextHint = makeEl(
        'p',
        'mt-3 text-xs font-bold text-slate-600',
        'Μετά πάτα “Επόμενο”.'
    );

    downloadBlock.appendChild(downloadTitle);
    downloadBlock.appendChild(linksGrid);
    downloadBlock.appendChild(nextHint);

    preparationCard.appendChild(downloadBlock);
}

function createProcessWizard(containerId, config, theme, steps) {
    const isVoda = containerId.startsWith('v-');
    const modalId = isVoda ? 'vodaModal' : 'novaModal';
    const choiceModalId = isVoda ? 'vodaChoiceModal' : 'novaChoiceModal';

    const companyBadgeClass = isVoda
        ? 'bg-red-600 text-white border-red-300'
        : 'bg-orange-500 text-blue-700 border-orange-300';

    const closeButtonClass = isVoda
        ? 'liquid-close w-10 h-10 rounded-full bg-red-600 text-white text-2xl font-black flex items-center justify-center hover:bg-red-700 transition border-2 border-red-300 shadow-md'
        : 'liquid-close w-10 h-10 rounded-full bg-orange-100 text-blue-700 text-2xl font-black flex items-center justify-center hover:bg-orange-200 transition border-2 border-orange-300 shadow-md';

    const wizard = makeEl(
        'div',
        `process-wizard-sticky mb-4 rounded-2xl border ${theme.border} ${theme.bg} p-3 md:p-5 shadow-sm`
    );

    wizard.dataset.processWizard = 'true';
    wizard.dataset.processContainer = containerId;

    const header = makeEl(
        'div',
        'flex items-start justify-between gap-3 mb-3'
    );

    const left = makeEl('div', 'min-w-0');

    const label = makeEl(
        'p',
        'text-[10px] md:text-xs font-black uppercase tracking-[0.18em] text-slate-500',
        'ΟΔΗΓΟΣ ΕΝΕΡΓΟΠΟΙΗΣΗΣ'
    );

    const stepTitle = makeEl(
        'h4',
        'mt-1 text-base md:text-lg font-black text-slate-900 leading-tight'
    );
    stepTitle.dataset.processStepTitle = '';
    stepTitle.textContent = getProcessStepTitle(steps[0], 0);

    left.appendChild(label);
    left.appendChild(stepTitle);

    const right = makeEl('div', 'flex items-center gap-2 shrink-0');

    const companyBadge = makeEl(
        'span',
        `hidden sm:inline-flex rounded-full px-3 py-1 text-xs font-black border-2 shadow-sm ${companyBadgeClass}`,
        config.title
    );
    companyBadge.dataset.processMainTitle = '';

    const closeButton = makeEl(
        'button',
        closeButtonClass,
        '×'
    );
    closeButton.type = 'button';
    closeButton.dataset.modalClose = modalId;
    closeButton.dataset.modalTarget = choiceModalId;
    closeButton.setAttribute('aria-label', 'Πίσω στην επιλογή διαδικασίας');

    right.appendChild(companyBadge);
    right.appendChild(closeButton);

    header.appendChild(left);
    header.appendChild(right);

    const mobileBadge = makeEl(
        'div',
        `sm:hidden inline-flex w-fit rounded-full px-3 py-1 text-xs font-black border-2 shadow-sm mb-3 ${companyBadgeClass}`,
        config.title
    );

    const counter = makeEl(
        'div',
        'mb-3 text-xs md:text-sm font-black text-slate-500'
    );

    counter.append('Βήμα ');
    const current = makeEl('span', '', '1');
    current.dataset.processCurrent = '';
    counter.appendChild(current);

    counter.append(' από ');

    const total = makeEl('span', '', String(steps.length));
    total.dataset.processTotal = '';
    counter.appendChild(total);

    const dots = makeEl(
        'div',
        'flex items-center gap-2 md:gap-3'
    );
    dots.dataset.processDots = '';

    wizard.appendChild(header);
    wizard.appendChild(mobileBadge);
    wizard.appendChild(counter);
    wizard.appendChild(dots);

    return wizard;
}

function buildProcessMailtoHref(config) {
    const subject = `Δικαιολογητικά ${config.title} - ${config.subtitle}`;
    const body = `Καλησπέρα σας,

Σας αποστέλλω τα απαραίτητα δικαιολογητικά για ${config.title} - ${config.subtitle}.

Ονοματεπώνυμο:
Τηλέφωνο επικοινωνίας:`;

    return `mailto:synetelas2011@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function enhanceProcessEmailActions(container, config) {
    if (!container || !config) return;

    const steps = getProcessSteps(container);

    steps.forEach((step) => {
        if (!step.textContent.includes('synetelas2011@gmail.com')) return;
        if (step.querySelector('[data-email-actions="true"]')) return;

        const card = step.querySelector('h4')?.parentElement || step;

        const emailBox = makeEl(
            'div',
            'mt-4 rounded-2xl border-2 border-sky-100 bg-sky-50 p-4 shadow-sm'
        );
        emailBox.dataset.emailActions = 'true';

        const title = makeEl(
            'p',
            'text-sm font-black text-sky-900 mb-3 flex items-center gap-2',
            'Αποστολή δικαιολογητικών'
        );

        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-envelope-open-text text-sky-600';
        title.prepend(icon);

        const emailText = makeEl(
            'p',
            'text-xs font-bold text-slate-600 mb-3',
            'Χρησιμοποίησε τα παρακάτω κουμπιά για να αποφύγεις λάθη στο email.'
        );

        const actions = makeEl('div', 'grid grid-cols-1 sm:grid-cols-2 gap-2');

        const copyButton = makeEl(
            'button',
            'inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-sky-200 px-4 py-3 text-xs font-black text-sky-700 hover:bg-sky-100 transition',
            'Αντιγραφή Email'
        );
        copyButton.type = 'button';
        copyButton.dataset.copyEmail = 'synetelas2011@gmail.com';

        const copyIcon = document.createElement('i');
        copyIcon.className = 'fa-solid fa-copy';
        copyButton.prepend(copyIcon);

        const openEmail = makeEl(
            'a',
            'inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-xs font-black text-white hover:bg-sky-700 transition shadow-sm',
            'Άνοιγμα Email'
        );
        openEmail.href = buildProcessMailtoHref(config);

        const openIcon = document.createElement('i');
        openIcon.className = 'fa-solid fa-paper-plane';
        openEmail.prepend(openIcon);

        actions.appendChild(copyButton);
        actions.appendChild(openEmail);

        emailBox.appendChild(title);
        emailBox.appendChild(emailText);
        emailBox.appendChild(actions);

        card.appendChild(emailBox);
    });
}


function ensureProcessWizard(containerId) {
    const container = document.getElementById(containerId);
    const config = PROCESS_WIZARDS[containerId];

    if (!container || !config) return;

    const steps = getProcessSteps(container);
    if (!steps.length) return;

    moveDownloadBlockToPreparation(container, steps[0]);
    enhanceProcessEmailActions(container, config);

    const theme = getProcessWizardTheme(config.color);
    const timeline = getProcessTimeline(container);

    if (timeline) {
        const verticalLine = Array.from(timeline.children).find((child) => child.classList.contains('absolute'));
        if (verticalLine) verticalLine.classList.add('hidden');
    }

    let wizard = Array.from(container.children).find((child) => child.dataset.processWizard === 'true');

    if (!wizard) {
        wizard = createProcessWizard(containerId, config, theme, steps);
        container.prepend(wizard);
    }

    const mainTitle = wizard.querySelector('[data-process-main-title]');
    const subtitle = wizard.querySelector('[data-process-subtitle]');
    const total = wizard.querySelector('[data-process-total]');

    if (mainTitle) mainTitle.textContent = config.title;
    if (subtitle) subtitle.textContent = config.subtitle;
    if (total) total.textContent = steps.length;

    showProcessWizardStep(containerId, processWizardState[containerId] || 0);
}

function updateProcessHeaderStep(containerId, stepIndex, totalSteps, stepTitle) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const titleElement = container.querySelector('[data-process-title]');
    if (!titleElement) return;

    titleElement.textContent = `Βήμα ${stepIndex + 1}/${totalSteps} · ${stepTitle}`;
}

function showProcessWizardStep(containerId, index) {
    const container = document.getElementById(containerId);
    const config = PROCESS_WIZARDS[containerId];

    if (!container || !config) return;

    const steps = getProcessSteps(container);
    if (!steps.length) return;

    const theme = getProcessWizardTheme(config.color);
    const safeIndex = Math.min(Math.max(index, 0), steps.length - 1);

    processWizardState[containerId] = safeIndex;

    steps.forEach((step, stepIndex) => {
        step.classList.toggle('hidden', stepIndex !== safeIndex);
    });

    const wizard = container.querySelector('[data-process-wizard]');
    if (!wizard) return;

    const current = wizard.querySelector('[data-process-current]');
    const stepTitle = wizard.querySelector('[data-process-step-title]');
    const currentStepTitle = getProcessStepTitle(steps[safeIndex], safeIndex);

    if (current) current.textContent = safeIndex + 1;
    if (stepTitle) stepTitle.textContent = currentStepTitle;

    const wizardStepKey = `${containerId}:${safeIndex}`;
    if (!wizardStepViewedKeys.has(wizardStepKey)) {
        wizardStepViewedKeys.add(wizardStepKey);
        trackEvent('wizard_step_view', {
            wizard_id: containerId,
            step_number: safeIndex + 1,
            step_title: currentStepTitle,
            offer_name: config.title,
        });
    }

    if (safeIndex === steps.length - 1 && !wizardCompletedKeys.has(containerId)) {
        wizardCompletedKeys.add(containerId);
        trackEvent('wizard_completed', {
            wizard_id: containerId,
            offer_name: config.title,
        });
    }

    updateProcessHeaderStep(containerId, safeIndex, steps.length, currentStepTitle);

    const dots = wizard.querySelector('[data-process-dots]');
    const prev = container.querySelector('[data-process-prev]');
    const next = container.querySelector('[data-process-next]');

    if (dots) {
        dots.innerHTML = '';

        steps.forEach((_, dotIndex) => {
            const dot = makeEl(
                'span',
                `h-2 flex-1 rounded-full ${dotIndex <= safeIndex ? theme.dotActive : theme.dotInactive}`
            );
            dots.appendChild(dot);
        });
    }

    const stepNav = wizard.querySelector('[data-process-step-nav]');
    if (stepNav) {
        stepNav.innerHTML = '';

        steps.forEach((step, navIndex) => {
            const isActive = navIndex === safeIndex;
            const stepButton = makeEl(
                'button',
                `process-step-scroll-button ${isActive ? 'is-active' : ''}`,
                `${navIndex + 1}. ${getProcessStepTitle(step, navIndex)}`
            );

            stepButton.type = 'button';
            stepButton.dataset.processGo = String(navIndex);
            stepNav.appendChild(stepButton);
        });

        const activeButton = stepNav.querySelector('.process-step-scroll-button.is-active');
        if (activeButton) {
            activeButton.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
    }

    if (prev) prev.disabled = safeIndex === 0;

    if (next) {
        next.disabled = safeIndex === steps.length - 1;
        next.textContent = safeIndex === steps.length - 1 ? 'Τέλος' : 'Επόμενο';
    }
}

function resetProcessWizard(containerId) {
    if (!PROCESS_WIZARDS[containerId]) return;

    processWizardState[containerId] = 0;
    ensureProcessWizard(containerId);
    showProcessWizardStep(containerId, 0);
}


/* --- Mobile swipe navigation for activation guide --- */
let processSwipeStartX = 0;
let processSwipeStartY = 0;
let processSwipeStartTime = 0;
let processSwipeContainerId = null;

function getProcessContainerFromTarget(target) {
    const processRoot = target?.closest?.('#v-port, #v-new, #n-port, #n-new');
    return processRoot?.id || null;
}

function shouldIgnoreProcessSwipe(target) {
    if (!target || !target.closest) return false;

    return Boolean(target.closest(
        'button, a, input, textarea, select, [role="button"], [contenteditable="true"], [data-preview-src], [data-copy-iban], [data-copy-email]'
    ));
}

function handleProcessSwipeStart(event) {
    if (!event.touches || event.touches.length !== 1) return;
    if (window.innerWidth > 768) return;
    if (shouldIgnoreProcessSwipe(event.target)) return;

    const containerId = getProcessContainerFromTarget(event.target);
    if (!containerId || !PROCESS_WIZARDS[containerId]) return;

    const touch = event.touches[0];

    processSwipeStartX = touch.clientX;
    processSwipeStartY = touch.clientY;
    processSwipeStartTime = Date.now();
    processSwipeContainerId = containerId;
}

function handleProcessSwipeEnd(event) {
    if (!processSwipeContainerId) return;
    if (window.innerWidth > 768) {
        processSwipeContainerId = null;
        return;
    }

    const touch = event.changedTouches && event.changedTouches[0];
    if (!touch) {
        processSwipeContainerId = null;
        return;
    }

    const dx = touch.clientX - processSwipeStartX;
    const dy = touch.clientY - processSwipeStartY;
    const duration = Date.now() - processSwipeStartTime;

    const horizontalEnough = Math.abs(dx) > 70;
    const verticalSmall = Math.abs(dy) < 65;
    const fastEnough = duration < 900;

    if (horizontalEnough && verticalSmall && fastEnough) {
        const currentIndex = processWizardState[processSwipeContainerId] || 0;
        const container = document.getElementById(processSwipeContainerId);
        const total = getProcessSteps(container).length;

        if (dx < 0 && currentIndex < total - 1) {
            showProcessWizardStep(processSwipeContainerId, currentIndex + 1);
        }

        if (dx > 0 && currentIndex > 0) {
            showProcessWizardStep(processSwipeContainerId, currentIndex - 1);
        }
    }

    processSwipeContainerId = null;
}


function activateVisibleProcessWizard(root) {
    if (!root) return;

    const activeProcess = Array.from(root.querySelectorAll('#v-port, #v-new, #n-port, #n-new')).find((element) => {
        return !element.classList.contains('hidden');
    });

    if (activeProcess) resetProcessWizard(activeProcess.id);
}

function getExplicitTrackParams(target) {
    return {
        label: target.dataset.label || target.textContent.trim().replace(/\s+/g, ' ').slice(0, 80),
        offer_name: target.dataset.offer || undefined,
        category: target.dataset.category || undefined,
    };
}

function shouldSkipExplicitTracking(target) {
    if (!target) return true;
    const link = target.closest('a[href]');
    if (!link) return false;

    const href = link.getAttribute('href') || '';
    return href.startsWith('tel:') ||
        href.startsWith('mailto:') ||
        href.startsWith('assets/docs/') ||
        href.includes('invite.viber.com');
}

function getOfferCardSearchIndex(card) {
    if (!card) return '';
    if (card.dataset.searchIndex) return card.dataset.searchIndex;

    const title = card.querySelector('h3')?.textContent || '';
    const offer = card.dataset.offer || '';
    const category = card.dataset.category || '';
    const cardText = card.textContent || '';
    const index = `${title} ${offer} ${category} ${cardText}`
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    card.dataset.searchIndex = index;
    return index;
}

function updateOfferVisibility() {
    const normalizedQuery = (activeSearchQuery || '').toLowerCase().trim();

    document.querySelectorAll('[data-offer-card]').forEach((card) => {
        const matchesCategory = activeCategory === 'all' || card.dataset.category === activeCategory;
        const matchesQuery = !normalizedQuery || getOfferCardSearchIndex(card).includes(normalizedQuery);
        const shouldShow = matchesCategory && matchesQuery;

        card.hidden = !shouldShow;
        if (!shouldShow) stopOfferCardView(card);
    });

    requestAnimationFrame(refreshVisibleOfferCards);
}

function initializeOfferSearch() {
    const searchInput = document.getElementById('offerSearchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', (event) => {
        activeSearchQuery = event.target.value || '';
        updateOfferVisibility();
    });
}

function applyOfferFilter(category, source = null) {
    const normalizedCategory = category || 'all';
    activeCategory = normalizedCategory;

    document.querySelectorAll('[data-category-filter]').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.categoryFilter === normalizedCategory);
    });

    updateOfferVisibility();

    trackEvent('category_filter_click', {
        category: normalizedCategory,
        label: source?.dataset?.label || normalizedCategory,
    });

    if (source && !source.closest('.offer-filter-bar')) {
        document.getElementById('offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    requestAnimationFrame(refreshVisibleOfferCards);
}

function getAssistantChatModal() {
    return document.getElementById('assistantChatModal');
}

function isAssistantChatOpen() {
    const modal = getAssistantChatModal();
    return Boolean(modal && !modal.classList.contains('hidden'));
}

function getAssistantChatFocusable() {
    const modal = getAssistantChatModal();
    if (!modal) return [];

    return Array.from(modal.querySelectorAll(
        'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'
    )).filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null);
}

function focusAssistantChatStart() {
    const focusable = getAssistantChatFocusable();
    const closeButton = document.querySelector('#assistantChatModal [data-chat-close]:not([aria-hidden="true"])');
    (closeButton || focusable[0])?.focus?.();
}

function openAssistantChat() {
    const modal = getAssistantChatModal();
    if (!modal || isAssistantChatOpen()) return;

    assistantChatPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const iframe = modal.querySelector('iframe[data-src]');
    if (iframe && !iframe.getAttribute('src')) {
        iframe.setAttribute('src', iframe.dataset.src || ASSISTANT_CHAT_URL);
    }

    modal.classList.remove('hidden');
    lockPageScroll();
    trackEvent('chat_open', { label: 'assistant_chat' });
    setTimeout(focusAssistantChatStart, 0);
}

function closeAssistantChat() {
    const modal = getAssistantChatModal();
    if (!modal || modal.classList.contains('hidden')) return;

    modal.classList.add('hidden');
    trackEvent('chat_close', { label: 'assistant_chat' });
    unlockPageScrollIfIdle();

    if (assistantChatPreviousFocus && document.contains(assistantChatPreviousFocus)) {
        assistantChatPreviousFocus.focus();
    }
    assistantChatPreviousFocus = null;
}

function trapAssistantChatFocus(event) {
    if (!isAssistantChatOpen() || event.key !== 'Tab') return false;

    const focusable = getAssistantChatFocusable();
    if (!focusable.length) return false;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return true;
    }

    if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
        return true;
    }

    return false;
}

function enhanceIbanWarnings() {
    document.querySelectorAll('[data-copy-iban]').forEach((button) => {
        if (button.nextElementSibling?.classList?.contains('iban-security-note')) return;

        const warning = document.createElement('p');
        warning.className = 'iban-security-note';
        warning.textContent = 'Πριν από οποιαδήποτε κατάθεση, επιβεβαιώστε τα στοιχεία με τον Συνεταιρισμό.';
        button.insertAdjacentElement('afterend', warning);
    });
}

function initializeFaqTracking() {
    document.querySelectorAll('#faq details').forEach((details) => {
        details.addEventListener('toggle', () => {
            if (!details.open) return;
            const question = details.querySelector('summary span')?.textContent?.trim() || 'FAQ';
            trackEvent('faq_open', { label: question });
        });
    });
}

function initializeLandingStepTracking() {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            const step = entry.target.dataset.wizardStep || '';
            const key = `landing:${step}`;
            if (!wizardStepViewedKeys.has(key)) {
                wizardStepViewedKeys.add(key);
                trackEvent('wizard_step_view', {
                    wizard_id: 'landing_process',
                    step_number: step,
                    step_title: entry.target.querySelector('h3')?.textContent?.trim() || '',
                });
            }

            if (step === '4' && !wizardCompletedKeys.has('landing_process')) {
                wizardCompletedKeys.add('landing_process');
                trackEvent('wizard_completed', { wizard_id: 'landing_process' });
            }
        });
    }, { threshold: 0.55 });

    document.querySelectorAll('[data-wizard-step]').forEach((step) => observer.observe(step));
}

function initializeBottomNavOffersState() {
    const offersSection = document.getElementById('offers');
    const offersNavLink = document.querySelector('.mobile-nav-offers-link');
    if (!offersSection || !offersNavLink || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            offersNavLink.classList.toggle('is-active', entry.isIntersecting);
        });
    }, {
        threshold: 0.01,
        rootMargin: '0px',
    });

    observer.observe(offersSection);
}


function handleDocumentClick(event) {

    const stopTarget = event.target.closest('[data-stop-click]');
    if (stopTarget) event.stopPropagation();

    const chatOpenTarget = event.target.closest('[data-chat-open]');
    if (chatOpenTarget) {
        event.preventDefault();
        openAssistantChat();
        return;
    }

    const chatCloseTarget = event.target.closest('[data-chat-close]');
    if (chatCloseTarget) {
        event.preventDefault();
        closeAssistantChat();
        return;
    }

    const categoryTarget = event.target.closest('[data-category-filter]');
    if (categoryTarget) {
        event.preventDefault();
        applyOfferFilter(categoryTarget.dataset.categoryFilter, categoryTarget);
        return;
    }

    const explicitTrackTarget = event.target.closest('[data-track]');
    if (explicitTrackTarget && !shouldSkipExplicitTracking(explicitTrackTarget)) {
        trackEvent(explicitTrackTarget.dataset.track, getExplicitTrackParams(explicitTrackTarget));
    }

    const linkTarget = event.target.closest('a[href]');
    if (linkTarget) trackLinkClick(linkTarget);

    const actionTarget = event.target.closest('[data-action]');
    if (actionTarget) {
        const action = actionTarget.dataset.action;

        if (action === 'go-home') {
            event.preventDefault();
            goHomeFromHeader();
            return;
        }

        if (action === 'toggle-sidebar') {
            event.preventDefault();
            toggleSidebar();
            return;
        }
    }

    const cookieTarget = event.target.closest('[data-cookie-consent]');
    if (cookieTarget) {
        event.preventDefault();
        handleCookieConsent(cookieTarget.dataset.cookieConsent);
        return;
    }

    const previewSourceTarget = event.target.closest('[data-preview-src]');
    if (previewSourceTarget) {
        event.preventDefault();
        openImagePreview(previewSourceTarget.dataset.previewSrc);
        return;
    }

    const previewZoomTarget = event.target.closest('[data-preview-zoom]');
    if (previewZoomTarget) {
        event.preventDefault();
        zoomImagePreview(Number(previewZoomTarget.dataset.previewZoom));
        return;
    }

    const previewResetTarget = event.target.closest('[data-preview-reset]');
    if (previewResetTarget) {
        event.preventDefault();
        resetImagePreviewZoom();
        return;
    }

    const copyEmailTarget = event.target.closest('[data-copy-email]');
    if (copyEmailTarget) {
        event.preventDefault();

        if (typeof copyToClipboard === 'function') {
            copyToClipboard(copyEmailTarget.dataset.copyEmail, copyEmailTarget);
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(copyEmailTarget.dataset.copyEmail);
            copyEmailTarget.textContent = 'Αντιγράφηκε!';
        }

        return;
    }

    const copyTextTarget = event.target.closest('[data-copy-text]');
    if (copyTextTarget) {
        event.preventDefault();
        trackEvent('payment_copy', {
            ...getOpenOfferContext(),
            copy_type: 'account_name',
        });
        copyToClipboard(copyTextTarget.dataset.copyText, copyTextTarget);
        return;
    }

    const copyIbanTarget = event.target.closest('[data-copy-iban]');
    if (copyIbanTarget) {
        event.preventDefault();
        trackEvent('copy_iban', {
            ...getOpenOfferContext(),
            copy_type: 'iban',
        });
        copyIBAN(copyIbanTarget.dataset.copyIban, copyIbanTarget);
        return;
    }

    const processChangeChoiceTarget = event.target.closest('[data-process-change-choice]');
    if (processChangeChoiceTarget) {
        event.preventDefault();

        const wizard = processChangeChoiceTarget.closest('[data-process-wizard]');
        const containerId = wizard?.dataset.processContainer;
        const activeProcess = containerId ? document.getElementById(containerId) : null;
        const currentModal = activeProcess?.closest('.modal-backdrop');
        const choiceModalId = containerId?.startsWith('v-') ? 'vodaChoiceModal' : 'novaChoiceModal';

        if (currentModal && document.getElementById(choiceModalId)) {
            closeModal(currentModal.id, false);
            openModal(choiceModalId);
        }

        return;
    }

    const processGoTarget = event.target.closest('[data-process-go]');
    if (processGoTarget) {
        event.preventDefault();

        const wizard = processGoTarget.closest('[data-process-wizard]');
        const containerId = wizard?.dataset.processContainer;
        const nextIndex = Number(processGoTarget.dataset.processGo || 0);

        if (containerId && !Number.isNaN(nextIndex)) {
            showProcessWizardStep(containerId, nextIndex);
        }

        return;
    }

    const processWizardTarget = event.target.closest('[data-process-prev], [data-process-next]');
    if (processWizardTarget) {
        event.preventDefault();

        const wizard = processWizardTarget.closest('[data-process-wizard]');
        const containerId = wizard?.dataset.processContainer;

        if (!containerId) return;

        const currentIndex = processWizardState[containerId] || 0;
        const direction = processWizardTarget.matches('[data-process-next]') ? 1 : -1;

        showProcessWizardStep(containerId, currentIndex + direction);
        return;
    }

    const tabTarget = event.target.closest('[data-tab-show]');
    if (tabTarget) {
        event.preventDefault();
        trackEvent('Offer Engagement', 'offer_tab_switch', tabTarget.dataset.tabShow, {
            ...getOpenOfferContext(),
            tab_show: tabTarget.dataset.tabShow,
        });
        switchTab(
            tabTarget.dataset.tabShow,
            tabTarget.dataset.tabHide,
            tabTarget.dataset.tabActive,
            tabTarget.dataset.tabInactive
        );
        return;
    }

    const sidebarTarget = event.target.closest('[data-sidebar-target]');
    if (sidebarTarget) {
        event.preventDefault();
        const modalId = sidebarTarget.dataset.sidebarTarget;
        toggleSidebar();
        setTimeout(() => openModal(modalId), 300);
        return;
    }

   const modalCloseTarget = event.target.closest('[data-modal-close]');
if (modalCloseTarget) {
    event.preventDefault();

    const modalToClose = modalCloseTarget.dataset.modalClose;
    const modalToOpen = modalCloseTarget.dataset.modalTarget;

    closeModal(modalToClose);

    if (modalToOpen) {
        trackEvent('offer_click', {
            offer_id: modalToOpen,
            offer_name: modalCloseTarget.dataset.offer || getOfferName(modalToOpen),
            category: modalCloseTarget.dataset.category,
        });
        openModal(modalToOpen);

        if (
            modalCloseTarget.dataset.openTabShow &&
            modalCloseTarget.dataset.openTabHide &&
            modalCloseTarget.dataset.openTabActive &&
            modalCloseTarget.dataset.openTabInactive
        ) {
            switchTab(
                modalCloseTarget.dataset.openTabShow,
                modalCloseTarget.dataset.openTabHide,
                modalCloseTarget.dataset.openTabActive,
                modalCloseTarget.dataset.openTabInactive
            );
        }
    }

    return;
}

    const modalTarget = event.target.closest('[data-modal-target]');
    if (modalTarget) {
        event.preventDefault();
        const targetModalId = modalTarget.dataset.modalTarget;
        trackEvent('offer_click', {
            offer_id: targetModalId,
            offer_name: modalTarget.dataset.offer || getOfferName(targetModalId),
            category: modalTarget.dataset.category,
        });
        openModal(targetModalId);
        return;
    }

    if (event.target.classList.contains('modal-backdrop')) closeModal(event.target.id);
    if (event.target.id === 'sidebarOverlay') toggleSidebar();
    if (event.target.id === 'imagePreviewModal') {
        closeModal('imagePreviewModal');
    }
}

function handleDocumentKeydown(event) {
    if (event.key === 'Escape') {
        if (isAssistantChatOpen()) {
            event.preventDefault();
            closeAssistantChat();
            return;
        }

        const preview = document.getElementById('imagePreviewModal');
        if (preview && !preview.classList.contains('hidden')) {
            event.preventDefault();
            closeModal('imagePreviewModal');
            return;
        }

        const openModalElement = Array.from(document.querySelectorAll('.modal-backdrop:not(.hidden)')).pop();
        if (openModalElement?.id) {
            event.preventDefault();
            closeModal(openModalElement.id);
            return;
        }
    }

    if (trapAssistantChatFocus(event)) return;

    if ((event.key !== 'Enter' && event.key !== ' ') || !event.target.matches('[role="button"][data-modal-target]')) {
        return;
    }

    event.preventDefault();
    openModal(event.target.dataset.modalTarget);
}

function updateProcessModalTitle(showId) {
    const titles = {
        'v-port': 'Οδηγός Vodafone CU - Φορητότητα',
        'v-new': 'Οδηγός Vodafone CU - Νέος αριθμός',
        'n-port': 'Οδηγός NOVA Q - Φορητότητα',
        'n-new': 'Οδηγός NOVA Q - Νέος αριθμός',
    };

    const titleId = showId.startsWith('v-') ? 'vodaProcessTitle' : 'novaProcessTitle';
    const titleElement = document.getElementById(titleId);

    if (titleElement && titles[showId]) {
        titleElement.textContent = titles[showId];
    }
}

function switchTab(showId, hideId, activeBtnId, inactiveBtnId) {
  const show = document.getElementById(showId);
  const hide = document.getElementById(hideId);
  const activeBtn = document.getElementById(activeBtnId);
  const inactiveBtn = document.getElementById(inactiveBtnId);

  if (!show || !hide || !activeBtn || !inactiveBtn) {
    console.warn('switchTab missing element', { showId, hideId, activeBtnId, inactiveBtnId });
    return;
  }

  show.classList.remove('hidden');
  hide.classList.add('hidden');

  const isVoda = activeBtnId.includes('v-') || activeBtnId === 'btn-v-port';

  if (isVoda) {
    inactiveBtn.className = "flex-1 py-3 md:py-4 font-bold text-xs md:text-sm text-gray-500 hover:bg-gray-100 transition";
    activeBtn.className = "flex-1 py-3 md:py-4 font-bold text-xs md:text-sm text-red-600 border-b-4 border-red-600 bg-white";
  } else {
    inactiveBtn.className = "flex-1 py-3 md:py-4 font-bold text-xs md:text-sm text-orange-700 bg-orange-100 hover:bg-orange-200 transition";
    activeBtn.className = "flex-1 py-3 md:py-4 font-bold text-xs md:text-sm text-white border-b-4 border-orange-700 bg-orange-500 hover:bg-orange-600 transition";
  }

  updateProcessModalTitle(showId);
  resetProcessWizard(showId);
}

/* =========================================
   4. COOKIE CONSENT
   ========================================= */
function handleCookieConsent(action) {
    const banner = document.getElementById('cookieConsentBanner');
    if (!banner) return;
    if (action === 'accept') {
        localStorage.setItem('cookieConsent', 'accepted');
        loadAllTracking();
        trackEvent('Consent', 'analytics_consent_accept', 'Cookie Banner');
        showToast('Οι προτιμήσεις αποθηκεύτηκαν', 'success');
    } else {
        localStorage.setItem('cookieConsent', 'rejected');
        showToast('Τα cookies απορρίφθηκαν', 'info');
    }
    banner.style.opacity = '0';
    banner.style.transform = 'translateY(100%)';
    setTimeout(() => banner.classList.add('hidden'), 500);

    const cookiesModal = document.getElementById('cookiesModal');
    if (cookiesModal && !cookiesModal.classList.contains('hidden')) {
        closeModal('cookiesModal');
    }
}

/* =========================================
   6. INITIALIZATION & ROUTING
   ========================================= */
let pageInitialized = false;


function formatGreekDateTime(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return new Intl.DateTimeFormat('el-GR', {
        timeZone: 'Europe/Athens',
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

async function loadSiteUpdateNotice() {
    const target = document.getElementById('siteLastUpdated');

    if (!target) return;

    try {
        const response = await fetch(`assets/site-version.json?v=${Date.now()}`, {
            cache: 'no-store',
        });

        if (!response.ok) throw new Error('site-version not available');

        const data = await response.json();
        const formatted = formatGreekDateTime(data.updatedAt);

        if (!formatted) throw new Error('invalid updatedAt');

        target.textContent = `Τελευταία ενημέρωση: ${formatted}`;
        target.setAttribute('title', data.commit ? `Commit: ${data.commit}` : '');
    } catch (error) {
        target.textContent = 'Τελευταία ενημέρωση: διαθέσιμη σύντομα.';
    }
}

function triggerPageLoadedState(delay = 0) {
    const applyLoadedClass = () => {
        requestAnimationFrame(() => {
            document.body.classList.add('page-loaded');
        });
    };

    if (delay > 0) {
        setTimeout(applyLoadedClass, delay);
        return;
    }

    applyLoadedClass();
}

function initializePage() {
    if (pageInitialized) return;
    pageInitialized = true;

    // Preloader
    const preloader = document.getElementById('preloader');
    if (preloader) {
        requestAnimationFrame(() => {
            preloader.classList.add('opacity-0', 'pointer-events-none');
            setTimeout(() => {
                preloader.style.display = 'none';
                document.body.classList.remove('loading');
                triggerPageLoadedState(100);
            }, 200);
        });
    } else {
        triggerPageLoadedState(100);
    }

    // Cookies Check
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
        setTimeout(() => { document.getElementById('cookieConsentBanner')?.classList.remove('hidden'); }, 1000);
    } else if (consent === 'accepted') {
        loadAllTracking();
    }

    // Hash Routing (nyxlabs.gr/#modalID)
    openModalFromHash();
    setTimeout(openModalFromHash, 0);

    // Delegated UI listeners
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('touchstart', handleProcessSwipeStart, { passive: true });
    document.addEventListener('touchend', handleProcessSwipeEnd, { passive: true });
    document.addEventListener('keydown', handleDocumentKeydown);
    document.addEventListener('touchstart', handleSwipeBackTouchStart, { passive: true });
    document.addEventListener('touchend', handleSwipeBackTouchEnd, { passive: true });
    document.addEventListener('touchcancel', resetSwipeBackTracking, { passive: true });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            stopAllOfferViews({ beacon: true });
            stopAllOfferCardViews({ beacon: true });
        } else {
            resumeOpenOfferViews();
            refreshVisibleOfferCards();
        }
    });
    window.addEventListener('pagehide', () => {
        stopAllOfferViews({ beacon: true });
        stopAllOfferCardViews({ beacon: true });
    });

    window.addEventListener('hashchange', openModalFromHash);

    const imagePreviewViewport = document.getElementById('imagePreviewViewport');
    if (imagePreviewViewport) {
        imagePreviewViewport.addEventListener('wheel', handleImagePreviewWheel, { passive: false });
        imagePreviewViewport.addEventListener('touchstart', handleImagePreviewTouchStart, { passive: true });
        imagePreviewViewport.addEventListener('touchmove', handleImagePreviewTouchMove, { passive: false });
        imagePreviewViewport.addEventListener('touchend', handleImagePreviewTouchEnd);
        imagePreviewViewport.addEventListener('touchcancel', handleImagePreviewTouchEnd);
        imagePreviewViewport.addEventListener('pointerdown', handleImagePreviewPointerDown);
        imagePreviewViewport.addEventListener('pointermove', handleImagePreviewPointerMove);
        imagePreviewViewport.addEventListener('pointerup', handleImagePreviewPointerUp);
        imagePreviewViewport.addEventListener('pointercancel', stopImagePreviewDrag);
        imagePreviewViewport.addEventListener('mouseleave', stopImagePreviewDrag);
    }

    window.addEventListener('keydown', (event) => {
        const modal = document.getElementById('imagePreviewModal');
        if (!modal || modal.classList.contains('hidden')) return;

        if (event.key === 'Escape') closeModal('imagePreviewModal');
        if (event.key === '+' || event.key === '=') zoomImagePreview(0.25);
        if (event.key === '-') zoomImagePreview(-0.25);
        if (event.key === '0') resetImagePreviewZoom();
    });

    // Intersection Observer για τα Animations (Reveal)
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach((el, i) => {
        el.style.transitionDelay = `${i * 100}ms`;
        observer.observe(el);
    });

    enhanceIbanWarnings();
    initializeFaqTracking();
    initializeLandingStepTracking();
    initializeOfferSearch();
    initializeBottomNavOffersState();
    updateOfferVisibility();
    initializeOfferCardReveal();
    initializeOfferCardTracking();
    window.addEventListener('load', () => {
        setTimeout(loadSiteUpdateNotice, 1000);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage, { once: true });
} else {
    initializePage();
}

// Διαχείριση "Πίσω" στο Browser / κινητό
window.onpopstate = function (event) {
    const state = event.state || {};

    const preview = document.getElementById('imagePreviewModal');
    if (preview) {
        preview.classList.add('hidden');
        stopImagePreviewDrag();
        resetImagePreviewZoom(false);
    }

    document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach((modal) => {
        if (modal.id) stopOfferView(modal.id);
        modal.classList.add('hidden');
    });

    if (state.screen === 'image-preview' && state.previewSrc) {
        if (state.parentModalId) {
            openModal(state.parentModalId, false);
        }

        openImagePreview(state.previewSrc, false);
        return;
    }

    if ((state.screen === 'offer' || state.modalId) && state.modalId) {
        openModal(state.modalId, false);
        return;
    }

    unlockPageScrollIfIdle();
    requestAnimationFrame(refreshVisibleOfferCards);
};
