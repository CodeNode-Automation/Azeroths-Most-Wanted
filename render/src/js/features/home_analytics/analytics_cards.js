// Home and analytics card render helpers prepended during final JS assembly.

function formatHashName(name) {
    return (name || '').toLowerCase();
}

function setHomeRoute(el, route) {
    if (!el) return;
    if (route) el.setAttribute('data-home-route', route);
    else el.removeAttribute('data-home-route');
}

function resolvePortrait(entry) {
    if (!entry) return getClassIcon('Warrior');
    return entry.render_url || getClassIcon(getCharClass(entry));
}

function applyPressureCard(id, count, stateText, metaText) {
    const card = document.getElementById(id);
    if (!card) return;

    const valueEl = card.querySelector('.analytics-pressure-value');
    const stateEl = card.querySelector('.analytics-pressure-state');
    const metaEl = card.querySelector('.analytics-pressure-meta');

    if (valueEl) valueEl.textContent = count.toLocaleString();
    if (stateEl) stateEl.textContent = stateText;
    if (metaEl) metaEl.textContent = metaText;
}

function applyReadinessCard(id, config) {
    const card = document.getElementById(id);
    if (!card) return;

    const {
        eyebrow = '',
        name = 'Awaiting deployment',
        value = 'No geared hero logged',
        meta = 'This slot updates when a matching endgame hero is available.',
        route = '',
        portrait = getClassIcon('Warrior'),
        alt = '',
        cta = 'Inspect dossier âž”'
    } = config || {};

    const eyebrowEl = card.querySelector('.analytics-readiness-kicker');
    const nameEl = card.querySelector('.analytics-readiness-name');
    const valueEl = card.querySelector('.analytics-readiness-value');
    const metaEl = card.querySelector('.analytics-readiness-meta');
    const ctaEl = card.querySelector('.analytics-readiness-cta');
    const portraitEl = card.querySelector('.analytics-readiness-portrait');

    if (eyebrowEl) eyebrowEl.textContent = eyebrow;
    if (nameEl) nameEl.textContent = name;
    if (valueEl) valueEl.textContent = value;
    if (metaEl) metaEl.textContent = meta;
    if (ctaEl) ctaEl.textContent = cta;
    if (portraitEl) {
        portraitEl.src = portrait;
        portraitEl.alt = alt || name;
    }

    setHomeRoute(card, route);
}

function applySpotlightCard(id, config) {
    const card = document.getElementById(id);
    if (!card) return;

    const {
        eyebrow = '',
        name = 'Awaiting data',
        value = 'No movement recorded',
        meta = 'This slot will populate when the guild logs more history.',
        route = '',
        portrait = getClassIcon('Warrior'),
        alt = '',
        cta = 'Inspect âž”'
    } = config || {};

    const eyebrowEl = card.querySelector('.analytics-spotlight-kicker');
    const nameEl = card.querySelector('.analytics-spotlight-name');
    const valueEl = card.querySelector('.analytics-spotlight-value');
    const metaEl = card.querySelector('.analytics-spotlight-meta');
    const ctaEl = card.querySelector('.analytics-spotlight-cta');
    const portraitEl = card.querySelector('.analytics-spotlight-portrait');

    if (eyebrowEl) eyebrowEl.textContent = eyebrow;
    if (nameEl) nameEl.textContent = name;
    if (valueEl) valueEl.textContent = value;
    if (metaEl) metaEl.textContent = meta;
    if (ctaEl) ctaEl.textContent = cta;
    if (portraitEl) {
        portraitEl.src = portrait;
        portraitEl.alt = alt || name;
    }

    setHomeRoute(card, route);
}

function applyChronicleCard(id, config) {
    const card = document.getElementById(id);
    if (!card) return;

    const {
        kicker = '',
        title = 'Awaiting entry',
        value = 'No chronicle entry recorded',
        meta = 'This card will populate when relevant data is available.',
        route = '',
        cta = 'Inspect âž”'
    } = config || {};

    const kickerEl = card.querySelector('.analytics-chronicle-kicker');
    const titleEl = card.querySelector('.analytics-chronicle-title');
    const valueEl = card.querySelector('.analytics-chronicle-value');
    const metaEl = card.querySelector('.analytics-chronicle-meta');
    const ctaEl = card.querySelector('.analytics-chronicle-cta');

    if (kickerEl) kickerEl.textContent = kicker;
    if (titleEl) titleEl.textContent = title;
    if (valueEl) valueEl.textContent = value;
    if (metaEl) metaEl.textContent = meta;
    if (ctaEl) ctaEl.textContent = cta;

    setHomeRoute(card, route);
}

function getPressureState(count, role) {
    if (role === 'Tank') {
        if (count <= 2) return { state: 'Thin shield wall', meta: 'Priority role for dependable raid structure and dungeon leadership.' };
        if (count <= 4) return { state: 'Serviceable line', meta: 'Enough tanks to field content, but depth can still improve.' };
        return { state: 'Fortified line', meta: 'Tank coverage is healthy across the known-spec roster.' };
    }

    if (role === 'Healer') {
        if (count <= 3) return { state: 'Fragile sustain', meta: 'Healing coverage is light and should stay on the officer radar.' };
        if (count <= 6) return { state: 'Stable support', meta: 'Healing depth can sustain most nights without feeling wasteful.' };
        return { state: 'Sanctified reserve', meta: 'Healer depth looks comfortable for split groups and absences.' };
    }

    if (role === 'Ranged DPS') {
        if (count <= 4) return { state: 'Arcane gap', meta: 'Caster and ranged pressure feels thin for larger raid compositions.' };
        if (count <= 8) return { state: 'Balanced volley', meta: 'Ranged support is present, but still worth growing for flexibility.' };
        return { state: 'Volley secured', meta: 'Ranged depth is strong and well represented in the current roster.' };
    }

    if (count <= 5) return { state: 'Lean blade line', meta: 'Melee coverage exists, though substitutions could still feel tight.' };
    if (count <= 10) return { state: 'Battle-ready line', meta: 'Melee presence is healthy for most progression and farm nights.' };
    return { state: 'Frontline overflowing', meta: 'Melee pressure is abundant across the current warband.' };
}
