// Ladder shell and rank-list render helpers prepended during final JS assembly.

function getLadderConfig(hashUrl) {
    if (hashUrl === 'ladder-pvp') {
        return {
            theme: 'pvp',
            overline: 'Netherstorm War Ledger',
            heroTitle: 'The Blood Ledger of Outland',
            heroDesc: "From the Ring of Trials to the skirmishes of Hellfire and Nagrand, this war board tracks the guild's fiercest killers, sharpest climbs, and the challengers pressing toward gladiatorial glory.",
            metricLabel: 'Honorable Kills',
            metricShort: 'HKs',
            podiumKicker: 'Arena War Council',
            podiumTitle: 'Champions of the Arena Sands',
            podiumDesc: 'The three duelists currently holding command of the blood-soaked ladder.'
        };
    }

    return {
        theme: 'pve',
        overline: 'Outland Raid Dispatch',
        heroTitle: 'The Black Temple Vanguard',
        heroDesc: "A command ledger for the raiders leading the march through Karazhan, Serpentshrine, Tempest Keep, Hyjal, and the Black Temple itself. See who stands ready, who is surging, and who is closing on the front line.",
        metricLabel: 'Item Level',
        metricShort: 'iLvl',
        podiumKicker: 'Raid Vanguard',
        podiumTitle: 'Champions of the Expedition',
        podiumDesc: "The current standard-bearers for guild progression across Outland's hardest encounters."
    };
}

function buildLadderHeroStatNode(value, label) {
    const template = document.getElementById('tpl-ladder-hero-stat');
    if (!template) return null;

    const clone = template.content.cloneNode(true);
    const valueEl = clone.querySelector('.ladder-hero-stat-value');
    const labelEl = clone.querySelector('.ladder-hero-stat-label');

    if (valueEl) valueEl.textContent = value;
    if (labelEl) labelEl.textContent = label;

    return clone.firstElementChild || null;
}

function buildLadderSeparatorNode(label) {
    const template = document.getElementById('tpl-ladder-rank-separator');
    if (!template) return null;

    const clone = template.content.cloneNode(true);
    const labelEl = clone.querySelector('.ladder-rank-separator-label');
    if (labelEl) labelEl.textContent = label;

    return clone.firstElementChild || null;
}

function getLadderSeparatorLabel(rankNumber, totalCount) {
    if (rankNumber === 4) {
        return `The Pursuing Pack • Ranks #4 - #${Math.min(9, totalCount)}`;
    }

    if (rankNumber >= 10 && (rankNumber - 10) % 5 === 0) {
        return `Ranks #${rankNumber} - #${Math.min(rankNumber + 4, totalCount)}`;
    }

    return '';
}

function decorateLadderRows(rowNodes, totalCount) {
    const decoratedNodes = [];

    rowNodes.forEach((node, index) => {
        const actualRank = index + 4;
        const separatorLabel = getLadderSeparatorLabel(actualRank, totalCount);

        if (separatorLabel) {
            const separatorNode = buildLadderSeparatorNode(separatorLabel);
            if (separatorNode) decoratedNodes.push(separatorNode);
        }

        decoratedNodes.push(node);
    });

    return decoratedNodes;
}

function findLadderCharacterIndex(characters, rawQuery) {
    const query = (rawQuery || '').toLowerCase().trim();
    if (!query) return -1;

    const names = characters.map(char => char && char.profile && char.profile.name ? char.profile.name.toLowerCase() : '');

    let matchIndex = names.findIndex(name => name === query);
    if (matchIndex !== -1) return matchIndex;

    matchIndex = names.findIndex(name => name.startsWith(query));
    if (matchIndex !== -1) return matchIndex;

    return names.findIndex(name => name.includes(query));
}

function buildLadderShell(characters, hashUrl) {
    const template = document.getElementById('tpl-ladder-shell');
    if (!template || !Array.isArray(characters) || characters.length === 0) return null;

    const config = getLadderConfig(hashUrl);
    const clone = template.content.cloneNode(true);
    const shell = clone.querySelector('.ladder-hero-shell');
    const overline = clone.querySelector('.ladder-overline');
    const heroTitle = clone.querySelector('.ladder-hero-title');
    const heroDesc = clone.querySelector('.ladder-hero-desc');
    const statsGrid = clone.querySelector('.ladder-hero-stats');
    const infoBand = clone.querySelector('.ladder-info-band');
    const podiumKicker = clone.querySelector('.ladder-section-kicker');
    const podiumTitle = clone.querySelector('.ladder-section-title');
    const podiumDesc = clone.querySelector('.ladder-section-desc');

    if (shell) shell.classList.add(`ladder-shell-${config.theme}`);
    if (overline) overline.textContent = config.overline;
    if (heroTitle) heroTitle.textContent = config.heroTitle;
    if (heroDesc) heroDesc.textContent = config.heroDesc;
    if (podiumKicker) podiumKicker.textContent = config.podiumKicker;
    if (podiumTitle) podiumTitle.textContent = config.podiumTitle;
    if (podiumDesc) podiumDesc.textContent = config.podiumDesc;

    const leader = characters[0];
    const second = characters[1] || null;
    const leaderProfile = leader.profile || {};
    const leaderName = leaderProfile.name || 'Unknown';
    const leaderMetric = getLadderMetricValue(leader, hashUrl);
    const averageMetric = Math.round(characters.reduce((sum, char) => sum + getLadderMetricValue(char, hashUrl), 0) / characters.length) || 0;

    const classCounts = characters.reduce((acc, char) => {
        const cClass = char && char.profile && char.profile.character_class && char.profile.character_class.name
            ? (typeof char.profile.character_class.name === 'string' ? char.profile.character_class.name : char.profile.character_class.name.en_US)
            : 'Unknown';
        acc[cClass] = (acc[cClass] || 0) + 1;
        return acc;
    }, {});

    const dominantClassEntry = Object.entries(classCounts).sort((a, b) => b[1] - a[1])[0] || ['Unknown', 0];
    const biggestMover = [...characters]
        .sort((a, b) => getLadderTrendValue(b, hashUrl) - getLadderTrendValue(a, hashUrl))[0] || leader;
    const biggestMoverTrend = getLadderTrendValue(biggestMover, hashUrl);
    const rivalryGap = second ? Math.max(0, leaderMetric - getLadderMetricValue(second, hashUrl)) : 0;
    const leaderRole = getCharacterRole(
        leader && leader.profile && leader.profile.character_class && leader.profile.character_class.name
            ? (typeof leader.profile.character_class.name === 'string' ? leader.profile.character_class.name : leader.profile.character_class.name.en_US)
            : 'Unknown',
        leaderProfile.active_spec || ''
    );

    [
        buildLadderHeroStatNode(characters.length.toLocaleString(), 'Ranked Heroes'),
        buildLadderHeroStatNode(formatLadderMetricValue(leaderMetric, hashUrl), `Champion ${config.metricShort}`),
        buildLadderHeroStatNode(formatLadderMetricValue(averageMetric, hashUrl), `Average ${config.metricShort}`)
    ].forEach(node => {
        if (node && statsGrid) statsGrid.appendChild(node);
    });

    const bandItems = [
        {
            kicker: 'Current Champion',
            value: leaderName,
            meta: `${formatLadderMetricValue(leaderMetric, hashUrl)} ${config.metricShort} • ${leaderRole}`,
            char: leader
        },
        {
            kicker: 'Current 7-Day MVP',
            value: biggestMover && biggestMover.profile && biggestMover.profile.name ? biggestMover.profile.name : 'No movement yet',
            meta: biggestMoverTrend > 0
                ? `▲ ${formatLadderMetricValue(biggestMoverTrend, hashUrl)} this cycle`
                : 'No positive climb recorded yet',
            char: biggestMover && biggestMover.profile && biggestMover.profile.name ? biggestMover : null
        },
        {
            kicker: 'Most Represented Class',
            value: dominantClassEntry[0],
            meta: `${dominantClassEntry[1]} heroes currently ranked`,
            filterKey: dominantClassEntry[0] !== 'Unknown' ? 'class' : '',
            filterValue: dominantClassEntry[0] !== 'Unknown' ? dominantClassEntry[0] : ''
        },
        {
            kicker: 'Closest Rivalry',
            value: second ? `${formatCompactMetricValue(rivalryGap)} ${config.metricShort}` : 'No rival yet',
            meta: second ? `Gap between #1 ${leaderName} and #2 ${second.profile && second.profile.name ? second.profile.name : 'Unknown'}` : 'Only one player is currently ranked'
        }
    ];

    bandItems.forEach(item => {
        const node = buildHeroBandItemNode(item);
        if (node && infoBand) infoBand.appendChild(node);
    });

    return clone;
}
