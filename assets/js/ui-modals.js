/* =========================================
   UI MODALS / SIDEBAR HELPERS
   Μεταφέρθηκε από το main.js
========================================= */

function closeSidebarInstantly() {
    const menu = document.getElementById('sidebarMenu');
    const overlay = document.getElementById('sidebarOverlay');

    if (menu) menu.classList.add('-translate-x-full');
    if (overlay) {
        overlay.classList.add('opacity-0');
        overlay.classList.add('hidden');
    }
}


function goHomeFromHeader() {
    const preview = document.getElementById('imagePreviewModal');
    const chat = document.getElementById('assistantChatModal');

    document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach((modal) => {
        if (modal.id) stopOfferView(modal.id);
        modal.classList.add('hidden');
    });

    if (preview) {
        preview.classList.add('hidden');
        stopImagePreviewDrag();
        resetImagePreviewZoom(false);
    }

    if (chat && !chat.classList.contains('hidden') && typeof closeAssistantChat === 'function') {
        closeAssistantChat();
    }

    closeSidebarInstantly();

    if (window.location.hash) {
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }

    unlockPageScrollIfIdle();

    requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        refreshVisibleOfferCards();
    });

    trackEvent('Navigation', 'header_home_click', 'top_bar');
}


function hasOpenBlockingLayer() {
    const sidebar = document.getElementById('sidebarMenu');
    const preview = document.getElementById('imagePreviewModal');
    const chat = document.getElementById('assistantChatModal');

    return Boolean(
        document.querySelector('.modal-backdrop:not(.hidden)') ||
        (preview && !preview.classList.contains('hidden')) ||
        (chat && !chat.classList.contains('hidden')) ||
        (sidebar && !sidebar.classList.contains('-translate-x-full'))
    );
}


function lockPageScroll() {
    if (document.body.dataset.scrollLocked === 'true') return;
    pageScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.dataset.scrollLocked = 'true';
    document.body.classList.add('overflow-hidden');
    document.body.style.position = 'fixed';
    document.body.style.top = `-${pageScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
}


function unlockPageScrollIfIdle() {
    if (hasOpenBlockingLayer() || document.body.dataset.scrollLocked !== 'true') return;

    document.body.classList.remove('overflow-hidden', 'scroll-locked');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.removeAttribute('data-scroll-locked');
    window.scrollTo(0, pageScrollY);
}


function loadDeferredIframes(root) {
    root.querySelectorAll('iframe[data-src]').forEach((iframe) => {
        if (!iframe.getAttribute('src')) {
            iframe.setAttribute('src', iframe.dataset.src);
        }
    });
}


function openModal(id, updateHistory = true) {
    const modal = document.getElementById(id);
    if (!modal) return;
    const wasHidden = modal.classList.contains('hidden');

    if (wasHidden) stopAllOfferCardViews();
    modal.classList.remove('hidden');
    loadDeferredIframes(modal); activateVisibleProcessWizard(modal);
    if (wasHidden) {
        lockPageScroll();
        startOfferView(id);
    }
    
    if (updateHistory && window.location.hash !== `#${id}`) {
        history.pushState({ screen: 'offer', modalId: id }, '', `#${id}`);
    }
}


function openModalFromHash() {
    const modalId = decodeURIComponent(window.location.hash.replace('#', ''));
    if (!modalId) return;

    const modal = document.getElementById(modalId);
    if (modal && modal.classList.contains('modal-backdrop')) {
        openModal(modalId, false);
    }
}


function closeModal(id, updateHistory = true) {
    const modal = document.getElementById(id);
    const wasOpen = modal && !modal.classList.contains('hidden');
    if (modal) modal.classList.add('hidden');
    if (wasOpen) stopOfferView(id);
        if (id === 'imagePreviewModal') {
        stopImagePreviewDrag();
        resetImagePreviewZoom(false);

        if (wasOpen && history.state && (history.state.imagePreview || history.state.screen === 'image-preview')) {
            history.back();
            return;
        }
    }
    
   if (updateHistory && window.location.hash === `#${id}`) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}

    if (wasOpen) {
        unlockPageScrollIfIdle();
        if (!hasOpenBlockingLayer()) requestAnimationFrame(refreshVisibleOfferCards);
    }

    if (!hasOpenBlockingLayer()) {
    }
}


function toggleSidebar() {
  const menu = document.getElementById('sidebarMenu');
  const overlay = document.getElementById('sidebarOverlay');

  if (!menu || !overlay) return;

  const isClosed = menu.classList.contains('-translate-x-full');

  if (isClosed) {
    overlay.classList.remove('hidden');

    requestAnimationFrame(() => {
      overlay.classList.remove('opacity-0');
      menu.classList.remove('-translate-x-full');
    });
  } else {
    menu.classList.add('-translate-x-full');
    overlay.classList.add('opacity-0');

    setTimeout(() => {
      overlay.classList.add('hidden');
    }, 300);
  }
}
