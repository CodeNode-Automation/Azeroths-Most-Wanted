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

// NEW: Added 'async' so we can fetch the external files
window.addEventListener('DOMContentLoaded', async () => {

    const config = JSON.parse(document.getElementById('dashboard-config').textContent);
    const heatmapData = JSON.parse(document.getElementById('heatmap-data').textContent);
    
    // NEW: Download the heavy roster files silently in the background with error handling
    let rosterData = [];
    let rawGuildRoster = [];
    try {
        const rosterRes = await fetch('asset/roster.json');
        rosterData = await rosterRes.json();
        
        const rawRes = await fetch('asset/raw_roster.json');
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
                        <div class="autocomplete-item" onclick="selectCharacter('${c.profile.name.toLowerCase()}')" style="border-left: 3px solid ${cHex}; padding: 12px;">
                            <img src="${c.render_url || getClassIcon(cClass)}" class="ac-icon" style="border-color: ${cHex};">
                            <div class="ac-info"><span class="ac-name" style="color: ${cHex}; font-size: 16px;">${c.profile.name}</span><span class="ac-meta">Level ${c.profile.level} ${cClass}</span></div>
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
                    <div style="padding: 20px 10px; text-align: center; display: flex; flex-direction: column; align-items: center;">
                        <img src="https://wow.zamimg.com/images/wow/icons/large/inv_misc_head_murloc_01.jpg" loading="lazy" style="width: 32px; height: 32px; border-radius: 4px; filter: grayscale(100%); margin-bottom: 8px;">
                        <span style="color: #aaa; font-style: italic; font-size: 13px;">No heroes found... Mrgrlrl!</span>
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

        // --- NEW: Class Distribution Donut Chart ---
        if (mainDonutChartInstance) mainDonutChartInstance.destroy();
        mainDonutChartInstance = createDonutChart('classDonutChart', rawGuildRoster, true);

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
            <div class="heatmap-col">
                <span class="heatmap-label">${day.day_name}</span>
                <div class="heatmap-cell tt-heatmap" data-lvl="${lvl}" data-date="${dateStr}" data-rawdate="${day.date}" data-count="${day.count}"></div>
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
                    <div style="font-family:'Cinzel'; font-weight:bold; color:${color}; font-size:16px; margin-bottom:4px;">${count} Activities</div>
                    <div style="color:#aaa; font-size:12px;">${dateStr}</div>
                    <div style="color:#666; font-size:10px; margin-top:6px; font-style:italic;">Click to filter timeline</div>
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
            const specIconHtml = specIconUrl ? `<img src="${specIconUrl}" style="width: 12px; height: 12px; border-radius: 50%; vertical-align: middle; margin-right: 3px; border: 1px solid #222;">` : '';
            const displaySpecClass = activeSpec ? `${activeSpec} ${cClass}` : cClass;

            let podiumClass = index === 0 ? 'podium-1' : index === 1 ? 'podium-2' : index === 2 ? 'podium-3' : '';
            const rankColor = index === 0 ? '#ffd100' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#777';
            const rankSize = index < 3 ? '18px' : '15px';
            const portraitURL = char.render_url || getClassIcon(cClass);

            pveHTML += `
            <div class="pvp-row tt-char ${podiumClass}" data-char="${(p.name || '').toLowerCase()}" onclick="selectCharacter('${(p.name || '').toLowerCase()}')" style="border-left: 4px solid ${cHex}; padding: 8px 12px;">
                <div style="color: ${rankColor}; font-family: 'Cinzel'; font-weight: bold; font-size: ${rankSize}; width: 30px; text-shadow: 1px 1px 2px #000;">#${index + 1}</div>
                <img src="${portraitURL}" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid ${cHex}; object-fit: cover; margin-right: 12px;">
                <div style="flex: 1; display: flex; flex-direction: column;">
                    <span style="color: ${cHex}; font-family: 'Cinzel'; font-weight: bold; font-size: 14px; text-shadow: 1px 1px 2px #000;">${p.name}</span>
                    <span style="color: #aaa; font-size: 10px; font-style: italic;">${specIconHtml}${displaySpecClass}</span>
                </div>
                <div style="display: flex; align-items: center; color: #ff8000; font-weight: bold; font-size: 15px; text-shadow: 1px 1px 2px #000;">
                    ${p.equipped_item_level || 0} <span style="font-size:10px; color:#888; margin-left: 3px;">iLvl</span>
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
            const specIconHtml = specIconUrl ? `<img src="${specIconUrl}" style="width: 12px; height: 12px; border-radius: 50%; vertical-align: middle; margin-right: 3px; border: 1px solid #222;">` : '';
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
            <div class="pvp-row tt-char ${podiumClass}" data-char="${(p.name || '').toLowerCase()}" onclick="selectCharacter('${(p.name || '').toLowerCase()}')" style="border-left: 4px solid ${cHex}; padding: 8px 12px;">
                <div style="color: ${rankColor}; font-family: 'Cinzel'; font-weight: bold; font-size: ${rankSize}; width: 30px; text-shadow: 1px 1px 2px #000;">#${index + 1}</div>
                <img src="${portraitURL}" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid ${cHex}; object-fit: cover; margin-right: 12px;">
                <div style="flex: 1; display: flex; flex-direction: column;">
                    <span style="color: ${cHex}; font-family: 'Cinzel'; font-weight: bold; font-size: 14px; text-shadow: 1px 1px 2px #000;">${p.name}</span>
                    <span style="color: #aaa; font-size: 10px; font-style: italic;">${specIconHtml}${displaySpecClass}</span>
                </div>
                <div style="display: flex; align-items: center; color: #ff4400; font-weight: bold; font-size: 15px; text-shadow: 1px 1px 2px #000;">
                    ${hkCount} <span style="font-size:10px; color:#888; margin-left: 3px;">HKs</span>
                    ${trendHTML}
                </div>
            </div>`;
        });
        pvpContainer.innerHTML = pvpHTML;
    }
    
    setupTooltips();

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
        const strVal = (st.strength && st.strength.effective) || 0;
        const agiVal = (st.agility && st.agility.effective) || 0;
        const staVal = (st.stamina && st.stamina.effective) || 0;
        const intVal = (st.intellect && st.intellect.effective) || 0;
        const spiVal = (st.spirit && st.spirit.effective) || 0;
        const raceName = p.race && p.race.name ? (typeof p.race.name === 'string' ? p.race.name : (p.race.name.en_US || 'Unknown')) : 'Unknown';
        
        const armor = (st.armor && st.armor.effective) || 0;
        const defense = (st.defense && st.defense.effective) || 0;
        const ap = st.attack_power || 0;
        const spellPower = st.spell_power || 0;
        const meleeCrit = (st.melee_crit && st.melee_crit.value) ? st.melee_crit.value.toFixed(2) + '%' : '0%';
        const spellCrit = (st.spell_crit && st.spell_crit.value) ? st.spell_crit.value.toFixed(2) + '%' : '0%';
        const manaRegen = st.mana_regen ? Math.round(st.mana_regen) : 0;
        const dodge = (st.dodge && st.dodge.value) ? st.dodge.value.toFixed(2) + '%' : '0%';

        let advancedStatsHtml = `<div style="border-top:1px solid rgba(255,255,255,0.1); margin: 15px 0; padding-top: 15px;"></div>`;
        advancedStatsHtml += `<div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:8px;"><span style="color:#bbb;">🛡️ Armor</span><span style="color:#fff; font-weight:bold;">${armor.toLocaleString()}</span></div>`;
        if (defense > 0) advancedStatsHtml += `<div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:8px;"><span style="color:#bbb;">🧱 Defense</span><span style="color:#fff; font-weight:bold;">${defense}</span></div>`;
        if (st.dodge && st.dodge.value > 0) advancedStatsHtml += `<div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:8px;"><span style="color:#bbb;">🤸 Dodge</span><span style="color:#fff; font-weight:bold;">${dodge}</span></div>`;
        if (ap > 0) advancedStatsHtml += `<div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:8px;"><span style="color:#bbb;">⚔️ Attack Power</span><span style="color:#e67e22; font-weight:bold;">${ap}</span></div>`;
        if (st.melee_crit && st.melee_crit.value > 0) advancedStatsHtml += `<div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:8px;"><span style="color:#bbb;">🩸 Melee Crit</span><span style="color:#e74c3c; font-weight:bold;">${meleeCrit}</span></div>`;
        if (spellPower > 0) advancedStatsHtml += `<div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:8px;"><span style="color:#bbb;">✨ Spell Power</span><span style="color:#3498db; font-weight:bold;">${spellPower}</span></div>`;
        if (st.spell_crit && st.spell_crit.value > 0) advancedStatsHtml += `<div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:8px;"><span style="color:#bbb;">🔥 Spell Crit</span><span style="color:#f1c40f; font-weight:bold;">${spellCrit}</span></div>`;
        if (manaRegen > 0) advancedStatsHtml += `<div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:8px;"><span style="color:#bbb;">💧 Mana Regen</span><span style="color:#1abc9c; font-weight:bold;">${manaRegen}</span></div>`;

        const hks = p.honorable_kills || 0;
        const hkBadge = hks > 0 ? `<span class="badge" style="background:rgba(0,0,0,0.7); border:1px solid #ff4400; padding:5px 14px; border-radius:20px; font-size:14px; color:#ff4400; box-shadow:0 0 5px rgba(255,68,0,0.5);">⚔️ ${hks.toLocaleString()} HKs</span>` : '';
        
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
                <div class="item-slot empty-slot" style="border-left-color:#333; opacity:0.6;">
                    <img src="https://wow.zamimg.com/images/wow/icons/large/${emptyIcon}.jpg" style="filter:grayscale(100%); border-color:#222;">
                    <span style="color:#666; font-size:13px; font-weight:bold; font-style:italic;">Empty Slot</span>
                </div>`;
            }
        });

        // --- NEW: Grab the Guild Rank ---
        const guildRank = p.guild_rank || 'Member';

        return `
<div class="char-card ${factionCls}" style="border-top-color:${cHex};">
    <div style="text-align:center; margin-bottom:25px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:20px;">
        <h2 style="color:${cHex}; font-family:Cinzel; font-size:38px; margin:0; text-shadow:0 2px 4px #000;">${p.name || 'Unknown'}</h2>
        <div style="display:flex; justify-content:center; gap:10px; margin-top:12px; flex-wrap:wrap;">
            <span class="badge" style="background:rgba(0,0,0,0.7); border:1px solid #ffd100; padding:5px 14px; border-radius:20px; font-size:14px; color:#ffd100; text-shadow: 1px 1px 2px #000;">🛡️ ${guildRank}</span>
            <span class="badge" style="background:rgba(0,0,0,0.7); border:1px solid rgba(255,255,255,0.2); padding:5px 14px; border-radius:20px; font-size:14px; color:#ddd;">Level ${p.level || 0}</span>
            <span class="badge" style="background:rgba(0,0,0,0.7); border:1px solid #ff8000; padding:5px 14px; border-radius:20px; font-size:14px; color:#ff8000;">iLvl ${p.equipped_item_level || 0}</span>
            <span class="badge" style="background:rgba(0,0,0,0.7); border:1px solid rgba(255,255,255,0.2); padding:5px 14px; border-radius:20px; font-size:14px; color:#ddd;">${raceName}</span>
            <span class="badge" style="background:rgba(0,0,0,0.7); border:1px solid ${cHex}; padding:5px 14px; border-radius:20px; font-size:14px; color:${cHex}; display:flex; align-items:center;">${specIconHtml}${displaySpecClass}</span>
            ${hkBadge}
        </div>
        
        <div style="margin-top: 20px; width: 100%; max-width: 600px; margin-left: auto; margin-right: auto; height: 16px; position: relative; background: #0a0a0a; border: 1px solid #000; border-radius: 4px; overflow: hidden; box-shadow: 0 1px 0 rgba(255,255,255,0.1);">
            <div style="position: absolute; top: 0; left: 0; width: ${restedPercent}%; height: 100%; background: linear-gradient(to bottom, #3498db 0%, #2980b9 50%, #1f618d 100%); opacity: 0.9;"></div>
            <div style="position: absolute; top: 0; left: 0; width: ${xpPercent}%; height: 100%; background: linear-gradient(to bottom, #9b59b6 0%, #8e44ad 50%, #732d91 100%);"></div>
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; text-align: center; color: white; font-size: 12px; font-weight: bold; line-height: 16px; text-shadow: 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000; z-index: 2;">
                ${xpLabel}
            </div>
        </div>
    </div>
    
    <div style="display:flex; gap:30px; align-items:flex-start; flex-wrap:wrap;">
        <div style="flex:0 0 260px; display:flex; flex-direction:column; gap:20px;">
            <div style="text-align:center;">
                <img src="${char.render_url || getClassIcon(cClass)}" style="max-width:180px; width:100%; border-radius:8px; border:2px solid ${cHex}; background:#000; box-shadow:0 6px 12px rgba(0,0,0,0.8); display:block; margin: 0 auto;">
            </div>
            <div class="info-box" style="background:rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:18px;">
                <h3 style="color:${cHex}; font-family:Cinzel; font-size:18px; margin-top:0; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px; text-shadow:1px 1px 2px #000;">Combat Stats</h3>
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

                    let specHtml = `<div class="class-stat-container" style="margin-bottom: 0; gap: 12px; justify-content: center; background: rgba(0,0,0,0.4); padding: 15px; border-radius: 8px; border: 1px solid #333; box-shadow: inset 0 0 10px rgba(0,0,0,0.8);">`;

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

    // Variable to track current sort method
    let currentSortMethod = 'level';

    function renderConciseList(title, characters, isRawMode = false) {
        conciseViewTitle.textContent = title;

        // Apply Sorting before mapping HTML
        let sortedCharacters = [...characters];
        sortedCharacters.sort((a, b) => {
            let valA, valB;
            
            // Handle Raw vs Full data structures
            const profA = isRawMode ? (rosterData.find(c => c.profile && c.profile.name === a.name)?.profile || a) : (a.profile || a);
            const profB = isRawMode ? (rosterData.find(c => c.profile && c.profile.name === b.name)?.profile || b) : (b.profile || b);

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
                valA = (profA.name || '').toLowerCase();
                valB = (profB.name || '').toLowerCase();
                return valA.localeCompare(valB); // A to Z
            }
            return 0;
        });

        // Add Sorting Dropdown UI to the top of the list
        let sortUI = `
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

        // Generate the HTML for the list
        let listHTML = sortedCharacters.map((char, index) => {
            let statLabel = currentSortMethod === 'hks' ? 'HKs' : 'iLvl';
            
            // 1. Identify if we have a deep profile
            let deepChar = isRawMode ? rosterData.find(c => c.profile && c.profile.name && c.profile.name.toLowerCase() === char.name.toLowerCase()) : char;
            
            // 2. Setup Variables
            let isClickable = false;
            let displayName, cClass, raceName, cHex, portraitURL, level;
            let activeSpecAttr = 'unspecced';
            let specIconHtml = '';
            let displaySpecClass = '';
            let statValue = '???';
            let statColor = 'color:#666;';

            // 3. Populate Variables
            if (deepChar && deepChar.profile) {
                const p = deepChar.profile;
                isClickable = true;
                displayName = p.name || 'Unknown';
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
            } else {
                displayName = char.name || 'Unknown';
                cClass = char.class || 'Unknown';
                raceName = char.race || 'Unknown';
                cHex = CLASS_COLORS[cClass] || "#fff";
                portraitURL = getClassIcon(cClass);
                level = char.level || 0;
                displaySpecClass = cClass;
            }

            // NEW: Inject Podium Classes & Rank Number if we are on a Ladder View
            const hash = window.location.hash.substring(1);
            const isLadderView = hash === 'ladder-pve' || hash === 'ladder-pvp';
            let podiumClass = '';
            let rankHtml = '';
            
            if (isLadderView) {
                podiumClass = index === 0 ? 'podium-1' : index === 1 ? 'podium-2' : index === 2 ? 'podium-3' : '';
                const rankColor = index === 0 ? '#ffd100' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#777';
                const rankSize = index < 3 ? '18px' : '15px';
                rankHtml = `<div style="color: ${rankColor}; font-family: 'Cinzel'; font-weight: bold; font-size: ${rankSize}; width: 30px; text-shadow: 1px 1px 2px #000; margin-right: 10px; display: flex; align-items: center; justify-content: center;">#${index + 1}</div>`;
            }

            // 4. Render the HTML
            if (!isClickable) {
                return `
                <div class="concise-char-bar ${podiumClass}" data-class="${cClass}" data-spec="unspecced" style="border-left-color:${cHex}; cursor: default;">
                    ${rankHtml}
                    <div class="c-main-info">
                        <img src="${portraitURL}" class="c-portrait" loading="lazy" style="border-color:${cHex};" onerror="this.src='https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg'">
                        <span class="c-name" style="color:${cHex};">${displayName}</span>
                        <span class="c-meta">${raceName} ${displaySpecClass}</span>
                    </div>
                    <div class="c-stats-info">
                        <span>Level <span class="c-val-lvl">${level}</span></span>
                        <span>${statLabel} <span class="c-val-ilvl" style="${statColor}">${statValue}</span></span>
                    </div>
                </div>`;
            }

            return `
            <a href="javascript:void(0)" onclick="selectCharacter('${displayName.toLowerCase()}')" class="concise-char-bar tt-char ${podiumClass}" data-char="${displayName.toLowerCase()}" data-class="${cClass}" data-spec="${activeSpecAttr}" style="border-left-color:${cHex};">
                ${rankHtml}
                <div class="c-main-info">
                    <img src="${portraitURL}" class="c-portrait" loading="lazy" style="border-color:${cHex};" onerror="this.src='https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg'">
                    <span class="c-name" style="color:${cHex};">${displayName}</span>
                    <span class="c-meta">${raceName} &bull; ${specIconHtml}${displaySpecClass}</span>
                </div>
                <div class="c-stats-info">
                    <span>Level <span class="c-val-lvl">${level}</span></span>
                    <span>${statLabel} <span class="c-val-ilvl" style="${statColor}">${statValue}</span></span>
                </div>
            </a>`;
        }).join('');
        
        // Inject the sorting UI and the List HTML
        conciseList.innerHTML = sortUI + listHTML;

        // Bind the event listener to the newly created dropdown
        document.getElementById('concise-sort-dropdown').addEventListener('change', function(e) {
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
                
                // --- NEW: Grab the Guild Rank from the profile ---
                const guildRank = p.guild_rank || 'Member';
                
                tooltip.innerHTML = `
                    <div class="tt-name" style="color:${cHex};">${p.name || 'Unknown'}</div>
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

        let visibleCount = 0;
        const now = Date.now();
        const feedContainer = document.querySelector('.timeline-feed');

        document.querySelectorAll('#timeline .concise-item').forEach(el => {
            const charName = el.getAttribute('data-char');
            const eventType = el.getAttribute('data-event-type');
            const timestampStr = el.getAttribute('data-timestamp');
            const itemQuality = el.getAttribute('data-quality'); // NEW: Grab the quality tag!
            
            let show = true;
            
            if (window.currentFilteredChars && !window.currentFilteredChars.includes(charName)) show = false;
            
            // --- NEW: Rarity Filtering Logic ---
            if (tlTypeFilter === 'rare_plus') {
                // Only show items
                if (eventType !== 'item') show = false; 
                
                // Hide low quality items
                if (eventType === 'item' && (itemQuality === 'POOR' || itemQuality === 'COMMON' || itemQuality === 'UNCOMMON')) show = false;
            } else if (tlTypeFilter === 'epic') {
                // If they click Epics+, show ONLY Epic OR Legendary items
                if (eventType !== 'item' || (itemQuality !== 'EPIC' && itemQuality !== 'LEGENDARY')) show = false;
            } else if (tlTypeFilter === 'legendary') {
                // If they click Legendaries, show ONLY Orange items
                if (eventType !== 'item' || itemQuality !== 'LEGENDARY') show = false;
            } else if (tlTypeFilter !== 'all' && eventType !== tlTypeFilter) {
                // Normal "Loot" or "Levels" logic
                show = false;
            }

            if (tlSpecificDate && timestampStr) {
                if (!timestampStr.startsWith(tlSpecificDate)) {
                    show = false;
                }
            } else if (tlDateFilter !== 'all' && timestampStr) {
                let cleanTs = timestampStr.replace('Z', '+00:00');
                if (!cleanTs.includes('+') && !cleanTs.includes('Z')) cleanTs += 'Z';
                
                const eventDate = new Date(cleanTs).getTime();
                if (!isNaN(eventDate)) {
                    // Calculate based on Hours instead of Days
                    const hoursMs = parseInt(tlDateFilter) * 60 * 60 * 1000;
                    if ((now - eventDate) > hoursMs) show = false;
                }
            }

            el.style.display = show ? 'flex' : 'none';
            if (show) visibleCount++;
        });
        
        let noResultsMsg = document.getElementById('tl-no-results');
        if (visibleCount === 0) {
            feedContainer.style.display = 'none';
            if (!noResultsMsg) {
                noResultsMsg = document.createElement('div');
                noResultsMsg.id = 'tl-no-results';
                noResultsMsg.style.color = '#888';
                noResultsMsg.style.textAlign = 'center';
                noResultsMsg.style.padding = '20px';
                noResultsMsg.style.fontStyle = 'italic';
                noResultsMsg.innerText = 'No high-end loot found for these filters yet... keep raiding!';
                timeline.appendChild(noResultsMsg);
            } else {
                noResultsMsg.style.display = 'block';
            }
        } else {
            feedContainer.style.display = 'flex';
            if (noResultsMsg) noResultsMsg.style.display = 'none';
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
        
        // BUG FIX: Ensure the timeline is unhidden by default when switching views!
        // (Analytics and Architecture will immediately hide it again if needed)
        if (timeline) timeline.style.display = 'block';
        
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // --- NEW: Reset Timeline Filters on Page Change ---
        // This ensures the feed reliably appears when clicking a new character
        tlTypeFilter = 'rare_plus';
        tlDateFilter = 'all';
        tlSpecificDate = null;

        // Reset the Button UI to highlight "Rare+"
        document.querySelectorAll('button.tl-btn').forEach(b => {
            b.classList.remove('active');
            if (b.getAttribute('data-type') === 'rare_plus') {
                b.classList.add('active');
            }
        });

        // Reset the Dropdown UI to "All Available"
        const dateSelect = document.getElementById('tl-date-filter');
        if (dateSelect) {
            dateSelect.value = 'all';
        }

        // Clear any specific Heatmap day selections
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

        if (mainDonutChartInstance) mainDonutChartInstance.destroy();
        mainDonutChartInstance = createDonutChart('classDonutChart', rawGuildRoster, true);

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
        if (timeline) { timeline.style.display = 'block'; timelineTitle.innerHTML = "📜 Guild Recent Activity"; window.currentFilteredChars = null; applyTimelineFilters(); }
        
        const specContainer = document.getElementById('home-spec-container');
        if (specContainer) specContainer.style.display = 'none';
        document.querySelectorAll('.clickable-class').forEach(b => b.classList.remove('active-filter'));
        window.activeClassExpanded = null;
        updateDropdownLabel('all');

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

        document.getElementById('stat-avgilvl').onclick = () => { window.location.hash = 'ladder-pve'; };
        document.getElementById('stat-hks').onclick = () => { window.location.hash = 'ladder-pvp'; };

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

        // Recent Milestones logic
        if (timelineData && timelineData.length > 0) {
            const milestoneCont = document.getElementById('recent-milestones-container');
            const milestoneText = document.getElementById('milestone-text');
            // Find the most recent Epic/Legendary loot OR Level 70
            const recent = timelineData.find(e => 
                (e.type === 'item' && (e.item_quality === 'EPIC' || e.item_quality === 'LEGENDARY')) || 
                (e.type === 'level_up' && e.level === 70)
            );
            if (recent) {
                milestoneCont.style.display = 'block';
                const charName = `<span class="milestone-highlight">${recent.character_name}</span>`;
                if (recent.type === 'level_up') {
                    milestoneText.innerHTML = `Congratulations to ${charName} for reaching <span class="milestone-highlight">Level 70!</span> 🎉`;
                } else {
                    const qClass = recent.item_quality === 'LEGENDARY' ? 'color:#ff8000;' : 'color:#a335ee;';
                    milestoneText.innerHTML = `${charName} just looted <a href="https://www.wowhead.com/wotlk/item=${recent.item_id}" target="_blank" style="${qClass} font-weight:bold; text-decoration:none;">[${recent.item_name}]</a>!`;
                }
            }
        }
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
        
        if (showBadges) renderDynamicBadges(characters, isRawRoster);
        else {
            document.getElementById('concise-class-badges').style.display = 'none';
            const specContainer = document.getElementById('concise-spec-container');
            if (specContainer) specContainer.style.display = 'none';
        }

       // Draw the dynamic charts & KPIs
        const hash = window.location.hash.substring(1);
        const donutContainer = document.getElementById('concise-donut-container');
        
        // Expanded array of views that get charts
        const chartViews = ['total', 'active', 'raidready', 'ladder-pve', 'ladder-pvp'];

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

    // Setup clickable stat boxes
    document.getElementById('stat-total').addEventListener('click', () => { window.location.hash = 'total'; });
    document.getElementById('stat-active').addEventListener('click', () => { window.location.hash = 'active'; });
    document.getElementById('stat-raidready').addEventListener('click', () => { window.location.hash = 'raidready'; });

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
            let specHtml = `<div class="class-stat-container" style="margin-bottom: 0; gap: 12px; justify-content: center; background: rgba(0,0,0,0.4); padding: 15px; border-radius: 8px; border: 1px solid #333; box-shadow: inset 0 0 10px rgba(0,0,0,0.8);">`;

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
            const response = await fetch('asset/timeline.json');
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
            
            applyTimelineFilters(); 
        } catch (error) {
            console.error("Failed to load timeline data:", error);
        }
    }

    function applyTimelineFilters() {
        if (!timeline) return;

        const now = Date.now();
        
        // 1. Filter the raw data array directly instead of the DOM elements
        filteredTimelineData = timelineData.filter(event => {
            const charName = (event.character_name || '').toLowerCase();
            const eventType = event.type;
            const timestampStr = event.timestamp || '';
            const itemQuality = event.item_quality || 'COMMON';

            // Filter by Character
            if (window.currentFilteredChars && !window.currentFilteredChars.includes(charName)) return false;

            // Filter by Rarity/Type
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

    function renderTimelineBatch() {
        const container = document.getElementById('timeline-feed-container');
        const loadMoreBtn = document.getElementById('load-more-btn');
        
        if (!container) return;

        const endIndex = Math.min(currentTimelineIndex + timelineBatchSize, filteredTimelineData.length);
        
        for (let i = currentTimelineIndex; i < endIndex; i++) {
            const event = filteredTimelineData[i];
            
            // Restored the proper concise-item class from your production site!
            const eventEl = document.createElement('div');
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
            
            // Format the date to match production (e.g., "Mar 24")
            let date_str = event.timestamp.substring(0, 10);
            try {
                const cleanTs = event.timestamp.replace('Z', '+00:00');
                const dt = new Date(cleanTs);
                if (!isNaN(dt.getTime())) {
                    date_str = dt.toLocaleString('en-US', { month: 'short', day: 'numeric' });
                }
            } catch(e) {}
            
            const c_hex = CLASS_COLORS[event.class] || '#ffd100';
            const c_name = (event.character_name || 'Unknown').charAt(0).toUpperCase() + (event.character_name || '').slice(1).toLowerCase();
            
            if (event.type === 'level_up') {
                eventEl.style.borderLeftColor = c_hex;
                eventEl.innerHTML = `
                    <div class="timeline-node" style="background: #ffd100; box-shadow: 0 0 8px #ffd100;"></div>
                    <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                        <span style="color: ${c_hex}; font-family:'Cinzel'; font-weight:bold; font-size:15px; text-shadow:1px 1px 2px #000;">${c_name}</span>
                        <span style="color:#888; font-size:11px;">${date_str}</span>
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

    route();
    window.addEventListener('hashchange', route);
});