// Campaign archive feature helpers prepended during final JS assembly.

const CAMPAIGN_ARCHIVE_PARTICIPANT_PREVIEW_COUNT = 6;
const CAMPAIGN_ARCHIVE_CATEGORY_ICONS = {
    xp: '🛡️',
    hk: '🩸',
    loot: '🐉',
    zenith: '⚡'
};

function formatCampaignArchiveWeekLabel(weekAnchor) {
    const cleanWeek = String(weekAnchor || '').trim();
    if (!cleanWeek) return 'Unknown';

    const parsedDate = new Date(`${cleanWeek}T00:00:00Z`);
    if (Number.isNaN(parsedDate.getTime())) return cleanWeek;

    return parsedDate.toLocaleDateString('en-GB', {
        timeZone: 'UTC',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function getCampaignArchiveDefaultWeek(campaignArchive = {}) {
    if (campaignArchive && typeof campaignArchive.latest_week === 'string' && campaignArchive.latest_week) {
        return campaignArchive.latest_week;
    }

    const weeks = Array.isArray(campaignArchive && campaignArchive.weeks) ? campaignArchive.weeks : [];
    return weeks[0] && weeks[0].week_anchor ? weeks[0].week_anchor : '';
}

function getCampaignArchiveWeekEntry(campaignArchive = {}, selectedWeek = '') {
    const weeks = Array.isArray(campaignArchive && campaignArchive.weeks) ? campaignArchive.weeks : [];
    if (weeks.length === 0) return null;

    return weeks.find(week => week.week_anchor === selectedWeek) || weeks[0] || null;
}

function findCampaignArchiveRosterEntry(name) {
    const cleanName = String(name || '').trim().toLowerCase();
    if (!cleanName || !Array.isArray(window.rosterData)) return null;

    return window.rosterData.find(char => char.profile && char.profile.name && char.profile.name.toLowerCase() === cleanName) || null;
}

function getCampaignArchiveDisplayName(name) {
    const rosterEntry = findCampaignArchiveRosterEntry(name);
    if (rosterEntry && rosterEntry.profile && rosterEntry.profile.name) {
        return rosterEntry.profile.name;
    }

    return String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
        .join(' ') || 'Unknown';
}

function bindCampaignArchiveCharacterTarget(target, name) {
    const rosterEntry = findCampaignArchiveRosterEntry(name);
    if (!target || !rosterEntry || !rosterEntry.profile || !rosterEntry.profile.name) return null;

    const cleanName = rosterEntry.profile.name.toLowerCase();
    const cClass = getCharClass(rosterEntry);

    target.classList.add('tt-char');
    target.setAttribute('data-char', cleanName);
    target.setAttribute('data-class', cClass);
    target.addEventListener('click', event => {
        event.preventDefault();
        selectCharacter(cleanName);
    });

    return rosterEntry;
}

function buildCampaignArchiveNameNode(name) {
    const rosterEntry = findCampaignArchiveRosterEntry(name);
    const node = document.createElement(rosterEntry ? 'button' : 'span');
    node.className = 'campaign-archive-char';
    node.textContent = getCampaignArchiveDisplayName(name);

    if (rosterEntry) {
        node.type = 'button';
        bindCampaignArchiveCharacterTarget(node, name);
    } else {
        node.classList.add('campaign-archive-char-static');
    }

    return node;
}

function buildCampaignArchiveNameRoll(names = [], emptyText = 'No heroes recorded.') {
    const wrap = document.createElement('div');
    wrap.className = 'campaign-archive-name-roll';

    if (!Array.isArray(names) || names.length === 0) {
        const emptyEl = document.createElement('span');
        emptyEl.className = 'campaign-archive-char campaign-archive-char-static';
        emptyEl.textContent = emptyText;
        wrap.appendChild(emptyEl);
        return wrap;
    }

    names.forEach(name => {
        wrap.appendChild(buildCampaignArchiveNameNode(name));
    });

    return wrap;
}

function buildCampaignArchiveCollapsibleNameRoll(
    names = [],
    {
        emptyText = 'No heroes recorded.',
        previewCount = CAMPAIGN_ARCHIVE_PARTICIPANT_PREVIEW_COUNT,
        itemLabel = 'participants',
        expandLabel = 'View All Participants',
        collapseLabel = 'Collapse Roll'
    } = {}
) {
    const section = document.createElement('div');
    section.className = 'campaign-archive-roll-section';

    const roll = buildCampaignArchiveNameRoll(names, emptyText);
    section.appendChild(roll);

    if (!Array.isArray(names) || names.length === 0) {
        return section;
    }

    const safePreviewCount = Math.max(1, previewCount);
    const hasOverflow = names.length > safePreviewCount;
    if (!hasOverflow) {
        return section;
    }

    const rollChildren = [...roll.children];
    roll.dataset.expanded = 'false';
    rollChildren.forEach((child, index) => {
        if (index >= safePreviewCount) child.classList.add('campaign-archive-char-extra');
    });

    const controls = document.createElement('div');
    controls.className = 'campaign-archive-roll-controls';

    const summary = document.createElement('span');
    summary.className = 'campaign-archive-roll-summary';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'campaign-archive-roll-toggle';

    const syncRollUi = () => {
        const isExpanded = roll.dataset.expanded === 'true';
        summary.textContent = isExpanded
            ? `Showing all ${names.length.toLocaleString()} ${itemLabel}.`
            : `Showing ${safePreviewCount.toLocaleString()} of ${names.length.toLocaleString()} ${itemLabel}.`;
        toggle.textContent = isExpanded ? collapseLabel : expandLabel;
        toggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    };

    toggle.addEventListener('click', () => {
        roll.dataset.expanded = roll.dataset.expanded === 'true' ? 'false' : 'true';
        syncRollUi();
    });

    controls.appendChild(summary);
    controls.appendChild(toggle);
    section.appendChild(controls);

    syncRollUi();

    return section;
}

function buildCampaignArchiveSummaryCard({
    kicker,
    value,
    meta = '',
    names = [],
    emptyText = 'No heroes recorded.',
    cardClass = '',
    collapsibleNames = false,
    previewCount = CAMPAIGN_ARCHIVE_PARTICIPANT_PREVIEW_COUNT,
    itemLabel = 'participants',
    expandLabel = 'View All Participants',
    collapseLabel = 'Collapse Roll'
}) {
    const card = getTemplateRootHtml('tpl-hero-band-item') || document.createElement('article');
    const kickerEl = card.querySelector('.hero-band-kicker');
    const valueEl = card.querySelector('.hero-band-value');
    const metaEl = card.querySelector('.hero-band-meta');

    card.classList.add('campaign-archive-summary-card');
    if (cardClass) card.classList.add(cardClass);
    if (kickerEl) kickerEl.textContent = kicker;
    if (valueEl) valueEl.textContent = value;
    if (metaEl) metaEl.textContent = meta;

    const rollNode = collapsibleNames
        ? buildCampaignArchiveCollapsibleNameRoll(names, {
            emptyText,
            previewCount,
            itemLabel,
            expandLabel,
            collapseLabel
        })
        : buildCampaignArchiveNameRoll(names, emptyText);
    card.appendChild(rollNode);
    return card;
}

function buildCampaignArchiveWarEffortTitle(category, label) {
    const titleEl = document.createElement('h4');
    titleEl.className = 'leaderboard-title campaign-archive-panel-title campaign-archive-panel-title-war-effort';

    const titleWrap = document.createElement('span');
    titleWrap.className = 'campaign-archive-title-wrap';

    const iconEl = document.createElement('span');
    iconEl.className = 'campaign-archive-title-icon';
    iconEl.textContent = CAMPAIGN_ARCHIVE_CATEGORY_ICONS[String(category || '').trim().toLowerCase()] || '🎖️';

    const textEl = document.createElement('span');
    textEl.className = 'campaign-archive-title-text';
    textEl.textContent = label;

    titleWrap.appendChild(iconEl);
    titleWrap.appendChild(textEl);
    titleEl.appendChild(titleWrap);

    return titleEl;
}

function buildCampaignArchiveVanguardStrip(vanguards = []) {
    const strip = document.createElement('section');
    strip.className = 'campaign-archive-vanguard-strip';

    const header = document.createElement('div');
    header.className = 'campaign-archive-vanguard-strip-header';

    const labelEl = document.createElement('span');
    labelEl.className = 'campaign-archive-vanguard-strip-label';
    labelEl.textContent = 'Vanguards';

    const valueEl = document.createElement('span');
    valueEl.className = 'campaign-archive-vanguard-strip-value';
    valueEl.textContent = `${Array.isArray(vanguards) ? vanguards.length.toLocaleString() : '0'} Locked`;

    header.appendChild(labelEl);
    header.appendChild(valueEl);

    const metaEl = document.createElement('p');
    metaEl.className = 'campaign-archive-vanguard-strip-meta';
    metaEl.textContent = 'Locked front-runners recorded for this campaign front.';

    const roll = buildCampaignArchiveNameRoll(vanguards, 'No vanguards recorded.');
    roll.classList.add('campaign-archive-vanguard-roll');

    strip.appendChild(header);
    strip.appendChild(metaEl);
    strip.appendChild(roll);

    return strip;
}

function buildCampaignArchiveLeaderboardRow({ rankText, champion, score, scoreLabel, toneClass = '', fallbackMeta = 'Historical record' }) {
    const template = document.getElementById('tpl-home-leaderboard-row');
    if (!template) return null;

    const clone = template.content.cloneNode(true);
    const row = clone.querySelector('.leaderboard-row');
    const rankEl = clone.querySelector('.lb-rank');
    const portraitEl = clone.querySelector('.lb-portrait');
    const nameEl = clone.querySelector('.lb-name');
    const specEl = clone.querySelector('.lb-spec');
    const scoreEl = clone.querySelector('.lb-score');
    const scoreValueEl = clone.querySelector('.lb-score-value');
    const scoreLabelEl = clone.querySelector('.lb-score-label');

    const rosterEntry = findCampaignArchiveRosterEntry(champion);
    const displayName = getCampaignArchiveDisplayName(champion);
    const className = rosterEntry ? getCharClass(rosterEntry) : 'Unknown';
    const portraitUrl = rosterEntry ? (rosterEntry.render_url || getClassIcon(className)) : getClassIcon(className);

    if (row) {
        row.classList.add('campaign-archive-row');
        if (rosterEntry) {
            bindCampaignArchiveCharacterTarget(row, champion);
        } else {
            row.classList.remove('tt-char');
            row.removeAttribute('data-char');
        }
        row.setAttribute('data-class', className);
    }

    if (rankEl) rankEl.textContent = rankText;
    if (portraitEl) {
        portraitEl.src = portraitUrl;
        portraitEl.alt = `${displayName} portrait`;
    }
    if (nameEl) nameEl.textContent = displayName;

    if (specEl) {
        specEl.textContent = '';

        if (rosterEntry && rosterEntry.profile) {
            const profile = rosterEntry.profile;
            const raceName = profile.race && profile.race.name
                ? (typeof profile.race.name === 'string' ? profile.race.name : (profile.race.name.en_US || 'Unknown'))
                : 'Unknown';
            const activeSpec = profile.active_spec ? profile.active_spec : '';
            const displaySpecClass = activeSpec ? `${activeSpec} ${className}` : className;
            const specIconUrl = getSpecIcon(className, activeSpec);

            if (specIconUrl) {
                const specIconEl = document.createElement('img');
                specIconEl.className = 'concise-spec-icon';
                specIconEl.src = specIconUrl;
                specIconEl.alt = `${displaySpecClass} icon`;
                specEl.appendChild(specIconEl);
            }

            specEl.appendChild(document.createTextNode(`${raceName} • ${displaySpecClass}`));
        } else {
            specEl.textContent = fallbackMeta;
        }
    }

    if (scoreEl && toneClass) scoreEl.classList.add(toneClass);
    if (scoreValueEl) scoreValueEl.textContent = Number(score || 0).toLocaleString();
    if (scoreLabelEl) scoreLabelEl.textContent = scoreLabel;

    return clone.firstElementChild || null;
}

function buildCampaignArchiveShell(campaignArchive = {}, selectedWeek = '') {
    const template = document.getElementById('tpl-command-view-shell');
    if (!template) return null;

    const clone = template.content.cloneNode(true);
    const shell = clone.querySelector('.command-hero-shell');
    const overline = clone.querySelector('.command-overline');
    const title = clone.querySelector('.command-hero-title');
    const desc = clone.querySelector('.command-hero-desc');
    const ribbonLabel = clone.querySelector('.command-hero-ribbon-label');
    const ribbonText = clone.querySelector('.command-hero-ribbon-text');
    const statsGrid = clone.querySelector('.command-hero-stats');
    const infoBand = clone.querySelector('.command-info-band');

    const weekEntry = getCampaignArchiveWeekEntry(campaignArchive, selectedWeek);
    const latestWeek = getCampaignArchiveDefaultWeek(campaignArchive);

    if (shell) shell.classList.add('command-shell-campaign-archive');
    if (overline) overline.textContent = 'Campaign Ledger';
    if (title) title.textContent = 'Weekly Campaign Archive';
    if (desc) {
        desc.textContent = 'A historical board for the guild\'s weekly pushes, vanguards, champions, and ladder standouts.';
    }
    if (ribbonLabel) ribbonLabel.textContent = 'Archive Scope';
    if (ribbonText) {
        ribbonText.textContent = weekEntry
            ? `Historical weekly snapshots drawn from Turso-backed campaign, ladder, and champion tables. Selected week: ${formatCampaignArchiveWeekLabel(weekEntry.week_anchor)}.`
            : 'Historical weekly snapshots drawn from Turso-backed campaign, ladder, and champion tables.';
    }

    const stats = [
        { value: Number(campaignArchive.archived_weeks || 0).toLocaleString(), label: 'Archived Weeks' },
        { value: latestWeek ? formatCampaignArchiveWeekLabel(latestWeek) : 'No records', label: 'Latest Recorded Week' },
        { value: Number(campaignArchive.total_campaign_entries || 0).toLocaleString(), label: 'Total Campaign Entries' },
        { value: Number(campaignArchive.reigning_titles_logged || 0).toLocaleString(), label: 'Reigning Titles Logged' }
    ];

    stats.forEach(stat => {
        const node = buildCommandHeroStatNode(stat.value, stat.label);
        if (node && statsGrid) statsGrid.appendChild(node);
    });

    if (weekEntry && infoBand) {
        [
            {
                kicker: 'Selected Week',
                value: formatCampaignArchiveWeekLabel(weekEntry.week_anchor),
                meta: 'Latest recorded week is selected by default when the archive opens.'
            },
            {
                kicker: 'Campaign Fronts',
                value: Number(weekEntry.war_effort_entry_count || 0).toLocaleString(),
                meta: 'Weekly war-effort categories logged for the selected archive snapshot.'
            },
            {
                kicker: 'Ladder Placings',
                value: Number(weekEntry.ladder_entry_count || 0).toLocaleString(),
                meta: 'Recorded PvE and PvP ladder placements preserved for this week.'
            },
            {
                kicker: 'Reigning Titles',
                value: Number(weekEntry.reigning_entry_count || 0).toLocaleString(),
                meta: 'Weekly champion titles logged for the selected archive snapshot.'
            }
        ].forEach(item => {
            const node = buildHeroBandItemNode(item);
            if (node) infoBand.appendChild(node);
        });
    }

    return clone;
}

function buildCampaignArchiveBody(campaignArchive = {}, selectedWeek = '', onWeekChange = null) {
    const body = document.createElement('div');
    body.className = 'campaign-archive-body';

    const weeks = Array.isArray(campaignArchive && campaignArchive.weeks) ? campaignArchive.weeks : [];
    if (weeks.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'tl-empty-msg';
        emptyState.textContent = 'No archived campaign weeks have been recorded yet.';
        body.appendChild(emptyState);
        return body;
    }

    const weekEntry = getCampaignArchiveWeekEntry(campaignArchive, selectedWeek);

    const toolbar = document.createElement('div');
    toolbar.className = 'campaign-archive-toolbar';

    const toolbarCopy = document.createElement('div');
    toolbarCopy.className = 'campaign-archive-toolbar-copy';

    const toolbarLabel = document.createElement('span');
    toolbarLabel.className = 'campaign-archive-toolbar-label';
    toolbarLabel.textContent = 'Campaign Week';

    const toolbarValue = document.createElement('span');
    toolbarValue.className = 'campaign-archive-toolbar-value';
    toolbarValue.textContent = weekEntry
        ? `${formatCampaignArchiveWeekLabel(weekEntry.week_anchor)} selected`
        : 'No archive week selected';

    toolbarCopy.appendChild(toolbarLabel);
    toolbarCopy.appendChild(toolbarValue);

    const weekSelect = document.createElement('select');
    weekSelect.className = 'tl-select campaign-archive-week-select';
    weeks.forEach(week => {
        const option = document.createElement('option');
        option.value = week.week_anchor;
        option.textContent = formatCampaignArchiveWeekLabel(week.week_anchor);
        option.selected = weekEntry && week.week_anchor === weekEntry.week_anchor;
        weekSelect.appendChild(option);
    });
    weekSelect.addEventListener('change', event => {
        if (typeof onWeekChange === 'function') onWeekChange(event.target.value);
    });

    toolbar.appendChild(toolbarCopy);
    toolbar.appendChild(weekSelect);
    body.appendChild(toolbar);

    const buildSectionTitle = text => {
        const titleEl = document.createElement('h3');
        titleEl.className = 'leaderboard-title campaign-archive-section-title';
        titleEl.textContent = text;
        return titleEl;
    };

    const buildEmptyPanel = (titleText, description) => {
        const panel = document.createElement('section');
        panel.className = 'leaderboard-panel campaign-archive-panel';

        const titleEl = document.createElement('h4');
        titleEl.className = 'leaderboard-title campaign-archive-panel-title';
        titleEl.textContent = titleText;

        const emptyEl = document.createElement('div');
        emptyEl.className = 'tl-empty-msg campaign-archive-empty';
        emptyEl.textContent = description;

        panel.appendChild(titleEl);
        panel.appendChild(emptyEl);
        return panel;
    };

    const warEffortSection = document.createElement('section');
    warEffortSection.className = 'campaign-archive-section';
    warEffortSection.appendChild(buildSectionTitle('War-Effort Archive'));

    const warEffortGrid = document.createElement('div');
    warEffortGrid.className = 'campaign-archive-grid campaign-archive-grid-war-effort';
    if (Array.isArray(weekEntry && weekEntry.war_effort) && weekEntry.war_effort.length > 0) {
        weekEntry.war_effort.forEach(entry => {
            const panel = document.createElement('section');
            panel.className = 'leaderboard-panel campaign-archive-panel campaign-archive-panel-war-effort';

            const titleEl = buildCampaignArchiveWarEffortTitle(entry.category, entry.label);

            const noteEl = document.createElement('p');
            noteEl.className = 'campaign-archive-panel-note';
            noteEl.textContent = `${Number(entry.participant_count || 0).toLocaleString()} participants recorded for this weekly push.`;

            const vanguardStrip = buildCampaignArchiveVanguardStrip(entry.vanguards || []);

            const participantCard = buildCampaignArchiveSummaryCard({
                kicker: 'Participants',
                value: `${Number(entry.participant_count || 0).toLocaleString()} logged`,
                meta: 'Participant roll preserved from the weekly archive snapshot.',
                names: entry.participants || [],
                emptyText: 'No participants recorded.',
                cardClass: 'campaign-archive-summary-card-participants',
                collapsibleNames: true,
                previewCount: CAMPAIGN_ARCHIVE_PARTICIPANT_PREVIEW_COUNT,
                itemLabel: 'participants',
                expandLabel: 'View All Participants',
                collapseLabel: 'Collapse Roll'
            });

            panel.appendChild(titleEl);
            panel.appendChild(noteEl);
            panel.appendChild(vanguardStrip);
            panel.appendChild(participantCard);
            warEffortGrid.appendChild(panel);
        });
    } else {
        warEffortGrid.appendChild(
            buildEmptyPanel('No War-Effort Entries', 'No war-effort categories were recorded for this archived week.')
        );
    }
    warEffortSection.appendChild(warEffortGrid);
    body.appendChild(warEffortSection);

    const championsSection = document.createElement('section');
    championsSection.className = 'campaign-archive-section';
    championsSection.appendChild(buildSectionTitle('Reigning Champions'));

    const championsGrid = document.createElement('div');
    championsGrid.className = 'campaign-archive-grid campaign-archive-grid-dual';

    ['pve', 'pvp'].forEach(category => {
        const matchingEntry = Array.isArray(weekEntry && weekEntry.reigning_titles)
            ? weekEntry.reigning_titles.find(entry => entry.category === category)
            : null;
        const label = category === 'pve' ? 'PvE Reigning Champ' : 'PvP Reigning Champ';

        if (!matchingEntry) {
            championsGrid.appendChild(
                buildEmptyPanel(label, `No ${label.toLowerCase()} was recorded for this archived week.`)
            );
            return;
        }

        const panel = document.createElement('section');
        panel.className = 'leaderboard-panel campaign-archive-panel';

        const titleEl = document.createElement('h4');
        titleEl.className = 'leaderboard-title campaign-archive-panel-title';
        titleEl.textContent = label;

        const listEl = document.createElement('div');
        listEl.className = 'leaderboard-list';
        const row = buildCampaignArchiveLeaderboardRow({
            rankText: '👑',
            champion: matchingEntry.champion,
            score: matchingEntry.score,
            scoreLabel: category === 'pve' ? 'iLvl' : 'HKs',
            toneClass: category === 'pve' ? 'pve-score' : 'pvp-score',
            fallbackMeta: 'Historical champion'
        });
        if (row) listEl.appendChild(row);

        panel.appendChild(titleEl);
        panel.appendChild(listEl);
        championsGrid.appendChild(panel);
    });

    championsSection.appendChild(championsGrid);
    body.appendChild(championsSection);

    const ladderSection = document.createElement('section');
    ladderSection.className = 'campaign-archive-section';
    ladderSection.appendChild(buildSectionTitle('Ladder Snapshot'));

    const ladderGrid = document.createElement('div');
    ladderGrid.className = 'campaign-archive-grid campaign-archive-grid-dual';

    ['pve', 'pvp'].forEach(category => {
        const entries = weekEntry && weekEntry.ladder ? (weekEntry.ladder[category] || []) : [];
        const panel = document.createElement('section');
        panel.className = 'leaderboard-panel campaign-archive-panel';

        const titleEl = document.createElement('h4');
        titleEl.className = 'leaderboard-title campaign-archive-panel-title';
        titleEl.textContent = category === 'pve' ? 'PvE Weekly Snapshot' : 'PvP Weekly Snapshot';

        panel.appendChild(titleEl);

        if (!entries.length) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'tl-empty-msg campaign-archive-empty';
            emptyEl.textContent = `No ${category.toUpperCase()} ladder entries were recorded for this archived week.`;
            panel.appendChild(emptyEl);
            ladderGrid.appendChild(panel);
            return;
        }

        const listEl = document.createElement('div');
        listEl.className = 'leaderboard-list';

        entries.forEach(entry => {
            const row = buildCampaignArchiveLeaderboardRow({
                rankText: `#${entry.rank}`,
                champion: entry.champion,
                score: entry.score,
                scoreLabel: category === 'pve' ? 'iLvl' : 'HKs',
                toneClass: category === 'pve' ? 'pve-score' : 'pvp-score',
                fallbackMeta: 'Historical ladder entry'
            });
            if (row) listEl.appendChild(row);
        });

        panel.appendChild(listEl);
        ladderGrid.appendChild(panel);
    });

    ladderSection.appendChild(ladderGrid);
    body.appendChild(ladderSection);

    return body;
}
