// 国铁车站信息屏 - 前端逻辑（复刻CRSim样式）

// 全局状态
let currentStation = 'GZQ';
let refreshTimer = null;
let refreshInterval = 60;
let trainsData = [];
let regionData = {};  // 省市区车站数据
let selectedStationCode = '';  // 三级选择器选中的车站码

// DOM
const $ = (id) => document.getElementById(id);

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initEventListeners();
    loadRegionData();
    loadTrains();
    startAutoRefresh();
});

// ===== 时钟 =====
function initClock() {
    updateClock();
    setInterval(updateClock, 1000);
}

function updateClock() {
    const now = new Date();
    
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    $('current-time').textContent = `${h}:${m}:${s}`;
    
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    $('current-date').textContent = `${year}年${month}月${day}日 星期${weekDays[now.getDay()]}`;
}

// ===== 事件监听 =====
function initEventListeners() {
    $('btn-settings').addEventListener('click', openSettings);
    $('btn-fullscreen').addEventListener('click', toggleFullscreen);
    $('btn-cancel').addEventListener('click', closeSettings);
    $('btn-apply').addEventListener('click', applySettings);
    
    $('station-search-input').addEventListener('input', debounce(handleStationSearch, 300));
    $('station-search-input').addEventListener('focus', handleStationSearch);
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.station-search')) {
            $('station-suggestions').classList.add('hidden');
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSettings();
        if (e.key === 'F11') {
            e.preventDefault();
            toggleFullscreen();
        }
    });
    
    window.addEventListener('resize', renderTrains);
}

// ===== 车次数据加载 =====
async function loadTrains() {
    showLoading(true);
    hideError();
    
    try {
        const resp = await fetch(`/api/trains?station=${currentStation}&_t=${Date.now()}`);
        const data = await resp.json();
        
        trainsData = data.trains || [];
        $('station-name').textContent = data.station_name || '车站';
        
        renderTrains();
    } catch (err) {
        showError('加载车次数据失败: ' + err.message);
    } finally {
        showLoading(false);
    }
}

// ===== 渲染车次列表 =====
function renderTrains() {
    const listEl = $('train-list');
    listEl.innerHTML = '';
    
    if (trainsData.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;padding:60px;color:#666;font-size:24px;">暂无车次信息</div>';
        return;
    }
    
    // 计算可用高度，自适应行高
    const boardBody = listEl.parentElement;
    const headerHeight = boardBody.querySelector('.board-header').offsetHeight;
    const availableHeight = boardBody.offsetHeight - headerHeight - 10;
    
    // 每行高度
    const rowHeight = Math.max(50, Math.min(80, Math.floor(availableHeight / Math.max(trainsData.length, 1))));
    
    trainsData.forEach((train, index) => {
        const row = createTrainRow(train, index + 1, rowHeight);
        listEl.appendChild(row);
    });
}

function getTrainClass(trainCode) {
    const c = trainCode.charAt(0).toUpperCase();
    switch(c) {
        case 'G': return 'g';
        case 'D': return 'd';
        case 'C': return 'c';
        case 'T': return 't';
        case 'Z': return 'z';
        case 'K': return 'k';
        case 'Y': return 'y';
        case 'L': return 'l';
        default: return 'default';
    }
}

function getStatusInfo(train) {
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    
    // 解析到达时间
    let arriveMin = null;
    if (train.arrive_time) {
        const parts = train.arrive_time.split(':');
        arriveMin = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    
    // 解析出发时间
    let departMin = null;
    if (train.start_time) {
        const parts = train.start_time.split(':');
        departMin = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    
    const diffArrive = arriveMin !== null ? arriveMin - currentMin : null;
    const diffDepart = departMin !== null ? departMin - currentMin : null;
    const category = train.train_category; // origin / pass / terminal
    
    // ===== 始发站：从这里上车，看发车时间 =====
    if (category === 'origin' && diffDepart !== null) {
        // 已发车
        if (diffDepart < -1) {
            return { text: '已发车', class: 'status-arrived' };
        }
        // 停止检票（发车前2分钟内）
        if (diffDepart <= 2) {
            return { text: '停止检票', class: 'status-stop' };
        }
        // 检票中（发车前20分钟到2分钟）
        if (diffDepart <= 20) {
            return { text: `检票中（剩${diffDepart}分钟）`, class: 'status-checkin' };
        }
        // 可以检票（发车前60分钟到20分钟）
        if (diffDepart <= 60) {
            return { text: `可以检票（剩${diffDepart}分钟）`, class: 'status-checkin' };
        }
        // 候车中
        return { text: `候车中（剩${diffDepart}分钟）`, class: 'status-normal' };
    }
    
    // ===== 终到站：到这里下车，看到达时间 =====
    if (category === 'terminal' && diffArrive !== null) {
        // 已到达
        if (diffArrive < -10) {
            return { text: '已到达', class: 'status-arrived' };
        }
        // 正在进站（到达前10分钟内）
        if (diffArrive <= 10) {
            return { text: `正在进站（剩${diffArrive}分钟）`, class: 'status-normal' };
        }
        // 即将到达（到达前120分钟内）
        if (diffArrive <= 120) {
            return { text: `即将到达（剩${diffArrive}分钟）`, class: 'status-normal' };
        }
        // 正点
        return { text: '正点', class: 'status-normal' };
    }
    
    // ===== 过路站：经过这里，先看到达再看发车 =====
    if (category === 'pass') {
        // 已经发车了（过了这个站）
        if (diffDepart !== null && diffDepart < -1) {
            return { text: '已发车', class: 'status-arrived' };
        }
        
        // 还没到达：看到达时间
        if (diffArrive !== null && diffArrive > 10) {
            // 即将到达（到达前120分钟内）
            if (diffArrive <= 120) {
                return { text: `即将到达（剩${diffArrive}分钟）`, class: 'status-normal' };
            }
            // 正点
            return { text: '正点', class: 'status-normal' };
        }
        
        // 正在进站（到达前10分钟到到达后停车）
        if (diffArrive !== null && diffArrive <= 10 && (diffDepart === null || diffDepart >= -1)) {
            return { text: `正在进站（剩${diffArrive}分钟）`, class: 'status-normal' };
        }
        
        // 停车中（到达后到发车前）
        if (diffArrive !== null && diffArrive <= -1 && diffDepart !== null && diffDepart > 0) {
            return { text: `停车中（剩${diffDepart}分钟发车）`, class: 'status-checkin' };
        }
        
        // 停止检票（发车前2分钟内）
        if (diffDepart !== null && diffDepart <= 2 && diffDepart > 0) {
            return { text: '停止检票', class: 'status-stop' };
        }
        
        // 检票中（发车前20分钟内，且已经到达）
        if (diffDepart !== null && diffDepart <= 20 && diffDepart > 2 && diffArrive !== null && diffArrive < 0) {
            return { text: `检票中（剩${diffDepart}分钟）`, class: 'status-checkin' };
        }
    }
    
    // 默认状态
    return { text: '正点', class: 'status-normal' };
}

function createTrainRow(train, index, rowHeight) {
    const row = document.createElement('div');
    row.className = 'train-row';
    row.style.height = rowHeight + 'px';
    
    const trainClass = getTrainClass(train.train_code);
    const status = getStatusInfo(train);
    
    // 到达时间显示
    const arriveDisplay = train.arrive_time || '--:--';
    const departDisplay = train.start_time || '------';
    
    row.innerHTML = `
        <div class="col col-no">${index}</div>
        <div class="col col-train">
            <span class="train-code ${trainClass}">${train.train_code}</span>
        </div>
        <div class="col col-from">
            <span class="station-name">${train.start_station}</span>
        </div>
        <div class="col col-to">
            <span class="station-name">${train.end_station}</span>
        </div>
        <div class="col col-arrive">
            <span class="time-value">${arriveDisplay}</span>
        </div>
        <div class="col col-depart">
            <span class="time-value departure">${departDisplay}</span>
        </div>
        <div class="col col-status">
            <span class="status-text ${status.class}">${status.text}</span>
        </div>
    `;
    
    return row;
}

// ===== 自动刷新 =====
function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(loadTrains, refreshInterval * 1000);
}

// ===== 车站搜索 =====
async function handleStationSearch() {
    const keyword = $('station-search-input').value.trim();
    if (!keyword) {
        $('station-suggestions').classList.add('hidden');
        return;
    }
    
    try {
        const resp = await fetch(`/api/stations?q=${encodeURIComponent(keyword)}`);
        const data = await resp.json();
        
        const suggestionsEl = $('station-suggestions');
        suggestionsEl.innerHTML = '';
        
        if (data.data && data.data.length > 0) {
            data.data.forEach(station => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.innerHTML = `
                    <span>${station.name}</span>
                    <span class="suggestion-code">${station.code}</span>
                `;
                item.addEventListener('click', () => {
                    $('station-search-input').value = `${station.name} (${station.code})`;
                    $('station-search-input').dataset.code = station.code;
                    $('station-suggestions').classList.add('hidden');
                });
                suggestionsEl.appendChild(item);
            });
            suggestionsEl.classList.remove('hidden');
        } else {
            $('station-suggestions').classList.add('hidden');
        }
    } catch (err) {
        console.error('车站搜索失败:', err);
    }
}

// ===== 设置面板 =====
function openSettings() {
    $('station-search-input').value = $('station-name').textContent;
    $('refresh-interval').value = refreshInterval;
    $('settings-panel').classList.remove('hidden');
}

function closeSettings() {
    $('settings-panel').classList.add('hidden');
}

async function applySettings() {
    let newStation = '';
    
    // 优先使用三级选择器选中的车站
    if (selectedStationCode) {
        newStation = selectedStationCode;
    } else {
        // 否则使用搜索框
        const inputVal = $('station-search-input').value.trim();
        const match = inputVal.match(/\(([A-Z]+)\)/);
        if (match) {
            newStation = match[1];
        } else if ($('station-search-input').dataset.code) {
            newStation = $('station-search-input').dataset.code;
        }
    }
    
    if (newStation && newStation !== currentStation) {
        currentStation = newStation;
        await loadTrains();
    }
    
    const newInterval = parseInt($('refresh-interval').value);
    if (newInterval >= 10 && newInterval !== refreshInterval) {
        refreshInterval = newInterval;
        startAutoRefresh();
    }
    
    // 重置选择器
    selectedStationCode = '';
    closeSettings();
}

// ===== 全屏 =====
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error('全屏失败:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

// ===== 工具 =====
function showLoading(show) {
    $('loading').classList.toggle('hidden', !show);
}

function showError(msg) {
    const el = $('error-msg');
    el.textContent = msg;
    el.classList.remove('hidden');
}

function hideError() {
    $('error-msg').classList.add('hidden');
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// ===== 三级地区选择器 =====
async function loadRegionData() {
    try {
        const resp = await fetch('/api/regions');
        const data = await resp.json();
        regionData = data.data || {};
        initProvinceSelect();
    } catch (err) {
        console.error('加载地区数据失败:', err);
    }
}

function initProvinceSelect() {
    const provinceSelect = $('province-select');
    provinceSelect.innerHTML = '<option value="">-- 选择省份 --</option>';
    
    const provinces = Object.keys(regionData).sort();
    provinces.forEach(province => {
        const opt = document.createElement('option');
        opt.value = province;
        opt.textContent = province;
        provinceSelect.appendChild(opt);
    });
}

function initCitySelect(province) {
    const citySelect = $('city-select');
    const stationSelect = $('station-select');
    
    citySelect.innerHTML = '<option value="">-- 选择城市 --</option>';
    stationSelect.innerHTML = '<option value="">-- 选择车站 --</option>';
    
    if (!province || !regionData[province]) return;
    
    const cities = Object.keys(regionData[province]).sort();
    cities.forEach(city => {
        const opt = document.createElement('option');
        opt.value = city;
        opt.textContent = city;
        citySelect.appendChild(opt);
    });
}

function initStationSelect(province, city) {
    const stationSelect = $('station-select');
    stationSelect.innerHTML = '<option value="">-- 选择车站 --</option>';
    
    if (!province || !city || !regionData[province] || !regionData[province][city]) return;
    
    const stations = regionData[province][city];
    Object.keys(stations).sort().forEach(stationName => {
        const opt = document.createElement('option');
        opt.value = stations[stationName];
        opt.textContent = stationName;
        stationSelect.appendChild(opt);
    });
}

// 绑定三级选择器事件
document.addEventListener('DOMContentLoaded', () => {
    $('province-select').addEventListener('change', (e) => {
        const province = e.target.value;
        initCitySelect(province);
    });
    
    $('city-select').addEventListener('change', (e) => {
        const province = $('province-select').value;
        const city = e.target.value;
        initStationSelect(province, city);
    });
    
    $('station-select').addEventListener('change', (e) => {
        selectedStationCode = e.target.value;
        // 同步更新搜索框显示
        const selectedOpt = e.target.options[e.target.selectedIndex];
        if (selectedOpt) {
            $('station-search-input').value = selectedOpt.textContent;
            $('station-search-input').dataset.code = selectedStationCode;
        }
    });
});
"}]