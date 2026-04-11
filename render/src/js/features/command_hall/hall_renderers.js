// Hall of Heroes render helpers prepended during final JS assembly.

function getHallOfHeroesDashboardConfig() {
    const dashboardConfigEl = document.getElementById('dashboard-config');
    if (!dashboardConfigEl) return {};

    try {
        return JSON.parse(dashboardConfigEl.textContent || '{}');
    } catch (error) {
        return {};
    }
}

function getHallOfHeroesEntry(char, isRawMode = false) {
    const profile = resolveRosterProfile(char, isRawMode);
    if (!profile) return null;

    const source = isRawMode
        ? ((Array.isArray(window.rosterData) ? window.rosterData : []).find(deep => deep.profile?.name?.toLowerCase() === (char.name || '').toLowerCase()) || char)
        : char;

    const vBadges = safeParseArray(profile.vanguard_badges || source?.vanguard_badges);
    const cBadges = safeParseArray(profile.campaign_badges || source?.campaign_badges);
    const weeklyBadgeTypes = [...vBadges, ...cBadges].map(normalizeHallOfHeroesBadgeType);

    const xpCount = weeklyBadgeTypes.filter(type => type === 'xp').length;
    const hksCount = weeklyBadgeTypes.filter(type => type === 'hks').length;
    const lootCount = weeklyBadgeTypes.filter(type => type === 'loot').length;
    const zenithCount = weeklyBadgeTypes.filter(type => type === 'zenith').length;

    const pveChamp = parseInt(profile.pve_champ_count || source?.pve_champ_count) || 0;
    const pvpChamp = parseInt(profile.pvp_champ_count || source?.pvp_champ_count) || 0;
    const pveGold = parseInt(profile.pve_gold || source?.pve_gold) || 0;
    const pveSilver = parseInt(profile.pve_silver || source?.pve_silver) || 0;
    const pveBronze = parseInt(profile.pve_bronze || source?.pve_bronze) || 0;
    const pvpGold = parseInt(profile.pvp_gold || source?.pvp_gold) || 0;
    const pvpSilver = parseInt(profile.pvp_silver || source?.pvp_silver) || 0;
    const pvpBronze = parseInt(profile.pvp_bronze || source?.pvp_bronze) || 0;

    const pveMedals = pveGold + pveSilver + pveBronze;
    const pvpMedals = pvpGold + pvpSilver + pvpBronze;
    const championCount = pveChamp + pvpChamp;
    const weeklyBadgeCount = weeklyBadgeTypes.length;
    const totalHonors = weeklyBadgeCount + championCount + pveMedals + pvpMedals;

    const dashboardConfig = getHallOfHeroesDashboardConfig();
    const prevMvps = dashboardConfig.prev_mvps || {};
    const cleanName = (profile.name || '').toLowerCase();
    const isPveReigning = !!(prevMvps.pve && prevMvps.pve.name && prevMvps.pve.name.toLowerCase() === cleanName);
    const isPvpReigning = !!(prevMvps.pvp && prevMvps.pvp.name && prevMvps.pvp.name.toLowerCase() === cleanName);

    const awards = [];
    if (xpCount > 0) awards.push('xp');
    if (hksCount > 0) awards.push('hks');
    if (lootCount > 0) awards.push('loot');
    if (zenithCount > 0) awards.push('zenith');
    if (pveGold > 0) awards.push('pve_gold');
    if (pveSilver > 0) awards.push('pve_silver');
    if (pveBronze > 0) awards.push('pve_bronze');
    if (pvpGold > 0) awards.push('pvp_gold');
    if (pvpSilver > 0) awards.push('pvp_silver');
    if (pvpBronze > 0) awards.push('pvp_bronze');
    if (pveChamp > 0) awards.push('mvp_pve');
    if (pvpChamp > 0) awards.push('mvp_pvp');
    if (vBadges.length > 0) awards.push('vanguard');
    if (cBadges.length > 0) awards.push('campaign');

    return {
        char,
        profile,
        source,
        cleanName,
        className: getProfileClassName(profile),
        awards,
        totalHonors,
        weeklyBadgeCount,
        championCount,
        pveMedals,
        pvpMedals,
        hasXp: xpCount > 0,
        hasHks: hksCount > 0,
        hasLoot: lootCount > 0,
        hasZenith: zenithCount > 0,
        hasMvp: championCount > 0,
        hasReigning: isPveReigning || isPvpReigning,
        hasPveMedal: pveMedals > 0,
        hasPvpMedal: pvpMedals > 0,
        hasVanguard: vBadges.length > 0,
        hasCampaign: cBadges.length > 0
    };
}

function buildHallOfHeroesStageCard({ kicker, title, meta, emblem = '✦', tone = 'legend', entry = null, filterKey = '', filterValue = '' }) {
    const card = document.createElement('article');
    card.className = `hall-stage-card hall-stage-tone-${tone}`;

    const kickerEl = document.createElement('span');
    kickerEl.className = 'hall-stage-card-kicker';
    kickerEl.textContent = kicker;

    const bodyEl = document.createElement('div');
    bodyEl.className = 'hall-stage-card-body';

    const emblemEl = document.createElement('span');
    emblemEl.className = 'hall-stage-emblem';
    emblemEl.textContent = emblem;

    const copyEl = document.createElement('div');
    copyEl.className = 'hall-stage-copy';

    const titleEl = document.createElement('strong');
    titleEl.className = 'hall-stage-card-title';
    titleEl.textContent = title;

    const metaEl = document.createElement('span');
    metaEl.className = 'hall-stage-card-meta';
    metaEl.textContent = meta;

    copyEl.appendChild(titleEl);
    copyEl.appendChild(metaEl);
    bodyEl.appendChild(emblemEl);
    bodyEl.appendChild(copyEl);
    card.appendChild(kickerEl);
    card.appendChild(bodyEl);

    if (entry) {
        applyHallOfHeroesCardDataset(card, entry);
    }

    if (filterKey && filterValue) {
        card.classList.add('hall-stage-card-filterable', 'hero-band-item-filter', 'hero-band-item-interactive');
        card.setAttribute('data-filter-key', filterKey);
        card.setAttribute('data-filter-value', filterValue);
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
    }

    return card;
}

function getHallOfHeroesSnapshot(profile, source = null) {
    if (!profile) return null;

    const vBadges = safeParseArray(profile.vanguard_badges || source?.vanguard_badges);
    const cBadges = safeParseArray(profile.campaign_badges || source?.campaign_badges);
    const weeklyBadgeTypes = [...vBadges, ...cBadges].map(normalizeHallOfHeroesBadgeType);

    const pveChamp = parseInt(profile.pve_champ_count || source?.pve_champ_count) || 0;
    const pvpChamp = parseInt(profile.pvp_champ_count || source?.pvp_champ_count) || 0;
    const pveGold = parseInt(profile.pve_gold || source?.pve_gold) || 0;
    const pveSilver = parseInt(profile.pve_silver || source?.pve_silver) || 0;
    const pveBronze = parseInt(profile.pve_bronze || source?.pve_bronze) || 0;
    const pvpGold = parseInt(profile.pvp_gold || source?.pvp_gold) || 0;
    const pvpSilver = parseInt(profile.pvp_silver || source?.pvp_silver) || 0;
    const pvpBronze = parseInt(profile.pvp_bronze || source?.pvp_bronze) || 0;
    const pveMedals = pveGold + pveSilver + pveBronze;
    const pvpMedals = pvpGold + pvpSilver + pvpBronze;

    let prevMvps = {};
    const dashboardConfigEl = document.getElementById('dashboard-config');
    if (dashboardConfigEl) {
        try {
            const parsedConfig = JSON.parse(dashboardConfigEl.textContent || '{}');
            prevMvps = parsedConfig.prev_mvps || {};
        } catch (error) {
            prevMvps = {};
        }
    }

    const cleanName = (profile.name || '').toLowerCase();
    const isPveReigning = !!(prevMvps.pve && prevMvps.pve.name && prevMvps.pve.name.toLowerCase() === cleanName);
    const isPvpReigning = !!(prevMvps.pvp && prevMvps.pvp.name && prevMvps.pvp.name.toLowerCase() === cleanName);

    return {
        name: cleanName,
        totalHonors: weeklyBadgeTypes.length + pveChamp + pvpChamp + pveMedals + pvpMedals,
        weeklyBadgeCount: weeklyBadgeTypes.length,
        championCount: pveChamp + pvpChamp,
        pveChampCount: pveChamp,
        pvpChampCount: pvpChamp,
        vanguardCount: vBadges.length,
        campaignCount: cBadges.length,
        hasXp: weeklyBadgeTypes.includes('xp'),
        hasHks: weeklyBadgeTypes.includes('hks'),
        hasLoot: weeklyBadgeTypes.includes('loot'),
        hasZenith: weeklyBadgeTypes.includes('zenith'),
        hasMvp: (pveChamp + pvpChamp) > 0,
        hasReigning: isPveReigning || isPvpReigning,
        hasPveMedal: pveMedals > 0,
        hasPvpMedal: pvpMedals > 0,
        hasVanguard: vBadges.length > 0,
        hasCampaign: cBadges.length > 0,
        pveMedals,
        pvpMedals
    };
}

function getHallOfHeroesConfig(characters, isRawRoster = false) {
    const snapshots = characters
        .map(char => {
            const profile = resolveRosterProfile(char, isRawRoster);
            if (!profile) return null;

            const source = isRawRoster
                ? ((Array.isArray(window.rosterData) ? window.rosterData : []).find(deep => deep.profile?.name?.toLowerCase() === (char.name || '').toLowerCase()) || char)
                : char;

            return getHallOfHeroesSnapshot(profile, source);
        })
        .filter(Boolean);

    if (snapshots.length === 0) return null;

    const totalHonors = snapshots.reduce((sum, snapshot) => sum + snapshot.totalHonors, 0);
    const weeklyBadgeTotal = snapshots.reduce((sum, snapshot) => sum + snapshot.weeklyBadgeCount, 0);
    const reigningCount = snapshots.filter(snapshot => snapshot.hasReigning).length;
    const filterCount = predicate => snapshots.filter(predicate).length;

    return {
        overline: 'Guild Honors Archive',
        title: 'Hall of Heroes',
        description: 'A ceremonial command board for the guild members who have earned distinction across weekly war efforts, champion crowns, ladder finishes, and long campaign service.',
        ribbonLabel: 'Guild Decree',
        ruleText: 'Use the honors below to call up each class of hero and inspect the decorated roster beneath it.',
        theme: 'badges',
        stats: [
            { value: snapshots.length.toLocaleString(), label: 'Decorated Heroes' },
            { value: totalHonors.toLocaleString(), label: 'Total Honors Earned' },
            { value: weeklyBadgeTotal.toLocaleString(), label: 'Weekly Marks Recorded' },
            { value: reigningCount.toLocaleString(), label: 'Reigning Champions' }
        ],
        bandItems: [
            { kicker: 'Honor Roll', value: 'All Heroes', meta: `${snapshots.length.toLocaleString()} decorated names on record`, filterKey: 'honor', filterValue: 'all' },
            { kicker: 'Weekly War Effort', value: "Hero's Journey", meta: `${filterCount(snapshot => snapshot.hasXp).toLocaleString()} heroes marked by leveling glory`, filterKey: 'honor', filterValue: 'xp' },
            { kicker: 'Weekly War Effort', value: 'Blood of the Enemy', meta: `${filterCount(snapshot => snapshot.hasHks).toLocaleString()} heroes blooded in PvP`, filterKey: 'honor', filterValue: 'hks' },
            { kicker: 'Weekly War Effort', value: "Dragon's Hoard", meta: `${filterCount(snapshot => snapshot.hasLoot).toLocaleString()} heroes stamped by epic spoils`, filterKey: 'honor', filterValue: 'loot' },
            { kicker: 'Weekly War Effort', value: 'The Zenith Cohort', meta: `${filterCount(snapshot => snapshot.hasZenith).toLocaleString()} heroes who reached the summit`, filterKey: 'honor', filterValue: 'zenith' },
            { kicker: 'Champion Honors', value: 'Weekly MVPs', meta: `${filterCount(snapshot => snapshot.hasMvp).toLocaleString()} heroes crowned by weekly MVP awards`, filterKey: 'honor', filterValue: 'mvp' },
            { kicker: 'Champion Honors', value: 'Reigning Champions', meta: `${reigningCount.toLocaleString()} current title holders`, filterKey: 'honor', filterValue: 'reigning' },
            { kicker: 'Ladder Honors', value: 'PvE Medalists', meta: `${filterCount(snapshot => snapshot.hasPveMedal).toLocaleString()} raiders with podium finishes`, filterKey: 'honor', filterValue: 'ladder_pve' },
            { kicker: 'Ladder Honors', value: 'PvP Medalists', meta: `${filterCount(snapshot => snapshot.hasPvpMedal).toLocaleString()} duelists with podium finishes`, filterKey: 'honor', filterValue: 'ladder_pvp' },
            { kicker: 'Service Honors', value: 'Vanguards', meta: `${filterCount(snapshot => snapshot.hasVanguard).toLocaleString()} heroes who seized early command`, filterKey: 'honor', filterValue: 'vanguard' },
            { kicker: 'Service Honors', value: 'Campaign Veterans', meta: `${filterCount(snapshot => snapshot.hasCampaign).toLocaleString()} heroes decorated for campaign service`, filterKey: 'honor', filterValue: 'campaign' }
        ]
    };
}

function buildHallOfHeroesShell(characters, isRawRoster = false) {
    const template = document.getElementById('tpl-command-view-shell');
    if (!template || !Array.isArray(characters) || characters.length === 0) return null;

    const config = getHallOfHeroesConfig(characters, isRawRoster);
    if (!config) return null;

    const clone = template.content.cloneNode(true);
    const shell = clone.querySelector('.command-hero-shell');
    const overline = clone.querySelector('.command-overline');
    const title = clone.querySelector('.command-hero-title');
    const desc = clone.querySelector('.command-hero-desc');
    const ribbonLabel = clone.querySelector('.command-hero-ribbon-label');
    const ruleText = clone.querySelector('.command-hero-ribbon-text');
    const statsGrid = clone.querySelector('.command-hero-stats');
    const infoBand = clone.querySelector('.command-info-band');

    if (shell) shell.classList.add(`command-shell-${config.theme}`);
    if (overline) overline.textContent = config.overline;
    if (title) title.textContent = config.title;
    if (desc) desc.textContent = config.description;
    if (ribbonLabel) ribbonLabel.textContent = config.ribbonLabel;
    if (ruleText) ruleText.textContent = config.ruleText;

    config.stats.forEach(stat => {
        const node = buildCommandHeroStatNode(stat.value, stat.label);
        if (node && statsGrid) statsGrid.appendChild(node);
    });

    (config.bandItems || []).forEach(item => {
        const node = buildHeroBandItemNode(item);
        if (node && infoBand) infoBand.appendChild(node);
    });

    return clone;
}

function getHallOfHeroesEntries(characters, isRawRoster = false) {
    return characters
        .map(char => {
            const profile = resolveRosterProfile(char, isRawRoster);
            if (!profile) return null;

            const source = isRawRoster
                ? ((Array.isArray(window.rosterData) ? window.rosterData : []).find(deep => deep.profile?.name?.toLowerCase() === (char.name || '').toLowerCase()) || char)
                : char;

            const snapshot = getHallOfHeroesSnapshot(profile, source);
            if (!snapshot) return null;

            return { char, profile, source, snapshot };
        })
        .filter(Boolean);
}

function applyHallOfHeroesCardDataset(cardEl, entry) {
    if (!cardEl || !entry || !entry.profile) return;

    const profile = entry.profile;
    const cClass = getProfileClassName(profile);
    const awards = [];

    if (entry.snapshot.hasXp) awards.push('xp');
    if (entry.snapshot.hasHks) awards.push('hks');
    if (entry.snapshot.hasLoot) awards.push('loot');
    if (entry.snapshot.hasZenith) awards.push('zenith');
    if (entry.snapshot.hasMvp) awards.push('mvp_pve', 'mvp_pvp');
    if (entry.snapshot.hasPveMedal) awards.push('pve_gold', 'pve_silver', 'pve_bronze');
    if (entry.snapshot.hasPvpMedal) awards.push('pvp_gold', 'pvp_silver', 'pvp_bronze');
    if (entry.snapshot.hasVanguard) awards.push('vanguard');
    if (entry.snapshot.hasCampaign) awards.push('campaign');

    cardEl.classList.add('tt-char');
    cardEl.setAttribute('data-char', (profile.name || '').toLowerCase());
    cardEl.setAttribute('data-class', cClass);
    cardEl.setAttribute('data-spec', profile.active_spec || 'unspecced');
    cardEl.setAttribute('data-awards', awards.join(','));
    cardEl.setAttribute('tabindex', '0');
}

function getTopHallOfHeroesEntry(entries, scorer) {
    if (!Array.isArray(entries) || entries.length === 0) return null;

    const scoreFn = typeof scorer === 'function'
        ? scorer
        : entry => entry && entry.snapshot ? (entry.snapshot[scorer] || 0) : 0;

    return [...entries].sort((a, b) => {
        const scoreDiff = (scoreFn(b) || 0) - (scoreFn(a) || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return (a.profile?.name || '').localeCompare(b.profile?.name || '');
    })[0] || null;
}

function buildHallOfHeroesStage(characters, isRawRoster = false) {
    const entries = getHallOfHeroesEntries(characters, isRawRoster);
    if (entries.length === 0) return null;

    const dashboardConfig = getHallOfHeroesDashboardConfig();
    const prevMvps = dashboardConfig.prev_mvps || {};
    const findEntryByName = name => entries.find(entry => (entry.profile.name || '').toLowerCase() === (name || '').toLowerCase()) || null;

    const reigningPveEntry = findEntryByName(prevMvps.pve?.name || '');
    const reigningPvpEntry = findEntryByName(prevMvps.pvp?.name || '');
    const decoratedLeader = getTopHallOfHeroesEntry(entries, entry => entry.snapshot.totalHonors);
    const weeklyLeader = getTopHallOfHeroesEntry(entries, entry => entry.snapshot.weeklyBadgeCount);

    const crownLeaderTopCount = Math.max(0, ...entries.map(entry => entry.snapshot.championCount));
    const crownLeaders = crownLeaderTopCount > 0
        ? entries
            .filter(entry => entry.snapshot.championCount === crownLeaderTopCount)
            .sort((a, b) => (a.profile?.name || '').localeCompare(b.profile?.name || ''))
        : [];
    const crownLeader = crownLeaders[0] || null;

    const totalWeeklyMarks = entries.reduce((sum, entry) => sum + entry.snapshot.weeklyBadgeCount, 0);
    const totalChampionCrowns = entries.reduce((sum, entry) => sum + entry.snapshot.championCount, 0);
    const totalPveMedals = entries.reduce((sum, entry) => sum + entry.snapshot.pveMedals, 0);
    const totalPvpMedals = entries.reduce((sum, entry) => sum + entry.snapshot.pvpMedals, 0);
    const totalCampaignVeterans = entries.filter(entry => entry.snapshot.hasCampaign).length;

    const stage = document.createElement('section');
    stage.className = 'hall-stage';

    const head = document.createElement('div');
    head.className = 'hall-stage-head';

    const headKicker = document.createElement('span');
    headKicker.className = 'hall-stage-kicker';
    headKicker.textContent = 'Featured Honors';

    const headTitle = document.createElement('h3');
    headTitle.className = 'hall-stage-title';
    headTitle.textContent = 'The Command Dais of the Decorated';

    const headDesc = document.createElement('p');
    headDesc.className = 'hall-stage-desc';
    headDesc.textContent = 'Singular honors below will open the hero directly. Broad honors will filter the decorated roster and badge history below.';

    head.appendChild(headKicker);
    head.appendChild(headTitle);
    head.appendChild(headDesc);

    const spotlightGrid = document.createElement('div');
    spotlightGrid.className = 'hall-stage-spotlight';

    spotlightGrid.appendChild(buildHallOfHeroesStageCard({
        kicker: 'Reigning PvE Champion',
        title: reigningPveEntry ? reigningPveEntry.profile.name : 'Awaiting Champion',
        meta: reigningPveEntry ? 'Current holder of the guild PvE MVP crown.' : 'The next weekly PvE MVP will rise here.',
        emblem: '👑',
        tone: 'pve',
        entry: reigningPveEntry
    }));

    spotlightGrid.appendChild(buildHallOfHeroesStageCard({
        kicker: 'Reigning PvP Champion',
        title: reigningPvpEntry ? reigningPvpEntry.profile.name : 'Awaiting Champion',
        meta: reigningPvpEntry ? 'Current holder of the guild PvP MVP crown.' : 'The next weekly PvP MVP will rise here.',
        emblem: '⚔️',
        tone: 'pvp',
        entry: reigningPvpEntry
    }));

    spotlightGrid.appendChild(buildHallOfHeroesStageCard({
        kicker: 'Most Decorated',
        title: decoratedLeader ? decoratedLeader.profile.name : 'Awaiting Hero',
        meta: decoratedLeader ? `${decoratedLeader.snapshot.totalHonors.toLocaleString()} total honors recorded across weekly marks, crowns, and medals.` : 'No decorated heroes are on record yet.',
        emblem: '🌟',
        tone: 'legend',
        entry: decoratedLeader
    }));

    spotlightGrid.appendChild(buildHallOfHeroesStageCard({
        kicker: 'War Effort Standard-Bearer',
        title: weeklyLeader ? weeklyLeader.profile.name : 'Awaiting Vanguard',
        meta: weeklyLeader ? `${weeklyLeader.snapshot.weeklyBadgeCount.toLocaleString()} weekly war effort marks secured.` : 'No weekly marks have been recorded yet.',
        emblem: '🛡️',
        tone: 'war',
        entry: weeklyLeader
    }));

    spotlightGrid.appendChild(
        crownLeaders.length <= 1
            ? buildHallOfHeroesStageCard({
                kicker: 'Champion Crown Leader',
                title: crownLeader ? crownLeader.profile.name : 'Awaiting Champion',
                meta: crownLeader ? `${crownLeader.snapshot.championCount.toLocaleString()} combined PvE and PvP MVP crowns earned.` : 'No MVP crowns have been awarded yet.',
                emblem: '🏆',
                tone: 'crown',
                entry: crownLeader
            })
            : buildHallOfHeroesStageCard({
                kicker: 'Champion Crown Leaders',
                title: `${crownLeaders.length.toLocaleString()} Heroes Tied`,
                meta: `${crownLeaderTopCount.toLocaleString()} combined PvE and PvP MVP crown${crownLeaderTopCount === 1 ? '' : 's'} each.`,
                emblem: '🏆',
                tone: 'crown',
                filterKey: 'honor',
                filterValue: 'mvp'
            })
    );

    const wallGrid = document.createElement('div');
    wallGrid.className = 'hall-stage-wall';

    wallGrid.appendChild(buildHallOfHeroesStageCard({
        kicker: 'Weekly Marks Recorded',
        title: totalWeeklyMarks.toLocaleString(),
        meta: 'Filter to heroes carrying any weekly war effort mark.',
        emblem: '⚡',
        tone: 'war',
        filterKey: 'honor',
        filterValue: 'weekly'
    }));

    wallGrid.appendChild(buildHallOfHeroesStageCard({
        kicker: 'Champion Crowns',
        title: totalChampionCrowns.toLocaleString(),
        meta: 'Filter to PvE and PvP MVP crown holders.',
        emblem: '👑',
        tone: 'crown',
        filterKey: 'honor',
        filterValue: 'mvp'
    }));

    wallGrid.appendChild(buildHallOfHeroesStageCard({
        kicker: 'PvE Medal Wall',
        title: totalPveMedals.toLocaleString(),
        meta: 'Filter to decorated PvE medalists.',
        emblem: '🥇',
        tone: 'pve',
        filterKey: 'honor',
        filterValue: 'ladder_pve'
    }));

    wallGrid.appendChild(buildHallOfHeroesStageCard({
        kicker: 'PvP Medal Wall',
        title: totalPvpMedals.toLocaleString(),
        meta: 'Filter to decorated PvP medalists.',
        emblem: '🩸',
        tone: 'pvp',
        filterKey: 'honor',
        filterValue: 'ladder_pvp'
    }));

    wallGrid.appendChild(buildHallOfHeroesStageCard({
        kicker: 'Campaign Veterans',
        title: totalCampaignVeterans.toLocaleString(),
        meta: 'Filter to veterans with campaign service recorded.',
        emblem: '🎖️',
        tone: 'legend',
        filterKey: 'honor',
        filterValue: 'campaign'
    }));

    stage.appendChild(head);
    stage.appendChild(spotlightGrid);
    stage.appendChild(wallGrid);

    return stage;
}
