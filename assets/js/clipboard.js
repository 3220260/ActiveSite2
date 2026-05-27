/* =========================================
   CLIPBOARD / TOAST HELPERS
   Μεταφέρθηκε από το main.js
========================================= */

function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = type === 'success'
        ? '<i class="fa-solid fa-circle-check text-green-400"></i>'
        : '<i class="fa-solid fa-circle-info text-blue-400"></i>';
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}


function writeClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }

    return new Promise((resolve, reject) => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            document.execCommand('copy') ? resolve() : reject(new Error('Copy failed'));
        } catch (error) {
            reject(error);
        } finally {
            textarea.remove();
        }
    });
}


function copyToClipboard(text, element) {
    writeClipboard(text).then(() => {
        const msg = element.querySelector('.copy-msg');
        const icon = element.querySelector('.fa-copy');
        if (msg) { msg.classList.remove('opacity-0'); msg.classList.add('opacity-100'); }
        if (icon) {
            icon.classList.remove('fa-copy', 'fa-regular');
            icon.classList.add('fa-check', 'fa-solid');
        }
        setTimeout(() => {
            if (msg) { msg.classList.remove('opacity-100'); msg.classList.add('opacity-0'); }
            if (icon) {
                icon.classList.remove('fa-check', 'fa-solid');
                icon.classList.add('fa-copy', 'fa-regular');
            }
        }, 2000);
    }).catch(() => showToast('Η αντιγραφή απέτυχε', 'error'));
}


async function copyIBAN(text, element) {
    try {
        await writeClipboard(text);
        showToast('Αντιγράφηκε', 'success');
        const iconCopy = element.querySelector('.icon-copy');
        const iconCheck = element.querySelector('.icon-check');
        if (iconCopy && iconCheck) { iconCopy.classList.add('hidden'); iconCheck.classList.remove('hidden'); }
        element.classList.add('border-green-500', 'bg-green-50');
        setTimeout(() => {
            if (iconCopy && iconCheck) { iconCopy.classList.remove('hidden'); iconCheck.classList.add('hidden'); }
            element.classList.remove('border-green-500', 'bg-green-50');
        }, 2000);
    } catch (err) {
        showToast('Η αντιγραφή απέτυχε', 'error');
    }
}
