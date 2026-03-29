const CLASS_COLORS = {
    "Druid": "#FF7C0A", "Hunter": "#ABD473", "Mage": "#3FC7EB", 
    "Paladin": "#F48CBA", "Priest": "#FFFFFF", "Rogue": "#FFF468",
    "Shaman": "#0070DE", "Warlock": "#8788EE", "Warrior": "#C69B6D",
    "Death Knight": "#C41E3A"
};
const QUALITY_COLORS = {
    "POOR": "#9d9d9d", "COMMON": "#ffffff", "UNCOMMON": "#1eff00",
    "RARE": "#0070dd", "EPIC": "#a335ee", "LEGENDARY": "#ff8000"
};
const SLOTS = ['HEAD', 'NECK', 'SHOULDER', 'BACK', 'CHEST', 'SHIRT', 'TABARD', 'WRIST', 'HANDS', 'WAIST', 'LEGS', 'FEET', 'FINGER_1', 'FINGER_2', 'TRINKET_1', 'TRINKET_2', 'MAIN_HAND', 'OFF_HAND', 'RANGED'];
const EMPTY_ICONS = {
    'HEAD': 'inventoryslot_head', 'NECK': 'inventoryslot_neck', 'SHOULDER': 'inventoryslot_shoulder',
    'BACK': 'inventoryslot_chest', 'CHEST': 'inventoryslot_chest', 'SHIRT': 'inventoryslot_shirt',
    'TABARD': 'inventoryslot_tabard', 'WRIST': 'inventoryslot_wrists', 'HANDS': 'inventoryslot_hands',
    'WAIST': 'inventoryslot_waist', 'LEGS': 'inventoryslot_legs', 'FEET': 'inventoryslot_feet',
    'FINGER_1': 'inventoryslot_finger', 'FINGER_2': 'inventoryslot_finger', 
    'TRINKET_1': 'inventoryslot_trinket', 'TRINKET_2': 'inventoryslot_trinket',
    'MAIN_HAND': 'inventoryslot_mainhand', 'OFF_HAND': 'inventoryslot_offhand', 'RANGED': 'inventoryslot_ranged'
};
const TBC_XP = {
    1: 400, 2: 900, 3: 1400, 4: 2100, 5: 2800, 6: 3600, 7: 4500, 8: 5400, 9: 6500, 10: 7600,
    11: 8800, 12: 10100, 13: 11400, 14: 12900, 15: 14400, 16: 16000, 17: 17700, 18: 19400, 19: 21300, 20: 23200,
    21: 25200, 22: 27300, 23: 29400, 24: 31700, 25: 34000, 26: 36400, 27: 38900, 28: 41400, 29: 44300, 30: 47400,
    31: 50800, 32: 54500, 33: 58600, 34: 62800, 35: 67100, 36: 71600, 37: 76100, 38: 80800, 39: 85700, 40: 90700,
    41: 95800, 42: 101000, 43: 106300, 44: 111800, 45: 117500, 46: 123200, 47: 129100, 48: 135100, 49: 141200, 50: 147500,
    51: 153900, 52: 160400, 53: 167100, 54: 173900, 55: 180800, 56: 187900, 57: 195000, 58: 202300, 59: 209800,
    60: 494000, 61: 517000, 62: 550000, 63: 587000, 64: 632000, 65: 684000, 66: 745000, 67: 815000, 68: 895000, 69: 985000
};

// --- Helper: Safely Parse Arrays ---
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

// --- Helper: Map Raw Badge Names to Thematic Names ---
function getThematicName(rawName) {
    if (!rawName) return 'Awarded';
    const clean = rawName.toLowerCase().trim();
    const map = {
        'xp': "Hero's Journey",
        'hks': "Blood of the Enemy", // Fixed to match main.py output
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

// --- Helper: Summarize Badges for Tooltips ---
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

// NEW: Added 'async' so we can fetch the external files
window.addEventListener('DOMContentLoaded', async () => {

    const config = JSON.parse(document.getElementById('dashboard-config').textContent);
    const heatmapData = JSON.parse(document.getElementById('heatmap-data').textContent);
    
    // NEW: Download the heavy roster files silently in the background with error handling
    let rosterData = [];
    let rawGuildRoster = [];
    let warEffortLocks = {}; 
    
    // 1. Fetch CRITICAL Roster Data Firstt
    try {
        const cb = new Date().getTime(); // Cache Buster
        const rosterRes = await fetch(`asset/roster.json?t=${cb}`);
        rosterData = await rosterRes.json();
        
        const rawRes = await fetch(`asset/raw_roster.json?t=${cb}`);
        rawGuildRoster = await rawRes.json();
    } catch (error) {
        console.error("Failed to load armory data:", error);
        const loaderText = document.querySelector('.loader-content div');
        if (loaderText) {
            loaderText.style.color = '#e74c3c';
            loaderText.innerHTML = 'Failed to load data. Please refresh.';
        }
        return; // Stop executing to prevent cascading errors
    }

    // 2. Fetch NON-CRITICAL War Effort Locks (Ignore if it fails or is missing)
    try {
        const cb = new Date().getTime();
        const weRes = await fetch(`asset/war_effort.json?t=${cb}`);
        if (weRes.ok) {
            const weData = await weRes.json();
            warEffortLocks = weData.locks || {};
        }
    } catch (error) {
        console.warn("War Effort locks not generated yet. Proceeding with dynamic data.");
    }

    // Hide the loading overlay once data is ready
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.classList.add('hidden');
    
    const active14Days = config.active_14_days;
    const raidReadyCount = config.raid_ready_count;

    const rawDate = new Date(config.last_updated);
    const dateOptions = { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
    const updateTimeEl = document.getElementById("update-time");
    if (updateTimeEl) updateTimeEl.textContent = rawDate.toLocaleString('de-DE', dateOptions) + ' Uhr (CET/CEST)';
    
    let tlTypeFilter = 'rare_plus';
    let tlDateFilter = 'all'; // Start with 7 days to match the heatmap
    let tlSpecificDate = null; 
    window.currentFilteredChars = null;
    window.activeClassExpanded = null;
    let mainDonutChartInstance = null;     
    let conciseDonutChartInstance = null;
    let levelChartInstance = null;
    let ilvlChartInstance = null;
    let raceChartInstance = null;
    let analyticsActivityChartInst = null;
    let analyticsClassChartInst = null;
    window.roleChartInstance = null;
    const analyticsView = document.getElementById('analytics-view');   
    const architectureView = document.getElementById('architecture-view');

    const navbar = document.querySelector('.navbar');
    const emptyState = document.getElementById('empty-state');
    const conciseView = document.getElementById('concise-view');
    const conciseViewTitle = document.getElementById('concise-view-title');
    const conciseList = document.getElementById('concise-char-list');
    const fullCardContainer = document.getElementById('full-card-container');
    const timeline = document.getElementById('timeline');
    const timelineTitle = document.getElementById('timeline-title');
    const tooltip = document.getElementById('custom-tooltip');
    
    function getPowerName(cClass) {
        if (cClass === "Warrior") return "Rage";
        if (cClass === "Rogue") return "Energy";
        return "Mana";
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

    const searchInput = document.getElementById('charSearch');
    const searchAutoComplete = document.getElementById('search-autocomplete');
    
    const heroSearchInput = document.getElementById('heroCharSearch');
    const heroSearchAutoComplete = document.getElementById('hero-search-autocomplete');
    
    if (heroSearchInput) {
        heroSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (query === '') { heroSearchAutoComplete.classList.remove('show'); return; }
            const results = rosterData.filter(c => c.profile && c.profile.name && c.profile.name.toLowerCase().includes(query)).slice(0, 6);
            if (results.length > 0) {
                heroSearchAutoComplete.innerHTML = results.map(c => {
                    const cClass = getCharClass(c);
                    const cHex = CLASS_COLORS[cClass] || '#fff';
                    return `
                        <div class="autocomplete-item hero-ac-item" onclick="selectCharacter('${c.profile.name.toLowerCase()}')" style="border-left-color: ${cHex};">
                            <img src="${c.render_url || getClassIcon(cClass)}" class="ac-icon hero-ac-icon" style="border-color: ${cHex};">
                            <div class="ac-info"><span class="ac-name hero-ac-name" style="color: ${cHex};">${c.profile.name}</span><span class="ac-meta">Level ${c.profile.level} ${cClass}</span></div>
                        </div>`;
                }).join('');
                heroSearchAutoComplete.classList.add('show');
            } else {
                heroSearchAutoComplete.classList.remove('show');
            }
        });
        heroSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.toLowerCase().trim();
                const results = rosterData.filter(c => c.profile && c.profile.name && c.profile.name.toLowerCase().includes(query));
                if (results.length > 0) window.location.hash = results[0].profile.name.toLowerCase();
            }
        });
    }

    // NEW: Force mobile keyboards to open when tapping the collapsed search icon
    const searchBox = document.querySelector('.search-box');
    if (searchBox && searchInput) {
        searchBox.addEventListener('click', () => {
            searchInput.focus();
        });
    }
    
    const customSelect = document.getElementById('customCharSelect');
    const customOptions = document.getElementById('customCharOptions');
    const selectValueText = customSelect ? customSelect.querySelector('.selected-value') : null;

    if (customSelect) {
        customSelect.addEventListener('click', (e) => {
            e.stopPropagation();
            customOptions.classList.toggle('show');
            customSelect.classList.toggle('active');
            if (searchAutoComplete) searchAutoComplete.classList.remove('show');
        });
    }

    document.querySelectorAll('.custom-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const val = opt.getAttribute('data-value');
            window.location.hash = val;
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (query === '') {
                searchAutoComplete.classList.remove('show');
                return;
            }
            
            const results = rosterData.filter(c => c.profile && c.profile.name && c.profile.name.toLowerCase().includes(query)).slice(0, 8);
            
            if (results.length > 0) {
                searchAutoComplete.innerHTML = results.map(c => {
                    const cClass = getCharClass(c);
                    const cHex = CLASS_COLORS[cClass] || '#fff';
                    const iconUrl = c.render_url || getClassIcon(cClass);
                    return `
                        <div class="autocomplete-item" onclick="selectCharacter('${c.profile.name.toLowerCase()}')" style="border-left: 3px solid ${cHex}">
                            <img src="${iconUrl}" class="ac-icon" style="border-color: ${cHex}; object-fit: cover;">
                            <div class="ac-info">
                                <span class="ac-name" style="color: ${cHex};">${c.profile.name}</span>
                                <span class="ac-meta">Level ${c.profile.level} ${cClass}</span>
                            </div>
                        </div>
                    `;
                }).join('');
                searchAutoComplete.classList.add('show');
                if (customOptions) customOptions.classList.remove('show');
            } else {
                searchAutoComplete.innerHTML = `
                    <div class="ac-empty-state">
                        <img src="https://wow.zamimg.com/images/wow/icons/large/inv_misc_head_murloc_01.jpg" loading="lazy" class="ac-empty-icon">
                        <span class="ac-empty-text">No heroes found... Mrgrlrl!</span>
                    </div>`;
                searchAutoComplete.classList.add('show');
            }
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.toLowerCase().trim();
                const results = rosterData.filter(c => c.profile && c.profile.name && c.profile.name.toLowerCase().includes(query));
                if (results.length > 0) {
                    window.location.hash = results[0].profile.name.toLowerCase();
                }
            }
        });
    }

    document.addEventListener('click', () => {
        if (customOptions) customOptions.classList.remove('show');
        if (customSelect) customSelect.classList.remove('active');
        if (searchAutoComplete) searchAutoComplete.classList.remove('show');
    });
    
    function updateDropdownLabel(ignoreVal) {
        if (!selectValueText) return;
        
        // Smarter logic: Read the actual active URL hash to determine the label
        const hash = window.location.hash.substring(1); 
        
        if (hash === '') {
            selectValueText.innerHTML = "Select View...";
        } else if (hash === 'all' || hash === 'total') {
            selectValueText.innerHTML = "🌍 Entire Guild";
        } else if (hash === 'active') {
            selectValueText.innerHTML = "🔥 Active Roster";
        } else if (hash === 'raidready') {
            selectValueText.innerHTML = "⚔️ Raid Ready";
        } else if (hash === 'analytics') {
            selectValueText.innerHTML = "📊 Analytics";
        } else if (hash === 'architecture') {
            selectValueText.innerHTML = "⚙️ Architecture";
        } else if (hash === 'badges') {
            selectValueText.innerHTML = "🌟 Hall of Heroes";
        } else if (hash.startsWith('class-') || hash.startsWith('spec-') || hash.startsWith('filter-')) {
            selectValueText.innerHTML = "⚡ Filter Active";
        } else {
            // It's a specific character
            const char = rosterData.find(c => c.profile && c.profile.name && c.profile.name.toLowerCase() === hash);
            if (char) {
                const cClass = getCharClass(char);
                const cHex = CLASS_COLORS[cClass] || '#fff';
                selectValueText.innerHTML = `<span style="color: ${cHex}; text-shadow: 1px 1px 2px #000;">${char.profile.name}</span>`;
            } else {
                selectValueText.innerHTML = "Select View...";
            }
        }
    }

    const heatmapGrid = document.getElementById('heatmap-grid');
    if (heatmapGrid && heatmapData && heatmapData.length > 0) {

        // --- NEW: Chart.js Line Graph ---
        const ctx = document.getElementById('activityChart');
        if (ctx) {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: heatmapData.map(d => d.day_name),
                    datasets: [
                        {
                            label: 'Loot Drops',
                            data: heatmapData.map(d => d.loot || 0),
                            borderColor: '#a335ee', // Epic Purple
                            backgroundColor: 'rgba(163, 53, 238, 0.1)',
                            borderWidth: 2,
                            pointBackgroundColor: '#a335ee',
                            pointBorderColor: '#fff',
                            tension: 0.3,
                            fill: true,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Level Ups',
                            data: heatmapData.map(d => d.levels || 0),
                            borderColor: '#ffd100', // Gold
                            backgroundColor: 'rgba(255, 209, 0, 0.1)',
                            borderWidth: 2,
                            pointBackgroundColor: '#ffd100',
                            pointBorderColor: '#fff',
                            tension: 0.3,
                            fill: true,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Total Roster',
                            data: heatmapData.map(d => d.total_roster || 0),
                            borderColor: 'rgba(52, 152, 219, 0.3)',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            borderDash: [4, 4],
                            pointRadius: 0,
                            pointHoverRadius: 4,
                            pointBackgroundColor: '#3498db',
                            pointBorderColor: '#fff',
                            tension: 0.3,
                            fill: false,
                            yAxisID: 'y-roster'
                        },
                        {
                            label: 'Active Roster',
                            data: heatmapData.map(d => d.active_roster || 0),
                            borderColor: 'rgba(46, 204, 113, 0.6)',
                            backgroundColor: 'rgba(46, 204, 113, 0.05)',
                            borderWidth: 2,
                            borderDash: [4, 4],
                            pointRadius: 0,
                            pointHoverRadius: 4,
                            pointBackgroundColor: '#2ecc71',
                            pointBorderColor: '#fff',
                            tension: 0.3,
                            fill: true,
                            yAxisID: 'y-roster'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#bbb', font: { family: 'Cinzel' }, boxWidth: 12 } },
                        tooltip: { mode: 'index', intersect: false, backgroundColor: 'rgba(0,0,0,0.8)', titleColor: '#fff', bodyFont: { family: 'Cinzel' } }
                    },
                    scales: {
                        y: { 
                            type: 'linear',
                            position: 'left',
                            beginAtZero: true, 
                            title: { display: true, text: 'Activity Count', color: '#888', font: {family: 'Cinzel'} },
                            ticks: { color: '#888', stepSize: 1, font: {family: 'Cinzel'} }, 
                            grid: { color: 'rgba(255,255,255,0.05)' } 
                        },
                        'y-roster': {
                            type: 'linear',
                            position: 'right',
                            beginAtZero: false, // Setting false so large roster numbers don't compress the lines
                            title: { display: true, text: 'Player Count', color: '#888', font: {family: 'Cinzel'} },
                            ticks: { color: '#888', font: {family: 'Cinzel'} },
                            grid: { drawOnChartArea: false } // Prevents overlapping grid lines
                        },
                        x: { ticks: { color: '#888', font: { family: 'Cinzel', weight: 'bold' } }, grid: { display: false } }
                    },
                    interaction: { mode: 'nearest', axis: 'x', intersect: false }
                }
            });
        }

        // --- Original Heatmap Grid ---
        let heatmapHtml = '';
        
        // Find the absolute highest activity count in the current 7-day window
        const maxCount = Math.max(...heatmapData.map(d => d.count), 1);

        heatmapData.forEach(day => {
            let lvl = 0;
            
            // Assign a heatmap level based on the percentage of the peak day
            if (day.count > 0) {
                const ratio = day.count / maxCount;
                if (ratio > 0.75) lvl = 4;       // Top 25% busiest
                else if (ratio > 0.50) lvl = 3;  // 50% - 75%
                else if (ratio > 0.20) lvl = 2;  // 20% - 50%
                else lvl = 1;                    // Bottom 20% (but still non-zero)
            }
            
            const dateObj = new Date(day.date + 'T00:00:00Z');
            const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            
            heatmapHtml += `
            <div class="heatmap-col" style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                <span class="heatmap-label">${day.day_name}</span>
                <div class="heatmap-cell tt-heatmap" data-lvl="${lvl}" data-date="${dateStr}" data-rawdate="${day.date}" data-count="${day.count}" style="width: 100%; max-width: 60px;"></div>
            </div>`;
        });
        heatmapGrid.innerHTML = heatmapHtml;

        document.querySelectorAll('.tt-heatmap').forEach(cell => {
            cell.addEventListener('click', function() {
                const rawDate = this.getAttribute('data-rawdate');
                if (tlSpecificDate === rawDate) {
                    tlSpecificDate = null;
                    this.classList.remove('selected-date');
                } else {
                    tlSpecificDate = rawDate;
                    document.querySelectorAll('.tt-heatmap').forEach(c => c.classList.remove('selected-date'));
                    this.classList.add('selected-date');
                }
                applyTimelineFilters();
            });

            cell.addEventListener('mousemove', e => {
                const count = cell.getAttribute('data-count');
                const dateStr = cell.getAttribute('data-date');
                const color = count > 0 ? '#ffd100' : '#888';
                
                tooltip.innerHTML = `
                    <div class="tooltip-activity" style="color:${color};">${count} Activities</div>
                    <div class="tooltip-date">${dateStr}</div>
                    <div class="tooltip-hint">Click to filter timeline</div>
                `;
                tooltip.style.borderLeftColor = color;
                
                let x = e.clientX + 15;
                let y = e.clientY + 15;
                
                if (x + 200 > window.innerWidth) {
                    x = window.innerWidth - 210;
                }
                
                tooltip.style.left = `${x}px`; tooltip.style.top = `${y}px`;
                tooltip.classList.add('visible');
            });
            cell.addEventListener('mouseleave', () => {
                tooltip.classList.remove('visible');
            });
        });
    }

    const pveContainer = document.getElementById('pve-leaderboard');
    const pveWrapper = document.getElementById('pve-leaderboard-container');

    const topPve = rosterData
        .filter(c => c.profile && (c.profile.equipped_item_level || 0) > 0)
        .sort((a, b) => (b.profile.equipped_item_level || 0) - (a.profile.equipped_item_level || 0))
        .slice(0, 25);

    if (topPve.length > 0 && pveContainer) {
        pveWrapper.style.display = 'block';
        let pveHTML = '';
        topPve.forEach((char, index) => {
            const p = char.profile;
            const cClass = getCharClass(char);
            const cHex = CLASS_COLORS[cClass] || '#fff';
            const activeSpec = p.active_spec ? p.active_spec : '';
            const specIconUrl = getSpecIcon(cClass, activeSpec);
            const specIconHtml = specIconUrl ? `<img src="${specIconUrl}" class="spec-icon-sm">` : '';
            const displaySpecClass = activeSpec ? `${activeSpec} ${cClass}` : cClass;

            let podiumClass = index === 0 ? 'podium-1' : index === 1 ? 'podium-2' : index === 2 ? 'podium-3' : '';
            const rankColor = index === 0 ? '#ffd100' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#777';
            const rankSize = index < 3 ? '18px' : '15px';
            const portraitURL = char.render_url || getClassIcon(cClass);

            // --- NEW: Trend Arrow Logic for PvE ---
            const trend = p.trend_pve || p.trend_ilvl || 0; 
            let trendHTML = '<span class="trend-indicator trend-neutral">-</span>';
            if (trend > 0) trendHTML = `<span class="trend-indicator trend-positive">▲ ${trend}</span>`;
            else if (trend < 0) trendHTML = `<span class="trend-indicator trend-negative">▼ ${Math.abs(trend)}</span>`;

            pveHTML += `
            <div class="pvp-row tt-char ${podiumClass} leaderboard-row" data-char="${(p.name || '').toLowerCase()}" onclick="selectCharacter('${(p.name || '').toLowerCase()}')" style="border-left-color: ${cHex};">
                <div class="lb-rank" style="color: ${rankColor}; font-size: ${rankSize};">#${index + 1}</div>
                <img src="${portraitURL}" class="lb-portrait" style="border-color: ${cHex};">
                <div class="lb-info">
                    <span class="lb-name" style="color: ${cHex};">${p.name}</span>
                    <span class="lb-spec">${specIconHtml}${displaySpecClass}</span>
                </div>
                <div class="lb-score pve-score">
                    ${p.equipped_item_level || 0} <span class="lb-score-label">iLvl</span>
                    ${trendHTML}
                </div>
            </div>`;
        });
        pveContainer.innerHTML = pveHTML;
    }

    const pvpContainer = document.getElementById('pvp-leaderboard');
    const pvpWrapper = document.getElementById('pvp-leaderboard-container');

    const topPvp = rosterData
        .filter(c => c.profile && (c.profile.honorable_kills || 0) > 0)
        .sort((a, b) => (b.profile.honorable_kills || 0) - (a.profile.honorable_kills || 0))
        .slice(0, 25); // Changed to Top 25

    if (topPvp.length > 0 && pvpContainer) {
        pvpWrapper.style.display = 'block';
        let pvpHTML = '';
        topPvp.forEach((char, index) => {
            const p = char.profile;
            const cClass = getCharClass(char);
            const cHex = CLASS_COLORS[cClass] || '#fff';
            const activeSpec = p.active_spec ? p.active_spec : '';
            const specIconUrl = getSpecIcon(cClass, activeSpec);
            const specIconHtml = specIconUrl ? `<img src="${specIconUrl}" class="spec-icon-sm">` : '';
            const displaySpecClass = activeSpec ? `${activeSpec} ${cClass}` : cClass;

            let podiumClass = index === 0 ? 'podium-1' : index === 1 ? 'podium-2' : index === 2 ? 'podium-3' : '';
            const rankColor = index === 0 ? '#ffd100' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#777';
            const rankSize = index < 3 ? '18px' : '15px';
            const hkCount = (p.honorable_kills || 0).toLocaleString();
            const portraitURL = char.render_url || getClassIcon(cClass);

            // --- Trend Arrow Logic for PvP ---
            const trend = p.trend_pvp || 0; 
            let trendHTML = '<span style="color: #555; font-size: 12px; margin-left: 12px; width: 30px; text-align: right;">-</span>';
            if (trend > 0) trendHTML = `<span style="color: #2ecc71; font-size: 12px; margin-left: 12px; width: 30px; text-align: right;">▲ ${trend}</span>`;
            else if (trend < 0) trendHTML = `<span style="color: #e74c3c; font-size: 12px; margin-left: 12px; width: 30px; text-align: right;">▼ ${Math.abs(trend)}</span>`;

            pvpHTML += `
            <div class="pvp-row tt-char ${podiumClass} leaderboard-row" data-char="${(p.name || '').toLowerCase()}" onclick="selectCharacter('${(p.name || '').toLowerCase()}')" style="border-left-color: ${cHex};">
                <div class="lb-rank" style="color: ${rankColor}; font-size: ${rankSize};">#${index + 1}</div>
                <img src="${portraitURL}" class="lb-portrait" style="border-color: ${cHex};">
                <div class="lb-info">
                    <span class="lb-name" style="color: ${cHex};">${p.name}</span>
                    <span class="lb-spec">${specIconHtml}${displaySpecClass}</span>
                </div>
                <div class="lb-score pvp-score">
                    ${hkCount} <span class="lb-score-label">HKs</span>
                    ${trendHTML}
                </div>
            </div>`;
        });
        pvpContainer.innerHTML = pvpHTML;
    }
    
    setupTooltips();

    // --- Helper: Get Detailed Badge History from Timeline ---
    function getDetailedBadgeTooltip(charName, badgeTypes, baseTitle, actualCount) {
        let tooltip = baseTitle;
        if (!timelineData || timelineData.length === 0 || !charName) return tooltip.replace(/"/g, '&quot;');
        
        let events = timelineData.filter(e => 
            e.type === 'badge' && 
            (e.character_name || '').toLowerCase() === charName.toLowerCase() &&
            badgeTypes.includes(e.badge_type)
        );
        
        if (events.length > 0) {
            events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // Deduplicate identical events from the backend (same badge, same day)
            const uniqueEvents = [];
            const seenKeys = new Set();
            
            events.forEach(e => {
                let dStr = e.timestamp.substring(0, 10);
                // Include the specific category so different campaigns aren't squashed
                const key = `${e.badge_type}_${e.category || ''}_${dStr}`;
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    uniqueEvents.push(e);
                }
            });
            
            events = uniqueEvents;
            
            // Failsafe: Never show more events than the character actually has badges
            if (actualCount !== undefined && actualCount > 0) {
                events = events.slice(0, actualCount);
            }
            
            if (events.length > 0) {
                tooltip += ' \n-------------------\n';
                
                const lineCounts = {};
                events.forEach(e => {
                    let dStr = e.timestamp.substring(0, 10);
                    try {
                        let cleanTs = e.timestamp.replace('Z', '+00:00');
                        if (!cleanTs.includes('+') && !cleanTs.includes('Z')) cleanTs += 'Z';
                        const dt = new Date(cleanTs);
                        if (!isNaN(dt.getTime())) dStr = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                    } catch(err) {}
                    
                    const catName = getThematicName(e.category);
                    const lineStr = `• ${dStr}: ${catName}`;
                    lineCounts[lineStr] = (lineCounts[lineStr] || 0) + 1;
                });

                tooltip += Object.entries(lineCounts).map(([line, count]) => {
                    return count > 1 ? `${line} (x${count})` : line;
                }).join('\n');
            }
        }
        return tooltip.replace(/"/g, '&quot;');
    }

    function renderFullCard(charName) {
        const char = rosterData.find(c => c.profile && c.profile.name && c.profile.name.toLowerCase() === charName);
        if (!char) return "";
        
        const p = char.profile || {};
        const eq = char.equipped || {};
        const st = char.stats || {};
        
        const cClass = getCharClass(char);
        const cHex = CLASS_COLORS[cClass] || "#ffd100";
        const factionType = p.faction && p.faction.type ? p.faction.type : "ALLIANCE";
        const factionCls = factionType === "HORDE" ? "faction-horde" : "faction-alliance";
        const powerCol = cClass === "Warrior" ? "#e74c3c" : "#3498db";
        const powerName = getPowerName(cClass);
        
        const activeSpec = p.active_spec ? p.active_spec : '';
        const specIconUrl = getSpecIcon(cClass, activeSpec);
        const specIconHtml = specIconUrl ? `<img src="${specIconUrl}" style="width: 14px; height: 14px; border-radius: 50%; vertical-align: middle; margin-right: 4px; border: 1px solid rgba(255,255,255,0.2);">` : '';
        const displaySpecClass = activeSpec ? `${activeSpec} ${cClass}` : cClass;

        const health = st.health || 0;
        const power = st.power || 0;
        const strVal = st.strength_effective || ((st.strength && st.strength.effective) || 0);
        const agiVal = st.agility_effective || ((st.agility && st.agility.effective) || 0);
        const staVal = st.stamina_effective || ((st.stamina && st.stamina.effective) || 0);
        const intVal = st.intellect_effective || ((st.intellect && st.intellect.effective) || 0);
        const spiVal = st.spirit_effective || ((st.spirit && st.spirit.effective) || 0);
        const raceName = p.race && p.race.name ? (typeof p.race.name === 'string' ? p.race.name : (p.race.name.en_US || 'Unknown')) : 'Unknown';
        
        // Safely extract stats supporting both the old nested JSON and the new flat Turso schema
        const armor = st.armor_effective || ((st.armor && st.armor.effective) || 0);
        const defense = st.defense_effective || ((st.defense && st.defense.effective) || 0);
        const dodge = st.dodge || ((st.dodge && st.dodge.value) || 0);
        const parry = st.parry || 0;
        const block = st.block || 0;
        
        const ap = st.attack_power || 0;
        const meleeCrit = st.melee_crit_value || ((st.melee_crit && st.melee_crit.value) || 0);
        const meleeHaste = st.melee_haste_value || 0;
        
        const rangedCrit = st.ranged_crit || 0;
        const rangedHaste = st.ranged_haste || 0;
        
        const spellPower = st.spell_power || 0;
        const spellCrit = st.spell_crit_value || ((st.spell_crit && st.spell_crit.value) || 0);
        const spellHaste = st.spell_haste || 0;
        const spellPen = st.spell_penetration || 0;
        
        const manaRegen = st.mana_regen || 0;
        const mp5 = st.mana_regen_combat || 0;

        // Determine logical roles to prevent stat bloat
        const isTank = ["Protection", "Blood"].includes(activeSpec) || (cClass === "Druid" && activeSpec === "Feral Combat") || cClass === "Warrior";
        const isHunter = cClass === "Hunter";
        const isMelee = ["Rogue", "Warrior", "Death Knight"].includes(cClass) || ["Retribution", "Enhancement", "Feral Combat"].includes(activeSpec);
        const isCaster = ["Mage", "Warlock", "Priest"].includes(cClass) || ["Balance", "Elemental", "Restoration", "Holy"].includes(activeSpec) || (cClass === "Paladin" && ["Holy", "Protection"].includes(activeSpec)) || (cClass === "Shaman" && activeSpec !== "Enhancement") || (cClass === "Druid" && activeSpec !== "Feral Combat");

        let advancedStatsHtml = `<div class="stat-divider"></div>`;
        advancedStatsHtml += `<div class="stat-row"><span class="stat-lbl">🛡️ Armor</span><span class="stat-val val-wht">${armor.toLocaleString()}</span></div>`;
        
        // 1. Defenses (Gated to Tanks or High-Defense Off-Tanks)
        if (isTank || defense > 350) {
            if (defense > 0) advancedStatsHtml += `<div class="stat-row"><span class="stat-lbl">🧱 Defense</span><span class="stat-val val-wht">${defense}</span></div>`;
            if (dodge > 0) advancedStatsHtml += `<div class="stat-row"><span class="stat-lbl">🤸 Dodge</span><span class="stat-val val-wht">${dodge.toFixed(2)}%</span></div>`;
            if (parry > 0) advancedStatsHtml += `<div class="stat-row"><span class="stat-lbl">⚔️ Parry</span><span class="stat-val val-wht">${parry.toFixed(2)}%</span></div>`;
            if (block > 0) advancedStatsHtml += `<div class="stat-row"><span class="stat-lbl">🛡️ Block</span><span class="stat-val val-wht">${block.toFixed(2)}%</span></div>`;
        }

        // 2. Physical Offense (Melee & Ranged)
        if (isMelee || isHunter) {
            if (ap > 0) advancedStatsHtml += `<div class="stat-row"><span class="stat-lbl">⚔️ Attack Power</span><span class="stat-val val-org">${ap}</span></div>`;
        }
        if (isMelee) {
            if (meleeCrit > 0) advancedStatsHtml += `<div class="stat-row"><span class="stat-lbl">🩸 Melee Crit</span><span class="stat-val val-red">${meleeCrit.toFixed(2)}%</span></div>`;
            if (meleeHaste > 0) advancedStatsHtml += `<div class="stat-row"><span class="stat-lbl">⚡ Melee Haste</span><span class="stat-val val-red">${meleeHaste.toFixed(2)}%</span></div>`;
        }
        if (isHunter) {
            if (rangedCrit > 0) advancedStatsHtml += `<div class="stat-row"><span class="stat-lbl">🏹 Ranged Crit</span><span class="stat-val val-grn">${rangedCrit.toFixed(2)}%</span></div>`;
            if (rangedHaste > 0) advancedStatsHtml += `<div class="stat-row"><span class="stat-lbl">⚡ Ranged Haste</span><span class="stat-val val-grn">${rangedHaste.toFixed(2)}%</span></div>`;
        }

        // 3. Spellcasting & Healing
        if (isCaster) {
            if (spellPower > 0) advancedStatsHtml += `<div class="stat-row"><span class="stat-lbl">✨ Spell Power</span><span class="stat-val val-blu">${spellPower}</span></div>`;
            if (spellCrit > 0) advancedStatsHtml += `<div class="stat-row"><span class="stat-lbl">🔥 Spell Crit</span><span class="stat-val val-ylw">${spellCrit.toFixed(2)}%</span></div>`;
            if (spellHaste > 0) advancedStatsHtml += `<div class="stat-row"><span class="stat-lbl">⚡ Spell Haste</span><span class="stat-val val-ylw">${spellHaste.toFixed(2)}%</span></div>`;
            if (spellPen > 0) advancedStatsHtml += `<div class="stat-row"><span class="stat-lbl">🌀 Spell Pen</span><span class="stat-val val-blu">${spellPen}</span></div>`;
            if (mp5 > 0) advancedStatsHtml += `<div class="stat-row"><span class="stat-lbl">💧 Mana/5 (Combat)</span><span class="stat-val val-grn">${Math.round(mp5)}</span></div>`;
            else if (manaRegen > 0) advancedStatsHtml += `<div class="stat-row"><span class="stat-lbl">💧 Mana Regen</span><span class="stat-val val-grn">${Math.round(manaRegen)}</span></div>`;
        }

        const hks = p.honorable_kills || 0;
        const hkBadge = hks > 0 ? `<span class="badge" style="background:rgba(0,0,0,0.7); border:1px solid #ff4400; padding:5px 14px; border-radius:20px; font-size:14px; color:#ff4400; box-shadow:0 0 5px rgba(255,68,0,0.5);">⚔️ ${hks.toLocaleString()} HKs</span>` : '';
        
        // --- NEW: Page 2 Weapon & Gear Breakdown ---
        const mhMin = st.main_hand_min || ((st.main_hand_weapon_damage && st.main_hand_weapon_damage.min) || 0);
        const mhMax = st.main_hand_max || ((st.main_hand_weapon_damage && st.main_hand_weapon_damage.max) || 0);
        const mhSpeed = st.main_hand_speed || ((st.main_hand_weapon_damage && st.main_hand_weapon_damage.speed) || 0);
        const mhDps = st.main_hand_dps || ((st.main_hand_weapon_damage && st.main_hand_weapon_damage.dps) || 0);

        const ohMin = st.off_hand_min || ((st.off_hand_weapon_damage && st.off_hand_weapon_damage.min) || 0);
        const ohMax = st.off_hand_max || ((st.off_hand_weapon_damage && st.off_hand_weapon_damage.max) || 0);
        const ohSpeed = st.off_hand_speed || ((st.off_hand_weapon_damage && st.off_hand_weapon_damage.speed) || 0);
        const ohDps = st.off_hand_dps || ((st.off_hand_weapon_damage && st.off_hand_weapon_damage.dps) || 0);

        const strBase = st.strength_base || ((st.strength && st.strength.base) || 0);
        const agiBase = st.agility_base || ((st.agility && st.agility.base) || 0);
        const staBase = st.stamina_base || ((st.stamina && st.stamina.base) || 0);
        const intBase = st.intellect_base || ((st.intellect && st.intellect.base) || 0);
        const spiBase = st.spirit_base || ((st.spirit && st.spirit.base) || 0);

        let weaponStatsHtml = '';
        
        if (mhDps > 0) {
            weaponStatsHtml += `<div style="color:#aaa; font-size:11px; text-transform:uppercase; margin-bottom:4px; letter-spacing:1px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:4px;">Main Hand Weapon</div>`;
            weaponStatsHtml += `<div class="stat-row"><span class="stat-lbl">🗡️ Damage</span><span class="stat-val val-wht">${Math.round(mhMin)} - ${Math.round(mhMax)}</span></div>`;
            weaponStatsHtml += `<div class="stat-row"><span class="stat-lbl">⏱️ Speed</span><span class="stat-val val-wht">${mhSpeed.toFixed(2)}</span></div>`;
            weaponStatsHtml += `<div class="stat-row"><span class="stat-lbl">💥 DPS</span><span class="stat-val val-org">${mhDps.toFixed(1)}</span></div>`;
        }

        if (ohDps > 0) {
            weaponStatsHtml += `<div style="margin-top:12px; color:#aaa; font-size:11px; text-transform:uppercase; margin-bottom:4px; letter-spacing:1px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:4px;">Off Hand Weapon</div>`;
            weaponStatsHtml += `<div class="stat-row"><span class="stat-lbl">🗡️ Damage</span><span class="stat-val val-wht">${Math.round(ohMin)} - ${Math.round(ohMax)}</span></div>`;
            weaponStatsHtml += `<div class="stat-row"><span class="stat-lbl">⏱️ Speed</span><span class="stat-val val-wht">${ohSpeed.toFixed(2)}</span></div>`;
            weaponStatsHtml += `<div class="stat-row"><span class="stat-lbl">💥 DPS</span><span class="stat-val val-org">${ohDps.toFixed(1)}</span></div>`;
        }

        // Show Gear Contribution for Casters or characters lacking weapon API data
        if (mhDps === 0 || isCaster || isTank) {
            weaponStatsHtml += `<div style="margin-top:${mhDps > 0 ? '16px' : '0'}; color:#aaa; font-size:11px; text-transform:uppercase; margin-bottom:4px; letter-spacing:1px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:4px;">Gear Contribution</div>`;
            weaponStatsHtml += `<div class="stat-row"><span class="stat-lbl">🛡️ Stamina</span><span class="stat-val"><span style="color:#888; font-size:11px; margin-right:6px;">${staBase} Base</span> <span style="color:#2ecc71; font-weight:bold;">+${staVal - staBase}</span></span></div>`;
            if (intVal > 0) weaponStatsHtml += `<div class="stat-row"><span class="stat-lbl">🧠 Intellect</span><span class="stat-val"><span style="color:#888; font-size:11px; margin-right:6px;">${intBase} Base</span> <span style="color:#2ecc71; font-weight:bold;">+${intVal - intBase}</span></span></div>`;
            if (spiVal > 0) weaponStatsHtml += `<div class="stat-row"><span class="stat-lbl">✨ Spirit</span><span class="stat-val"><span style="color:#888; font-size:11px; margin-right:6px;">${spiBase} Base</span> <span style="color:#2ecc71; font-weight:bold;">+${spiVal - spiBase}</span></span></div>`;
            if (strVal > 0 && !isCaster) weaponStatsHtml += `<div class="stat-row"><span class="stat-lbl">⚔️ Strength</span><span class="stat-val"><span style="color:#888; font-size:11px; margin-right:6px;">${strBase} Base</span> <span style="color:#2ecc71; font-weight:bold;">+${strVal - strBase}</span></span></div>`;
            if (agiVal > 0 && (!isCaster || isHunter)) weaponStatsHtml += `<div class="stat-row"><span class="stat-lbl">🏹 Agility</span><span class="stat-val"><span style="color:#888; font-size:11px; margin-right:6px;">${agiBase} Base</span> <span style="color:#2ecc71; font-weight:bold;">+${agiVal - agiBase}</span></span></div>`;
        }

        const xp = p.experience || 0;
        const restedXp = p.rested_experience || 0;
        let maxXp = p.next_level_experience || p.experience_max || 0;
        
        if (maxXp <= 0 && p.level < 70) {
            maxXp = TBC_XP[p.level] || 0;
        }
        
        let xpPercent = 100;
        let restedPercent = 0;
        let xpLabel = "Max Level";
        
        if (p.level < 70 && maxXp > 0) {
            xpPercent = Math.min((xp / maxXp) * 100, 100);
            restedPercent = Math.min(((xp + restedXp) / maxXp) * 100, 100);
            if (restedXp > 0) {
                xpLabel = `${xp.toLocaleString()} / ${maxXp.toLocaleString()} XP (+${restedXp.toLocaleString()} Rested)`;
            } else {
                xpLabel = `${xp.toLocaleString()} / ${maxXp.toLocaleString()} XP`;
            }
        }

        let gearHtml = "";
        
        // Items that cannot be traditionally enchanted (ignoring rings to prevent false positives for non-enchanters)
        const UNENCHANTABLE_SLOTS = ['NECK', 'SHIRT', 'TABARD', 'FINGER_1', 'FINGER_2', 'TRINKET_1', 'TRINKET_2'];

        SLOTS.forEach(slot => {
            const data = eq[slot];
            if (data && data.item_id) {
                const q = data.quality || "COMMON", qHex = QUALITY_COLORS[q];
                const hasEnchant = data.tooltip_params && data.tooltip_params.includes('ench=');
                const canBeEnchanted = !UNENCHANTABLE_SLOTS.includes(slot);
                
                let enchantBadge = '';
                let warningStyle = '';
                let warningText = '';

                if (hasEnchant) {
                    enchantBadge = `<div style="position:absolute; bottom:-4px; right:8px; background:#000; border:1px solid #1eff00; color:#1eff00; font-size:9px; font-weight:bold; border-radius:3px; padding:0 4px; z-index:5;">E</div>`;
                } else if (canBeEnchanted && (q === "EPIC" || q === "LEGENDARY")) {
                    // 🔍 OFFICER X-RAY: Flag missing enchants on high-end gear
                    warningStyle = `box-shadow: inset 0 0 15px rgba(231, 76, 60, 0.4); border-left-color: #e74c3c !important;`;
                    warningText = `<div style="color: #e74c3c; font-size: 10px; font-weight: bold; margin-top: 2px; text-shadow: 1px 1px 2px #000;">⚠️ Missing Enchant</div>`;
                }

                gearHtml += `
                <div class="item-slot border-${q}" style="border-left-color:${qHex}; background:rgba(20,20,20,0.9); ${warningStyle}">
                    <div style="position:relative;">
                        <img src="${data.icon_data}" style="border-color:${warningStyle ? '#e74c3c' : qHex};">
                        ${enchantBadge}
                    </div>
                    <div style="display:flex; flex-direction:column; justify-content:center;">
                        <a href="https://www.wowhead.com/wotlk/item=${data.item_id}" class="${q}" data-wowhead="${data.tooltip_params}" target="_blank" style="color:${qHex}; text-decoration: none;">${data.name}</a>
                        ${warningText}
                    </div>
                </div>`;
            } else {
                const emptyIcon = EMPTY_ICONS[slot] || 'inv_misc_questionmark';
                gearHtml += `
                <div class="item-slot empty-slot">
                    <img src="https://wow.zamimg.com/images/wow/icons/large/${emptyIcon}.jpg" class="empty-slot-icon">
                    <span class="empty-slot-text">Empty Slot</span>
                </div>`;
            }
        });

        // --- NEW: Grab the Guild Rank & Badges (Scope-Safe) ---
        const guildRank = p.guild_rank || 'Member';
        const vBadges = safeParseArray(p.vanguard_badges || char.vanguard_badges);
        const cBadges = safeParseArray(p.campaign_badges || char.campaign_badges);
        const prevMvps = config.prev_mvps || {};
        const isPveReigning = prevMvps.pve && prevMvps.pve.name && prevMvps.pve.name.toLowerCase() === charName.toLowerCase();
        const isPvpReigning = prevMvps.pvp && prevMvps.pvp.name && prevMvps.pvp.name.toLowerCase() === charName.toLowerCase();

        const vCount = vBadges.length;
        const cCount = cBadges.length;
        const pveChamp = parseInt(p.pve_champ_count || char.pve_champ_count) || 0;
        const pvpChamp = parseInt(p.pvp_champ_count || char.pvp_champ_count) || 0;
        const pveGold = parseInt(p.pve_gold || char.pve_gold) || 0;
        const pveSilver = parseInt(p.pve_silver || char.pve_silver) || 0;
        const pveBronze = parseInt(p.pve_bronze || char.pve_bronze) || 0;
        const pvpGold = parseInt(p.pvp_gold || char.pvp_gold) || 0;
        const pvpSilver = parseInt(p.pvp_silver || char.pvp_silver) || 0;
        const pvpBronze = parseInt(p.pvp_bronze || char.pvp_bronze) || 0;

        const tPveGold = getDetailedBadgeTooltip(p.name, ['pve_gold'], `${pveGold}x PvE Gold Medal`, pveGold);
        const tPveSilver = getDetailedBadgeTooltip(p.name, ['pve_silver'], `${pveSilver}x PvE Silver Medal`, pveSilver);
        const tPveBronze = getDetailedBadgeTooltip(p.name, ['pve_bronze'], `${pveBronze}x PvE Bronze Medal`, pveBronze);
        const tPvpGold = getDetailedBadgeTooltip(p.name, ['pvp_gold'], `${pvpGold}x PvP Gold Medal`, pvpGold);
        const tPvpSilver = getDetailedBadgeTooltip(p.name, ['pvp_silver'], `${pvpSilver}x PvP Silver Medal`, pvpSilver);
        const tPvpBronze = getDetailedBadgeTooltip(p.name, ['pvp_bronze'], `${pvpBronze}x PvP Bronze Medal`, pvpBronze);
        const tPveChamp = getDetailedBadgeTooltip(p.name, ['mvp_pve'], `${pveChamp}x PvE Champion`, pveChamp);
        const tPvpChamp = getDetailedBadgeTooltip(p.name, ['mvp_pvp'], `${pvpChamp}x PvP Champion`, pvpChamp);
        const tVanguard = getDetailedBadgeTooltip(p.name, ['vanguard'], summarizeBadges(vBadges), vCount);
        const tCampaign = getDetailedBadgeTooltip(p.name, ['campaign'], summarizeBadges(cBadges), cCount);
        
        let extraBadges = '';
        if (isPveReigning) extraBadges += `<span class="badge char-badge" style="background: rgba(255, 209, 0, 0.2); border-color: #ffd100; color: #ffd100; font-weight: bold; box-shadow: 0 0 15px rgba(255, 209, 0, 0.8); animation: pulseGlow 2s infinite alternate;" title="Current Reigning PvE Champion!">👑 Reigning PvE MVP</span>`;
        if (isPvpReigning) extraBadges += `<span class="badge char-badge" style="background: rgba(255, 68, 0, 0.2); border-color: #ff4400; color: #ff4400; font-weight: bold; box-shadow: 0 0 15px rgba(255, 68, 0, 0.8); animation: pulseGlow 2s infinite alternate;" title="Current Reigning PvP Champion!">⚔️ Reigning PvP MVP</span>`;
        
        if (pveGold > 0) extraBadges += `<span class="badge char-badge" style="background: rgba(255, 215, 0, 0.15); border-color: #ffd700; color: #ffd700; font-weight: bold; box-shadow: 0 0 10px rgba(255,215,0,0.5);" title="${tPveGold}">🛡️🥇 PvE Gold x${pveGold}</span>`;
        if (pveSilver > 0) extraBadges += `<span class="badge char-badge" style="background: rgba(192, 192, 192, 0.15); border-color: #c0c0c0; color: #c0c0c0; font-weight: bold; box-shadow: 0 0 10px rgba(192,192,192,0.5);" title="${tPveSilver}">🛡️🥈 PvE Silver x${pveSilver}</span>`;
        if (pveBronze > 0) extraBadges += `<span class="badge char-badge" style="background: rgba(205, 127, 50, 0.15); border-color: #cd7f32; color: #cd7f32; font-weight: bold; box-shadow: 0 0 10px rgba(205,127,50,0.5);" title="${tPveBronze}">🛡️🥉 PvE Bronze x${pveBronze}</span>`;
        if (pvpGold > 0) extraBadges += `<span class="badge char-badge" style="background: rgba(255, 215, 0, 0.15); border-color: #ffd700; color: #ffd700; font-weight: bold; box-shadow: 0 0 10px rgba(255,215,0,0.5);" title="${tPvpGold}">⚔️🥇 PvP Gold x${pvpGold}</span>`;
        if (pvpSilver > 0) extraBadges += `<span class="badge char-badge" style="background: rgba(192, 192, 192, 0.15); border-color: #c0c0c0; color: #c0c0c0; font-weight: bold; box-shadow: 0 0 10px rgba(192,192,192,0.5);" title="${tPvpSilver}">⚔️🥈 PvP Silver x${pvpSilver}</span>`;
        if (pvpBronze > 0) extraBadges += `<span class="badge char-badge" style="background: rgba(205, 127, 50, 0.15); border-color: #cd7f32; color: #cd7f32; font-weight: bold; box-shadow: 0 0 10px rgba(205,127,50,0.5);" title="${tPvpBronze}">⚔️🥉 PvP Bronze x${pvpBronze}</span>`;
        if (pveChamp > 0) extraBadges += `<span class="badge char-badge" style="background: rgba(255, 128, 0, 0.15); border-color: #ff8000; color: #ffad33; font-weight: bold; box-shadow: 0 0 10px rgba(255,128,0,0.5);" title="${tPveChamp}">👑 PvE Champ x${pveChamp}</span>`;
        if (pvpChamp > 0) extraBadges += `<span class="badge char-badge" style="background: rgba(255, 68, 0, 0.15); border-color: #ff4400; color: #ff7733; font-weight: bold; box-shadow: 0 0 10px rgba(255,68,0,0.5);" title="${tPvpChamp}">⚔️ PvP Champ x${pvpChamp}</span>`;
        if (vCount > 0) extraBadges += `<span class="badge char-badge" style="background: rgba(0, 255, 204, 0.15); border-color: #00ffcc; color: #66ffeb; font-weight: bold; box-shadow: 0 0 10px rgba(0,255,204,0.5);" title="${tVanguard}">🌟 Vanguard x${vCount}</span>`;
        if (cCount > 0) extraBadges += `<span class="badge char-badge" style="background: rgba(170, 170, 170, 0.15); border-color: #aaa; color: #ddd; font-weight: bold; box-shadow: 0 0 8px rgba(255,255,255,0.2);" title="${tCampaign}">🎖️ Campaigns x${cCount}</span>`;

        return `
<div class="char-card ${factionCls}" style="border-top-color:${cHex};">
    <div style="text-align:center; margin-bottom:25px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:20px;">
        <h2 style="color:${cHex}; font-family:Cinzel; font-size:38px; margin:0; text-shadow:0 2px 4px #000;">${p.name || 'Unknown'}</h2>
        <div class="char-badges-container">
            <span class="badge char-badge" style="border-color: #ffd100; color: #ffd100; text-shadow: 1px 1px 2px #000;">🛡️ ${guildRank}</span>
            ${extraBadges}
            <span class="badge char-badge default-badge">Level ${p.level || 0}</span>
            <span class="badge char-badge" style="border-color: #ff8000; color: #ff8000;">iLvl ${p.equipped_item_level || 0}</span>
            <span class="badge char-badge default-badge">${raceName}</span>
            <span class="badge char-badge" style="border-color: ${cHex}; color: ${cHex};">${specIconHtml}${displaySpecClass}</span>
            ${hkBadge}
        </div>
        
        <div class="xp-bar-wrapper">
            <div class="xp-bar-rested" style="width: ${restedPercent}%;"></div>
            <div class="xp-bar-earned" style="width: ${xpPercent}%;"></div>
            <div class="xp-bar-label">${xpLabel}</div>
        </div>
    </div>
    
    <div class="card-content-split">
        <div class="card-left-col">
            <div style="text-align:center;">
                <img src="${char.render_url || getClassIcon(cClass)}" style="max-width:180px; width:100%; border-radius:8px; border:2px solid ${cHex}; background:#000; box-shadow:0 6px 12px rgba(0,0,0,0.8); display:block; margin: 0 auto;">
            </div>
            <div class="info-box" style="background:rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:18px;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px; margin-bottom:12px;">
                    <h3 class="stat-card-title" style="color:${cHex}; font-family:Cinzel; font-size:18px; margin:0; text-shadow:1px 1px 2px #000;">Combat Stats</h3>
                    <button onclick="
                        const p = this.parentElement.parentElement;
                        const p1 = p.querySelector('.stat-page-1');
                        const p2 = p.querySelector('.stat-page-2');
                        const title = p.querySelector('.stat-card-title');
                        if(p1.style.display === 'none') {
                            p1.style.display = 'block'; p2.style.display = 'none'; title.innerText = 'Combat Stats'; this.innerText = '▶';
                        } else {
                            p1.style.display = 'none'; p2.style.display = 'block'; title.innerText = 'Weapon & Gear'; this.innerText = '◀';
                        }
                    " style="background:none; border:none; color:#bbb; cursor:pointer; font-size:14px; outline:none; transition:0.2s; padding:0;" onmouseover="this.style.color='#ffd100'" onmouseout="this.style.color='#bbb'">▶</button>
                </div>
                <div class="stat-page-1">
                    <div class="resource-bar"><div class="bar-fill" style="background:linear-gradient(to right, #1d8348, #2ecc71);"></div><span class="bar-text">Health: ${health}</span></div>
                    <div class="resource-bar"><div class="bar-fill" style="background:linear-gradient(to right, ${powerCol}, #0a0a0a);"></div><span class="bar-text">${powerName}: ${power}</span></div>
                    <div style="height:15px;"></div>
                    <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:8px;"><span style="color:#bbb;">⚔️ Strength</span><span style="color:#ff4d4d; font-weight:bold;">${strVal}</span></div>
                    <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:8px;"><span style="color:#bbb;">🏹 Agility</span><span style="color:#2ecc71; font-weight:bold;">${agiVal}</span></div>
                    <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:8px;"><span style="color:#bbb;">🛡️ Stamina</span><span style="color:#f1c40f; font-weight:bold;">${staVal}</span></div>
                    <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:8px;"><span style="color:#bbb;">🧠 Intellect</span><span style="color:#3498db; font-weight:bold;">${intVal}</span></div>
                    <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:8px;"><span style="color:#bbb;">✨ Spirit</span><span style="color:#9b59b6; font-weight:bold;">${spiVal}</span></div>
                    ${advancedStatsHtml}
                </div>
                <div class="stat-page-2" style="display:none; animation: fadeIn 0.3s;">
                    ${weaponStatsHtml}
                </div>
            </div>
        </div>
        <div class="gear-grid-container">
            ${gearHtml}
        </div>
    </div>
</div>`;
    }

    function renderDynamicBadges(characters, isRawMode) {
        const container = document.getElementById('concise-class-badges');
        
        let specContainer = document.getElementById('concise-spec-container');
        if (!specContainer) {
            specContainer = document.createElement('div');
            specContainer.id = 'concise-spec-container';
            specContainer.style.display = 'none';
            specContainer.style.textAlign = 'center';
            specContainer.style.marginBottom = '20px';
            specContainer.style.animation = 'fadeInUp 0.3s forwards';
            container.parentNode.appendChild(specContainer); 
        } else {
            specContainer.style.display = 'none';
        }

        if (!characters || characters.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        const counts = {};
        characters.forEach(char => {
            let cClass = 'Unknown';
            if (isRawMode) {
                const deepChar = rosterData.find(c => c.profile && c.profile.name && c.profile.name.toLowerCase() === char.name.toLowerCase());
                if (deepChar) cClass = getCharClass(deepChar);
                else cClass = char.class || 'Unknown';
            } else {
                cClass = getCharClass(char);
            }
            counts[cClass] = (counts[cClass] || 0) + 1;
        });
        
        const sortedClasses = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
        
        let html = '';
        sortedClasses.forEach(cls => {
            if (cls === 'Unknown') return;
            const color = CLASS_COLORS[cls] || '#fff';
            html += `
            <div class="stat-badge dynamic-badge" data-class="${cls}" style="border-color: ${color}; cursor: pointer;" title="Filter ${cls}s">
              <span class="stat-badge-cls" style="color: ${color};">${cls}</span>
              <span class="stat-badge-count">${counts[cls]}</span>
            </div>`;
        });
        
        container.innerHTML = html;
        container.style.display = 'flex';
        
        document.querySelectorAll('.dynamic-badge').forEach(badge => {
            badge.addEventListener('click', function() {
                const targetClass = this.getAttribute('data-class');
                const isActive = this.classList.contains('active-filter');
                
                document.querySelectorAll('.dynamic-badge').forEach(b => {
                    b.classList.remove('active-filter');
                    b.style.opacity = '0.4';
                    b.style.transform = 'scale(1)';
                });
                
                // Trigger smooth fade-in animation
                const charList = document.getElementById('concise-char-list');
                if (charList) {
                    charList.classList.remove('animate-list-update');
                    void charList.offsetWidth; // Force a browser reflow
                    charList.classList.add('animate-list-update');
                }

                if (isActive) {
                    document.querySelectorAll('.concise-char-bar').forEach(el => el.style.display = 'flex');
                    document.querySelectorAll('.dynamic-badge').forEach(b => b.style.opacity = '1');
                    specContainer.style.display = 'none';
                    
                    window.currentFilteredChars = characters.map(c => (c.profile && c.profile.name ? c.profile.name.toLowerCase() : (c.name ? c.name.toLowerCase() : '')));
                    applyTimelineFilters();
                } else {
                    this.classList.add('active-filter');
                    this.style.opacity = '1';
                    this.style.transform = 'scale(1.05)';
                    
                    const visibleChars = [];
                    document.querySelectorAll('.concise-char-bar').forEach(el => {
                        const charName = el.getAttribute('data-char');
                        if (el.getAttribute('data-class') === targetClass) {
                            el.style.display = 'flex';
                            if(charName) visibleChars.push(charName);
                        } else {
                            el.style.display = 'none';
                        }
                    });
                    
                    window.currentFilteredChars = visibleChars;
                    applyTimelineFilters();

                    const formattedClass = targetClass.charAt(0).toUpperCase() + targetClass.slice(1);
                    const cHex = CLASS_COLORS[formattedClass] || '#fff';

                    const classRoster = characters.filter(c => {
                        let cClass = isRawMode ? (rosterData.find(deep => deep.profile && deep.profile.name && deep.profile.name.toLowerCase() === c.name.toLowerCase()) ? getCharClass(rosterData.find(deep => deep.profile && deep.profile.name && deep.profile.name.toLowerCase() === c.name.toLowerCase())) : c.class) : getCharClass(c);
                        return cClass === targetClass;
                    });

                    const specCounts = {};
                    let unspeccedCount = 0;

                    classRoster.forEach(char => {
                        let spec = null;
                        if (isRawMode) {
                            const deepChar = rosterData.find(deep => deep.profile && deep.profile.name && deep.profile.name.toLowerCase() === char.name.toLowerCase());
                            if (deepChar && deepChar.profile) spec = deepChar.profile.active_spec;
                        } else {
                            spec = char.profile.active_spec;
                        }

                        if (spec) {
                            specCounts[spec] = (specCounts[spec] || 0) + 1;
                        } else {
                            unspeccedCount++;
                        }
                    });

                    let specHtml = `<div class="class-stat-container spec-filter-wrapper">`;

                    specHtml += `
                        <div class="stat-badge spec-btn concise-spec-btn" data-spec="all" style="border-color: ${cHex}; cursor: pointer; transform: scale(0.95); background: rgba(255,255,255,0.05);" title="View all ${formattedClass}s">
                            <span class="stat-badge-cls" style="color: ${cHex};">All ${formattedClass}s</span>
                            <span class="stat-badge-count">${classRoster.length}</span>
                        </div>`;

                    Object.keys(specCounts).sort().forEach(spec => {
                        const iconUrl = getSpecIcon(formattedClass, spec);
                        const iconHtml = iconUrl ? `<img src="${iconUrl}" style="width:16px; height:16px; border-radius:50%; vertical-align:middle; margin-right:5px; border: 1px solid #222;">` : '';
                        specHtml += `
                        <div class="stat-badge spec-btn concise-spec-btn" data-spec="${spec}" style="border-color: ${cHex}; cursor: pointer; transform: scale(0.95);" title="View ${spec} ${formattedClass}s">
                            <span class="stat-badge-cls" style="color: ${cHex}; display: flex; align-items: center;">${iconHtml}${spec}</span>
                            <span class="stat-badge-count">${specCounts[spec]}</span>
                        </div>`;
                    });

                    if (unspeccedCount > 0) {
                         specHtml += `
                        <div class="stat-badge spec-btn concise-spec-btn" data-spec="unspecced" style="border-color: #888; cursor: pointer; transform: scale(0.95);" title="View Unspecced ${formattedClass}s">
                            <span class="stat-badge-cls" style="color: #888;">Unspecced</span>
                            <span class="stat-badge-count">${unspeccedCount}</span>
                        </div>`;
                    }

                    specHtml += `</div>`;
                    specContainer.innerHTML = specHtml;
                    specContainer.style.display = 'block';

                    document.querySelectorAll('.concise-spec-btn').forEach(specBtn => {
                        specBtn.addEventListener('click', function() {
                            const targetSpec = this.getAttribute('data-spec');
                            const subVisibleChars = []; 
                            
                            // Trigger smooth fade-in animation for spec clicks
                            const charList = document.getElementById('concise-char-list');
                            if (charList) {
                                charList.classList.remove('animate-list-update');
                                void charList.offsetWidth; // Force a browser reflow
                                charList.classList.add('animate-list-update');
                            }
                            
                            document.querySelectorAll('.concise-char-bar').forEach(el => {
                                const charName = el.getAttribute('data-char');
                                if (el.getAttribute('data-class') === targetClass) {
                                    if (targetSpec === 'all') {
                                        el.style.display = 'flex';
                                        if(charName) subVisibleChars.push(charName);
                                    } else {
                                        const elSpec = el.getAttribute('data-spec') || 'unspecced';
                                        if (elSpec === targetSpec) {
                                            el.style.display = 'flex';
                                            if(charName) subVisibleChars.push(charName);
                                        } else {
                                            el.style.display = 'none';
                                        }
                                    }
                                } else {
                                    el.style.display = 'none';
                                }
                            });
                            
                            window.currentFilteredChars = subVisibleChars;
                            applyTimelineFilters();
                        });
                    });

                }
            });
        });
    }

    function renderAwardFilterBadges(characters, isRawMode) {
        const container = document.getElementById('concise-class-badges');
        const specContainer = document.getElementById('concise-spec-container');
        if (specContainer) specContainer.style.display = 'none';

        if (!characters || characters.length === 0) {
            container.style.display = 'none';
            return;
        }

        const counts = { 'mvp_pve': 0, 'mvp_pvp': 0, 'vanguard': 0, 'campaign': 0, 'pve_gold': 0, 'pve_silver': 0, 'pve_bronze': 0, 'pvp_gold': 0, 'pvp_silver': 0, 'pvp_bronze': 0 };
        characters.forEach(char => {
            const p = isRawMode ? (rosterData.find(deep => deep.profile && deep.profile.name && deep.profile.name.toLowerCase() === char.name.toLowerCase())?.profile) : char.profile;
            const c = isRawMode ? (rosterData.find(deep => deep.profile && deep.profile.name && deep.profile.name.toLowerCase() === char.name.toLowerCase()) || char) : char;
            if (!p && !c) return;

            if (parseInt(p?.pve_champ_count || c?.pve_champ_count) > 0) counts['mvp_pve']++;
            if (parseInt(p?.pvp_champ_count || c?.pvp_champ_count) > 0) counts['mvp_pvp']++;
            if (safeParseArray(p?.vanguard_badges || c?.vanguard_badges).length > 0) counts['vanguard']++;
            if (safeParseArray(p?.campaign_badges || c?.campaign_badges).length > 0) counts['campaign']++;
            if (parseInt(p?.pve_gold || c?.pve_gold) > 0) counts['pve_gold']++;
            if (parseInt(p?.pve_silver || c?.pve_silver) > 0) counts['pve_silver']++;
            if (parseInt(p?.pve_bronze || c?.pve_bronze) > 0) counts['pve_bronze']++;
            if (parseInt(p?.pvp_gold || c?.pvp_gold) > 0) counts['pvp_gold']++;
            if (parseInt(p?.pvp_silver || c?.pvp_silver) > 0) counts['pvp_silver']++;
            if (parseInt(p?.pvp_bronze || c?.pvp_bronze) > 0) counts['pvp_bronze']++;
        });

        const AWARD_DEFS = {
            'mvp_pve': { label: 'PvE MVP', icon: '👑', color: '#ff8000' },
            'mvp_pvp': { label: 'PvP MVP', icon: '⚔️', color: '#ff4400' },
            'pve_gold': { label: 'PvE Gold', icon: '🥇', color: '#ffd700' },
            'pvp_gold': { label: 'PvP Gold', icon: '🥇', color: '#ffd700' },
            'pve_silver': { label: 'PvE Silver', icon: '🥈', color: '#c0c0c0' },
            'pvp_silver': { label: 'PvP Silver', icon: '🥈', color: '#c0c0c0' },
            'pve_bronze': { label: 'PvE Bronze', icon: '🥉', color: '#cd7f32' },
            'pvp_bronze': { label: 'PvP Bronze', icon: '🥉', color: '#cd7f32' },
            'vanguard': { label: 'Vanguards', icon: '🌟', color: '#00ffcc' },
            'campaign': { label: 'Campaigns', icon: '🎖️', color: '#aaa' }
        };

        let html = '';
        Object.keys(AWARD_DEFS).forEach(key => {
            if (counts[key] > 0) {
                const def = AWARD_DEFS[key];
                html += `
                <div class="stat-badge dynamic-award-badge" data-award="${key}" style="border-color: ${def.color}; cursor: pointer; padding: 8px 12px; min-width: 100px;" title="Filter ${def.label}">
                  <span class="stat-badge-cls" style="color: ${def.color}; font-size: 11px;">${def.icon} ${def.label}</span>
                  <span class="stat-badge-count" style="font-size: 16px;">${counts[key]}</span>
                </div>`;
            }
        });

        container.innerHTML = html;
        container.style.display = 'flex';

        document.querySelectorAll('.dynamic-award-badge').forEach(badge => {
            badge.addEventListener('click', function() {
                const targetAward = this.getAttribute('data-award');
                const isActive = this.classList.contains('active-filter');
                
                document.querySelectorAll('.dynamic-award-badge').forEach(b => {
                    b.classList.remove('active-filter');
                    b.style.opacity = '0.4';
                    b.style.transform = 'scale(1)';
                });
                
                const charList = document.getElementById('concise-char-list');
                if (charList) {
                    charList.classList.remove('animate-list-update');
                    void charList.offsetWidth; 
                    charList.classList.add('animate-list-update');
                }

                if (isActive) {
                    document.querySelectorAll('.concise-char-bar').forEach(el => el.style.display = 'flex');
                    document.querySelectorAll('.dynamic-award-badge').forEach(b => b.style.opacity = '1');
                    window.currentFilteredChars = null; 
                    applyTimelineFilters();
                } else {
                    this.classList.add('active-filter');
                    this.style.opacity = '1';
                    this.style.transform = 'scale(1.05)';
                    
                    const visibleChars = [];
                    document.querySelectorAll('.concise-char-bar').forEach(el => {
                        const awards = el.getAttribute('data-awards') || '';
                        if (awards.includes(targetAward)) {
                            el.style.display = 'flex';
                            const charName = el.getAttribute('data-char');
                            if(charName) visibleChars.push(charName);
                        } else {
                            el.style.display = 'none';
                        }
                    });
                    window.currentFilteredChars = visibleChars;
                    applyTimelineFilters();
                }
            });
        });
    }

    // Variable to track current sort method
    let currentSortMethod = 'level';

    function renderConciseList(title, characters, isRawMode = false) {
        conciseViewTitle.textContent = title;

        // Apply Sorting before mapping HTML
        let sortedCharacters = [...characters];
        const hashUrl = window.location.hash.substring(1);

        sortedCharacters.sort((a, b) => {
            let valA, valB;
            
            // Handle Raw vs Full data structures
            const profA = isRawMode ? (rosterData.find(c => c.profile && c.profile.name === a.name)?.profile || a) : (a.profile || a);
            const profB = isRawMode ? (rosterData.find(c => c.profile && c.profile.name === b.name)?.profile || b) : (b.profile || b);
            const nameA = (profA.name || '').toLowerCase();
            const nameB = (profB.name || '').toLowerCase();

            // Override sorting for ALL War Effort challenges
            if (hashUrl.startsWith('war-effort-')) {
                const type = hashUrl.replace('war-effort-', '');
                
                // --- NEW: FORCE VANGUARDS TO HOLD TOP 3 RANKS ---
                if (window.warEffortVanguards && window.warEffortVanguards[type]) {
                    const vanguards = window.warEffortVanguards[type];
                    const idxA = vanguards.indexOf(nameA);
                    const idxB = vanguards.indexOf(nameB);
                    
                    // If both are Vanguards, keep their locked 1st/2nd/3rd order
                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    // If only A is a Vanguard, A wins
                    if (idxA !== -1) return -1;
                    // If only B is a Vanguard, B wins
                    if (idxB !== -1) return 1;
                }
                
                if (hashUrl === 'war-effort-xp' && window.warEffortContext) {
                    valA = window.warEffortContext[nameA] || 0;
                    valB = window.warEffortContext[nameB] || 0;
                    return valB - valA; // High to Low Contributions
                } else if (hashUrl === 'war-effort-zenith' && window.warEffortContextRaw) {
                    valA = window.warEffortContextRaw[nameA] || Infinity;
                    valB = window.warEffortContextRaw[nameB] || Infinity;
                    return valA - valB; // Low to High (Earliest to hit 70 wins!)
                } else if (hashUrl === 'war-effort-loot' && window.warEffortContext) {
                    valA = window.warEffortContext[nameA] ? window.warEffortContext[nameA].length : 0;
                    valB = window.warEffortContext[nameB] ? window.warEffortContext[nameB].length : 0;
                    return valB - valA; // High to Low Contributions (Array length)
                } else if (hashUrl === 'war-effort-hk') {
                    valA = profA.trend_pvp || profA.trend_hks || 0;
                    valB = profB.trend_pvp || profB.trend_hks || 0;
                    return valB - valA; // High to Low Contributions
                }
            }

            if (currentSortMethod === 'ilvl') {
                valA = profA.equipped_item_level || 0;
                valB = profB.equipped_item_level || 0;
                return valB - valA; // High to Low
            } else if (currentSortMethod === 'level') {
                valA = profA.level || 0;
                valB = profB.level || 0;
                return valB - valA; // High to Low
            } else if (currentSortMethod === 'hks') {
                valA = profA.honorable_kills || 0;
                valB = profB.honorable_kills || 0;
                return valB - valA; // High to Low
            } else if (currentSortMethod === 'name') {
                return nameA.localeCompare(nameB); // A to Z
            } else if (currentSortMethod === 'badges') {
                // --- NEW: Sort by Total Badge Count ---
                const getScore = (prof) => {
                    const vCount = safeParseArray(prof.vanguard_badges).length;
                    const cCount = safeParseArray(prof.campaign_badges).length;
                    const pve = parseInt(prof.pve_champ_count) || 0;
                    const pvp = parseInt(prof.pvp_champ_count) || 0;
                    return vCount + cCount + pve + pvp;
                };
                return getScore(profB) - getScore(profA); // High to Low
            }
            return 0;
        });

        // Add Sorting Dropdown UI to the top of the list
        let sortUI = '';
        if (hashUrl === 'badges' || currentSortMethod === 'badges') {
            sortUI = `
                <div class="sort-controls" style="animation: fadeIn 0.3s forwards;">
                    <span style="color: #888; font-size: 14px;">Sort By:</span>
                    <select id="concise-sort-dropdown" class="sort-select">
                        <option value="badges" ${currentSortMethod === 'badges' ? 'selected' : ''}>Total Badges</option>
                        <option value="name" ${currentSortMethod === 'name' ? 'selected' : ''}>Name (A-Z)</option>
                    </select>
                </div>
            `;
        } else if (!hashUrl.startsWith('war-effort-')) {
            sortUI = `
                <div class="sort-controls" style="animation: fadeIn 0.3s forwards;">
                    <span style="color: #888; font-size: 14px;">Sort By:</span>
                    <select id="concise-sort-dropdown" class="sort-select">
                        <option value="ilvl" ${currentSortMethod === 'ilvl' ? 'selected' : ''}>Item Level</option>
                        <option value="level" ${currentSortMethod === 'level' ? 'selected' : ''}>Character Level</option>
                        <option value="hks" ${currentSortMethod === 'hks' ? 'selected' : ''}>Honorable Kills</option>
                        <option value="name" ${currentSortMethod === 'name' ? 'selected' : ''}>Name (A-Z)</option>
                    </select>
                </div>
            `;
        }

        // Generate the HTML for the list
        let listHTML = sortedCharacters.map((char, index) => {
            let statLabel = currentSortMethod === 'hks' ? 'HKs' : 'iLvl';
            
            // 1. Identify if we have a deep profile
            let deepChar = isRawMode ? rosterData.find(c => c.profile && c.profile.name && c.profile.name.toLowerCase() === char.name.toLowerCase()) : char;
            
            // 2. Setup Variables
            let isClickable = false;
            let cleanName = ''; // <--- NEW: Strict logic name
            let displayName, cClass, raceName, cHex, portraitURL, level;
            let activeSpecAttr = 'unspecced';
            let specIconHtml = '';
            let displaySpecClass = '';
            let statValue = '???';
            let statColor = 'color:#666;';
            let trendHTML = '';
            let awardsAttr = [];

            // 3. Populate Variables
            if (deepChar && deepChar.profile) {
                const p = deepChar.profile;
                isClickable = true;
                
                const guildRank = p.guild_rank || 'Member';
                const vBadges = safeParseArray(p.vanguard_badges || char.vanguard_badges || deepChar.vanguard_badges);
                const cBadges = safeParseArray(p.campaign_badges || char.campaign_badges || deepChar.campaign_badges);
                const vCount = vBadges.length;
                const cCount = cBadges.length;
                const pveChamp = parseInt(p.pve_champ_count || char.pve_champ_count || deepChar.pve_champ_count) || 0;
                const pvpChamp = parseInt(p.pvp_champ_count || char.pvp_champ_count || deepChar.pvp_champ_count) || 0;
                const pveGold = parseInt(p.pve_gold || char.pve_gold || deepChar.pve_gold) || 0;
                const pveSilver = parseInt(p.pve_silver || char.pve_silver || deepChar.pve_silver) || 0;
                const pveBronze = parseInt(p.pve_bronze || char.pve_bronze || deepChar.pve_bronze) || 0;
                const pvpGold = parseInt(p.pvp_gold || char.pvp_gold || deepChar.pvp_gold) || 0;
                const pvpSilver = parseInt(p.pvp_silver || char.pvp_silver || deepChar.pvp_silver) || 0;
                const pvpBronze = parseInt(p.pvp_bronze || char.pvp_bronze || deepChar.pvp_bronze) || 0;

                const prevMvps = config.prev_mvps || {};
                const isPveReigning = prevMvps.pve && prevMvps.pve.name && prevMvps.pve.name.toLowerCase() === cleanName;
                const isPvpReigning = prevMvps.pvp && prevMvps.pvp.name && prevMvps.pvp.name.toLowerCase() === cleanName;

                // 1. Build the data-awards attribute for the Bubbles
                if (pveGold > 0) awardsAttr.push('pve_gold');
                if (pveSilver > 0) awardsAttr.push('pve_silver');
                if (pveBronze > 0) awardsAttr.push('pve_bronze');
                if (pvpGold > 0) awardsAttr.push('pvp_gold');
                if (pvpSilver > 0) awardsAttr.push('pvp_silver');
                if (pvpBronze > 0) awardsAttr.push('pvp_bronze');
                if (pveChamp > 0) awardsAttr.push('mvp_pve');
                if (pvpChamp > 0) awardsAttr.push('mvp_pvp');
                if (vCount > 0) awardsAttr.push('vanguard');
                if (cCount > 0) awardsAttr.push('campaign');

                // 2. Generate the dynamic date tooltips
                const tPveGold = getDetailedBadgeTooltip(p.name, ['pve_gold'], `${pveGold}x PvE Gold Medal`, pveGold);
                const tPveSilver = getDetailedBadgeTooltip(p.name, ['pve_silver'], `${pveSilver}x PvE Silver Medal`, pveSilver);
                const tPveBronze = getDetailedBadgeTooltip(p.name, ['pve_bronze'], `${pveBronze}x PvE Bronze Medal`, pveBronze);
                const tPvpGold = getDetailedBadgeTooltip(p.name, ['pvp_gold'], `${pvpGold}x PvP Gold Medal`, pvpGold);
                const tPvpSilver = getDetailedBadgeTooltip(p.name, ['pvp_silver'], `${pvpSilver}x PvP Silver Medal`, pvpSilver);
                const tPvpBronze = getDetailedBadgeTooltip(p.name, ['pvp_bronze'], `${pvpBronze}x PvP Bronze Medal`, pvpBronze);
                const tPveChamp = getDetailedBadgeTooltip(p.name, ['mvp_pve'], `${pveChamp}x PvE Champion`, pveChamp);
                const tPvpChamp = getDetailedBadgeTooltip(p.name, ['mvp_pvp'], `${pvpChamp}x PvP Champion`, pvpChamp);
                const tVanguard = getDetailedBadgeTooltip(p.name, ['vanguard'], summarizeBadges(vBadges), vCount);
                const tCampaign = getDetailedBadgeTooltip(p.name, ['campaign'], summarizeBadges(cBadges), cCount);

                // 3. Inject them into the HTML
                let cBadgesHtml = '<div style="display:inline-flex; gap:4px; margin-left:8px; vertical-align:middle;">';
                
                if (isPveReigning) cBadgesHtml += `<span style="display:inline-flex; align-items:center; background:rgba(255, 209, 0, 0.25); border:1px solid #ffd100; color:#ffd100; font-size:10px; font-weight:bold; padding:1px 6px; border-radius:4px; box-shadow: 0 0 8px rgba(255,209,0,0.6);" title="Current Reigning PvE Champion!">👑 Reigning MVP</span>`;
                if (isPvpReigning) cBadgesHtml += `<span style="display:inline-flex; align-items:center; background:rgba(255, 68, 0, 0.25); border:1px solid #ff4400; color:#ff4400; font-size:10px; font-weight:bold; padding:1px 6px; border-radius:4px; box-shadow: 0 0 8px rgba(255,68,0,0.6);" title="Current Reigning PvP Champion!">⚔️ Reigning MVP</span>`;
                
                if (pveGold > 0) cBadgesHtml += `<span style="display:inline-flex; align-items:center; background:rgba(255, 215, 0, 0.15); border:1px solid rgba(255, 215, 0, 0.4); color:#ffd700; font-size:10px; font-weight:bold; padding:1px 4px; border-radius:4px;" title="${tPveGold}">🛡️🥇 ${pveGold}</span>`;
                if (pveSilver > 0) cBadgesHtml += `<span style="display:inline-flex; align-items:center; background:rgba(192, 192, 192, 0.15); border:1px solid rgba(192, 192, 192, 0.4); color:#c0c0c0; font-size:10px; font-weight:bold; padding:1px 4px; border-radius:4px;" title="${tPveSilver}">🛡️🥈 ${pveSilver}</span>`;
                if (pveBronze > 0) cBadgesHtml += `<span style="display:inline-flex; align-items:center; background:rgba(205, 127, 50, 0.15); border:1px solid rgba(205, 127, 50, 0.4); color:#cd7f32; font-size:10px; font-weight:bold; padding:1px 4px; border-radius:4px;" title="${tPveBronze}">🛡️🥉 ${pveBronze}</span>`;
                if (pvpGold > 0) cBadgesHtml += `<span style="display:inline-flex; align-items:center; background:rgba(255, 215, 0, 0.15); border:1px solid rgba(255, 215, 0, 0.4); color:#ffd700; font-size:10px; font-weight:bold; padding:1px 4px; border-radius:4px;" title="${tPvpGold}">⚔️🥇 ${pvpGold}</span>`;
                if (pvpSilver > 0) cBadgesHtml += `<span style="display:inline-flex; align-items:center; background:rgba(192, 192, 192, 0.15); border:1px solid rgba(192, 192, 192, 0.4); color:#c0c0c0; font-size:10px; font-weight:bold; padding:1px 4px; border-radius:4px;" title="${tPvpSilver}">⚔️🥈 ${pvpSilver}</span>`;
                if (pvpBronze > 0) cBadgesHtml += `<span style="display:inline-flex; align-items:center; background:rgba(205, 127, 50, 0.15); border:1px solid rgba(205, 127, 50, 0.4); color:#cd7f32; font-size:10px; font-weight:bold; padding:1px 4px; border-radius:4px;" title="${tPvpBronze}">⚔️🥉 ${pvpBronze}</span>`;
                if (pveChamp > 0) cBadgesHtml += `<span style="display:inline-flex; align-items:center; background:rgba(255, 128, 0, 0.15); border:1px solid rgba(255, 128, 0, 0.4); color:#ffad33; font-size:10px; font-weight:bold; padding:1px 4px; border-radius:4px;" title="${tPveChamp}">👑 ${pveChamp}</span>`;
                if (pvpChamp > 0) cBadgesHtml += `<span style="display:inline-flex; align-items:center; background:rgba(255, 68, 0, 0.15); border:1px solid rgba(255, 68, 0, 0.4); color:#ff7733; font-size:10px; font-weight:bold; padding:1px 4px; border-radius:4px;" title="${tPvpChamp}">⚔️ ${pvpChamp}</span>`;
                if (vCount > 0) cBadgesHtml += `<span style="display:inline-flex; align-items:center; background:rgba(0, 255, 204, 0.15); border:1px solid rgba(0, 255, 204, 0.4); color:#66ffeb; font-size:10px; font-weight:bold; padding:1px 4px; border-radius:4px;" title="${tVanguard}">🌟 ${vCount}</span>`;
                if (cCount > 0) cBadgesHtml += `<span style="display:inline-flex; align-items:center; background:rgba(170, 170, 170, 0.15); border:1px solid rgba(170, 170, 170, 0.4); color:#ddd; font-size:10px; font-weight:bold; padding:1px 4px; border-radius:4px;" title="${tCampaign}">🎖️ ${cCount}</span>`;
                cBadgesHtml += '</div>';

                cleanName = (p.name || 'Unknown').toLowerCase();
                displayName = (p.name || 'Unknown') + cBadgesHtml;
                cClass = getCharClass(deepChar);
                raceName = p.race && p.race.name ? (typeof p.race.name === 'string' ? p.race.name : (p.race.name.en_US || 'Unknown')) : 'Unknown';
                cHex = CLASS_COLORS[cClass] || "#fff";
                portraitURL = deepChar.render_url || getClassIcon(cClass);
                level = p.level || 0;
                
                const activeSpec = p.active_spec ? p.active_spec : '';
                activeSpecAttr = activeSpec ? activeSpec : 'unspecced';
                const specIconUrl = getSpecIcon(cClass, activeSpec);
                specIconHtml = specIconUrl ? `<img src="${specIconUrl}" style="width: 14px; height: 14px; border-radius: 50%; vertical-align: middle; margin-right: 3px; border: 1px solid #222;">` : '';
                displaySpecClass = activeSpec ? `${activeSpec} ${cClass}` : cClass;
                
                statValue = currentSortMethod === 'hks' ? (p.honorable_kills || 0).toLocaleString() : (p.equipped_item_level || 0);
                statColor = currentSortMethod === 'hks' ? 'color: #ff4400;' : '';

                // Calculate Trend based on the current ladder view
                if (currentSortMethod === 'hks' || currentSortMethod === 'ilvl') {
                    const trend = currentSortMethod === 'hks' ? (p.trend_pvp || p.trend_hks || 0) : (p.trend_pve || p.trend_ilvl || 0);
                    if (trend > 0) trendHTML = `<span style="color: #2ecc71; font-size: 12px; margin-left: 10px; width: 30px; text-align: right; display: inline-block;">▲ ${trend}</span>`;
                    else if (trend < 0) trendHTML = `<span style="color: #e74c3c; font-size: 12px; margin-left: 10px; width: 30px; text-align: right; display: inline-block;">▼ ${Math.abs(trend)}</span>`;
                    else trendHTML = `<span style="color: #555; font-size: 12px; margin-left: 10px; width: 30px; text-align: right; display: inline-block;">-</span>`;
                }
            } else {
                cleanName = (char.name || 'Unknown').toLowerCase();
                displayName = char.name || 'Unknown';
                cClass = char.class || 'Unknown';
                raceName = char.race || 'Unknown';
                cHex = CLASS_COLORS[cClass] || "#fff";
                portraitURL = getClassIcon(cClass);
                level = char.level || 0;
                displaySpecClass = cClass;
            }

            // Inject Podium Classes & Rank Number if we are on a Ladder View
            const isLadderView = hashUrl === 'ladder-pve' || hashUrl === 'ladder-pvp';
            let podiumClass = '';
            let rankHtml = '';
            
            if (isLadderView) {
                podiumClass = index === 0 ? 'podium-1' : index === 1 ? 'podium-2' : index === 2 ? 'podium-3' : '';
                const rankColor = index === 0 ? '#ffd100' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#777';
                const rankSize = index < 3 ? '18px' : '15px';
                rankHtml = `<div style="color: ${rankColor}; font-family: 'Cinzel'; font-weight: bold; font-size: ${rankSize}; width: 30px; text-shadow: 1px 1px 2px #000; margin-right: 10px; display: flex; align-items: center; justify-content: center;">#${index + 1}</div>`;
            }

            // --- NEW: Vanguard Aura Logic ---
            let vanguardClass = '';
            let vanguardBadgeHtml = '';
            if (hashUrl.startsWith('war-effort-') && window.warEffortVanguards) {
                const type = hashUrl.replace('war-effort-', '');
                if (window.warEffortVanguards[type] && window.warEffortVanguards[type].includes(cleanName)) { // FIXED: Using cleanName
                    vanguardClass = 'vanguard-aura';
                    let timeText = '';
                    
                    // Grab the locked timestamp and format it nicely (24-Hour)
                    if (window.warEffortLockTimes && window.warEffortLockTimes[type]) {
                        const dt = new Date(window.warEffortLockTimes[type]);
                        if (!isNaN(dt)) {
                            timeText = ` <span style="color:#aaa; font-size:9px; font-weight:normal; margin-left:4px; text-transform:none;">(${dt.toLocaleString('en-GB', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false}).replace(',', '')})</span>`;
                        }
                    }
                    
                    vanguardBadgeHtml = `<span class="vanguard-badge">🌟 VANGUARD${timeText}</span>`;
                }
            }

            // --- NEW: Custom War Effort Stats Overrides ---
            let statsHtml = `
                <span>Level <span class="c-val-lvl">${level}</span></span>
                <span style="display:flex; align-items:center; justify-content:flex-end;">${statLabel} <span class="c-val-ilvl" style="${statColor} margin-left:4px;">${statValue}</span>${trendHTML}</span>
            `;
            let barStyleOverride = '';
            let innerWrapperStyle = 'display: flex; align-items: center; width: 100%;';
            let cStatsStyleOverride = 'display:flex; align-items:center; justify-content:flex-end; flex:1;';

            if (hashUrl.startsWith('war-effort-')) {
                // By default, stretch the bars
                barStyleOverride = 'width: 100%; max-width: 100%; margin-bottom: 8px; padding: 12px 15px;';
                
                if (hashUrl === 'war-effort-hk') {
                    const trendVal = deepChar && deepChar.profile ? (deepChar.profile.trend_pvp || deepChar.profile.trend_hks || 0) : 0;
                    statsHtml = `<span style="color:#ff4400; font-weight:bold; font-size:18px; text-shadow: 1px 1px 2px #000;">+${trendVal.toLocaleString()} HKs Contributed</span>`;
                } else if (window.warEffortContext) {
                    const charKey = cleanName; // FIXED: Using cleanName
                    const contextData = window.warEffortContext[charKey];
                    
                    if (contextData) {
                        if (hashUrl === 'war-effort-xp') {
                            statsHtml = `<span style="color:#ffd100; font-weight:bold; font-size:18px; text-shadow: 1px 1px 2px #000;">+${contextData} Levels Contributed</span>`;
                        } else if (hashUrl === 'war-effort-loot') {
                            // Turn the main bar into a column so we can stack the character info on top, and loot on the bottom
                            barStyleOverride = 'width: 100%; max-width: 100%; margin-bottom: 8px; padding: 15px; flex-direction: column; align-items: flex-start; height: auto;';
                            innerWrapperStyle = 'display: flex; align-items: center; width: 100%; justify-content: space-between; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 12px; margin-bottom: 12px;';
                            cStatsStyleOverride = 'display:flex; width: 100%; flex-direction: column; align-items: flex-start;';

                            const itemBadges = contextData.map(itemHtml => `<div style="background: rgba(0,0,0,0.6); padding: 5px 10px; border-radius: 6px; border: 1px solid #444; white-space: nowrap;">${itemHtml}</div>`).join('');
                            statsHtml = `
                                <span style="color:#888; font-size:11px; text-transform:uppercase; margin-bottom: 8px;">Epic Loot Acquired:</span>
                                <div style="display:flex; flex-wrap:wrap; justify-content:flex-start; gap:8px; font-size:13px; line-height:1.2;">
                                    ${itemBadges}
                                </div>
                            `;
                        } else if (hashUrl === 'war-effort-zenith') {
                            statsHtml = `
                                <div style="display:flex; flex-direction:column; align-items:flex-end; justify-content: center;">
                                    <span style="color:#888; font-size:11px; text-transform:uppercase;">Reached Level 70 on:</span>
                                    <span style="color:#3FC7EB; font-weight:bold; font-size:16px; text-shadow: 1px 1px 2px #000; margin-top: 4px;">${contextData}</span>
                                </div>
                            `;
                        }
                    }
                }
            }

            // 4. Render the HTML
            if (!isClickable) {
                return `
                <div class="concise-char-bar ${podiumClass} ${vanguardClass}" data-class="${cClass}" data-spec="unspecced" data-awards="${awardsAttr.join(',')}" style="border-left-color:${cHex}; cursor: default; ${barStyleOverride}">
                    <div style="${innerWrapperStyle}">
                        <div style="display: flex; align-items: center;">
                            ${rankHtml}
                            <div class="c-main-info">
                                <img src="${portraitURL}" class="c-portrait" loading="lazy" style="border-color:${cHex};" onerror="this.src='https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg'">
                                <span class="c-name" style="color:${cHex};">${displayName}${vanguardBadgeHtml}</span>
                                <span class="c-meta">${raceName} ${displaySpecClass}</span>
                            </div>
                        </div>
                        ${hashUrl !== 'war-effort-loot' ? `<div class="c-stats-info" style="${cStatsStyleOverride}">${statsHtml}</div>` : ''}
                    </div>
                    ${hashUrl === 'war-effort-loot' ? `<div class="c-stats-info" style="${cStatsStyleOverride}">${statsHtml}</div>` : ''}
                </div>`;
            }

            return `
            <div onclick="selectCharacter('${cleanName}')" class="concise-char-bar tt-char ${podiumClass} ${vanguardClass}" data-char="${cleanName}" data-class="${cClass}" data-spec="${activeSpecAttr}" data-awards="${awardsAttr.join(',')}" style="border-left-color:${cHex}; ${barStyleOverride}">
                <div style="${innerWrapperStyle}">
                    <div style="display: flex; align-items: center;">
                        ${rankHtml}
                        <div class="c-main-info">
                            <img src="${portraitURL}" class="c-portrait" loading="lazy" style="border-color:${cHex};" onerror="this.src='https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg'">
                            <span class="c-name" style="color:${cHex};">${displayName}${vanguardBadgeHtml}</span>
                            <span class="c-meta">${raceName} &bull; ${specIconHtml}${displaySpecClass}</span>
                        </div>
                    </div>
                    ${hashUrl !== 'war-effort-loot' ? `<div class="c-stats-info" style="${cStatsStyleOverride}">${statsHtml}</div>` : ''}
                </div>
                ${hashUrl === 'war-effort-loot' ? `<div class="c-stats-info" style="${cStatsStyleOverride}">${statsHtml}</div>` : ''}
            </div>`;
        }).join('');
        
        // Inject the sorting UI and the List HTML
        conciseList.innerHTML = sortUI + listHTML;

        // Bind the event listener to the newly created dropdown if it exists
        const sortDropdown = document.getElementById('concise-sort-dropdown');
        if (sortDropdown) {
            sortDropdown.addEventListener('change', function(e) {
                currentSortMethod = e.target.value;
                // Re-render the list with the exact same parameters but new sort
                renderConciseList(title, characters, isRawMode);
                
                // Re-apply any active spec filters to the newly rendered HTML
                if (typeof applyTimelineFilters === 'function') {
                     // Trigger a click on the active badge to re-filter the DOM elements
                     const activeBadge = document.querySelector('.dynamic-badge.active-filter');
                     if (activeBadge) {
                         // Briefly remove the class so the click handler re-applies it correctly
                         activeBadge.classList.remove('active-filter'); 
                         activeBadge.click();
                     }
                }
            });
        } 

        setupTooltips();
    }

    function setupTooltips() {
        const tt_chars = document.querySelectorAll('.tt-char:not(.tt-bound)');
        tt_chars.forEach(trigger => {
            trigger.classList.add('tt-bound');
            
            trigger.addEventListener('mousemove', e => {
                const charName = trigger.getAttribute('data-char');
                const char = rosterData.find(c => c.profile && c.profile.name && c.profile.name.toLowerCase() === charName);
                if (!char) return;
                
                const p = char.profile || {};
                const st = char.stats || {};
                const cClass = getCharClass(char);
                const powerName = getPowerName(cClass);
                const raceName = p.race && p.race.name ? (typeof p.race.name === 'string' ? p.race.name : (p.race.name.en_US || 'Unknown')) : 'Unknown';
                const cHex = CLASS_COLORS[cClass] || "#ffd100";
                
                const activeSpec = p.active_spec ? p.active_spec : '';
                const specIconUrl = getSpecIcon(cClass, activeSpec);
                const specIconHtml = specIconUrl ? `<img src="${specIconUrl}" style="width: 14px; height: 14px; border-radius: 50%; vertical-align: middle; margin-right: 4px; border: 1px solid #222;">` : '';
                const displaySpecClass = activeSpec ? `${activeSpec} ${cClass}` : cClass;
                
                // --- NEW: Grab the Guild Rank & MVP Badges (Scope-Safe) ---
                const guildRank = p.guild_rank || 'Member';
                const vBadges = safeParseArray(p.vanguard_badges || char.vanguard_badges);
                const cBadges = safeParseArray(p.campaign_badges || char.campaign_badges);
                const vCount = vBadges.length;
                const cCount = cBadges.length;
                const pveChamp = parseInt(p.pve_champ_count || char.pve_champ_count) || 0;
                const pvpChamp = parseInt(p.pvp_champ_count || char.pvp_champ_count) || 0;
                const pveGold = parseInt(p.pve_gold || char.pve_gold) || 0;
                const pveSilver = parseInt(p.pve_silver || char.pve_silver) || 0;
                const pveBronze = parseInt(p.pve_bronze || char.pve_bronze) || 0;
                const pvpGold = parseInt(p.pvp_gold || char.pvp_gold) || 0;
                const pvpSilver = parseInt(p.pvp_silver || char.pvp_silver) || 0;
                const pvpBronze = parseInt(p.pvp_bronze || char.pvp_bronze) || 0;

                const tPveGold = getDetailedBadgeTooltip(p.name, ['pve_gold'], `${pveGold}x PvE Gold Medal`, pveGold);
                const tPveSilver = getDetailedBadgeTooltip(p.name, ['pve_silver'], `${pveSilver}x PvE Silver Medal`, pveSilver);
                const tPveBronze = getDetailedBadgeTooltip(p.name, ['pve_bronze'], `${pveBronze}x PvE Bronze Medal`, pveBronze);
                const tPvpGold = getDetailedBadgeTooltip(p.name, ['pvp_gold'], `${pvpGold}x PvP Gold Medal`, pvpGold);
                const tPvpSilver = getDetailedBadgeTooltip(p.name, ['pvp_silver'], `${pvpSilver}x PvP Silver Medal`, pvpSilver);
                const tPvpBronze = getDetailedBadgeTooltip(p.name, ['pvp_bronze'], `${pvpBronze}x PvP Bronze Medal`, pvpBronze);
                const tPveChamp = getDetailedBadgeTooltip(p.name, ['mvp_pve'], `${pveChamp}x PvE Champion`, pveChamp);
                const tPvpChamp = getDetailedBadgeTooltip(p.name, ['mvp_pvp'], `${pvpChamp}x PvP Champion`, pvpChamp);
                const tVanguard = getDetailedBadgeTooltip(p.name, ['vanguard'], summarizeBadges(vBadges), vCount);
                const tCampaign = getDetailedBadgeTooltip(p.name, ['campaign'], summarizeBadges(cBadges), cCount);

                let cBadgesHtml = '<div style="display:inline-flex; gap:4px; margin-left:10px; vertical-align:middle;">';
                if (pveGold > 0) cBadgesHtml += `<span style="background:rgba(255, 215, 0, 0.2); border:1px solid rgba(255, 215, 0, 0.5); color:#ffd700; padding:1px 4px; border-radius:4px; font-size:10px; font-weight:bold;" title="${tPveGold}">🥇 ${pveGold}</span>`;
                if (pveSilver > 0) cBadgesHtml += `<span style="background:rgba(192, 192, 192, 0.2); border:1px solid rgba(192, 192, 192, 0.5); color:#c0c0c0; padding:1px 4px; border-radius:4px; font-size:10px; font-weight:bold;" title="${tPveSilver}">🥈 ${pveSilver}</span>`;
                if (pveBronze > 0) cBadgesHtml += `<span style="background:rgba(205, 127, 50, 0.2); border:1px solid rgba(205, 127, 50, 0.5); color:#cd7f32; padding:1px 4px; border-radius:4px; font-size:10px; font-weight:bold;" title="${tPveBronze}">🥉 ${pveBronze}</span>`;
                if (pvpGold > 0) cBadgesHtml += `<span style="background:rgba(255, 215, 0, 0.2); border:1px solid rgba(255, 215, 0, 0.5); color:#ffd700; padding:1px 4px; border-radius:4px; font-size:10px; font-weight:bold;" title="${tPvpGold}">🥇 ${pvpGold}</span>`;
                if (pvpSilver > 0) cBadgesHtml += `<span style="background:rgba(192, 192, 192, 0.2); border:1px solid rgba(192, 192, 192, 0.5); color:#c0c0c0; padding:1px 4px; border-radius:4px; font-size:10px; font-weight:bold;" title="${tPvpSilver}">🥈 ${pvpSilver}</span>`;
                if (pvpBronze > 0) cBadgesHtml += `<span style="background:rgba(205, 127, 50, 0.2); border:1px solid rgba(205, 127, 50, 0.5); color:#cd7f32; padding:1px 4px; border-radius:4px; font-size:10px; font-weight:bold;" title="${tPvpBronze}">🥉 ${pvpBronze}</span>`;
                if (pveChamp > 0) cBadgesHtml += `<span style="background:rgba(255, 128, 0, 0.2); border:1px solid rgba(255, 128, 0, 0.5); color:#ffad33; padding:1px 4px; border-radius:4px; font-size:10px; font-weight:bold;" title="${tPveChamp}">👑 ${pveChamp}</span>`;
                if (pvpChamp > 0) cBadgesHtml += `<span style="background:rgba(255, 68, 0, 0.2); border:1px solid rgba(255, 68, 0, 0.5); color:#ff7733; padding:1px 4px; border-radius:4px; font-size:10px; font-weight:bold;" title="${tPvpChamp}">⚔️ ${pvpChamp}</span>`;
                if (vCount > 0) cBadgesHtml += `<span style="background:rgba(0, 255, 204, 0.2); border:1px solid rgba(0, 255, 204, 0.5); color:#66ffeb; padding:1px 4px; border-radius:4px; font-size:10px; font-weight:bold;" title="${tVanguard}">🌟 ${vCount}</span>`;
                if (cCount > 0) cBadgesHtml += `<span style="background:rgba(170, 170, 170, 0.2); border:1px solid rgba(170, 170, 170, 0.5); color:#ddd; padding:1px 4px; border-radius:4px; font-size:10px; font-weight:bold;" title="${tCampaign}">🎖️ ${cCount}</span>`;
                cBadgesHtml += '</div>';

                tooltip.innerHTML = `
                    <div class="tt-name" style="color:${cHex}; display:flex; align-items:center;">${p.name || 'Unknown'}${cBadgesHtml}</div>
                    <div class="tt-row"><span class="tt-label">Guild Rank</span><span class="tt-val" style="color:#ffd100;">${guildRank}</span></div>
                    <div class="tt-row"><span class="tt-label">Level / Race</span><span class="tt-val">${p.level || 0} / ${raceName}</span></div>
                    <div class="tt-row"><span class="tt-label">Class</span><span class="tt-val" style="color:${cHex}; display:flex; align-items:center;">${specIconHtml}${displaySpecClass}</span></div>
                    <div class="tt-row"><span class="tt-label">Equipped iLvl</span><span class="tt-val" style="color:#ff8000;">${p.equipped_item_level || 0}</span></div>
                    <div class="tt-row"><span class="tt-label" style="border-bottom:none;">HP / ${powerName}</span><span class="tt-val" style="border-bottom:none;">${st.health || 0} / ${st.power || 0}</span></div>
                `;
                tooltip.style.borderLeftColor = cHex;
                
                let x = e.clientX + 15;
                let y = e.clientY + 15;
                if (x + 200 > window.innerWidth) x = window.innerWidth - 210;
                
                tooltip.style.left = `${x}px`; tooltip.style.top = `${y}px`;
                tooltip.classList.add('visible');
            });
            trigger.addEventListener('mouseleave', () => {
                tooltip.classList.remove('visible');
            });
        });
    }

    function applyTimelineFilters() {
        if (!timeline) return;

        const now = Date.now();
        
        // 1. Filter the raw data array directly instead of the DOM elements
        let tempFilteredData = timelineData.filter(event => {
            const charName = (event.character_name || '').toLowerCase();
            const eventType = event.type;
            const timestampStr = event.timestamp || '';
            const itemQuality = event.item_quality || 'COMMON';

            // Filter by Character
            if (window.currentFilteredChars && !window.currentFilteredChars.includes(charName)) return false;

            // --- NEW: Badge Filter Logic ---
            if (tlTypeFilter.startsWith('badge_')) {
                if (eventType !== 'badge') return false; // Show ONLY badges
                if (tlTypeFilter === 'badge_mvp' && event.badge_type !== 'mvp_pve' && event.badge_type !== 'mvp_pvp') return false;
                if (tlTypeFilter === 'badge_vanguard' && event.badge_type !== 'vanguard') return false;
                if (tlTypeFilter === 'badge_campaign' && event.badge_type !== 'campaign') return false;
                
                // FIX: Add the missing logic to evaluate the Medals button
                if (tlTypeFilter === 'badge_ladder' && !['pve_gold','pve_silver','pve_bronze','pvp_gold','pvp_silver','pvp_bronze'].includes(event.badge_type)) return false;
            } else {
                if (eventType === 'badge') return false; // NEVER show badges in normal feeds
                
                // Normal Rarity/Type filters
                if (tlTypeFilter === 'rare_plus') {
                    if (eventType !== 'item') return false;
                    if (itemQuality === 'POOR' || itemQuality === 'COMMON' || itemQuality === 'UNCOMMON') return false;
                } else if (tlTypeFilter === 'epic') {
                    if (eventType !== 'item' || (itemQuality !== 'EPIC' && itemQuality !== 'LEGENDARY')) return false;
                } else if (tlTypeFilter === 'legendary') {
                    if (eventType !== 'item' || itemQuality !== 'LEGENDARY') return false;
                } else if (tlTypeFilter !== 'all' && eventType !== tlTypeFilter) {
                    return false;
                }
            }

            // Filter by Date (Hours)
            if (tlSpecificDate && timestampStr) {
                if (!timestampStr.startsWith(tlSpecificDate)) return false;
            } else if (tlDateFilter !== 'all' && timestampStr) {
                let cleanTs = timestampStr.replace('Z', '+00:00');
                if (!cleanTs.includes('+') && !cleanTs.includes('Z')) cleanTs += 'Z';
                const eventDate = new Date(cleanTs).getTime();
                if (!isNaN(eventDate)) {
                    const hoursMs = parseInt(tlDateFilter) * 60 * 60 * 1000;
                    if ((now - eventDate) > hoursMs) return false;
                }
            }

            return true;
        });

        // --- NEW: Deduplicate identical badge events in the feed ---
        const uniqueEvents = [];
        const seenKeys = new Set();
        
        tempFilteredData.forEach(e => {
            if (e.type === 'badge') {
                // Ensure a character only gets one timeline row per specific badge category per day
                let dStr = (e.timestamp || '').substring(0, 10);
                const charName = (e.character_name || '').toLowerCase();
                const key = `badge_${charName}_${e.badge_type}_${e.category || ''}_${dStr}`;
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    uniqueEvents.push(e);
                }
            } else {
                // Let items and level-ups pass through normally
                uniqueEvents.push(e);
            }
        });
        
        filteredTimelineData = uniqueEvents;

        // 2. Clear the old feed and reset the counter
        const container = document.getElementById('timeline-feed-container');
        if (container) container.innerHTML = '';
        currentTimelineIndex = 0;

        // 3. Handle empty states or render the first batch
        let noResultsMsg = document.getElementById('tl-no-results');
        if (filteredTimelineData.length === 0) {
            if (container) container.style.display = 'none';
            if (!noResultsMsg) {
                noResultsMsg = document.createElement('div');
                noResultsMsg.id = 'tl-no-results';
                noResultsMsg.style.color = '#888';
                noResultsMsg.style.textAlign = 'center';
                noResultsMsg.style.padding = '20px';
                noResultsMsg.style.fontStyle = 'italic';
                noResultsMsg.innerText = 'No activity found for these filters yet... keep raiding!';
                document.getElementById('timeline').appendChild(noResultsMsg);
            } else {
                noResultsMsg.style.display = 'block';
            }
            const loadMoreBtn = document.getElementById('load-more-btn');
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        } else {
            if (container) container.style.display = 'flex';
            if (noResultsMsg) noResultsMsg.style.display = 'none';
            renderTimelineBatch();
        }
    }

    document.querySelectorAll('.tl-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tl-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            tlTypeFilter = e.target.getAttribute('data-type');
            applyTimelineFilters();
        });
    });

    const dateSelect = document.getElementById('tl-date-filter');
    if (dateSelect) {
        dateSelect.addEventListener('change', (e) => {
            tlDateFilter = e.target.value;
            if (tlSpecificDate) {
                tlSpecificDate = null;
                document.querySelectorAll('.tt-heatmap').forEach(c => c.classList.remove('selected-date'));
            }
            applyTimelineFilters();
        });
    }

    function hideAllViews() {
        emptyState.style.display = 'none';
        conciseView.style.display = 'none';
        fullCardContainer.style.display = 'none';
        if (analyticsView) analyticsView.style.display = 'none';
        if (architectureView) architectureView.style.display = 'none';
        if (searchInput) searchInput.value = '';
        if (searchAutoComplete) searchAutoComplete.classList.remove('show');
        
        if (timeline) timeline.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // --- RESTORE DEFAULT TIMELINE HTML ---
        const filtersContainer = document.querySelector('.timeline-filters');
        if (filtersContainer) {
            filtersContainer.innerHTML = `
                <div class="filter-group">
                    <button class="tl-btn" data-type="all">All</button>
                    <button class="tl-btn active" style="color: #0070dd; border-color: rgba(0, 112, 221, 0.5);" data-type="rare_plus">Rare+</button>
                    <button class="tl-btn" style="color: #a335ee; border-color: rgba(163, 53, 238, 0.5);" data-type="epic">Epics+</button>
                    <button class="tl-btn" data-type="level_up">Levels</button>
                </div>
                <div class="filter-group">
                    <select id="tl-date-filter" class="tl-select">
                        <option value="12">Last 12 Hours</option>
                        <option value="24">Last 24 Hours</option>
                        <option value="48">Last 48 Hours</option>
                        <option value="all" selected>All Available</option>
                    </select>
                </div>
            `;
            // Re-bind standard events
            document.querySelectorAll('.timeline-filters .tl-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.timeline-filters .tl-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    tlTypeFilter = e.target.getAttribute('data-type');
                    applyTimelineFilters();
                });
            });
            const dateSelect = document.getElementById('tl-date-filter');
            if (dateSelect) {
                dateSelect.addEventListener('change', (e) => {
                    tlDateFilter = e.target.value;
                    if (tlSpecificDate) {
                        tlSpecificDate = null;
                        document.querySelectorAll('.tt-heatmap').forEach(c => c.classList.remove('selected-date'));
                    }
                    applyTimelineFilters();
                });
            }
        }

        tlTypeFilter = 'rare_plus';
        tlDateFilter = 'all';
        tlSpecificDate = null;

        const xpCont = document.getElementById('guild-xp-container');
        if (xpCont) xpCont.style.display = 'none';

        document.querySelectorAll('.tt-heatmap').forEach(c => {
            c.classList.remove('selected-date');
        });
    }

    // --- AESTHETIC CHART DRAWING PLUGINS ---
    function createPieOverlayPlugin() {
        return {
            id: 'pieOverlays',
            afterDatasetDraw(chart) {
                const ctx = chart.ctx;
                const meta = chart.getDatasetMeta(0);
                chart.data.labels.forEach((label, i) => {
                    const arc = meta.data[i];
                    const dataVal = chart.data.datasets[0].data[i];
                    if (dataVal === 0 || arc.hidden) return;

                    // Calculate center of slice, pushed slightly outward
                    const centerAngle = arc.startAngle + (arc.endAngle - arc.startAngle) / 2;
                    const radius = arc.innerRadius + (arc.outerRadius - arc.innerRadius) * 0.65; 
                    const x = arc.x + Math.cos(centerAngle) * radius;
                    const y = arc.y + Math.sin(centerAngle) * radius;

                    ctx.save();
                    
                    // Draw sleek pill-shaped badge
                    ctx.beginPath();
                    ctx.roundRect(x - 18, y - 12, 36, 24, 6);
                    ctx.fillStyle = 'rgba(15, 15, 15, 0.9)';
                    ctx.fill();
                    ctx.lineWidth = 1.5;
                    ctx.strokeStyle = arc.options.backgroundColor || '#ffd100';
                    ctx.stroke();

                    // Draw text
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 13px Inter, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(dataVal, x, y + 1); // +1 tweak for optical alignment
                    
                    ctx.restore();
                });
            }
        };
    }

    const barLabelPlugin = {
        id: 'barLabels',
        afterDatasetsDraw(chart) {
            const ctx = chart.ctx;
            chart.data.datasets.forEach((dataset, i) => {
                const meta = chart.getDatasetMeta(i);
                meta.data.forEach((bar, index) => {
                    const data = dataset.data[index];
                    if (data > 0) {
                        ctx.fillStyle = '#fff';
                        ctx.font = 'bold 14px Cinzel';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.shadowColor = 'rgba(0,0,0,0.9)';
                        ctx.shadowBlur = 4;
                        ctx.shadowOffsetX = 1;
                        ctx.shadowOffsetY = 1;
                        ctx.fillText(data, bar.x, bar.y - 6);
                        ctx.shadowBlur = 0; 
                    }
                });
            });
        }
    };

    // --- REUSABLE ROLE CHART GENERATOR ---
    function drawRoleChart(ctxId, characters, isRawMode) {
        const roleCounts = { "Tank": 0, "Healer": 0, "Melee DPS": 0, "Ranged DPS": 0 };
        characters.forEach(c => {
            const p = isRawMode ? rosterData.find(deep => deep.profile && deep.profile.name && deep.profile.name.toLowerCase() === (c.name || '').toLowerCase())?.profile : c.profile;
            if (!p || !p.active_spec) return;
            const spec = p.active_spec;
            const cClass = isRawMode ? (c.class || 'Unknown') : getCharClass(c);
            
            if (["Protection", "Blood"].includes(spec) || (cClass === "Druid" && spec === "Feral Combat")) roleCounts["Tank"]++;
            else if (["Holy", "Discipline", "Restoration"].includes(spec)) roleCounts["Healer"]++;
            else if (["Mage", "Warlock", "Hunter"].includes(cClass) || ["Balance", "Elemental", "Shadow"].includes(spec)) roleCounts["Ranged DPS"]++;
            else roleCounts["Melee DPS"]++;
        });

        const ctx = document.getElementById(ctxId);
        if (!ctx) return null;

        return new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(roleCounts),
                datasets: [{ 
                    data: Object.values(roleCounts), 
                    backgroundColor: ['#e74c3c', '#2ecc71', '#e67e22', '#3498db'], 
                    borderColor: '#111', borderWidth: 2 
                }]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, cutout: '60%', layout: { padding: { top: 20, bottom: 20 } },
                plugins: { legend: { position: 'bottom', labels: { color: '#bbb', font: { family: 'Cinzel' } } } },
                onClick: (event, elements, chart) => {
                    if (elements.length > 0) {
                        const clickedLabel = chart.data.labels[elements[0].index];
                        window.location.hash = 'filter-role-' + clickedLabel.toLowerCase().replace(/\s+/g, '-');
                    }
                },
                onHover: (event, elements) => {
                    event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
                }
            },
            plugins: [createPieOverlayPlugin()]
        });
    }

    function createDonutChart(ctxId, rosterToCount, isRawMode) {
        const counts = {};
        rosterToCount.forEach(char => {
            let cClass = isRawMode ? (char.class || 'Unknown') : getCharClass(char);
            if (cClass !== 'Unknown') counts[cClass] = (counts[cClass] || 0) + 1;
        });

        const sortedClasses = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
        const donutLabels = sortedClasses;
        const donutData = sortedClasses.map(cls => counts[cls]);
        const donutColors = sortedClasses.map(cls => CLASS_COLORS[cls] || '#888');

        const ctx = document.getElementById(ctxId);
        if (!ctx) return null;

        return new Chart(ctx, {
            type: 'doughnut',
            data: { labels: donutLabels, datasets: [{ data: donutData, backgroundColor: donutColors, borderColor: '#111', borderWidth: 2, hoverOffset: 6 }] },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '65%', layout: { padding: { top: 20, bottom: 20, right: 20, left: 20 } },
                onClick: (event, elements, chart) => {
                    if (elements.length > 0) {
                        const clickedClass = chart.data.labels[elements[0].index];
                        const dynamicBadge = document.querySelector(`.dynamic-badge[data-class="${clickedClass}"]`);
                        if (dynamicBadge && document.getElementById('concise-view').style.display !== 'none') {
                            dynamicBadge.click(); 
                        } else {
                            window.location.hash = 'class-' + clickedClass.toLowerCase();
                        }
                    }
                },
                onHover: (event, elements) => {
                    event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
                },
                plugins: { legend: { display: false } }
            },
            plugins: [createPieOverlayPlugin()]
        });
    }

    function showAnalyticsView() {
        hideAllViews();
        if (analyticsView) analyticsView.style.display = 'block';
        if (navbar) navbar.style.background = '#111';
        if (timeline) timeline.style.display = 'none'; 

        // --- CALCULATE KPIs ---
        let totalIlvl = 0, lvl70Count = 0, totalHks = 0;
        rosterData.forEach(c => {
            const p = c.profile;
            if (p) {
                if (p.level === 70 && p.equipped_item_level) {
                    totalIlvl += p.equipped_item_level;
                    lvl70Count++;
                }
                if (p.honorable_kills) totalHks += p.honorable_kills;
            }
        });
        
        let epicLootCount = 0;
        timelineData.forEach(e => {
            if (e.type === 'item' && (e.item_quality === 'EPIC' || e.item_quality === 'LEGENDARY')) epicLootCount++;
        });

        const kpiIlvl = document.getElementById('kpi-avg-ilvl');
        if (kpiIlvl) kpiIlvl.innerText = lvl70Count > 0 ? Math.round(totalIlvl / lvl70Count) : 0;
        const kpiEpic = document.getElementById('kpi-epic-loot');
        if (kpiEpic) kpiEpic.innerText = epicLootCount;
        const kpiHks = document.getElementById('kpi-total-hks');
        if (kpiHks) kpiHks.innerText = totalHks >= 1000000 ? (totalHks/1000000).toFixed(1) + 'M' : totalHks.toLocaleString();

        if(window.roleChartInstance) window.roleChartInstance.destroy();
        window.roleChartInstance = drawRoleChart('roleDonutChart', rosterData, false);

        // --- LEVEL DISTRIBUTION ---
        const levelLabels = ["1-9", "10-19", "20-29", "30-39", "40-49", "50-59", "60-69", "70"];
        const levelData = [0, 0, 0, 0, 0, 0, 0, 0];
        rawGuildRoster.forEach(c => {
            const lvl = c.level || 0;
            if(lvl >= 70) levelData[7]++;
            else if(lvl >= 60) levelData[6]++;
            else if(lvl >= 50) levelData[5]++;
            else if(lvl >= 40) levelData[4]++;
            else if(lvl >= 30) levelData[3]++;
            else if(lvl >= 20) levelData[2]++;
            else if(lvl >= 10) levelData[1]++;
            else levelData[0]++;
        });

        const lvlCanvas = document.getElementById('levelDistChart');
        if (lvlCanvas) {
            const lvlCtx = lvlCanvas.getContext('2d');
            const lvlGradient = lvlCtx.createLinearGradient(0, 0, 0, 400);
            lvlGradient.addColorStop(0, 'rgba(255, 209, 0, 0.8)');
            lvlGradient.addColorStop(1, 'rgba(255, 209, 0, 0.1)');

            if(levelChartInstance) levelChartInstance.destroy();
            levelChartInstance = new Chart(lvlCtx, {
                type: 'bar',
                data: {
                    labels: levelLabels,
                    datasets: [{ label: 'Characters', data: levelData, backgroundColor: lvlGradient, borderColor: '#ffd100', borderWidth: 1, borderRadius: 4 }]
                },
                options: { 
                    responsive: true, maintainAspectRatio: false, layout: { padding: { top: 30 } }, plugins: { legend: {display: false}}, 
                    scales: { 
                        y: {beginAtZero: true, grid: {color: 'rgba(255,255,255,0.05)'}, ticks: {color: '#888'}}, 
                        x: {grid: {display: false}, ticks: {color: '#888', font: {family: 'Cinzel'}}}
                    },
                    onClick: (event, elements, chart) => {
                        if (elements.length > 0) {
                            window.location.hash = 'filter-level-' + chart.data.labels[elements[0].index];
                        }
                    },
                    onHover: (event, elements) => { event.native.target.style.cursor = elements.length ? 'pointer' : 'default'; }
                },
                plugins: [barLabelPlugin]
            });
        }

        // --- ILVL DISTRIBUTION ---
        const ilvlLabels = ["<100", "100-109", "110-119", "120-129", "130+"];
        const ilvlData = [0, 0, 0, 0, 0];
        rosterData.forEach(c => {
            const p = c.profile;
            if(p && p.level >= 70) {
                const ilvl = p.equipped_item_level || 0;
                if(ilvl >= 130) ilvlData[4]++;
                else if(ilvl >= 120) ilvlData[3]++;
                else if(ilvl >= 110) ilvlData[2]++;
                else if(ilvl >= 100) ilvlData[1]++;
                else ilvlData[0]++;
            }
        });

        const ilvlCanvas = document.getElementById('ilvlDistChart');
        if (ilvlCanvas) {
            const ilvlCtx = ilvlCanvas.getContext('2d');
            const ilvlGradient = ilvlCtx.createLinearGradient(0, 0, 0, 400);
            ilvlGradient.addColorStop(0, 'rgba(255, 128, 0, 0.8)'); 
            ilvlGradient.addColorStop(1, 'rgba(255, 128, 0, 0.1)'); 

            if(ilvlChartInstance) ilvlChartInstance.destroy();
            ilvlChartInstance = new Chart(ilvlCtx, {
                type: 'bar',
                data: {
                    labels: ilvlLabels,
                    datasets: [{ label: 'Level 70 Characters', data: ilvlData, backgroundColor: ilvlGradient, borderColor: '#ff8000', borderWidth: 1, borderRadius: 4 }]
                },
                options: { 
                    responsive: true, maintainAspectRatio: false, layout: { padding: { top: 30 } }, plugins: { legend: {display: false}}, 
                    scales: { 
                        y: {beginAtZero: true, grid: {color: 'rgba(255,255,255,0.05)'}, ticks: {color: '#888'}}, 
                        x: {grid: {display: false}, ticks: {color: '#888', font: {family: 'Cinzel'}}}
                    },
                    onClick: (event, elements, chart) => {
                        if (elements.length > 0) window.location.hash = 'filter-ilvl-' + chart.data.labels[elements[0].index];
                    },
                    onHover: (event, elements) => { event.native.target.style.cursor = elements.length ? 'pointer' : 'default'; }
                },
                plugins: [barLabelPlugin]
            });
        }

        // --- RACE DISTRIBUTION ---
        const raceCounts = {};
        rosterData.forEach(c => {
            const p = c.profile;
            if(p && p.race && p.race.name) {
                const raceName = typeof p.race.name === 'string' ? p.race.name : (p.race.name.en_US || 'Unknown');
                raceCounts[raceName] = (raceCounts[raceName] || 0) + 1;
            }
        });
        
        const RACE_COLORS = {
            "Human": "#0033aa", "Draenei": "#ba55d3", "Dwarf": "#8B4513", "Night Elf": "#800080",
            "Gnome": "#FF69B4", "Orc": "#8B0000", "Undead": "#556B2F", "Tauren": "#D2B48C",
            "Troll": "#008B8B", "Blood Elf": "#DC143C", "Unknown": "#888"
        };

        if(raceChartInstance) raceChartInstance.destroy();
        raceChartInstance = new Chart(document.getElementById('raceDistChart'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(raceCounts),
                datasets: [{ data: Object.values(raceCounts), backgroundColor: Object.keys(raceCounts).map(r => RACE_COLORS[r] || '#555'), borderColor: '#111', borderWidth: 2 }]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, cutout: '55%', layout: { padding: { top: 20, bottom: 20, right: 20, left: 20 } },
                plugins: { legend: {position: 'right', labels:{color:'#bbb', font:{family:'Cinzel'}}} },
                onClick: (event, elements, chart) => {
                    if (elements.length > 0) window.location.hash = 'filter-race-' + chart.data.labels[elements[0].index].toLowerCase();
                },
                onHover: (event, elements) => { event.native.target.style.cursor = elements.length ? 'pointer' : 'default'; }
            },
            plugins: [createPieOverlayPlugin()]
        });

        // --- NEW: CLASS DISTRIBUTION FOR ANALYTICS ---
        if(analyticsClassChartInst) analyticsClassChartInst.destroy();
        analyticsClassChartInst = createDonutChart('analyticsClassChart', rosterData, false);

        // --- ACTIVITY CHART ---
        const actCtx = document.getElementById('analyticsActivityChart');
        if (actCtx && heatmapData && heatmapData.length > 0) {
            if(analyticsActivityChartInst) analyticsActivityChartInst.destroy();
            analyticsActivityChartInst = new Chart(actCtx, {
                type: 'line',
                data: {
                    labels: heatmapData.map(d => d.day_name),
                    datasets: [
                        { label: 'Loot Drops', data: heatmapData.map(d => d.loot || 0), borderColor: '#a335ee', backgroundColor: 'rgba(163, 53, 238, 0.1)', borderWidth: 2, pointBackgroundColor: '#a335ee', pointBorderColor: '#fff', tension: 0.3, fill: true, yAxisID: 'y' },
                        { label: 'Level Ups', data: heatmapData.map(d => d.levels || 0), borderColor: '#ffd100', backgroundColor: 'rgba(255, 209, 0, 0.1)', borderWidth: 2, pointBackgroundColor: '#ffd100', pointBorderColor: '#fff', tension: 0.3, fill: true, yAxisID: 'y' },
                        { label: 'Total Roster', data: heatmapData.map(d => d.total_roster || 0), borderColor: 'rgba(52, 152, 219, 0.3)', backgroundColor: 'transparent', borderWidth: 2, borderDash: [4, 4], pointRadius: 0, pointHoverRadius: 4, pointBackgroundColor: '#3498db', pointBorderColor: '#fff', tension: 0.3, fill: false, yAxisID: 'y-roster' },
                        { label: 'Active Roster', data: heatmapData.map(d => d.active_roster || 0), borderColor: 'rgba(46, 204, 113, 0.6)', backgroundColor: 'rgba(46, 204, 113, 0.05)', borderWidth: 2, borderDash: [4, 4], pointRadius: 0, pointHoverRadius: 4, pointBackgroundColor: '#2ecc71', pointBorderColor: '#fff', tension: 0.3, fill: true, yAxisID: 'y-roster' }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: '#bbb', font: { family: 'Cinzel' }, boxWidth: 12 } }, tooltip: { mode: 'index', intersect: false, backgroundColor: 'rgba(0,0,0,0.8)', titleColor: '#fff', bodyFont: { family: 'Cinzel' } } },
                    scales: { 
                        y: { type: 'linear', position: 'left', beginAtZero: true, title: { display: true, text: 'Activity Count', color: '#888', font: {family: 'Cinzel'} }, ticks: { color: '#888', stepSize: 1, font: {family: 'Cinzel'} }, grid: { color: 'rgba(255,255,255,0.05)' } },
                        'y-roster': { type: 'linear', position: 'right', beginAtZero: false, title: { display: true, text: 'Player Count', color: '#888', font: {family: 'Cinzel'} }, ticks: { color: '#888', font: {family: 'Cinzel'} }, grid: { drawOnChartArea: false } },
                        x: { ticks: { color: '#888', font: { family: 'Cinzel', weight: 'bold' } }, grid: { display: false } } 
                    },
                    interaction: { mode: 'nearest', axis: 'x', intersect: false }
                }
            });
        }
    }

    function showArchitectureView() {
        hideAllViews();
        if (architectureView) architectureView.style.display = 'block';
        if (navbar) navbar.style.background = '#111';
        if (timeline) timeline.style.display = 'none'; 
    }

    window.returnToHome = function() {
        window.location.hash = '';
        showHomeView();
    }

    function showHomeView() {
        hideAllViews();
        emptyState.style.display = 'block';
        if (navbar) navbar.style.background = 'rgba(15, 15, 15, 0.85)';
        updateDropdownLabel('all');

        const xpCont = document.getElementById('guild-xp-container');
        if (xpCont) xpCont.style.display = 'block';
        
        // Calculate the War Effort data AND monuments first
        if (typeof window.renderGuildXPBar === 'function') window.renderGuildXPBar();

        // Now that monuments exist, apply timeline filters to render them at the top
        if (timeline) { 
            timeline.style.display = 'block'; 
            timelineTitle.innerHTML = "📜 Guild Recent Activity"; 
            window.currentFilteredChars = null; 
            applyTimelineFilters(); 
        }

        // Populate New KPIs
        let totalIlvl = 0, lvl70Count = 0, totalHks = 0;
        rosterData.forEach(c => {
            if (c.profile) {
                if (c.profile.level === 70 && c.profile.equipped_item_level) { totalIlvl += c.profile.equipped_item_level; lvl70Count++; }
                if (c.profile.honorable_kills) totalHks += c.profile.honorable_kills;
            }
        });
        const kpiIlvl = document.getElementById('home-kpi-ilvl');
        if (kpiIlvl) kpiIlvl.innerText = lvl70Count > 0 ? Math.round(totalIlvl / lvl70Count) : 0;
        const kpiHks = document.getElementById('home-kpi-hks');
        if (kpiHks) kpiHks.innerText = totalHks >= 1000000 ? (totalHks/1000000).toFixed(1) + 'M' : totalHks.toLocaleString();

        const statAvgIlvl = document.getElementById('stat-avgilvl');
        if (statAvgIlvl) statAvgIlvl.onclick = () => { window.location.hash = 'ladder-pve'; };
        
        const statHks = document.getElementById('stat-hks');
        if (statHks) statHks.onclick = () => { window.location.hash = 'ladder-pvp'; };

        // "Yesterday" Sparklines & Math
        if (heatmapData && heatmapData.length >= 2) {
            const today = heatmapData[heatmapData.length - 1];
            const yesterday = heatmapData[heatmapData.length - 2];
            
            function applyTrend(elementId, todayVal, yestVal) {
                const el = document.getElementById(elementId);
                if (!el || yestVal == null) return;
                const diff = todayVal - yestVal;
                if (diff > 0) el.innerHTML = `<span style="color:#2ecc71;">▲ ${diff}</span>`;
                else if (diff < 0) el.innerHTML = `<span style="color:#e74c3c;">▼ ${Math.abs(diff)}</span>`;
                else el.innerHTML = `<span style="color:#555;">-</span>`;
            }

            applyTrend('trend-total', today.total_roster, yesterday.total_roster);
            applyTrend('trend-active', today.active_roster, yesterday.active_roster);
            // Raid Ready math isn't stored historically in heatmapData, so we leave it static or estimate it

            // Draw Sparklines
            function drawSpark(canvasId, dataKey, colorStr) {
                const ctx = document.getElementById(canvasId);
                if (!ctx) return;
                const dataPoints = heatmapData.map(d => d[dataKey] || 0);
                new Chart(ctx, {
                    type: 'line',
                    data: { labels: heatmapData.map(d => d.day_name), datasets: [{ data: dataPoints, borderColor: colorStr, borderWidth: 2, tension: 0.4, pointRadius: 0 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false, min: Math.min(...dataPoints) * 0.95 } } }
                });
            }
            drawSpark('spark-total', 'total_roster', 'rgba(255, 209, 0, 0.5)');
            drawSpark('spark-active', 'active_roster', 'rgba(46, 204, 113, 0.5)');
        }

        // Recent Milestones logic (Fading Rotator)
        if (timelineData && timelineData.length > 0) {
            const milestoneCont = document.getElementById('recent-milestones-container');
            const milestoneText = document.getElementById('milestone-text');

            if (milestoneCont && milestoneText) {
                // 1. Grab the top 5 most recent milestones
                const recentEvents = timelineData.filter(e => 
                    (e.type === 'item' && (e.item_quality === 'EPIC' || e.item_quality === 'LEGENDARY')) || 
                    (e.type === 'level_up' && e.level === 70)
                ).slice(0, 5);

                if (recentEvents.length > 0) {
                    milestoneCont.style.display = 'flex';
                    milestoneText.classList.add('milestone-text-rotator');

                    // 2. Pre-build the HTML strings for all 5 events
                    const slideHtml = recentEvents.map(recent => {
                        const charName = `<span class="milestone-highlight">${recent.character_name}</span>`;
                        let timeStr = '';
                        try {
                            let cleanTs = (recent.timestamp || '').replace('Z', '+00:00');
                            if (!cleanTs.includes('+') && !cleanTs.includes('Z')) cleanTs += 'Z';
                            const dt = new Date(cleanTs);
                            if (!isNaN(dt.getTime())) timeStr = ` <span style="color:#888; font-size:11px; white-space:nowrap; margin-left:4px;">(${dt.toLocaleString('en-GB', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false}).replace(',', '')})</span>`;
                        } catch(e) {}

                        if (recent.type === 'level_up') {
                            return `Congratulations to ${charName} for reaching <span class="milestone-highlight">Level 70!</span> 🎉${timeStr}`;
                        } else {
                            const qClass = recent.item_quality === 'LEGENDARY' ? 'color:#ff8000;' : 'color:#a335ee;';
                            return `${charName} just looted <a href="https://www.wowhead.com/wotlk/item=${recent.item_id}" target="_blank" style="${qClass} font-weight:bold; text-decoration:none;">[${recent.item_name}]</a>!${timeStr}`;
                        }
                    });

                    // 3. Initialize the first slide
                    milestoneText.innerHTML = slideHtml[0];

                    // 4. Start the rotating carousel if there is more than 1 event
                    if (slideHtml.length > 1) {
                        let currentSlide = 0;

                        // Clear existing interval if route() is called multiple times
                        if (window.milestoneInterval) clearInterval(window.milestoneInterval);

                        window.milestoneInterval = setInterval(() => {
                            milestoneText.style.opacity = '0'; // Fade out

                            setTimeout(() => {
                                currentSlide = (currentSlide + 1) % slideHtml.length;
                                milestoneText.innerHTML = slideHtml[currentSlide];
                                milestoneText.style.opacity = '1'; // Fade in
                            }, 500); // Wait for fade out to finish before swapping text

                        }, 4500); // Swap every 4.5 seconds
                    }
                } else {
                    milestoneCont.style.display = 'none';
                }
            }
        }
		
		// Trigger the MVP render
        if (typeof renderMVPs === 'function') renderMVPs();
    }

    window.selectCharacter = function(charName) {
        window.location.hash = charName;
    }

    // Added defaultSort parameter to override the standard "level" start
    function showConciseView(title, characters, isRawRoster = false, showBadges = true, defaultSort = 'level') {
        hideAllViews();
        conciseView.style.display = 'flex';
        if (navbar) navbar.style.background = '#111';
        
        currentSortMethod = defaultSort; // Apply the requested sort method immediately
        renderConciseList(title, characters, isRawRoster);
        
        window.currentFilteredChars = characters.map(c => {
            if (isRawRoster) return c.name ? c.name.toLowerCase() : '';
            return c.profile && c.profile.name ? c.profile.name.toLowerCase() : '';
        });
        
        const hash = window.location.hash.substring(1);
        const chartViews = ['total', 'active', 'raidready', 'ladder-pve', 'ladder-pvp'];

        const wrapper = document.getElementById('concise-content-wrapper');
        const leftCol = document.getElementById('concise-left-col');
        const badgesContainer = document.getElementById('concise-class-badges');

        if (showBadges === true) {
            renderDynamicBadges(characters, isRawRoster);
            leftCol.style.display = 'flex';
            
            // Restore default column layout
            wrapper.style.flexDirection = 'row';
            leftCol.style.maxWidth = '350px';
            leftCol.style.width = 'auto';
            badgesContainer.style.flexWrap = 'wrap';
            badgesContainer.style.justifyContent = 'center';
            badgesContainer.style.maxWidth = '900px';
            if (timeline) {
                timeline.style.width = ''; 
                timeline.style.maxWidth = ''; // Reset timeline width
            }
            
        } else if (showBadges === 'awards') {
            renderAwardFilterBadges(characters, isRawRoster);
            leftCol.style.display = 'flex';
            
            // Stack layout: Bubbles single-file on top, character list stretched wide below
            wrapper.style.flexDirection = 'column';
            leftCol.style.maxWidth = '100%';
            leftCol.style.width = '100%';
            badgesContainer.style.flexWrap = 'nowrap';
            badgesContainer.style.justifyContent = 'flex-start';
            badgesContainer.style.maxWidth = '100%';
            badgesContainer.style.overflowX = 'auto'; // Allows horizontal scroll if screen is too small
            badgesContainer.style.paddingBottom = '10px';
            
            // Stretch the activity feed slightly, but keep it responsive for mobile!
            if (timeline) {
                timeline.style.width = '100%'; 
                timeline.style.maxWidth = '440px'; 
            }
            
        } else {
            badgesContainer.style.display = 'none';
            const specContainer = document.getElementById('concise-spec-container');
            if (specContainer) specContainer.style.display = 'none';
            
            // Restore default column layout
            wrapper.style.flexDirection = 'row';
            leftCol.style.maxWidth = '350px';
            leftCol.style.width = 'auto';
            if (timeline) {
                timeline.style.width = ''; 
                timeline.style.maxWidth = ''; // Reset timeline width
            }
            
            if (!chartViews.includes(hash)) {
                leftCol.style.display = 'none';
            } else {
                leftCol.style.display = 'flex';
            }
        }

       // Draw the dynamic charts & KPIs
        const donutContainer = document.getElementById('concise-donut-container');

        if (chartViews.includes(hash)) {
            if (donutContainer) {
                donutContainer.style.display = 'flex';
                donutContainer.style.flexDirection = 'column';
                donutContainer.style.alignItems = 'center';
                donutContainer.style.gap = '20px';
                
               let kpiHtml = '';
                if (hash === 'raidready') {
                    const avgIlvl = Math.round(characters.reduce((sum, c) => sum + ((c.profile && c.profile.equipped_item_level) || 0), 0) / characters.length) || 0;
                    kpiHtml = `<div class="stat-box" style="margin-bottom: 5px; min-width: 200px; border-color: #ff8000;"><span class="stat-value" style="color:#ff8000;">${avgIlvl}</span><span class="stat-label">Average iLvl</span></div>`;
                } else if (hash === 'ladder-pve') {
                    const avgIlvl = Math.round(characters.reduce((sum, c) => sum + ((c.profile && c.profile.equipped_item_level) || 0), 0) / characters.length) || 0;
                    
                    const lvl70s = characters.filter(c => {
                        const p = isRawRoster ? rosterData.find(deep => deep.profile?.name?.toLowerCase() === (c.name || '').toLowerCase())?.profile : c.profile;
                        return p && p.level === 70;
                    });
                    const avgLvl70Ilvl = lvl70s.length > 0 ? Math.round(lvl70s.reduce((sum, c) => {
                        const p = isRawRoster ? rosterData.find(deep => deep.profile?.name?.toLowerCase() === (c.name || '').toLowerCase())?.profile : c.profile;
                        return sum + ((p && p.equipped_item_level) || 0);
                    }, 0) / lvl70s.length) : 0;
                    
                    kpiHtml = `
                        <div style="display:flex; gap:15px; margin-bottom: 5px; flex-wrap: wrap; justify-content:center;">
                            <div class="stat-box" style="border-color: #ff8000;"><span class="stat-value" style="color:#ff8000;">${avgIlvl}</span><span class="stat-label">Avg iLvl</span></div>
                            <div class="stat-box" style="border-color: #a335ee;"><span class="stat-value" style="color:#a335ee;">${avgLvl70Ilvl}</span><span class="stat-label">Avg Lvl 70 iLvl</span></div>
                        </div>`;
                } else if (hash === 'ladder-pvp') {
                    const totalHks = characters.reduce((sum, c) => sum + ((c.profile && c.profile.honorable_kills) || 0), 0) || 0;
                    const displayHks = totalHks >= 1000000 ? (totalHks/1000000).toFixed(1) + 'M' : totalHks.toLocaleString();
                    kpiHtml = `<div class="stat-box" style="margin-bottom: 5px; min-width: 200px; border-color: #ff4400;"><span class="stat-value" style="color:#ff4400;">${displayHks}</span><span class="stat-label">Total HKs</span></div>`;
                } else if (hash === 'active' || hash === 'total') {
                    // Match raw roster names to deep profile roster to get accurate levels and iLvls
                    const avgLvl = Math.round(characters.reduce((sum, c) => {
                        const p = isRawRoster ? rosterData.find(deep => deep.profile?.name?.toLowerCase() === (c.name || '').toLowerCase())?.profile : c.profile;
                        return sum + ((p && p.level) || c.level || 0);
                    }, 0) / characters.length) || 0;
                    
                    const lvl70s = characters.filter(c => {
                        const p = isRawRoster ? rosterData.find(deep => deep.profile?.name?.toLowerCase() === (c.name || '').toLowerCase())?.profile : c.profile;
                        return p && p.level === 70;
                    });
                    
                    const avgIlvl = lvl70s.length > 0 ? Math.round(lvl70s.reduce((sum, c) => {
                        const p = isRawRoster ? rosterData.find(deep => deep.profile?.name?.toLowerCase() === (c.name || '').toLowerCase())?.profile : c.profile;
                        return sum + ((p && p.equipped_item_level) || 0);
                    }, 0) / lvl70s.length) : 0;
                    
                    kpiHtml = `
                        <div style="display:flex; gap:15px; margin-bottom: 5px; flex-wrap: wrap; justify-content:center;">
                            <div class="stat-box" style="border-color: #ffd100;"><span class="stat-value" style="color:#ffd100;">${avgLvl}</span><span class="stat-label">Avg Level</span></div>
                            <div class="stat-box" style="border-color: #ff8000;"><span class="stat-value" style="color:#ff8000;">${avgIlvl}</span><span class="stat-label">Avg Lvl 70 iLvl</span></div>
                        </div>`;
                }

                let chartsHtml = kpiHtml + `<div style="display:flex; gap: 30px; flex-wrap: wrap; justify-content: center; width: 100%;">`;
                
                // Show Roles on everything.
                chartsHtml += `<div style="flex: 1; min-width: 280px; max-width: 350px; height: 280px; position: relative;"><h4 style="text-align:center; color:#ffd100; font-family:'Cinzel'; margin-top:0;">Raid Roles</h4><canvas id="conciseRoleChart"></canvas></div>`;
                
                // Show Class Distribution
                chartsHtml += `<div style="flex: 1; min-width: 280px; max-width: 350px; height: 280px; position: relative;"><h4 style="text-align:center; color:#ffd100; font-family:'Cinzel'; margin-top:0;">Class Distribution</h4><canvas id="conciseClassChart"></canvas></div>`;

                chartsHtml += `</div>`;
                donutContainer.innerHTML = chartsHtml;

                if (window.conciseRoleChartInstance) window.conciseRoleChartInstance.destroy();
                if (window.conciseClassChartInstance) window.conciseClassChartInstance.destroy();

                window.conciseRoleChartInstance = drawRoleChart('conciseRoleChart', characters, isRawRoster);
                window.conciseClassChartInstance = createDonutChart('conciseClassChart', characters, isRawRoster);
            }
        } else {
            if (donutContainer) donutContainer.style.display = 'none';
        }
        
        if (timeline) {
            const baseTitle = title.replace(/ Overview \(\d+\)/, '').replace(/ \(\d+\)/, '');
            timelineTitle.innerHTML = `📜 ${baseTitle} Activity`;
            applyTimelineFilters();
        }
    }

    function showFullCardView(charName) {
        hideAllViews();
        fullCardContainer.style.display = 'block';
        fullCardContainer.innerHTML = renderFullCard(charName);
        if (navbar) navbar.style.background = '#111';
        
        if (timeline) {
            const formattedName = charName.charAt(0).toUpperCase() + charName.slice(1);
            timelineTitle.innerHTML = `📜 ${formattedName}'s Recent Activity`;
            window.currentFilteredChars = [charName.toLowerCase()]; 
            applyTimelineFilters(); 
        }
    }

    function route() {
        const hash = decodeURIComponent(window.location.hash.substring(1));
        
        if (!hash || hash === '') {
            showHomeView();
        } else if (hash === 'analytics') {
            showAnalyticsView();
            updateDropdownLabel('all');
        } else if (hash === 'architecture') {
            showArchitectureView();
            updateDropdownLabel('all');
        } else if (hash === 'total') {
            showConciseView(`Total Guild Roster (${rawGuildRoster.length})`, rawGuildRoster.sort((a,b) => b.level - a.level), true, true);
            updateDropdownLabel('all');
        } else if (hash === 'badges') {
            const badgeRoster = rosterData.filter(c => {
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
            });
            
            showConciseView(`🌟 Hall of Heroes (${badgeRoster.length})`, badgeRoster, false, 'awards', 'badges');
            updateDropdownLabel('badges');
            
            // --- OVERRIDE TIMELINE FILTERS FOR BADGE LOG ---
            if (timeline) {
                timelineTitle.innerHTML = `📜 Hall of Heroes Award History`;
                const filtersContainer = document.querySelector('.timeline-filters');
                if (filtersContainer) {
                    filtersContainer.innerHTML = `
                        <div class="filter-group" style="flex-wrap: wrap;">
                            <button class="tl-btn active" style="color: #ffd100; border-color: rgba(255, 209, 0, 0.5);" data-type="badge_all">All Awards</button>
                            <button class="tl-btn" style="color: #ffd700; border-color: rgba(255, 215, 0, 0.5);" data-type="badge_ladder">Medals</button>
                            <button class="tl-btn" style="color: #ff8000; border-color: rgba(255, 128, 0, 0.5);" data-type="badge_mvp">MVP</button>
                            <button class="tl-btn" style="color: #00ffcc; border-color: rgba(0, 255, 204, 0.5);" data-type="badge_vanguard">Vanguards</button>
                            <button class="tl-btn" style="color: #aaa; border-color: rgba(170, 170, 170, 0.5);" data-type="badge_campaign">Campaigns</button>
                        </div>
                    `;
                    document.querySelectorAll('.timeline-filters .tl-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            document.querySelectorAll('.timeline-filters .tl-btn').forEach(b => b.classList.remove('active'));
                            e.target.classList.add('active');
                            tlTypeFilter = e.target.getAttribute('data-type');
                            applyTimelineFilters();
                        });
                    });
                }
                tlTypeFilter = 'badge_all';
                tlDateFilter = 'all'; // Ignore time limits for history
                window.currentFilteredChars = null; 
                applyTimelineFilters();
            }

        } else if (hash === 'active') {
            const activeRoster = rosterData.filter(c => {
                const lastLogin = c.profile && c.profile.last_login_timestamp ? c.profile.last_login_timestamp : 0;
                const now = Date.now();
                return (now - lastLogin) <= (14 * 24 * 60 * 60 * 1000);
            });
            showConciseView(`Active Members Overview (${activeRoster.length})`, activeRoster, false, true);
            updateDropdownLabel('all');
        } else if (hash === 'raidready') {
            const raidReadyRoster = rosterData.filter(c => c.profile && c.profile.level === 70 && (c.profile.equipped_item_level || 0) >= 110);
            showConciseView(`Raid Ready Overview (${raidReadyRoster.length})`, raidReadyRoster, false, true);
            updateDropdownLabel('all');
        } else if (hash === 'all') {
            const activeLabel = active14Days > 0 ? `(${active14Days} Active)` : '';
            showConciseView(`Processed Roster Overview ${activeLabel}`, rosterData, false, true);
            updateDropdownLabel('all');
        } else if (hash.startsWith('class-')) {
            const className = hash.replace('class-', '');
            const formattedClass = className.charAt(0).toUpperCase() + className.slice(1);
            const classRoster = rosterData.filter(c => {
                const cClass = getCharClass(c);
                return cClass.toLowerCase() === className;
            });
            showConciseView(`Guild ${formattedClass}s Overview (${classRoster.length})`, classRoster, false, false);
            updateDropdownLabel('all');
        } else if (hash.startsWith('spec-')) {
            const parts = hash.split('-');
            const className = parts[1];
            const specParam = parts.slice(2).join('');
            const formattedClass = className.charAt(0).toUpperCase() + className.slice(1);

            const specRoster = rosterData.filter(c => {
                const cClass = getCharClass(c);
                if (cClass.toLowerCase() !== className) return false;

                const cSpec = c.profile && c.profile.active_spec ? c.profile.active_spec : "unspecced";
                const cSpecClean = cSpec.toLowerCase().replace(/\s+/g, '');
                return cSpecClean === specParam;
            });

            let displaySpecName = "Unspecced";
            if (specRoster.length > 0 && specRoster[0].profile && specRoster[0].profile.active_spec) {
                displaySpecName = specRoster[0].profile.active_spec;
            }
            
            showConciseView(`Guild ${displaySpecName} ${formattedClass}s (${specRoster.length})`, specRoster, false, false);
            updateDropdownLabel('all');
        } else if (hash.startsWith('filter-level-')) {
            const range = hash.replace('filter-level-', '');
            let minLvl = 0, maxLvl = 70;
            if (range === '70') { minLvl = 70; maxLvl = 70; }
            else if (range.includes('-')) {
                const parts = range.split('-');
                minLvl = parseInt(parts[0]);
                maxLvl = parseInt(parts[1]);
            }
            const filteredRoster = rawGuildRoster.filter(c => {
                const lvl = c.level || 0;
                return lvl >= minLvl && lvl <= maxLvl;
            });
            showConciseView(`Level ${range} Characters (${filteredRoster.length})`, filteredRoster, true, true);
            updateDropdownLabel('all');
        } else if (hash.startsWith('filter-ilvl-')) {
            const range = hash.replace('filter-ilvl-', '');
            const filteredRoster = rosterData.filter(c => {
                const p = c.profile;
                if (!p || p.level < 70) return false;
                const ilvl = p.equipped_item_level || 0;
                
                if (range === '<100') return ilvl < 100;
                if (range === '130+') return ilvl >= 130;
                
                const parts = range.split('-');
                if (parts.length === 2) {
                    return ilvl >= parseInt(parts[0]) && ilvl <= parseInt(parts[1]);
                }
                return false;
            });
            showConciseView(`Level 70 Characters iLvl ${range} (${filteredRoster.length})`, filteredRoster, false, true);
            updateDropdownLabel('all');
        } else if (hash.startsWith('filter-race-')) {
            const targetRace = decodeURIComponent(hash.replace('filter-race-', ''));
            const filteredRoster = rosterData.filter(c => {
                const p = c.profile;
                if (p && p.race && p.race.name) {
                    const raceName = typeof p.race.name === 'string' ? p.race.name : (p.race.name.en_US || 'Unknown');
                    return raceName.toLowerCase() === targetRace;
                }
                return false;
            });
            // Capitalize for the nice title string
            const displayRace = targetRace.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            showConciseView(`${displayRace} Characters (${filteredRoster.length})`, filteredRoster, false, true);
            updateDropdownLabel('all');
        } else if (hash.startsWith('filter-role-')) {
            const targetRoleHash = hash.replace('filter-role-', '');
            
            let targetRoleName = "Unknown";
            if (targetRoleHash === "tank") targetRoleName = "Tank";
            else if (targetRoleHash === "healer") targetRoleName = "Healer";
            else if (targetRoleHash === "melee-dps") targetRoleName = "Melee DPS";
            else if (targetRoleHash === "ranged-dps") targetRoleName = "Ranged DPS";

            const filteredRoster = rosterData.filter(c => {
                if (!c.profile || !c.profile.active_spec) return false;
                const spec = c.profile.active_spec;
                const cClass = getCharClass(c);
                let role = "Melee DPS"; 

                if (["Protection", "Blood"].includes(spec) || (cClass === "Druid" && spec === "Feral Combat")) role = "Tank";
                else if (["Holy", "Discipline", "Restoration"].includes(spec)) role = "Healer";
                else if (["Mage", "Warlock", "Hunter"].includes(cClass) || ["Balance", "Elemental", "Shadow"].includes(spec)) role = "Ranged DPS";

                return role === targetRoleName;
            });

            showConciseView(`Raid Role: ${targetRoleName}s (${filteredRoster.length})`, filteredRoster, false, true);
            updateDropdownLabel('all');

        } else if (hash === 'ladder-pve') {
            const sortedPve = [...rosterData].filter(c => c.profile && (c.profile.equipped_item_level || 0) > 0)
                .sort((a, b) => (b.profile.equipped_item_level || 0) - (a.profile.equipped_item_level || 0));
            // Passed 'true' for Badges, and 'ilvl' for the default sort!
            showConciseView(`Full PvE Ladder (${sortedPve.length})`, sortedPve, false, true, 'ilvl');
            updateDropdownLabel('all');
            
        } else if (hash === 'ladder-pvp') {
            const sortedPvp = [...rosterData].filter(c => c.profile && (c.profile.honorable_kills || 0) > 0)
                .sort((a, b) => (b.profile.honorable_kills || 0) - (a.profile.honorable_kills || 0));
            // Passed 'true' for Badges, and 'hks' for the default sort!
            showConciseView(`Full PvP Ladder (${sortedPvp.length})`, sortedPvp, false, true, 'hks');
            updateDropdownLabel('all');
            
        } else if (hash.startsWith('war-effort-')) {
            const type = hash.replace('war-effort-', '');
            
            const realNow = new Date();
            const berlinString = realNow.toLocaleString("en-US", {timeZone: "Europe/Berlin"});
            const berlinNow = new Date(berlinString);
            const lastReset = new Date(berlinNow);
            lastReset.setHours(0, 0, 0, 0);
            let day = lastReset.getDay();
            let diff = (day >= 2) ? (day - 2) : (day + 5); 
            lastReset.setDate(lastReset.getDate() - diff);
            const lastResetMs = lastReset.getTime();

            let filteredRoster = [];
            let title = "";
            window.warEffortContext = {}; // Initialize custom display context
            window.warEffortContextRaw = {}; // Initialize raw values for sorting

            if (type === 'hk') {
                filteredRoster = rosterData.filter(c => c.profile && (c.profile.trend_pvp || c.profile.trend_hks || 0) > 0);
                title = `🩸 Blood of the Enemy Contributors (${filteredRoster.length})`;
                // Note: The 'false' flag here hides the Class Badges
                showConciseView(title, filteredRoster, false, false, 'hks'); 
            } else {
                const contributors = new Set();
                if (typeof timelineData !== 'undefined') {
                    timelineData.forEach(e => {
                        let cleanTs = (e.timestamp || '').replace('Z', '+00:00');
                        if (!cleanTs.includes('+') && !cleanTs.includes('Z')) cleanTs += 'Z';
                        const eventDate = new Date(cleanTs).getTime();
                        if (eventDate >= lastResetMs) {
                            const cName = (e.character_name || '').toLowerCase();
                            
                            if (type === 'xp' && e.type === 'level_up') {
                                contributors.add(cName);
                                window.warEffortContext[cName] = (window.warEffortContext[cName] || 0) + 1;
                            }
                            if (type === 'loot' && e.type === 'item' && (e.item_quality === 'EPIC' || e.item_quality === 'LEGENDARY')) {
                                contributors.add(cName);
                                window.warEffortContext[cName] = window.warEffortContext[cName] || [];
                                const qColor = QUALITY_COLORS[e.item_quality] || '#a335ee';
                                window.warEffortContext[cName].push(`<a href="https://www.wowhead.com/wotlk/item=${e.item_id}" target="_blank" style="color:${qColor}; text-decoration:none;" onclick="event.stopPropagation();">[${e.item_name}]</a>`);
                            }
                            if (type === 'zenith' && e.type === 'level_up' && e.level === 70) {
                                contributors.add(cName);
                                const dateObj = new Date(cleanTs);
                                const dd = String(dateObj.getDate()).padStart(2, '0');
                                const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                                const yyyy = dateObj.getFullYear();
                                const HH = String(dateObj.getHours()).padStart(2, '0');
                                const MM = String(dateObj.getMinutes()).padStart(2, '0');
                                window.warEffortContext[cName] = `${dd}.${mm}.${yyyy} ${HH}:${MM}`;
                                window.warEffortContextRaw[cName] = dateObj.getTime(); // Store the raw timestamp for perfect sorting!
                            }
                        }
                    });
                }
                filteredRoster = rosterData.filter(c => c.profile && c.profile.name && contributors.has(c.profile.name.toLowerCase()));
                
                if (type === 'xp') title = `🛡️ Hero's Journey Contributors (${filteredRoster.length})`;
                if (type === 'loot') title = `🐉 Dragon's Hoard Contributors (${filteredRoster.length})`;
                if (type === 'zenith') title = `⚡ The Zenith Cohort (${filteredRoster.length})`;
                
                let sortPref = type === 'loot' ? 'ilvl' : 'level';
                // Note: The 'false' flag here hides the Class Badges
                showConciseView(title, filteredRoster, false, false, sortPref); 
            }
            
            // Explicitly hide timeline entirely for these pages
            if (timeline) timeline.style.display = 'none';
            
            updateDropdownLabel('all');
            
        } else {
            // Final fallback: Look for a specific character
            const char = rosterData.find(c => c.profile && c.profile.name && c.profile.name.toLowerCase() === hash);
            if (char) {
                showFullCardView(hash);
                updateDropdownLabel(hash);
            } else {
                showHomeView(); 
            }
        }
    }

    // Setup clickable stat boxes safely
    const statTotal = document.getElementById('stat-total');
    if (statTotal) statTotal.addEventListener('click', () => { window.location.hash = 'total'; });

    const statActive = document.getElementById('stat-active');
    if (statActive) statActive.addEventListener('click', () => { window.location.hash = 'active'; });

    const statRaidReady = document.getElementById('stat-raidready');
    if (statRaidReady) statRaidReady.addEventListener('click', () => { window.location.hash = 'raidready'; });

    // 🔥 RESTORED: Dynamic Home Page Class Pop-outs
    document.querySelectorAll('.clickable-class').forEach(badge => {
        badge.addEventListener('click', () => {
            const className = badge.id.replace('stats-', '');
            const formattedClass = className.charAt(0).toUpperCase() + className.slice(1);
            const cHex = CLASS_COLORS[formattedClass] || '#fff';

            if (window.activeClassExpanded === className) {
                document.getElementById('home-spec-container').style.display = 'none';
                badge.classList.remove('active-filter');
                window.activeClassExpanded = null;
                return;
            }

            document.querySelectorAll('.clickable-class').forEach(b => b.classList.remove('active-filter'));
            badge.classList.add('active-filter');
            window.activeClassExpanded = className;

            // USE RAW GUILD ROSTER HERE
            const classRosterRaw = rawGuildRoster.filter(c => (c.class || '').toLowerCase() === className);
            const specCounts = {};
            let unspeccedCount = 0;

            classRosterRaw.forEach(rawChar => {
                const fullChar = rosterData.find(c => c.profile && c.profile.name && c.profile.name.toLowerCase() === (rawChar.name || '').toLowerCase());
                const spec = (fullChar && fullChar.profile && fullChar.profile.active_spec) ? fullChar.profile.active_spec : null;
                if (spec) {
                    specCounts[spec] = (specCounts[spec] || 0) + 1;
                } else {
                    unspeccedCount++;
                }
            });

            const specContainer = document.getElementById('home-spec-container');
            let specHtml = `<div class="class-stat-container spec-filter-wrapper">`;

            specHtml += `
                <div class="stat-badge spec-btn" data-hash="class-${className}" style="border-color: ${cHex}; cursor: pointer; transform: scale(0.95); background: rgba(255,255,255,0.05);" title="View all ${formattedClass}s">
                    <span class="stat-badge-cls" style="color: ${cHex};">All ${formattedClass}s</span>
                    <span class="stat-badge-count">${classRosterRaw.length}</span>
                </div>`;
                
            Object.keys(specCounts).sort().forEach(spec => {
                const iconUrl = getSpecIcon(formattedClass, spec);
                const iconHtml = iconUrl ? `<img src="${iconUrl}" style="width:16px; height:16px; border-radius:50%; vertical-align:middle; margin-right:5px; border: 1px solid #222;">` : '';
                specHtml += `
                <div class="stat-badge spec-btn" data-hash="spec-${className}-${spec.toLowerCase().replace(/\s+/g, '')}" style="border-color: ${cHex}; cursor: pointer; transform: scale(0.95);" title="View ${spec} ${formattedClass}s">
                    <span class="stat-badge-cls" style="color: ${cHex}; display: flex; align-items: center;">${iconHtml}${spec}</span>
                    <span class="stat-badge-count">${specCounts[spec]}</span>
                </div>`;
            });

            if (unspeccedCount > 0) {
                 specHtml += `
                <div class="stat-badge spec-btn" data-hash="spec-${className}-unspecced" style="border-color: #888; cursor: pointer; transform: scale(0.95);" title="View Unspecced ${formattedClass}s">
                    <span class="stat-badge-cls" style="color: #888;">Unspecced</span>
                    <span class="stat-badge-count">${unspeccedCount}</span>
                </div>`;
            }

            specHtml += `</div>`;
            specContainer.innerHTML = specHtml;
            specContainer.style.display = 'block';

            document.querySelectorAll('.spec-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    window.location.hash = btn.getAttribute('data-hash');
                });
            });
        });
    });

    // Interactive Mouse Parallax for Embers
    document.addEventListener('mousemove', (e) => {
        const emberContainer = document.querySelector('.embers-container');
        if (emberContainer) {
            const xAxis = (window.innerWidth / 2 - e.pageX) / 40;
            const yAxis = (window.innerHeight / 2 - e.pageY) / 40;
            emberContainer.style.transform = `translate(${xAxis}px, ${yAxis}px)`;
        }
    });
    
    // ==========================================
    // 🌌 TBC ATMOSPHERE: NETHERSTORM (SPARKS ONLY)
    // ==========================================
    function initAtmosphere() {
        // 1. CANVAS FOR PHYSICS & PARTICLES
        const canvas = document.createElement('canvas');
        canvas.id = 'ember-canvas';
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.zIndex = '-2'; 
        canvas.style.pointerEvents = 'none'; 
        document.body.prepend(canvas);

        const ctx = canvas.getContext('2d');
        let width, height;
        let sparks = [];
        let windTime = 0;
        let windForce = 0;

        function resize() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resize);
        resize();

        let mouse = { x: null, y: null, radius: 150 };
        document.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
        document.addEventListener('mouseleave', () => { mouse.x = null; mouse.y = null; });

        // --- CLASS 1: FEL & NETHER SPARKS ---
        class Spark {
            constructor() {
                this.z = Math.random() * 0.8 + 0.2; 
                this.x = Math.random() * width;
                this.y = Math.random() * height + height; 
                this.size = (Math.random() * 2.5 + 1) * this.z; 
                this.speed = (Math.random() * 1.5 + 0.5) * this.z * 1.5; 
                this.angle = Math.random() * 360; 
                this.spin = (Math.random() - 0.5) * 0.05;
                this.opacity = (Math.random() * 0.8 + 0.2) * this.z;

                if (Math.random() > 0.4) {
                    this.coreColor = `rgba(180, 255, 180, ${this.opacity})`; 
                    this.glowColor = '#1eff00'; // Fel Green
                } else {
                    this.coreColor = `rgba(230, 180, 255, ${this.opacity})`; 
                    this.glowColor = '#a335ee'; // Nether Purple
                }
            }
            update() {
                this.y -= this.speed; 
                this.angle += this.spin;
                this.x += (Math.sin(this.angle) * 0.5 + windForce * 2.5) * this.z; 
                
                if (mouse.x != null) {
                    let dx = mouse.x - this.x;
                    let dy = mouse.y - this.y;
                    let distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < mouse.radius) {
                        const force = (mouse.radius - distance) / mouse.radius;
                        this.x -= (dx / distance) * force * 3 * this.z;
                        this.y -= (dy / distance) * force * 3 * this.z;
                    }
                }
                if (this.y < -20) {
                    this.y = height + 20;
                    this.x = Math.random() * width;
                    this.opacity = (Math.random() * 0.8 + 0.2) * this.z;
                }
            }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.shadowBlur = 12 * this.z; 
                ctx.shadowColor = this.glowColor; 
                ctx.fillStyle = this.coreColor;
                ctx.fill();
                ctx.shadowBlur = 0; 
            }
        }

        // Spawn Sparks
        for (let i = 0; i < 90; i++) sparks.push(new Spark()); 

        function animate() {
            ctx.clearRect(0, 0, width, height);

            windTime += 0.02;
            windForce = (Math.sin(windTime) * 0.5 + Math.sin(windTime * 0.3) * 0.8) * 0.6;

            // Draw Sparks
            for (let i = 0; i < sparks.length; i++) {
                sparks[i].update();
                sparks[i].draw();
            }

            requestAnimationFrame(animate);
        }
        animate();
    }

    initAtmosphere();

    // --- REUSABLE ROLE CHART GENERATOR ---
    function drawRoleChart(ctxId, characters, isRawMode) {
        const roleCounts = { "Tank": 0, "Healer": 0, "Melee DPS": 0, "Ranged DPS": 0 };
        characters.forEach(c => {
            const p = isRawMode ? rosterData.find(deep => deep.profile && deep.profile.name && deep.profile.name.toLowerCase() === (c.name || '').toLowerCase())?.profile : c.profile;
            if (!p || !p.active_spec) return;
            const spec = p.active_spec;
            const cClass = isRawMode ? (c.class || 'Unknown') : getCharClass(c);
            
            if (["Protection", "Blood"].includes(spec) || (cClass === "Druid" && spec === "Feral Combat")) roleCounts["Tank"]++;
            else if (["Holy", "Discipline", "Restoration"].includes(spec)) roleCounts["Healer"]++;
            else if (["Mage", "Warlock", "Hunter"].includes(cClass) || ["Balance", "Elemental", "Shadow"].includes(spec)) roleCounts["Ranged DPS"]++;
            else roleCounts["Melee DPS"]++;
        });

        const ctx = document.getElementById(ctxId);
        if (!ctx) return null;

        return new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(roleCounts),
                datasets: [{ 
                    data: Object.values(roleCounts), 
                    backgroundColor: ['#e74c3c', '#2ecc71', '#e67e22', '#3498db'], 
                    borderColor: '#111', borderWidth: 2 
                }]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, cutout: '60%', layout: { padding: { top: 20, bottom: 20 } },
                plugins: { legend: { position: 'bottom', labels: { color: '#bbb', font: { family: 'Cinzel' } } } },
                onClick: (event, elements, chart) => {
                    if (elements.length > 0) {
                        const clickedLabel = chart.data.labels[elements[0].index];
                        window.location.hash = 'filter-role-' + clickedLabel.toLowerCase().replace(/\s+/g, '-');
                    }
                },
                onHover: (event, elements) => {
                    event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
                }
            },
            plugins: [createPieOverlayPlugin()]
        });
    }

    function createDonutChart(ctxId, rosterToCount, isRawMode) {
        const counts = {};
        rosterToCount.forEach(char => {
            let cClass = isRawMode ? (char.class || 'Unknown') : getCharClass(char);
            if (cClass !== 'Unknown') counts[cClass] = (counts[cClass] || 0) + 1;
        });

        const sortedClasses = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
        const donutLabels = sortedClasses;
        const donutData = sortedClasses.map(cls => counts[cls]);
        const donutColors = sortedClasses.map(cls => CLASS_COLORS[cls] || '#888');

        const ctx = document.getElementById(ctxId);
        if (!ctx) return null;

        return new Chart(ctx, {
            type: 'doughnut',
            data: { labels: donutLabels, datasets: [{ data: donutData, backgroundColor: donutColors, borderColor: '#111', borderWidth: 2, hoverOffset: 6 }] },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '65%',
                onClick: (event, elements, chart) => {
                    if (elements.length > 0) {
                        // Get the name of the class that was clicked (e.g., "Paladin")
                        const clickedClass = chart.data.labels[elements[0].index];
                        const dynamicBadge = document.querySelector(`.dynamic-badge[data-class="${clickedClass}"]`);
                        
                        // If we are on a concise view with the class badges visible, trigger the in-place filter
                        if (dynamicBadge && document.getElementById('concise-view').style.display !== 'none') {
                            dynamicBadge.click(); 
                        } else {
                            // Otherwise (on the Home dashboard), route to the dedicated class roster page
                            window.location.hash = 'class-' + clickedClass.toLowerCase();
                        }
                    }
                },
                onHover: (event, elements) => {
                    // Change cursor to pointer when hovering over a slice
                    event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
                },
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#bbb', font: { family: 'Cinzel', size: 11 }, padding: 8, boxWidth: 12,
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                    return data.labels.map((label, i) => {
                                        const meta = chart.getDatasetMeta(0);
                                        const style = meta.controller.getStyle(i);
                                        const value = data.datasets[0].data[i];
                                        const pct = Math.round((value / total) * 100) + '%';
                                        return {
                                            text: `${label}: ${value} (${pct})`, // Visible Math
                                            fillStyle: style.backgroundColor, strokeStyle: style.borderColor,
                                            lineWidth: style.borderWidth, hidden: isNaN(value) || meta.data[i].hidden, index: i,
                                            fontColor: '#bbb' // Fixes the black text issue
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.9)', titleColor: '#fff', bodyFont: { family: 'Cinzel', size: 14, weight: 'bold' }, borderColor: '#ffd100', borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) label += ': ';
                                if (context.parsed !== null) {
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const pct = Math.round((context.parsed / total) * 100);
                                    label += context.parsed + ' (' + pct + '%)'; 
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }

    // ==========================================
    // UX ENHANCEMENT: Back to Top Button Logic
    // ==========================================
    const backToTopBtn = document.getElementById("backToTopBtn");
    if (backToTopBtn) {
        // Show button when user scrolls down 400px
        window.addEventListener('scroll', () => {
            if (document.body.scrollTop > 400 || document.documentElement.scrollTop > 400) {
                backToTopBtn.classList.add('show');
            } else {
                backToTopBtn.classList.remove('show');
            }
        });

        // Smooth scroll to top on click
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
            // Also reset focus to the top for Accessibility (a11y)
            document.body.focus();
        });
    }

    let timelineData = [];
    let filteredTimelineData = [];
    let currentTimelineIndex = 0;
    const timelineBatchSize = 50;

    async function fetchTimeline() {
        try {
            const cb = new Date().getTime();
            const response = await fetch(`asset/timeline.json?t=${cb}`);
            timelineData = await response.json();
            
            // --- FIX: Update Epic Loot KPI dynamically after fetch ---
            const kpiEpic = document.getElementById('kpi-epic-loot');
            if (kpiEpic) {
                let epicCount = 0;
                timelineData.forEach(e => {
                    if (e.type === 'item' && (e.item_quality === 'EPIC' || e.item_quality === 'LEGENDARY')) epicCount++;
                });
                kpiEpic.innerText = epicCount;
            }
            
            // Generate War Effort data first, then render the timeline feed
            if (typeof window.renderGuildXPBar === 'function') window.renderGuildXPBar(); 
            applyTimelineFilters();
            
            route();
            
        } catch (error) {
            console.error("Failed to load timeline data:", error);
        }
    }

    function renderTimelineBatch() {
        const container = document.getElementById('timeline-feed-container');
        const loadMoreBtn = document.getElementById('load-more-btn');
        
        if (!container) return;

        const endIndex = Math.min(currentTimelineIndex + timelineBatchSize, filteredTimelineData.length);
        
        for (let i = currentTimelineIndex; i < endIndex; i++) {
            const event = filteredTimelineData[i];
            
            const eventEl = document.createElement('div');
            
            // Monument rendering moved to dedicated feed.
            
            // Restored the proper concise-item class from your production site!
            eventEl.className = 'concise-item tt-char';
            eventEl.style.cursor = 'pointer';
            eventEl.onclick = () => selectCharacter((event.character_name || '').toLowerCase());
            
            eventEl.setAttribute('data-char', (event.character_name || '').toLowerCase());
            eventEl.setAttribute('data-class', event.class || 'Unknown');
            eventEl.setAttribute('data-event-type', event.type);
            eventEl.setAttribute('data-timestamp', event.timestamp);
            if (event.item_quality) {
                eventEl.setAttribute('data-quality', event.item_quality);
            }
            
            // Format the date to 24-hour clock (e.g., "24 Mar 14:30")
            let date_str = event.timestamp.substring(0, 10);
            try {
                const cleanTs = event.timestamp.replace('Z', '+00:00');
                const dt = new Date(cleanTs);
                if (!isNaN(dt.getTime())) {
                    date_str = dt.toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
                }
            } catch(e) {}
            
            const c_hex = CLASS_COLORS[event.class] || '#ffd100';
            const c_name = (event.character_name || 'Unknown').charAt(0).toUpperCase() + (event.character_name || '').slice(1).toLowerCase();
            
            if (event.type === 'badge') {
                eventEl.style.borderLeftColor = c_hex;
                let badgeIcon = '🎖️', badgeColor = '#aaa', badgeText = '';
                
                if (event.badge_type === 'mvp_pve') { badgeIcon = '👑'; badgeColor = '#ff8000'; badgeText = 'PvE MVP Champion'; }
                else if (event.badge_type === 'mvp_pvp') { badgeIcon = '⚔️'; badgeColor = '#ff4400'; badgeText = 'PvP MVP Champion'; }
                else if (event.badge_type === 'vanguard') { badgeIcon = '🌟'; badgeColor = '#00ffcc'; badgeText = 'Vanguard Status'; }
                else if (event.badge_type === 'campaign') { badgeIcon = '🎖️'; badgeColor = '#aaa'; badgeText = 'Campaign Participant'; }
                else if (event.badge_type === 'pve_gold') { badgeIcon = '🥇'; badgeColor = '#ffd700'; badgeText = 'PvE Ladder 1st Place'; }
                else if (event.badge_type === 'pve_silver') { badgeIcon = '🥈'; badgeColor = '#c0c0c0'; badgeText = 'PvE Ladder 2nd Place'; }
                else if (event.badge_type === 'pve_bronze') { badgeIcon = '🥉'; badgeColor = '#cd7f32'; badgeText = 'PvE Ladder 3rd Place'; }
                else if (event.badge_type === 'pvp_gold') { badgeIcon = '🥇'; badgeColor = '#ffd700'; badgeText = 'PvP Ladder 1st Place'; }
                else if (event.badge_type === 'pvp_silver') { badgeIcon = '🥈'; badgeColor = '#c0c0c0'; badgeText = 'PvP Ladder 2nd Place'; }
                else if (event.badge_type === 'pvp_bronze') { badgeIcon = '🥉'; badgeColor = '#cd7f32'; badgeText = 'PvP Ladder 3rd Place'; }
                
                eventEl.innerHTML = `
                    <div class="timeline-node" style="background: ${badgeColor}; box-shadow: 0 0 8px ${badgeColor};"></div>
                    <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                        <span style="color: ${c_hex}; font-family:'Cinzel'; font-weight:bold; font-size:15px; text-shadow:1px 1px 2px #000;">${c_name}</span>
                        <span style="color:#888; font-size:11px;">${date_str}</span>
                    </div>
                    <div class="event-box" style="border-left-color: ${badgeColor}; background: rgba(0,0,0,0.4);">
                        <span style="font-size: 16px; margin-right: 8px; filter: drop-shadow(0 0 3px ${badgeColor});">${badgeIcon}</span>
                        <span style="color: ${badgeColor}; font-weight: bold; text-shadow: 1px 1px 2px #000;">Awarded: ${badgeText} - ${event.category}</span>
                    </div>
                `;
            } else if (event.type === 'level_up') {
                eventEl.style.borderLeftColor = c_hex;
                eventEl.innerHTML = `
                    <div class="timeline-node" style="background: #ffd100; box-shadow: 0 0 8px #ffd100;"></div>
                    <div class="tl-event-header">
                        <span class="tl-event-name" style="color: ${c_hex};">${c_name}</span>
                        <span class="tl-event-date">${date_str}</span>
                    </div>
                    <div class="event-box" style="border-left-color: #ffd100;">
                        <span style="font-size: 14px;">⭐</span>
                        <span style="color: #ffd100; font-weight: bold; text-shadow: 1px 1px 2px #000;">Reached Level ${event.level}</span>
                    </div>
                `;
            } else {
                const q = event.item_quality || 'COMMON';
                const q_hex = QUALITY_COLORS[q] || '#ffffff';
                eventEl.style.borderLeftColor = q_hex;
                
                eventEl.innerHTML = `
                    <div class="timeline-node" style="background: ${q_hex}; box-shadow: 0 0 8px ${q_hex};"></div>
                    <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                        <span style="color: ${c_hex}; font-family:'Cinzel'; font-weight:bold; font-size:15px; text-shadow:1px 1px 2px #000;">${c_name}</span>
                        <span style="color:#888; font-size:11px;">${date_str}</span>
                    </div>
                    <div class="event-box" style="border-left-color: ${q_hex};">
                        <img src="${event.item_icon}" alt="icon">
                        <a href="https://www.wowhead.com/wotlk/item=${event.item_id}" target="_blank" onclick="event.stopPropagation();" style="color: ${q_hex}; font-weight:bold; text-decoration: none;">${event.item_name}</a>
                    </div>
                `;
            }
            
            container.appendChild(eventEl);
        }
        
        currentTimelineIndex = endIndex;
        
        if (currentTimelineIndex >= filteredTimelineData.length) {
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        } else {
            if (loadMoreBtn) loadMoreBtn.style.display = 'inline-block';
        }
        
        if (typeof setupTooltips === 'function') {
            setupTooltips();
        }
    }

    fetchTimeline();
    
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', renderTimelineBatch);
    }

    // --- NEW: Hamburger Menu Logic ---
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const navLinksContainer = document.querySelector('.nav-links-container');
    
    if (menuToggle && navLinksContainer) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            menuToggle.classList.toggle('open');
            navLinksContainer.classList.toggle('open');
        });
        
        document.querySelectorAll('.nav-links-container .nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                menuToggle.classList.remove('open');
                navLinksContainer.classList.remove('open');
            });
        });
        
        document.addEventListener('click', (e) => {
            if (navLinksContainer.classList.contains('open') && !menuToggle.contains(e.target) && !navLinksContainer.contains(e.target)) {
                menuToggle.classList.remove('open');
                navLinksContainer.classList.remove('open');
            }
        });
    }

    // ==========================================
    // ROLLING 7-DAY MVP LOGIC
    // ==========================================
    window.renderMVPs = function() {
        const mvpContainer = document.getElementById('weekly-mvps-container');
        const mvpPveList = document.getElementById('mvp-pve-list');
        const mvpPvpList = document.getElementById('mvp-pvp-list');
        
        if (!mvpContainer || !mvpPveList || !mvpPvpList) return;

        const topTrendPve = [...rosterData]
            .filter(c => c.profile && (c.profile.trend_pve || c.profile.trend_ilvl || 0) > 0)
            .sort((a, b) => (b.profile.trend_pve || b.profile.trend_ilvl || 0) - (a.profile.trend_pve || a.profile.trend_ilvl || 0))
            .slice(0, 3);

        const topTrendPvp = [...rosterData]
            .filter(c => c.profile && (c.profile.trend_pvp || c.profile.trend_hks || 0) > 0)
            .sort((a, b) => (b.profile.trend_pvp || b.profile.trend_hks || 0) - (a.profile.trend_pvp || a.profile.trend_hks || 0))
            .slice(0, 3);

        mvpContainer.style.display = 'block';

        function generateMvpHtml(chars, isPvp) {
            if (chars.length === 0) {
                const icon = isPvp ? '⚔️' : '🛡️';
                const action = isPvp ? 'get some HKs' : 'equip some upgrades';
                return `
                <div style="text-align:center; padding: 25px 10px; border: 1px dashed #555; border-radius: 8px; background: rgba(0,0,0,0.3); margin-top: 5px;">
                    <div style="font-size: 28px; margin-bottom: 12px; filter: grayscale(50%);">${icon}</div>
                    <div style="color:#ffd100; font-family: 'Cinzel'; font-size: 16px; margin-bottom: 6px; text-shadow: 1px 1px 2px #000;">The Week Just Started!</div>
                    <div style="color:#aaa; font-style:italic; font-size: 13px;">Log in and ${action} to claim the #1 spot.</div>
                </div>`;
            }
            
            const podiumBlocks = chars.map((char, index) => {
                const p = char.profile;
                const cClass = getCharClass(char);
                const cHex = CLASS_COLORS[cClass] || '#fff';
                const portraitURL = char.render_url || getClassIcon(cClass);
                const trend = isPvp ? (p.trend_pvp || p.trend_hks || 0) : (p.trend_pve || p.trend_ilvl || 0);
                const label = isPvp ? 'HKs' : 'iLvl';
                
                const rank = index + 1;
                // Assign unique step heights & flex-orders based on rank
                const stepClass = rank === 1 ? 'podium-step-1' : (rank === 2 ? 'podium-step-2' : 'podium-step-3');
                const rankColor = rank === 1 ? '#ffd100' : (rank === 2 ? '#c0c0c0' : '#cd7f32');
                
                return `
                <div class="podium-block ${stepClass} tt-char" data-char="${(p.name || '').toLowerCase()}" onclick="selectCharacter('${(p.name || '').toLowerCase()}')" style="border-top: 3px solid ${cHex};">
                    <img src="${portraitURL}" class="podium-avatar" style="border-color: ${cHex};">
                    <div class="podium-rank" style="color: ${rankColor};">#${rank}</div>
                    <div style="color: ${cHex}; font-family: 'Cinzel'; font-weight: bold; font-size: 13px; text-shadow: 1px 1px 2px #000; z-index: 2; margin-bottom: 4px; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</div>
                    <div style="color: #2ecc71; font-weight: bold; font-size: 12px; text-shadow: 1px 1px 2px #000; z-index: 2;">
                        ▲ ${trend.toLocaleString()} <span style="font-size:9px; color:#888; text-transform:uppercase;">${label}</span>
                    </div>
                </div>`;
            }).join('');

            return `<div class="mvp-podium-container">${podiumBlocks}</div>`;
        }

        function generateGloatingHtml(mvpData, isPvp) {
            const label = isPvp ? 'HKs' : 'iLvl';
            
            // If there is no previous MVP data, return a sleek placeholder
            if (!mvpData || !mvpData.name) {
                return `
                <div style="background: rgba(255, 209, 0, 0.02); border: 1px dashed rgba(255, 209, 0, 0.3); border-radius: 8px; padding: 10px; margin-bottom: 12px; display: flex; align-items: center;">
                    <div style="margin-right: 12px; font-size: 22px; filter: grayscale(100%); opacity: 0.5;">👑</div>
                    <div style="width: 32px; height: 32px; border-radius: 50%; border: 2px dashed #555; background: rgba(0,0,0,0.5); margin-right: 12px; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #555;">?</div>
                    <div style="flex: 1; display: flex; flex-direction: column;">
                        <span style="color: #888; font-family: 'Cinzel'; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Reigning Champion</span>
                        <span style="color: #aaa; font-family: 'Cinzel'; font-weight: bold; font-size: 15px; font-style: italic;">Awaiting Data</span>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; opacity: 0.5;">
                        <span style="color: #888; font-size: 10px;">Last Week's ${label}</span>
                    </div>
                </div>`;
            }

            // If we have a champion, render their actual banner
            const char = rosterData.find(c => c.profile && c.profile.name && c.profile.name.toLowerCase() === mvpData.name.toLowerCase());
            
            // Fallback in case the winning character left the guild
            if (!char) return ''; 
            
            const p = char.profile;
            const cClass = getCharClass(char);
            const cHex = CLASS_COLORS[cClass] || '#fff';
            const portraitURL = char.render_url || getClassIcon(cClass);
            
            return `
            <div style="background: rgba(255, 209, 0, 0.05); border: 1px solid rgba(255, 209, 0, 0.5); border-radius: 8px; padding: 10px; margin-bottom: 12px; display: flex; align-items: center; box-shadow: 0 0 10px rgba(255, 209, 0, 0.1);">
                <div style="margin-right: 12px; font-size: 22px; filter: drop-shadow(0 0 5px #ffd100);">👑</div>
                <img src="${portraitURL}" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid #ffd100; object-fit: cover; margin-right: 12px; cursor: pointer;" onclick="selectCharacter('${p.name.toLowerCase()}')">
                <div style="flex: 1; display: flex; flex-direction: column;">
                    <span style="color: #ffd100; font-family: 'Cinzel'; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Reigning Champion</span>
                    <span style="color: ${cHex}; font-family: 'Cinzel'; font-weight: bold; font-size: 15px; text-shadow: 1px 1px 2px #000; cursor: pointer;" onclick="selectCharacter('${p.name.toLowerCase()}')">${p.name}</span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                    <span style="color: #fff; font-weight: bold; font-size: 15px; text-shadow: 1px 1px 2px #000;">+${mvpData.score.toLocaleString()}</span>
                    <span style="font-size: 10px; color: #aaa;">Last Week's ${label}</span>
                </div>
            </div>`;
        }

        const prevMvps = config.prev_mvps || {};
        const pveGloat = generateGloatingHtml(prevMvps.pve, false);
        const pvpGloat = generateGloatingHtml(prevMvps.pvp, true);

        mvpPveList.innerHTML = pveGloat + generateMvpHtml(topTrendPve, false);
        mvpPvpList.innerHTML = pvpGloat + generateMvpHtml(topTrendPvp, true);

        // Re-bind tooltips to the newly injected MVP elements
        if (typeof setupTooltips === 'function') {
            setupTooltips();
        }
    };

    // ==========================================
    // WEEKLY GUILD WAR EFFORT LOGIC
    // ==========================================
    window.renderGuildXPBar = function() {
        const xpContainer = document.getElementById('guild-xp-container');
        if (!xpContainer || !timelineData || timelineData.length === 0) return;

        // --- Live Countdown Timer Logic ---
        let countdownEl = document.getElementById('war-effort-countdown');
        if (!countdownEl) {
            countdownEl = document.createElement('div');
            countdownEl.id = 'war-effort-countdown';
            countdownEl.style.textAlign = 'center';
            countdownEl.style.marginBottom = '25px';
            
            // Insert it between the H3 title and the progress bars
            xpContainer.insertBefore(countdownEl, xpContainer.children[1]);

            function updateWarEffortCountdown() {
                const realNow = new Date();
                const berlinString = realNow.toLocaleString("en-US", {timeZone: "Europe/Berlin"});
                const berlinNow = new Date(berlinString);
                
                const nextResetBerlin = new Date(berlinNow);
                nextResetBerlin.setHours(0, 0, 0, 0);
                
                let day = nextResetBerlin.getDay();
                let diff = (2 - day + 7) % 7; 
                
                if (diff === 0 && berlinNow > nextResetBerlin) {
                    diff = 7;
                }
                nextResetBerlin.setDate(nextResetBerlin.getDate() + diff);

                const timeLeft = nextResetBerlin - berlinNow;
                
                const d = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const h = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((timeLeft % (1000 * 60)) / 1000);

                const el = document.getElementById('war-effort-countdown');
                if (el) {
                    el.innerHTML = `
                        <div style="background: rgba(0, 0, 0, 0.6); border: 1px solid rgba(255, 209, 0, 0.2); padding: 8px 18px; border-radius: 6px; display: inline-block; box-shadow: inset 0 0 15px rgba(0,0,0,0.9), 0 2px 5px rgba(0,0,0,0.5);">
                            <span style="color:#c0c0c0; font-family: 'Cinzel', serif; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; text-shadow: 1px 1px 2px #000;">Next Weekly Reset: </span>
                            <span style="color:#ff8000; font-family: 'Cinzel', serif; font-weight:bold; font-size: 18px; text-shadow: 0 0 8px rgba(255, 128, 0, 0.6), 1px 1px 2px #000; margin-left: 6px;">
                            ${d}d ${h}h ${m}m ${s}s</span>
                        </div>`;
                }
            }

            setInterval(updateWarEffortCountdown, 1000);
            updateWarEffortCountdown();
        }

        // 1. Calculate the Berlin Time Reset Anchor
        const realNow = new Date();
        const berlinString = realNow.toLocaleString("en-US", {timeZone: "Europe/Berlin"});
        const berlinNow = new Date(berlinString);
        
        const lastReset = new Date(berlinNow);
        lastReset.setHours(0, 0, 0, 0);
        let day = lastReset.getDay();
        let diff = (day >= 2) ? (day - 2) : (day + 5); 
        lastReset.setDate(lastReset.getDate() - diff);
        const lastResetMs = lastReset.getTime();

        // 2. Tally Leveling Effort & Zenith (From Timeline)
        let totalLevels = 0;
        let totalZenith = 0;
        const levelContributors = {};
        const zenithContributors = {};
        
        timelineData.forEach(event => {
            if (event.type === 'level_up') {
                let cleanTs = event.timestamp.replace('Z', '+00:00');
                if (!cleanTs.includes('+') && !cleanTs.includes('Z')) cleanTs += 'Z';
                const eventDate = new Date(cleanTs).getTime();
                
                if (eventDate >= lastResetMs) {
                    totalLevels++;
                    const charName = event.character_name || 'Unknown';
                    levelContributors[charName] = (levelContributors[charName] || 0) + 1;
                    
                    if (event.level === 70) {
                        totalZenith++;
                        zenithContributors[charName] = (zenithContributors[charName] || 0) + 1;
                    }
                }
            }
        });

        // 3. Tally PvP Effort (From 7-Day Roster Trends)
        let totalHks = 0;
        const hkContributors = {};
        rosterData.forEach(c => {
            if (c.profile) {
                const trend = c.profile.trend_pvp || c.profile.trend_hks || 0;
                if (trend > 0) {
                    totalHks += trend;
                    const charName = c.profile.name || 'Unknown';
                    hkContributors[charName] = trend;
                }
            }
        });

        // 3b. Tally Dragon's Hoard (Epic Loot from Timeline)
        let totalLoot = 0;
        const lootContributors = {};
        timelineData.forEach(event => {
            if (event.type === 'item' && (event.item_quality === 'EPIC' || event.item_quality === 'LEGENDARY')) {
                let cleanTs = event.timestamp.replace('Z', '+00:00');
                if (!cleanTs.includes('+') && !cleanTs.includes('Z')) cleanTs += 'Z';
                const eventDate = new Date(cleanTs).getTime();
                
                if (eventDate >= lastResetMs) {
                    totalLoot++;
                    const charName = event.character_name || 'Unknown';
                    lootContributors[charName] = (lootContributors[charName] || 0) + 1;
                }
            }
        });

        // 5. Render the Bars
        function renderBar(fillId, textId, currentVal, maxVal, type) {
            const pct = Math.min((currentVal / maxVal) * 100, 100);
            const fillEl = document.getElementById(fillId);
            const textEl = document.getElementById(textId);
            const dynamicGlow = 10 + (pct * 0.25);
            
            let colorBase, colorMid, colorMax, labelName, glowColor;
            if (type === 'XP') {
                colorBase = '#8B6508'; colorMid = '#ffd100'; colorMax = '#ff8000'; labelName = 'Levels'; glowColor = '#ffd100';
            } else if (type === 'HK') {
                colorBase = '#8B0000'; colorMid = '#e74c3c'; colorMax = '#ff4400'; labelName = 'HKs'; glowColor = '#ff0000';
            } else if (type === 'LOOT') {
                colorBase = '#4b0082'; colorMid = '#a335ee'; colorMax = '#ff8000'; labelName = 'Epics'; glowColor = '#ff8000';
            } else { // ZENITH
                colorBase = '#006064'; colorMid = '#3FC7EB'; colorMax = '#00e5ff'; labelName = 'Max Levels'; glowColor = '#00e5ff';
            }

            if (fillEl) {
                setTimeout(() => { 
                    fillEl.style.width = pct + '%'; 
                    if (pct >= 100) {
                        // Toned down 100% state: Natural colors, softer shadow, and a slower pulse
                        fillEl.style.background = `linear-gradient(90deg, ${colorBase}, ${colorMax})`;
                        fillEl.style.boxShadow = `0 0 20px ${colorMax}`;
                        fillEl.style.animation = `pulseMax${type} 1.5s infinite alternate`;
                    } else if (pct >= 75) {
                        fillEl.style.background = `linear-gradient(90deg, ${colorBase}, ${colorMax})`;
                        fillEl.style.boxShadow = `0 0 ${dynamicGlow}px ${colorMax}`;
                        fillEl.style.animation = `pulseFast${type} 0.8s infinite alternate`;
                    } else if (pct >= 30) {
                        fillEl.style.background = `linear-gradient(90deg, ${colorBase}, ${colorMid})`;
                        fillEl.style.boxShadow = `0 0 ${dynamicGlow}px ${colorMid}`;
                        fillEl.style.animation = `pulseSlow${type} 1.5s infinite alternate`;
                    } else {
                        fillEl.style.background = `linear-gradient(90deg, #333, ${colorBase})`;
                        fillEl.style.boxShadow = `0 0 ${dynamicGlow}px rgba(255, 255, 255, 0.2)`;
                        fillEl.style.animation = 'none';
                    }
                }, 100);
            }
            
            if (textEl) {
                if (pct >= 100) {
                    textEl.innerHTML = `<span style="color:#ddd; margin-right:8px;">${labelName}:</span> ${currentVal.toLocaleString()} / ${maxVal.toLocaleString()} <span style="color:#fff; margin-left:8px; text-shadow: 0 0 10px ${colorMax};">🔥 CRUSHED!</span>`;
                    textEl.style.color = colorMid;
                    textEl.style.textShadow = `0 0 8px rgba(0,0,0,0.8), 1px 1px 2px #000`;
                } else {
                    textEl.innerHTML = `<span style="color:#ccc; font-size:11px; margin-right:8px; text-transform:uppercase;">${labelName}:</span> <span style="font-size:15px;">${currentVal.toLocaleString()} / ${maxVal.toLocaleString()}</span>`;
                }
            }
        }

        renderBar('guild-xp-fill', 'guild-xp-text', totalLevels, 750, 'XP');
        renderBar('guild-hk-fill', 'guild-hk-text', totalHks, 500, 'HK');
        renderBar('guild-loot-fill', 'guild-loot-text', totalLoot, 100, 'LOOT');
        renderBar('guild-zenith-fill', 'guild-zenith-text', totalZenith, 10, 'ZENITH');

        // --- NEW: VANGUARD AURA & TIMELINE MONUMENT CALCULATION ---
        window.warEffortVanguards = { xp: [], hk: [], loot: [], zenith: [] };
        window.warEffortMonuments = [];
        window.warEffortLockTimes = {}; // <-- NEW: Store the exact time it locked

        function applyLockFallback(type, fallbackMon, dynVanguards) {
            if (warEffortLocks[type]) {
                window.warEffortVanguards[type] = warEffortLocks[type].vanguards;
                window.warEffortMonuments.push(warEffortLocks[type].monument);
                window.warEffortLockTimes[type] = warEffortLocks[type].monument.timestamp;
            } else if (fallbackMon) {
                window.warEffortVanguards[type] = dynVanguards;
                window.warEffortMonuments.push(fallbackMon);
                window.warEffortLockTimes[type] = fallbackMon.timestamp;
            }
        }

        if (totalLevels >= 750) {
            const topDyn = Object.entries(levelContributors).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0].toLowerCase());
            let fallback = null;
            const sortedXP = timelineData.filter(e => e.type === 'level_up' && new Date((e.timestamp || '').replace('Z', '+00:00')).getTime() >= lastResetMs).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            if (sortedXP[749]) fallback = { title: "🛡️ Hero's Journey", desc: `<span style="color:#ffd100; font-weight:bold;">${sortedXP[749].character_name}</span> hit the 750th level!`, timestamp: sortedXP[749].timestamp };
            applyLockFallback('xp', fallback, topDyn);
        }

        if (totalHks >= 500) {
            const topPvpers = Object.entries(hkContributors).sort((a,b)=>b[1]-a[1]);
            const topDyn = topPvpers.slice(0,3).map(x=>x[0].toLowerCase());
            let fallback = null;
            if (topPvpers.length > 0) fallback = { title: "🩸 Blood of the Enemy", desc: `<span style="color:#ff4400; font-weight:bold;">${topPvpers[0][0].charAt(0).toUpperCase() + topPvpers[0][0].slice(1)}</span> led the 500 HK charge!`, timestamp: new Date().toISOString() };
            applyLockFallback('hk', fallback, topDyn);
        }

        if (totalLoot >= 100) {
            const topDyn = Object.entries(lootContributors).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0].toLowerCase());
            let fallback = null;
            const sortedLoot = timelineData.filter(e => e.type === 'item' && (e.item_quality === 'EPIC' || e.item_quality === 'LEGENDARY') && new Date((e.timestamp || '').replace('Z', '+00:00')).getTime() >= lastResetMs).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            if (sortedLoot[99]) fallback = { title: "🐉 Dragon's Hoard", desc: `<span style="color:#a335ee; font-weight:bold;">${sortedLoot[99].character_name}</span> looted the 100th Epic!`, timestamp: sortedLoot[99].timestamp };
            applyLockFallback('loot', fallback, topDyn);
        }

        if (totalZenith >= 10) {
            const sortedZenithAsc = timelineData.filter(e => e.type === 'level_up' && e.level === 70 && new Date((e.timestamp || '').replace('Z', '+00:00')).getTime() >= lastResetMs).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            const uniqueZ = [];
            sortedZenithAsc.forEach(e => {
                const n = (e.character_name || '').toLowerCase();
                if(n && !uniqueZ.includes(n)) uniqueZ.push(n);
            });
            
            const topDyn = uniqueZ.slice(0,3);
            let fallback = null;
            if (uniqueZ[9]) fallback = { title: "⚡ The Zenith Cohort", desc: `<span style="color:#3FC7EB; font-weight:bold;">${uniqueZ[9].charAt(0).toUpperCase() + uniqueZ[9].slice(1)}</span> was the 10th Level 70!`, timestamp: new Date().toISOString() };
            applyLockFallback('zenith', fallback, topDyn);
        }
        
        // --- NEW: COMPACT MONUMENTS GRID FEED ---
        const timelineEl = document.getElementById('timeline');
        if (timelineEl) {
            let monContainer = document.getElementById('monuments-container');
            if (!monContainer) {
                monContainer = document.createElement('div');
                monContainer.id = 'monuments-container';
                monContainer.className = 'monuments-grid';
                const filtersEl = timelineEl.querySelector('.timeline-filters');
                if (filtersEl) timelineEl.insertBefore(monContainer, filtersEl);
                else timelineEl.prepend(monContainer);
            }
            
            monContainer.innerHTML = '';
            if (window.warEffortMonuments.length > 0) {
                window.warEffortMonuments.forEach(mon => {
                    const eventEl = document.createElement('div');
                    eventEl.className = 'monument-card';
                    const dt = new Date(mon.timestamp);
                    const timeStr = isNaN(dt) ? '' : dt.toLocaleString('en-GB', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false}).replace(',', '');
                    eventEl.innerHTML = `
                        <div class="mon-header">
                            <span class="mon-icon">🏆</span>
                            <span class="mon-time">${timeStr}</span>
                        </div>
                        <div class="mon-title">${mon.title}</div>
                        <div class="mon-desc">${mon.desc}</div>
                    `;
                    monContainer.appendChild(eventEl);
                });
            }
        }

        // 6. Tooltip Generator Helper (Updated to Route on Click)
        function bindTooltip(triggerId, contributorsDict, titleText, labelText) {
            const tooltipTrigger = document.getElementById(triggerId);
            if (!tooltipTrigger) return;
            
            const sortedContributors = Object.entries(contributorsDict).sort((a, b) => b[1] - a[1]);
            let tooltipHtml = `<div style="font-family:'Cinzel'; color:#ffd100; font-weight:bold; margin-bottom:8px; border-bottom:1px solid #555; padding-bottom:4px;">${titleText}</div>`;
            
            if (sortedContributors.length === 0) {
                tooltipHtml += `<div style="color:#aaa; font-style:italic;">The challenges just began!</div>`;
            } else {
                const topList = sortedContributors.slice(0, 15);
                topList.forEach(([name, count], index) => {
                    const charData = rosterData.find(c => c.profile && c.profile.name && c.profile.name.toLowerCase() === name.toLowerCase());
                    const cClass = charData ? getCharClass(charData) : 'Unknown';
                    const cHex = CLASS_COLORS[cClass] || '#fff';
                    const formattedName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
                    
                    tooltipHtml += `
                    <div style="display:flex; justify-content:space-between; margin-bottom: 4px; font-size:13px; gap: 35px;">
                        <span style="color:${cHex};">${index + 1}. ${formattedName}</span>
                        <span style="color:#fff; font-weight:bold;">+${count.toLocaleString()}</span>
                    </div>`;
                });
                
                if (sortedContributors.length > 15) {
                    const remaining = sortedContributors.slice(15).reduce((sum, [_, count]) => sum + count, 0);
                    tooltipHtml += `<div style="color:#888; font-style:italic; font-size:11px; text-align:right; margin-top:6px; border-top:1px dashed #444; padding-top:4px;">...and +${remaining.toLocaleString()} more ${labelText}!</div>`;
                }
            }

            const newTrigger = tooltipTrigger.cloneNode(true);
            tooltipTrigger.parentNode.replaceChild(newTrigger, tooltipTrigger);
            
            function displayTooltip(clientX, clientY) {
                tooltip.innerHTML = tooltipHtml;
                tooltip.style.borderLeftColor = '#ffd100';
                let x = clientX + 15;
                let y = clientY + 15;
                if (x + 250 > window.innerWidth) x = window.innerWidth - 260; 
                tooltip.style.left = `${x}px`; 
                tooltip.style.top = `${y}px`;
                tooltip.classList.add('visible');
            }

            newTrigger.addEventListener('mousemove', e => displayTooltip(e.clientX, e.clientY));
            newTrigger.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
            
            // --- NEW: Interactive Navigation ---
            newTrigger.addEventListener('click', e => {
                e.stopPropagation();
                tooltip.classList.remove('visible');
                
                if (triggerId === 'guild-xp-tooltip-trigger') window.location.hash = 'war-effort-xp';
                else if (triggerId === 'guild-hk-tooltip-trigger') window.location.hash = 'war-effort-hk';
                else if (triggerId === 'guild-loot-tooltip-trigger') window.location.hash = 'war-effort-loot';
                else if (triggerId === 'guild-zenith-tooltip-trigger') window.location.hash = 'war-effort-zenith';
            });
        }

        bindTooltip('guild-xp-tooltip-trigger', levelContributors, "Top Leveling Heroes", "levels");
        bindTooltip('guild-hk-tooltip-trigger', hkContributors, "Top PvP Slayers", "HKs");
        bindTooltip('guild-loot-tooltip-trigger', lootContributors, "Top Treasure Hunters", "Epics");
        bindTooltip('guild-zenith-tooltip-trigger', zenithContributors, "The Zenith Cohort", "Max Levels");
    };

    window.addEventListener('hashchange', route);
});