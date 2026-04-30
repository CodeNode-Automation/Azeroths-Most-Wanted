// Command shell render helpers prepended during final JS assembly.

function buildCommandHeroStatNode(value, label, { filterKey = '', filterValue = '' } = {}) {
    const template = document.getElementById('tpl-command-view-stat');
    if (!template) return null;

    const clone = template.content.cloneNode(true);
    const statEl = clone.querySelector('.command-hero-stat');
    const valueEl = clone.querySelector('.command-hero-stat-value');
    const labelEl = clone.querySelector('.command-hero-stat-label');

    if (valueEl) valueEl.textContent = value;
    if (labelEl) labelEl.textContent = label;
    if (statEl && filterKey && filterValue) {
        statEl.classList.add('command-hero-stat-filter');
        statEl.setAttribute('data-filter-key', filterKey);
        statEl.setAttribute('data-filter-value', filterValue);
        statEl.setAttribute('tabindex', '0');
        statEl.setAttribute('role', 'button');
    }

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
    const activeReadyCountMains = mainProfiles.filter(profile =>
        (profile.level || 0) === 70 && (profile.equipped_item_level || 0) >= 110
    ).length;

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
            overline: 'Alt Heroes',
            title: 'Reserve Warband Registry',
            description: 'A reserve-roster board for backup roles, raid-ready bench depth, and the leveling alts still pushing toward endgame.',
            ruleText: 'Includes only characters whose guild rank is exactly "Alt". Use this board to read the reserve bench without changing mains-facing metrics elsewhere on the site.',
            theme: 'alt-heroes',
            stats: [
                { value: profiles.length.toLocaleString(), label: 'Total Alts' },
                { value: active14Days.toLocaleString(), label: 'Active in 14d' },
                { value: raidReadyCount.toLocaleString(), label: 'Raid-Ready Alts' },
                { value: avgLvl70Ilvl.toLocaleString(), label: 'Avg Lvl 70 iLvl' }
            ],
            bandItems: [
                { kicker: 'Tank-Capable', value: roleCounts.Tank.toLocaleString(), meta: 'Alt characters currently mapped to front-line coverage', filterKey: 'role', filterValue: 'Tank' },
                { kicker: 'Healer-Capable', value: roleCounts.Healer.toLocaleString(), meta: 'Alt healers available for backup recovery and off-night support', filterKey: 'role', filterValue: 'Healer' },
                { kicker: 'Leveling Alts', value: levelingCount.toLocaleString(), meta: `${level70s.length.toLocaleString()} alt heroes have already reached the level cap.`, filterKey: 'levelBracket', filterValue: 'lt70' },
                { kicker: 'Level 70 Alts', value: level70s.length.toLocaleString(), meta: `${raidReadyCount.toLocaleString()} of those alts already meet the current raid-ready gate.`, filterKey: 'levelBracket', filterValue: '70' }
            ]
        };
    }

    if (hashUrl === 'total') {
        return {
            overline: 'The Grand Muster Roll',
            title: 'Guild Census & Reinforcement Ledger',
            description: 'Viewing: full roster. Filter: all scanned mains and alts.',
            ruleText: 'Use this board when you need the complete census instead of a narrower slice.',
            theme: 'total',
            stats: [
                { value: totalCountAll.toLocaleString(), label: 'All Characters' },
                { value: totalCountMains.toLocaleString(), label: 'Mains' },
                { value: level70s.length.toLocaleString(), label: 'Level 70s', filterKey: 'levelBracket', filterValue: '70' },
                { value: mainLevelingCount.toLocaleString(), label: 'Leveling Core', filterKey: 'levelBracket', filterValue: 'lt70' }
            ],
            bandItems: [
                { kicker: 'Dominant Role', value: dominantRoleEntry[0], meta: `${dominantRoleEntry[1].toLocaleString()} all-character listings currently stack into this role most often.`, filterKey: dominantRoleEntry[0] !== 'Unknown' ? 'role' : '', filterValue: dominantRoleEntry[0] !== 'Unknown' ? dominantRoleEntry[0] : '' },
                { kicker: 'Most Common Class', value: dominantClassEntry[0], meta: `${dominantClassEntry[1].toLocaleString()} all-character listings currently define the most common class in the census.`, filterKey: dominantClassEntry[0] !== 'Unknown' ? 'class' : '', filterValue: dominantClassEntry[0] !== 'Unknown' ? dominantClassEntry[0] : '' },
                { kicker: 'Most Common Race', value: dominantRaceEntry[0], meta: `${dominantRaceEntry[1].toLocaleString()} roster entries currently share this race.`, filterKey: '', filterValue: '' },
                { kicker: 'Armament Read', value: avgLvl70IlvlMains.toLocaleString(), meta: `Average level 70 item level across ${mainLevel70s.length.toLocaleString()} mains at the cap.` }
            ]
        };
    }

    if (hashUrl === 'active') {
        const active70sMains = mainLevel70s.length;
        const avgActiveIlvl = active70sMains > 0
            ? Math.round(mainLevel70s.reduce((sum, profile) => sum + (profile.equipped_item_level || 0), 0) / active70sMains)
            : 0;

        return {
            overline: 'The Live Muster',
            title: 'Operational Readiness Watch',
            description: 'Viewing: active roster. Filter: mains seen in the last 14 days.',
            ruleText: 'This board keeps active mains in front while preserving the full recent roster for context.',
            theme: 'active',
            stats: [
                { value: activeCountMains.toLocaleString(), label: 'Active Mains' },
                { value: activeCountAll.toLocaleString(), label: 'Active All' },
                { value: formatDualCount(active7DaysMains, active7Days), label: 'Seen in 7d (Mains / All)', filterKey: 'activityWindow', filterValue: '7d' },
                { value: formatDualCount(activeReadyCountMains, raidReadyCount), label: 'Ready in Active Slice (Mains / All)' }
            ],
            bandItems: [
                { kicker: 'Active Tanks', value: mainRoleCounts.Tank.toLocaleString(), meta: `${roleCounts.Tank.toLocaleString()} all-character tanks remain visible in the active slice.`, filterKey: 'role', filterValue: 'Tank' },
                { kicker: 'Active Healers', value: mainRoleCounts.Healer.toLocaleString(), meta: `${roleCounts.Healer.toLocaleString()} all-character healers remain visible in the active slice.`, filterKey: 'role', filterValue: 'Healer' },
                { kicker: 'Active Level 70s', value: mainLevel70s.length.toLocaleString(), meta: `${level70s.length.toLocaleString()} all-character level 70 heroes remain in the active slice.`, filterKey: 'levelBracket', filterValue: '70' },
                { kicker: 'Avg Active iLvl (Mains)', value: avgActiveIlvl.toLocaleString(), meta: 'Average item level across active mains already at level 70.' }
            ]
        };
    }

    if (hashUrl === 'raidready') {
        return {
            overline: 'The Ready Room',
            title: 'Deployment Board',
            description: 'Viewing: raid-ready roster. Filter: mains meeting the configured readiness threshold.',
            ruleText: 'This board shows who can step in now while preserving the full deployable depth of the guild.',
            theme: 'raidready',
            stats: [
                { value: raidReadyCountMains.toLocaleString(), label: 'Ready Mains' },
                { value: raidReadyCountAll.toLocaleString(), label: 'Ready All' },
                { value: formatDualCount(mainRoleCounts.Tank, roleCounts.Tank), label: 'Tanks (Mains / All)', filterKey: 'role', filterValue: 'Tank' },
                { value: formatDualCount(mainRoleCounts.Healer, roleCounts.Healer), label: 'Healers (Mains / All)', filterKey: 'role', filterValue: 'Healer' }
            ],
            bandItems: [
                { kicker: 'Ranged Ready', value: mainRoleCounts['Ranged DPS'].toLocaleString(), meta: `${roleCounts['Ranged DPS'].toLocaleString()} all-character ranged damage dealers are in the ready roster.`, filterKey: 'role', filterValue: 'Ranged DPS' },
                { kicker: 'Melee Ready', value: mainRoleCounts['Melee DPS'].toLocaleString(), meta: `${roleCounts['Melee DPS'].toLocaleString()} all-character melee damage dealers are in the ready roster.`, filterKey: 'role', filterValue: 'Melee DPS' },
                { kicker: 'Seen in 7 Days', value: formatDualCount(active7DaysMains, active7Days), meta: 'Recently seen ready heroes still showing signs of life inside the deployment slice.', filterKey: 'activityWindow', filterValue: '7d' },
                { kicker: 'Average iLvl (Mains)', value: avgLvl70IlvlMains.toLocaleString(), meta: `${raidReadyCountMains.toLocaleString()} mains currently meet the deployment threshold.` }
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
        const node = buildCommandHeroStatNode(stat.value, stat.label, stat);
        if (node && statsGrid) statsGrid.appendChild(node);
    });

    (config.bandItems || []).forEach(item => {
        const node = buildHeroBandItemNode(item);
        if (node && infoBand) infoBand.appendChild(node);
    });

    return clone;
}
