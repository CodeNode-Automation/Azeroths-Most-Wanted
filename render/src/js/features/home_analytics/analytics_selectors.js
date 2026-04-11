// Analytics selector helpers prepended during final JS assembly.

function findRosterEntryByName(rosterData, name) {
    if (!name) return null;
    return rosterData.find(c => c.profile && c.profile.name && c.profile.name.toLowerCase() === name.toLowerCase()) || null;
}

function getTrendEntry(rosterData, kind) {
    const sorted = [...rosterData]
        .filter(c => c.profile)
        .filter(c => {
            if (kind === 'pvp') return (c.profile.trend_pvp || c.profile.trend_hks || 0) > 0;
            return (c.profile.trend_pve || c.profile.trend_ilvl || 0) > 0;
        })
        .sort((a, b) => {
            const aVal = kind === 'pvp' ? (a.profile.trend_pvp || a.profile.trend_hks || 0) : (a.profile.trend_pve || a.profile.trend_ilvl || 0);
            const bVal = kind === 'pvp' ? (b.profile.trend_pvp || b.profile.trend_hks || 0) : (b.profile.trend_pve || b.profile.trend_ilvl || 0);
            return bVal - aVal;
        });
    return sorted[0] || null;
}

function getTopRoleAnchor(rosterData, roleName) {
    return [...filterMainCharacters(rosterData)]
        .filter(c => c.profile && c.profile.level === 70)
        .filter(c => getCharacterRole(getCharClass(c), c.profile.active_spec || '') === roleName)
        .sort((a, b) => (b.profile.equipped_item_level || 0) - (a.profile.equipped_item_level || 0))[0] || null;
}
