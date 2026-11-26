import {
  PROFILE,
  VIDEOS,
  GALLERY_ITEMS,
  FEATURED_PRINTS,
  WORKBENCH_DATA,
  CATALOGUE_CATEGORIES,
  CATALOGUE_ITEMS,
  NOTEBOOK_SPREADS,
} from "../data/portfolioData.js";
import { assetUrl } from "../utils/assetUrl.js";
import {
  saveDraft,
  discardDraft,
  resetToDefaults,
  getHasDraft,
  getLastPublishedMeta,
  exportContentJson,
  importContentJson,
  loadPublishConfig,
  savePublishConfig,
  testGitHubConnection,
  publishToGitHub,
} from "./contentStore.js";

const UI_COPY = {
  he: {
    studioTitle: "סטודיו ניהול תוכן",
    studioSub: "עריכת כל הטקסטים והרכיבים ב-orinwinberg.com",
    previewBtn: "תצוגה מקדימה באתר",
    publishQuickBtn: "פרסום לאתר",
    closeBtn: "סגירה",
    draftBadge: "טיוטה פעילה (טרם פורסם)",
    syncedBadge: "מסונכרן עם האתר החי",
    savedToast: "נשמר כטיוטה מקומית",
    searchPlaceholder: "חיפוש טקסט, ספר או פרויקט…",
    langHe: "עברית",
    langEn: "English",
    langBoth: "דו-לשוני",
    navContent: "תוכן ועמודים",
    navSystem: "פרסום וגיבוי",
    sections: {
      profile: { label: "עמוד הבית ופרופיל", desc: "כותרת פתיחה, ביוגרפיה, פרטי קשר, תפריט ניווט, פתק 'במבט מהיר' ובועות שולחן ה-3D." },
      shelf: { label: "מדף הפרויקטים", desc: "כל 8 הכרטיסים, הספרים והמסגרת של מילי שעל המדף — עריכת טקסטים, הסתרה ושינוי סדר." },
      gallery: { label: "גלריית מדיה", desc: "כל 13 הפריטים בגלריית הצילומים, הסרטונים והכפולות." },
      films: { label: "סרטונים (Google)", desc: "כותרות, תיאורים וזמני נגינה של סרטוני הווידאו." },
      archive: { label: "תיק העבודות", desc: "כל העבודות בארכיון — כולל אפשרות להוסיף עבודות חדשות או להסתיר פריטים." },
      notebook: { label: "המחברת שלי", desc: "טקסט הפתיחה ו-4 כרטיסיות הסיפור האישי והקריירה." },
      workbench: { label: "שולחן העבודה", desc: "סיור האודיו ב-AI, צמיחת Hello Tech, תיבת המילים של מילוליתא וציר הרפורמה." },
      publish: { label: "פרסום וגיבוי", desc: "פרסום ישיר בלחיצה אחת ל-orinwinberg.com, ייצוא גיבוי או שחזור טיוטה." },
    },
    show: "מוצג",
    hidden: "מוסתר",
    moveUp: "למעלה",
    moveDown: "למטה",
    addRow: "+ הוספת שורה",
    addWork: "+ הוספת עבודה חדשה",
    deleteBtn: "מחיקה",
    draftBannerText: "תצוגה מקדימה: מוצגת טיוטת העריכה שלך",
    draftBannerOpen: "חזרה לסטודיו העריכה",
    draftBannerPublish: "פרסמי לאתר",
  },
  en: {
    studioTitle: "Content Studio",
    studioSub: "Edit any text, page, or asset on orinwinberg.com",
    previewBtn: "Preview on site",
    publishQuickBtn: "Publish",
    closeBtn: "Close",
    draftBadge: "Local draft (unpublished)",
    syncedBadge: "Synced with live site",
    savedToast: "Saved to local draft",
    searchPlaceholder: "Search any text, book, or item…",
    langHe: "עברית",
    langEn: "English",
    langBoth: "Both",
    navContent: "Pages & Assets",
    navSystem: "Publish & Backup",
    sections: {
      profile: { label: "Home & Profile", desc: "Greeting, bio, contact info, navigation labels, 'At a glance' card, and 3D desk tooltips." },
      shelf: { label: "Project Shelf", desc: "All 8 featured prints, books & Milly's portrait — edit copy, reorder, or show/hide." },
      gallery: { label: "Media Gallery", desc: "All 13 photos, films, and multi-page book/press spreads in the gallery." },
      films: { label: "Films (Google)", desc: "Titles, kickers, durations, and descriptions for the embedded HD films." },
      archive: { label: "Project Files", desc: "All works in the searchable archive — edit, hide/show, reorder, or add new works." },
      notebook: { label: "My Notebook", desc: "Intro text and all 4 career & personal tabs." },
      workbench: { label: "Studio Workbench", desc: "AI Audio Tour chapters, Hello Tech eras, Miloolita words & High Voltage reform acts." },
      publish: { label: "Publish & Backup", desc: "One-click live publishing to orinwinberg.com, JSON backup export/import, and reset." },
    },
    show: "Visible",
    hidden: "Hidden",
    moveUp: "Up",
    moveDown: "Down",
    addRow: "+ Add row",
    addWork: "+ Add new work",
    deleteBtn: "Delete",
    draftBannerText: "Previewing your local draft edits",
    draftBannerOpen: "Back to Content Studio",
    draftBannerPublish: "Publish live",
  },
};

function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getByPath(root, path) {
  let cur = root;
  for (const seg of path) {
    if (cur == null) return "";
    cur = cur[seg];
  }
  return cur ?? "";
}

function setByPath(root, path, value) {
  let cur = root;
  for (let i = 0; i < path.length - 1; i++) {
    if (cur[path[i]] == null) cur[path[i]] = {};
    cur = cur[path[i]];
  }
  cur[path[path.length - 1]] = value;
}

export function initAdminStudio({ getSiteLang, onSiteRefresh }) {
  const adminState = {
    activeSection: "profile",
    editLang: getSiteLang() === "en" ? "en" : "he", // "he" | "en" | "both"
    search: "",
    openCards: new Set(["shelf-high-voltage", "shelf-milly", "nb-0", "wb-films", "wb-audio"]),
    publishBusy: false,
    publishMsg: null, // { type: "ok" | "err" | "info", text: string }
    showToken: false,
  };

  // Mount dialog + floating draft preview banner once
  const dialog = document.createElement("dialog");
  dialog.id = "admin-dialog";
  dialog.className = "admin-dialog";
  dialog.setAttribute("aria-label", "Orin Content Studio");
  document.body.appendChild(dialog);

  const banner = document.createElement("div");
  banner.id = "admin-draft-banner";
  banner.className = "admin-draft-banner";
  document.body.appendChild(banner);

  function ui() {
    return UI_COPY[getSiteLang() === "en" ? "en" : "he"];
  }

  function isHeUi() {
    return getSiteLang() !== "en";
  }

  function getRootMap() {
    return {
      PROFILE,
      VIDEOS,
      GALLERY_ITEMS,
      FEATURED_PRINTS,
      WORKBENCH_DATA,
      CATALOGUE_ITEMS,
      NOTEBOOK_SPREADS,
    };
  }

  function updateDraftBanner() {
    const copy = ui();
    const show = getHasDraft() && !dialog.open;
    banner.classList.toggle("is-visible", show);
    if (!show) return;
    banner.innerHTML = `
      <span>${copy.draftBannerText}</span>
      <button type="button" id="banner-open-admin">${copy.draftBannerOpen}</button>
      <button type="button" id="banner-go-publish">${copy.draftBannerPublish}</button>
    `;
    banner.querySelector("#banner-open-admin").addEventListener("click", () => openAdmin());
    banner.querySelector("#banner-go-publish").addEventListener("click", () => openAdmin("publish"));
  }

  // Render a bilingual or single-language field pair cleanly without ever jumping cursors
  function fieldPair({
    labelHe,
    labelEn,
    rootKey,
    pathHe,
    pathEn,
    multiline = false,
    short = false,
  }) {
    const root = getRootMap()[rootKey];
    const showHe = adminState.editLang === "he" || adminState.editLang === "both";
    const showEn = adminState.editLang === "en" || adminState.editLang === "both";
    const single = !(showHe && showEn);
    const label = isHeUi() ? labelHe : labelEn;

    const renderControl = (lang, path) => {
      const val = getByPath(root, path);
      const dir = lang === "he" ? "rtl" : "ltr";
      const tag = lang === "he" ? "עברית" : "EN";
      const tagCls = lang === "he" ? "admin-lang-tag is-he" : "admin-lang-tag";
      const dataAttrs = `data-bind-root="${rootKey}" data-bind-path="${esc(JSON.stringify(path))}"`;
      const inputHtml = multiline
        ? `<textarea class="${short ? "is-short" : ""}" dir="${dir}" lang="${lang}" ${dataAttrs}>${esc(val)}</textarea>`
        : `<input type="text" dir="${dir}" lang="${lang}" value="${esc(val)}" ${dataAttrs} />`;
      return `
        <div class="admin-field">
          <label><span>${esc(label)}</span><span class="${tagCls}">${tag}</span></label>
          ${inputHtml}
        </div>
      `;
    };

    return `
      <div class="admin-field-row ${single ? "is-single" : ""}">
        ${showHe ? renderControl("he", pathHe) : ""}
        ${showEn ? renderControl("en", pathEn) : ""}
      </div>
    `;
  }

  function singleField({ labelHe, labelEn, rootKey, path, type = "text", dir = "ltr", options = null }) {
    const root = getRootMap()[rootKey];
    const val = getByPath(root, path);
    const label = isHeUi() ? labelHe : labelEn;
    const dataAttrs = `data-bind-root="${rootKey}" data-bind-path="${esc(JSON.stringify(path))}"`;
    let ctrl = "";
    if (options) {
      ctrl = `<select ${dataAttrs}>${options
        .map((o) => `<option value="${esc(o.value)}" ${o.value === val ? "selected" : ""}>${esc(o.label)}</option>`)
        .join("")}</select>`;
    } else {
      ctrl = `<input type="${type}" dir="${dir}" value="${esc(val)}" ${dataAttrs} />`;
    }
    return `
      <div class="admin-field">
        <label><span>${esc(label)}</span></label>
        ${ctrl}
      </div>
    `;
  }

  function matchesSearch(...values) {
    const q = adminState.search.trim().toLowerCase();
    if (!q) return true;
    return values.some((v) => String(v ?? "").toLowerCase().includes(q));
  }

  // ===================================================================
  // Section Renderers
  // ===================================================================
  function renderProfileSection() {
    const he = isHeUi();
    let html = "";

    // 1. Contact & Links
    if (matchesSearch("email phone linkedin contact קשר מייל טלפון", PROFILE.email, PROFILE.phone, PROFILE.linkedinHandle)) {
      html += `
        <div class="admin-section-box">
          <h4>${he ? "פרטי קשר וקישורים" : "Contact Details & Links"}</h4>
          <div class="admin-field-row">
            ${singleField({ labelHe: "אימייל", labelEn: "Email", rootKey: "PROFILE", path: ["email"], type: "email" })}
            ${singleField({ labelHe: "טלפון", labelEn: "Phone", rootKey: "PROFILE", path: ["phone"], type: "text" })}
          </div>
          <div class="admin-field-row">
            ${singleField({ labelHe: "קישור LinkedIn", labelEn: "LinkedIn URL", rootKey: "PROFILE", path: ["linkedinUrl"], type: "url" })}
            ${singleField({ labelHe: "טקסט תצוגה LinkedIn", labelEn: "LinkedIn Display Handle", rootKey: "PROFILE", path: ["linkedinHandle"], type: "text" })}
          </div>
        </div>
      `;
    }

    // 2. Identity & Hero
    if (
      matchesSearch(
        "hero bio greeting name role פתיחה שם ביוגרפיה",
        PROFILE.he.name,
        PROFILE.en.name,
        PROFILE.he.greeting,
        PROFILE.en.greeting,
        PROFILE.he.bio1,
        PROFILE.en.bio1
      )
    ) {
      html += `
        <div class="admin-section-box">
          <h4>${he ? "זהות ופתיחה (עמוד הבית והמדף)" : "Identity & Hero Welcome"}</h4>
          ${fieldPair({ labelHe: "שם מלא", labelEn: "Full Name", rootKey: "PROFILE", pathHe: ["he", "name"], pathEn: ["en", "name"] })}
          ${fieldPair({ labelHe: "שורת תפקיד קצרה", labelEn: "Short Role Line", rootKey: "PROFILE", pathHe: ["he", "roleShort"], pathEn: ["en", "roleShort"] })}
          ${fieldPair({ labelHe: "כותרת פתיחה גדולה", labelEn: "Hero Greeting", rootKey: "PROFILE", pathHe: ["he", "greeting"], pathEn: ["en", "greeting"] })}
          ${fieldPair({ labelHe: "פסקת ביוגרפיה ראשונה", labelEn: "Bio Paragraph 1", rootKey: "PROFILE", pathHe: ["he", "bio1"], pathEn: ["en", "bio1"], multiline: true })}
          ${fieldPair({ labelHe: "פסקת ביוגרפיה שנייה", labelEn: "Bio Paragraph 2", rootKey: "PROFILE", pathHe: ["he", "bio2"], pathEn: ["en", "bio2"], multiline: true, short: true })}
          ${fieldPair({ labelHe: "מיקום", labelEn: "Location", rootKey: "PROFILE", pathHe: ["he", "location"], pathEn: ["en", "location"] })}
        </div>
      `;
    }

    // 3. Shelf, Gallery, Navigation & Footer labels
    if (
      matchesSearch(
        "shelf gallery nav footer מדף גלריה ניווט כותרת תחתונה",
        PROFILE.he.shelfTitle,
        PROFILE.en.shelfTitle,
        PROFILE.he.gallery.heading,
        PROFILE.en.gallery.heading,
        PROFILE.he.footerCredit
      )
    ) {
      html += `
        <div class="admin-section-box">
          <h4>${he ? "כותרות המדף, הגלריה, הניווט והתחתית" : "Shelf, Gallery, Navigation & Footer"}</h4>
          ${fieldPair({ labelHe: "כותרת מדף הפרויקטים", labelEn: "Project Shelf Heading", rootKey: "PROFILE", pathHe: ["he", "shelfTitle"], pathEn: ["en", "shelfTitle"] })}
          ${fieldPair({ labelHe: "משפט הסבר למדף", labelEn: "Shelf Hint", rootKey: "PROFILE", pathHe: ["he", "shelfHint"], pathEn: ["en", "shelfHint"] })}
          ${fieldPair({ labelHe: "כותרת גלריית המדיה", labelEn: "Media Gallery Heading", rootKey: "PROFILE", pathHe: ["he", "gallery", "heading"], pathEn: ["en", "gallery", "heading"] })}
          ${fieldPair({ labelHe: "תת-כותרת גלריית המדיה", labelEn: "Media Gallery Subtitle", rootKey: "PROFILE", pathHe: ["he", "gallery", "sub"], pathEn: ["en", "gallery", "sub"], multiline: true, short: true })}
          ${fieldPair({ labelHe: "כותרת סקירת ארבע המגירות", labelEn: "Overview Band Heading", rootKey: "PROFILE", pathHe: ["he", "boringOverviewTitle"], pathEn: ["en", "boringOverviewTitle"] })}
          ${fieldPair({ labelHe: "פסקת סקירת ארבע המגירות", labelEn: "Overview Band Copy", rootKey: "PROFILE", pathHe: ["he", "boringOverviewCopy"], pathEn: ["en", "boringOverviewCopy"], multiline: true })}
          ${fieldPair({ labelHe: "טקסט כותרת תחתונה (Footer)", labelEn: "Footer Credit", rootKey: "PROFILE", pathHe: ["he", "footerCredit"], pathEn: ["en", "footerCredit"] })}
          <div class="admin-repeater">
            <div class="admin-repeater-head"><span>${he ? "שמות חדרי הניווט" : "Navigation Room Labels"}</span></div>
            ${fieldPair({ labelHe: "סדנה וסרטונים", labelEn: "Studio & Films", rootKey: "PROFILE", pathHe: ["he", "nav", "workbench"], pathEn: ["en", "nav", "workbench"] })}
            ${fieldPair({ labelHe: "ארכיון", labelEn: "Archive", rootKey: "PROFILE", pathHe: ["he", "nav", "archive"], pathEn: ["en", "nav", "archive"] })}
            ${fieldPair({ labelHe: "המחברת", labelEn: "Notebook", rootKey: "PROFILE", pathHe: ["he", "nav", "notebook"], pathEn: ["en", "nav", "notebook"] })}
            ${fieldPair({ labelHe: "מכתבים", labelEn: "Letters", rootKey: "PROFILE", pathHe: ["he", "nav", "letters"], pathEn: ["en", "nav", "letters"] })}
          </div>
        </div>
      `;
    }

    // 4. Taped Note ("At a glance")
    if (matchesSearch("taped glance במבט מהיר", PROFILE.he.tapedNoteTitle, PROFILE.en.tapedNoteTitle, JSON.stringify(PROFILE.he.tapedItems))) {
      const count = Math.max(PROFILE.he.tapedItems.length, PROFILE.en.tapedItems.length);
      html += `
        <div class="admin-section-box">
          <h4>${he ? "פתק 'במבט מהיר' (בצד עמוד המדף)" : "Taped Note ('At a glance')"}</h4>
          ${fieldPair({ labelHe: "כותרת הפתק", labelEn: "Note Title", rootKey: "PROFILE", pathHe: ["he", "tapedNoteTitle"], pathEn: ["en", "tapedNoteTitle"] })}
          ${fieldPair({ labelHe: "תת-כותרת", labelEn: "Note Subtitle", rootKey: "PROFILE", pathHe: ["he", "tapedNoteSub"], pathEn: ["en", "tapedNoteSub"] })}
          <div class="admin-repeater">
            <div class="admin-repeater-head">
              <span>${he ? "שורות הפתק" : "Highlight Rows"}</span>
              <button type="button" class="admin-mini-btn" data-add-taped-item>${ui().addRow}</button>
            </div>
            ${Array.from({ length: count })
              .map(
                (_, i) => `
              <div class="admin-subrow">
                <div class="admin-subrow-top">
                  <span>#${i + 1}</span>
                  <button type="button" class="admin-mini-btn" data-del-taped-item="${i}">${ui().deleteBtn}</button>
                </div>
                ${fieldPair({ labelHe: "תווית / תחנה", labelEn: "Label", rootKey: "PROFILE", pathHe: ["he", "tapedItems", i, "label"], pathEn: ["en", "tapedItems", i, "label"] })}
                ${fieldPair({ labelHe: "שנים / נתון", labelEn: "Meta / Years", rootKey: "PROFILE", pathHe: ["he", "tapedItems", i, "meta"], pathEn: ["en", "tapedItems", i, "meta"] })}
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    // 5. Four Room Summary Cards
    if (matchesSearch("room cards drawers מגירות חדרים", JSON.stringify(PROFILE.he.roomCards))) {
      html += `
        <div class="admin-section-box">
          <h4>${he ? "כרטיסיות ארבעת החדרים" : "Four Room Jump Cards"}</h4>
          ${PROFILE.he.roomCards
            .map(
              (rc, i) => `
            <div class="admin-subrow" style="margin-bottom:10px;">
              <div class="admin-subrow-top"><span>${esc(rc.id)}</span></div>
              ${fieldPair({ labelHe: "כותרת עליונה קטנה", labelEn: "Kicker", rootKey: "PROFILE", pathHe: ["he", "roomCards", i, "kicker"], pathEn: ["en", "roomCards", i, "kicker"] })}
              ${fieldPair({ labelHe: "כותרת הכרטיסייה", labelEn: "Title", rootKey: "PROFILE", pathHe: ["he", "roomCards", i, "title"], pathEn: ["en", "roomCards", i, "title"] })}
              ${fieldPair({ labelHe: "תיאור קצר", labelEn: "Description", rootKey: "PROFILE", pathHe: ["he", "roomCards", i, "desc"], pathEn: ["en", "roomCards", i, "desc"], multiline: true, short: true })}
            </div>
          `
            )
            .join("")}
        </div>
      `;
    }

    // 6. 3D Desk Tooltips
    if (matchesSearch("desk tips 3d hover בועות שולחן", JSON.stringify(PROFILE.he.deskTips))) {
      const keys = Object.keys(PROFILE.he.deskTips);
      html += `
        <div class="admin-section-box">
          <h4>${he ? "טקסט ריחוף על אובייקטים בשולחן ה-3D" : "3D Desk Hover Labels"}</h4>
          ${keys
            .map((k) =>
              fieldPair({
                labelHe: `אובייקט: ${k}`,
                labelEn: `Object: ${k}`,
                rootKey: "PROFILE",
                pathHe: ["he", "deskTips", k],
                pathEn: ["en", "deskTips", k],
              })
            )
            .join("")}
        </div>
      `;
    }

    return html || `<p style="color:var(--muted);">${he ? "לא נמצאו שדות תואמים." : "No matching fields."}</p>`;
  }

  function renderShelfSection() {
    const he = isHeUi();
    const copy = ui();
    const items = FEATURED_PRINTS.map((item, idx) => ({ item, idx })).filter(({ item }) =>
      matchesSearch(item.id, item.he.title, item.en.title, item.he.category, item.en.category, item.he.summary, item.en.summary)
    );

    if (!items.length) {
      return `<p style="color:var(--muted);">${he ? "לא נמצאו פריטים תואמים." : "No matching shelf prints."}</p>`;
    }

    return items
      .map(({ item, idx }) => {
        const cardKey = `shelf-${item.id}`;
        const isOpen = adminState.openCards.has(cardKey);
        const title = isHeUi() ? item.he.title : item.en.title;
        const cat = isHeUi() ? item.he.category : item.en.category;
        const hlCount = Math.max(item.he.highlights?.length || 0, item.en.highlights?.length || 0);

        return `
          <div class="admin-card ${isOpen ? "is-open" : ""} ${item.hidden ? "is-hidden-item" : ""}">
            <div class="admin-card-head" data-toggle-card="${cardKey}">
              <div class="admin-card-head-left">
                <img class="admin-thumb" src="${assetUrl(item.image)}" alt="" />
                <div class="admin-card-title">
                  <strong>${esc(title)}</strong>
                  <span>${esc(cat)} · #${idx + 1}</span>
                </div>
              </div>
              <div class="admin-card-actions">
                <button type="button" class="admin-mini-btn ${item.hidden ? "is-off" : ""}" data-toggle-hide="FEATURED_PRINTS" data-idx="${idx}">${item.hidden ? copy.hidden : copy.show}</button>
                <button type="button" class="admin-mini-btn" data-move-item="FEATURED_PRINTS" data-idx="${idx}" data-dir="-1" ${idx === 0 ? "disabled" : ""}>↑</button>
                <button type="button" class="admin-mini-btn" data-move-item="FEATURED_PRINTS" data-idx="${idx}" data-dir="1" ${idx === FEATURED_PRINTS.length - 1 ? "disabled" : ""}>↓</button>
              </div>
            </div>
            ${
              isOpen
                ? `<div class="admin-card-body">
                    ${fieldPair({ labelHe: "קטגוריה / תגית", labelEn: "Category / Tag", rootKey: "FEATURED_PRINTS", pathHe: [idx, "he", "category"], pathEn: [idx, "en", "category"] })}
                    ${fieldPair({ labelHe: "כותרת", labelEn: "Title", rootKey: "FEATURED_PRINTS", pathHe: [idx, "he", "title"], pathEn: [idx, "en", "title"] })}
                    ${fieldPair({ labelHe: "שורת טיזר קצרה", labelEn: "Teaser", rootKey: "FEATURED_PRINTS", pathHe: [idx, "he", "teaser"], pathEn: [idx, "en", "teaser"] })}
                    ${fieldPair({ labelHe: "שנה / הוצאה לאור", labelEn: "Year / Publisher", rootKey: "FEATURED_PRINTS", pathHe: [idx, "he", "year"], pathEn: [idx, "en", "year"] })}
                    ${fieldPair({ labelHe: "טקסט כפתור ראשי", labelEn: "Primary Button CTA", rootKey: "FEATURED_PRINTS", pathHe: [idx, "he", "cta"], pathEn: [idx, "en", "cta"] })}
                    ${fieldPair({ labelHe: "תקציר (פסקה ראשונה)", labelEn: "Summary (Paragraph 1)", rootKey: "FEATURED_PRINTS", pathHe: [idx, "he", "summary"], pathEn: [idx, "en", "summary"], multiline: true })}
                    ${fieldPair({ labelHe: "הרחבה (פסקה שנייה)", labelEn: "Body (Paragraph 2)", rootKey: "FEATURED_PRINTS", pathHe: [idx, "he", "body2"], pathEn: [idx, "en", "body2"], multiline: true })}
                    ${fieldPair({ labelHe: "ציטוט מודגש", labelEn: "Pull Quote", rootKey: "FEATURED_PRINTS", pathHe: [idx, "he", "quote"], pathEn: [idx, "en", "quote"], multiline: true, short: true })}
                    <div class="admin-repeater">
                      <div class="admin-repeater-head">
                        <span>${he ? "נקודות מפתח (Key Details)" : "Key Details"}</span>
                        <button type="button" class="admin-mini-btn" data-add-highlight="${idx}">${copy.addRow}</button>
                      </div>
                      ${Array.from({ length: hlCount })
                        .map(
                          (_, hi) => `
                        <div class="admin-subrow">
                          <div class="admin-subrow-top">
                            <span>#${hi + 1}</span>
                            <button type="button" class="admin-mini-btn" data-del-highlight="${idx}:${hi}">${copy.deleteBtn}</button>
                          </div>
                          ${fieldPair({ labelHe: "כותרת פרט", labelEn: "Detail Label", rootKey: "FEATURED_PRINTS", pathHe: [idx, "he", "highlights", hi, "k"], pathEn: [idx, "en", "highlights", hi, "k"] })}
                          ${fieldPair({ labelHe: "תוכן הפרט", labelEn: "Detail Value", rootKey: "FEATURED_PRINTS", pathHe: [idx, "he", "highlights", hi, "v"], pathEn: [idx, "en", "highlights", hi, "v"] })}
                        </div>
                      `
                        )
                        .join("")}
                    </div>
                  </div>`
                : ""
            }
          </div>
        `;
      })
      .join("");
  }

  function renderGallerySection() {
    const he = isHeUi();
    const copy = ui();
    const items = GALLERY_ITEMS.map((item, idx) => ({ item, idx })).filter(({ item }) =>
      matchesSearch(item.id, item.he.title, item.en.title, item.he.meta, item.en.meta, item.he.caption, item.en.caption)
    );

    if (!items.length) {
      return `<p style="color:var(--muted);">${he ? "לא נמצאו פריטים בגלריה." : "No matching gallery items."}</p>`;
    }

    return items
      .map(({ item, idx }) => {
        const cardKey = `gal-${item.id}`;
        const isOpen = adminState.openCards.has(cardKey);
        const title = isHeUi() ? item.he.title : item.en.title;
        const meta = isHeUi() ? item.he.meta : item.en.meta;

        return `
          <div class="admin-card ${isOpen ? "is-open" : ""} ${item.hidden ? "is-hidden-item" : ""}">
            <div class="admin-card-head" data-toggle-card="${cardKey}">
              <div class="admin-card-head-left">
                <img class="admin-thumb" src="${assetUrl(item.thumb)}" alt="" />
                <div class="admin-card-title">
                  <strong>${esc(title)}</strong>
                  <span>${esc(meta)}</span>
                </div>
              </div>
              <div class="admin-card-actions">
                <button type="button" class="admin-mini-btn ${item.hidden ? "is-off" : ""}" data-toggle-hide="GALLERY_ITEMS" data-idx="${idx}">${item.hidden ? copy.hidden : copy.show}</button>
                <button type="button" class="admin-mini-btn" data-move-item="GALLERY_ITEMS" data-idx="${idx}" data-dir="-1" ${idx === 0 ? "disabled" : ""}>↑</button>
                <button type="button" class="admin-mini-btn" data-move-item="GALLERY_ITEMS" data-idx="${idx}" data-dir="1" ${idx === GALLERY_ITEMS.length - 1 ? "disabled" : ""}>↓</button>
              </div>
            </div>
            ${
              isOpen
                ? `<div class="admin-card-body">
                    ${fieldPair({ labelHe: "כותרת", labelEn: "Title", rootKey: "GALLERY_ITEMS", pathHe: [idx, "he", "title"], pathEn: [idx, "en", "title"] })}
                    ${fieldPair({ labelHe: "שורת מטא-דאטה", labelEn: "Meta Line", rootKey: "GALLERY_ITEMS", pathHe: [idx, "he", "meta"], pathEn: [idx, "en", "meta"] })}
                    ${fieldPair({ labelHe: "כיתוב בתצוגה המהירה", labelEn: "Quick-Look Caption", rootKey: "GALLERY_ITEMS", pathHe: [idx, "he", "caption"], pathEn: [idx, "en", "caption"], multiline: true, short: true })}
                  </div>`
                : ""
            }
          </div>
        `;
      })
      .join("");
  }

  function renderFilmsSection() {
    const he = isHeUi();
    return VIDEOS.map((vid, idx) => {
      if (!matchesSearch(vid.id, vid.he.title, vid.en.title, vid.he.desc, vid.en.desc)) return "";
      return `
        <div class="admin-card is-open">
          <div class="admin-card-head" style="cursor:default;">
            <div class="admin-card-head-left">
              <img class="admin-thumb" src="${assetUrl(vid.poster)}" alt="" />
              <div class="admin-card-title">
                <strong>${esc(he ? vid.he.title : vid.en.title)}</strong>
                <span>${esc(vid.duration)} · ${esc(vid.src)}</span>
              </div>
            </div>
          </div>
          <div class="admin-card-body">
            <div class="admin-field-row is-single">
              ${singleField({ labelHe: "משך הסרטון (תווית)", labelEn: "Duration Label", rootKey: "VIDEOS", path: [idx, "duration"] })}
            </div>
            ${fieldPair({ labelHe: "כותרת הסרטון", labelEn: "Film Title", rootKey: "VIDEOS", pathHe: [idx, "he", "title"], pathEn: [idx, "en", "title"] })}
            ${fieldPair({ labelHe: "שורת קרדיט / מסגרת", labelEn: "Kicker / Credit", rootKey: "VIDEOS", pathHe: [idx, "he", "kicker"], pathEn: [idx, "en", "kicker"] })}
            ${fieldPair({ labelHe: "תיאור הסרטון", labelEn: "Description", rootKey: "VIDEOS", pathHe: [idx, "he", "desc"], pathEn: [idx, "en", "desc"], multiline: true })}
          </div>
        </div>
      `;
    }).join("");
  }

  function renderArchiveSection() {
    const he = isHeUi();
    const copy = ui();
    const catOptions = CATALOGUE_CATEGORIES.filter((c) => c.id !== "all").map((c) => ({
      value: c.id,
      label: he ? c.he : c.en,
    }));

    const items = CATALOGUE_ITEMS.map((item, idx) => ({ item, idx })).filter(({ item }) =>
      matchesSearch(item.id, item.year, item.category, item.he.title, item.en.title, item.he.desc, item.en.desc, item.he.extra, item.en.extra)
    );

    return `
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
        <button type="button" class="admin-btn is-primary" id="admin-add-work">${copy.addWork}</button>
      </div>
      ${
        items.length
          ? items
              .map(({ item, idx }) => {
                const cardKey = `cat-${item.id}`;
                const isOpen = adminState.openCards.has(cardKey);
                const title = he ? item.he.title : item.en.title;
                return `
                  <div class="admin-card ${isOpen ? "is-open" : ""} ${item.hidden ? "is-hidden-item" : ""}">
                    <div class="admin-card-head" data-toggle-card="${cardKey}">
                      <div class="admin-card-head-left">
                        <img class="admin-thumb" src="${assetUrl(item.thumb || "assets/prints/journalism.jpg")}" alt="" />
                        <div class="admin-card-title">
                          <strong>${esc(title)}</strong>
                          <span>${esc(item.year)} · ${esc(item.category)}</span>
                        </div>
                      </div>
                      <div class="admin-card-actions">
                        <button type="button" class="admin-mini-btn ${item.hidden ? "is-off" : ""}" data-toggle-hide="CATALOGUE_ITEMS" data-idx="${idx}">${item.hidden ? copy.hidden : copy.show}</button>
                        <button type="button" class="admin-mini-btn" data-move-item="CATALOGUE_ITEMS" data-idx="${idx}" data-dir="-1" ${idx === 0 ? "disabled" : ""}>↑</button>
                        <button type="button" class="admin-mini-btn" data-move-item="CATALOGUE_ITEMS" data-idx="${idx}" data-dir="1" ${idx === CATALOGUE_ITEMS.length - 1 ? "disabled" : ""}>↓</button>
                        ${item.isCustom ? `<button type="button" class="admin-mini-btn is-off" data-del-archive="${idx}">${copy.deleteBtn}</button>` : ""}
                      </div>
                    </div>
                    ${
                      isOpen
                        ? `<div class="admin-card-body">
                            <div class="admin-field-row">
                              ${singleField({ labelHe: "קטגוריה", labelEn: "Category", rootKey: "CATALOGUE_ITEMS", path: [idx, "category"], options: catOptions })}
                              ${singleField({ labelHe: "שנה / תקופה", labelEn: "Year / Era", rootKey: "CATALOGUE_ITEMS", path: [idx, "year"] })}
                            </div>
                            ${fieldPair({ labelHe: "כותרת הפרויקט", labelEn: "Project Title", rootKey: "CATALOGUE_ITEMS", pathHe: [idx, "he", "title"], pathEn: [idx, "en", "title"] })}
                            ${fieldPair({ labelHe: "תיאור קצר", labelEn: "Short Description", rootKey: "CATALOGUE_ITEMS", pathHe: [idx, "he", "desc"], pathEn: [idx, "en", "desc"], multiline: true })}
                            ${fieldPair({ labelHe: "הערת הרחבה (Read note)", labelEn: "Expanded Note", rootKey: "CATALOGUE_ITEMS", pathHe: [idx, "he", "extra"], pathEn: [idx, "en", "extra"], multiline: true, short: true })}
                          </div>`
                        : ""
                    }
                  </div>
                `;
              })
              .join("")
          : `<p style="color:var(--muted);">${he ? "לא נמצאו עבודות תואמות." : "No matching archive items."}</p>`
      }
    `;
  }

  function renderNotebookSection() {
    const he = isHeUi();
    let html = `
      <div class="admin-section-box">
        <h4>${he ? "פתיחת המחברת" : "Notebook Header & Intro"}</h4>
        ${fieldPair({ labelHe: "כותרת המחברת", labelEn: "Notebook Heading", rootKey: "NOTEBOOK_SPREADS", pathHe: ["he", "heading"], pathEn: ["en", "heading"] })}
        ${fieldPair({ labelHe: "פסקת פתיחה", labelEn: "Intro Paragraph", rootKey: "NOTEBOOK_SPREADS", pathHe: ["he", "intro"], pathEn: ["en", "intro"], multiline: true })}
      </div>
    `;

    const tabCount = NOTEBOOK_SPREADS.he.tabs.length;
    for (let i = 0; i < tabCount; i++) {
      const th = NOTEBOOK_SPREADS.he.tabs[i];
      const te = NOTEBOOK_SPREADS.en.tabs[i];
      if (!matchesSearch(th.label, te.label, th.title, te.title, th.p1, te.p1, th.p2, te.p2)) continue;
      const cardKey = `nb-${i}`;
      const isOpen = adminState.openCards.has(cardKey);
      html += `
        <div class="admin-card ${isOpen ? "is-open" : ""}">
          <div class="admin-card-head" data-toggle-card="${cardKey}">
            <div class="admin-card-head-left">
              <img class="admin-thumb" src="${assetUrl(th.image)}" alt="" />
              <div class="admin-card-title">
                <strong>${esc(he ? th.label : te.label)} — ${esc(he ? th.title : te.title)}</strong>
                <span>${esc(he ? th.calloutTitle : te.calloutTitle)}</span>
              </div>
            </div>
          </div>
          ${
            isOpen
              ? `<div class="admin-card-body">
                  ${fieldPair({ labelHe: "שם הלשונית", labelEn: "Tab Label", rootKey: "NOTEBOOK_SPREADS", pathHe: ["he", "tabs", i, "label"], pathEn: ["en", "tabs", i, "label"] })}
                  ${fieldPair({ labelHe: "כיתוב מתחת לתמונה", labelEn: "Photo Caption", rootKey: "NOTEBOOK_SPREADS", pathHe: ["he", "tabs", i, "caption"], pathEn: ["en", "tabs", i, "caption"] })}
                  ${fieldPair({ labelHe: "כותרת הכפולה", labelEn: "Spread Headline", rootKey: "NOTEBOOK_SPREADS", pathHe: ["he", "tabs", i, "title"], pathEn: ["en", "tabs", i, "title"] })}
                  ${fieldPair({ labelHe: "פסקה ראשונה", labelEn: "Paragraph 1", rootKey: "NOTEBOOK_SPREADS", pathHe: ["he", "tabs", i, "p1"], pathEn: ["en", "tabs", i, "p1"], multiline: true })}
                  ${fieldPair({ labelHe: "פסקה שנייה", labelEn: "Paragraph 2", rootKey: "NOTEBOOK_SPREADS", pathHe: ["he", "tabs", i, "p2"], pathEn: ["en", "tabs", i, "p2"], multiline: true })}
                  ${fieldPair({ labelHe: "תגית מסגרת מידע", labelEn: "Callout Kicker", rootKey: "NOTEBOOK_SPREADS", pathHe: ["he", "tabs", i, "calloutKicker"], pathEn: ["en", "tabs", i, "calloutKicker"] })}
                  ${fieldPair({ labelHe: "כותרת מסגרת מידע", labelEn: "Callout Title", rootKey: "NOTEBOOK_SPREADS", pathHe: ["he", "tabs", i, "calloutTitle"], pathEn: ["en", "tabs", i, "calloutTitle"] })}
                  ${fieldPair({ labelHe: "פירוט מסגרת מידע", labelEn: "Callout Meta", rootKey: "NOTEBOOK_SPREADS", pathHe: ["he", "tabs", i, "calloutMeta"], pathEn: ["en", "tabs", i, "calloutMeta"] })}
                </div>`
              : ""
          }
        </div>
      `;
    }
    return html;
  }

  function renderWorkbenchSection() {
    const he = isHeUi();
    let html = `
      <div class="admin-section-box">
        <h4>${he ? "כותרת שולחן העבודה והלשוניות" : "Workbench Header & Tab Labels"}</h4>
        ${fieldPair({ labelHe: "כותרת ראשית", labelEn: "Heading", rootKey: "WORKBENCH_DATA", pathHe: ["he", "heading"], pathEn: ["en", "heading"] })}
        ${fieldPair({ labelHe: "תת-כותרת", labelEn: "Subtitle", rootKey: "WORKBENCH_DATA", pathHe: ["he", "subtitle"], pathEn: ["en", "subtitle"] })}
        ${WORKBENCH_DATA.he.tabs
          .map((tab, i) =>
            fieldPair({
              labelHe: `לשונית ${i + 1} (${tab.id})`,
              labelEn: `Tab ${i + 1} (${tab.id})`,
              rootKey: "WORKBENCH_DATA",
              pathHe: ["he", "tabs", i, "label"],
              pathEn: ["en", "tabs", i, "label"],
            })
          )
          .join("")}
      </div>
    `;

    // 1. Films intro
    const renderAcc = (key, titleHe, titleEn, sub, bodyHtml) => {
      const open = adminState.openCards.has(key);
      return `
        <div class="admin-card ${open ? "is-open" : ""}">
          <div class="admin-card-head" data-toggle-card="${key}">
            <div class="admin-card-head-left">
              <div class="admin-card-title">
                <strong>${esc(he ? titleHe : titleEn)}</strong>
                <span>${esc(sub)}</span>
              </div>
            </div>
          </div>
          ${open ? `<div class="admin-card-body">${bodyHtml}</div>` : ""}
        </div>
      `;
    };

    // Audio tour
    html += renderAcc(
      "wb-audio",
      "סיור האודיו ב-AI (5 פרקים)",
      "AI Audio Tour (5 Chapters)",
      he ? WORKBENCH_DATA.he.audio.title : WORKBENCH_DATA.en.audio.title,
      `
        ${fieldPair({ labelHe: "כותרת", labelEn: "Title", rootKey: "WORKBENCH_DATA", pathHe: ["he", "audio", "title"], pathEn: ["en", "audio", "title"] })}
        ${fieldPair({ labelHe: "טקסט הסבר", labelEn: "Intro Copy", rootKey: "WORKBENCH_DATA", pathHe: ["he", "audio", "copy"], pathEn: ["en", "audio", "copy"], multiline: true })}
        ${WORKBENCH_DATA.he.audio.chapters
          .map(
            (ch, i) => `
          <div class="admin-subrow">
            <div class="admin-subrow-top"><span>${esc(ch.time)} · ${esc(ch.label)}</span></div>
            ${fieldPair({ labelHe: "שם הפרק", labelEn: "Chapter Label", rootKey: "WORKBENCH_DATA", pathHe: ["he", "audio", "chapters", i, "label"], pathEn: ["en", "audio", "chapters", i, "label"] })}
            ${fieldPair({ labelHe: "כותרת משנה", labelEn: "Headline", rootKey: "WORKBENCH_DATA", pathHe: ["he", "audio", "chapters", i, "headline"], pathEn: ["en", "audio", "chapters", i, "headline"] })}
            ${fieldPair({ labelHe: "סיפור הפרק", labelEn: "Story", rootKey: "WORKBENCH_DATA", pathHe: ["he", "audio", "chapters", i, "story"], pathEn: ["en", "audio", "chapters", i, "story"], multiline: true })}
          </div>
        `
          )
          .join("")}
      `
    );

    // Hello Tech Pyramid
    html += renderAcc(
      "wb-pyramid",
      "פירמידת צמיחת Hello Tech (4 תקופות)",
      "Hello Tech Scale Pyramid (4 Eras)",
      he ? WORKBENCH_DATA.he.pyramid.title : WORKBENCH_DATA.en.pyramid.title,
      `
        ${fieldPair({ labelHe: "כותרת", labelEn: "Title", rootKey: "WORKBENCH_DATA", pathHe: ["he", "pyramid", "title"], pathEn: ["en", "pyramid", "title"] })}
        ${fieldPair({ labelHe: "טקסט הסבר", labelEn: "Intro Copy", rootKey: "WORKBENCH_DATA", pathHe: ["he", "pyramid", "copy"], pathEn: ["en", "pyramid", "copy"], multiline: true })}
        ${WORKBENCH_DATA.he.pyramid.eras
          .map(
            (era, i) => `
          <div class="admin-subrow">
            <div class="admin-subrow-top"><span>${esc(era.id)} · ${esc(era.students)}</span></div>
            ${fieldPair({ labelHe: "תווית תקופה", labelEn: "Era Label", rootKey: "WORKBENCH_DATA", pathHe: ["he", "pyramid", "eras", i, "label"], pathEn: ["en", "pyramid", "eras", i, "label"] })}
            ${fieldPair({ labelHe: "מספר תלמידים", labelEn: "Students Metric", rootKey: "WORKBENCH_DATA", pathHe: ["he", "pyramid", "eras", i, "students"], pathEn: ["en", "pyramid", "eras", i, "students"] })}
            ${fieldPair({ labelHe: "הסבר נתון תלמידים", labelEn: "Students Subtitle", rootKey: "WORKBENCH_DATA", pathHe: ["he", "pyramid", "eras", i, "studentsSub"], pathEn: ["en", "pyramid", "eras", i, "studentsSub"] })}
            ${fieldPair({ labelHe: "מיקוד", labelEn: "Focus", rootKey: "WORKBENCH_DATA", pathHe: ["he", "pyramid", "eras", i, "focus"], pathEn: ["en", "pyramid", "eras", i, "focus"] })}
            ${fieldPair({ labelHe: "שותפים", labelEn: "Partners", rootKey: "WORKBENCH_DATA", pathHe: ["he", "pyramid", "eras", i, "partners"], pathEn: ["en", "pyramid", "eras", i, "partners"] })}
          </div>
        `
          )
          .join("")}
      `
    );

    // Miloolita Words
    html += renderAcc(
      "wb-words",
      "תיבת המילים של מילוליתא (6 מילים)",
      "Miloolita Lost Words (6 Words)",
      he ? WORKBENCH_DATA.he.words.title : WORKBENCH_DATA.en.words.title,
      `
        ${fieldPair({ labelHe: "כותרת", labelEn: "Title", rootKey: "WORKBENCH_DATA", pathHe: ["he", "words", "title"], pathEn: ["en", "words", "title"] })}
        ${fieldPair({ labelHe: "טקסט הסבר", labelEn: "Intro Copy", rootKey: "WORKBENCH_DATA", pathHe: ["he", "words", "copy"], pathEn: ["en", "words", "copy"], multiline: true })}
        ${WORKBENCH_DATA.he.words.words
          .map(
            (w, i) => `
          <div class="admin-subrow">
            <div class="admin-subrow-top"><span>${esc(w.he)} / ${esc(w.en)}</span></div>
            ${fieldPair({ labelHe: "המילה (עברית)", labelEn: "Word (Hebrew)", rootKey: "WORKBENCH_DATA", pathHe: ["he", "words", "words", i, "he"], pathEn: ["en", "words", "words", i, "he"] })}
            ${fieldPair({ labelHe: "המילה (אנגלית)", labelEn: "Word (English)", rootKey: "WORKBENCH_DATA", pathHe: ["he", "words", "words", i, "en"], pathEn: ["en", "words", "words", i, "en"] })}
            ${fieldPair({ labelHe: "סיפור המילה", labelEn: "Word Note", rootKey: "WORKBENCH_DATA", pathHe: ["he", "words", "words", i, "note"], pathEn: ["en", "words", "words", i, "note"], multiline: true, short: true })}
          </div>
        `
          )
          .join("")}
      `
    );

    // High Voltage Reform Arc
    html += renderAcc(
      "wb-reform",
      "ציר הרפורמה — מתח גבוה (4 מערכות)",
      "High Voltage Reform Arc (4 Acts)",
      he ? WORKBENCH_DATA.he.reform.title : WORKBENCH_DATA.en.reform.title,
      `
        ${fieldPair({ labelHe: "כותרת", labelEn: "Title", rootKey: "WORKBENCH_DATA", pathHe: ["he", "reform", "title"], pathEn: ["en", "reform", "title"] })}
        ${fieldPair({ labelHe: "טקסט הסבר", labelEn: "Intro Copy", rootKey: "WORKBENCH_DATA", pathHe: ["he", "reform", "copy"], pathEn: ["en", "reform", "copy"], multiline: true })}
        ${WORKBENCH_DATA.he.reform.acts
          .map(
            (act, i) => `
          <div class="admin-subrow">
            <div class="admin-subrow-top"><span>${esc(act.step)}</span></div>
            ${fieldPair({ labelHe: "שלב / שנה", labelEn: "Step / Year", rootKey: "WORKBENCH_DATA", pathHe: ["he", "reform", "acts", i, "step"], pathEn: ["en", "reform", "acts", i, "step"] })}
            ${fieldPair({ labelHe: "כותרת המערכה", labelEn: "Act Title", rootKey: "WORKBENCH_DATA", pathHe: ["he", "reform", "acts", i, "title"], pathEn: ["en", "reform", "acts", i, "title"] })}
            ${fieldPair({ labelHe: "סיפור המערכה", labelEn: "Act Story", rootKey: "WORKBENCH_DATA", pathHe: ["he", "reform", "acts", i, "body"], pathEn: ["en", "reform", "acts", i, "body"], multiline: true })}
            ${fieldPair({ labelHe: "תגית תחתונה", labelEn: "Metric Tag", rootKey: "WORKBENCH_DATA", pathHe: ["he", "reform", "acts", i, "metric"], pathEn: ["en", "reform", "acts", i, "metric"] })}
          </div>
        `
          )
          .join("")}
      `
    );

    return html;
  }

  function renderPublishSection() {
    const he = isHeUi();
    const cfg = loadPublishConfig();
    const lastPub = getLastPublishedMeta();
    const lastPubText = lastPub?.updatedAt
      ? new Date(lastPub.updatedAt).toLocaleString(he ? "he-IL" : "en-US")
      : he
      ? "ברירת המחדל של האתר"
      : "Initial site version";

    return `
      <div class="admin-publish-hero">
        <h4>${he ? "פרסום ישיר לאתר החי (orinwinberg.com)" : "One-Click Publish to orinwinberg.com"}</h4>
        <p>
          ${
            he
              ? "כל שינוי שערכת כאן נשמר מיד כטיוטה בדפדפן שלך כדי שתוכלי לבדוק אותו בשקט. כשאת מוכנה לעדכן את האתר החי לכולם, לחצי על כפתור הפרסום — השינויים יעלו ל-orinwinberg.com בתוך כ-30 שניות."
              : "Every edit you make saves instantly as a private draft in your browser for live preview. When you're ready to update the live site for everyone, click Publish — changes go live on orinwinberg.com in ~30 seconds."
          }
        </p>
        <div style="font:12px var(--mono);color:var(--muted);margin-bottom:14px;">
          ${he ? "עדכון אחרון באתר החי:" : "Last live publish:"} <strong>${esc(lastPubText)}</strong>
        </div>

        <div class="admin-field-row">
          <div class="admin-field">
            <label><span>${he ? "בעלים ב-GitHub" : "GitHub Owner"}</span></label>
            <input type="text" dir="ltr" id="pub-owner" value="${esc(cfg.owner)}" />
          </div>
          <div class="admin-field">
            <label><span>${he ? "שם המאגר (Repository)" : "Repository Name"}</span></label>
            <input type="text" dir="ltr" id="pub-repo" value="${esc(cfg.repo)}" />
          </div>
        </div>

        <div class="admin-field-row is-single" style="margin-top:10px;">
          <div class="admin-field">
            <label>
              <span>${he ? "מפתח פרסום אישי (GitHub Fine-Grained Token — נשמר רק בדפדפן שלך)" : "Publish Key (GitHub Fine-Grained Token — saved locally in your browser only)"}</span>
              <button type="button" class="admin-mini-btn" id="pub-toggle-token">${adminState.showToken ? (he ? "הסתר" : "Hide") : he ? "הצג" : "Show"}</button>
            </label>
            <input
              type="${adminState.showToken ? "text" : "password"}"
              dir="ltr"
              id="pub-token"
              placeholder="github_pat_..."
              value="${esc(cfg.token)}"
              autocomplete="off"
            />
          </div>
        </div>

        <div class="admin-publish-actions">
          <button type="button" class="admin-btn is-berry" id="pub-go-btn" ${adminState.publishBusy ? "disabled" : ""}>
            ${
              adminState.publishBusy
                ? he
                  ? "מפרסם ל-orinwinberg.com…"
                  : "Publishing to orinwinberg.com…"
                : he
                ? "פרסמי עכשיו ל-orinwinberg.com"
                : "Publish Live to orinwinberg.com"
            }
          </button>
          <button type="button" class="admin-btn" id="pub-test-btn" ${adminState.publishBusy ? "disabled" : ""}>
            ${he ? "בדיקת חיבור" : "Test connection"}
          </button>
        </div>

        ${
          adminState.publishMsg
            ? `<div class="admin-msg is-${adminState.publishMsg.type}">${esc(adminState.publishMsg.text)}</div>`
            : ""
        }
      </div>

      <div class="admin-section-box">
        <h4>${he ? "איך יוצרים מפתח פרסום חד-פעמי? (דקה אחת)" : "One-Time Publish Key Setup (1 minute)"}</h4>
        <ol class="admin-steps">
          <li>${
            he
              ? 'היכנסו ל-<code>GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token</code>.'
              : "Open <code>GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token</code>."
          }</li>
          <li>${
            he
              ? 'תחת <b>Repository access</b> בחרו <b>Only select repositories</b> ← <code>orin-winberg-portfolio</code>.'
              : "Under <b>Repository access</b> choose <b>Only select repositories</b> → <code>orin-winberg-portfolio</code>."
          }</li>
          <li>${
            he
              ? 'תחת <b>Repository permissions → Contents</b> בחרו <b>Read and write</b>, הפיקו את המפתח והדביקו אותו פעם אחת למעלה בדפדפן של אורין.'
              : "Under <b>Repository permissions → Contents</b> select <b>Read and write</b>, generate the token, and paste it once above on Orin's browser."
          }</li>
        </ol>
      </div>

      <div class="admin-section-box">
        <h4>${he ? "גיבוי, ייבוא וניהול טיוטה" : "Backup, Import & Draft Controls"}</h4>
        <div class="admin-publish-actions" style="margin-top:0;">
          <button type="button" class="admin-btn" id="pub-export-btn">${he ? "הורדת גיבוי (content.json)" : "Download backup (content.json)"}</button>
          <button type="button" class="admin-btn" id="pub-import-btn">${he ? "ייבוא קובץ גיבוי" : "Import JSON backup"}</button>
          <input type="file" id="pub-import-file" accept=".json,application/json" style="display:none;" />
          <button type="button" class="admin-btn" id="pub-discard-btn" ${!getHasDraft() ? "disabled" : ""}>${he ? "ביטול טיוטה (חזרה לגרסה החיה)" : "Discard local draft"}</button>
          <button type="button" class="admin-btn is-danger" id="pub-reset-btn">${he ? "איפוס לברירת המחדל המקורית" : "Reset to original defaults"}</button>
        </div>
      </div>
    `;
  }

  // ===================================================================
  // Main Dialog Render & Event Binding
  // ===================================================================
  function renderAdminDialog() {
    const copy = ui();
    const he = isHeUi();
    const secMeta = copy.sections[adminState.activeSection];
    const hasDraft = getHasDraft();

    let bodyHtml = "";
    if (adminState.activeSection === "profile") bodyHtml = renderProfileSection();
    else if (adminState.activeSection === "shelf") bodyHtml = renderShelfSection();
    else if (adminState.activeSection === "gallery") bodyHtml = renderGallerySection();
    else if (adminState.activeSection === "films") bodyHtml = renderFilmsSection();
    else if (adminState.activeSection === "archive") bodyHtml = renderArchiveSection();
    else if (adminState.activeSection === "notebook") bodyHtml = renderNotebookSection();
    else if (adminState.activeSection === "workbench") bodyHtml = renderWorkbenchSection();
    else if (adminState.activeSection === "publish") bodyHtml = renderPublishSection();

    dialog.innerHTML = `
      <header class="admin-header">
        <div class="admin-brand">
          <span class="admin-brand-mark" aria-hidden="true">${he ? "או" : "OW"}</span>
          <div>
            <h2>${copy.studioTitle}</h2>
            <small>${copy.studioSub}</small>
          </div>
        </div>
        <div class="admin-header-tools">
          <span class="admin-status-pill ${hasDraft ? "is-draft" : ""}" id="admin-status-pill">
            ${hasDraft ? copy.draftBadge : copy.syncedBadge}
          </span>
          <div class="admin-lang-seg" role="group" aria-label="Editing language">
            <button type="button" data-edit-lang="he" aria-pressed="${adminState.editLang === "he"}">${copy.langHe}</button>
            <button type="button" data-edit-lang="en" aria-pressed="${adminState.editLang === "en"}">${copy.langEn}</button>
            <button type="button" data-edit-lang="both" aria-pressed="${adminState.editLang === "both"}">${copy.langBoth}</button>
          </div>
          <button type="button" class="admin-btn" id="admin-preview-btn">${copy.previewBtn}</button>
          ${
            adminState.activeSection !== "publish"
              ? `<button type="button" class="admin-btn is-berry" id="admin-jump-publish">${copy.publishQuickBtn}</button>`
              : ""
          }
          <button type="button" class="admin-btn" id="admin-close-btn">${copy.closeBtn}</button>
        </div>
      </header>

      <div class="admin-shell">
        <nav class="admin-nav" aria-label="Admin sections">
          <div class="admin-nav-group">${copy.navContent}</div>
          <button type="button" data-admin-sec="profile" aria-current="${adminState.activeSection === "profile" ? "page" : "false"}">
            <span>${copy.sections.profile.label}</span>
          </button>
          <button type="button" data-admin-sec="shelf" aria-current="${adminState.activeSection === "shelf" ? "page" : "false"}">
            <span>${copy.sections.shelf.label}</span>
            <span class="nav-count">${FEATURED_PRINTS.length}</span>
          </button>
          <button type="button" data-admin-sec="gallery" aria-current="${adminState.activeSection === "gallery" ? "page" : "false"}">
            <span>${copy.sections.gallery.label}</span>
            <span class="nav-count">${GALLERY_ITEMS.length}</span>
          </button>
          <button type="button" data-admin-sec="films" aria-current="${adminState.activeSection === "films" ? "page" : "false"}">
            <span>${copy.sections.films.label}</span>
            <span class="nav-count">${VIDEOS.length}</span>
          </button>
          <button type="button" data-admin-sec="archive" aria-current="${adminState.activeSection === "archive" ? "page" : "false"}">
            <span>${copy.sections.archive.label}</span>
            <span class="nav-count">${CATALOGUE_ITEMS.length}</span>
          </button>
          <button type="button" data-admin-sec="notebook" aria-current="${adminState.activeSection === "notebook" ? "page" : "false"}">
            <span>${copy.sections.notebook.label}</span>
            <span class="nav-count">${NOTEBOOK_SPREADS.he.tabs.length}</span>
          </button>
          <button type="button" data-admin-sec="workbench" aria-current="${adminState.activeSection === "workbench" ? "page" : "false"}">
            <span>${copy.sections.workbench.label}</span>
          </button>

          <div class="admin-nav-group">${copy.navSystem}</div>
          <button type="button" data-admin-sec="publish" aria-current="${adminState.activeSection === "publish" ? "page" : "false"}">
            <span>${copy.sections.publish.label}</span>
          </button>
        </nav>

        <section class="admin-main">
          <div class="admin-subbar">
            <div>
              <h3>${secMeta.label}</h3>
              <p>${secMeta.desc}</p>
            </div>
            ${
              adminState.activeSection !== "publish"
                ? `<input type="search" class="admin-search" id="admin-search-input" placeholder="${copy.searchPlaceholder}" value="${esc(adminState.search)}" />`
                : ""
            }
          </div>
          <div class="admin-scroll" id="admin-scroll-body">
            ${bodyHtml}
          </div>
        </section>
      </div>
    `;

    bindDialogEvents();
  }

  function bindDialogEvents() {
    // Header buttons
    dialog.querySelector("#admin-close-btn")?.addEventListener("click", closeAdmin);
    dialog.querySelector("#admin-preview-btn")?.addEventListener("click", closeAdmin);
    dialog.querySelector("#admin-jump-publish")?.addEventListener("click", () => {
      adminState.activeSection = "publish";
      renderAdminDialog();
    });

    dialog.querySelectorAll("[data-edit-lang]").forEach((btn) => {
      btn.addEventListener("click", () => {
        adminState.editLang = btn.dataset.editLang;
        renderAdminDialog();
      });
    });

    dialog.querySelectorAll("[data-admin-sec]").forEach((btn) => {
      btn.addEventListener("click", () => {
        adminState.activeSection = btn.dataset.adminSec;
        renderAdminDialog();
      });
    });

    const searchInput = dialog.querySelector("#admin-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const pos = e.target.selectionStart;
        adminState.search = e.target.value;
        const scrollBody = dialog.querySelector("#admin-scroll-body");
        if (scrollBody) {
          if (adminState.activeSection === "profile") scrollBody.innerHTML = renderProfileSection();
          else if (adminState.activeSection === "shelf") scrollBody.innerHTML = renderShelfSection();
          else if (adminState.activeSection === "gallery") scrollBody.innerHTML = renderGallerySection();
          else if (adminState.activeSection === "films") scrollBody.innerHTML = renderFilmsSection();
          else if (adminState.activeSection === "archive") scrollBody.innerHTML = renderArchiveSection();
          else if (adminState.activeSection === "notebook") scrollBody.innerHTML = renderNotebookSection();
          else if (adminState.activeSection === "workbench") scrollBody.innerHTML = renderWorkbenchSection();
          bindScrollEvents();
        }
        e.target.setSelectionRange(pos, pos);
      });
    }

    bindScrollEvents();
  }

  function bindScrollEvents() {
    const scrollEl = dialog.querySelector("#admin-scroll-body");
    if (!scrollEl) return;

    // Live input binding — mutates store & updates live site behind modal WITHOUT re-rendering the active input!
    let refreshTimer = 0;
    scrollEl.querySelectorAll("[data-bind-root]").forEach((el) => {
      const eventName = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(eventName, () => {
        const root = getRootMap()[el.dataset.bindRoot];
        const path = JSON.parse(el.dataset.bindPath);
        setByPath(root, path, el.value);
        saveDraft(false);

        const pill = dialog.querySelector("#admin-status-pill");
        if (pill) {
          pill.classList.add("is-draft");
          pill.textContent = ui().draftBadge;
        }
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          onSiteRefresh?.();
        }, 120);
      });
    });

    // Accordion expand/collapse
    scrollEl.querySelectorAll("[data-toggle-card]").forEach((head) => {
      head.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        const key = head.dataset.toggleCard;
        if (adminState.openCards.has(key)) adminState.openCards.delete(key);
        else adminState.openCards.add(key);
        renderAdminDialog();
      });
    });

    // Show/Hide toggle on Shelf / Gallery / Archive
    scrollEl.querySelectorAll("[data-toggle-hide]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const arr = getRootMap()[btn.dataset.toggleHide];
        const idx = Number(btn.dataset.idx);
        const item = arr[idx];
        if (!item) return;
        // Keep at least 1 featured print visible on shelf
        if (btn.dataset.toggleHide === "FEATURED_PRINTS" && !item.hidden) {
          const visibleCount = arr.filter((x) => !x.hidden).length;
          if (visibleCount <= 1) return;
        }
        item.hidden = !item.hidden;
        saveDraft(true);
        renderAdminDialog();
      });
    });

    // Reorder Up / Down
    scrollEl.querySelectorAll("[data-move-item]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const arr = getRootMap()[btn.dataset.moveItem];
        const idx = Number(btn.dataset.idx);
        const dir = Number(btn.dataset.dir);
        const nextIdx = idx + dir;
        if (nextIdx < 0 || nextIdx >= arr.length) return;
        const [moved] = arr.splice(idx, 1);
        arr.splice(nextIdx, 0, moved);
        saveDraft(true);
        renderAdminDialog();
      });
    });

    // Taped Note add/delete rows
    scrollEl.querySelector("[data-add-taped-item]")?.addEventListener("click", () => {
      PROFILE.he.tapedItems.push({ label: "תחנה חדשה", meta: "2026" });
      PROFILE.en.tapedItems.push({ label: "New milestone", meta: "2026" });
      saveDraft(true);
      renderAdminDialog();
    });
    scrollEl.querySelectorAll("[data-del-taped-item]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.delTapedItem);
        PROFILE.he.tapedItems.splice(i, 1);
        PROFILE.en.tapedItems.splice(i, 1);
        saveDraft(true);
        renderAdminDialog();
      });
    });

    // Shelf highlight add/delete
    scrollEl.querySelectorAll("[data-add-highlight]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.addHighlight);
        FEATURED_PRINTS[idx].he.highlights.push({ k: "פרט חדש", v: "תיאור קצר" });
        FEATURED_PRINTS[idx].en.highlights.push({ k: "New detail", v: "Short description" });
        saveDraft(true);
        renderAdminDialog();
      });
    });
    scrollEl.querySelectorAll("[data-del-highlight]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const [idx, hi] = btn.dataset.delHighlight.split(":").map(Number);
        FEATURED_PRINTS[idx].he.highlights.splice(hi, 1);
        FEATURED_PRINTS[idx].en.highlights.splice(hi, 1);
        saveDraft(true);
        renderAdminDialog();
      });
    });

    // Add new custom work in Archive
    scrollEl.querySelector("#admin-add-work")?.addEventListener("click", () => {
      const id = `cat-custom-${Date.now()}`;
      CATALOGUE_ITEMS.unshift({
        id,
        isCustom: true,
        category: "books",
        year: String(new Date().getFullYear()),
        thumb: "assets/prints/journalism.jpg",
        en: {
          title: "New Project Title",
          desc: "Short description of the project.",
          extra: "Additional note shown when expanding 'Read note'.",
        },
        he: {
          title: "כותרת עבודה חדשה",
          desc: "תיאור קצר של הפרויקט או הכתבה.",
          extra: "הערת הרחבה המופיעה בלחיצה על 'קריאת הערה'.",
        },
      });
      adminState.openCards.add(`cat-${id}`);
      saveDraft(true);
      renderAdminDialog();
    });

    scrollEl.querySelectorAll("[data-del-archive]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.delArchive);
        CATALOGUE_ITEMS.splice(idx, 1);
        saveDraft(true);
        renderAdminDialog();
      });
    });

    // Publish section actions
    const readPubInputs = () => {
      const owner = scrollEl.querySelector("#pub-owner")?.value?.trim() || "Goidelg";
      const repo = scrollEl.querySelector("#pub-repo")?.value?.trim() || "orin-winberg-portfolio";
      const token = scrollEl.querySelector("#pub-token")?.value?.trim() || "";
      savePublishConfig({ owner, repo, token });
      return { owner, repo, token };
    };

    scrollEl.querySelector("#pub-toggle-token")?.addEventListener("click", () => {
      readPubInputs();
      adminState.showToken = !adminState.showToken;
      renderAdminDialog();
    });

    scrollEl.querySelector("#pub-test-btn")?.addEventListener("click", async () => {
      const he = isHeUi();
      const cfg = readPubInputs();
      adminState.publishBusy = true;
      adminState.publishMsg = { type: "info", text: he ? "בודק חיבור ל-GitHub…" : "Testing GitHub connection…" };
      renderAdminDialog();
      try {
        const res = await testGitHubConnection(cfg);
        adminState.publishMsg = {
          type: "ok",
          text: he
            ? `החיבור תקין! מחובר בהצלחה אל ${res.fullName} עם הרשאת פרסום.`
            : `Connected! Verified write access to ${res.fullName}.`,
        };
      } catch (err) {
        adminState.publishMsg = {
          type: "err",
          text: `${he ? "שגיאת חיבור:" : "Connection failed:"} ${err.message}`,
        };
      } finally {
        adminState.publishBusy = false;
        renderAdminDialog();
      }
    });

    scrollEl.querySelector("#pub-go-btn")?.addEventListener("click", async () => {
      const he = isHeUi();
      const cfg = readPubInputs();
      if (!cfg.token) {
        adminState.publishMsg = {
          type: "err",
          text: he
            ? "כדי לפרסם ישירות לאתר החי, הדביקי קודם את מפתח הפרסום של GitHub (הוראות למטה)."
            : "Please paste your GitHub Publish Key above first (instructions below).",
        };
        renderAdminDialog();
        return;
      }
      adminState.publishBusy = true;
      adminState.publishMsg = {
        type: "info",
        text: he ? "מעלה שינויים ל-orinwinberg.com…" : "Uploading changes to orinwinberg.com…",
      };
      renderAdminDialog();
      try {
        await publishToGitHub({
          ...cfg,
          onStep: (branch) => {
            adminState.publishMsg = {
              type: "info",
              text:
                branch === "gh-pages"
                  ? he
                    ? "שלב 1/2: מעדכן את האתר החי (gh-pages)…"
                    : "Step 1/2: Updating live site (gh-pages)…"
                  : he
                  ? "שלב 2/2: מסנכרן גיבוי ב-main…"
                  : "Step 2/2: Syncing backup to main…",
            };
            renderAdminDialog();
          },
        });
        adminState.publishMsg = {
          type: "ok",
          text: he
            ? "פורסם בהצלחה! השינויים יהיו באוויר ב-orinwinberg.com בתוך כ-30 שניות."
            : "Published! Your changes will be live on orinwinberg.com in ~30 seconds.",
        };
      } catch (err) {
        adminState.publishMsg = {
          type: "err",
          text: `${he ? "הפרסום נכשל:" : "Publish failed:"} ${err.message}`,
        };
      } finally {
        adminState.publishBusy = false;
        renderAdminDialog();
      }
    });

    scrollEl.querySelector("#pub-export-btn")?.addEventListener("click", () => {
      const blob = new Blob([exportContentJson()], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "content.json";
      a.click();
      URL.revokeObjectURL(url);
    });

    scrollEl.querySelector("#pub-import-btn")?.addEventListener("click", () => {
      scrollEl.querySelector("#pub-import-file")?.click();
    });

    scrollEl.querySelector("#pub-import-file")?.addEventListener("change", async (e) => {
      const he = isHeUi();
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        importContentJson(text);
        adminState.publishMsg = {
          type: "ok",
          text: he
            ? "קובץ הגיבוי נטען כטיוטה! תוכלי לבדוק בתצוגה מקדימה וללחוץ פרסום."
            : "Backup imported as a draft! Preview your changes and click Publish when ready.",
        };
      } catch (err) {
        adminState.publishMsg = {
          type: "err",
          text: `${he ? "קובץ לא תקין:" : "Invalid JSON file:"} ${err.message}`,
        };
      }
      renderAdminDialog();
    });

    scrollEl.querySelector("#pub-discard-btn")?.addEventListener("click", () => {
      const he = isHeUi();
      if (!confirm(he ? "לבטל את כל השינויים בטיוטה ולחזור לגרסה החיה?" : "Discard all local draft edits and restore the live site version?")) {
        return;
      }
      discardDraft();
      adminState.publishMsg = {
        type: "info",
        text: he ? "הטיוטה בוטלה — הוחזרה הגרסה החיה." : "Draft discarded — restored live version.",
      };
      renderAdminDialog();
    });

    scrollEl.querySelector("#pub-reset-btn")?.addEventListener("click", () => {
      const he = isHeUi();
      if (!confirm(he ? "לאפס את כל הטקסטים לברירת המחדל המקורית של האתר?" : "Reset all texts back to the original default content?")) {
        return;
      }
      resetToDefaults();
      adminState.publishMsg = {
        type: "info",
        text: he
          ? "שוחזרו טקסטים מקוריים כטיוטה. לחצי 'פרסמי עכשיו' אם ברצונך לעדכן גם את האתר החי."
          : "Restored original defaults as a draft. Click Publish if you want to push this live.",
      };
      renderAdminDialog();
    });
  }

  function openAdmin(section = null) {
    if (section) adminState.activeSection = section;
    renderAdminDialog();
    if (!dialog.open) dialog.showModal();
    updateDraftBanner();
  }

  function closeAdmin() {
    if (dialog.open) dialog.close();
    if (location.hash === "#admin") {
      history.replaceState(null, "", document.documentElement.dataset.view === "shelf" ? "#boring" : "#desk");
    }
    onSiteRefresh?.();
    updateDraftBanner();
  }

  dialog.addEventListener("close", () => {
    if (location.hash === "#admin") {
      history.replaceState(null, "", document.documentElement.dataset.view === "shelf" ? "#boring" : "#desk");
    }
    onSiteRefresh?.();
    updateDraftBanner();
  });

  // Keyboard shortcut: Ctrl+Shift+E / Cmd+Shift+E
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "e") {
      e.preventDefault();
      if (dialog.open) closeAdmin();
      else openAdmin();
    }
  });

  // Hash navigation: https://orinwinberg.com/#admin
  window.addEventListener("hashchange", () => {
    if (location.hash === "#admin") {
      openAdmin();
    }
  });

  return {
    openAdmin,
    closeAdmin,
    updateDraftBanner,
    refreshIfOpen: () => {
      if (dialog.open) renderAdminDialog();
      updateDraftBanner();
    },
  };
}
