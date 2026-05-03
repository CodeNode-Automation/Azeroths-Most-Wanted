// Core data helpers prepended during final JS assembly.

function getCharacterRole(cClass, specName = '') {
    if (["Protection", "Blood"].includes(specName) || (cClass === "Druid" && specName === "Feral Combat")) return "Tank";
    if (["Holy", "Discipline", "Restoration"].includes(specName)) return "Healer";
    if (["Mage", "Warlock", "Hunter"].includes(cClass) || ["Balance", "Elemental", "Shadow"].includes(specName)) return "Ranged DPS";
    return "Melee DPS";
}

function resolveRosterProfile(char, isRawRoster = false) {
    if (!char) return null;

    if (isRawRoster) {
        const deepRoster = Array.isArray(window.rosterData) ? window.rosterData : [];
        const match = deepRoster.find(deep => deep.profile?.name?.toLowerCase() === (char.name || '').toLowerCase());
        return match && match.profile ? match.profile : char;
    }

    return char.profile || char;
}

function isAltCharacter(entry, isRawMode = false) {
    if (!entry) return false;

    const rankValue = isRawMode
        ? (entry.rank || '')
        : ((entry.profile && entry.profile.guild_rank) || entry.guild_rank || '');

    return rankValue === 'Alt';
}

function filterMainCharacters(characters, isRawMode = false) {
    if (!Array.isArray(characters)) return [];
    return characters.filter(entry => !isAltCharacter(entry, isRawMode));
}

function getAltAwareCounts(characters, isRawMode = false) {
    const allCount = Array.isArray(characters) ? characters.length : 0;
    const mainCount = filterMainCharacters(characters, isRawMode).length;

    return {
        allCount,
        mainCount,
        altCount: Math.max(0, allCount - mainCount)
    };
}

function getNumericConfigValue(config, key, fallback = 0) {
    const value = Number(config && config[key]);
    return Number.isFinite(value) ? value : fallback;
}

function getHeatmapMetricValue(day, key, fallbackKey = '') {
    const primaryValue = Number(day && day[key]);
    if (Number.isFinite(primaryValue)) return primaryValue;

    if (fallbackKey) {
        const fallbackValue = Number(day && day[fallbackKey]);
        if (Number.isFinite(fallbackValue)) return fallbackValue;
    }

    return 0;
}

function getLadderMetricValue(char, hashUrl) {
    const profile = char && char.profile ? char.profile : {};
    return hashUrl === 'ladder-pvp'
        ? (profile.honorable_kills || 0)
        : (profile.equipped_item_level || 0);
}

function getLadderTrendValue(char, hashUrl) {
    const profile = char && char.profile ? char.profile : {};
    return hashUrl === 'ladder-pvp'
        ? (profile.trend_pvp || profile.trend_hks || 0)
        : (profile.trend_pve || profile.trend_ilvl || 0);
}

function getProfileClassName(profile) {
    if (!profile) return 'Unknown';

    if (profile.character_class && profile.character_class.name) {
        return typeof profile.character_class.name === 'string'
            ? profile.character_class.name
            : (profile.character_class.name.en_US || 'Unknown');
    }

    return profile.class || 'Unknown';
}

function getClassIcon(className) {
    const clean = className.toLowerCase().replace(/\s/g, '');
    return `https://wow.zamimg.com/images/wow/icons/large/class_${clean}.jpg`;
}

function getSpecIcon(className, specName) {
    if (!specName || specName.trim() === '') return null;
    const icons = {
        "Druid": { "Balance": "spell_nature_starfall", "Feral Combat": "ability_racial_bearform", "Restoration": "spell_nature_healingtouch" },
        "Hunter": { "Beast Mastery": "ability_hunter_beasttaming", "Marksmanship": "ability_hunter_snipershot", "Survival": "ability_hunter_swiftstrike" },
        "Mage": { "Arcane": "spell_holy_magicalsentry", "Fire": "spell_fire_firebolt02", "Frost": "spell_frost_frostbolt02" },
        "Paladin": { "Holy": "spell_holy_holybolt", "Protection": "spell_holy_devotionaura", "Retribution": "spell_holy_auraoflight" },
        "Priest": { "Discipline": "spell_holy_wordfortitude", "Holy": "spell_holy_guardianspirit", "Shadow": "spell_shadow_shadowwordpain" },
        "Rogue": { "Assassination": "ability_rogue_eviscerate", "Combat": "ability_backstab", "Subtlety": "ability_stealth" },
        "Shaman": { "Elemental": "spell_nature_lightning", "Enhancement": "ability_shaman_stormstrike", "Restoration": "spell_nature_magicimmunity" },
        "Warlock": { "Affliction": "spell_shadow_deathcoil", "Demonology": "spell_shadow_requiem", "Destruction": "spell_shadow_rainoffire" },
        "Warrior": { "Arms": "ability_warrior_savageblow", "Fury": "ability_warrior_innerrage", "Protection": "inv_shield_06" },
        "Death Knight": { "Blood": "spell_deathknight_bloodpresence", "Frost": "spell_deathknight_frostpresence", "Unholy": "spell_deathknight_unholypresence" }
    };
    const classIcons = icons[className];
    if (classIcons && classIcons[specName]) {
        return `https://wow.zamimg.com/images/wow/icons/small/${classIcons[specName]}.jpg`;
    }
    return null;
}

function getCharClass(char) {
    if (char.profile && char.profile.character_class && char.profile.character_class.name) {
        return typeof char.profile.character_class.name === 'string' ? char.profile.character_class.name : char.profile.character_class.name.en_US;
    }
    return char.class || 'Unknown';
}

function normalizeHallOfHeroesBadgeType(rawType = '') {
    const cleanType = (rawType || '').toLowerCase().trim();
    if (cleanType === 'hk') return 'hks';
    if (cleanType === 'readiness') return 'readiness';
    return cleanType;
}
