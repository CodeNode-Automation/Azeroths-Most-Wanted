// Home and analytics card render helpers prepended during final JS assembly.

function formatHashName(name) {
    return (name || '').toLowerCase();
}

function setHomeRoute(el, route) {
    if (!el) return;
    if (route) el.setAttribute('data-home-route', route);
    else el.removeAttribute('data-home-route');
}

function resolvePortrait(entry) {
    if (!entry) return getClassIcon('Warrior');
    return entry.render_url || getClassIcon(getCharClass(entry));
}

function applyPressureCard(id, count, stateText, metaText) {
    const card = document.getElementById(id);
    if (!card) return;

    const valueEl = card.querySelector('.analytics-pressure-value');
    const stateEl = card.querySelector('.analytics-pressure-state');
    const metaEl = card.querySelector('.analytics-pressure-meta');

    if (valueEl) valueEl.textContent = count.toLocaleString();
    if (stateEl) stateEl.textContent = stateText;
    if (metaEl) metaEl.textContent = metaText;
}

function applyReadinessCard(id, config) {
    const card = document.getElementById(id);
    if (!card) return;

    const {
        eyebrow = '',
        name = 'Awaiting deployment',
        value = 'No geared hero logged',
        meta = 'This slot updates when a matching endgame hero is available.',
        route = '',
        portrait = getClassIcon('Warrior'),
        alt = '',
        cta = 'Inspect dossier ➔'
    } = config || {};

    const eyebrowEl = card.querySelector('.analytics-readiness-kicker');
    const nameEl = card.querySelector('.analytics-readiness-name');
    const valueEl = card.querySelector('.analytics-readiness-value');
    const metaEl = card.querySelector('.analytics-readiness-meta');
    const ctaEl = card.querySelector('.analytics-readiness-cta');
    const portraitEl = card.querySelector('.analytics-readiness-portrait');

    if (eyebrowEl) eyebrowEl.textContent = eyebrow;
    if (nameEl) nameEl.textContent = name;
    if (valueEl) valueEl.textContent = value;
    if (metaEl) metaEl.textContent = meta;
    if (ctaEl) ctaEl.textContent = cta;
    if (portraitEl) {
        portraitEl.src = portrait;
        portraitEl.alt = alt || name;
    }

    setHomeRoute(card, route);
}

function applySpotlightCard(id, config) {
    const card = document.getElementById(id);
    if (!card) return;

    const {
        eyebrow = '',
        name = 'Awaiting data',
        value = 'No movement recorded',
        meta = 'This slot will populate when the guild logs more history.',
        route = '',
        portrait = getClassIcon('Warrior'),
        alt = '',
        cta = 'Inspect ➔'
    } = config || {};

    const eyebrowEl = card.querySelector('.analytics-spotlight-kicker');
    const nameEl = card.querySelector('.analytics-spotlight-name');
    const valueEl = card.querySelector('.analytics-spotlight-value');
    const metaEl = card.querySelector('.analytics-spotlight-meta');
    const ctaEl = card.querySelector('.analytics-spotlight-cta');
    const portraitEl = card.querySelector('.analytics-spotlight-portrait');

    if (eyebrowEl) eyebrowEl.textContent = eyebrow;
    if (nameEl) nameEl.textContent = name;
    if (valueEl) valueEl.textContent = value;
    if (metaEl) metaEl.textContent = meta;
    if (ctaEl) ctaEl.textContent = cta;
    if (portraitEl) {
        portraitEl.src = portrait;
        portraitEl.alt = alt || name;
    }

    setHomeRoute(card, route);
}

function formatAnalyticsSnapshotDelta(deltaValue) {
    const numericDelta = Number(deltaValue);
    if (!Number.isFinite(numericDelta)) return 'No prior scan';
    if (numericDelta === 0) return 'No change since previous scan';

    const sign = numericDelta > 0 ? '+' : '-';
    return `${sign}${Math.abs(numericDelta).toLocaleString()} since previous scan`;
}

function formatAnalyticsSnapshotValue(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return '—';
    return numericValue.toLocaleString();
}

function renderAnalyticsSnapshotCard(cardId, config = {}) {
    const cardEl = document.getElementById(cardId);
    if (!cardEl) return;

    const valueEl = cardEl.querySelector('.analytics-snapshot-value');
    const statusEl = cardEl.querySelector('.analytics-snapshot-status');
    const scopeEl = cardEl.querySelector('.analytics-snapshot-scope');

    if (valueEl) valueEl.textContent = config.valueText || '—';
    if (statusEl) statusEl.textContent = config.statusText || 'Current snapshot';
    if (scopeEl) scopeEl.textContent = config.scopeText || '';
}

function renderAnalyticsSnapshotStrip(snapshot = {}) {
    renderAnalyticsSnapshotCard('analytics-snapshot-guild-roster', {
        valueText: formatAnalyticsSnapshotValue(snapshot.guildRosterValue),
        statusText: formatAnalyticsSnapshotDelta(snapshot.guildRosterDelta),
        scopeText: 'Raw guild roster total from the roster endpoint.'
    });

    renderAnalyticsSnapshotCard('analytics-snapshot-active-mains', {
        valueText: formatAnalyticsSnapshotValue(snapshot.activeMainsValue),
        statusText: formatAnalyticsSnapshotDelta(snapshot.activeMainsDelta),
        scopeText: 'Mains seen in the configured activity window.'
    });

    renderAnalyticsSnapshotCard('analytics-snapshot-raid-ready', {
        valueText: formatAnalyticsSnapshotValue(snapshot.raidReadyValue),
        statusText: formatAnalyticsSnapshotDelta(snapshot.raidReadyDelta),
        scopeText: 'Mains meeting the configured readiness threshold.'
    });

    renderAnalyticsSnapshotCard('analytics-snapshot-ilvl', {
        valueText: formatAnalyticsSnapshotValue(snapshot.avgIlvlValue),
        statusText: 'No prior scan',
        scopeText: 'Tracking from this scan. Level 70 mains only.'
    });
}

function formatAnalyticsCampaignArchiveWeek(weekValue) {
    const rawWeek = String(weekValue || '').trim();
    if (!rawWeek) return '—';

    const parsedWeek = new Date(rawWeek);
    if (Number.isNaN(parsedWeek.getTime())) return rawWeek;

    return parsedWeek.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function renderAnalyticsCampaignHistoryCard(archive = {}) {
    const cardEl = document.getElementById('analytics-campaign-history-card');
    if (!cardEl) return;

    const summaryEl = document.getElementById('analytics-campaign-history-summary');
    const emptyEl = document.getElementById('analytics-campaign-history-empty');
    const weeksValueEl = document.getElementById('analytics-campaign-history-weeks');
    const latestValueEl = document.getElementById('analytics-campaign-history-latest');
    const entriesValueEl = document.getElementById('analytics-campaign-history-entries');
    const reigningValueEl = document.getElementById('analytics-campaign-history-reigning');
    const metricsEl = document.getElementById('analytics-campaign-history-metrics');
    const ctaEl = document.getElementById('analytics-campaign-history-cta');

    const weeks = Array.isArray(archive.weeks) ? archive.weeks : [];
    const derivedWeekCount = Number.isFinite(Number(archive.archived_weeks))
        ? Number(archive.archived_weeks)
        : weeks.length;
    const latestWeekRaw = String(archive.latest_week || weeks[0]?.week_anchor || '').trim();
    const derivedEntryCount = Number.isFinite(Number(archive.total_campaign_entries))
        ? Number(archive.total_campaign_entries)
        : weeks.reduce((sum, week) => {
            return sum + Number(week?.war_effort_entry_count || 0) + Number(week?.ladder_entry_count || 0);
        }, 0);
    const derivedReigningCount = Number.isFinite(Number(archive.reigning_titles_logged))
        ? Number(archive.reigning_titles_logged)
        : weeks.reduce((sum, week) => sum + Number(week?.reigning_entry_count || 0), 0);
    const hasArchive = derivedWeekCount > 0 || !!latestWeekRaw || derivedEntryCount > 0 || derivedReigningCount > 0;

    if (weeksValueEl) weeksValueEl.textContent = hasArchive ? derivedWeekCount.toLocaleString() : '—';
    if (latestValueEl) latestValueEl.textContent = hasArchive ? formatAnalyticsCampaignArchiveWeek(latestWeekRaw) : '—';
    if (entriesValueEl) entriesValueEl.textContent = hasArchive ? derivedEntryCount.toLocaleString() : '—';
    if (reigningValueEl) reigningValueEl.textContent = hasArchive ? derivedReigningCount.toLocaleString() : '—';

    if (summaryEl) {
        if (hasArchive) {
            const weekLabel = formatAnalyticsCampaignArchiveWeek(latestWeekRaw);
            const weekNoun = derivedWeekCount === 1 ? 'week' : 'weeks';
            const entryNoun = derivedEntryCount === 1 ? 'entry' : 'entries';
            summaryEl.textContent = `${derivedWeekCount.toLocaleString()} archived ${weekNoun} are currently recorded. Latest week: ${weekLabel}. ${derivedEntryCount.toLocaleString()} campaign ${entryNoun} are represented in the archive.`;
        } else {
            summaryEl.textContent = 'No archived campaign weeks are available yet.';
        }
    }

    if (emptyEl) {
        emptyEl.hidden = hasArchive;
        emptyEl.textContent = 'No archived campaign weeks are available yet.';
    }

    if (metricsEl) {
        metricsEl.setAttribute('data-archive-state', hasArchive ? 'populated' : 'empty');
    }

    if (ctaEl) {
        ctaEl.setAttribute('href', '#campaign-archive');
    }
}

function formatAnalyticsFunnelPercent(count, total) {
    const numericCount = Number(count);
    const numericTotal = Number(total);
    if (!Number.isFinite(numericCount) || !Number.isFinite(numericTotal) || numericTotal <= 0) return null;
    return Math.round((numericCount / numericTotal) * 100);
}

function renderAnalyticsReadinessFunnel(funnel = {}) {
    const cardEl = document.getElementById('analytics-readiness-funnel-card');
    if (!cardEl) return;

    const stagesEl = document.getElementById('analytics-readiness-funnel-stages');
    const summaryEl = document.getElementById('analytics-readiness-funnel-summary');
    const noteEl = document.getElementById('analytics-readiness-funnel-note');
    const emptyEl = document.getElementById('analytics-readiness-funnel-empty');

    if (!stagesEl || !summaryEl || !noteEl || !emptyEl) return;

    const hasSnapshotData = !!funnel.hasSnapshotData;
    const totalRoster = Number(funnel.guildRoster);
    const activeMains = Number(funnel.activeMains);
    const level70Mains = Number(funnel.level70Mains);
    const raidReadyMains = Number(funnel.raidReadyMains);

    if (!hasSnapshotData || !Number.isFinite(totalRoster) || totalRoster <= 0) {
        stagesEl.innerHTML = '';
        summaryEl.textContent = 'Readiness funnel data is not available for this snapshot.';
        noteEl.hidden = true;
        emptyEl.hidden = false;
        return;
    }

    const hasActive = Number.isFinite(activeMains) && activeMains >= 0;
    const hasLevel70 = Number.isFinite(level70Mains) && level70Mains >= 0;
    const hasRaidReady = Number.isFinite(raidReadyMains) && raidReadyMains >= 0;

    const stageDefinitions = [
        {
            key: 'guild-roster',
            label: 'Guild Roster',
            value: totalRoster,
            meterPercent: 100,
            helper: 'Known characters in the current roster snapshot.',
            meta: '100% of known roster',
            available: true
        },
        {
            key: 'active-mains',
            label: 'Active Mains',
            value: activeMains,
            meterPercent: formatAnalyticsFunnelPercent(activeMains, totalRoster),
            helper: 'Mains seen in the configured recent activity window.',
            meta: hasActive ? `${formatAnalyticsFunnelPercent(activeMains, totalRoster)}% of known roster` : 'Not available from current snapshot',
            available: hasActive
        },
        {
            key: 'level-70-mains',
            label: 'Level 70 Mains',
            value: level70Mains,
            meterPercent: formatAnalyticsFunnelPercent(level70Mains, totalRoster),
            helper: 'Tracked mains currently at level 70.',
            meta: hasLevel70 ? `${formatAnalyticsFunnelPercent(level70Mains, totalRoster)}% of known roster` : 'Not available from current snapshot',
            available: hasLevel70
        },
        {
            key: 'raid-ready-mains',
            label: 'Raid-Ready Mains',
            value: raidReadyMains,
            meterPercent: formatAnalyticsFunnelPercent(raidReadyMains, totalRoster),
            helper: 'Mains meeting the current raid-ready threshold.',
            meta: hasRaidReady
                ? (() => {
                    const rosterShare = formatAnalyticsFunnelPercent(raidReadyMains, totalRoster);
                    const levelShare = hasLevel70 ? formatAnalyticsFunnelPercent(raidReadyMains, level70Mains) : null;
                    if (levelShare === null) return `${rosterShare}% of known roster`;
                    return `${rosterShare}% of known roster · ${levelShare}% of level 70 mains`;
                })()
                : 'Not available from current snapshot',
            available: hasRaidReady
        }
    ];

    const availableStages = stageDefinitions.filter(stage => stage.available);
    const hasPartialData = availableStages.length > 0 && availableStages.length < stageDefinitions.length;

    if (!availableStages.length) {
        stagesEl.innerHTML = '';
        summaryEl.textContent = 'Readiness funnel data is not available for this snapshot.';
        noteEl.hidden = true;
        emptyEl.hidden = false;
        return;
    }

    stagesEl.innerHTML = availableStages.map(stage => {
        const meterPercent = Number.isFinite(Number(stage.meterPercent)) ? Math.max(0, Math.min(100, Number(stage.meterPercent))) : 0;
        return `
            <div class="analytics-readiness-funnel-stage" data-stage="${stage.key}">
                <div class="analytics-readiness-funnel-stage-head">
                    <span class="analytics-readiness-funnel-label">${stage.label}</span>
                    <strong class="analytics-readiness-funnel-value">${Number(stage.value).toLocaleString()}</strong>
                </div>
                <div class="analytics-readiness-funnel-meter" aria-hidden="true">
                    <span class="analytics-readiness-funnel-fill" style="width: ${meterPercent}%;"></span>
                </div>
                <span class="analytics-readiness-funnel-meta">${stage.meta}</span>
                <span class="analytics-readiness-funnel-helper">${stage.helper}</span>
            </div>
        `;
    }).join('');

    summaryEl.textContent = 'This funnel compares the same snapshot across raw roster size, active mains, level 70 mains, and raid-ready mains. Activity and level-cap stages are parallel readiness cuts, while raid-ready mains remain a subset of level 70 mains.';
    noteEl.hidden = !hasPartialData;
    emptyEl.hidden = true;
}

function buildAnalyticsReadinessGapStat({ label, value, meta, tone = '' }) {
    const safeValue = value === null || value === undefined || value === ''
        ? '—'
        : String(value);
    const safeMeta = meta || 'Not available from current snapshot';

    return `
        <div class="analytics-readiness-gap-stat" data-tone="${escapeAnalyticsHtml(tone)}">
            <span class="analytics-readiness-gap-label">${escapeAnalyticsHtml(label)}</span>
            <strong class="analytics-readiness-gap-value">${escapeAnalyticsHtml(safeValue)}</strong>
            <span class="analytics-readiness-gap-meta">${escapeAnalyticsHtml(safeMeta)}</span>
        </div>
    `;
}

function renderAnalyticsReadinessGap(gap = {}) {
    const cardEl = document.getElementById('analytics-readiness-gap-card');
    if (!cardEl) return;

    const summaryEl = document.getElementById('analytics-readiness-gap-summary');
    const noteEl = document.getElementById('analytics-readiness-gap-note');
    const statsEl = document.getElementById('analytics-readiness-gap-stats');
    const meterWrapEl = document.getElementById('analytics-readiness-gap-meter-wrap');
    const meterFillEl = document.getElementById('analytics-readiness-gap-fill');
    const meterMetaEl = document.getElementById('analytics-readiness-gap-meter-meta');

    if (!summaryEl || !noteEl || !statsEl || !meterWrapEl || !meterFillEl || !meterMetaEl) return;

    const hasSnapshotData = !!gap.hasSnapshotData;
    const level70Mains = Number(gap.level70Mains);
    const raidReadyMains = Number(gap.raidReadyMains);
    const avgIlvl70 = Number(gap.avgIlvl70);

    const hasLevel70 = Number.isFinite(level70Mains) && level70Mains >= 0;
    const hasRaidReady = Number.isFinite(raidReadyMains) && raidReadyMains >= 0;
    const hasAvgIlvl = Number.isFinite(avgIlvl70) && avgIlvl70 > 0;

    if (!hasSnapshotData || (!hasLevel70 && !hasRaidReady && !hasAvgIlvl)) {
        statsEl.innerHTML = '';
        meterWrapEl.hidden = true;
        summaryEl.textContent = 'Readiness gap data is not available for this snapshot.';
        noteEl.hidden = true;
        noteEl.textContent = 'Some readiness gap fields are unavailable from the current snapshot.';
        cardEl.setAttribute('data-readiness-gap-state', 'empty');
        return;
    }

    const canComputeGap = hasLevel70 && hasRaidReady && level70Mains > 0;
    const sharePercent = canComputeGap
        ? formatAnalyticsFunnelPercent(raidReadyMains, level70Mains)
        : null;
    const gapCount = canComputeGap ? Math.max(level70Mains - raidReadyMains, 0) : null;

    const stats = [];
    if (hasRaidReady) {
        stats.push(buildAnalyticsReadinessGapStat({
            label: 'Raid-ready mains',
            value: raidReadyMains.toLocaleString(),
            meta: hasLevel70
                ? (sharePercent === null ? 'Not available from current snapshot' : `${sharePercent}% of level 70 mains`)
                : 'Tracked from current snapshot',
            tone: 'ready'
        }));
    }
    if (hasLevel70) {
        stats.push(buildAnalyticsReadinessGapStat({
            label: 'Level 70 mains',
            value: level70Mains.toLocaleString(),
            meta: 'Current level-cap main roster',
            tone: 'level'
        }));
    }
    if (gapCount !== null) {
        stats.push(buildAnalyticsReadinessGapStat({
            label: 'Not-yet raid-ready',
            value: gapCount.toLocaleString(),
            meta: sharePercent === null
                ? 'Not available from current snapshot'
                : `${Math.max(0, 100 - sharePercent)}% of level 70 mains`,
            tone: 'gap'
        }));
    }
    if (sharePercent !== null) {
        stats.push(buildAnalyticsReadinessGapStat({
            label: 'Raid-ready share',
            value: `${sharePercent}%`,
            meta: 'Of current level 70 mains',
            tone: 'share'
        }));
    }
    if (hasAvgIlvl) {
        stats.push(buildAnalyticsReadinessGapStat({
            label: 'Avg level 70 iLvl',
            value: avgIlvl70.toLocaleString(),
            meta: 'Level 70 mains only',
            tone: 'ilvl'
        }));
    }

    statsEl.innerHTML = stats.join('');

    if (sharePercent !== null) {
        meterWrapEl.hidden = false;
        meterFillEl.style.width = `${sharePercent}%`;
        meterMetaEl.textContent = `${sharePercent}% raid-ready among level 70 mains`;
    } else {
        meterWrapEl.hidden = true;
        meterFillEl.style.width = '0%';
        meterMetaEl.textContent = 'Raid-ready share of level 70 mains.';
    }

    if (hasLevel70 && hasRaidReady && level70Mains > 0) {
        summaryEl.textContent = `${raidReadyMains.toLocaleString()} of ${level70Mains.toLocaleString()} level 70 mains are raid-ready. ${gapCount.toLocaleString()} are not yet raid-ready.`;
    } else if (hasLevel70 && level70Mains <= 0) {
        summaryEl.textContent = 'No level 70 mains are recorded in the current snapshot.';
    } else if (hasLevel70) {
        summaryEl.textContent = `${level70Mains.toLocaleString()} level 70 mains are recorded in the current snapshot.`;
    } else if (hasRaidReady) {
        summaryEl.textContent = `${raidReadyMains.toLocaleString()} raid-ready mains are recorded in the current snapshot.`;
    } else {
        summaryEl.textContent = 'Readiness gap data is not available for this snapshot.';
    }

    noteEl.hidden = canComputeGap && hasAvgIlvl;
    noteEl.textContent = 'Some readiness gap fields are unavailable from the current snapshot.';
    cardEl.setAttribute('data-readiness-gap-state', canComputeGap && hasAvgIlvl ? 'populated' : 'partial');
}

function formatAnalyticsTempoDayStamp(day = {}) {
    const dayName = String(day.day_name || '').trim();
    const rawDate = String(day.date || '').trim();
    if (!rawDate) return dayName || 'Unknown day';

    const parsedDate = new Date(rawDate);
    if (Number.isNaN(parsedDate.getTime())) {
        return dayName ? `${dayName} · ${rawDate}` : rawDate;
    }

    const formattedDate = parsedDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });

    return dayName ? `${dayName} · ${formattedDate}` : formattedDate;
}

function formatAnalyticsSignedDelta(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue === 0) return null;
    return numericValue > 0
        ? `+${Math.abs(numericValue).toLocaleString()}`
        : `-${Math.abs(numericValue).toLocaleString()}`;
}

function buildAnalyticsTempoStat({ label, value, meta, tone = '' }) {
    const safeValue = value === null || value === undefined || value === ''
        ? '—'
        : String(value);
    const safeMeta = meta || 'Not available from current snapshot';

    return `
        <div class="analytics-tempo-stat" data-tone="${escapeAnalyticsHtml(tone)}">
            <span class="analytics-tempo-stat-label">${escapeAnalyticsHtml(label)}</span>
            <strong class="analytics-tempo-stat-value">${escapeAnalyticsHtml(safeValue)}</strong>
            <span class="analytics-tempo-stat-meta">${escapeAnalyticsHtml(safeMeta)}</span>
        </div>
    `;
}

function renderAnalyticsCampaignTempo(tempo = {}) {
    const sectionEl = document.getElementById('analytics-activity-section');
    if (!sectionEl) return;

    const summaryEl = document.getElementById('analytics-campaign-tempo-summary');
    const noteEl = document.getElementById('analytics-campaign-tempo-note');
    const statsEl = document.getElementById('analytics-campaign-tempo-stats');
    const barsEl = document.getElementById('analytics-campaign-tempo-bars');
    const emptyEl = document.getElementById('analytics-campaign-tempo-empty');

    if (!summaryEl || !noteEl || !statsEl || !barsEl || !emptyEl) return;

    const heatmap = Array.isArray(tempo.heatmap) ? tempo.heatmap.filter(Boolean) : [];
    const emptyCopy = 'Campaign tempo data is not available for this snapshot.';
    const partialCopy = 'Some campaign tempo fields are unavailable from the current snapshot.';

    if (!heatmap.length) {
        statsEl.innerHTML = '';
        barsEl.innerHTML = '';
        summaryEl.textContent = emptyCopy;
        noteEl.hidden = true;
        noteEl.textContent = partialCopy;
        emptyEl.hidden = false;
        sectionEl.setAttribute('data-tempo-state', 'empty');
        return;
    }

    const totalTempo = heatmap.reduce((sum, day) => sum + Number(day.count || 0), 0);
    const lootDrops = heatmap.reduce((sum, day) => sum + Number(day.loot || 0), 0);
    const levelUps = heatmap.reduce((sum, day) => sum + Number(day.levels || 0), 0);
    const averageTempo = heatmap.length > 0 ? Math.round(totalTempo / heatmap.length) : 0;
    const busiestDay = heatmap.reduce((best, day) => {
        const currentCount = Number(day.count || 0);
        if (!best || currentCount > Number(best.count || 0)) return day;
        return best;
    }, null);
    const latestDay = heatmap[heatmap.length - 1];
    const firstRosterPoint = [...heatmap].find(day => Number.isFinite(Number(day.total_roster)));
    const lastRosterPoint = [...heatmap].reverse().find(day => Number.isFinite(Number(day.total_roster)));
    const firstActivePoint = [...heatmap].find(day => Number.isFinite(Number(day.active_roster)));
    const lastActivePoint = [...heatmap].reverse().find(day => Number.isFinite(Number(day.active_roster)));
    const rosterDelta = firstRosterPoint && lastRosterPoint
        ? Number(lastRosterPoint.total_roster) - Number(firstRosterPoint.total_roster)
        : null;
    const activeDelta = firstActivePoint && lastActivePoint
        ? Number(lastActivePoint.active_roster) - Number(firstActivePoint.active_roster)
        : null;
    const maxTempo = Math.max(...heatmap.map(day => Number(day.count || 0)), 1);
    const hasPartialData = heatmap.some(day => day.total_roster === null || day.total_roster === undefined || day.active_roster === null || day.active_roster === undefined);

    summaryEl.textContent = 'The last seven days of timeline activity, highlighting loot drops, level-ups, and roster movement snapshots.';
    const tempoNoteText = [
        busiestDay ? `Busiest day: ${formatAnalyticsTempoDayStamp(busiestDay)} (${Number(busiestDay.count || 0).toLocaleString()} actions)` : '',
        latestDay ? `Latest day: ${formatAnalyticsTempoDayStamp(latestDay)}` : '',
        rosterDelta !== null ? `Total roster Δ ${formatAnalyticsSignedDelta(rosterDelta)}` : '',
        activeDelta !== null ? `Active mains Δ ${formatAnalyticsSignedDelta(activeDelta)}` : ''
    ].filter(Boolean).join(' · ') || partialCopy;
    noteEl.textContent = hasPartialData && tempoNoteText !== partialCopy
        ? `${tempoNoteText} · ${partialCopy}`
        : tempoNoteText;
    noteEl.hidden = false;

    statsEl.innerHTML = [
        buildAnalyticsTempoStat({
            label: 'Tempo Total',
            value: totalTempo.toLocaleString(),
            meta: `${heatmap.length.toLocaleString()} days recorded`,
            tone: 'tempo'
        }),
        buildAnalyticsTempoStat({
            label: 'Loot Drops',
            value: lootDrops.toLocaleString(),
            meta: 'Item events recorded',
            tone: 'loot'
        }),
        buildAnalyticsTempoStat({
            label: 'Level Ups',
            value: levelUps.toLocaleString(),
            meta: 'Level-up events recorded',
            tone: 'levels'
        }),
        buildAnalyticsTempoStat({
            label: 'Avg / Day',
            value: averageTempo.toLocaleString(),
            meta: 'Across the last seven days',
            tone: 'average'
        })
    ].join('');

    barsEl.innerHTML = heatmap.map(day => {
        const dailyCount = Number(day.count || 0);
        const dailyLoot = Number(day.loot || 0);
        const dailyLevels = Number(day.levels || 0);
        const fillPercent = Math.max(0, Math.min(100, Math.round((dailyCount / maxTempo) * 100)));

        return `
            <div class="analytics-tempo-row${busiestDay === day ? ' is-peak' : ''}" data-tone="${busiestDay === day ? 'peak' : 'tempo'}">
                <div class="analytics-tempo-row-head">
                    <span class="analytics-tempo-row-label">${escapeAnalyticsHtml(formatAnalyticsTempoDayStamp(day))}</span>
                    <strong class="analytics-tempo-row-value">${dailyCount.toLocaleString()}</strong>
                </div>
                <div class="analytics-tempo-meter" aria-hidden="true">
                    <span class="analytics-tempo-fill" style="width: ${fillPercent > 0 ? Math.max(6, fillPercent) : 0}%;"></span>
                </div>
                <span class="analytics-tempo-row-meta">${escapeAnalyticsHtml(`${dailyLoot} loot · ${dailyLevels} level-ups`)}</span>
            </div>
        `;
    }).join('');

    emptyEl.hidden = true;
    sectionEl.setAttribute('data-tempo-state', hasPartialData ? 'partial' : 'populated');
}

function buildAnalyticsRoleSnapshotRow({ label, count, total, meta, tone = '', route = '' }) {
    const share = formatAnalyticsSnapshotShare(count, total);
    const safeCount = Number.isFinite(Number(count)) ? Number(count).toLocaleString() : '—';
    const safeMeta = meta || (share === null ? 'Not available from current snapshot' : `${share}% of mains`);
    const fillPercent = Number.isFinite(share) ? Math.max(0, Math.min(100, share)) : 0;
    const routeAttr = route ? ` data-home-route="${escapeAnalyticsHtml(route)}"` : '';
    const labelText = escapeAnalyticsHtml(label);
    const interactiveClass = route ? '' : ' is-static';
    const tagName = route ? 'button type="button"' : 'div';

    return `
        <${tagName} class="analytics-role-snapshot-row${interactiveClass}" data-tone="${escapeAnalyticsHtml(tone)}"${routeAttr}${route ? ` aria-label="Inspect ${labelText}"` : ''}>
            <div class="analytics-role-snapshot-row-head">
                <span class="analytics-role-snapshot-row-label">${labelText}</span>
                <strong class="analytics-role-snapshot-row-value">${safeCount}</strong>
            </div>
            <div class="analytics-role-snapshot-meter" aria-hidden="true">
                <span class="analytics-role-snapshot-fill" style="width: ${fillPercent > 0 ? Math.max(6, fillPercent) : 0}%;"></span>
            </div>
            <span class="analytics-role-snapshot-row-meta">${escapeAnalyticsHtml(safeMeta)}</span>
        </${route ? 'button' : 'div'}>
    `;
}

function renderAnalyticsRoleSnapshot(snapshot = {}) {
    const cardEl = document.getElementById('analytics-role-snapshot-card');
    if (!cardEl) return;

    const summaryEl = document.getElementById('analytics-role-snapshot-summary');
    const noteEl = document.getElementById('analytics-role-snapshot-note');
    const listEl = document.getElementById('analytics-role-snapshot-list');
    const emptyEl = document.getElementById('analytics-role-snapshot-empty');

    if (!summaryEl || !noteEl || !listEl || !emptyEl) return;

    const roster = Array.isArray(snapshot.roster) ? snapshot.roster.filter(Boolean) : [];
    const emptyCopy = 'Raid role data is not available for this snapshot.';
    const partialCopy = 'Some role fields are unavailable from the current snapshot.';

    if (!roster.length) {
        listEl.innerHTML = '';
        summaryEl.textContent = emptyCopy;
        noteEl.hidden = true;
        noteEl.textContent = partialCopy;
        emptyEl.hidden = false;
        cardEl.setAttribute('data-role-snapshot-state', 'empty');
        return;
    }

    const roleCounts = new Map();
    let unknownRoleCount = 0;

    roster.forEach(entry => {
        const className = getCharClass(entry);
        const roleName = getCharacterRole(className, entry?.profile?.active_spec || '') || 'Unknown';
        roleCounts.set(roleName, (roleCounts.get(roleName) || 0) + 1);
        if (roleName === 'Unknown') unknownRoleCount++;
    });

    const roleOrder = {
        'Tank': 0,
        'Healer': 1,
        'Melee DPS': 2,
        'Ranged DPS': 3,
        'Unknown': 4
    };
    const roleToneByLabel = {
        'Tank': { route: 'filter-role-tank', tone: 'tank' },
        'Healer': { route: 'filter-role-healer', tone: 'healer' },
        'Melee DPS': { route: 'filter-role-melee-dps', tone: 'melee' },
        'Ranged DPS': { route: 'filter-role-ranged-dps', tone: 'ranged' },
        'Unknown': { route: '', tone: 'unknown' }
    };

    const roleRows = [...roleCounts.entries()]
        .filter(([, count]) => count > 0)
        .map(([label, count]) => ({
            label,
            count,
            ...(roleToneByLabel[label] || { route: '', tone: '' })
        }))
        .sort((a, b) => (roleOrder[a.label] ?? 99) - (roleOrder[b.label] ?? 99));

    listEl.innerHTML = roleRows.length > 0
        ? roleRows.map(row => buildAnalyticsRoleSnapshotRow({
            label: row.label,
            count: row.count,
            total: roster.length,
            meta: formatAnalyticsSnapshotShareText(row.count, roster.length),
            tone: row.tone,
            route: row.route
        })).join('')
        : `<div class="analytics-role-snapshot-empty-state">No raid role data available from this snapshot.</div>`;

    summaryEl.textContent = 'Known specs among mains, mapped into the app’s current tank, healer, melee, and ranged role buckets.';
    noteEl.hidden = !unknownRoleCount;
    noteEl.textContent = unknownRoleCount > 0
        ? `${unknownRoleCount.toLocaleString()} mains are missing an active spec and are shown as Unknown.`
        : 'Click a role to filter the roster.';
    emptyEl.hidden = true;
    cardEl.setAttribute('data-role-snapshot-state', unknownRoleCount > 0 ? 'partial' : 'populated');
}

function getAnalyticsRosterHonorKills(entry) {
    const rawValue = entry && (
        entry.honorable_kills
        ?? (entry.profile && entry.profile.honorable_kills)
        ?? entry.hks
        ?? 0
    );
    const value = Number(rawValue);
    return Number.isFinite(value) && value > 0 ? value : 0;
}

function buildAnalyticsHonorSnapshotStat({ label, value, meta, tone = '' }) {
    const safeValue = value === null || value === undefined || value === ''
        ? '—'
        : String(value);
    const safeMeta = meta || 'Not available from current snapshot';

    return `
        <div class="analytics-honor-stat" data-tone="${escapeAnalyticsHtml(tone)}">
            <span class="analytics-honor-stat-label">${escapeAnalyticsHtml(label)}</span>
            <strong class="analytics-honor-stat-value">${escapeAnalyticsHtml(safeValue)}</strong>
            <span class="analytics-honor-stat-meta">${escapeAnalyticsHtml(safeMeta)}</span>
        </div>
    `;
}

function buildAnalyticsHonorSnapshotRow({ name, value, meta, share, index }) {
    const safeShare = Number.isFinite(Number(share)) ? Math.max(0, Math.min(100, Number(share))) : 0;
    return `
        <div class="analytics-honor-row" data-rank="${index + 1}">
            <div class="analytics-honor-row-head">
                <span class="analytics-honor-row-rank">#${index + 1}</span>
                <span class="analytics-honor-row-name">${escapeAnalyticsHtml(name)}</span>
                <strong class="analytics-honor-row-value">${escapeAnalyticsHtml(String(value))}</strong>
            </div>
            <div class="analytics-honor-row-meter" aria-hidden="true">
                <span class="analytics-honor-row-fill" style="width: ${safeShare}%;"></span>
            </div>
            <span class="analytics-honor-row-meta">${escapeAnalyticsHtml(meta)}</span>
        </div>
    `;
}

function renderAnalyticsHonorSnapshot(honor = {}) {
    const cardEl = document.getElementById('analytics-honor-card');
    if (!cardEl) return;

    const summaryEl = document.getElementById('analytics-honor-summary');
    const noteEl = document.getElementById('analytics-honor-note');
    const statsEl = document.getElementById('analytics-honor-stats');
    const leaderboardEl = document.getElementById('analytics-honor-leaderboard');
    const ctaEl = document.getElementById('analytics-honor-cta');

    if (!summaryEl || !noteEl || !statsEl || !leaderboardEl || !ctaEl) return;

    const roster = Array.isArray(honor.roster) ? honor.roster : [];
    const providedTotalHks = Number(honor.totalHks);
    const fallbackTotalHks = roster.reduce((sum, entry) => sum + getAnalyticsRosterHonorKills(entry), 0);
    const totalHks = Number.isFinite(providedTotalHks) && providedTotalHks >= 0 ? providedTotalHks : fallbackTotalHks;
    const hkEntries = roster
        .map(entry => {
            const hks = getAnalyticsRosterHonorKills(entry);
            if (hks <= 0) return null;
            const name = entry && (entry.name || (entry.profile && entry.profile.name) || 'Unknown');
            return { name, hks };
        })
        .filter(Boolean)
        .sort((a, b) => b.hks - a.hks);
    const activeCount = hkEntries.length;
    const avgActiveHks = activeCount > 0 ? Math.round(totalHks / activeCount) : null;
    const topEntries = hkEntries.slice(0, 3);
    const hasSnapshotData = !!honor.hasSnapshotData;
    const hasMeaningfulData = totalHks > 0 || activeCount > 0;
    const hasPartialData = hasMeaningfulData && topEntries.length < 3;

    ctaEl.setAttribute('href', '#ladder-pvp');

    if (!hasSnapshotData || !hasMeaningfulData) {
        summaryEl.textContent = 'Honor snapshot data is not available for this snapshot.';
        noteEl.hidden = true;
        noteEl.textContent = 'Some HK fields are unavailable from the current snapshot.';
        statsEl.innerHTML = '';
        leaderboardEl.innerHTML = '';
        cardEl.setAttribute('data-honor-state', 'empty');
        return;
    }

    const topLeader = topEntries[0];
    summaryEl.textContent = activeCount > 0
        ? `${totalHks.toLocaleString()} honorable kills are recorded across ${activeCount.toLocaleString()} HK-active characters.`
        : `${totalHks.toLocaleString()} honorable kills are recorded in the current snapshot.`;

    statsEl.innerHTML = [
        buildAnalyticsHonorSnapshotStat({
            label: 'Total Guild HKs',
            value: totalHks.toLocaleString(),
            meta: 'Current roster snapshot',
            tone: 'total'
        }),
        buildAnalyticsHonorSnapshotStat({
            label: 'HK-active characters',
            value: activeCount.toLocaleString(),
            meta: 'Characters with at least one HK',
            tone: 'active'
        }),
        buildAnalyticsHonorSnapshotStat({
            label: 'Avg HKs / active character',
            value: avgActiveHks === null ? '—' : avgActiveHks.toLocaleString(),
            meta: avgActiveHks === null ? 'Not available from current snapshot' : 'Across HK-active characters',
            tone: 'avg'
        })
    ].join('');

    leaderboardEl.innerHTML = topEntries.length > 0 ? topEntries.map((entry, index) => buildAnalyticsHonorSnapshotRow({
        name: entry.name,
        value: entry.hks.toLocaleString(),
        meta: totalHks > 0 ? `${Math.round((entry.hks / totalHks) * 100)}% of total HKs` : 'Current snapshot',
        share: totalHks > 0 ? (entry.hks / totalHks) * 100 : 0,
        index
    })).join('') : '';

    noteEl.hidden = !hasPartialData;
    noteEl.textContent = 'Some HK fields are unavailable from the current snapshot.';
    cardEl.setAttribute('data-honor-state', hasPartialData ? 'partial' : 'populated');

    if (topLeader) {
        ctaEl.textContent = `Open PvP Ladder · ${topLeader.name} leads`;
    } else {
        ctaEl.textContent = 'Open PvP Ladder ➔';
    }
}

function escapeAnalyticsHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatAnalyticsSnapshotShare(count, total) {
    const numericCount = Number(count);
    const numericTotal = Number(total);
    if (!Number.isFinite(numericCount) || !Number.isFinite(numericTotal) || numericTotal <= 0) return null;
    return Math.round((numericCount / numericTotal) * 100);
}

function formatAnalyticsSnapshotShareText(count, total) {
    const share = formatAnalyticsSnapshotShare(count, total);
    return share === null ? 'Not available from current snapshot' : `${share}% of roster`;
}

function getAnalyticsRosterClass(entry) {
    const rawClass = entry && (entry.class || entry.character_class || entry.playable_class || (entry.profile && entry.profile.class));
    const className = String(rawClass || 'Unknown').trim();
    return className || 'Unknown';
}

function getAnalyticsRosterRace(entry) {
    const rawRace = entry && (entry.race || entry.character_race || entry.playable_race || (entry.profile && entry.profile.race && entry.profile.race.name));
    const raceName = typeof rawRace === 'string'
        ? rawRace
        : rawRace && typeof rawRace === 'object'
            ? (rawRace.en_US || rawRace.name || rawRace.english || rawRace.value || 'Unknown')
            : 'Unknown';
    const cleanRaceName = String(raceName || 'Unknown').trim();
    return cleanRaceName || 'Unknown';
}

function getAnalyticsRosterLevel(entry) {
    const rawLevel = entry && (entry.level ?? entry.current_level ?? (entry.profile && entry.profile.level));
    const level = Number(rawLevel);
    return Number.isFinite(level) ? level : null;
}

function getAnalyticsRosterIlvl(entry) {
    const rawIlvl = entry && (
        entry.equipped_item_level
        ?? entry.item_level
        ?? entry.current_item_level
        ?? (entry.profile && (
            entry.profile.equipped_item_level
            ?? entry.profile.item_level
            ?? entry.profile.current_item_level
        ))
    );
    const ilvl = Number(rawIlvl);
    return Number.isFinite(ilvl) && ilvl > 0 ? ilvl : null;
}

function buildAnalyticsCompositionRow({ label, count, total, meta, tone = '' }) {
    const share = formatAnalyticsSnapshotShare(count, total);
    const safeCount = Number.isFinite(Number(count)) ? Number(count).toLocaleString() : '—';
    const safeMeta = meta || (share === null ? 'Not available from current snapshot' : `${share}% of snapshot`);
    const fillPercent = Number.isFinite(share) ? Math.max(0, Math.min(100, share)) : 0;

    return `
        <div class="analytics-roster-composition-row" data-tone="${escapeAnalyticsHtml(tone)}">
            <div class="analytics-roster-composition-row-head">
                <span class="analytics-roster-composition-row-label">${escapeAnalyticsHtml(label)}</span>
                <strong class="analytics-roster-composition-row-value">${safeCount}</strong>
            </div>
            <div class="analytics-roster-composition-meter" aria-hidden="true">
                <span class="analytics-roster-composition-fill" style="width: ${fillPercent}%;"></span>
            </div>
            <span class="analytics-roster-composition-row-meta">${escapeAnalyticsHtml(safeMeta)}</span>
        </div>
    `;
}

function buildAnalyticsDistributionItem({ label, count, total, meta, tone = '', route = '', secondary = false }) {
    const share = formatAnalyticsSnapshotShare(count, total);
    const safeCount = Number.isFinite(Number(count)) ? Number(count).toLocaleString() : '—';
    const safeMeta = meta || (share === null ? 'Not available from current snapshot' : `${share}% of roster`);
    const fillPercent = Number.isFinite(share) ? Math.max(0, Math.min(100, share)) : 0;
    const routeAttr = route ? ` data-home-route="${escapeAnalyticsHtml(route)}"` : '';
    const labelText = escapeAnalyticsHtml(label);
    const sharedClass = secondary
        ? ' analytics-distribution-item-secondary'
        : '';
    const interactiveClass = route ? '' : ' is-static';
    const tagName = route ? 'button type="button"' : 'div';

    return `
        <${tagName} class="analytics-distribution-item${sharedClass}${interactiveClass}" data-tone="${escapeAnalyticsHtml(tone)}"${routeAttr} aria-label="Inspect ${labelText}">
            <div class="analytics-distribution-item-head">
                <span class="analytics-distribution-item-label">${labelText}</span>
                <strong class="analytics-distribution-item-value">${safeCount}</strong>
            </div>
            <div class="analytics-distribution-meter" aria-hidden="true">
                <span class="analytics-distribution-fill" style="width: ${fillPercent > 0 ? Math.max(6, fillPercent) : 0}%;"></span>
            </div>
            <span class="analytics-distribution-item-meta">${escapeAnalyticsHtml(safeMeta)}</span>
        </${route ? 'button' : 'div'}>
    `;
}

function buildAnalyticsProgressionRow({ label, count, total, meta, tone = '', route = '' }) {
    const share = formatAnalyticsSnapshotShare(count, total);
    const safeCount = Number.isFinite(Number(count)) ? Number(count).toLocaleString() : '—';
    const safeMeta = meta || (share === null ? 'Not available from current snapshot' : `${share}% of roster`);
    const fillPercent = Number.isFinite(share) ? Math.max(0, Math.min(100, share)) : 0;
    const routeAttr = route ? ` data-home-route="${escapeAnalyticsHtml(route)}"` : '';
    const labelText = escapeAnalyticsHtml(label);
    const interactiveClass = route ? '' : ' is-static';
    const tagName = route ? 'button type="button"' : 'div';

    return `
        <${tagName} class="analytics-progression-item${interactiveClass}" data-tone="${escapeAnalyticsHtml(tone)}"${routeAttr}${route ? ` aria-label="Inspect ${labelText}"` : ''}>
            <div class="analytics-progression-item-head">
                <span class="analytics-progression-item-label">${labelText}</span>
                <strong class="analytics-progression-item-value">${safeCount}</strong>
            </div>
            <div class="analytics-progression-meter" aria-hidden="true">
                <span class="analytics-progression-fill" style="width: ${fillPercent > 0 ? Math.max(6, fillPercent) : 0}%;"></span>
            </div>
            <span class="analytics-progression-item-meta">${escapeAnalyticsHtml(safeMeta)}</span>
        </${route ? 'button' : 'div'}>
    `;
}

function formatAnalyticsProgressionShareText(count, total, suffix = 'of known roster') {
    const share = formatAnalyticsSnapshotShare(count, total);
    if (share === null) return 'Not available from current snapshot';
    return `${share}% ${suffix}`;
}

function renderAnalyticsProgressionReadiness(progression = {}) {
    const sectionEl = document.getElementById('analytics-progression-readiness-section');
    if (!sectionEl) return;

    const noteEl = document.getElementById('analytics-progression-note');
    const levelCardEl = document.getElementById('analytics-level-distribution-card');
    const levelListEl = document.getElementById('analytics-level-distribution-list');
    const ilvlCardEl = document.getElementById('analytics-ilvl-spread-card');
    const ilvlListEl = document.getElementById('analytics-ilvl-spread-list');

    if (!noteEl || !levelCardEl || !levelListEl || !ilvlCardEl || !ilvlListEl) return;

    const roster = Array.isArray(progression.roster) ? progression.roster.filter(Boolean) : [];
    const ilvlRoster = Array.isArray(progression.ilvlRoster) ? progression.ilvlRoster.filter(Boolean) : roster;
    const emptyLevelCopy = 'Level distribution data is not available for this snapshot.';
    const emptyIlvlCopy = 'Item-level spread data is not available for this snapshot.';
    const partialCopy = 'Some progression readiness fields are unavailable from the current snapshot.';

    if (!roster.length) {
        levelListEl.innerHTML = `<div class="analytics-progression-empty-state">${escapeAnalyticsHtml(emptyLevelCopy)}</div>`;
        ilvlListEl.innerHTML = `<div class="analytics-progression-empty-state">${escapeAnalyticsHtml(emptyIlvlCopy)}</div>`;
        noteEl.hidden = true;
        noteEl.textContent = partialCopy;
        sectionEl.setAttribute('data-progression-state', 'empty');
        levelCardEl.setAttribute('data-progression-state', 'empty');
        ilvlCardEl.setAttribute('data-progression-state', 'empty');
        return;
    }

    const levelCounts = new Map();
    const ilvlCounts = new Map();
    let unknownLevelCount = 0;
    let totalLevel70Count = 0;
    let unknownIlvlCount = 0;

    roster.forEach(entry => {
        const level = getAnalyticsRosterLevel(entry);
        if (level === null) {
            unknownLevelCount++;
            return;
        }

        let levelLabel = '';
        if (level >= 70) {
            levelLabel = 'Level 70';
            totalLevel70Count++;
        } else if (level >= 60) {
            levelLabel = 'Level 60-69';
        } else if (level >= 50) {
            levelLabel = 'Level 50-59';
        } else {
            levelLabel = 'Below 50';
        }

        const existingLevelCount = levelCounts.get(levelLabel) || 0;
        levelCounts.set(levelLabel, existingLevelCount + 1);

    });

    const levelTotal = roster.length;
    const levelBandOrder = {
        'Level 70': 0,
        'Level 60-69': 1,
        'Level 50-59': 2,
        'Below 50': 3,
    };
    const levelToneByLabel = {
        'Level 70': { route: 'filter-level-70', tone: 'peak' },
        'Level 60-69': { route: 'filter-level-60-69', tone: 'mid' },
        'Level 50-59': { route: 'filter-level-50-59', tone: 'low' },
        'Below 50': { route: 'filter-level-1-49', tone: 'base' },
    };

    const knownLevelEntries = [...levelCounts.entries()]
        .filter(([label, count]) => label !== 'Unknown' && count > 0)
        .map(([label, count]) => ({
            label,
            count,
            ...(levelToneByLabel[label] || { route: '', tone: '' })
        }))
        .sort((a, b) => (levelBandOrder[a.label] ?? 99) - (levelBandOrder[b.label] ?? 99));

    const levelUnknown = unknownLevelCount > 0
        ? { label: 'Unknown', count: unknownLevelCount, route: '', tone: 'unknown' }
        : null;

    const levelRows = [...knownLevelEntries];
    if (levelUnknown) levelRows.push(levelUnknown);

    const levelHasPartialData = unknownLevelCount > 0;
    const levelHasKnownData = levelRows.some(row => row.label !== 'Unknown');

    if (!levelHasKnownData) {
        levelListEl.innerHTML = `<div class="analytics-progression-empty-state">${escapeAnalyticsHtml(emptyLevelCopy)}</div>`;
        levelCardEl.setAttribute('data-progression-state', 'empty');
    } else {
        const levelItems = levelRows
            .filter(row => row.count > 0)
            .map(row => buildAnalyticsProgressionRow({
                label: row.label,
                count: row.count,
                total: levelTotal,
                meta: row.label === 'Unknown'
                    ? 'Not available from current snapshot'
                    : formatAnalyticsProgressionShareText(row.count, levelTotal, 'of roster'),
                tone: row.tone,
                route: row.route
            }));

        levelListEl.innerHTML = levelItems.join('');
        levelCardEl.setAttribute('data-progression-state', levelHasPartialData ? 'partial' : 'populated');
    }

    const ilvlBandOrder = { '130+': 0, '120-129': 1, '110-119': 2, '100-109': 3, '<100': 4 };
    const ilvlToneByLabel = {
        '130+': { route: 'filter-ilvl-130+', tone: 'prime' },
        '120-129': { route: 'filter-ilvl-120-129', tone: 'high' },
        '110-119': { route: 'filter-ilvl-110-119', tone: 'steady' },
        '100-109': { route: 'filter-ilvl-100-109', tone: 'rising' },
        '<100': { route: 'filter-ilvl-<100', tone: 'under' }
    };

    const level70IlvlEntries = ilvlRoster.filter(entry => {
        const level = getAnalyticsRosterLevel(entry);
        return level !== null && level >= 70;
    });
    const level70IlvlTotal = level70IlvlEntries.length;

    level70IlvlEntries.forEach(entry => {
        const ilvl = getAnalyticsRosterIlvl(entry);
        if (ilvl === null) {
            unknownIlvlCount++;
            return;
        }

        let ilvlLabel = '';
        if (ilvl >= 130) {
            ilvlLabel = '130+';
        } else if (ilvl >= 120) {
            ilvlLabel = '120-129';
        } else if (ilvl >= 110) {
            ilvlLabel = '110-119';
        } else if (ilvl >= 100) {
            ilvlLabel = '100-109';
        } else {
            ilvlLabel = '<100';
        }

        const existingIlvlCount = ilvlCounts.get(ilvlLabel) || 0;
        ilvlCounts.set(ilvlLabel, existingIlvlCount + 1);
    });

    const ilvlKnownRows = [...ilvlCounts.entries()]
        .map(([label, count]) => ({
            label,
            count,
            ...(ilvlToneByLabel[label] || { route: '', tone: '' })
        }))
        .sort((a, b) => (ilvlBandOrder[a.label] ?? 99) - (ilvlBandOrder[b.label] ?? 99));

    const ilvlHasPartialData = unknownIlvlCount > 0 || totalLevel70Count !== level70IlvlTotal;
    const ilvlHasKnownData = ilvlKnownRows.length > 0;
    const hasPartialData = levelHasPartialData || ilvlHasPartialData;

    if (!ilvlHasKnownData) {
        ilvlListEl.innerHTML = `<div class="analytics-progression-empty-state">${escapeAnalyticsHtml(emptyIlvlCopy)}</div>`;
        ilvlCardEl.setAttribute('data-progression-state', 'empty');
    } else {
        const ilvlItems = ilvlKnownRows
            .filter(row => row.count > 0)
            .map(row => buildAnalyticsProgressionRow({
                label: row.label,
                count: row.count,
                total: level70IlvlTotal,
                meta: formatAnalyticsProgressionShareText(row.count, level70IlvlTotal, 'of level 70s'),
                tone: row.tone,
                route: row.route
            }));

        if (unknownIlvlCount > 0) {
            ilvlItems.push(buildAnalyticsProgressionRow({
                label: 'Unknown',
                count: unknownIlvlCount,
                total: level70IlvlTotal,
                meta: 'Not available from current snapshot',
                tone: 'unknown'
            }));
        }

        ilvlListEl.innerHTML = ilvlItems.join('');
        ilvlCardEl.setAttribute('data-progression-state', ilvlHasPartialData ? 'partial' : 'populated');
    }

    noteEl.hidden = !hasPartialData;
    noteEl.textContent = partialCopy;
    sectionEl.setAttribute('data-progression-state', hasPartialData ? 'partial' : 'populated');
}

function renderAnalyticsRosterComposition(composition = {}) {
    const cardEl = document.getElementById('analytics-roster-composition-card');
    if (!cardEl) return;

    const summaryEl = document.getElementById('analytics-roster-composition-summary');
    const noteEl = document.getElementById('analytics-roster-composition-note');
    const typesEl = document.getElementById('analytics-roster-composition-types');
    const classesEl = document.getElementById('analytics-roster-composition-classes');
    const levelsEl = document.getElementById('analytics-roster-composition-levels');

    if (!summaryEl || !noteEl || !typesEl || !classesEl || !levelsEl) return;

    const roster = Array.isArray(composition.roster) ? composition.roster.filter(Boolean) : [];
    const totalRoster = roster.length;
    const emptyCopy = 'Roster composition data is not available for this snapshot.';
    const partialCopy = 'Some composition fields are unavailable from the current snapshot.';

    if (!totalRoster) {
        typesEl.textContent = '';
        classesEl.textContent = '';
        levelsEl.textContent = '';
        summaryEl.textContent = emptyCopy;
        noteEl.hidden = true;
        noteEl.textContent = partialCopy;
        cardEl.setAttribute('data-composition-state', 'empty');
        return;
    }

    const typeCounts = getAltAwareCounts(roster, true);
    const classCounts = new Map();
    let knownClassCount = 0;
    let knownLevelCount = 0;
    let level70Count = 0;
    let level60to69Count = 0;
    let below60Count = 0;

    roster.forEach(entry => {
        if (!entry) return;

        const className = getAnalyticsRosterClass(entry);
        classCounts.set(className, (classCounts.get(className) || 0) + 1);
        if (className !== 'Unknown') {
            knownClassCount++;
        }

        const level = getAnalyticsRosterLevel(entry);
        if (level !== null) {
            knownLevelCount++;
            if (level >= 70) level70Count++;
            else if (level >= 60) level60to69Count++;
            else below60Count++;
        }
    });

    const topClasses = [...classCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    typesEl.innerHTML = [
        buildAnalyticsCompositionRow({
            label: 'Mains',
            count: typeCounts.mainCount,
            total: typeCounts.allCount,
            meta: formatAnalyticsSnapshotShareText(typeCounts.mainCount, typeCounts.allCount),
            tone: 'main'
        }),
        buildAnalyticsCompositionRow({
            label: 'Alts',
            count: typeCounts.altCount,
            total: typeCounts.allCount,
            meta: formatAnalyticsSnapshotShareText(typeCounts.altCount, typeCounts.allCount),
            tone: 'alt'
        })
    ].join('');

    classesEl.innerHTML = topClasses.length > 0
        ? topClasses.map(([label, count]) => buildAnalyticsCompositionRow({
            label,
            count,
            total: totalRoster,
            meta: formatAnalyticsSnapshotShareText(count, totalRoster),
            tone: 'class'
        })).join('')
        : `<div class="analytics-roster-composition-empty-state">No class data available from this snapshot.</div>`;

    levelsEl.innerHTML = [
        buildAnalyticsCompositionRow({
            label: 'Level 70',
            count: level70Count,
            total: totalRoster,
            meta: formatAnalyticsSnapshotShareText(level70Count, totalRoster),
            tone: 'level'
        }),
        buildAnalyticsCompositionRow({
            label: 'Level 60-69',
            count: level60to69Count,
            total: totalRoster,
            meta: formatAnalyticsSnapshotShareText(level60to69Count, totalRoster),
            tone: 'level'
        }),
        buildAnalyticsCompositionRow({
            label: 'Below 60',
            count: below60Count,
            total: totalRoster,
            meta: formatAnalyticsSnapshotShareText(below60Count, totalRoster),
            tone: 'level'
        })
    ].join('');

    const hasMissingCompositionFields = knownClassCount < totalRoster || knownLevelCount < totalRoster;

    summaryEl.textContent = 'This snapshot uses the raw guild roster to split mains and alts, then surfaces the most represented classes and level bands at a glance.';
    noteEl.hidden = !hasMissingCompositionFields;
    noteEl.textContent = partialCopy;
    cardEl.setAttribute('data-composition-state', hasMissingCompositionFields ? 'partial' : 'populated');
}

function renderAnalyticsRosterDistribution(distribution = {}) {
    const cardEl = document.getElementById('analytics-composition-charts');
    if (!cardEl) return;

    const noteEl = document.getElementById('analytics-distribution-note');
    const classListEl = document.getElementById('analytics-class-distribution-list');
    const raceListEl = document.getElementById('analytics-race-distribution-list');

    if (!noteEl || !classListEl || !raceListEl) return;

    const roster = Array.isArray(distribution.roster) ? distribution.roster.filter(Boolean) : [];
    const emptyCopy = 'Roster distribution data is not available for this snapshot.';
    const partialCopy = 'Some roster distribution fields are unavailable from the current snapshot.';

    if (!roster.length) {
        classListEl.innerHTML = `<div class="analytics-distribution-empty-state">${escapeAnalyticsHtml(emptyCopy)}</div>`;
        raceListEl.innerHTML = `<div class="analytics-distribution-empty-state">${escapeAnalyticsHtml(emptyCopy)}</div>`;
        noteEl.hidden = false;
        noteEl.textContent = emptyCopy;
        cardEl.setAttribute('data-distribution-state', 'empty');
        return;
    }

    const classCounts = new Map();
    const raceCounts = new Map();
    let knownClassCount = 0;
    let knownRaceCount = 0;

    roster.forEach(entry => {
        if (!entry) return;

        const className = getAnalyticsRosterClass(entry);
        classCounts.set(className, (classCounts.get(className) || 0) + 1);
        if (className !== 'Unknown') knownClassCount++;

        const raceName = getAnalyticsRosterRace(entry);
        raceCounts.set(raceName, (raceCounts.get(raceName) || 0) + 1);
        if (raceName !== 'Unknown') knownRaceCount++;
    });

    const sortCounts = entries => entries.sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return String(a[0]).localeCompare(String(b[0]));
    });

    const classEntries = sortCounts([...classCounts.entries()]);
    const raceEntries = sortCounts([...raceCounts.entries()]);
    const totalRoster = roster.length;
    const hasPartialData = knownClassCount < totalRoster || knownRaceCount < totalRoster;

    classListEl.innerHTML = classEntries.length > 0
        ? classEntries.map(([label, count]) => buildAnalyticsDistributionItem({
            label,
            count,
            total: totalRoster,
            meta: formatAnalyticsSnapshotShareText(count, totalRoster),
            tone: 'class',
            route: label === 'Unknown' ? '' : `class-${label.toLowerCase()}`
        })).join('')
        : `<div class="analytics-distribution-empty-state">No class data available from this snapshot.</div>`;

    raceListEl.innerHTML = raceEntries.length > 0
        ? raceEntries.map(([label, count]) => buildAnalyticsDistributionItem({
            label,
            count,
            total: totalRoster,
            meta: formatAnalyticsSnapshotShareText(count, totalRoster),
            tone: 'race',
            route: label === 'Unknown' ? '' : `filter-race-${label.toLowerCase()}`,
            secondary: true
        })).join('')
        : `<div class="analytics-distribution-empty-state">No race data available from this snapshot.</div>`;

    noteEl.hidden = !hasPartialData;
    noteEl.textContent = hasPartialData ? partialCopy : '';
    cardEl.setAttribute('data-distribution-state', hasPartialData ? 'partial' : 'populated');
}

function getPressureState(count, role) {
    if (role === 'Tank') {
        if (count <= 2) return { state: 'Thin shield wall', meta: 'Priority role for dependable raid structure and dungeon leadership.' };
        if (count <= 4) return { state: 'Serviceable line', meta: 'Enough tanks to field content, but depth can still improve.' };
        return { state: 'Fortified line', meta: 'Tank coverage is healthy across the known-spec roster.' };
    }

    if (role === 'Healer') {
        if (count <= 3) return { state: 'Fragile sustain', meta: 'Healing coverage is light and should stay on the officer radar.' };
        if (count <= 6) return { state: 'Stable support', meta: 'Healing depth can sustain most nights without feeling wasteful.' };
        return { state: 'Sanctified reserve', meta: 'Healer depth looks comfortable for split groups and absences.' };
    }

    if (role === 'Ranged DPS') {
        if (count <= 4) return { state: 'Arcane gap', meta: 'Caster and ranged pressure feels thin for larger raid compositions.' };
        if (count <= 8) return { state: 'Balanced volley', meta: 'Ranged support is present, but still worth growing for flexibility.' };
        return { state: 'Volley secured', meta: 'Ranged depth is strong and well represented in the current roster.' };
    }

    if (count <= 5) return { state: 'Lean blade line', meta: 'Melee coverage exists, though substitutions could still feel tight.' };
    if (count <= 10) return { state: 'Battle-ready line', meta: 'Melee presence is healthy for most progression and farm nights.' };
    return { state: 'Frontline overflowing', meta: 'Melee pressure is abundant across the current warband.' };
}
