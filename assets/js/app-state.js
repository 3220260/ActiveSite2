/* =========================================
   APP STATE / SHARED SETTINGS
   Γενικές μεταβλητές που χρησιμοποιούνται από πολλά JS αρχεία
========================================= */

const IMAGE_PREVIEW_MIN_ZOOM = 1;
const IMAGE_PREVIEW_MAX_ZOOM = 4;
const MIN_CARD_VIEW_SECONDS = 2;
const SWIPE_BACK_MIN_DISTANCE = 90;
const SWIPE_BACK_MAX_VERTICAL_DISTANCE = 70;
const SWIPE_BACK_MAX_DURATION_MS = 900;
const SWIPE_BACK_EDGE_GUARD = 24;
let pageScrollY = 0;
let imagePreviewZoom = 1;
let imagePreviewPinchDistance = 0;
let imagePreviewPinchZoom = 1;
let imagePreviewDragging = false;
let imagePreviewDragStartX = 0;
let imagePreviewDragStartY = 0;
let imagePreviewDragScrollLeft = 0;
let imagePreviewDragScrollTop = 0;
let swipeBackStartX = 0;
let swipeBackStartY = 0;
let swipeBackStartTime = 0;
let swipeBackTracking = false;
const activeOfferViews = {};
const offerCardViewStarts = new Map();
const offerCardViewed = new Set();
let trackedOfferCards = [];
