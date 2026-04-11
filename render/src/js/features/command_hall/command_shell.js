// Command shell render helpers prepended during final JS assembly.

function buildCommandHeroStatNode(value, label) {
    const template = document.getElementById('tpl-command-view-stat');
    if (!template) return null;

    const clone = template.content.cloneNode(true);
    const valueEl = clone.querySelector('.command-hero-stat-value');
    const labelEl = clone.querySelector('.command-hero-stat-label');

    if (valueEl) valueEl.textContent = value;
    if (labelEl) labelEl.textContent = label;

    return clone.firstElementChild || null;
}

function getCommandViewConfig(hashUrl, characters, isRawRoster = false, dashboardConfig = {}) {
    const mainCharacters = filterMainCharacters(characters, isRawRoster);
    const profiles = characters
        .map(char => resolveRosterProfile(char, isRawRoster))
        .filter(Boolean);
    const mainProfiles = mainCharacters
        .map(char => resolveRosterProfile(char, isRawRoster))
        .filter(Boolean);

    if (profiles.length === 0) return null;

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
    const level70s = profiles.filter(profile => (profile.level || 0) === 70);
    const mainLevel70s = mainProfiles.filter(profile => (profile.level || 0) === 70);
    const levelingCount = profiles.filter(profile => (profile.level || 0) < 70).length;
    const mainLevelingCount = mainProfiles.filter(profile => (profile.level || 0) < 70).length;
    const avgLevel = Math.round(profiles.reduce((sum, profile) => sum + (profile.level || 0), 0) / profiles.length) || 0;
    const avgLvl70Ilvl = level70s.length > 0
        ? Math.round(level70s.reduce((sum, profile) => sum + (profile.equipped_item_level || 0), 0) / level70s.length)
        : 0;
    const mainAvgLvl70Ilvl = mainLevel70s.length > 0
        ? Math.round(mainLevel70s.reduce((sum, profile) => sum + (profile.equipped_item_level || 0), 0) / mainLevel70s.length)
        : 0;
    const active7Days = profiles.filter(profile => {
        const lastLogin = profile.last_login_timestamp || 0;
        return lastLogin > 0 && (now - lastLogin) <= sevenDaysMs;
    }).length;
    const active14Days = profiles.filter(profile => {
        const lastLogin = profile.last_login_timestamp || 0;
        return lastLogin > 0 && (now - lastLogin) <= fourteenDaysMs;
    }).length;
    const active7DaysMains = mainProfiles.filter(profile => {
        const lastLogin = profile.last_login_timestamp || 0;
        return lastLogin > 0 && (now - lastLogin) <= sevenDaysMs;
    }).length;

    const roleCounts = profiles.reduce((acc, profile) => {
        const cClass = getProfileClassName(profile);
        const role = getCharacterRole(cClass, profile.active_spec || '');
        acc[role] = (acc[role] || 0) + 1;
        return acc;
    }, { Tank: 0, Healer: 0, 'Ranged DPS': 0, 'Melee DPS': 0 });
    const mainRoleCounts = mainProfiles.reduce((acc, profile) => {
        const cClass = getProfileClassName(profile);
        const role = getCharacterRole(cClass, profile.active_spec || '');
        acc[role] = (acc[role] || 0) + 1;
        return acc;
    }, { Tank: 0, Healer: 0, 'Ranged DPS': 0, 'Melee DPS': 0 });

    const classCounts = profiles.reduce((acc, profile) => {
        const cClass = getProfileClassName(profile);
        acc[cClass] = (acc[cClass] || 0) + 1;
        return acc;
    }, {});

    const dominantClassEntry = Object.entries(classCounts).sort((a, b) => b[1] - a[1])[0] || ['Unknown', 0];
    const dominantRoleEntry = Object.entries(roleCounts).sort((a, b) => b[1] - a[1])[0] || ['Unknown', 0];
    const toTitleCase = value => (value || '').split(' ').map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : '').join(' ');
    const raceCounts = profiles.reduce((acc, profile) => {
        const raceName = profile && profile.race && profile.race.name
            ? (typeof profile.race.name === 'string' ? profile.race.name : (profile.race.name.en_US || 'Unknown'))
            : 'Unknown';
        acc[raceName] = (acc[raceName] || 0) + 1;
        return acc;
    }, {});
    const dominantRaceEntry = Object.entries(raceCounts).sort((a, b) => b[1] - a[1])[0] || ['Unknown', 0];
    const formatDualCount = (mainCount, allCount) => `${mainCount.toLocaleString()} / ${allCount.toLocaleString()}`;
    const totalCountAll = getNumericConfigValue(dashboardConfig, 'total_members', characters.length);
    const totalCountMains = getNumericConfigValue(dashboardConfig, 'total_members_mains', mainCharacters.length);
    const activeCountAll = getNumericConfigValue(dashboardConfig, 'active_14_days', characters.length);
    const activeCountMains = getNumericConfigValue(dashboardConfig, 'active_14_days_mains', mainCharacters.length);
    const raidReadyCountAll = getNumericConfigValue(dashboardConfig, 'raid_ready_count', characters.length);
    const raidReadyCountMains = getNumericConfigValue(dashboardConfig, 'raid_ready_count_mains', mainCharacters.length);
    const avgLvl70IlvlMains = getNumericConfigValue(dashboardConfig, 'avg_ilvl_70_mains', mainAvgLvl70Ilvl);
    const raidReadyCount = profiles.filter(profile => (profile.level || 0) === 70 && (profile.equipped_item_level || 0) >= 110).length;

    if (hashUrl === 'alt-heroes') {
        return {
            overline: 'Guild Alt Roster',
            title: 'Alt Heroes',
            description: 'A dedicated roster for the guild’s alternate heroes. Use this board to celebrate the reserve warband, keep track of active support characters, and scan the alt bench without muddying mains-facing guild-health views.',
            ruleText: 'Includes only characters whose guild rank is exactly "Alt". Tooltips and full character cards follow the same contracts used everywhere else on the site.',
            theme: 'alt-heroes',
            stats: [
                { value: profiles.length.toLocaleString(), label: 'Total Alts' },
                { value: active14Days.toLocaleString(), label: 'Active in 14d' },
                { value: level70s.length.toLocaleString(), label: 'Level 70 Alts' },
                { value: raidReadyCount.toLocaleString(), label: 'Raid-Ready Alts' }
            ],
            bandItems: [
                { kicker: 'Seen in 7 Days', value: active7Days.toLocaleString(), meta: 'Alt heroes showing very recent signs of life across the roster', filterKey: 'activityWindow', filterValue: '7d' },
                { kicker: 'Tank-Capable', value: roleCounts.Tank.toLocaleString(), meta: 'Alt characters currently mapped to front-line coverage', filterKey: 'role', filterValue: 'Tank' },
                { kicker: 'Healer-Capable', value: roleCounts.Healer.toLocaleString(), meta: 'Alt healers available for backup recovery and off-night support', filterKey: 'role', filterValue: 'Healer' },
                { kicker: 'Leveling Alts', value: levelingCount.toLocaleString(), meta: `${level70s.length.toLocaleString()} alt heroes have already reached the level cap`, filterKey: 'levelBracket', filterValue: 'lt70' }
            ]
        };
    }

    if (hashUrl === 'total') {
        return {
            overline: 'Guild Census Ledger',
            title: "The Roll of Azeroth's Most Wanted",
            description: 'A complete census of the guild. Use this board to understand roster depth, class spread, and who has reached the level cap without the extra noise of awards and ladder theatrics.',
            ruleText: 'Includes the full scanned guild roster. Shell totals separate mains from all characters without hiding either count.',
            theme: 'total',
            stats: [
                { value: totalCountAll.toLocaleString(), label: 'All Characters' },
                { value: totalCountMains.toLocaleString(), label: 'Mains' },
                { value: level70s.length.toLocaleString(), label: 'Level 70s (All)' },
                { value: avgLvl70IlvlMains.toLocaleString(), label: 'Avg Lvl 70 iLvl (Mains)' }
            ],
            bandItems: [
                { kicker: 'Tank Depth', value: roleCounts.Tank.toLocaleString(), meta: 'All-character tank coverage in the scanned roster', filterKey: 'role', filterValue: 'Tank' },
                { kicker: 'Healer Depth', value: roleCounts.Healer.toLocaleString(), meta: 'All-character healer coverage in the scanned roster', filterKey: 'role', filterValue: 'Healer' },
                { kicker: 'Leveling Core', value: levelingCount.toLocaleString(), meta: `${mainLevelingCount.toLocaleString()} mains still climbing toward level 70`, filterKey: 'levelBracket', filterValue: 'lt70' },
                { kicker: 'Most Common Class', value: dominantClassEntry[0], meta: `${dominantClassEntry[1]} all-character listings currently define this census`, filterKey: dominantClassEntry[0] !== 'Unknown' ? 'class' : '', filterValue: dominantClassEntry[0] !== 'Unknown' ? dominantClassEntry[0] : '' }
            ]
        };
    }

    if (hashUrl === 'active') {
        const active70sMains = mainLevel70s.length;
        const avgActiveIlvl = active70sMains > 0
            ? Math.round(mainLevel70s.reduce((sum, profile) => sum + (profile.equipped_item_level || 0), 0) / active70sMains)
            : 0;

        return {
            overline: 'Warband Muster Roll',
            title: 'The Fires Still Burning',
            description: 'A present-tense view of the members still showing signs of life in the last two weeks. This page should answer who is realistically available and how battle-ready the active core looks right now.',
            ruleText: 'Includes heroes seen within the last 14 days. Shell totals show mains first while preserving all-character context.',
            theme: 'active',
            stats: [
                { value: activeCountMains.toLocaleString(), label: 'Active Mains' },
                { value: activeCountAll.toLocaleString(), label: 'Active All' },
                { value: formatDualCount(active7DaysMains, active7Days), label: 'Seen in 7d (Mains / All)' },
                { value: avgActiveIlvl.toLocaleString(), label: 'Avg Active iLvl (Mains)' }
            ],
            bandItems: [
                { kicker: 'Seen in 7 Days', value: active7DaysMains.toLocaleString(), meta: `${active7Days.toLocaleString()} all-character names have shown very recent activity`, filterKey: 'activityWindow', filterValue: '7d' },
                { kicker: 'Active Tanks', value: mainRoleCounts.Tank.toLocaleString(), meta: `${roleCounts.Tank.toLocaleString()} all-character tanks remain visible in the active roster`, filterKey: 'role', filterValue: 'Tank' },
                { kicker: 'Active Healers', value: mainRoleCounts.Healer.toLocaleString(), meta: `${roleCounts.Healer.toLocaleString()} all-character healers remain visible in the active roster`, filterKey: 'role', filterValue: 'Healer' },
                { kicker: 'Leveling Core', value: mainLevelingCount.toLocaleString(), meta: `${levelingCount.toLocaleString()} all-character names in this active slice are still below 70`, filterKey: 'levelBracket', filterValue: 'lt70' }
            ]
        };
    }

    if (hashUrl === 'raidready') {
        return {
            overline: 'Vanguard Deployment Board',
            title: 'Raid-Ready Vanguard',
            description: 'A tactical board for officers and raiders. This view strips the roster down to characters who can step into progression content now, with the role mix and readiness counts visible at a glance.',
            ruleText: 'Includes level 70 heroes with equipped item level 110 or higher. Shell totals show mains first while preserving all-character deployment context.',
            theme: 'raidready',
            stats: [
                { value: raidReadyCountMains.toLocaleString(), label: 'Ready Mains' },
                { value: raidReadyCountAll.toLocaleString(), label: 'Ready All' },
                { value: formatDualCount(mainRoleCounts.Tank, roleCounts.Tank), label: 'Tanks (Mains / All)' },
                { value: avgLvl70IlvlMains.toLocaleString(), label: 'Average iLvl (Mains)' }
            ],
            bandItems: [
                { kicker: 'Tanks Ready', value: mainRoleCounts.Tank.toLocaleString(), meta: `${roleCounts.Tank.toLocaleString()} all-character tanks are visible in the full ready roster`, filterKey: 'role', filterValue: 'Tank' },
                { kicker: 'Healers Ready', value: mainRoleCounts.Healer.toLocaleString(), meta: `${roleCounts.Healer.toLocaleString()} all-character healers remain deployable right now`, filterKey: 'role', filterValue: 'Healer' },
                { kicker: 'Ranged Ready', value: mainRoleCounts['Ranged DPS'].toLocaleString(), meta: `${roleCounts['Ranged DPS'].toLocaleString()} all-character ranged damage dealers are in this ready slice`, filterKey: 'role', filterValue: 'Ranged DPS' },
                { kicker: 'Melee Ready', value: mainRoleCounts['Melee DPS'].toLocaleString(), meta: `${roleCounts['Melee DPS'].toLocaleString()} all-character melee damage dealers are in this ready slice`, filterKey: 'role', filterValue: 'Melee DPS' }
            ]
        };
    }

    if (hashUrl.startsWith('filter-role-')) {
        const targetRoleHash = hashUrl.replace('filter-role-', '');
        let targetRoleName = 'Unknown';
        let title = 'Analytics Role Drill-Down';
        let description = 'A focused roster slice built from the analytics role chart.';
        let ruleText = 'Includes heroes whose current active spec maps to this raid role.';

        if (targetRoleHash === 'tank') {
            targetRoleName = 'Tank';
            title = 'The Shield Wall';
            description = 'A fortified command view of the guild tanks currently visible in the roster. Use this board when you want a true front-line read instead of a broad class or roster summary.';
        } else if (targetRoleHash === 'healer') {
            targetRoleName = 'Healer';
            title = 'The Sanctified Reserve';
            description = 'A healing-focused command board for officers checking sustain, recovery coverage, and which heroes currently carry the burden of keeping raids alive.';
        } else if (targetRoleHash === 'melee-dps') {
            targetRoleName = 'Melee DPS';
            title = 'The Blade Line';
            description = 'A strike roster for rogues, enhancement shamans, feral claws, retribution crusaders, and every other close-range damage dealer pressing the front.';
        } else if (targetRoleHash === 'ranged-dps') {
            targetRoleName = 'Ranged DPS';
            title = 'The Arcane Volley';
            description = 'A ranged damage board for casters and hunters delivering pressure from the second line while the front holds.';
        }

        return {
            overline: 'Analytics Drill-Down',
            title,
            description,
            ruleText,
            theme: 'analytics-role',
            stats: [
                { value: profiles.length.toLocaleString(), label: 'Matching Heroes' },
                { value: level70s.length.toLocaleString(), label: 'Level 70s' },
                { value: avgLevel.toLocaleString(), label: 'Average Level' },
                { value: avgLvl70Ilvl.toLocaleString(), label: 'Avg Lvl 70 iLvl' }
            ],
            bandItems: [
                { kicker: 'Seen in 7 Days', value: active7Days.toLocaleString(), meta: 'How many of this role have shown recent signs of life', filterKey: 'activityWindow', filterValue: '7d' },
                { kicker: 'Leveling Core', value: levelingCount.toLocaleString(), meta: 'Members in this role still climbing toward 70', filterKey: 'levelBracket', filterValue: 'lt70' },
                { kicker: 'Dominant Class', value: dominantClassEntry[0], meta: `${dominantClassEntry[1]} heroes currently define this role slice`, filterKey: dominantClassEntry[0] !== 'Unknown' ? 'class' : '', filterValue: dominantClassEntry[0] !== 'Unknown' ? dominantClassEntry[0] : '' },
                { kicker: 'Current Read', value: targetRoleName, meta: 'Opened from the analytics deployment pressure and role chart drill-downs' }
            ]
        };
    }

    if (hashUrl.startsWith('class-')) {
        const classSlug = hashUrl.replace('class-', '');
        const formattedClass = toTitleCase(classSlug);

        return {
            overline: 'Analytics Drill-Down',
            title: `${formattedClass} Muster`,
            description: `A focused class board opened from analytics. Use this view to inspect how the ${formattedClass} presence is distributed across levels, readiness, and live role coverage.`,
            ruleText: `Includes all scanned ${formattedClass} characters currently recorded in the processed roster.`,
            theme: 'analytics-class',
            stats: [
                { value: profiles.length.toLocaleString(), label: `${formattedClass}s` },
                { value: level70s.length.toLocaleString(), label: 'Level 70s' },
                { value: active7Days.toLocaleString(), label: 'Seen in 7 Days' },
                { value: avgLvl70Ilvl.toLocaleString(), label: 'Avg Lvl 70 iLvl' }
            ],
            bandItems: [
                { kicker: 'Tank Specs', value: roleCounts.Tank.toLocaleString(), meta: 'Characters in this class currently filling a tank role', filterKey: 'role', filterValue: 'Tank' },
                { kicker: 'Healer Specs', value: roleCounts.Healer.toLocaleString(), meta: 'Characters in this class currently filling a healing role', filterKey: 'role', filterValue: 'Healer' },
                { kicker: 'Ranged Specs', value: roleCounts['Ranged DPS'].toLocaleString(), meta: 'Characters in this class currently filling ranged damage slots', filterKey: 'role', filterValue: 'Ranged DPS' },
                { kicker: 'Melee Specs', value: roleCounts['Melee DPS'].toLocaleString(), meta: 'Characters in this class currently filling melee damage slots', filterKey: 'role', filterValue: 'Melee DPS' }
            ]
        };
    }

    if (hashUrl.startsWith('filter-level-')) {
        const range = hashUrl.replace('filter-level-', '');
        const isEndgame = range === '70';
        return {
            overline: 'Analytics Drill-Down',
            title: isEndgame ? 'The Endgame Muster' : `Campaign Levels ${range}`,
            description: isEndgame
                ? 'A direct read on the roster that has already reached the cap. This is the fastest way to inspect the guild members who are already in the real endgame conversation.'
                : `A focused campaign board for characters in the ${range} bracket. Use it to understand where the leveling pressure currently sits and which role mix is coming up behind the capped core.`,
            ruleText: isEndgame
                ? 'Includes only characters at level 70.'
                : `Includes only characters whose current level falls inside the ${range} bracket.`,
            theme: 'analytics-level',
            stats: [
                { value: profiles.length.toLocaleString(), label: 'Matching Heroes' },
                { value: avgLevel.toLocaleString(), label: 'Average Level' },
                { value: active7Days.toLocaleString(), label: 'Seen in 7 Days' },
                { value: avgLvl70Ilvl.toLocaleString(), label: 'Avg Lvl 70 iLvl' }
            ],
            bandItems: [
                { kicker: 'Tank Count', value: roleCounts.Tank.toLocaleString(), meta: 'Front-line candidates inside this level bracket', filterKey: 'role', filterValue: 'Tank' },
                { kicker: 'Healer Count', value: roleCounts.Healer.toLocaleString(), meta: 'Healing coverage inside this level bracket', filterKey: 'role', filterValue: 'Healer' },
                { kicker: 'Dominant Class', value: dominantClassEntry[0], meta: `${dominantClassEntry[1]} heroes currently lead this bracket`, filterKey: dominantClassEntry[0] !== 'Unknown' ? 'class' : '', filterValue: dominantClassEntry[0] !== 'Unknown' ? dominantClassEntry[0] : '' },
                { kicker: 'Dominant Race', value: dominantRaceEntry[0], meta: `${dominantRaceEntry[1]} heroes currently share the most common race in this slice` }
            ]
        };
    }

    if (hashUrl.startsWith('filter-ilvl-')) {
        const range = hashUrl.replace('filter-ilvl-', '');
        return {
            overline: 'Analytics Drill-Down',
            title: `Armament Bracket ${range}`,
            description: 'A gear-focused board opened from the analytics item level spread. Use it to inspect who currently occupies this exact readiness band instead of only reading the chart from a distance.',
            ruleText: `Includes level 70 heroes whose equipped item level falls in the ${range} bracket.`,
            theme: 'analytics-ilvl',
            stats: [
                { value: profiles.length.toLocaleString(), label: 'Matching Heroes' },
                { value: level70s.length.toLocaleString(), label: 'Level 70s' },
                { value: active7Days.toLocaleString(), label: 'Seen in 7 Days' },
                { value: avgLvl70Ilvl.toLocaleString(), label: 'Average iLvl' }
            ],
            bandItems: [
                { kicker: 'Tank Count', value: roleCounts.Tank.toLocaleString(), meta: 'Tanks currently occupying this armament band', filterKey: 'role', filterValue: 'Tank' },
                { kicker: 'Healer Count', value: roleCounts.Healer.toLocaleString(), meta: 'Healers currently occupying this armament band', filterKey: 'role', filterValue: 'Healer' },
                { kicker: 'Ranged Count', value: roleCounts['Ranged DPS'].toLocaleString(), meta: 'Ranged damage coverage in this bracket', filterKey: 'role', filterValue: 'Ranged DPS' },
                { kicker: 'Melee Count', value: roleCounts['Melee DPS'].toLocaleString(), meta: 'Melee damage coverage in this bracket', filterKey: 'role', filterValue: 'Melee DPS' }
            ]
        };
    }

    if (hashUrl.startsWith('filter-race-')) {
        const targetRace = decodeURIComponent(hashUrl.replace('filter-race-', ''));
        const displayRace = toTitleCase(targetRace);

        return {
            overline: 'Analytics Drill-Down',
            title: `${displayRace} Muster`,
            description: `A roster read for the ${displayRace} population inside the guild. This board turns the analytics race chart into a proper command view instead of a plain filtered list.`,
            ruleText: `Includes all scanned ${displayRace} characters currently visible in the processed roster.`,
            theme: 'analytics-race',
            stats: [
                { value: profiles.length.toLocaleString(), label: 'Matching Heroes' },
                { value: level70s.length.toLocaleString(), label: 'Level 70s' },
                { value: avgLevel.toLocaleString(), label: 'Average Level' },
                { value: active7Days.toLocaleString(), label: 'Seen in 7 Days' }
            ],
            bandItems: [
                { kicker: 'Tank Count', value: roleCounts.Tank.toLocaleString(), meta: 'Front-line coverage inside this race slice', filterKey: 'role', filterValue: 'Tank' },
                { kicker: 'Healer Count', value: roleCounts.Healer.toLocaleString(), meta: 'Healing coverage inside this race slice', filterKey: 'role', filterValue: 'Healer' },
                { kicker: 'Dominant Class', value: dominantClassEntry[0], meta: `${dominantClassEntry[1]} heroes currently define this race slice`, filterKey: dominantClassEntry[0] !== 'Unknown' ? 'class' : '', filterValue: dominantClassEntry[0] !== 'Unknown' ? dominantClassEntry[0] : '' },
                { kicker: 'Leveling Core', value: levelingCount.toLocaleString(), meta: 'Members of this race still climbing toward the cap', filterKey: 'levelBracket', filterValue: 'lt70' }
            ]
        };
    }

    return null;
}

function buildCommandViewShell(hashUrl, characters, isRawRoster = false, dashboardConfig = {}) {
    const template = document.getElementById('tpl-command-view-shell');
    if (!template || !Array.isArray(characters) || characters.length === 0) return null;

    const config = getCommandViewConfig(hashUrl, characters, isRawRoster, dashboardConfig);
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
    if (ribbonLabel) ribbonLabel.textContent = config.ribbonLabel || 'Roster Rule';
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
