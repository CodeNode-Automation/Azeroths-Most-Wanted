// Core formatting helpers prepended during final JS assembly.

function safeParseArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }
    return [];
}

function getThematicName(rawName) {
    if (!rawName) return 'Awarded';
    const clean = rawName.toLowerCase().trim();
    const map = {
        'xp': "Hero's Journey",
        'hks': "Blood of the Enemy",
        'hk': "Blood of the Enemy",
        'loot': "Dragon's Hoard",
        'zenith': "The Zenith Cohort",
        'pve_gold': "PvE Ladder (Gold)",
        'pve_silver': "PvE Ladder (Silver)",
        'pve_bronze': "PvE Ladder (Bronze)",
        'pvp_gold': "PvP Ladder (Gold)",
        'pvp_silver': "PvP Ladder (Silver)",
        'pvp_bronze': "PvP Ladder (Bronze)",
        'mvp_pve': "PvE MVP Champion",
        'mvp_pvp': "PvP MVP Champion",
        'vanguard': "Vanguard Status",
        'campaign': "Campaign Participant"
    };
    return map[clean] || (rawName.charAt(0).toUpperCase() + rawName.slice(1));
}

function summarizeBadges(badgeArray) {
    const arr = safeParseArray(badgeArray);
    if (arr.length === 0) return "";
    const counts = arr.reduce((acc, val) => {
        const niceName = getThematicName(val);
        acc[niceName] = (acc[niceName] || 0) + 1;
        return acc;
    }, {});
    return Object.entries(counts).map(([k, v]) => `${v}x ${k}`).join(', ');
}

function formatLadderMetricValue(value, hashUrl) {
    const safeValue = Math.max(0, Number(value) || 0);
    return hashUrl === 'ladder-pvp'
        ? safeValue.toLocaleString()
        : Math.round(safeValue).toLocaleString();
}

function formatCompactMetricValue(value) {
    return new Intl.NumberFormat('en', {
        notation: 'compact',
        maximumFractionDigits: value >= 100000 ? 1 : 0
    }).format(Math.max(0, Number(value) || 0));
}

function getLadderStatusMeta(trendValue) {
    if (trendValue > 0) return { text: 'Rising', className: 'is-rising' };
    if (trendValue < 0) return { text: 'Slipping', className: 'is-slipping' };
    return { text: 'Holding', className: 'is-holding' };
}

function formatLastLoginAge(lastLoginValue, fallback = 'Unknown') {
    if (lastLoginValue === null || lastLoginValue === undefined || lastLoginValue === '') {
        return fallback;
    }

    let timestamp = Number(lastLoginValue);
    if (!Number.isFinite(timestamp)) {
        timestamp = new Date(lastLoginValue).getTime();
    }

    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        return fallback;
    }

    if (timestamp < 100000000000) {
        timestamp *= 1000;
    }

    const dayMs = 24 * 60 * 60 * 1000;
    const elapsedDays = Math.floor(Math.max(0, Date.now() - timestamp) / dayMs);

    if (elapsedDays <= 0) return 'Today';
    if (elapsedDays === 1) return '1 day ago';
    return `${elapsedDays} days ago`;
}
