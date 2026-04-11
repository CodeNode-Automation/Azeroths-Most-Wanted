// Character dossier feature helpers prepended during final JS assembly.

function getDossierCommendationSnapshot(profile, source = null) {
    if (!profile) return null;

    const hallSnapshot = typeof getHallOfHeroesSnapshot === 'function'
        ? getHallOfHeroesSnapshot(profile, source)
        : null;
    const dashboardConfig = typeof getHallOfHeroesDashboardConfig === 'function'
        ? getHallOfHeroesDashboardConfig()
        : {};
    const prevMvps = dashboardConfig.prev_mvps || {};

    const vBadges = safeParseArray(profile.vanguard_badges || source?.vanguard_badges);
    const cBadges = safeParseArray(profile.campaign_badges || source?.campaign_badges);
    const campaignBadgeTypes = cBadges.map(normalizeHallOfHeroesBadgeType);

    const pveChamp = parseInt(profile.pve_champ_count || source?.pve_champ_count) || 0;
    const pvpChamp = parseInt(profile.pvp_champ_count || source?.pvp_champ_count) || 0;
    const pveGold = parseInt(profile.pve_gold || source?.pve_gold) || 0;
    const pveSilver = parseInt(profile.pve_silver || source?.pve_silver) || 0;
    const pveBronze = parseInt(profile.pve_bronze || source?.pve_bronze) || 0;
    const pvpGold = parseInt(profile.pvp_gold || source?.pvp_gold) || 0;
    const pvpSilver = parseInt(profile.pvp_silver || source?.pvp_silver) || 0;
    const pvpBronze = parseInt(profile.pvp_bronze || source?.pvp_bronze) || 0;

    const xpCount = campaignBadgeTypes.filter(type => type === 'xp').length;
    const hksCount = campaignBadgeTypes.filter(type => type === 'hks').length;
    const lootCount = campaignBadgeTypes.filter(type => type === 'loot').length;
    const zenithCount = campaignBadgeTypes.filter(type => type === 'zenith').length;
    const pveMedals = pveGold + pveSilver + pveBronze;
    const pvpMedals = pvpGold + pvpSilver + pvpBronze;
    const medalCount = pveMedals + pvpMedals;
    const championCount = pveChamp + pvpChamp;
    const level = parseInt(profile.level || source?.level) || 0;
    const cleanName = String(profile.name || '').trim().toLowerCase();
    const isPveReigning = !!(prevMvps.pve && prevMvps.pve.name && prevMvps.pve.name.toLowerCase() === cleanName);
    const isPvpReigning = !!(prevMvps.pvp && prevMvps.pvp.name && prevMvps.pvp.name.toLowerCase() === cleanName);

    let reigningValue = 'No Crown';
    let reigningMeta = 'No current reigning title is recorded for this hero.';

    if (isPveReigning && isPvpReigning) {
        reigningValue = 'Dual Crown';
        reigningMeta = 'Currently holds both reigning champion titles.';
    } else if (isPveReigning) {
        reigningValue = 'PvE Crown';
        reigningMeta = 'Currently holds the reigning PvE champion title.';
    } else if (isPvpReigning) {
        reigningValue = 'PvP Crown';
        reigningMeta = 'Currently holds the reigning PvP champion title.';
    }

    const hasZenith = zenithCount >= 1;

    const zenithFootprint = hasZenith
        ? {
            label: 'The Zenith Cohort',
            value: zenithCount,
            tone: 'zenith',
            displayValue: 'ACHIEVED',
            isStateText: false
        }
        : (level < 70
            ? {
                label: 'The Zenith Cohort',
                value: zenithCount,
                tone: 'zenith',
                displayValue: 'Not yet level 70',
                isStateText: true
            }
            : {
                label: 'The Zenith Cohort',
                value: zenithCount,
                tone: 'zenith',
                displayValue: 'No guild-recorded Zenith ascent',
                isStateText: true
            });

    return {
        totalHonors: hallSnapshot ? hallSnapshot.totalHonors : (campaignBadgeTypes.length + vBadges.length + championCount + medalCount),
        campaignMarks: hallSnapshot ? hallSnapshot.campaignCount : cBadges.length,
        vanguardMarks: hallSnapshot ? hallSnapshot.vanguardCount : vBadges.length,
        championCrowns: hallSnapshot ? hallSnapshot.championCount : championCount,
        ladderMedals: hallSnapshot ? (hallSnapshot.pveMedals + hallSnapshot.pvpMedals) : medalCount,
        isPveReigning,
        isPvpReigning,
        reigningValue,
        reigningMeta,
        footprint: [
            { label: "Hero's Journey", value: xpCount, tone: 'xp' },
            { label: 'Blood of the Enemy', value: hksCount, tone: 'hks' },
            { label: "Dragon's Hoard", value: lootCount, tone: 'loot' },
            zenithFootprint
        ],
        championMeta: `PvE ${pveChamp.toLocaleString()} / PvP ${pvpChamp.toLocaleString()} crowns recorded.`,
        medalMeta: `PvE ${pveMedals.toLocaleString()} / PvP ${pvpMedals.toLocaleString()} ladder medals recorded.`
    };
}

function buildDossierInfoTile({ label, value, meta = '', className = '' }) {
    const tile = document.createElement('div');
    tile.className = 'char-card-dossier-tile';
    if (className) {
        className.split(' ').filter(Boolean).forEach(cls => tile.classList.add(cls));
    }

    const labelEl = document.createElement('span');
    labelEl.className = 'char-card-dossier-tile-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('strong');
    valueEl.className = 'char-card-dossier-tile-value';
    valueEl.textContent = value;

    tile.appendChild(labelEl);
    tile.appendChild(valueEl);

    if (meta) {
        const metaEl = document.createElement('span');
        metaEl.className = 'char-card-dossier-tile-meta';
        metaEl.textContent = meta;
        tile.appendChild(metaEl);
    }

    return tile;
}

function buildDossierDeploymentStrip({
    readinessLabel = 'Unknown',
    lastLoginText = 'Unknown',
    equippedCount = 0,
    totalSlots = 0,
    epicGearCount = 0,
    missingEnchantCount = 0
}) {
    const grid = document.createElement('div');
    grid.className = 'char-card-deployment-grid';

    const readinessClass = readinessLabel === 'Raid Ready'
        ? 'char-card-deployment-item-ready'
        : (readinessLabel === 'Staging for Raid' ? 'char-card-deployment-item-staging' : 'char-card-deployment-item-advancing');
    const enchantValue = missingEnchantCount > 0 ? missingEnchantCount.toLocaleString() : 'Clear';
    const enchantClass = missingEnchantCount > 0
        ? 'char-card-deployment-item-warning'
        : 'char-card-deployment-item-secure';

    [
        { label: 'Readiness', value: readinessLabel, className: readinessClass },
        { label: 'Last Seen', value: lastLoginText },
        { label: 'Equipped', value: `${equippedCount.toLocaleString()}/${totalSlots.toLocaleString()}` },
        { label: 'Epics', value: epicGearCount.toLocaleString() },
        { label: 'Missing Enchants', value: enchantValue, className: enchantClass }
    ].forEach(item => {
        grid.appendChild(buildDossierInfoTile(item));
    });

    return grid;
}

function buildDossierCommendationProfile({ profile, source = null }) {
    const snapshot = getDossierCommendationSnapshot(profile, source);
    if (!snapshot) return null;

    const shell = document.createElement('section');
    shell.className = 'char-card-commendation-layout';

    const header = document.createElement('div');
    header.className = 'char-card-commendation-header';

    const kickerEl = document.createElement('span');
    kickerEl.className = 'char-card-panel-kicker';
    kickerEl.textContent = 'Guild Service Record';

    const titleEl = document.createElement('h3');
    titleEl.className = 'char-card-commendation-title';
    titleEl.textContent = 'Commendation Profile';

    const copyEl = document.createElement('p');
    copyEl.className = 'char-card-commendation-copy';
    copyEl.textContent = snapshot.totalHonors > 0
        ? `${profile.name || 'This hero'} holds ${snapshot.totalHonors.toLocaleString()} recorded honors across weekly campaigns, vanguard pushes, champion titles, and ladder finishes.`
        : `${profile.name || 'This hero'} has no recorded commendations yet. The dossier will expand as weekly campaigns and ladder honors are earned.`;

    header.appendChild(kickerEl);
    header.appendChild(titleEl);
    header.appendChild(copyEl);

    const grid = document.createElement('div');
    grid.className = 'char-card-commendation-grid';

    [
        {
            label: 'Campaign Marks',
            value: snapshot.campaignMarks.toLocaleString(),
            meta: 'Weekly campaign distinctions recorded from current badge data.',
            className: 'char-card-commendation-tile-campaign'
        },
        {
            label: 'Vanguard Marks',
            value: snapshot.vanguardMarks.toLocaleString(),
            meta: 'Locked front-runner appearances recorded in campaign pushes.',
            className: 'char-card-commendation-tile-vanguard'
        },
        {
            label: 'Champion Crowns',
            value: snapshot.championCrowns.toLocaleString(),
            meta: snapshot.championMeta,
            className: 'char-card-commendation-tile-crown'
        },
        {
            label: 'Ladder Medals',
            value: snapshot.ladderMedals.toLocaleString(),
            meta: snapshot.medalMeta,
            className: 'char-card-commendation-tile-medal'
        },
        {
            label: 'Reigning Status',
            value: snapshot.reigningValue,
            meta: snapshot.reigningMeta,
            className: 'char-card-commendation-tile-reigning'
        }
    ].forEach(item => {
        grid.appendChild(buildDossierInfoTile(item));
    });

    const footprint = document.createElement('div');
    footprint.className = 'char-card-commendation-footprint';

    const footprintLabel = document.createElement('span');
    footprintLabel.className = 'char-card-section-label char-card-commendation-footprint-label';
    footprintLabel.textContent = 'Campaign Footprint';
    footprint.appendChild(footprintLabel);

    const visibleFootprint = snapshot.footprint.filter(item => item.value > 0 || item.tone === 'zenith');
    if (visibleFootprint.length > 0) {
        const footprintGrid = document.createElement('div');
        footprintGrid.className = 'char-card-commendation-footprint-grid';

        visibleFootprint.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = `char-card-commendation-footprint-item char-card-commendation-footprint-${item.tone}`;
            if (item.isStateText) {
                itemEl.classList.add('char-card-commendation-footprint-stateful');
            }

            const nameEl = document.createElement('span');
            nameEl.className = 'char-card-commendation-footprint-name';
            nameEl.textContent = item.label;

            const valueEl = document.createElement('strong');
            valueEl.className = 'char-card-commendation-footprint-value';
            if (item.isStateText) {
                valueEl.classList.add('char-card-commendation-footprint-value-state');
            }
            valueEl.textContent = item.displayValue || item.value.toLocaleString();

            itemEl.appendChild(nameEl);
            itemEl.appendChild(valueEl);
            footprintGrid.appendChild(itemEl);
        });

        footprint.appendChild(footprintGrid);
    } else {
        const emptyEl = document.createElement('p');
        emptyEl.className = 'char-card-commendation-footprint-empty';
        emptyEl.textContent = 'No weekly campaign marks are recorded for this hero yet.';
        footprint.appendChild(emptyEl);
    }

    shell.appendChild(header);
    shell.appendChild(grid);
    shell.appendChild(footprint);

    return shell;
}
