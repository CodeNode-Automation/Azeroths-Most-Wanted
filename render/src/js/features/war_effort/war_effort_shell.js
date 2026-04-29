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
            objectiveLabel: 'Levels earned this week',
            unitLabel: 'Levels',
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
            objectiveLabel: 'Honorable kills earned this week',
            unitLabel: 'HKs',
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
            objectiveLabel: 'Epics secured this week',
            unitLabel: 'Epics',
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
            objectiveLabel: 'New level 70s this week',
            unitLabel: 'New 70s',
            ctaValue: 'Be the first new level 70.',
            ctaMeta: 'Turn the race board live and claim the first summit position before anyone else.',
            target: window.WAR_EFFORT_THRESHOLDS.zenith
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

function getWarEffortMilestoneText(snapshot, config) {
    const pct = snapshot && snapshot.pct ? snapshot.pct : 0;
    const current = snapshot && snapshot.current ? snapshot.current : 0;
    const target = snapshot && snapshot.target ? snapshot.target : config.target;
    const checkpoints = [25, 50, 75, 100];
    const nextCheckpoint = checkpoints.find(step => pct < step);

    if (!nextCheckpoint) {
        return {
            value: 'Objective crushed',
            meta: 'The weekly target has already been cleared. Keep padding the record and widen the margin.'
        };
    }

    const nextValue = Math.ceil((target * nextCheckpoint) / 100);
    const remaining = Math.max(0, nextValue - current);

    return {
        value: `${remaining.toLocaleString()} ${config.unitLabel} to ${nextCheckpoint}%`,
        meta: `Next campaign checkpoint: ${nextValue.toLocaleString()} ${config.unitLabel.toLowerCase()}.`
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

    if (shell) shell.classList.add(`war-effort-shell-${config.theme}`);
    if (overline) overline.textContent = config.overline;
    if (title) title.textContent = snapshot.contributorCount > 0 ? config.title : config.emptyTitle;
    if (desc) desc.textContent = snapshot.contributorCount > 0 ? config.desc : config.emptyDesc;
    if (ribbonText) ribbonText.textContent = snapshot.contributorCount > 0
        ? `${snapshot.current.toLocaleString()} / ${snapshot.target.toLocaleString()} ${config.unitLabel}`
        : `No ${config.unitLabel.toLowerCase()} recorded yet this cycle.`;
    if (ribbonReset) ribbonReset.textContent = `Resets in ${getWarEffortResetText()} (Berlin)`;
    if (progressLabel) progressLabel.textContent = config.objectiveLabel;
    if (progressMeta) progressMeta.textContent = snapshot.contributorCount > 0
        ? `${snapshot.contributorCount.toLocaleString()} contributors • ${Math.round(snapshot.pct)}% complete`
        : 'Blank slate • first contribution sets the pace';

    if (progressFill) {
        progressFill.classList.add(`we-fill-${config.theme}`);
        progressFill.classList.add(getWarEffortProgressState(snapshot.pct));
        progressFill.style.width = `${Math.min(snapshot.pct, 100)}%`;
    }

    if (progressText) {
        progressText.className = `challenge-text ${snapshot.pct >= 100 ? 'we-text-state-max' : 'we-text-state-normal'} we-text-type-${config.theme}`;
        progressText.textContent = `${snapshot.current.toLocaleString()} / ${snapshot.target.toLocaleString()} ${config.unitLabel}`;
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

    let homeSummary = config.emptyDesc;
    let homeLeader = config.ctaValue;

    if (contributorCount > 0) {
        if (type === 'xp') {
            homeSummary = `${contributorCount.toLocaleString()} heroes have added ${current.toLocaleString()} levels since reset.`;
            homeLeader = hasLockedVanguard
                ? `${displayTopName} holds the locked #1 slot with +${topValue.toLocaleString()} levels.`
                : `${displayTopName} leads with +${topValue.toLocaleString()} levels this week.`;
        } else if (type === 'hk') {
            homeSummary = `${contributorCount.toLocaleString()} slayers have claimed ${current.toLocaleString()} HKs this cycle.`;
            homeLeader = hasLockedVanguard
                ? `${displayTopName} holds the locked #1 slot with +${topValue.toLocaleString()} HKs.`
                : `${displayTopName} leads the blood ledger with +${topValue.toLocaleString()} HKs.`;
        } else if (type === 'loot') {
            homeSummary = `${contributorCount.toLocaleString()} raiders have hauled in ${current.toLocaleString()} epic drops this week.`;
            homeLeader = hasLockedVanguard
                ? `${displayTopName} holds the locked #1 slot with ${topValue.toLocaleString()} epic${topValue === 1 ? '' : 's'}.`
                : `${displayTopName} has already secured ${topValue.toLocaleString()} epic${topValue === 1 ? '' : 's'} this cycle.`;
        } else {
            homeSummary = `${current.toLocaleString()} heroes have reached level 70 since the reset.`;
            homeLeader = topName
                ? `${displayTopName} reached the summit first${vanguards[1] ? ` ahead of ${vanguards[1].charAt(0).toUpperCase() + vanguards[1].slice(1)}` : ''}.`
                : 'The summit race is live.';
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
