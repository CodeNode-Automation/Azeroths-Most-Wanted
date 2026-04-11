// Core DOM helpers prepended during final JS assembly.

function getTemplateRootHtml(templateId) {
    const template = document.getElementById(templateId);
    const rootEl = template?.content?.firstElementChild;
    return rootEl ? rootEl.cloneNode(true) : null;
}

function appendConciseBadges(container, badgeConfigs) {
    if (!container || !badgeConfigs || badgeConfigs.length === 0) return;

    const wrapperTemplate = document.getElementById('tpl-concise-badges-wrapper');
    const pillTemplate = document.getElementById('tpl-concise-badge-pill');
    const reigningTemplate = document.getElementById('tpl-concise-badge-reigning');

    if (!wrapperTemplate || !pillTemplate || !reigningTemplate) return;

    const wrapperClone = wrapperTemplate.content.cloneNode(true);
    const wrapper = wrapperClone.querySelector('.c-badges-wrapper');

    badgeConfigs.forEach(({ text, title = '', classNames = [] }) => {
        const isReigning = classNames.includes('c-badge-reigning');
        const badgeTemplate = isReigning ? reigningTemplate : pillTemplate;
        const badgeClone = badgeTemplate.content.cloneNode(true);
        const badgeEl = badgeClone.querySelector(isReigning ? '.c-badge-reigning' : '.c-badge-pill');

        classNames.forEach(cls => badgeEl.classList.add(cls));
        badgeEl.textContent = text;
        if (title) badgeEl.title = title;

        wrapper.appendChild(badgeClone);
    });

    container.appendChild(wrapperClone);
}

function appendConciseMeta(container, { raceName, specIconUrl, displaySpecClass, isClickable }) {
    if (!container) return;

    container.textContent = '';

    if (!isClickable) {
        container.textContent = `${raceName} ${displaySpecClass}`;
        return;
    }

    container.appendChild(document.createTextNode(`${raceName} • `));

    if (specIconUrl) {
        const specIconTemplate = document.getElementById('tpl-concise-spec-icon');
        if (specIconTemplate) {
            const specClone = specIconTemplate.content.cloneNode(true);
            const specImg = specClone.querySelector('.concise-spec-icon');
            specImg.src = specIconUrl;
            container.appendChild(specClone);
        }
    }

    container.appendChild(document.createTextNode(displaySpecClass));
}

function buildConciseTrendHtml(trend) {
    const template = document.getElementById('tpl-concise-trend-indicator');
    if (!template) return null;

    const clone = template.content.cloneNode(true);
    const trendEl = clone.querySelector('.trend-indicator-concise');
    if (!trendEl) return null;

    if (trend > 0) {
        trendEl.classList.add('trend-positive');
        trendEl.textContent = `▲ ${trend}`;
    } else if (trend < 0) {
        trendEl.classList.add('trend-negative');
        trendEl.textContent = `▼ ${Math.abs(trend)}`;
    } else {
        trendEl.classList.add('trend-neutral');
        trendEl.textContent = '-';
    }

    const rootEl = clone.firstElementChild;
    return rootEl || null;
}

function buildHeroBandItemNode({ kicker, value, meta = '', char = null, filterKey = '', filterValue = '' }) {
    const template = document.getElementById('tpl-hero-band-item');
    if (!template) return null;

    const clone = template.content.cloneNode(true);
    const cardEl = clone.querySelector('.hero-band-item');
    const kickerEl = clone.querySelector('.hero-band-kicker');
    const valueEl = clone.querySelector('.hero-band-value');
    const metaEl = clone.querySelector('.hero-band-meta');

    if (kickerEl) kickerEl.textContent = kicker;
    if (valueEl) valueEl.textContent = value;
    if (metaEl) metaEl.textContent = meta;

    if (cardEl && char && char.profile && char.profile.name) {
        const profile = char.profile;
        const cClass = profile.character_class && profile.character_class.name
            ? (typeof profile.character_class.name === 'string' ? profile.character_class.name : profile.character_class.name.en_US)
            : 'Unknown';

        cardEl.classList.add('tt-char', 'hero-band-item-interactive');
        cardEl.setAttribute('data-char', profile.name.toLowerCase());
        cardEl.setAttribute('data-class', cClass);
        cardEl.setAttribute('data-spec', profile.active_spec || 'unspecced');
        cardEl.setAttribute('data-awards', safeParseArray(profile.badges).join(','));
        cardEl.setAttribute('tabindex', '0');
    }

    if (cardEl && filterKey && filterValue) {
        cardEl.classList.add('hero-band-item-filter', 'hero-band-item-interactive');
        cardEl.setAttribute('data-filter-key', filterKey);
        cardEl.setAttribute('data-filter-value', filterValue);
        cardEl.setAttribute('tabindex', '0');
    }

    return clone.firstElementChild || null;
}
