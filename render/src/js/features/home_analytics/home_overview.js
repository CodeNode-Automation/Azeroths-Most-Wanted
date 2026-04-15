// Home overview helpers prepended during final JS assembly.

function getDecoratedRosterCount() {
    return rosterData.filter(c => {
        const p = c.profile;
        if (!p) return false;

        const vCount = safeParseArray(p.vanguard_badges || c.vanguard_badges).length;
        const cCount = safeParseArray(p.campaign_badges || c.campaign_badges).length;
        const pveMvp = parseInt(p.pve_champ_count || c.pve_champ_count) || 0;
        const pvpMvp = parseInt(p.pvp_champ_count || c.pvp_champ_count) || 0;
        const pveG = parseInt(p.pve_gold || c.pve_gold) || 0;
        const pvpG = parseInt(p.pvp_gold || c.pvp_gold) || 0;
        const pveS = parseInt(p.pve_silver || c.pve_silver) || 0;
        const pvpS = parseInt(p.pvp_silver || c.pvp_silver) || 0;
        const pveB = parseInt(p.pve_bronze || c.pve_bronze) || 0;
        const pvpB = parseInt(p.pvp_bronze || c.pvp_bronze) || 0;

        return (vCount + cCount + pveMvp + pvpMvp + pveG + pvpG + pveS + pvpS + pveB + pvpB) > 0;
    }).length;
}

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
    const decoratedCount = getDecoratedRosterCount();

    setHomeText('home-command-total-value', totalAllCount.toLocaleString());
    setHomeText('home-command-active-value', activeMainCount.toLocaleString());
    setHomeText('home-command-raidready-value', raidReadyMainCount.toLocaleString());
    setHomeText('home-command-badges-value', decoratedCount.toLocaleString());

    setHomeCardText('home-command-total-value', '.home-nav-copy', `Mains: ${totalMainCount.toLocaleString()} / All chars: ${totalAllCount.toLocaleString()} across the scanned guild roster.`);
    setHomeCardText('home-command-active-value', '.home-nav-copy', `Mains: ${activeMainCount.toLocaleString()} / All chars: ${activeAllCount.toLocaleString()} seen within 14 days.`);
    setHomeCardText('home-command-raidready-value', '.home-nav-copy', `Mains: ${raidReadyMainCount.toLocaleString()} / All chars: ${raidReadyAllCount.toLocaleString()} at level 70 and iLvl 110+.`);

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
}
