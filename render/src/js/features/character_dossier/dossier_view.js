// Character dossier feature helpers prepended during final JS assembly.

const DOSSIER_RECENT_ACTIVITY_WINDOW_DAYS = 14;
const DOSSIER_QUIET_ACTIVITY_WINDOW_DAYS = 30;
const DOSSIER_RAID_READY_ILVL = 110;
const DOSSIER_STAGING_ILVL = 100;

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
    const recognitionItems = buildDossierRecognitionItems(profile, source);

    const shell = document.createElement('section');
    shell.className = 'char-card-commendation-layout';

    const header = document.createElement('div');
    header.className = 'char-card-commendation-header';

    const kickerEl = document.createElement('span');
    kickerEl.className = 'char-card-panel-kicker';
    kickerEl.textContent = 'Recognition Record';

    const titleEl = document.createElement('h3');
    titleEl.className = 'char-card-commendation-title';
    titleEl.textContent = 'Awards & Footprint';

    const copyEl = document.createElement('p');
    copyEl.className = 'char-card-commendation-copy';
    copyEl.textContent = snapshot.totalHonors > 0
        ? `${profile.name || 'This hero'} holds ${snapshot.totalHonors.toLocaleString()} recorded honors across campaign marks, vanguard pushes, champion crowns, ladder medals, and PvP marks.`
        : `${profile.name || 'This hero'} has no recorded honors yet. The dossier will expand as campaign, ladder, and PvP distinctions are earned.`;

    header.appendChild(kickerEl);
    header.appendChild(titleEl);
    header.appendChild(copyEl);

    const marks = buildDossierIntelligenceSection({
        label: 'Recognition Marks',
        meta: snapshot.totalHonors > 0
            ? `Recorded honors from campaigns, ladder medals, and PvP marks. ${snapshot.reigningValue}.`
            : 'No active recognition markers have been recorded yet.',
        items: recognitionItems.length > 0
            ? recognitionItems
            : [{ label: 'No recorded honors yet.' }]
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
    shell.appendChild(marks);
    shell.appendChild(footprint);

    return shell;
}

function normalizeDossierCharacterName(value) {
    return String(value || '').trim().toLowerCase();
}

function getDossierActivitySnapshot(profile, source = null) {
    const lastSeenRaw = profile?.last_login_timestamp || source?.last_login_ms || source?.equipped?.last_login_ms || 0;
    const lastSeen = Number(lastSeenRaw);

    if (!Number.isFinite(lastSeen) || lastSeen <= 0) {
        return { label: 'Activity unknown', meta: '' };
    }

    const dayMs = 24 * 60 * 60 * 1000;
    const ageDays = Math.floor(Math.max(0, Date.now() - lastSeen) / dayMs);
    const ageText = formatLastLoginAge(lastSeen, 'Unknown');
    const meta = ageText === 'Today' ? 'Last seen today' : `Last seen ${ageText}`;

    if (ageDays <= DOSSIER_RECENT_ACTIVITY_WINDOW_DAYS) {
        return { label: 'Recently active', meta };
    }
    if (ageDays <= DOSSIER_QUIET_ACTIVITY_WINDOW_DAYS) {
        return { label: 'Quiet lately', meta };
    }
    return { label: 'Inactive lately', meta };
}

function getDossierReadinessSnapshot(profile, source = null) {
    const level = parseInt(profile?.level || source?.level, 10) || 0;
    const ilvl = parseInt(profile?.equipped_item_level || source?.equipped_item_level, 10) || 0;

    if (level < 70) {
        return { label: 'Still advancing', meta: `Level ${level}` };
    }
    if (ilvl >= DOSSIER_RAID_READY_ILVL) {
        return { label: 'Raid ready', meta: `${ilvl} equipped iLvl` };
    }
    if (ilvl >= DOSSIER_STAGING_ILVL) {
        return { label: 'Staging for raid', meta: `${ilvl} equipped iLvl` };
    }
    return { label: 'Needs gear', meta: `${ilvl} equipped iLvl` };
}

function formatDossierTimestamp(value) {
    if (!value) return '';

    try {
        const parsed = new Date(String(value).replace('Z', '+00:00'));
        if (Number.isNaN(parsed.getTime())) return '';

        return parsed.toLocaleString('de-DE', {
            timeZone: 'Europe/Berlin',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }) + ' Uhr';
    } catch (error) {
        return '';
    }
}

function getDossierIdentitySnapshot(profile, source = null) {
    const level = parseInt(profile?.level || source?.level, 10) || 0;
    const cClass = getCharClass(source || { profile }) || 'Unknown';
    const raceName = profile?.race && profile.race.name
        ? (typeof profile.race.name === 'string' ? profile.race.name : (profile.race.name.en_US || 'Unknown'))
        : (source?.race || 'Unknown');
    const guildRank = profile?.guild_rank || source?.guild_rank || source?.rank || 'Member';
    const activeSpec = String(profile?.active_spec || source?.active_spec || '').trim();
    const roleLabel = activeSpec ? getCharacterRole(cClass, activeSpec) : 'Unknown';
    const isAlt = isAltCharacter(source);
    const mainAltLabel = isAlt ? 'Alt' : 'Main';

    return {
        level,
        cClass,
        raceName,
        guildRank,
        activeSpec,
        roleLabel,
        isAlt,
        isMain: !isAlt,
        mainAltLabel,
        levelLabel: level > 0 ? `Level ${level}` : 'Level unknown'
    };
}

function getDossierMovementSnapshot(profile, dashboardConfig = {}) {
    const movement = dashboardConfig?.membership_movement || {};
    const recent = Array.isArray(movement.recent) ? movement.recent : [];
    const targetName = normalizeDossierCharacterName(profile?.name);
    if (!targetName || recent.length === 0) return null;

    const match = recent.find(entry => normalizeDossierCharacterName(entry?.character_name || entry?.character) === targetName);
    if (!match) return null;

    const eventType = String(match.event_type || '').trim().toLowerCase();
    const label = eventType === 'joined'
        ? 'Recently joined'
        : (eventType === 'rejoined'
            ? 'Recently rejoined'
            : (eventType === 'departed'
                ? 'Recently departed'
                : 'Movement logged'));

    const detectedText = formatDossierTimestamp(match.detected_at);

    return {
        eventType,
        label,
        meta: detectedText ? `Latest movement: ${detectedText}` : 'Latest movement recorded in the current roster scan.',
        tone: eventType || 'movement'
    };
}

function buildDossierOfficerNotes({ identity, readiness, activity, movement }) {
    const notes = [];

    if (identity.isAlt) {
        notes.push('Alt character; exclude from mains-only readiness totals.');
    } else if (identity.level >= 70 && readiness.label === 'Raid ready') {
        notes.push('Raid-ready main.');
    } else if (identity.level >= 70) {
        notes.push('Level 70 but below raid-ready threshold.');
    } else if (identity.level > 0) {
        notes.push('Below level 70; keep leveling before roster decisions.');
    } else {
        notes.push('Level is not available from the current snapshot.');
    }

    const equippedIlvl = parseInt(identity.equippedIlvl || 0, 10) || 0;
    if (identity.level >= 70 && equippedIlvl <= 0) {
        notes.push('Missing item-level data; inspect profile source before roster decisions.');
    } else if (identity.level >= 70 && readiness.label === 'Staging for raid') {
        notes.push('Staging for raid; review enchants before progression nights.');
    } else if (!identity.activeSpec && identity.level >= 70) {
        notes.push('No active spec recorded; confirm role assignment.');
    }

    if (movement && (movement.eventType === 'joined' || movement.eventType === 'rejoined')) {
        notes.push(movement.eventType === 'joined'
            ? 'Recently joined; review rank/spec when available.'
            : 'Recently rejoined; verify current rank and spec.');
    } else if (activity.label === 'Inactive lately' && identity.level >= 70) {
        notes.push('Inactive lately; confirm bench or raid plans before deployment.');
    }

    if (notes.length === 0) {
        notes.push('Roster status is stable.');
    }

    const deduped = [];
    const seen = new Set();
    notes.forEach(note => {
        const clean = String(note || '').trim();
        if (!clean || seen.has(clean)) return;
        seen.add(clean);
        deduped.push(clean);
    });

    return deduped.slice(0, 3);
}

function buildDossierOfficerBriefPanel({ profile, source = null, dashboardConfig = {} }) {
    if (!profile) return null;

    const effectiveConfig = dashboardConfig && typeof dashboardConfig === 'object'
        ? dashboardConfig
        : (typeof config !== 'undefined' ? config : {});

    const identity = getDossierIdentitySnapshot(profile, source);
    const readiness = getDossierReadinessSnapshot(profile, source);
    const activity = getDossierActivitySnapshot(profile, source);
    const movement = getDossierMovementSnapshot(profile, effectiveConfig);

    const scanTimestamp = formatDossierTimestamp(effectiveConfig?.last_updated);
    const notes = buildDossierOfficerNotes({
        identity,
        readiness,
        activity,
        movement
    });

    const shell = document.createElement('section');
    shell.className = 'char-card-intelligence-layout char-card-officer-layout';

    const header = document.createElement('div');
    header.className = 'char-card-intelligence-header char-card-officer-header';

    const kickerEl = document.createElement('span');
    kickerEl.className = 'char-card-panel-kicker';
    kickerEl.textContent = 'Officer Brief';

    const titleEl = document.createElement('h3');
    titleEl.className = 'char-card-intelligence-title char-card-officer-title';
    titleEl.textContent = 'Field Readout';

    const copyEl = document.createElement('p');
    copyEl.className = 'char-card-intelligence-copy char-card-officer-copy';
    copyEl.textContent = 'Deterministic notes grounded in roster, movement, and scan data.';

    header.appendChild(kickerEl);
    header.appendChild(titleEl);
    header.appendChild(copyEl);
    shell.appendChild(header);

    const notesSection = buildDossierIntelligenceSection({
        label: 'Officer Notes',
        meta: 'Deterministic cues grounded in roster, movement, and scan data.',
        items: notes.map(note => ({ label: note }))
    });
    shell.appendChild(notesSection);

    if (scanTimestamp) {
        const footer = document.createElement('p');
        footer.className = 'char-card-officer-footer';
        footer.textContent = `Latest dashboard scan: ${scanTimestamp}`;
        shell.appendChild(footer);
    }

    return shell;
}

function buildDossierRecognitionItems(profile, source = null) {
    const vanguardBadges = safeParseArray(profile?.vanguard_badges || source?.vanguard_badges);
    const campaignBadges = safeParseArray(profile?.campaign_badges || source?.campaign_badges);
    const pveChamp = parseInt(profile?.pve_champ_count || source?.pve_champ_count, 10) || 0;
    const pvpChamp = parseInt(profile?.pvp_champ_count || source?.pvp_champ_count, 10) || 0;
    const honorableKills = parseInt(profile?.honorable_kills || source?.honorable_kills, 10) || 0;

    const items = [];
    if (pveChamp > 0 || pvpChamp > 0) {
        const parts = [];
        if (pveChamp > 0) parts.push(`PvE MVP x${pveChamp}`);
        if (pvpChamp > 0) parts.push(`PvP MVP x${pvpChamp}`);
        items.push({ type: 'mvp', label: parts.join(', ') });
    }
    if (vanguardBadges.length > 0) {
        items.push({ type: 'vanguard', label: `${vanguardBadges.length} vanguard mark${vanguardBadges.length === 1 ? '' : 's'}` });
    }
    if (campaignBadges.length > 0) {
        items.push({ type: 'campaign', label: `${campaignBadges.length} campaign mark${campaignBadges.length === 1 ? '' : 's'}` });
    }
    if (honorableKills > 0) {
        items.push({ type: 'hks', label: `${honorableKills.toLocaleString()} HKs` });
    }

    return items;
}

function buildDossierIntelligenceSection({ label, meta = '', items = [] }) {
    const section = document.createElement('div');
    section.className = 'char-card-intelligence-section';

    const labelEl = document.createElement('span');
    labelEl.className = 'char-card-section-label char-card-intelligence-section-label';
    labelEl.textContent = label;
    section.appendChild(labelEl);

    if (meta) {
        const metaEl = document.createElement('p');
        metaEl.className = 'char-card-intelligence-section-meta';
        metaEl.textContent = meta;
        section.appendChild(metaEl);
    }

    const list = document.createElement('div');
    list.className = 'char-card-intelligence-list';

    items.slice(0, 3).forEach(item => {
        const pill = document.createElement('div');
        pill.className = 'char-card-intelligence-pill';
        pill.textContent = item.label;
        list.appendChild(pill);
    });

    section.appendChild(list);
    return section;
}

function buildDossierIntelligencePanel({ profile, source = null, timelineEvents = [], dashboardConfig = {} }) {
    if (!profile) return null;
    return buildDossierOfficerBriefPanel({ profile, source, dashboardConfig, timelineEvents });
}
