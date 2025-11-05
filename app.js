// overview. — app.js (no frameworks needed)

// Store data
let entries = [];
let categories = [];
let synonyms = {};

// Elements
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const categoryGrid = document.getElementById("categoryGrid");
const entryDialog = document.getElementById("entryDialog");
const entryContent = document.getElementById("entryContent");
const btnInstall = document.getElementById("btnInstall");
const storeDialog = document.getElementById('storeDialog');
const btnDownload = document.getElementById('btnDownload');
const storeAndroid = document.getElementById('storeAndroid');
const storeIos = document.getElementById('storeIos');

// Scrollable categories set
const SCROLLABLE_CATEGORIES = new Set(['emotions', 'spiritual', 'relationships']);

// Load content.json
async function loadContent() {
  try {
    const res = await fetch("content.json");
    const data = await res.json();

    if (Array.isArray(data)) {
      // simple array format: treat as entries
      entries = data;
      // derive categories from entries
      const map = {};
      entries.forEach(e => {
        const key = e.category || 'uncategorized';
        if (!map[key]) map[key] = { key, name: key.charAt(0).toUpperCase() + key.slice(1) };
      });
      categories = Object.values(map);
      synonyms = {};
    } else {
      // object format
      entries = data.entries || [];
      synonyms = data.synonyms || {};

      if (Array.isArray(data.categories) && data.categories.length) {
        categories = data.categories;
      } else {
        // derive categories if not provided
        const map = {};
        entries.forEach(e => {
          const key = e.category || 'uncategorized';
          if (!map[key]) map[key] = { key, name: key.charAt(0).toUpperCase() + key.slice(1) };
        });
        categories = Object.values(map);
      }
    }

    renderCategories();
  } catch (err) {
    console.error("Failed to load content.json:", err);
  }
}
loadContent();

// Render categories into grid
function renderCategories() {
  categoryGrid.innerHTML = "";
  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.textContent = cat.name;
    btn.addEventListener("click", () => showCategory(cat.key));
    categoryGrid.appendChild(btn);
  });
}

// Filter entries by category
function showCategory(catKey) {
  const list = entries.filter(e => e.category === catKey);
  const isScrollable = SCROLLABLE_CATEGORIES.has(catKey);
  showResults(list, isScrollable);
}

// --- SEARCH ---

searchInput.addEventListener("input", () => {
  const term = searchInput.value.trim().toLowerCase();
  if (!term) return clearSuggestions();

  const expanded = expandSynonyms(term);
  const matched = scoreMatches(expanded).slice(0, 6);

  if (!matched.length) return clearSuggestions();

  // map matched summary objects back to full entry objects
  const fullList = matched.map(m => entries.find(e => e.id === m.id)).filter(Boolean);

  // determine if we should render results in a limited scrollable container
  const isCategoryTerm = expanded.some(t => SCROLLABLE_CATEGORIES.has(t));
  const allInScrollableCategory = fullList.length > 0 && fullList.every(e => SCROLLABLE_CATEGORIES.has(e.category));
  const isScrollable = isCategoryTerm || allInScrollableCategory;

  showResults(fullList, isScrollable);
});

function clearSuggestions() {
  searchResults.hidden = true;
  searchResults.innerHTML = "";
  // reset any scroll styling
  searchResults.style.maxHeight = "";
  searchResults.style.overflowY = "";
}

function expandSynonyms(term) {
  const set = new Set([term]);
  Object.entries(synonyms).forEach(([key, group]) => {
    if (key.includes(term) || group.includes(term)) {
      set.add(key);
      group.forEach(v => set.add(v));
    }
  });
  return [...set];
}

function scoreMatches(terms) {
  return entries
    .map(e => {
      const hay = `${e.title} ${e.tags.join(" ")} ${e.context} ${e.reflection}`.toLowerCase();
      const score = terms.reduce((s, t) => (hay.includes(t) ? s + 1 : s), 0);
      return score > 0 ? { id: e.id, title: e.title, score } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}

// Display results (used by category view)
function showResults(list, scrollable = false) {
  searchResults.hidden = false;
  searchResults.innerHTML = list
    .map(e => `<li data-id="${e.id}">${e.title}</li>`)
    .join("");

  if (scrollable) {
    searchResults.style.maxHeight = '320px';
    searchResults.style.overflowY = 'auto';
  } else {
    searchResults.style.maxHeight = '';
    searchResults.style.overflowY = '';
  }

  document.querySelectorAll("#searchResults li").forEach(li =>
    li.addEventListener("click", () => openEntry(li.dataset.id))
  );
}

// --- ENTRY MODAL ---

function openEntry(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;

  entryContent.innerHTML = `
    <h3>${e.title}</h3>
    <div class="scripture">${e.scripture.map(v => `<p>${v}</p>`).join("")}</div>
    <section><strong>Context</strong><p>${e.context}</p></section>
    <section><strong>Reflection</strong><p>${e.reflection}</p></section>
    <section><strong>Prayer</strong><p>${e.prayer}</p></section>
    <details><summary>Additional Verses</summary><ul>${e.additional.map(v => `<li>${v}</li>`).join("")}</ul></details>
  `;

  // Lock background scrolling while dialog is open
  const scrollY = window.scrollY || window.pageYOffset || 0;
  document.body.dataset.scrollY = scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';

  entryDialog.showModal();
}

// Close dialog when clicking on the backdrop (outside the dialog content)
entryDialog.addEventListener('click', (event) => {
  const rect = entryDialog.getBoundingClientRect();
  const isInDialog = (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  );
  if (!isInDialog) {
    entryDialog.close();
  }
});

// Restore background scroll when dialog is closed
entryDialog.addEventListener('close', () => {
  const prev = document.body.dataset.scrollY ? parseInt(document.body.dataset.scrollY, 10) : 0;
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo(0, prev);
  delete document.body.dataset.scrollY;
});

// --- PWA INSTALL ---

let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  btnInstall.hidden = false;
});

btnInstall.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  btnInstall.hidden = true;
});

// --- SERVICE WORKER ---

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

// Open store chooser dialog
if (btnDownload) {
  btnDownload.addEventListener('click', () => {
    // lock background scroll
    const scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.dataset.scrollY = scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';

    storeDialog.showModal();
  });
}

// Close store dialog on backdrop click
if (storeDialog) {
  storeDialog.addEventListener('click', (event) => {
    const rect = storeDialog.getBoundingClientRect();
    const isInDialog = (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
    if (!isInDialog) {
      storeDialog.close();
    }
  });

  storeDialog.addEventListener('close', () => {
    const prev = document.body.dataset.scrollY ? parseInt(document.body.dataset.scrollY, 10) : 0;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, prev);
    delete document.body.dataset.scrollY;
  });
}

// Platform buttons
if (storeAndroid) {
  storeAndroid.addEventListener('click', () => {
    window.open('https://play.google.com/store/apps/details?id=com.sirma.mobile.bible.android&pcampaignid=web_share', '_blank', 'noopener');
    storeDialog.close();
  });
}
if (storeIos) {
  storeIos.addEventListener('click', () => {
    window.open('https://apps.apple.com/us/app/bible/id282935706', '_blank', 'noopener');
    storeDialog.close();
  });
}
