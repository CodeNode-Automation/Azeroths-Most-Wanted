// Home overview helpers prepended during final JS assembly.

function setHomeText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function setHomeCardText(valueId, selector, value) {
    const valueEl = document.getElementById(valueId);
    const cardEl = valueEl ? valueEl.closest('.home-nav-card') : null;
    const targetEl = cardEl ? cardEl.querySelector(selector) : null;
    if (targetEl) targetEl.textContent = value;
}

function formatHomeApiStatusTime(isoString) {
    if (!isoString) return '';

    try {
        return new Date(isoString).toLocaleString('de-DE', {
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

function formatHomeMovementTime(isoString) {
    if (!isoString) return '';

    try {
        return new Date(isoString).toLocaleString('de-DE', {
            timeZone: 'Europe/Berlin',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }) + ' Uhr';
    } catch (error) {
        return '';
    }
}

function formatHomeMovementEventType(eventType) {
    switch ((eventType || '').toLowerCase()) {
        case 'joined':
            return 'Joined';
        case 'departed':
            return 'Departed';
        case 'rejoined':
            return 'Rejoined';
        default:
            return 'Updated';
    }
}

function formatHomeChangeItemType(changeType) {
    switch ((changeType || '').toLowerCase()) {
        case 'movement':
            return 'Movement';
        case 'level_up':
            return 'Activity';
        case 'item':
            return 'Activity';
        case 'badge':
            return 'Awards';
        case 'trend':
            return 'Trend';
        default:
            return 'Update';
    }
}

function formatHomeOfficerBriefItemType(itemType) {
    switch ((itemType || '').toLowerCase()) {
        case 'movement':
            return 'Movement';
        case 'activity':
            return 'Activity';
        case 'readiness':
            return 'Readiness';
        case 'changes':
            return 'Changes';
        case 'trend':
            return 'Trend';
        case 'war_effort':
            return 'War Effort';
        default:
            return 'Update';
    }
}

function renderHomeApiStatus(apiStatus = {}) {
    const banner = document.getElementById('home-api-status-banner');
    const titleEl = document.getElementById('home-api-status-title');
    const messageEl = document.getElementById('home-api-status-message');
    if (!banner || !titleEl || !messageEl) return;

    if (!apiStatus || apiStatus.ok !== false) {
        banner.hidden = true;
        return;
    }

    const codeText = apiStatus.code ? ` (HTTP ${apiStatus.code})` : '';
    const updatedText = formatHomeApiStatusTime(apiStatus.updated_at);
    const baseMessage = apiStatus.message
        ? `${apiStatus.message} Showing the last successful command snapshot.`
        : 'Live guild refresh is temporarily paused. Showing the last successful command snapshot.';

    titleEl.textContent = `Blizzard API outage detected${codeText}`;
    messageEl.textContent = updatedText ? `${baseMessage} Last check: ${updatedText}.` : baseMessage;
    banner.hidden = false;
}

function renderHomeLatestChangesCard(dashboardConfig = {}) {
    const latestChanges = dashboardConfig.latest_changes || {};
    const titleEl = document.getElementById('home-latest-changes-title');
    const summaryEl = document.getElementById('home-latest-changes-summary');
    const listEl = document.getElementById('home-latest-changes-list');

    if (!titleEl || !summaryEl || !listEl) return;

    const items = Array.isArray(latestChanges.items) ? latestChanges.items : [];
    const emptyText = latestChanges.empty_text || 'No notable changes recorded yet.';

    titleEl.textContent = latestChanges.title || 'What changed recently';
    summaryEl.textContent = latestChanges.empty || items.length === 0
        ? emptyText
        : 'Movement first, then recent activity and trend deltas.';

    listEl.innerHTML = '';
    if (latestChanges.empty || items.length === 0) {
        listEl.hidden = true;
        return;
    }

    items.slice(0, 5).forEach(item => {
        const li = document.createElement('li');
        li.className = 'home-latest-changes-item';
        li.setAttribute('data-tone', (item.tone || 'neutral').toLowerCase());
        li.setAttribute('data-change-type', (item.type || 'update').toLowerCase());

        const label = document.createElement('span');
        label.className = 'home-latest-changes-label';
        label.textContent = item.label || 'Update';

        const typeLabel = document.createElement('span');
        typeLabel.className = 'home-latest-changes-type';
        typeLabel.textContent = formatHomeChangeItemType(item.type);

        li.append(label, typeLabel);
        listEl.appendChild(li);
    });

    listEl.hidden = false;
}

function renderHomeMovementCard(dashboardConfig = {}) {
    const movement = dashboardConfig.membership_movement || {};
    const titleEl = document.getElementById('home-movement-title');
    const summaryEl = document.getElementById('home-movement-summary');
    const listEl = document.getElementById('home-movement-list');
    const noteEl = document.getElementById('home-movement-note');

    if (!titleEl || !summaryEl || !listEl || !noteEl) return;

    const joined = getNumericConfigValue(movement, 'joined', 0);
    const departed = getNumericConfigValue(movement, 'departed', 0);
    const rejoined = getNumericConfigValue(movement, 'rejoined', 0);
    const total = getNumericConfigValue(movement, 'total', 0);
    const recent = Array.isArray(movement.recent) ? movement.recent : [];
    const bootstrap = Boolean(movement.bootstrap);

    titleEl.textContent = bootstrap ? 'Initial roster capture' : 'Latest roster movement';
    summaryEl.textContent = total > 0
        ? bootstrap
            ? `${total.toLocaleString()} members recorded as the movement baseline.`
            : `+${joined.toLocaleString()} joined / -${departed.toLocaleString()} departed / ↻ ${rejoined.toLocaleString()} rejoined from the latest scan.`
        : 'No roster movement logged yet.';

    listEl.innerHTML = '';
    if (bootstrap || recent.length === 0) {
        listEl.hidden = true;
    } else {
        recent.slice(0, 5).forEach(event => {
            const item = document.createElement('li');
            item.className = `home-movement-item home-movement-item-${(event.event_type || 'updated').toLowerCase()}`;
            item.setAttribute('data-event-type', (event.event_type || 'updated').toLowerCase());

            const name = document.createElement('span');
            name.className = 'home-movement-name';
            name.textContent = event.character_name || 'Unknown hero';

            const metaWrap = document.createElement('span');
            metaWrap.className = 'home-movement-meta-wrap';

            const eventLabel = document.createElement('span');
            eventLabel.className = 'home-movement-event';
            eventLabel.textContent = formatHomeMovementEventType(event.event_type);

            const timeLabel = document.createElement('span');
            timeLabel.className = 'home-movement-time';
            timeLabel.textContent = formatHomeMovementTime(event.detected_at);

            metaWrap.append(eventLabel, timeLabel);
            item.append(name, metaWrap);
            listEl.appendChild(item);
        });
        listEl.hidden = false;
    }

    noteEl.hidden = !bootstrap;
    noteEl.textContent = bootstrap
        ? 'Future joins, departures, and rejoins will appear here.'
        : '';
}

function renderHomeOfficerBriefCard(dashboardConfig = {}) {
    const officerBrief = dashboardConfig.officer_brief || {};
    const statusEl = document.getElementById('home-officer-brief-status');
    const summaryEl = document.getElementById('home-officer-brief-summary');
    const listEl = document.getElementById('home-officer-brief-list');
    const cardEl = document.getElementById('home-officer-brief-card');

    if (!statusEl || !summaryEl || !listEl || !cardEl) return;

    const items = Array.isArray(officerBrief.items) ? officerBrief.items : [];
    const emptyText = officerBrief.empty_text || 'No roster health signals are available yet.';
    const isEmpty = Boolean(officerBrief.empty) || items.length === 0;
    const tone = String(officerBrief.tone || 'neutral').toLowerCase();

    cardEl.setAttribute('data-tone', tone);
    statusEl.setAttribute('data-tone', tone);
    statusEl.textContent = officerBrief.status || 'Unknown';
    summaryEl.textContent = isEmpty
        ? emptyText
        : officerBrief.summary || emptyText;

    listEl.innerHTML = '';
    if (isEmpty) {
        listEl.hidden = true;
        return;
    }

    items.slice(0, 5).forEach(item => {
        const li = document.createElement('li');
        li.className = 'home-officer-brief-item';
        li.setAttribute('data-tone', (item.tone || 'neutral').toLowerCase());
        li.setAttribute('data-brief-type', (item.type || 'update').toLowerCase());

        const label = document.createElement('span');
        label.className = 'home-officer-brief-label';
        label.textContent = item.label || 'Update';

        const typeLabel = document.createElement('span');
        typeLabel.className = 'home-officer-brief-type';
        typeLabel.textContent = formatHomeOfficerBriefItemType(item.type);

        li.append(label, typeLabel);
        listEl.appendChild(li);
    });

    listEl.hidden = false;
}

function populateHomeOverview(dashboardConfig = {}) {
    const processedRoster = Array.isArray(rosterData) ? rosterData : [];
    const rawRoster = Array.isArray(rawGuildRoster) ? rawGuildRoster : [];
    const rosterInventory = rawRoster.length > 0 ? rawRoster : processedRoster;
    const rosterInventoryIsRaw = rawRoster.length > 0;
    const mainRoster = filterMainCharacters(processedRoster);

    let mainTotalIlvl = 0;
    let mainLvl70Count = 0;

    mainRoster.forEach(c => {
        if (!c.profile) return;
        if (c.profile.level === 70 && c.profile.equipped_item_level) {
            mainTotalIlvl += c.profile.equipped_item_level;
            mainLvl70Count++;
        }
    });

    const totalRosterCounts = getAltAwareCounts(rosterInventory, rosterInventoryIsRaw);
    const activeAllFallback = processedRoster.filter(c => {
        const lastLogin = c.profile && c.profile.last_login_timestamp ? c.profile.last_login_timestamp : 0;
        return lastLogin > 0 && (Date.now() - lastLogin) <= (14 * 24 * 60 * 60 * 1000);
    }).length;
    const activeMainFallback = mainRoster.filter(c => {
        const lastLogin = c.profile && c.profile.last_login_timestamp ? c.profile.last_login_timestamp : 0;
        return lastLogin > 0 && (Date.now() - lastLogin) <= (14 * 24 * 60 * 60 * 1000);
    }).length;
    const raidReadyAllFallback = processedRoster.filter(c => c.profile && c.profile.level === 70 && (c.profile.equipped_item_level || 0) >= 110).length;
    const raidReadyMainFallback = mainRoster.filter(c => c.profile && c.profile.level === 70 && (c.profile.equipped_item_level || 0) >= 110).length;
    const avgLvl70IlvlFallback = mainLvl70Count > 0 ? Math.round(mainTotalIlvl / mainLvl70Count) : 0;

    const totalAllCount = getNumericConfigValue(dashboardConfig, 'total_members', totalRosterCounts.allCount);
    const totalMainCount = getNumericConfigValue(dashboardConfig, 'total_members_mains', totalRosterCounts.mainCount);
    const activeAllCount = getNumericConfigValue(dashboardConfig, 'active_14_days', activeAllFallback);
    const activeMainCount = getNumericConfigValue(dashboardConfig, 'active_14_days_mains', activeMainFallback);
    const raidReadyAllCount = getNumericConfigValue(dashboardConfig, 'raid_ready_count', raidReadyAllFallback);
    const raidReadyMainCount = getNumericConfigValue(dashboardConfig, 'raid_ready_count_mains', raidReadyMainFallback);
    const avgLvl70Ilvl = getNumericConfigValue(dashboardConfig, 'avg_ilvl_70_mains', avgLvl70IlvlFallback);
    setHomeText('home-pulse-total', totalAllCount.toLocaleString());
    setHomeText('home-pulse-active', activeMainCount.toLocaleString());
    setHomeText('home-pulse-raidready', raidReadyMainCount.toLocaleString());
    setHomeText('home-kpi-ilvl', avgLvl70Ilvl.toLocaleString());

    setHomeCardText('home-pulse-total', '.home-pulse-meta', `Mains: ${totalMainCount.toLocaleString()} / All chars: ${totalAllCount.toLocaleString()} / spark and trend compare all-character daily history.`);
    setHomeCardText('home-pulse-active', '.home-pulse-label', 'Active in 14 Days (Mains)');
    setHomeCardText('home-pulse-active', '.home-pulse-meta', `All chars: ${activeAllCount.toLocaleString()} / spark and trend now follow mains-only daily history.`);
    setHomeCardText('home-pulse-raidready', '.home-pulse-label', 'Raid Ready (Mains)');
    setHomeCardText('home-pulse-raidready', '.home-pulse-meta', `All chars: ${raidReadyAllCount.toLocaleString()} / mains shown first for deployment strength.`);
    setHomeCardText('home-kpi-ilvl', '.home-pulse-label', 'Avg Level 70 iLvl (Mains)');
    setHomeCardText('home-kpi-ilvl', '.home-pulse-meta', 'Mains-only read for capped roster power.');

    renderHomeMovementCard(dashboardConfig);
    renderHomeLatestChangesCard(dashboardConfig);
    renderHomeOfficerBriefCard(dashboardConfig);
}
