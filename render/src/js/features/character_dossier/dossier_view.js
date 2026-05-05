// Character dossier feature helpers prepended during final JS assembly.

const DOSSIER_RECENT_ACTIVITY_WINDOW_DAYS = 14;
const DOSSIER_QUIET_ACTIVITY_WINDOW_DAYS = 30;
const DOSSIER_RAID_READY_ILVL = 110;
const DOSSIER_STAGING_ILVL = 100;
const DOSSIER_PRESTIGE_ICONS = Object.freeze({
    dragonHoard: '\u{1F409}',
    heroJourney: '\u{1F6E1}\uFE0F',
    bloodEnemy: '\u{1FA78}',
    zenith: '\u26A1\uFE0F',
    readiness: '\u{1F3F0}',
    vanguard: '\u{1F396}\uFE0F',
    crown: '\u{1F451}',
    sword: '\u2694\uFE0F',
    gold: '\u{1F947}',
    silver: '\u{1F948}',
    bronze: '\u{1F949}'
});
const DOSSIER_PRESTIGE_SEPARATOR = '\u00B7';

function getDossierCommendationSnapshot(profile, source = null, dashboardConfig = null) {
    if (!profile) return null;

    const hallSnapshot = typeof getHallOfHeroesSnapshot === 'function'
        ? getHallOfHeroesSnapshot(profile, source)
        : null;
    const effectiveDashboardConfig = dashboardConfig && typeof dashboardConfig === 'object'
        ? dashboardConfig
        : (typeof getHallOfHeroesDashboardConfig === 'function'
            ? getHallOfHeroesDashboardConfig()
            : {});
    const prevMvps = effectiveDashboardConfig.prev_mvps || {};

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
    const readinessCount = campaignBadgeTypes.filter(type => type === 'readiness').length;
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
            zenithFootprint,
            readinessCount > 0
                ? {
                    label: "Warden's Standard",
                    value: readinessCount,
                    tone: 'readiness'
                }
                : null
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
        pill.textContent = item && typeof item === 'object'
            ? String(item.label || item.value || '').trim()
            : String(item || '').trim();
        if (item && typeof item === 'object' && item.className) {
            item.className.split(' ').filter(Boolean).forEach(cls => pill.classList.add(cls));
        }
        list.appendChild(pill);
    });

    if (list.childElementCount === 0) {
        const emptyEl = document.createElement('p');
        emptyEl.className = 'char-card-intelligence-empty';
        emptyEl.textContent = 'No additional dossier intelligence is available for this hero.';
        list.appendChild(emptyEl);
    }

    section.appendChild(list);
    return section;
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

function buildDossierCommendationProfile({ profile, source = null, timelineEvents = [], dashboardConfig = {} }) {
    const snapshot = getDossierCommendationSnapshot(profile, source, dashboardConfig);
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
            ? 'Recorded honors from campaigns, ladder medals, and PvP marks.'
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

    const visibleFootprint = snapshot.footprint.filter(item => item && (item.value > 0 || item.tone === 'zenith' || item.tone === 'readiness'));
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
    const prestigeShowcase = buildDossierPrestigeShowcase({
        profile,
        source,
        timelineEvents,
        dashboardConfig,
        snapshot
    });
    if (prestigeShowcase) {
        shell.appendChild(prestigeShowcase);
    }
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
    const ilvl = getDossierEquippedItemLevel(profile, source);

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

function getDossierEquippedItemLevel(profile, source = null) {
    const candidates = [
        profile?.equipped_item_level,
        source?.equipped_item_level,
        profile?.equipped?.equipped_item_level,
        source?.equipped?.equipped_item_level,
        source?.profile?.equipped_item_level
    ];

    for (const candidate of candidates) {
        const ilvl = parseInt(candidate, 10);
        if (Number.isFinite(ilvl) && ilvl > 0) {
            return ilvl;
        }
    }

    return 0;
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
    const equippedIlvl = getDossierEquippedItemLevel(profile, source);

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
        equippedIlvl,
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
    const readinessBadges = campaignBadges.filter(type => normalizeHallOfHeroesBadgeType(type) === 'readiness');

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

    return items;
}

function getDossierCampaignArchiveWeeks(dashboardConfig = {}) {
    const archive = dashboardConfig && typeof dashboardConfig === 'object'
        ? (dashboardConfig.campaign_archive || {})
        : {};
    return Array.isArray(archive.weeks) ? archive.weeks : [];
}

function formatDossierRecognitionDate(value) {
    if (!value) return '';

    try {
        const parsed = new Date(String(value).replace('Z', '+00:00'));
        if (Number.isNaN(parsed.getTime())) return '';

        return parsed.toLocaleDateString('en-GB', {
            timeZone: 'Europe/Berlin',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    } catch (error) {
        return '';
    }
}

function formatDossierBadgeHistoryEntry(entry) {
    if (!entry || typeof entry !== 'object') return '';

    const detail = String(entry.detail || '').trim();
    if (detail) return detail;

    const parts = [];
    const dateLabel = String(entry.dateLabel || '').trim();
    const categoryLabel = String(entry.categoryLabel || '').trim();
    const sourceLabel = String(entry.sourceLabel || '').trim();
    const roleLabel = String(entry.roleLabel || '').trim();
    const medalLabel = String(entry.medalLabel || '').trim();
    const rank = parseInt(entry.rank || 0, 10) || 0;
    const score = parseInt(entry.score || 0, 10) || 0;

    if (dateLabel) parts.push(dateLabel);

    if (entry.kind === 'ladder') {
        if (categoryLabel) parts.push(categoryLabel);
        if (medalLabel) parts.push(medalLabel);
        if (rank > 0) parts.push(`Rank #${rank}`);
        if (score > 0) parts.push(`Score ${score.toLocaleString()}`);
    } else if (entry.kind === 'war-effort') {
        if (sourceLabel) parts.push(sourceLabel);
        if (roleLabel) parts.push(roleLabel);
    } else {
        if (sourceLabel) parts.push(sourceLabel);
    }

    return parts.join(` ${DOSSIER_PRESTIGE_SEPARATOR} `);
}

function formatDossierCampaignWeekLabel(weekAnchor) {
    const cleanWeek = String(weekAnchor || '').trim();
    if (!cleanWeek) return '';

    const parsedDate = new Date(`${cleanWeek}T00:00:00Z`);
    if (Number.isNaN(parsedDate.getTime())) return cleanWeek;

    return parsedDate.toLocaleDateString('en-GB', {
        timeZone: 'UTC',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function buildDossierPrestigeShowcase({ profile, source = null, timelineEvents = [], dashboardConfig = {}, snapshot = null }) {
    const effectiveSnapshot = snapshot || getDossierCommendationSnapshot(profile, source, dashboardConfig);
    if (!effectiveSnapshot) return null;

    const p = profile || {};
    const charName = p.name || source?.name || '';
    const vanguardBadges = safeParseArray(p.vanguard_badges || source?.vanguard_badges);
    const campaignBadges = safeParseArray(p.campaign_badges || source?.campaign_badges);
    const pveGold = parseInt(p.pve_gold || source?.pve_gold, 10) || 0;
    const pveSilver = parseInt(p.pve_silver || source?.pve_silver, 10) || 0;
    const pveBronze = parseInt(p.pve_bronze || source?.pve_bronze, 10) || 0;
    const pvpGold = parseInt(p.pvp_gold || source?.pvp_gold, 10) || 0;
    const pvpSilver = parseInt(p.pvp_silver || source?.pvp_silver, 10) || 0;
    const pvpBronze = parseInt(p.pvp_bronze || source?.pvp_bronze, 10) || 0;

    const prestigeDefs = [
        {
            key: 'loot',
            label: "Dragon's Hoard",
            icon: DOSSIER_PRESTIGE_ICONS.dragonHoard,
            count: campaignBadges.filter(type => String(type).toLowerCase() === 'loot').length,
            tone: 'loot',
            badgeClass: 'tt-badge-weekly-loot',
            badgeTypes: ['loot'],
            categoryLabel: 'Campaign / Loot'
        },
        {
            key: 'xp',
            label: "Hero's Journey",
            icon: DOSSIER_PRESTIGE_ICONS.heroJourney,
            count: campaignBadges.filter(type => String(type).toLowerCase() === 'xp').length,
            tone: 'xp',
            badgeClass: 'tt-badge-weekly-xp',
            badgeTypes: ['xp'],
            categoryLabel: 'Campaign / XP'
        },
        {
            key: 'hks',
            label: 'Blood of the Enemy',
            icon: DOSSIER_PRESTIGE_ICONS.bloodEnemy,
            count: campaignBadges.filter(type => ['hks', 'hk'].includes(String(type).toLowerCase())).length,
            tone: 'hks',
            badgeClass: 'tt-badge-weekly-hks',
            badgeTypes: ['hks', 'hk'],
            categoryLabel: 'Campaign / HKs'
        },
        {
            key: 'zenith',
            label: 'The Zenith Cohort',
            icon: DOSSIER_PRESTIGE_ICONS.zenith,
            count: campaignBadges.filter(type => String(type).toLowerCase() === 'zenith').length,
            tone: 'zenith',
            badgeClass: 'tt-badge-weekly-zenith',
            badgeTypes: ['zenith'],
            categoryLabel: 'Campaign / Zenith'
        },
        {
            key: 'readiness',
            label: "Warden's Standard",
            icon: DOSSIER_PRESTIGE_ICONS.readiness,
            count: campaignBadges.filter(type => normalizeHallOfHeroesBadgeType(type) === 'readiness').length,
            tone: 'readiness',
            badgeClass: 'tt-badge-weekly-readiness',
            badgeTypes: ['readiness'],
            categoryLabel: 'Campaign / Readiness'
        },
        {
            key: 'vanguard',
            label: 'Vanguard Status',
            icon: DOSSIER_PRESTIGE_ICONS.vanguard,
            count: vanguardBadges.length,
            tone: 'vanguard',
            badgeClass: 'tt-badge-vanguard',
            badgeTypes: ['vanguard'],
            categoryLabel: 'Vanguard / Marks'
        },
        {
            key: 'pve_gold',
            label: 'PvE Gold Medal',
            icon: DOSSIER_PRESTIGE_ICONS.gold,
            count: pveGold,
            tone: 'gold',
            badgeClass: 'tt-badge-gold',
            badgeTypes: ['pve_gold'],
            categoryLabel: 'PvE Ladder'
        },
        {
            key: 'pve_silver',
            label: 'PvE Silver Medal',
            icon: DOSSIER_PRESTIGE_ICONS.silver,
            count: pveSilver,
            tone: 'silver',
            badgeClass: 'tt-badge-silver',
            badgeTypes: ['pve_silver'],
            categoryLabel: 'PvE Ladder'
        },
        {
            key: 'pve_bronze',
            label: 'PvE Bronze Medal',
            icon: DOSSIER_PRESTIGE_ICONS.bronze,
            count: pveBronze,
            tone: 'bronze',
            badgeClass: 'tt-badge-bronze',
            badgeTypes: ['pve_bronze'],
            categoryLabel: 'PvE Ladder'
        },
        {
            key: 'pvp_gold',
            label: 'PvP Gold Medal',
            icon: DOSSIER_PRESTIGE_ICONS.gold,
            count: pvpGold,
            tone: 'gold',
            badgeClass: 'tt-badge-gold',
            badgeTypes: ['pvp_gold'],
            categoryLabel: 'PvP Ladder'
        },
        {
            key: 'pvp_silver',
            label: 'PvP Silver Medal',
            icon: DOSSIER_PRESTIGE_ICONS.silver,
            count: pvpSilver,
            tone: 'silver',
            badgeClass: 'tt-badge-silver',
            badgeTypes: ['pvp_silver'],
            categoryLabel: 'PvP Ladder'
        },
        {
            key: 'pvp_bronze',
            label: 'PvP Bronze Medal',
            icon: DOSSIER_PRESTIGE_ICONS.bronze,
            count: pvpBronze,
            tone: 'bronze',
            badgeClass: 'tt-badge-bronze',
            badgeTypes: ['pvp_bronze'],
            categoryLabel: 'PvP Ladder'
        }
    ];

    const featuredBadges = prestigeDefs
        .filter(item => item.count > 0)
        .sort((a, b) => {
            const priority = {
                loot: 0,
                xp: 1,
                hks: 2,
                readiness: 3,
                zenith: 4,
                vanguard: 5,
                pve_gold: 6,
                pve_silver: 7,
                pve_bronze: 8,
                pvp_gold: 9,
                pvp_silver: 10,
                pvp_bronze: 11
            };
            const aPriority = Object.prototype.hasOwnProperty.call(priority, a.key) ? priority[a.key] : 99;
            const bPriority = Object.prototype.hasOwnProperty.call(priority, b.key) ? priority[b.key] : 99;
            if (aPriority !== bPriority) return aPriority - bPriority;
            if (b.count !== a.count) return b.count - a.count;
            return 0;
        })
        .slice(0, 12);

    const reigningEntries = buildDossierReigning({ profile: p, source, dashboardConfig });
    const reigningInfo = reigningEntries.length > 0 ? reigningEntries[0] : null;

    if (!reigningInfo && featuredBadges.length === 0) return null;

    const shell = document.createElement('div');
    shell.className = 'char-card-commendation-showcase';

    const labelEl = document.createElement('span');
    labelEl.className = 'char-card-section-label char-card-commendation-showcase-label';
    labelEl.textContent = 'Prestige Showcase';
    shell.appendChild(labelEl);

    if (reigningEntries.length > 0) {
        reigningEntries.forEach(reigningInfo => {
            const reigningCard = document.createElement('div');
            reigningCard.className = 'char-card-commendation-showcase-item char-card-commendation-showcase-item-reigning char-card-commendation-showcase-item-reigning-static';

            const reigningSummary = document.createElement('div');
            reigningSummary.className = `${reigningInfo.badgeClass} char-card-commendation-showcase-summary char-card-commendation-showcase-summary-reigning char-card-commendation-showcase-summary-reigning-static`;

            const reigningIcon = document.createElement('span');
            reigningIcon.className = 'char-card-commendation-showcase-summary-icon';
            reigningIcon.textContent = reigningInfo.icon || (reigningInfo.category === 'pvp' ? DOSSIER_PRESTIGE_ICONS.sword : DOSSIER_PRESTIGE_ICONS.crown);

            const reigningBody = document.createElement('span');
            reigningBody.className = 'char-card-commendation-showcase-summary-body';

            const reigningLabel = document.createElement('strong');
            reigningLabel.className = 'char-card-commendation-showcase-summary-label';
            reigningLabel.textContent = reigningInfo.label;

            const reigningMeta = document.createElement('span');
            reigningMeta.className = 'char-card-commendation-showcase-summary-meta';
            reigningMeta.textContent = reigningInfo.meta || 'Current title holder recorded in the guild ledger.';

            reigningBody.appendChild(reigningLabel);
            reigningBody.appendChild(reigningMeta);
            reigningSummary.appendChild(reigningIcon);
            reigningSummary.appendChild(reigningBody);

            if (reigningInfo.weekLabel) {
                const reigningWeek = document.createElement('span');
                reigningWeek.className = 'char-card-commendation-showcase-summary-count';
                reigningWeek.textContent = reigningInfo.score > 0 ? `Score ${reigningInfo.score.toLocaleString()}` : 'Current';
                reigningSummary.appendChild(reigningWeek);
            }

            reigningCard.appendChild(reigningSummary);

            if (reigningInfo.weekLabel) {
                const reigningDetailsBody = document.createElement('div');
                reigningDetailsBody.className = 'char-card-commendation-showcase-body';
                const reigningWeek = document.createElement('span');
                reigningWeek.className = 'char-card-commendation-showcase-history-line';
                reigningWeek.textContent = `Latest archive week: ${reigningInfo.weekLabel}`;
                reigningDetailsBody.appendChild(reigningWeek);
                reigningCard.appendChild(reigningDetailsBody);
            }

            shell.appendChild(reigningCard);
        });
    }

    if (featuredBadges.length > 0) {
        const grid = document.createElement('div');
        grid.className = 'char-card-commendation-showcase-grid';

        featuredBadges.forEach(item => {
            const details = document.createElement('details');
            details.className = `char-card-commendation-showcase-item char-card-commendation-showcase-item-${item.tone}`;

            const historyEntries = buildDossierBadgeHistoryEntries({
                charName,
                badgeTypes: item.badgeTypes,
                actualCount: item.count,
                timelineEvents,
                dashboardConfig
            });
            const historyLines = historyEntries.map(formatDossierBadgeHistoryEntry).filter(Boolean);

            const summary = document.createElement('summary');
            summary.className = `char-card-commendation-showcase-summary char-card-commendation-showcase-summary-${item.tone}`;
            summary.classList.add(item.badgeClass);

            const summaryIcon = document.createElement('span');
            summaryIcon.className = 'char-card-commendation-showcase-summary-icon';
            summaryIcon.classList.add(item.badgeClass);
            summaryIcon.textContent = item.icon;

            const summaryBody = document.createElement('span');
            summaryBody.className = 'char-card-commendation-showcase-summary-body';

            const summaryLabel = document.createElement('strong');
            summaryLabel.className = 'char-card-commendation-showcase-summary-label';
            summaryLabel.textContent = item.label;

            const summaryMeta = document.createElement('span');
            summaryMeta.className = 'char-card-commendation-showcase-summary-meta';
            if (item.key === 'vanguard') {
                summaryMeta.textContent = summarizeBadges(vanguardBadges) || `${item.categoryLabel} ${DOSSIER_PRESTIGE_SEPARATOR} ${item.count.toLocaleString()} recorded mark${item.count === 1 ? '' : 's'}`;
            } else if (item.key.startsWith('pve_') || item.key.startsWith('pvp_')) {
                summaryMeta.textContent = `${item.categoryLabel} ${DOSSIER_PRESTIGE_SEPARATOR} ${item.count.toLocaleString()} medal${item.count === 1 ? '' : 's'}`;
            } else if (item.key === 'loot' || item.key === 'xp' || item.key === 'hks' || item.key === 'zenith' || item.key === 'readiness') {
                summaryMeta.textContent = `${item.categoryLabel} ${DOSSIER_PRESTIGE_SEPARATOR} ${item.count.toLocaleString()} supporting week${item.count === 1 ? '' : 's'}`;
            } else {
                summaryMeta.textContent = `${item.categoryLabel} ${DOSSIER_PRESTIGE_SEPARATOR} ${item.count.toLocaleString()} recorded instance${item.count === 1 ? '' : 's'}`;
            }

            const summaryCount = document.createElement('span');
            summaryCount.className = 'char-card-commendation-showcase-summary-count';
            summaryCount.textContent = `x${item.count}`;

            summaryBody.appendChild(summaryLabel);
            summaryBody.appendChild(summaryMeta);
            summary.appendChild(summaryIcon);
            summary.appendChild(summaryBody);
            summary.appendChild(summaryCount);

            const body = document.createElement('div');
            body.className = 'char-card-commendation-showcase-body';

            const historyWrap = document.createElement('div');
            historyWrap.className = 'char-card-commendation-showcase-history';

            if (historyLines.length > 0) {
                historyLines.forEach(line => {
                    const lineEl = document.createElement('span');
                    lineEl.className = 'char-card-commendation-showcase-history-line';
                    lineEl.textContent = line;
                    historyWrap.appendChild(lineEl);
                });
            } else {
                const lineEl = document.createElement('span');
                lineEl.className = 'char-card-commendation-showcase-history-line';
                lineEl.textContent = 'Detailed week history is not available in this snapshot.';
                historyWrap.appendChild(lineEl);
            }

            body.appendChild(historyWrap);
            details.appendChild(summary);
            details.appendChild(body);
            grid.appendChild(details);
        });

        shell.appendChild(grid);
    }

    return shell;
}

function buildDossierBadgeHistoryEntries({
    charName,
    badgeTypes = [],
    actualCount = 0,
    timelineEvents = [],
    dashboardConfig = {}
}) {
    const targetName = String(charName || '').trim().toLowerCase();
    if (!targetName) return [];

    const cleanBadgeTypes = safeParseArray(badgeTypes)
        .map(type => String(type || '').trim().toLowerCase())
        .filter(Boolean);
    const archiveWeeks = getDossierCampaignArchiveWeeks(dashboardConfig);
    const entries = [];
    const seenKeys = new Set();

    const addEntry = (entry) => {
        if (!entry || !entry.key || seenKeys.has(entry.key)) return;
        seenKeys.add(entry.key);
        entries.push(entry);
    };

    const warEffortTypes = cleanBadgeTypes.filter(type => ['xp', 'hks', 'hk', 'loot', 'zenith', 'readiness'].includes(type));
    const vanguardRequested = cleanBadgeTypes.includes('vanguard');
    const ladderTypes = cleanBadgeTypes.filter(type => /^p[ev]_(gold|silver|bronze)$/.test(type));
    const timelineTypes = cleanBadgeTypes;

    if (archiveWeeks.length > 0 && vanguardRequested) {
        archiveWeeks.forEach(week => {
            const weekAnchor = String(week?.week_anchor || '').trim();
            const warEffortEntries = Array.isArray(week?.war_effort) ? week.war_effort : [];

            warEffortEntries.forEach(typeEntry => {
                const type = String(typeEntry?.category || '').trim().toLowerCase();
                if (!['xp', 'hks', 'hk', 'loot', 'zenith', 'readiness'].includes(type)) return;

                const vanguards = Array.isArray(typeEntry.vanguards) ? typeEntry.vanguards : [];
                const isVanguard = vanguards.some(name => String(name || '').trim().toLowerCase() === targetName);
                if (!isVanguard) return;

                const dateLabel = formatDossierCampaignWeekLabel(weekAnchor) || weekAnchor;
                const sourceLabel = typeEntry.label || (typeof getThematicName === 'function'
                    ? getThematicName(type)
                    : String(type || 'Awarded'));
                const categoryLabel = type === 'readiness'
                    ? 'Readiness'
                    : String(type || '').trim().toUpperCase() || 'Campaign';

                addEntry({
                    key: `archive_${weekAnchor}_vanguard_${type}`,
                    kind: 'war-effort',
                    dateLabel,
                    sourceLabel,
                    roleLabel: 'Vanguard',
                    detail: `${dateLabel} ${DOSSIER_PRESTIGE_SEPARATOR} ${sourceLabel} / ${categoryLabel} ${DOSSIER_PRESTIGE_SEPARATOR} Vanguard`
                });
            });
        });
    }

    if (archiveWeeks.length > 0 && warEffortTypes.length > 0) {
        archiveWeeks.forEach(week => {
            const weekAnchor = String(week?.week_anchor || '').trim();
            const warEffortEntries = Array.isArray(week?.war_effort) ? week.war_effort : [];

            warEffortTypes.forEach(type => {
                const typeEntry = warEffortEntries.find(entry => String(entry?.category || '').trim().toLowerCase() === type);
                if (!typeEntry) return;

                const participants = Array.isArray(typeEntry.participants) ? typeEntry.participants : [];
                const vanguards = Array.isArray(typeEntry.vanguards) ? typeEntry.vanguards : [];
                const isVanguard = vanguards.some(name => String(name || '').trim().toLowerCase() === targetName);
                const isParticipant = participants.some(name => String(name || '').trim().toLowerCase() === targetName);
                if (!isVanguard && !isParticipant) return;

                const dateLabel = formatDossierCampaignWeekLabel(weekAnchor) || weekAnchor;
                const roleLabel = isVanguard ? 'Vanguard' : 'Participant';
                const sourceLabel = typeEntry.label || (typeof getThematicName === 'function'
                    ? getThematicName(type)
                    : String(type || 'Awarded'));
                const categoryLabel = type === 'readiness'
                    ? 'Readiness'
                    : String(type || '').trim().toUpperCase() || 'Campaign';
                const readinessCopy = isVanguard
                    ? "Warden's Standard Vanguard: top 3 active raid-ready profiles by equipped item level."
                    : "Warden's Standard: maintained active raid-ready status this week.";
                addEntry({
                    key: `archive_${weekAnchor}_${type}_${roleLabel}`,
                    kind: 'war-effort',
                    dateLabel,
                    sourceLabel,
                    roleLabel,
                    detail: type === 'readiness'
                        ? `${dateLabel} ${DOSSIER_PRESTIGE_SEPARATOR} ${readinessCopy}`
                        : `${dateLabel} ${DOSSIER_PRESTIGE_SEPARATOR} ${sourceLabel} / ${categoryLabel} ${DOSSIER_PRESTIGE_SEPARATOR} ${roleLabel}`
                });
            });
        });
    }

    if (archiveWeeks.length > 0 && ladderTypes.length > 0) {
        archiveWeeks.forEach(week => {
            const weekAnchor = String(week?.week_anchor || '').trim();
            const ladder = week && typeof week === 'object' ? (week.ladder || {}) : {};

            ['pve', 'pvp'].forEach(category => {
                const medalEntries = Array.isArray(ladder[category]) ? ladder[category] : [];
                medalEntries.forEach(entry => {
                    const rank = parseInt(entry?.rank || 0, 10) || 0;
                    const champion = String(entry?.champion || '').trim().toLowerCase();
                    if (champion !== targetName || rank < 1 || rank > 3) return;

                    const score = parseInt(entry?.score || 0, 10) || 0;
                    const medalLabel = rank === 1 ? 'Gold' : (rank === 2 ? 'Silver' : 'Bronze');
                    const categoryLabel = category === 'pve' ? 'PvE' : 'PvP';
                    const dateLabel = formatDossierCampaignWeekLabel(weekAnchor) || weekAnchor;

                    addEntry({
                        key: `ladder_${weekAnchor}_${category}_${rank}`,
                        kind: 'ladder',
                        dateLabel,
                        categoryLabel,
                        medalLabel,
                        rank,
                        score,
                        detail: `${dateLabel} ${DOSSIER_PRESTIGE_SEPARATOR} ${categoryLabel} ${DOSSIER_PRESTIGE_SEPARATOR} ${medalLabel} ${DOSSIER_PRESTIGE_SEPARATOR} Rank #${rank} ${DOSSIER_PRESTIGE_SEPARATOR} Score ${score.toLocaleString()}`
                    });
                });
            });
        });
    }

    if (timelineTypes.length > 0 && timelineEvents.length > 0 && entries.length === 0) {
        let events = timelineEvents.filter(event => {
            if (!event || event.type !== 'badge') return false;
            const eventName = String(event.character_name || event.character || '').trim().toLowerCase();
            if (eventName !== targetName) return false;
            return timelineTypes.includes(String(event.badge_type || '').toLowerCase());
        });

        if (events.length > 0) {
            events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            const uniqueEvents = [];
            events.forEach(event => {
                const dayStamp = String(event.timestamp || '').slice(0, 10);
                const key = `${String(event.badge_type || '').toLowerCase()}_${String(event.category || '').toLowerCase()}_${dayStamp}`;
                if (seenKeys.has(key)) return;
                seenKeys.add(key);
                uniqueEvents.push(event);
            });

            if (actualCount > 0) {
                uniqueEvents.splice(actualCount);
            }

            uniqueEvents.forEach(event => {
                const dateLabel = formatDossierRecognitionDate(event.timestamp) || String(event.timestamp || '').slice(0, 10);
                const displayName = typeof getThematicName === 'function'
                    ? getThematicName(event.category || event.badge_type)
                    : String(event.category || event.badge_type || 'Awarded');
                addEntry({
                    key: `timeline_${String(event.badge_type || '').toLowerCase()}_${String(event.category || '').toLowerCase()}_${String(event.timestamp || '').slice(0, 10)}`,
                    kind: 'timeline',
                    dateLabel,
                    sourceLabel: displayName,
                    detail: `${dateLabel} ${DOSSIER_PRESTIGE_SEPARATOR} ${displayName}`
                });
            });
        }
    }

    return actualCount > 0 ? entries.slice(0, actualCount) : entries;
}

function buildDossierBadgeHistory({
    charName,
    badgeTypes = [],
    actualCount = 0,
    timelineEvents = [],
    dashboardConfig = {}
}) {
    return buildDossierBadgeHistoryEntries({
        charName,
        badgeTypes,
        actualCount,
        timelineEvents,
        dashboardConfig
    }).map(formatDossierBadgeHistoryEntry).filter(Boolean);
}

function buildDossierReigning({ profile, source = null, dashboardConfig = {} }) {
    const targetName = String(profile?.name || source?.name || '').trim().toLowerCase();
    if (!targetName) return [];

    const prevMvps = dashboardConfig && typeof dashboardConfig === 'object'
        ? (dashboardConfig.prev_mvps || {})
        : {};
    const hasCurrentPrevMvp = Boolean((prevMvps.pve && prevMvps.pve.name) || (prevMvps.pvp && prevMvps.pvp.name));
    const archiveWeeks = getDossierCampaignArchiveWeeks(dashboardConfig);
    const latestWeek = archiveWeeks.length > 0 ? archiveWeeks[0] : null;
    const reigningEntries = Array.isArray(latestWeek?.reigning_titles) ? latestWeek.reigning_titles : [];
    const results = [];

    const reigningLabelByCategory = {
        pve: 'Reigning iLvl Champion',
        pvp: 'Reigning HK Champion'
    };
    const reigningMetaByCategory = {
        pve: 'Biggest Upgrades / iLvl',
        pvp: 'Deadliest / HKs'
    };
    const reigningIconByCategory = {
        pve: DOSSIER_PRESTIGE_ICONS.crown,
        pvp: DOSSIER_PRESTIGE_ICONS.sword
    };
    const badgeClassByCategory = {
        pve: 'tt-badge-pve c-badge-reigning c-badge-reigning-pve',
        pvp: 'tt-badge-pvp c-badge-reigning c-badge-reigning-pvp'
    };

    if (hasCurrentPrevMvp) {
        ['pve', 'pvp'].forEach(category => {
            const reigning = prevMvps[category];
            if (!reigning || String(reigning.name || reigning.champion || '').trim().toLowerCase() !== targetName) return;

            const score = parseInt(reigning.score || 0, 10) || 0;
            const label = reigningLabelByCategory[category] || 'Reigning Champion';
            const sourceLabel = reigningMetaByCategory[category] || 'Current reigning champion';
            const icon = reigningIconByCategory[category] || DOSSIER_PRESTIGE_ICONS.crown;
            const meta = `${sourceLabel} ${DOSSIER_PRESTIGE_SEPARATOR} +${score.toLocaleString()}`;

            results.push({
                category,
                label,
                badgeText: label,
                badgeClass: badgeClassByCategory[category] || 'c-badge-reigning',
                icon,
                weekAnchor: '',
                weekLabel: '',
                score,
                title: `${label}\n-------------------\n${meta}`,
                meta
            });
        });

        return results;
    }

    reigningEntries.forEach(entry => {
        if (String(entry?.champion || '').trim().toLowerCase() !== targetName) return;

        const category = String(entry?.category || '').trim().toLowerCase();
        const score = parseInt(entry?.score || 0, 10) || 0;
        const weekAnchor = String(latestWeek?.week_anchor || '').trim();
        const weekLabel = formatDossierCampaignWeekLabel(weekAnchor);
        const label = reigningLabelByCategory[category] || 'Reigning Champion';
        const badgeClass = badgeClassByCategory[category] || 'c-badge-reigning';
        const sourceLabel = reigningMetaByCategory[category] || 'Current reigning champion';
        const icon = reigningIconByCategory[category] || DOSSIER_PRESTIGE_ICONS.crown;
        const meta = weekLabel
            ? `${sourceLabel} ${DOSSIER_PRESTIGE_SEPARATOR} Latest archive week: ${weekLabel} ${DOSSIER_PRESTIGE_SEPARATOR} +${score.toLocaleString()}`
            : `${sourceLabel} ${DOSSIER_PRESTIGE_SEPARATOR} +${score.toLocaleString()}`;
        const title = `${label}\n-------------------\n${meta}`;

        results.push({
            category,
            label,
            badgeText: label,
            badgeClass,
            icon,
            weekAnchor,
            weekLabel,
            score,
            title,
            meta
        });
    });

    return results;
}

function buildDossierIntelligencePanel({ profile, source = null, timelineEvents = [], dashboardConfig = {} }) {
    if (!profile) return null;
    return buildDossierOfficerBriefPanel({ profile, source, dashboardConfig, timelineEvents });
}
