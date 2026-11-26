import "./styles/tokens.css";
import "./styles/shelf.css";
import "./styles/studio.css";

import {
  PROFILE,
  VIDEOS,
  GALLERY_ITEMS,
  FEATURED_PRINTS,
  WORKBENCH_DATA,
  CATALOGUE_CATEGORIES,
  CATALOGUE_ITEMS,
  NOTEBOOK_SPREADS,
} from "./data/portfolioData.js";
import { ICONS } from "./ui/icons.js";
import { assetUrl } from "./utils/assetUrl.js";
import { mountDeskScene } from "./desk/deskScene.js";
import { initScratchPad, exportPostcardPng } from "./ui/modals.js";

// =====================================================================
// Application State
// =====================================================================
const state = {
  lang: document.documentElement.lang === "he" ? "he" : "en",
  view: document.documentElement.dataset.view === "shelf" ? "shelf" : "desk",
  openRoom: null, // null | "workbench" | "archive" | "notebook" | "letters"
  selectedPrintIndex: 0,
  wbTab: "films",
  activeVideoIdx: 0,
  audioChapterIdx: 0,
  audioPlaying: false,
  audioProgress: 8,
  pyramidEraIdx: 3,
  collectedWords: ["firefly"],
  activeWordId: "firefly",
  reformActIdx: 0,
  galleryFilter: "all",
  // Unified Quick-Look Viewer state (supports multi-page spreads, single images, PDFs & HD videos)
  quickLook: null, // { title, meta, caption, pages: [...], pageIdx, videoSrc, poster, pdfUrl, galleryIdx }
  catFilter: "all",
  catSearch: "",
  catPage: 0,
  catShowAll: false,
  expandedCatId: null,
  notebookTabIdx: 0,
  performanceMode: (() => {
    try { return localStorage.getItem("orin-perf") === "on"; } catch { return false; }
  })(),
  nightMode: false,
  screwTurns: 0,
  visitedStops: [],
  lastStampSrc: "assets/prints/miloolita.jpg",
  copiedField: null,
  activeModalPrintId: null,
};

let deskApi = null;
let scratchApi = null;
let audioTimer = null;
let audioCtx = null;

function t() {
  return PROFILE[state.lang];
}

function playSoftChime(freq = 523.25) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx ??= new AC();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0008, audioCtx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.36);
  } catch {}
}

function recordStop(labelEn, labelHe, stampSrc) {
  const entry = { en: labelEn, he: labelHe };
  state.visitedStops = [...state.visitedStops.filter((s) => s.en !== labelEn), entry].slice(-5);
  if (stampSrc) state.lastStampSrc = stampSrc;
}

function setLang(nextLang) {
  state.lang = nextLang;
  document.documentElement.lang = nextLang;
  document.documentElement.dir = nextLang === "he" ? "rtl" : "ltr";
  document.title =
    nextLang === "he"
      ? "אורין ויינברג | סטוריטלינג, ספרים, וידאו וחינוך ל-AI"
      : "Orin Winberg | Storytelling, Books, Film & AI Education";
  try { localStorage.setItem("orin-lang", nextLang); } catch {}
  renderAll();
}

function setView(nextView, updateHash = true) {
  state.view = nextView;
  state.openRoom = null;
  document.documentElement.dataset.view = nextView;
  if (updateHash) {
    const nextHash = nextView === "shelf" ? "#boring" : "#desk";
    if (location.hash !== nextHash) {
      history.pushState({ view: nextView }, "", nextHash);
    }
  }
  updateStudioOpenState();
  renderAll();
  if (nextView === "desk" && deskApi) {
    deskApi.setPaused(false);
    requestAnimationFrame(() => deskApi.resize());
  } else if (nextView === "shelf") {
    deskApi?.setPaused(true);
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => scrollCarouselToIndex(state.selectedPrintIndex, false));
  }
}

function openRoom(roomId) {
  state.openRoom = roomId;
  const roomMeta = {
    workbench: ["The Workbench & Films", "שולחן העבודה והסרטונים", "assets/media/hello-tech-poster.jpg"],
    archive: ["The Project Files", "תיק העבודות", "assets/prints/card-file-box.jpg"],
    notebook: ["My Notebook", "המחברת שלי", "assets/works/orin-google-still.jpg"],
    letters: ["Letters & Links", "מכתבים וקישורים", "assets/prints/journalism.jpg"],
  };
  if (roomId && roomMeta[roomId]) {
    recordStop(roomMeta[roomId][0], roomMeta[roomId][1], roomMeta[roomId][2]);
  }
  updateStudioOpenState();
  renderRoomContent();
  if (roomId) {
    deskApi?.setPaused(true);
    window.scrollTo({ top: 0, behavior: "instant" });
  } else if (state.view === "desk") {
    deskApi?.setPaused(false);
    deskApi?.closeDrawer();
  }
}

function updateStudioOpenState() {
  const studio = document.getElementById("studio-shell");
  const readingWrap = document.getElementById("desk-reading-wrap");
  if (!studio || !readingWrap) return;
  if (state.openRoom) {
    studio.dataset.open = state.openRoom;
    readingWrap.hidden = false;
  } else {
    delete studio.dataset.open;
    readingWrap.hidden = true;
  }
}

// =====================================================================
// Static DOM Scaffold
// =====================================================================
function mountScaffold() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <a class="skip-link" href="#main-content" id="skip-link">Skip to content</a>

    <div class="floating-top-controls" role="region" aria-label="View and language controls">
      <button type="button" class="hud-pill lang-pill" id="lang-toggle" aria-label="Switch language">עברית</button>
      <button type="button" class="hud-pill" id="mode-toggle"></button>
    </div>

    <!-- FRONT DOOR 1: INTERACTIVE 3D DESK + SHARED ROOM FOLIOS -->
    <section class="studio-shell" id="studio-shell" aria-label="Orin's interactive desk">
      <div class="desk-overview" id="desk-overview">
        <canvas class="desk-canvas" id="desk-canvas" aria-label="Interactive 3D writing desk"></canvas>
        <div class="desk-hover-label" id="desk-hover-label" aria-hidden="true"></div>
        <div class="desk-nameplate desk-only" id="desk-nameplate"></div>
        <div class="desk-fallback" id="desk-fallback"></div>
        <nav class="desk-profiles desk-only" id="desk-profiles" aria-label="Links"></nav>
        <div class="desk-corner-tools desk-only" id="desk-corner-tools"></div>
      </div>

      <div class="desk-reading-wrap" id="desk-reading-wrap" hidden>
        <button type="button" class="desk-backdrop-dismiss" id="desk-backdrop-dismiss" aria-label="Close room"></button>
        <div class="desk-reading" id="desk-reading" role="region" aria-live="polite">
          <nav class="desk-rail" id="desk-rail" aria-label="Desk rooms"></nav>
          <div class="room-container" id="room-container"></div>
        </div>
      </div>
    </section>

    <!-- FRONT DOOR 2: "BORING" MODE — EDITORIAL PRINT SHELF & MEDIA GALLERY -->
    <div class="boring-door" id="boring-door">
      <header class="mast" id="mast"></header>
      <main id="main-content">
        <section class="shop" id="shop" data-selection="high-voltage"></section>
        <section class="page-width media-gallery-section" id="media-gallery"></section>
        <section class="page-width boring-rooms-preview" id="boring-overview"></section>
      </main>
      <footer class="site-footer" id="site-footer"></footer>
    </div>

    <!-- MODAL 1: Split-Pane Print Reader (<dialog>) -->
    <dialog class="open-project" id="print-dialog" aria-labelledby="print-dialog-title">
      <div class="modal-top" id="print-modal-top"></div>
      <div class="detail-slot" id="print-detail-slot"></div>
    </dialog>

    <!-- MODAL 2: Unified Quick-Look Archival Viewer (Multi-Page Spreads, PDFs, Photos & HD Videos) -->
    <dialog class="lightbox-dialog" id="lightbox-dialog" aria-labelledby="lightbox-title">
      <div class="modal-top" id="lightbox-top"></div>
      <div class="lightbox-body" id="lightbox-body"></div>
    </dialog>

    <!-- MODAL 3: Ruled Scratch Paper Drawing Pad -->
    <dialog class="pickup-dialog" id="scratch-dialog" aria-labelledby="scratch-title">
      <div class="pickup-head">
        <h2 id="scratch-title">Scratch paper</h2>
        <button type="button" class="pickup-close" id="scratch-close">Put back</button>
      </div>
      <canvas class="sketch-canvas" id="scratch-canvas"></canvas>
      <div class="sketch-tools" id="scratch-tools"></div>
    </dialog>

    <!-- MODAL 4: 3D-Flippable Keepsake Postcard -->
    <dialog class="flip-dialog" id="postcard-dialog" aria-label="Keepsake postcard">
      <div class="flip-top">
        <span id="postcard-hint" style="font: 12px var(--mono); opacity: 0.85;"></span>
        <button type="button" id="postcard-close">Put back</button>
      </div>
      <div class="card-hand" id="postcard-hand" tabindex="0" role="button" aria-label="Flip postcard">
        <div class="flip-card" id="postcard-flip-card">
          <div class="flip-face flip-front">
            <img src="${assetUrl("assets/prints/postcard-front.jpg")}" alt="Moonlit Tel Aviv desk window with firefly" />
          </div>
          <div class="flip-face flip-back" id="postcard-back"></div>
        </div>
      </div>
      <div class="flip-controls" id="postcard-controls"></div>
      <p id="postcard-status" style="text-align:center; font: 12.5px var(--mono); margin-top: 8px; min-height: 1.2em;"></p>
    </dialog>
  `;

  document.getElementById("lang-toggle").addEventListener("click", () => {
    setLang(state.lang === "en" ? "he" : "en");
  });

  document.getElementById("mode-toggle").addEventListener("click", () => {
    setView(state.view === "desk" ? "shelf" : "desk");
  });

  document.getElementById("desk-backdrop-dismiss").addEventListener("click", () => openRoom(null));

  document.getElementById("scratch-close").addEventListener("click", () => {
    document.getElementById("scratch-dialog").close();
  });

  document.getElementById("postcard-close").addEventListener("click", () => {
    document.getElementById("postcard-dialog").close();
    deskApi?.closeDrawer();
  });

  document.getElementById("lightbox-dialog").addEventListener("close", () => {
    document.querySelectorAll("#lightbox-dialog video").forEach((v) => v.pause());
  });
  document.getElementById("print-dialog").addEventListener("close", () => {
    document.querySelectorAll("#print-dialog video").forEach((v) => v.pause());
  });

  const flipCard = document.getElementById("postcard-flip-card");
  document.getElementById("postcard-hand").addEventListener("click", () => {
    flipCard.classList.toggle("is-flipped");
  });
  document.getElementById("postcard-hand").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      flipCard.classList.toggle("is-flipped");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.openRoom && !document.querySelector("dialog[open]")) {
      openRoom(null);
    }
  });

  window.addEventListener("popstate", () => {
    const isBoring = location.hash === "#boring" || location.hash === "#shelf";
    setView(isBoring ? "shelf" : "desk", false);
  });

  scratchApi = initScratchPad(document.getElementById("scratch-dialog"), () => t());
}

// =====================================================================
// Render Functions
// =====================================================================
function renderAll() {
  renderTopHud();
  renderDeskChrome();
  renderBoringMode();
  if (state.openRoom) renderRoomContent();
  renderScratchChrome();
  if (state.activeModalPrintId && document.getElementById("print-dialog").open) {
    renderPrintModal(state.activeModalPrintId);
  }
  if (state.quickLook && document.getElementById("lightbox-dialog").open) {
    renderQuickLook();
  }
  if (document.getElementById("postcard-dialog").open) {
    renderPostcardModal();
  }
}

function renderTopHud() {
  const copy = t();
  const langBtn = document.getElementById("lang-toggle");
  langBtn.textContent = state.lang === "en" ? "עברית" : "EN";
  langBtn.title = state.lang === "en" ? "Switch to Hebrew (RTL)" : "Switch to English (LTR)";

  const modeBtn = document.getElementById("mode-toggle");
  modeBtn.innerHTML =
    state.view === "desk"
      ? `${ICONS.books}<span>${copy.boringBtn}</span>`
      : `${ICONS.desk}<span>${copy.deskBtn}</span>`;

  document.getElementById("skip-link").textContent =
    state.lang === "he" ? "דלג לתוכן" : "Skip to content";
}

function renderDeskChrome() {
  const copy = t();
  const plate = document.getElementById("desk-nameplate");
  plate.innerHTML = `
    <div>
      <strong>${copy.name}</strong>
      <small>${copy.roleShort}</small>
    </div>
    <button type="button" class="lamp-indicator" id="lamp-hud-btn" aria-pressed="${state.nightMode}" title="${copy.lampTooltip}" aria-label="${copy.lampTooltip}">
      ${ICONS.lamp}
    </button>
  `;
  plate.querySelector("#lamp-hud-btn").addEventListener("click", () => {
    state.nightMode = !state.nightMode;
    deskApi?.setNightMode(state.nightMode);
    renderDeskChrome();
  });

  const fb = document.getElementById("desk-fallback");
  fb.innerHTML = `
    <p style="font: 600 15px var(--headline); color: var(--muted);">${copy.loadingDesk}</p>
    <div class="desk-load-bar"><span></span></div>
    <div class="desk-fallback-grid">
      <button type="button" class="hero-slip" data-fb-room="workbench">${copy.nav.workbench} — ${copy.name}</button>
      <button type="button" data-fb-print="high-voltage">${FEATURED_PRINTS[0][state.lang].title}</button>
      <button type="button" data-fb-print="kishon">${FEATURED_PRINTS[2][state.lang].title}</button>
      <button type="button" data-fb-print="milly">${FEATURED_PRINTS[4][state.lang].title}</button>
      <button type="button" data-fb-room="archive">${copy.nav.archive}</button>
      <button type="button" data-fb-room="notebook">${copy.nav.notebook}</button>
      <button type="button" data-fb-room="letters">${copy.nav.letters}</button>
    </div>
  `;
  fb.querySelectorAll("[data-fb-room]").forEach((b) =>
    b.addEventListener("click", () => openRoom(b.dataset.fbRoom))
  );
  fb.querySelectorAll("[data-fb-print]").forEach((b) =>
    b.addEventListener("click", () => openPrintModal(b.dataset.fbPrint))
  );

  const dock = document.getElementById("desk-profiles");
  dock.innerHTML = `
    <a href="${PROFILE.linkedinUrl}" target="_blank" rel="noopener" aria-label="LinkedIn" title="LinkedIn">${ICONS.linkedin}</a>
    <a href="mailto:${PROFILE.email}" aria-label="Email" title="${PROFILE.email}">${ICONS.mail}</a>
    <button type="button" id="dock-resume-ql" aria-label="Quick-Look Resume" title="${state.lang === "he" ? "תצוגה מהירה: קורות חיים" : "Quick-Look Resume"}">${ICONS.fileText}</button>
  `;
  dock.querySelector("#dock-resume-ql").addEventListener("click", () => openResumeQuickLook());

  const tools = document.getElementById("desk-corner-tools");
  tools.innerHTML = `
    <button type="button" class="hud-pill desk-perf-btn" id="perf-btn" aria-pressed="${state.performanceMode}">
      <span>${copy.perfMode}</span>
    </button>
    <button type="button" class="hud-pill" id="scratch-open-btn">
      <span>${copy.scratchPaper}</span>
    </button>
  `;
  tools.querySelector("#perf-btn").addEventListener("click", () => {
    state.performanceMode = !state.performanceMode;
    try { localStorage.setItem("orin-perf", state.performanceMode ? "on" : "off"); } catch {}
    deskApi?.resize();
    renderDeskChrome();
  });
  tools.querySelector("#scratch-open-btn").addEventListener("click", () => {
    renderScratchChrome();
    scratchApi.open();
  });
}

function renderScratchChrome() {
  const copy = t();
  document.getElementById("scratch-title").textContent = copy.scratch.title;
  document.getElementById("scratch-close").textContent = copy.putBack;
  document.getElementById("scratch-tools").innerHTML = `
    <button type="button" data-tool="graphite" data-ink aria-pressed="true">${copy.scratch.graphite}</button>
    <button type="button" data-tool="berry" data-ink aria-pressed="false">${copy.scratch.berry}</button>
    <button type="button" data-tool="rose" data-ink aria-pressed="false">${copy.scratch.rose}</button>
    <button type="button" data-tool="stamp">${copy.scratch.stamp}</button>
    <button type="button" data-tool="undo">${copy.scratch.undo}</button>
    <button type="button" data-tool="clear">${copy.scratch.clear}</button>
  `;
}

// =====================================================================
// "BORING" MODE — EDITORIAL PRINT SHELF & GALLERY
// =====================================================================
function renderBoringMode() {
  const copy = t();
  const activePrint = FEATURED_PRINTS[state.selectedPrintIndex] || FEATURED_PRINTS[0];

  const mast = document.getElementById("mast");
  mast.innerHTML = `
    <div class="page-width mast-inner">
      <a href="#boring" class="byline" id="mast-brand">${copy.name}</a>
      <nav aria-label="Main sections">
        <a href="#workbench" data-open-room="workbench">${copy.nav.workbench}</a>
        <a href="#media-gallery">${copy.ctaGallery}</a>
        <a href="#archive" data-open-room="archive">${copy.nav.archive}</a>
        <a href="#notebook" data-open-room="notebook">${copy.nav.notebook}</a>
        <a href="#letters" data-open-room="letters">${copy.nav.letters}</a>
      </nav>
    </div>
  `;
  mast.querySelectorAll("[data-open-room]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      openRoom(a.dataset.openRoom);
    });
  });

  const shop = document.getElementById("shop");
  shop.dataset.selection = activePrint.id;

  const isRtl = state.lang === "he";
  const prevIcon = isRtl ? ICONS.arrowRight : ICONS.arrowLeft;
  const nextIcon = isRtl ? ICONS.arrowLeft : ICONS.arrowRight;

  shop.innerHTML = `
    <div class="page-width welcome">
      <h1 class="shelf-greeting">${copy.greeting}</h1>
      <div class="welcome-note">
        <p>${copy.bio1}</p>
        <p>${copy.bio2}</p>
        <div class="welcome-links">
          <button type="button" id="welcome-to-wb">${copy.ctaWorkbench}</button>
          <a href="#media-gallery">${copy.ctaGallery}</a>
          <button type="button" id="welcome-to-nb">${copy.ctaAbout}</button>
        </div>
      </div>
    </div>

    <div class="page-width shelf-heading">
      <div>
        <h2>${copy.shelfTitle}</h2>
        <p>${copy.shelfHint}</p>
      </div>
      <details class="print-index" id="print-index-details">
        <summary>${copy.printIndex} ${ICONS.chevronDown}</summary>
        <ul>
          ${FEATURED_PRINTS.map(
            (pr, idx) => `
            <li>
              <button type="button" data-pick-print="${pr.id}" aria-current="${idx === state.selectedPrintIndex}">
                <img src="${assetUrl(pr.image)}" alt="" />
                <span>
                  <strong>${pr[state.lang].title}</strong>
                  <small>${pr[state.lang].teaser}</small>
                </span>
              </button>
            </li>
          `
          ).join("")}
        </ul>
      </details>
    </div>

    <div class="display-case">
      <div class="shelf-track" id="shelf-track">
        ${FEATURED_PRINTS.map((pr, idx) => {
          const offset = Math.max(-2, Math.min(2, idx - state.selectedPrintIndex));
          return `
            <div class="shelf-slide" data-slide-idx="${idx}" data-offset="${offset}">
              <button type="button" class="print-card" data-id="${pr.id}" data-open-print="${pr.id}">
                <span class="print-sheet">
                  <img src="${assetUrl(pr.image)}" alt="${pr[state.lang].title}" />
                  <span class="print-foot">
                    <span class="print-type">${pr[state.lang].category}</span>
                    <strong>${pr[state.lang].title}</strong>
                  </span>
                </span>
              </button>
            </div>
          `;
        }).join("")}
      </div>
      <div class="ledge">
        <button type="button" class="shelf-screw" id="shelf-screw" style="--turned:${state.screwTurns * 45}deg" aria-label="Turn tiny brass screw"></button>
      </div>
      <div class="shelf-controls">
        <button type="button" class="arrow-btn" id="shelf-prev" aria-label="Previous print">${prevIcon}</button>
        <button type="button" class="cta-pill" id="shelf-cta">${activePrint[state.lang].cta}</button>
        <button type="button" class="arrow-btn" id="shelf-next" aria-label="Next print">${nextIcon}</button>
      </div>
    </div>
  `;

  shop.querySelector("#welcome-to-wb").addEventListener("click", () => openRoom("workbench"));
  shop.querySelector("#welcome-to-nb").addEventListener("click", () => openRoom("notebook"));

  shop.querySelectorAll("[data-pick-print]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = FEATURED_PRINTS.findIndex((p) => p.id === btn.dataset.pickPrint);
      if (idx >= 0) {
        state.selectedPrintIndex = idx;
        renderBoringMode();
        scrollCarouselToIndex(idx, true);
        openPrintModal(btn.dataset.pickPrint);
      }
    });
  });

  shop.querySelectorAll("[data-open-print]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = FEATURED_PRINTS.findIndex((p) => p.id === btn.dataset.openPrint);
      if (idx >= 0) state.selectedPrintIndex = idx;
      openPrintModal(btn.dataset.openPrint);
    });
  });

  shop.querySelector("#shelf-prev").addEventListener("click", () => {
    state.selectedPrintIndex =
      (state.selectedPrintIndex - 1 + FEATURED_PRINTS.length) % FEATURED_PRINTS.length;
    updateShelfActiveVisuals();
    scrollCarouselToIndex(state.selectedPrintIndex, true);
  });

  shop.querySelector("#shelf-next").addEventListener("click", () => {
    state.selectedPrintIndex = (state.selectedPrintIndex + 1) % FEATURED_PRINTS.length;
    updateShelfActiveVisuals();
    scrollCarouselToIndex(state.selectedPrintIndex, true);
  });

  shop.querySelector("#shelf-cta").addEventListener("click", () => {
    openPrintModal(FEATURED_PRINTS[state.selectedPrintIndex].id);
  });

  shop.querySelector("#shelf-screw").addEventListener("click", () => {
    state.screwTurns++;
    shop.querySelector("#shelf-screw").style.setProperty("--turned", `${state.screwTurns * 45}deg`);
  });

  const track = shop.querySelector("#shelf-track");
  let scrollDebounce = 0;
  track.addEventListener("scroll", () => {
    clearTimeout(scrollDebounce);
    scrollDebounce = setTimeout(() => {
      const center = track.scrollLeft + track.clientWidth / 2;
      let closestIdx = state.selectedPrintIndex;
      let bestDist = Infinity;
      track.querySelectorAll(".shelf-slide").forEach((el) => {
        const elCenter = el.offsetLeft + el.clientWidth / 2;
        const d = Math.abs(elCenter - center);
        if (d < bestDist) {
          bestDist = d;
          closestIdx = Number(el.dataset.slideIdx);
        }
      });
      if (closestIdx !== state.selectedPrintIndex) {
        state.selectedPrintIndex = closestIdx;
        updateShelfActiveVisuals();
      }
    }, 90);
  });

  renderMediaGallery();

  const overview = document.getElementById("boring-overview");
  overview.innerHTML = `
    <div>
      <h2>${copy.boringOverviewTitle}</h2>
      <p>${copy.boringOverviewCopy}</p>
      <div class="boring-room-cards">
        ${copy.roomCards
          .map(
            (rc) => `
          <button type="button" class="room-jump-card" data-jump-room="${rc.id}">
            <small>${rc.kicker}</small>
            <strong>${rc.title}</strong>
            <span>${rc.desc}</span>
          </button>
        `
          )
          .join("")}
      </div>
    </div>

    <aside class="taped-note" aria-label="${copy.tapedNoteTitle}">
      <h3>${copy.tapedNoteTitle}</h3>
      <p>${copy.tapedNoteSub}</p>
      <ul>
        ${copy.tapedItems
          .map((item) => `<li><strong>${item.label}</strong><span>${item.meta}</span></li>`)
          .join("")}
      </ul>
    </aside>
  `;
  overview.querySelectorAll("[data-jump-room]").forEach((btn) =>
    btn.addEventListener("click", () => openRoom(btn.dataset.jumpRoom))
  );

  const footer = document.getElementById("site-footer");
  footer.innerHTML = `
    <div class="page-width footer-inner">
      <span>${copy.footerCredit}</span>
      <nav aria-label="Footer links">
        <a href="${PROFILE.linkedinUrl}" target="_blank" rel="noopener">LinkedIn</a>
        <a href="mailto:${PROFILE.email}">${PROFILE.email}</a>
        <button type="button" id="footer-resume-ql" style="background:none;border:0;padding:0;text-decoration:underline;color:var(--berry);font:inherit;">${state.lang === "he" ? "קורות חיים (תצוגה מהירה)" : "Quick-Look Resume"}</button>
      </nav>
    </div>
  `;
  footer.querySelector("#footer-resume-ql").addEventListener("click", () => openResumeQuickLook());
}

function renderMediaGallery() {
  const copy = t();
  const gal = copy.gallery;
  const el = document.getElementById("media-gallery");
  if (!el) return;

  const visible = GALLERY_ITEMS.filter(
    (item) => state.galleryFilter === "all" || item.type === state.galleryFilter
  );

  el.innerHTML = `
    <div class="gallery-head">
      <div>
        <h2>${gal.heading}</h2>
        <p>${gal.sub}</p>
      </div>
      <div class="gallery-filters" role="group" aria-label="Filter media">
        ${gal.filters
          .map(
            (f) => `
          <button type="button" data-gal-filter="${f.id}" aria-pressed="${state.galleryFilter === f.id}">
            ${f.label}
          </button>
        `
          )
          .join("")}
      </div>
    </div>

    <div class="gallery-grid">
      ${visible
        .map((item) => {
          const globalIdx = GALLERY_ITEMS.indexOf(item);
          const d = item[state.lang];
          const isVid = item.type === "video";
          const multiCount = item.pages && item.pages.length > 1 ? item.pages.length : 0;
          return `
            <button type="button" class="gallery-tile ${isVid ? "is-video" : ""}" data-open-lightbox="${globalIdx}">
              <div class="gallery-thumb-wrap">
                <img src="${assetUrl(item.thumb)}" alt="${d.title}" loading="lazy" />
                ${
                  isVid
                    ? `<span class="gallery-play-badge">${ICONS.play} ${gal.watchBadge} · ${item.duration}</span>`
                    : multiCount
                    ? `<span class="gallery-play-badge">${multiCount} ${gal.pagesBadge}</span>`
                    : ""
                }
              </div>
              <div class="gallery-meta">
                <small>${d.meta}</small>
                <strong>${d.title}</strong>
              </div>
            </button>
          `;
        })
        .join("")}
    </div>
  `;

  el.querySelectorAll("[data-gal-filter]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.galleryFilter = btn.dataset.galFilter;
      renderMediaGallery();
    })
  );

  el.querySelectorAll("[data-open-lightbox]").forEach((btn) =>
    btn.addEventListener("click", () => openGalleryQuickLook(Number(btn.dataset.openLightbox)))
  );
}

// =====================================================================
// UNIFIED QUICK-LOOK ARCHIVAL VIEWER (Multi-page Spreads, PDFs, Photos & HD Videos)
// =====================================================================
function openGalleryQuickLook(idx) {
  const safeIdx = ((idx % GALLERY_ITEMS.length) + GALLERY_ITEMS.length) % GALLERY_ITEMS.length;
  const item = GALLERY_ITEMS[safeIdx];
  recordStop(item.en.title, item.he.title, item.thumb);
  state.quickLook = {
    galleryIdx: safeIdx,
    titleEn: item.en.title,
    titleHe: item.he.title,
    metaEn: item.en.meta,
    metaHe: item.he.meta,
    captionEn: item.en.caption,
    captionHe: item.he.caption,
    pages: item.pages || (item.image ? [item.image] : []),
    pageIdx: 0,
    videoSrc: item.videoSrc || null,
    poster: item.thumb,
    pdfUrl: null,
  };
  renderQuickLook();
  const dlg = document.getElementById("lightbox-dialog");
  if (!dlg.open) dlg.showModal();
}

function openQuickLook({ titleEn, titleHe, metaEn, metaHe, captionEn, captionHe, pages = [], videoSrc = null, poster = null, pdfUrl = null }) {
  recordStop(titleEn, titleHe, poster || pages[0] || "assets/prints/miloolita.jpg");
  state.quickLook = {
    galleryIdx: null,
    titleEn,
    titleHe,
    metaEn,
    metaHe,
    captionEn,
    captionHe,
    pages,
    pageIdx: 0,
    videoSrc,
    poster,
    pdfUrl,
  };
  renderQuickLook();
  const dlg = document.getElementById("lightbox-dialog");
  if (!dlg.open) dlg.showModal();
}

function openResumeQuickLook() {
  openQuickLook({
    titleEn: "Orin Winberg — Resume (2 Pages)",
    titleHe: "אורין ויינברג — קורות חיים (2 עמודים)",
    metaEn: "Curriculum Vitae · Quick-Look Viewer",
    metaHe: "קורות חיים · תצוגה מהירה",
    captionEn: "Flip between both pages directly here, or download the original PDF.",
    captionHe: "דפדפו בין שני העמודים ישירות כאן, או הורידו את קובץ ה-PDF המקורי.",
    pages: PROFILE.resumePages,
    pdfUrl: PROFILE.resumePdf,
  });
}

function renderQuickLook() {
  const ql = state.quickLook;
  if (!ql) return;
  const isHe = state.lang === "he";
  const gal = t().gallery;
  const dlg = document.getElementById("lightbox-dialog");

  const top = document.getElementById("lightbox-top");
  const hasGalleryNav = ql.galleryIdx !== null;
  top.innerHTML = `
    <button type="button" class="modal-close-btn" id="lb-close">${gal.close}</button>
    ${
      hasGalleryNav
        ? `<div class="turn-prints">
            <button type="button" id="lb-prev" aria-label="Previous item">${isHe ? ICONS.arrowRight : ICONS.arrowLeft}</button>
            <span>${ql.galleryIdx + 1} / ${GALLERY_ITEMS.length}</span>
            <button type="button" id="lb-next" aria-label="Next item">${isHe ? ICONS.arrowLeft : ICONS.arrowRight}</button>
          </div>`
        : ql.pdfUrl
        ? `<a class="modal-close-btn" href="${assetUrl(ql.pdfUrl)}" download="Orin-Winberg-Resume.pdf">${gal.downloadPdf}</a>`
        : `<span style="font:12px var(--mono); color:var(--muted);">${isHe ? ql.metaHe : ql.metaEn}</span>`
    }
  `;
  top.querySelector("#lb-close").addEventListener("click", () => dlg.close());
  if (hasGalleryNav) {
    top.querySelector("#lb-prev").addEventListener("click", () => openGalleryQuickLook(ql.galleryIdx - 1));
    top.querySelector("#lb-next").addEventListener("click", () => openGalleryQuickLook(ql.galleryIdx + 1));
  }

  const pageCount = ql.pages?.length || 0;
  const activeImg = pageCount ? ql.pages[Math.min(ql.pageIdx, pageCount - 1)] : null;

  const body = document.getElementById("lightbox-body");
  body.innerHTML = `
    <div class="lightbox-stage">
      ${
        ql.videoSrc
          ? `<video controls playsinline preload="metadata" src="${assetUrl(ql.videoSrc)}" poster="${assetUrl(ql.poster || "")}"></video>`
          : activeImg
          ? `<img src="${assetUrl(activeImg)}" alt="${isHe ? ql.titleHe : ql.titleEn}" />`
          : ""
      }
    </div>
    ${
      pageCount > 1
        ? `<div class="lightbox-page-bar">
            <button type="button" id="ql-prev-page" ${ql.pageIdx === 0 ? "disabled" : ""}>${isHe ? "→ " : "← "}${gal.prevPage}</button>
            <span>${ql.pageIdx + 1} / ${pageCount}</span>
            <button type="button" id="ql-next-page" ${ql.pageIdx >= pageCount - 1 ? "disabled" : ""}>${gal.nextPage}${isHe ? " ←" : " →"}</button>
          </div>`
        : ""
    }
    <div class="lightbox-caption">
      <small>${isHe ? ql.metaHe : ql.metaEn}</small>
      <h3 id="lightbox-title">${isHe ? ql.titleHe : ql.titleEn}</h3>
      <p>${isHe ? ql.captionHe : ql.captionEn}</p>
    </div>
  `;

  body.querySelector("#ql-prev-page")?.addEventListener("click", () => {
    ql.pageIdx = Math.max(0, ql.pageIdx - 1);
    renderQuickLook();
  });
  body.querySelector("#ql-next-page")?.addEventListener("click", () => {
    ql.pageIdx = Math.min(pageCount - 1, ql.pageIdx + 1);
    renderQuickLook();
  });
}

function updateShelfActiveVisuals() {
  const shop = document.getElementById("shop");
  const pr = FEATURED_PRINTS[state.selectedPrintIndex];
  if (!shop || !pr) return;
  shop.dataset.selection = pr.id;
  const cta = shop.querySelector("#shelf-cta");
  if (cta) cta.textContent = pr[state.lang].cta;
  shop.querySelectorAll(".shelf-slide").forEach((el) => {
    const idx = Number(el.dataset.slideIdx);
    el.dataset.offset = String(Math.max(-2, Math.min(2, idx - state.selectedPrintIndex)));
  });
  shop.querySelectorAll("[data-pick-print]").forEach((btn, idx) => {
    btn.setAttribute("aria-current", String(idx === state.selectedPrintIndex));
  });
}

function scrollCarouselToIndex(idx, smooth = true) {
  const track = document.getElementById("shelf-track");
  if (!track) return;
  const slide = track.querySelector(`[data-slide-idx="${idx}"]`);
  if (!slide) return;
  const left = slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2;
  track.scrollTo({ left, behavior: smooth ? "smooth" : "instant" });
}

// =====================================================================
// SPLIT-PANE PRINT READER MODAL
// =====================================================================
function openPrintModal(printId) {
  state.activeModalPrintId = printId;
  const idx = FEATURED_PRINTS.findIndex((p) => p.id === printId);
  if (idx >= 0) state.selectedPrintIndex = idx;
  const pr = FEATURED_PRINTS[idx] || FEATURED_PRINTS[0];
  recordStop(pr.en.title, pr.he.title, pr.image);
  renderPrintModal(pr.id);
  const dlg = document.getElementById("print-dialog");
  if (!dlg.open) dlg.showModal();
}

function renderPrintModal(printId) {
  const copy = t();
  const idx = Math.max(0, FEATURED_PRINTS.findIndex((p) => p.id === printId));
  const pr = FEATURED_PRINTS[idx];
  const d = pr[state.lang];
  const isRtl = state.lang === "he";

  const top = document.getElementById("print-modal-top");
  top.innerHTML = `
    <button type="button" class="modal-close-btn" id="print-close-btn">
      ${state.view === "desk" ? copy.putBack : copy.backToShelf}
    </button>
    <div class="turn-prints">
      <button type="button" id="modal-prev-print" aria-label="Previous">${isRtl ? ICONS.arrowRight : ICONS.arrowLeft}</button>
      <span>${idx + 1} / ${FEATURED_PRINTS.length}</span>
      <button type="button" id="modal-next-print" aria-label="Next">${isRtl ? ICONS.arrowLeft : ICONS.arrowRight}</button>
    </div>
  `;
  top.querySelector("#print-close-btn").addEventListener("click", () => {
    document.getElementById("print-dialog").close();
  });
  top.querySelector("#modal-prev-print").addEventListener("click", () => {
    const prev = FEATURED_PRINTS[(idx - 1 + FEATURED_PRINTS.length) % FEATURED_PRINTS.length];
    openPrintModal(prev.id);
  });
  top.querySelector("#modal-next-print").addEventListener("click", () => {
    const next = FEATURED_PRINTS[(idx + 1) % FEATURED_PRINTS.length];
    openPrintModal(next.id);
  });

  const embeddedMedia = pr.videoSrc
    ? `<figure class="modal-media-box">
        <video controls playsinline preload="metadata" src="${assetUrl(pr.videoSrc)}" poster="${assetUrl(pr.videoPoster)}"></video>
        <figcaption>${state.lang === "he" ? "צפו בסרטון המקורי מ-Google ישראל" : "Watch the original Google Israel film"}</figcaption>
      </figure>`
    : pr.pages && pr.pages.length
    ? `<figure class="modal-media-box" style="cursor:pointer;" id="modal-open-ql-spread">
        <img src="${assetUrl(pr.pages[0])}" alt="${d.title}" />
        <figcaption>
          ${
            pr.pages.length > 1
              ? state.lang === "he"
                ? `לחצו לדפדוף מהיר בכל ${pr.pages.length} העמודים`
                : `Click for Quick-Look flipbook (${pr.pages.length} pages)`
              : state.lang === "he"
              ? "לחצו לצפייה מלאה"
              : "Click to view full-size"
          }
        </figcaption>
      </figure>`
    : "";

  const slot = document.getElementById("print-detail-slot");
  slot.innerHTML = `
    <div class="detail-art-col${pr.isKeepsake ? " is-keepsake" : ""}">
      <img src="${assetUrl(pr.image)}" alt="${d.title}" />
    </div>
    <div class="detail-body">
      <p class="detail-kicker">${d.category} · ${d.year}</p>
      <h2 id="print-dialog-title">${d.title}</h2>
      <div class="detail-actions">
        ${
          pr.pages && pr.pages.length && !pr.workbenchTab
            ? `<button type="button" class="outbound-btn" id="jump-to-ql-btn">${d.cta}</button>`
            : pr.workbenchTab
            ? `<button type="button" class="outbound-btn" id="jump-to-wb-tab">${d.cta}</button>`
            : `<button type="button" class="outbound-btn" id="jump-to-archive-cat">${d.cta}</button>`
        }
        ${
          !pr.isKeepsake
            ? `<button type="button" class="detail-secondary-link" id="jump-to-all-archive">
                ${state.lang === "he" ? "לפתוח בתיק העבודות" : "Open in Project Files"}
              </button>`
            : ""
        }
      </div>
      <div class="detail-prose">
        <p>${d.summary}</p>
        <p>${d.body2}</p>
      </div>
      ${embeddedMedia}
      <blockquote class="detail-quote">${d.quote}</blockquote>
      <div class="detail-toy">
        <h3>${state.lang === "he" ? "נקודות מפתח" : "Key details"}</h3>
        <ul class="detail-highlights">
          ${d.highlights.map((h) => `<li><b>${h.k}</b><span>${h.v}</span></li>`).join("")}
        </ul>
      </div>
    </div>
  `;

  const launchPrintQl = () => {
    document.getElementById("print-dialog").close();
    openQuickLook({
      titleEn: pr.en.title,
      titleHe: pr.he.title,
      metaEn: `${pr.en.category} · ${pr.en.year}`,
      metaHe: `${pr.he.category} · ${pr.he.year}`,
      captionEn: pr.en.summary,
      captionHe: pr.he.summary,
      pages: pr.pages || [pr.image],
      videoSrc: pr.videoSrc || null,
      poster: pr.videoPoster || pr.image,
    });
  };

  slot.querySelector("#modal-open-ql-spread")?.addEventListener("click", launchPrintQl);
  slot.querySelector("#jump-to-ql-btn")?.addEventListener("click", launchPrintQl);

  slot.querySelector("#jump-to-wb-tab")?.addEventListener("click", () => {
    state.wbTab = pr.workbenchTab;
    document.getElementById("print-dialog").close();
    openRoom("workbench");
  });
  slot.querySelector("#jump-to-archive-cat")?.addEventListener("click", () => {
    state.catFilter = pr.archiveCategory || "all";
    state.catPage = 0;
    document.getElementById("print-dialog").close();
    openRoom("archive");
  });
  slot.querySelector("#jump-to-all-archive")?.addEventListener("click", () => {
    state.catFilter = "all";
    state.catPage = 0;
    document.getElementById("print-dialog").close();
    openRoom("archive");
  });
}

// =====================================================================
// SHARED ROOM FOLIOS
// =====================================================================
function renderRoomContent() {
  const copy = t();
  const rail = document.getElementById("desk-rail");
  const isRtl = state.lang === "he";
  const backArrow = isRtl ? "→" : "←";
  const backLabel = state.view === "desk" ? copy.putBack : copy.backToShelf;

  rail.innerHTML = `
    <button type="button" class="back-to-desk" id="rail-back">${backArrow} ${backLabel}</button>
    <button type="button" data-rail="workbench" aria-current="${state.openRoom === "workbench" ? "page" : "false"}">${copy.nav.workbench}</button>
    <button type="button" data-rail="archive" aria-current="${state.openRoom === "archive" ? "page" : "false"}">${copy.nav.archive}</button>
    <button type="button" data-rail="notebook" aria-current="${state.openRoom === "notebook" ? "page" : "false"}">${copy.nav.notebook}</button>
    <button type="button" data-rail="letters" aria-current="${state.openRoom === "letters" ? "page" : "false"}">${copy.nav.letters}</button>
  `;
  rail.querySelector("#rail-back").addEventListener("click", () => openRoom(null));
  rail.querySelectorAll("[data-rail]").forEach((btn) =>
    btn.addEventListener("click", () => openRoom(btn.dataset.rail))
  );

  const container = document.getElementById("room-container");
  if (state.openRoom === "workbench") renderWorkbench(container);
  else if (state.openRoom === "archive") renderArchive(container);
  else if (state.openRoom === "notebook") renderNotebook(container);
  else if (state.openRoom === "letters") renderLetters(container);
}

// --- ROOM 1: THE WORKBENCH & FILMS ---
function renderWorkbench(container) {
  const wb = WORKBENCH_DATA[state.lang];
  const activeTab = state.wbTab;
  let sheetHtml = "";

  if (activeTab === "films") {
    const f = wb.films;
    const vid = VIDEOS[state.activeVideoIdx] || VIDEOS[0];
    const vd = vid[state.lang];
    sheetHtml = `
      <div class="wb-intro">
        <div class="wb-kicker-row">
          <img src="${assetUrl(vid.poster)}" alt="" />
          <div><span>${f.kicker}</span><small>${f.subkicker}</small></div>
        </div>
        <h3>${vd.title}</h3>
        <p>${vd.desc}</p>
        <p style="font: 12px var(--mono); color: var(--muted);">${vd.kicker} · ${vid.duration}</p>
      </div>
      <div class="film-player-frame">
        <video controls playsinline preload="metadata" src="${assetUrl(vid.src)}" poster="${assetUrl(vid.poster)}"></video>
        <div class="film-selector-row">
          ${VIDEOS.map(
            (v, i) => `
            <button type="button" class="film-pick-btn" data-pick-video="${i}" aria-pressed="${i === state.activeVideoIdx}">
              <img src="${assetUrl(v.poster)}" alt="" />
              <span>
                <strong>${v[state.lang].title}</strong>
                <small>${v.duration}</small>
              </span>
            </button>
          `
          ).join("")}
        </div>
      </div>
    `;
  } else if (activeTab === "audio") {
    const a = wb.audio;
    const ch = a.chapters[state.audioChapterIdx] || a.chapters[0];
    const barHeights = [28,46,62,38,74,85,54,42,68,90,76,48,36,64,82,58,44,72,88,60,34,52,78,66,40,70,84,56,48,62,74,42,30,54,68,46];
    sheetHtml = `
      <div class="wb-intro">
        <div class="wb-kicker-row">
          <img src="${assetUrl("assets/prints/audio-tour.jpg")}" alt="" />
          <div><span>${a.kicker}</span><small>${a.subkicker}</small></div>
        </div>
        <h3>${a.title}</h3>
        <p>${a.copy}</p>
        <button type="button" class="outbound-btn" id="wb-audio-toggle">
          ${state.audioPlaying ? ICONS.pause : ICONS.play}
          <span>${state.audioPlaying ? a.pauseLabel : a.playLabel}</span>
        </button>
      </div>
      <div class="wb-artifact-card">
        <div class="wb-meta-bar">
          <span>${a.metaLeft}</span>
          <span>${ch.time} · ${a.metaRight}</span>
        </div>
        <div class="audio-wave-stage" id="audio-wave-stage" role="slider" aria-label="Audio chapter timeline" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(state.audioProgress)}" tabindex="0">
          ${barHeights
            .map((h, i) => {
              const pct = (i / barHeights.length) * 100;
              return `<span class="audio-wave-bar ${pct <= state.audioProgress ? "played" : ""}" style="height:${h}%"></span>`;
            })
            .join("")}
          <span class="audio-playhead" style="left:${state.audioProgress}%"></span>
        </div>
        <div class="chapter-pills">
          ${a.chapters
            .map(
              (c, i) =>
                `<button type="button" data-audio-ch="${i}" aria-pressed="${i === state.audioChapterIdx}">${c.time} · ${c.label}</button>`
            )
            .join("")}
        </div>
        <div class="wb-chapter-story">
          <strong style="display:block; margin-bottom:4px;">${ch.headline}</strong>
          <span>${ch.story}</span>
        </div>
      </div>
    `;
  } else if (activeTab === "pyramid") {
    const p = wb.pyramid;
    const era = p.eras[state.pyramidEraIdx] || p.eras[3];
    sheetHtml = `
      <div class="wb-intro">
        <div class="wb-kicker-row">
          <img src="${assetUrl("assets/prints/hello-tech.jpg")}" alt="" />
          <div><span>${p.kicker}</span><small>${p.subkicker}</small></div>
        </div>
        <h3>${p.title}</h3>
        <p>${p.copy}</p>
      </div>
      <div class="wb-artifact-card">
        <div class="wb-meta-bar"><span>${p.metaLeft}</span><span>${p.metaRight}</span></div>
        <div class="chapter-pills">
          ${p.eras
            .map(
              (e, i) =>
                `<button type="button" data-era="${i}" aria-pressed="${i === state.pyramidEraIdx}">${e.label}</button>`
            )
            .join("")}
        </div>
        <div class="scale-stat-row">
          <div class="scale-stat"><strong>${era.students}</strong><small>${era.studentsSub}</small></div>
          <div class="scale-stat"><strong>${era.focus}</strong><small>${era.focusSub}</small></div>
          <div class="scale-stat"><strong>${era.partners}</strong><small>${era.partnersSub}</small></div>
        </div>
        <div class="pyramid-tiers">
          ${era.tiers.map((tr) => `<div class="pyramid-tier"><b>${tr.t}</b>${tr.d}</div>`).join("")}
        </div>
      </div>
    `;
  } else if (activeTab === "words") {
    const w = wb.words;
    const activeW = w.words.find((x) => x.id === state.activeWordId) || w.words[0];
    sheetHtml = `
      <div class="wb-intro">
        <div class="wb-kicker-row">
          <img src="${assetUrl("assets/prints/miloolita.jpg")}" alt="" />
          <div><span>${w.kicker}</span><small>${w.subkicker}</small></div>
        </div>
        <h3>${w.title}</h3>
        <p>${w.copy}</p>
        <p style="font: 12.5px var(--mono); color: var(--berry);">
          ${state.lang === "he" ? `נאספו לתיבה: ${state.collectedWords.length} / ${w.words.length}` : `Saved in chest: ${state.collectedWords.length} / ${w.words.length}`}
        </p>
      </div>
      <div class="wb-artifact-card">
        <div class="wb-meta-bar"><span>${w.metaLeft}</span><span>${w.metaRight}</span></div>
        <div class="word-cards-grid">
          ${w.words
            .map((item) => {
              const saved = state.collectedWords.includes(item.id);
              return `
                <button type="button" class="word-chip" data-word="${item.id}" aria-pressed="${saved}">
                  <strong>${state.lang === "he" ? item.he : item.en}</strong>
                  <small>${state.lang === "he" ? item.en : item.he}</small>
                </button>
              `;
            })
            .join("")}
        </div>
        <div class="chest-note">
          <strong style="font-style:normal; font-family:var(--headline); display:block; margin-bottom:4px;">
            ${activeW.he} · ${activeW.en}
          </strong>
          ${activeW.note}
        </div>
      </div>
    `;
  } else {
    const r = wb.reform;
    const act = r.acts[state.reformActIdx] || r.acts[0];
    sheetHtml = `
      <div class="wb-intro">
        <div class="wb-kicker-row">
          <img src="${assetUrl("assets/prints/high-voltage.jpg")}" alt="" />
          <div><span>${r.kicker}</span><small>${r.subkicker}</small></div>
        </div>
        <h3>${r.title}</h3>
        <p>${r.copy}</p>
      </div>
      <div class="wb-artifact-card">
        <div class="wb-meta-bar"><span>${r.metaLeft}</span><span>${r.metaRight}</span></div>
        <div class="reform-track">
          ${r.acts
            .map(
              (a, i) =>
                `<button type="button" data-act="${i}" aria-pressed="${i === state.reformActIdx}">${a.step}</button>`
            )
            .join("")}
        </div>
        <h4 style="font: 670 22px/1.18 var(--headline); margin-bottom: 10px;">${act.title}</h4>
        <p style="font-size:15px; line-height:1.62; margin-bottom:14px;">${act.body}</p>
        <div class="wb-chapter-story" style="font: 12.5px var(--mono); color: var(--berry);">${act.metric}</div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="room-head">
      <h2>${wb.heading}</h2>
      <p>${wb.sub}</p>
    </div>
    <div class="wb-tabs" role="tablist">
      ${wb.tabs
        .map(
          (tab) =>
            `<button type="button" data-wb-tab="${tab.id}" aria-pressed="${tab.id === activeTab}">${tab.label}</button>`
        )
        .join("")}
    </div>
    <div class="wb-sheet" data-panel="${activeTab}">
      ${sheetHtml}
    </div>
  `;

  container.querySelectorAll("[data-wb-tab]").forEach((b) =>
    b.addEventListener("click", () => {
      stopAudioSim();
      state.wbTab = b.dataset.wbTab;
      renderWorkbench(container);
    })
  );

  container.querySelectorAll("[data-pick-video]").forEach((b) =>
    b.addEventListener("click", () => {
      state.activeVideoIdx = Number(b.dataset.pickVideo);
      renderWorkbench(container);
    })
  );

  container.querySelectorAll("[data-audio-ch]").forEach((b) =>
    b.addEventListener("click", () => {
      const idx = Number(b.dataset.audioCh);
      state.audioChapterIdx = idx;
      state.audioProgress = wb.audio.chapters[idx].pos;
      playSoftChime(440 + idx * 55);
      renderWorkbench(container);
    })
  );

  container.querySelector("#audio-wave-stage")?.addEventListener("click", (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    state.audioProgress = pct;
    const chs = wb.audio.chapters;
    let best = 0;
    chs.forEach((c, i) => {
      if (pct >= c.pos - 6) best = i;
    });
    state.audioChapterIdx = best;
    playSoftChime(440 + best * 55);
    renderWorkbench(container);
  });

  container.querySelector("#wb-audio-toggle")?.addEventListener("click", () => {
    if (state.audioPlaying) {
      stopAudioSim();
      renderWorkbench(container);
    } else {
      state.audioPlaying = true;
      playSoftChime(523.25);
      renderWorkbench(container);
      audioTimer = setInterval(() => {
        const prevCh = state.audioChapterIdx;
        state.audioProgress = (state.audioProgress + 1.8) % 100;
        const chs = WORKBENCH_DATA[state.lang].audio.chapters;
        let best = 0;
        chs.forEach((c, i) => {
          if (state.audioProgress >= c.pos) best = i;
        });
        state.audioChapterIdx = best;
        if (best !== prevCh) playSoftChime(440 + best * 55);
        if (state.openRoom === "workbench" && state.wbTab === "audio") {
          renderWorkbench(document.getElementById("room-container"));
        } else {
          stopAudioSim();
        }
      }, 280);
    }
  });

  container.querySelectorAll("[data-era]").forEach((b) =>
    b.addEventListener("click", () => {
      state.pyramidEraIdx = Number(b.dataset.era);
      renderWorkbench(container);
    })
  );

  container.querySelectorAll("[data-word]").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.word;
      state.activeWordId = id;
      if (!state.collectedWords.includes(id)) state.collectedWords.push(id);
      renderWorkbench(container);
    })
  );

  container.querySelectorAll("[data-act]").forEach((b) =>
    b.addEventListener("click", () => {
      state.reformActIdx = Number(b.dataset.act);
      renderWorkbench(container);
    })
  );
}

function stopAudioSim() {
  state.audioPlaying = false;
  if (audioTimer) {
    clearInterval(audioTimer);
    audioTimer = null;
  }
}

// --- ROOM 2: THE PROJECT FILES (Quick-Look Visual Archive) ---
function renderArchive(container) {
  const isHe = state.lang === "he";
  const q = state.catSearch.trim().toLowerCase();

  const filtered = CATALOGUE_ITEMS.filter((item) => {
    const matchCat = state.catFilter === "all" || item.category === state.catFilter;
    if (!matchCat) return false;
    if (!q) return true;
    return (
      item.en.title.toLowerCase().includes(q) ||
      item.en.desc.toLowerCase().includes(q) ||
      item.he.title.toLowerCase().includes(q) ||
      item.he.desc.toLowerCase().includes(q) ||
      item.year.toLowerCase().includes(q)
    );
  });

  const perPage = 6;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  state.catPage = Math.min(state.catPage, totalPages - 1);
  const visibleItems = state.catShowAll
    ? filtered
    : filtered.slice(state.catPage * perPage, (state.catPage + 1) * perPage);

  const countFor = (catId) =>
    catId === "all"
      ? CATALOGUE_ITEMS.length
      : CATALOGUE_ITEMS.filter((i) => i.category === catId).length;

  container.innerHTML = `
    <div class="archive-head">
      <div class="room-head" style="margin-bottom:0;">
        <h2>${isHe ? "תיק העבודות" : "The project files"}</h2>
      </div>
      <input
        type="search"
        class="archive-search"
        id="archive-search"
        value="${state.catSearch.replace(/"/g, "&quot;")}"
        placeholder="${isHe ? "חיפוש פרויקט, ספר או סרטון..." : "Find a project, book or film..."}"
        aria-label="${isHe ? "חיפוש בארכיון" : "Search archive"}"
      />
    </div>

    <div class="file-cabinet">
      <div class="file-dividers">
        <img src="${assetUrl("assets/prints/card-file-box.jpg")}" alt="${isHe ? "תיבת כרטיסיות ארכיון" : "Wooden index-card file box"}" />
        <div class="catalogue-filters" role="group" aria-label="Categories">
          ${CATALOGUE_CATEGORIES.map(
            (cat) => `
            <button type="button" data-cat="${cat.id}" aria-pressed="${state.catFilter === cat.id}">
              <span>${cat[state.lang]}</span>
              <span class="tab-count">${countFor(cat.id)}</span>
            </button>
          `
          ).join("")}
        </div>
      </div>

      <div class="file-stack">
        ${
          visibleItems.length
            ? `<ul class="catalogue-list">
                ${visibleItems
                  .map((item) => {
                    const d = item[state.lang];
                    const isExpanded = state.expandedCatId === item.id;
                    const hasQuickLook = Boolean(item.videoSrc || (item.pages && item.pages.length));
                    const thumbHtml = item.thumb
                      ? `<button type="button" class="cat-thumb-btn" data-cat-media="${item.id}" aria-label="${d.title}">
                           <img src="${assetUrl(item.thumb)}" alt="" loading="lazy" />
                           ${item.videoSrc ? `<span class="cat-thumb-play">${ICONS.play}</span>` : ""}
                         </button>`
                      : "";
                    return `
                      <li class="${isExpanded ? "expanded-entry" : ""}">
                        <div class="${item.thumb ? "cat-row-grid" : ""}">
                          ${thumbHtml}
                          <div>
                            <div class="cat-item-top">
                              <button type="button" class="cat-item-title" data-toggle-cat="${item.id}">${d.title}</button>
                              <span class="cat-item-year">${item.year}</span>
                            </div>
                            <p class="cat-item-desc">${d.desc}</p>
                            <div class="cat-item-links">
                              ${
                                item.videoSrc
                                  ? `<button type="button" data-cat-media="${item.id}">${isHe ? "לצפייה בסרטון ▶" : "Watch film ▶"}</button>`
                                  : hasQuickLook
                                  ? `<button type="button" data-cat-media="${item.id}">${isHe ? `תצוגה מהירה (${item.pages.length})` : `Quick-Look (${item.pages.length})`}</button>`
                                  : ""
                              }
                              <button type="button" data-toggle-cat="${item.id}">
                                ${isExpanded ? (isHe ? "סגירת הרחבה" : "Hide note") : (isHe ? "פרטים נוספים" : "Read note")}
                              </button>
                              ${
                                item.printId
                                  ? `<button type="button" data-open-print-cat="${item.printId}">${isHe ? "לפתוח הדפס" : "Open print"}</button>`
                                  : ""
                              }
                            </div>
                          </div>
                        </div>
                        ${
                          isExpanded
                            ? `<div class="${item.videoSrc || (item.pages && item.pages.length) ? "cat-clipping-preview" : ""}" style="${item.videoSrc || (item.pages && item.pages.length) ? "" : "margin-top:12px; padding-top:10px; border-top:1px dashed #c4ae98;"}">
                                ${
                                  item.videoSrc
                                    ? `<video controls playsinline preload="metadata" src="${assetUrl(item.videoSrc)}" poster="${assetUrl(item.thumb)}" style="width:100%; border-radius:2px; background:#1c1720;"></video>`
                                    : item.pages && item.pages.length
                                    ? `<img src="${assetUrl(item.pages[0])}" alt="${d.title}" style="cursor:pointer;" data-cat-media="${item.id}" />`
                                    : ""
                                }
                                <p style="font-size:14.5px; line-height:1.62; color:var(--ink);">${d.extra}</p>
                              </div>`
                            : ""
                        }
                      </li>
                    `;
                  })
                  .join("")}
              </ul>`
            : `<div class="catalogue-list" style="display:block; padding:28px;">
                <p>${isHe ? "לא נמצאו פרויקטים תואמים." : "No matching projects found."}</p>
                <button type="button" class="show-all-btn" id="clear-cat" style="margin-top:12px;">${isHe ? "ניקוי סינון" : "Clear filters"}</button>
              </div>`
        }

        <div class="catalogue-tail">
          ${
            !state.catShowAll && filtered.length > perPage
              ? `<div class="file-pager">
                  <button type="button" id="cat-prev" ${state.catPage === 0 ? "disabled" : ""}>←</button>
                  <span>${state.catPage + 1} / ${totalPages}</span>
                  <button type="button" id="cat-next" ${state.catPage >= totalPages - 1 ? "disabled" : ""}>→</button>
                </div>`
              : ""
          }
          <span class="catalogue-count">
            ${
              isHe
                ? `${visibleItems.length} מתוך ${filtered.length} עבודות`
                : `${visibleItems.length} of ${filtered.length} works`
            }
          </span>
          ${
            filtered.length > perPage
              ? `<button type="button" class="show-all-btn" id="toggle-show-all">
                  ${state.catShowAll ? (isHe ? "תצוגת עמודים" : "Paginate") : (isHe ? `להציג את כל ${filtered.length}` : `Show all ${filtered.length}`)}
                </button>`
              : ""
          }
        </div>
      </div>
    </div>
  `;

  const searchInput = container.querySelector("#archive-search");
  searchInput.addEventListener("input", (e) => {
    state.catSearch = e.target.value;
    state.catPage = 0;
    renderArchive(container);
    const restored = container.querySelector("#archive-search");
    restored.focus();
    restored.setSelectionRange(restored.value.length, restored.value.length);
  });

  container.querySelectorAll("[data-cat]").forEach((b) =>
    b.addEventListener("click", () => {
      state.catFilter = b.dataset.cat;
      state.catPage = 0;
      state.expandedCatId = null;
      renderArchive(container);
    })
  );

  container.querySelectorAll("[data-toggle-cat]").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.toggleCat;
      state.expandedCatId = state.expandedCatId === id ? null : id;
      renderArchive(container);
    })
  );

  container.querySelectorAll("[data-cat-media]").forEach((b) =>
    b.addEventListener("click", () => {
      const item = CATALOGUE_ITEMS.find((x) => x.id === b.dataset.catMedia);
      if (!item) return;
      openQuickLook({
        titleEn: item.en.title,
        titleHe: item.he.title,
        metaEn: item.year,
        metaHe: item.year,
        captionEn: item.en.extra || item.en.desc,
        captionHe: item.he.extra || item.he.desc,
        pages: item.pages || (item.thumb ? [item.thumb] : []),
        videoSrc: item.videoSrc || null,
        poster: item.thumb || null,
      });
    })
  );

  container.querySelectorAll("[data-open-print-cat]").forEach((b) =>
    b.addEventListener("click", () => openPrintModal(b.dataset.openPrintCat))
  );

  container.querySelector("#cat-prev")?.addEventListener("click", () => {
    state.catPage = Math.max(0, state.catPage - 1);
    renderArchive(container);
  });
  container.querySelector("#cat-next")?.addEventListener("click", () => {
    state.catPage = Math.min(totalPages - 1, state.catPage + 1);
    renderArchive(container);
  });
  container.querySelector("#toggle-show-all")?.addEventListener("click", () => {
    state.catShowAll = !state.catShowAll;
    renderArchive(container);
  });
  container.querySelector("#clear-cat")?.addEventListener("click", () => {
    state.catFilter = "all";
    state.catSearch = "";
    state.catPage = 0;
    renderArchive(container);
  });
}

// --- ROOM 3: MY NOTEBOOK ---
function renderNotebook(container) {
  const nb = NOTEBOOK_SPREADS[state.lang];
  const leaf = nb.tabs[state.notebookTabIdx] || nb.tabs[0];
  const isRtl = state.lang === "he";

  container.innerHTML = `
    <div class="room-head">
      <h2>${nb.heading}</h2>
      <p>${nb.intro}</p>
    </div>

    <div class="notebook-tabs" role="tablist">
      ${nb.tabs
        .map(
          (tab, i) =>
            `<button type="button" data-nb-tab="${i}" aria-current="${i === state.notebookTabIdx ? "page" : "false"}">${tab.label}</button>`
        )
        .join("")}
    </div>

    <div class="notebook-spread">
      <article class="notebook-page">
        <figure class="leaf-art">
          <div>
            <img src="${assetUrl(leaf.image)}" alt="${leaf.title}" />
            <figcaption>${leaf.caption}</figcaption>
          </div>
        </figure>
        <div class="leaf-writing">
          <h3>${leaf.title}</h3>
          <p>${leaf.p1}</p>
          <p>${leaf.p2}</p>
          <div class="notebook-callout">
            <small>${leaf.calloutKicker}</small>
            <h4>${leaf.calloutTitle}</h4>
            <p>${leaf.calloutMeta}</p>
          </div>
        </div>
      </article>
    </div>

    <div class="leaf-pager file-pager">
      <button type="button" id="nb-prev" aria-label="Previous spread">${isRtl ? "→" : "←"}</button>
      <span>${state.notebookTabIdx + 1} / ${nb.tabs.length}</span>
      <button type="button" id="nb-next" aria-label="Next spread">${isRtl ? "←" : "→"}</button>
    </div>
  `;

  container.querySelectorAll("[data-nb-tab]").forEach((b) =>
    b.addEventListener("click", () => {
      state.notebookTabIdx = Number(b.dataset.nbTab);
      renderNotebook(container);
    })
  );
  container.querySelector("#nb-prev").addEventListener("click", () => {
    state.notebookTabIdx = (state.notebookTabIdx - 1 + nb.tabs.length) % nb.tabs.length;
    renderNotebook(container);
  });
  container.querySelector("#nb-next").addEventListener("click", () => {
    state.notebookTabIdx = (state.notebookTabIdx + 1) % nb.tabs.length;
    renderNotebook(container);
  });
}

// --- ROOM 4: LETTERS & LINKS ---
function renderLetters(container) {
  const copy = t();
  const isHe = state.lang === "he";

  container.innerHTML = `
    <div class="room-head">
      <h2>${isHe ? "מכתבים וקישורים." : "Letters & links."}</h2>
      <p>${isHe ? "ליוזמות חינוך, הרצאות, ספרים, עריכה או שיתופי פעולה — אשמח לשמוע." : "For AI education collaborations, books, editorial work, or speaking—drop a line."}</p>
    </div>

    <div class="address-links">
      <button type="button" class="address-row" data-copy="${PROFILE.email}" data-copy-id="email">
        <span>${isHe ? "דוא\"ל" : "Email"}</span>
        <small>${PROFILE.email}${state.copiedField === "email" ? " ✓" : ""}</small>
        <span>${ICONS.mail}</span>
      </button>

      <a class="address-row" href="${PROFILE.linkedinUrl}" target="_blank" rel="noopener">
        <span>LinkedIn</span>
        <small>${PROFILE.linkedinHandle}</small>
        <span>${ICONS.arrowUpRight}</span>
      </a>

      <button type="button" class="address-row" data-copy="${PROFILE.phone}" data-copy-id="phone">
        <span>${isHe ? "טלפון" : "Phone"}</span>
        <small dir="ltr">${PROFILE.phone}${state.copiedField === "phone" ? " ✓" : ""}</small>
        <span>${state.copiedField === "phone" ? "✓" : "⎘"}</span>
      </button>

      <button type="button" class="address-row" id="letters-resume-ql">
        <span>${isHe ? "קורות חיים (תצוגה מהירה + PDF)" : "Resume (Quick-Look + PDF)"}</span>
        <small>2 pages · PDF</small>
        <span>${ICONS.fileText}</span>
      </button>
    </div>

    <div class="letters-postcard-cta">
      <div>
        <strong style="display:block; font-size:18px; margin-bottom:4px;">${copy.postcard.openFromLetters}</strong>
        <span style="font-size:14px; color:var(--muted);">${copy.postcard.openFromLettersDesc}</span>
      </div>
      <button type="button" class="outbound-btn" id="open-postcard-from-letters">${copy.postcard.title}</button>
    </div>
  `;

  container.querySelectorAll("[data-copy]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(btn.dataset.copy); } catch {}
      state.copiedField = btn.dataset.copyId;
      renderLetters(container);
    })
  );

  container.querySelector("#letters-resume-ql").addEventListener("click", () => openResumeQuickLook());
  container.querySelector("#open-postcard-from-letters").addEventListener("click", () => openPostcardModal());
}

// =====================================================================
// KEEPSAKE POSTCARD MODAL
// =====================================================================
function openPostcardModal() {
  renderPostcardModal();
  const dlg = document.getElementById("postcard-dialog");
  document.getElementById("postcard-flip-card").classList.remove("is-flipped");
  if (!dlg.open) dlg.showModal();
}

function renderPostcardModal() {
  const copy = t();
  const isHe = state.lang === "he";
  document.getElementById("postcard-hint").textContent = isHe
    ? "לחצו על הגלויה כדי להפוך אותה"
    : "Click the postcard to flip it over";
  document.getElementById("postcard-close").textContent = copy.postcard.close;

  const stops = state.visitedStops.length
    ? state.visitedStops.map((s) => s[state.lang])
    : [copy.postcard.defaultStop];

  const hour = new Date().getHours();
  const recipient =
    hour < 5 || hour >= 22
      ? copy.postcard.toNight
      : hour < 10
      ? copy.postcard.toMorning
      : copy.postcard.toDay;

  const timeStr = new Date().toLocaleTimeString(isHe ? "he-IL" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  document.getElementById("postcard-back").innerHTML = `
    <div class="post-message">
      <h3>${copy.postcard.title}</h3>
      <p>${copy.postcard.stopsLabel}</p>
      <ol>
        ${stops.map((s) => `<li>${s}</li>`).join("")}
      </ol>
    </div>
    <div class="post-address">
      <img class="post-stamp" src="${assetUrl(state.lastStampSrc)}" alt="" />
      <div>
        <p>${recipient}</p>
        <small style="margin-top:8px;">${copy.location}</small>
        <small>${timeStr} · WebGL 2</small>
      </div>
    </div>
  `;

  const ctrls = document.getElementById("postcard-controls");
  ctrls.innerHTML = `
    <button type="button" id="flip-postcard-btn">${copy.postcard.flipBtn}</button>
    <button type="button" id="save-postcard-btn">${copy.postcard.saveBtn}</button>
  `;
  ctrls.querySelector("#flip-postcard-btn").addEventListener("click", () => {
    document.getElementById("postcard-flip-card").classList.toggle("is-flipped");
  });
  ctrls.querySelector("#save-postcard-btn").addEventListener("click", async () => {
    const status = document.getElementById("postcard-status");
    await exportPostcardPng({
      lang: state.lang,
      copy,
      stops,
      stampSrc: state.lastStampSrc,
    });
    status.textContent = copy.postcard.savedMsg;
  });
}

// =====================================================================
// BOOTSTRAP
// =====================================================================
mountScaffold();
renderAll();
updateStudioOpenState();

const deskStage = document.getElementById("desk-overview");
const deskCanvas = document.getElementById("desk-canvas");
const hoverLabel = document.getElementById("desk-hover-label");

deskApi = mountDeskScene({
  container: deskStage,
  canvas: deskCanvas,
  prints: FEATURED_PRINTS,
  getPerformanceMode: () => state.performanceMode,
  onHoverObject: (meta, x, y) => {
    if (!meta) {
      hoverLabel.classList.remove("visible");
      return;
    }
    const copy = t();
    let label = copy.deskTips[meta.id] || "";
    if (meta.action === "print" && meta.printId && meta.id !== "milly") {
      const pr = FEATURED_PRINTS.find((p) => p.id === meta.printId);
      if (pr) label = pr[state.lang].title;
    }
    hoverLabel.textContent = label;
    hoverLabel.style.left = `${x}px`;
    hoverLabel.style.top = `${y}px`;
    hoverLabel.classList.add("visible");
  },
  onSelectObject: (meta) => {
    if (meta.action === "room") openRoom(meta.room);
    else if (meta.action === "print") openPrintModal(meta.printId);
    else if (meta.action === "scratch") {
      renderScratchChrome();
      scratchApi.open();
    } else if (meta.action === "postcard") {
      openPostcardModal();
    }
  },
  onLampToggle: (isNight) => {
    state.nightMode = isNight;
    renderDeskChrome();
  },
  onDrawerToggle: () => {
    setTimeout(() => openPostcardModal(), 420);
  },
});

if (state.view === "shelf") {
  deskApi?.setPaused(true);
  requestAnimationFrame(() => scrollCarouselToIndex(state.selectedPrintIndex, false));
}
