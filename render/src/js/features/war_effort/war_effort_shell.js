// War-effort shell and config helpers prepended during final JS assembly.

window.WAR_EFFORT_THRESHOLDS = window.WAR_EFFORT_THRESHOLDS || Object.freeze({
    xp: 500,
    hk: 1000,
    loot: 40,
    zenith: 5
});

function buildWarEffortHeroStatNode(value, label) {
    const template = document.getElementById('tpl-war-effort-hero-stat');
    if (!template) return null;

    const clone = template.content.cloneNode(true);
    const valueEl = clone.querySelector('.war-effort-hero-stat-value');
    const labelEl = clone.querySelector('.war-effort-hero-stat-label');

    if (valueEl) valueEl.textContent = value;
    if (labelEl) labelEl.textContent = label;

    return clone.firstElementChild || null;
}

function getWarEffortConfig(type) {
    const configs = {
        xp: {
            theme: 'xp',
            overline: 'Outland Recruitment Drive',
            title: "Hero's Journey",
            desc: 'A war room for the guild leveling push. Track who is driving the campaign, how close the roster is to the weekly goal, and who is setting the pace for the march through Azeroth and into Outland.',
            emptyTitle: 'The campaign has begun.',
            emptyDesc: 'No levels have been claimed yet this cycle. Rally the leveling core, push your alts, and become the first name on the board.',
            objectiveLabel: 'Objective: 500 levels gained this week.',
            unitLabel: 'Levels',
            progressUnitSingular: 'level',
            progressUnitPlural: 'levels',
            ctaValue: 'Be the first to add levels this week.',
            ctaMeta: 'Turn a blank slate into forward motion and start the march toward the weekly objective.',
            target: window.WAR_EFFORT_THRESHOLDS.xp
        },
        hk: {
            theme: 'hk',
            overline: 'Blood Ledger of the Week',
            title: 'Blood of the Enemy',
            desc: 'A live war tally for battleground pressure and honorable kills. Use this page to see who is opening the week strongest, how close the guild is to the HK objective, and where the fiercest PvP momentum lives.',
            emptyTitle: 'The blood ledger is still clean.',
            emptyDesc: 'No honorable kills have been recorded yet this cycle. Hit the battlegrounds, hunt the enemy, and open the week with the first HKs.',
            objectiveLabel: 'Objective: 1,000 honorable kills this week.',
            unitLabel: 'HKs',
            progressUnitSingular: 'honorable kill',
            progressUnitPlural: 'honorable kills',
            ctaValue: 'Claim the first HKs of the week.',
            ctaMeta: 'Open the battleground war board and give the guild its first surge of PvP momentum.',
            target: window.WAR_EFFORT_THRESHOLDS.hk
        },
        loot: {
            theme: 'loot',
            overline: 'Raid Spoils Command',
            title: "Dragon's Hoard",
            desc: 'A trophy ledger for epic and legendary haul. This board turns the weekly loot race into a visible campaign, spotlighting who is filling the vault and how quickly the guild is stacking spoils.',
            emptyTitle: 'The hoard stands empty.',
            emptyDesc: 'No epics have been secured yet this cycle. Step into raids and dungeons, bring home the first trophy, and give the guild vault its first shine.',
            objectiveLabel: 'Objective: 40 notable gear upgrades this week.',
            unitLabel: 'Epics',
            progressUnitSingular: 'upgrade',
            progressUnitPlural: 'upgrades',
            ctaValue: 'Loot the first epic of the week.',
            ctaMeta: 'Start the trophy wall with one clean pull and one prize worth remembering.',
            target: window.WAR_EFFORT_THRESHOLDS.loot
        },
        zenith: {
            theme: 'zenith',
            overline: 'Summit Race Ledger',
            title: 'The Zenith Cohort',
            desc: 'A ceremonial race board for the sprint to level 70. Watch the summit open, see who crossed first, and keep the weekly push visible until the cohort is filled.',
            emptyTitle: 'The summit awaits.',
            emptyDesc: 'No one has entered the Zenith Cohort this week. Push to level 70 and become the first hero etched into the record.',
            objectiveLabel: 'Objective: 5 members reach level 70 this week.',
            unitLabel: 'New 70s',
            progressUnitSingular: 'member',
            progressUnitPlural: 'members',
            ctaValue: 'Be the first new level 70.',
            ctaMeta: 'Turn the race board live and claim the first summit position before anyone else.',
            target: window.WAR_EFFORT_THRESHOLDS.zenith
        },
        readiness: {
            theme: 'readiness',
            overline: 'Deployable Roster Command',
            title: "Warden's Standard",
            desc: 'Recognizes raid-ready characters who remained active and deployable this week.',
            emptyTitle: 'No active raid-ready baseline is currently locked.',
            emptyDesc: "No active raid-ready baseline is currently locked for Warden's Standard. The board will populate after the next backend refresh.",
            objectiveLabel: 'Objective: Maintain 70% of the active raid-ready roster captured at weekly reset.',
            unitLabel: 'Participants',
            progressUnitSingular: 'participant',
            progressUnitPlural: 'participants',
            ctaValue: 'Awaiting deployable roster data.',
            ctaMeta: 'Keep the active raid-ready roster deployable, recently seen, and fully equipped.',
            target: 0
        }
    };

    return configs[type] || configs.xp;
}

function getWarEffortResetText() {
    const realNow = new Date();
    const berlinString = realNow.toLocaleString('en-US', { timeZone: 'Europe/Berlin' });
    const berlinNow = new Date(berlinString);

    const nextResetBerlin = new Date(berlinNow);
    nextResetBerlin.setHours(0, 0, 0, 0);

    let day = nextResetBerlin.getDay();
    let diff = (2 - day + 7) % 7;

    if (diff === 0 && berlinNow > nextResetBerlin) diff = 7;
    nextResetBerlin.setDate(nextResetBerlin.getDate() + diff);

    const timeLeft = Math.max(0, nextResetBerlin - berlinNow);
    const d = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const h = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    return `${d}d ${h}h ${m}m`;
}

function getWarEffortProgressState(pct) {
    if (pct >= 100) return 'we-fill-state-max';
    if (pct >= 75) return 'we-fill-state-high';
    if (pct >= 30) return 'we-fill-state-mid';
    return 'we-fill-state-low';
}

function getWarEffortProgressUnit(config, amount) {
    const safeAmount = Number(amount) || 0;
    return safeAmount === 1 ? config.progressUnitSingular : config.progressUnitPlural;
}

function getWarEffortStatusLabel(snapshot, config) {
    const current = snapshot && snapshot.current ? snapshot.current : 0;
    const target = snapshot && snapshot.target ? snapshot.target : config.target;

    if (current >= target) return 'Complete';
    if (current > 0) return 'In progress';
    return 'Needs progress';
}

function formatWarEffortProgressLine(snapshot, config) {
    const current = snapshot && snapshot.current ? snapshot.current : 0;
    const target = snapshot && snapshot.target ? snapshot.target : config.target;
    return `Progress: ${current.toLocaleString()} / ${target.toLocaleString()} ${config.progressUnitPlural}`;
}

function buildReadinessWarEffortSnapshot(readinessLock = {}) {
    const participants = Array.isArray(readinessLock.participants) ? readinessLock.participants : [];
    const vanguards = Array.isArray(readinessLock.vanguards) ? readinessLock.vanguards : [];
    const target = Number(readinessLock.target) || 0;
    const participantCount = Number(readinessLock.participant_count) || participants.length || 0;
    const activeBaseline = Number(readinessLock.active_raid_ready_baseline) || 0;
    const activeCount = Number(readinessLock.active_raid_ready_count) || 0;
    const totalCount = Number(readinessLock.total_raid_ready_count) || 0;
    const completionPct = Number(readinessLock.completion_pct) || (target > 0 ? Math.min((participantCount / target) * 100, 100) : 0);
    const weekLabel = formatReadinessWeekAnchor(readinessLock.week_anchor || '');
    const firstParticipant = participants[0] || '';
    const firstVanguard = vanguards[0] || firstParticipant || '';

    return {
        current: participantCount,
        target,
        pct: completionPct,
        contributorCount: participantCount,
        topName: firstVanguard,
        topValue: participantCount,
        vanguards,
        participants,
        lockTime: weekLabel,
        activeBaseline,
        activeCount,
        totalCount,
        completionPct,
        weekLabel,
        ribbonText: target > 0
            ? `${participantCount.toLocaleString()} / ${target.toLocaleString()} Participants`
            : "No active raid-ready baseline is currently locked for Warden's Standard.",
        homeSummary: target > 0
            ? `Frozen weekly target from the ${weekLabel || 'latest'} reset: ${target.toLocaleString()} participants built from ${activeBaseline.toLocaleString()} active raid-ready characters.`
            : "No active raid-ready baseline is currently locked for Warden's Standard.",
        homeLeader: target > 0
            ? (vanguards.length > 0
                ? `Vanguards: ${vanguards.map(formatReadinessDisplayName).join(', ')}`
                : 'Vanguards: Awaiting deployable roster data.')
            : 'Awaiting deployable roster.'
    };
}

function getWarEffortMilestoneText(snapshot, config) {
    const current = snapshot && snapshot.current ? snapshot.current : 0;
    const target = snapshot && snapshot.target ? snapshot.target : config.target;
    const statusLabel = getWarEffortStatusLabel(snapshot, config);

    if (current >= target) {
        return {
            value: 'Complete',
            meta: 'Weekly target secured. Keep building the margin.'
        };
    }

    const remaining = Math.max(0, target - current);
    const remainingUnit = getWarEffortProgressUnit(config, remaining);

    return {
        value: `${remaining.toLocaleString()} ${remainingUnit} needed`,
        meta: `${statusLabel} • ${formatWarEffortProgressLine(snapshot, config)}`
    };
}

function buildWarEffortShell(hashUrl, characters = []) {
    const template = document.getElementById('tpl-war-effort-shell');
    if (!template || !hashUrl.startsWith('war-effort-')) return null;

    const type = hashUrl.replace('war-effort-', '');
    const config = getWarEffortConfig(type);
    const snapshot = (window.warEffortSnapshots && window.warEffortSnapshots[type]) || {
        current: 0,
        target: config.target,
        pct: 0,
        contributorCount: 0,
        topName: '',
        topValue: 0,
        vanguards: [],
        lockTime: '',
        ribbonText: `0 / ${config.target.toLocaleString()} ${config.unitLabel}`,
        homeSummary: config.emptyDesc,
        homeLeader: config.ctaValue
    };

    const clone = template.content.cloneNode(true);
    const shell = clone.querySelector('.war-effort-shell');
    const overline = clone.querySelector('.war-effort-overline');
    const title = clone.querySelector('.war-effort-hero-title');
    const desc = clone.querySelector('.war-effort-hero-desc');
    const ribbonText = clone.querySelector('.war-effort-hero-ribbon-text');
    const ribbonReset = clone.querySelector('.war-effort-hero-ribbon-reset');
    const progressLabel = clone.querySelector('.war-effort-shell-progress-label');
    const progressMeta = clone.querySelector('.war-effort-shell-progress-meta');
    const progressFill = clone.querySelector('.war-effort-shell-progress-fill');
    const progressText = clone.querySelector('.war-effort-shell-progress-text');
    const statsGrid = clone.querySelector('.war-effort-hero-stats');
    const infoBand = clone.querySelector('.war-effort-info-band');
    const progressStatus = getWarEffortStatusLabel(snapshot, config);
    const isReadiness = type === 'readiness';

    if (isReadiness) {
        const participants = Array.isArray(snapshot.participants) ? snapshot.participants : [];
        const vanguards = Array.isArray(snapshot.vanguards) ? snapshot.vanguards : [];
        const participantCount = Number(snapshot.current) || 0;
        const target = Number(snapshot.target) || 0;
        const activeBaseline = Number(snapshot.activeBaseline) || 0;
        const activeCount = Number(snapshot.activeCount) || 0;
        const totalCount = Number(snapshot.totalCount) || 0;
        const completionPct = Number(snapshot.completionPct || snapshot.pct) || 0;
        const readinessHasLock = target > 0;
        const frontRunnerName = vanguards[0] || participants[0] || '';
        const frontRunnerDisplay = frontRunnerName ? formatReadinessDisplayName(frontRunnerName) : 'Awaiting deployable roster';
        const readinessProgressLine = readinessHasLock
            ? `Progress: ${participantCount.toLocaleString()} / ${target.toLocaleString()} participants \u2022 ${Math.round(completionPct).toLocaleString()}% complete`
            : "No active raid-ready baseline is currently locked for Warden's Standard.";
        const readinessMetaLine = readinessHasLock
            ? `Frozen weekly target from the ${snapshot.weekLabel || 'latest'} reset \u2022 ${activeBaseline.toLocaleString()} active raid-ready at lock \u2022 ${activeCount.toLocaleString()} currently active \u2022 ${totalCount.toLocaleString()} total raid-ready`
            : "No active raid-ready baseline is currently locked for Warden's Standard.";

        if (shell) shell.classList.add(`war-effort-shell-${config.theme}`);
        if (overline) overline.textContent = config.overline;
        if (title) title.textContent = config.title;
        if (desc) desc.textContent = readinessHasLock ? config.desc : config.emptyDesc;
        if (ribbonText) ribbonText.textContent = readinessHasLock
            ? `${participantCount.toLocaleString()} / ${target.toLocaleString()} ${config.unitLabel}`
            : "No active raid-ready baseline is currently locked for Warden's Standard.";
        if (ribbonReset) ribbonReset.textContent = `Resets in ${getWarEffortResetText()} (Berlin)`;
        if (progressLabel) progressLabel.textContent = config.objectiveLabel;
        if (progressMeta) progressMeta.textContent = readinessMetaLine;
        if (progressFill) {
            progressFill.classList.add(`we-fill-${config.theme}`);
            progressFill.classList.add(getWarEffortProgressState(readinessHasLock ? completionPct : 0));
            progressFill.style.width = `${readinessHasLock ? Math.min(completionPct, 100) : 0}%`;
        }
        if (progressText) {
            progressText.className = `challenge-text ${readinessHasLock && completionPct >= 100 ? 'we-text-state-max' : 'we-text-state-normal'} we-text-type-${config.theme}`;
            progressText.textContent = readinessProgressLine;
        }

        [
            buildWarEffortHeroStatNode(participantCount.toLocaleString(), 'Participants'),
            buildWarEffortHeroStatNode(target.toLocaleString(), 'Target'),
            buildWarEffortHeroStatNode(activeBaseline.toLocaleString(), 'Active at Reset'),
            buildWarEffortHeroStatNode(activeCount.toLocaleString(), 'Currently Active'),
            buildWarEffortHeroStatNode(totalCount.toLocaleString(), 'Total Raid-Ready'),
            buildWarEffortHeroStatNode(`${Math.round(completionPct).toLocaleString()}%`, 'Completion'),
            buildWarEffortHeroStatNode(vanguards.length > 0 ? `${vanguards.length}/3` : '0/3', 'Vanguards Locked')
        ].forEach(node => {
            if (node && statsGrid) statsGrid.appendChild(node);
        });

        if (infoBand) {
            const readinessSummaryGrid = document.createElement('div');
            readinessSummaryGrid.className = 'campaign-archive-grid campaign-archive-grid-war-effort';

            if (typeof buildCampaignArchiveSummaryCard === 'function') {
                readinessSummaryGrid.appendChild(buildCampaignArchiveSummaryCard({
                    kicker: 'Participants',
                    value: readinessHasLock ? `${participantCount.toLocaleString()} logged` : 'Awaiting baseline',
                    meta: readinessHasLock
                        ? `Frozen target set from ${activeBaseline.toLocaleString()} active raid-ready characters at weekly reset.`
                        : config.emptyDesc,
                    names: participants.map(formatReadinessDisplayName),
                    emptyText: 'No participants recorded.',
                    cardClass: 'campaign-archive-summary-card-readiness'
                }));
                readinessSummaryGrid.appendChild(buildCampaignArchiveSummaryCard({
                    kicker: 'Vanguards',
                    value: readinessHasLock ? `${vanguards.length.toLocaleString()}/3 locked` : 'Awaiting lock',
                    meta: readinessHasLock
                        ? 'Top 3 by equipped item level.'
                        : 'No vanguards are locked until the weekly target is captured.',
                    names: vanguards.map(formatReadinessDisplayName),
                    emptyText: 'No vanguards locked yet.',
                    cardClass: 'campaign-archive-summary-card-readiness'
                }));
                infoBand.appendChild(readinessSummaryGrid);
            }

            [
                {
                    kicker: frontRunnerName ? 'Current Front-Runner' : 'Awaiting Deployable Roster',
                    value: frontRunnerDisplay,
                    meta: readinessHasLock
                        ? 'Locked front-runner from the weekly readiness snapshot.'
                        : 'The board will populate after the next backend refresh.'
                },
                {
                    kicker: 'Command Order',
                    value: 'Keep the active raid-ready roster deployable, recently seen, and fully equipped.',
                    meta: 'Maintain 70% of the active raid-ready roster captured at weekly reset.'
                }
            ].forEach(item => {
                const node = buildHeroBandItemNode(item);
                if (node && infoBand) infoBand.appendChild(node);
            });

            return clone;
        }
    }

    if (shell) shell.classList.add(`war-effort-shell-${config.theme}`);
    if (overline) overline.textContent = config.overline;
    if (title) title.textContent = snapshot.contributorCount > 0 ? config.title : config.emptyTitle;
    if (desc) desc.textContent = snapshot.contributorCount > 0 ? config.desc : config.emptyDesc;
    if (ribbonText) ribbonText.textContent = snapshot.contributorCount > 0
        ? `${snapshot.current.toLocaleString()} / ${snapshot.target.toLocaleString()} ${config.unitLabel}`
        : `No ${config.unitLabel.toLowerCase()} recorded yet this cycle.`;
    if (ribbonReset) ribbonReset.textContent = `Resets in ${getWarEffortResetText()} (Berlin)`;
    if (progressLabel) progressLabel.textContent = config.objectiveLabel;
    if (progressMeta) {
        const progressMetaParts = [progressStatus];
        if (snapshot.contributorCount > 0) {
            progressMetaParts.push(`${snapshot.contributorCount.toLocaleString()} contributor${snapshot.contributorCount === 1 ? '' : 's'}`);
        } else {
            progressMetaParts.push('First contribution sets the pace');
        }
        progressMetaParts.push(`${Math.round(snapshot.pct)}% complete`);
        progressMeta.textContent = progressMetaParts.join(' • ');
    }

    if (progressFill) {
        progressFill.classList.add(`we-fill-${config.theme}`);
        progressFill.classList.add(getWarEffortProgressState(snapshot.pct));
        progressFill.style.width = `${Math.min(snapshot.pct, 100)}%`;
    }

    if (progressText) {
        progressText.className = `challenge-text ${snapshot.pct >= 100 ? 'we-text-state-max' : 'we-text-state-normal'} we-text-type-${config.theme}`;
        progressText.textContent = formatWarEffortProgressLine(snapshot, config);
    }

    const lockState = snapshot.lockTime ? 'Locked' : 'Open';
    const vanguardCount = Array.isArray(snapshot.vanguards) ? snapshot.vanguards.length : 0;
    const milestone = getWarEffortMilestoneText(snapshot, config);

    [
        buildWarEffortHeroStatNode(snapshot.current.toLocaleString(), 'Progress So Far'),
        buildWarEffortHeroStatNode(snapshot.contributorCount.toLocaleString(), 'Contributors'),
        buildWarEffortHeroStatNode(vanguardCount > 0 ? `${vanguardCount}/3` : '0/3', 'Vanguards Locked'),
        buildWarEffortHeroStatNode(lockState, 'Seal Status')
    ].forEach(node => {
        if (node && statsGrid) statsGrid.appendChild(node);
    });

    const topChar = snapshot.topName
        ? (Array.isArray(window.rosterData) ? window.rosterData.find(c => c.profile && c.profile.name && c.profile.name.toLowerCase() === snapshot.topName.toLowerCase()) : null)
        : null;
    const hasLockedVanguard = Boolean(snapshot.lockTime && vanguardCount > 0 && snapshot.vanguards[0]);
    const vanguardValue = vanguardCount > 0
        ? snapshot.vanguards.map(name => name.charAt(0).toUpperCase() + name.slice(1)).join(', ')
        : 'Open slots';
    const vanguardMeta = snapshot.lockTime
        ? `Lock recorded ${snapshot.lockTime}`
        : 'The top three contributors hold the vanguard line.';
    const topCardKicker = type === 'zenith' ? 'First to the Summit' : 'Current Front-Runner';
    let topValueMeta = 'Nobody has claimed the opening push yet.';

    if (snapshot.topName) {
        if (type === 'zenith') {
            topValueMeta = hasLockedVanguard
                ? `${snapshot.topName} secured the first locked summit position.`
                : 'First to reach level 70 this cycle.';
        } else if (hasLockedVanguard) {
            const lockedPrefix = type === 'xp' ? '+' : '';
            topValueMeta = `${lockedPrefix}${snapshot.topValue.toLocaleString()} ${config.unitLabel.toLowerCase()} secured the locked #1 position.`;
        } else if (type === 'xp') {
            topValueMeta = `+${snapshot.topValue.toLocaleString()} ${config.unitLabel.toLowerCase()} contributed this cycle`;
        } else if (type === 'loot') {
            topValueMeta = `${snapshot.topValue.toLocaleString()} ${config.unitLabel.toLowerCase()} contributed this cycle`;
        } else {
            topValueMeta = `${snapshot.topValue.toLocaleString()} ${config.unitLabel.toLowerCase()} contributed this cycle`;
        }
    }

    const orderKicker = snapshot.contributorCount > 0 ? (hasLockedVanguard ? 'Seal Order' : 'Command Order') : 'Call to Arms';
    const orderValue = hasLockedVanguard ? 'Vanguard line is sealed.' : config.ctaValue;
    const orderMeta = hasLockedVanguard
        ? 'Ranks #1, #2, and #3 are locked until the weekly reset.'
        : config.ctaMeta;

    [
        {
            kicker: topCardKicker,
            value: snapshot.topName || 'Awaiting first hero',
            meta: topValueMeta,
            char: topChar
        },
        {
            kicker: 'Vanguard Line',
            value: vanguardValue,
            meta: vanguardMeta
        },
        {
            kicker: 'Next Milestone',
            value: milestone.value,
            meta: milestone.meta
        },
        {
            kicker: orderKicker,
            value: orderValue,
            meta: orderMeta
        }
    ].forEach(item => {
        const node = buildHeroBandItemNode(item);
        if (node && infoBand) infoBand.appendChild(node);
    });

    return clone;
}

function buildWarEffortSnapshot(type, current, target, contributors, options = {}) {
    function getWarEffortContributorValue(contributors, name) {
        if (!contributors || !name) return 0;

        if (contributors[name] !== undefined && contributors[name] !== null) {
            return Number(contributors[name]) || 0;
        }

        const loweredName = String(name).toLowerCase();
        const match = Object.entries(contributors).find(([key]) => String(key).toLowerCase() === loweredName);
        return match ? (Number(match[1]) || 0) : 0;
    }

    const config = getWarEffortConfig(type);
    const safeContributors = contributors || {};
    const sortedEntries = Object.entries(safeContributors).sort((a, b) => b[1] - a[1]);
    const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    const contributorCount = sortedEntries.length;
    const vanguards = window.warEffortVanguards && window.warEffortVanguards[type]
        ? window.warEffortVanguards[type]
        : [];
    const hasLockedVanguard = Boolean(window.warEffortLockTimes && window.warEffortLockTimes[type] && vanguards[0]);
    const topEntry = sortedEntries[0] || ['', 0];
    const topName = hasLockedVanguard
        ? vanguards[0]
        : (options.topNameOverride || topEntry[0] || '');
    const topValue = options.topValueOverride ?? (topName ? getWarEffortContributorValue(safeContributors, topName) : (topEntry[1] ?? 0));
    const displayTopName = topName
        ? topName.split(' ').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
        : '';
    const lockTime = window.warEffortLockTimes && window.warEffortLockTimes[type]
        ? new Date(window.warEffortLockTimes[type]).toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '')
        : '';

    let homeSummary = config.objectiveLabel;
    let homeLeader = `Needs progress • ${formatWarEffortProgressLine({ current, target }, config)}`;

    if (contributorCount > 0) {
        const statusLabel = getWarEffortStatusLabel({ current, target }, config);
        if (type === 'xp') {
            homeLeader = statusLabel === 'Complete'
                ? `Complete • ${contributorCount.toLocaleString()} contributors cleared the weekly target.`
                : `In progress • ${contributorCount.toLocaleString()} contributors have added ${current.toLocaleString()} levels so far.`;
        } else if (type === 'hk') {
            homeLeader = statusLabel === 'Complete'
                ? `Complete • ${contributorCount.toLocaleString()} contributors pushed the guild past the HK target.`
                : `In progress • ${contributorCount.toLocaleString()} contributors have recorded ${current.toLocaleString()} honorable kills.`;
        } else if (type === 'loot') {
            homeLeader = statusLabel === 'Complete'
                ? `Complete • ${contributorCount.toLocaleString()} contributors filled the weekly gear-upgrade target.`
                : `In progress • ${contributorCount.toLocaleString()} contributors have logged ${current.toLocaleString()} notable gear upgrades.`;
        } else {
            homeLeader = statusLabel === 'Complete'
                ? `Complete • ${current.toLocaleString()} members have reached level 70 this week.`
                : `In progress • ${current.toLocaleString()} member${current === 1 ? '' : 's'} have reached level 70 so far.`;
        }
    }

    return {
        type,
        current,
        target,
        pct,
        contributorCount,
        topName,
        topValue,
        vanguards,
        lockTime,
        homeSummary,
        homeLeader
    };
}
