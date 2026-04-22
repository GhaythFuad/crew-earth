const QUOTE_STYLES = [
  {
    id: 'mission-plaque',
    name: 'Mission Plaque',
    description: 'A quiet museum-style note that sits in the upper-left and lets the planet stay dominant.',
  },
  {
    id: 'orbital-callout',
    name: 'Orbital Callout',
    description: 'An editorial annotation with a trajectory line, as if the quote were part of mission analysis.',
  },
  {
    id: 'mission-broadcast',
    name: 'Mission Broadcast',
    description: 'A wide lower transmission bar that feels closer to a public-address message from mission control.',
  },
  {
    id: 'starboard-note',
    name: 'Starboard Note',
    description: 'A right-edge margin note that keeps the quote present without pulling focus from the planet.',
  },
  {
    id: 'mission-ledger',
    name: 'Mission Ledger',
    description: 'A restrained logbook layout that frames the quote like a record from the mission timeline.',
  },
  {
    id: 'field-journal',
    name: 'Field Journal',
    description: 'A softer notebook-style caption anchored low on the left side of the frame.',
  },
  {
    id: 'dock-caption',
    name: 'Dock Caption',
    description: 'The lightest option: a footer-like caption tucked into the edge of the scene.',
  },
];

const STORAGE_KEY = 'earth.quoteStyle';
const DEFAULT_STYLE_ID = 'starboard-note';
const WHEEL_STEP_DELAY_MS = 160;

function clampIndex(index) {
  const count = QUOTE_STYLES.length;
  return (index % count + count) % count;
}

function readSavedIndex() {
  try {
    const savedStyleId = window.localStorage.getItem(STORAGE_KEY);
    const savedIndex = QUOTE_STYLES.findIndex(style => style.id === savedStyleId);
    if (savedIndex >= 0) {
      return savedIndex;
    }
    const defaultIndex = QUOTE_STYLES.findIndex(style => style.id === DEFAULT_STYLE_ID);
    return defaultIndex >= 0 ? defaultIndex : 0;
  } catch {
    const defaultIndex = QUOTE_STYLES.findIndex(style => style.id === DEFAULT_STYLE_ID);
    return defaultIndex >= 0 ? defaultIndex : 0;
  }
}

function saveIndex(index) {
  try {
    window.localStorage.setItem(STORAGE_KEY, QUOTE_STYLES[index].id);
  } catch {
    // Ignore storage failures and keep the in-memory choice.
  }
}

function initQuoteShowcase() {
  const stage = document.getElementById('quote-stage');
  const selector = document.getElementById('quote-selector');
  const wheel = document.getElementById('quote-style-wheel');
  const nameEl = document.getElementById('quote-style-name');
  const countEl = document.getElementById('quote-style-count');
  const descriptionEl = document.getElementById('quote-style-description');
  const prevBtn = document.getElementById('quote-style-prev');
  const nextBtn = document.getElementById('quote-style-next');

  if (!stage || !selector || !wheel || !nameEl || !countEl || !descriptionEl || !prevBtn || !nextBtn) {
    return;
  }

  const variants = Array.from(stage.querySelectorAll('.quote-variant'));
  if (!variants.length) {
    return;
  }

  const chipButtons = QUOTE_STYLES.map((style, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quote-style-chip';
    button.dataset.index = String(index);
    button.setAttribute('aria-label', style.name);
    button.title = style.description;
    button.addEventListener('click', () => {
      setActiveIndex(index);
      button.focus();
    });
    wheel.appendChild(button);
    return button;
  });

  let activeIndex = readSavedIndex();
  let lastWheelAt = 0;

  function setActiveIndex(nextIndex) {
    activeIndex = clampIndex(nextIndex);
    const activeStyle = QUOTE_STYLES[activeIndex];

    variants.forEach(variant => {
      variant.classList.toggle('is-active', variant.dataset.style === activeStyle.id);
    });

    chipButtons.forEach((button, index) => {
      button.classList.toggle('is-active', index === activeIndex);
      button.setAttribute('aria-pressed', index === activeIndex ? 'true' : 'false');
    });

    selector.dataset.activeStyle = activeStyle.id;
    nameEl.textContent = activeStyle.name;
    if (descriptionEl) {
      descriptionEl.textContent = activeStyle.description;
    }
    selector.title = activeStyle.description;
    countEl.textContent = `${activeIndex + 1} / ${QUOTE_STYLES.length}`;
    saveIndex(activeIndex);
  }

  function step(direction) {
    setActiveIndex(activeIndex + direction);
  }

  function onWheel(event) {
    event.preventDefault();

    const dominantDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (Math.abs(dominantDelta) < 3) {
      return;
    }

    const now = Date.now();
    if (now - lastWheelAt < WHEEL_STEP_DELAY_MS) {
      return;
    }
    lastWheelAt = now;

    step(dominantDelta > 0 ? 1 : -1);
  }

  wheel.addEventListener('wheel', onWheel, { passive: false });
  selector.addEventListener('wheel', onWheel, { passive: false });

  wheel.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    }
  });

  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));

  setActiveIndex(activeIndex);
}

initQuoteShowcase();
