import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBxu2JIxVLsCTi91rfEt3X58Q3d2uaocAw",
    authDomain: "military-roleplay-io.firebaseapp.com",
    databaseURL: "https://military-roleplay-io-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "military-roleplay-io",
    storageBucket: "military-roleplay-io.firebasestorage.app",
    messagingSenderId: "823014317267",
    appId: "1:823014317267:web:da61c79a248423ff5f4826"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let myId = null;
let allPlayers = {};
let lastSyncTime = 0;

function spawnPlayer(regionName) {
    if (typeof GAME_JSON === 'undefined') return;
    const gameData = GAME_JSON.data || GAME_JSON;
    if (gameData.variables && gameData.variables[regionName] && gameData.variables[regionName].default) {
        const spawnRegion = gameData.variables[regionName].default;
        player.x = spawnRegion.x + (Math.random() * spawnRegion.width) - (player.width / 2);
        player.y = spawnRegion.y + (Math.random() * spawnRegion.height) - (player.height / 2);
    } else {
        player.x = 1500;
        player.y = 2200;
    }
    player.vx = 0;
    player.vy = 0;
    player.targetX = player.x;
    player.targetY = player.y;
}

function getLines(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let currentLine = words[0] || "";

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }
    return lines;
}

function updateLeaderboard() {
    const scoreboardList = document.getElementById('ui-text-scoreboard-id');
    const playerAttr = document.getElementById('players-attribute-div');
    if (!scoreboardList) return;

    let html = '';
    let count = 0;
    
    for (let id in allPlayers) {
        const p = allPlayers[id];
        if (p && p.name) {
            html += `<div style="display: flex; justify-content: space-between; width: 100%;">
                        <span>${p.name}</span>
                        <span style="color:#2ecc71;">$0</span>
                     </div>`;
            count++;
        }
    }
    
    scoreboardList.innerHTML = html;
    if (playerAttr) playerAttr.innerText = count.toString();
}

signInAnonymously(auth).catch((error) => {
    alert("Multiplayer Error! Please enable 'Anonymous' in Firebase Authentication. Details: " + error.message);
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        myId = user.uid;
        onDisconnect(ref(db, `players/${myId}`)).remove();
        onValue(ref(db, 'players'), (snapshot) => {
            const data = snapshot.val() || {};
            
            for (let id in data) {
                if (id === myId) continue;

                let remote = data[id];
                if (!allPlayers[id]) {
                    allPlayers[id] = {
                        ...remote,
                        targetX: remote.x,
                        targetY: remote.y,
                        targetAngle: remote.angle,
                        activeChats: []
                    };
                    if (remote.chats) {
                        remote.chats.forEach(rc => {
                            allPlayers[id].activeChats.push({ m: rc.m, t: rc.t, localStartTime: performance.now() });
                        });
                    }
                } else {
                    let p = allPlayers[id];
                    p.targetX = remote.x;
                    p.targetY = remote.y;
                    p.targetAngle = remote.angle;
                    p.scale = remote.scale;
                    p.name = remote.name;
                    p.team = remote.team || "Civilians";
                    
                    if (remote.chats) {
                        if (!p.activeChats) p.activeChats = [];
                        remote.chats.forEach(rc => {
                            if (!p.activeChats.find(ac => ac.t === rc.t)) {
                                p.activeChats.push({ m: rc.m, t: rc.t, localStartTime: performance.now() });
                            }
                        });
                        if (p.activeChats.length > 3) {
                            p.activeChats = p.activeChats.slice(p.activeChats.length - 3);
                        }
                    }
                }
            }
            
            for (let id in allPlayers) {
                if (!data[id] && id !== myId) {
                    delete allPlayers[id];
                }
            }
            updateLeaderboard(); 
        });
    }
});

document.addEventListener('contextmenu', event => event.preventDefault());

function preventZoom(e) {
    if (e.ctrlKey || e.metaKey) {
        const isZoomKey = ['=', '-', '0', '+'].includes(e.key) || ['NumpadAdd', 'NumpadSubtract'].includes(e.code);
        if (e.type === 'wheel' || isZoomKey) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    }
}
window.addEventListener('wheel', preventZoom, { passive: false });
window.addEventListener('keydown', preventZoom, { passive: false });

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

const TILESHEET_URL = "assets/tilesheet.png";
const PLAYER_URL = "assets/player.png";

const tilesheetImg = new Image();
const playerImg = new Image();
let assetsLoaded = 0;

const keys = {
    w: false, a: false, s: false, d: false, c: false, shift: false,
    arrowup: false, arrowleft: false, arrowdown: false, arrowright: false
};
let mouseX = 0, mouseY = 0;

let player = {
    name: "",
    team: "Civilians",
    x: 0, y: 0, 
    width: 45, height: 45, 
    vx: 0, vy: 0,
    angle: 0,
    scale: 1,
    bopTimer: 0,
    chats: [],
    activeChats: []
};

let notifTimeout;
function showNotification(msg) {
    const notif = document.getElementById('system-notification');
    if (!notif) return;
    notif.innerText = msg;
    notif.style.top = '20px';
    if (notifTimeout) clearTimeout(notifTimeout);
    notifTimeout = setTimeout(() => {
        notif.style.top = '-100px';
    }, 3000);
}

let chatCooldownTimer = 0;

const LOGICAL_WIDTH = 1280;
const LOGICAL_HEIGHT = 720;
let viewScale = 1;
let camera = { x: 0, y: 0, width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
const BASE_DPR = window.devicePixelRatio || 1;
let lastTime = 0;
const TILE_SIZE = 64;
let columns = 0, rows = 0, layers = [], tilesetCols = 64;
const CHUNK_SIZE = 1024;
let bgChunks = [];
let fgChunks = [];

window.addEventListener('resize', resizeCanvas);

window.addEventListener('keydown', e => { 
    if (e.key === 'Enter') {
        if (document.getElementById('play-menu').style.display !== 'none') return; 
        const chatContainer = document.getElementById('chat-input-container');
        const chatInput = document.getElementById('chat-input');
        if (chatContainer.style.display !== 'block') {
            chatContainer.style.display = 'block';
            chatInput.value = '';
            setTimeout(() => chatInput.focus(), 10); 
        } else {
            const msg = chatInput.value.trim();
            if (msg.length > 0) {
                if (performance.now() < chatCooldownTimer) {
                    const remaining = Math.ceil((chatCooldownTimer - performance.now()) / 1000);
                    showNotification(`Please wait ${remaining}s`);
                    return; 
                } else {
                    if (msg.length >= 100) chatCooldownTimer = performance.now() + 5000;
                    
                    player.chats.push({ m: msg, t: Date.now() });
                    if (player.chats.length > 3) player.chats.shift();
                    
                    if (!player.activeChats) player.activeChats = [];
                    player.activeChats.push({ m: msg, t: Date.now(), localStartTime: performance.now() });
                    if (player.activeChats.length > 3) player.activeChats.shift();

                    if (myId) {
                        set(ref(db, `players/${myId}`), {
                            name: player.name,
                            team: player.team,
                            x: player.x,
                            y: player.y,
                            angle: player.angle,
                            scale: player.scale,
                            chats: player.chats
                        });
                    }
                }
            }
            chatContainer.style.display = 'none';
            chatInput.blur();
            canvas.focus();
        }
        return;
    }
    if (document.activeElement !== document.getElementById('chat-input') && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        if (e.key.toLowerCase() === 'b') {
            const shopMenu = document.getElementById('shop-ui');
            if (shopMenu) shopMenu.style.display = shopMenu.style.display === 'flex' ? 'none' : 'flex';
        }
        if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true; 
    }
});

window.addEventListener('keyup', e => { 
    if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false; 
});

window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });

function initGame() {
    if (typeof GAME_JSON === 'undefined') {
        document.getElementById('loading-text').innerText = "ERROR: gameData.js not found or corrupted!";
        document.getElementById('loading-text').style.color = "red";
        return;
    }
    setupMap(GAME_JSON);
    injectUI(GAME_JSON);
    bindUI(); 
    fixUI();
    loadImages();
}
initGame();

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    viewScale = Math.max(canvas.width / LOGICAL_WIDTH, canvas.height / LOGICAL_HEIGHT);
    camera.width = canvas.width / viewScale;
    camera.height = canvas.height / viewScale;
    ctx.imageSmoothingEnabled = false;
    const currentDPR = window.devicePixelRatio || 1;
    const uiZoom = BASE_DPR / currentDPR;
    const uiLayer = document.getElementById('game-ui-layer');
    const brLayer = document.getElementById('bottom-right-ui-container');
    const blLayer = document.getElementById('bottom-left-ui-container');
    const playMenu = document.getElementById('play-menu');
    const chatInputMenu = document.getElementById('chat-input-container');
    if (uiLayer) uiLayer.style.zoom = uiZoom;
    if (brLayer) brLayer.style.zoom = uiZoom;
    if (blLayer) blLayer.style.zoom = uiZoom;
    if (playMenu) playMenu.style.zoom = uiZoom;
    if (chatInputMenu) chatInputMenu.style.zoom = uiZoom;
}

function injectUI(jsonObj) {
    const gameData = jsonObj.data || jsonObj;
    let combinedHtml = "";
    let combinedCss = "";
    function extractContent(obj) {
        if (!obj || typeof obj !== 'object') return;
        if (obj.htmlData) combinedHtml += obj.htmlData;
        if (obj.cssData) combinedCss += obj.cssData;
        for (let key in obj) if (typeof obj[key] === 'object') extractContent(obj[key]);
    }
    if (gameData.ui) extractContent(gameData.ui);
    combinedHtml = combinedHtml.replace(/{{.*?}}/g, "");
    document.getElementById('game-ui-layer').innerHTML = combinedHtml;
    const styleElement = document.createElement('style');
    styleElement.innerHTML = combinedCss;
    document.head.appendChild(styleElement);
}

function bindUI() {
    const elementsToHide = [
        '#division-selector-ui', '#note-ui', '#locker-ui', '#mp-locker-ui', 
        '#ss-locker-ui', '#civ-locker-ui', '#raider-locker-ui', '#arrest-ui',
        '#settings-ui', '#shop-ui', '#management-ui', '#moderation-ui',
        '#modd-dialogue-modal', '#player-input-modal', '#custom-modal', 
        '#modd-item-shop-modal', '#modd-shop-modal', '.embed-container'
    ];
    elementsToHide.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => el.style.display = 'none');
    });
    const openMap = {
        'open-teams-menu': 'division-selector-ui',
        'open-note-menu': 'note-ui',
        'open-settings-menu': 'settings-ui',
        'open-shop-menu': 'shop-ui',
        'open-management-menu': 'management-ui',
        'navbar-shop-button': 'modd-shop-modal' 
    };
    for (const [btnId, modalId] of Object.entries(openMap)) {
        const btn = document.getElementById(btnId);
        const modal = document.getElementById(modalId);
        if (btn && modal) {
            btn.addEventListener('click', () => {
                const useBlock = ['note-ui', 'modd-shop-modal', 'custom-modal', 'player-input-modal'].includes(modalId) || modalId.includes('locker');
                modal.style.display = useBlock ? 'block' : 'flex';
            });
        }
    }
    document.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if ((btn.id && btn.id.includes('close')) || btn.innerText.trim() === 'X' || btn.classList.contains('close') || btn.classList.contains('join-btn')) {
                const modal = btn.closest('[id$="-ui"], .modal, [id$="-modal"]');
                if (modal) modal.style.display = 'none';
            }
        });
    });

    const btnCiv = document.getElementById('join-civilians');
    if (btnCiv) {
        btnCiv.addEventListener('click', () => {
            if (player.team === "Civilians") {
                showNotification("You're already in that team!");
            } else {
                player.team = "Civilians";
                spawnPlayer("civilian spawn");
                if (myId) {
                    set(ref(db, `players/${myId}`), {
                        name: player.name,
                        team: player.team,
                        x: player.x,
                        y: player.y,
                        angle: player.angle,
                        scale: player.scale,
                        chats: player.chats
                    });
                }
            }
        });
    }

    const btnMil = document.getElementById('join-military');
    if (btnMil) {
        btnMil.addEventListener('click', () => {
            if (player.team === "Military") {
                showNotification("You're already in that team!");
            } else {
                player.team = "Military";
                spawnPlayer("military spawn");
                if (myId) {
                    set(ref(db, `players/${myId}`), {
                        name: player.name,
                        team: player.team,
                        x: player.x,
                        y: player.y,
                        angle: player.angle,
                        scale: player.scale,
                        chats: player.chats
                    });
                }
            }
        });
    }

    document.getElementById('play-btn').addEventListener('click', () => {
        const nameInput = document.getElementById('player-name-input');
        let name = nameInput.value.trim();
        if (!nameInput.disabled) {
            player.name = name ? name : "user" + Math.floor(Math.random() * 1001);
        }
        document.getElementById('play-menu').style.display = 'none';
        document.getElementById('game-ui-layer').style.display = 'block';
        const brContainer = document.getElementById('bottom-right-ui-container');
        if (brContainer) {
            brContainer.style.setProperty('display', 'flex', 'important');
        }
        const blContainer = document.getElementById('bottom-left-ui-container');
        if (blContainer) {
            blContainer.style.setProperty('display', 'flex', 'important');
        }
        const lbBody = document.getElementById('scoreboard');
        const lbToggle = document.getElementById('leaderboard-toggle');
        if (lbBody) lbBody.style.display = 'block';
        if (lbToggle) lbToggle.style.transform = 'rotate(180deg)';
        
        if (myId) {
            allPlayers[myId] = player;
        }
        updateLeaderboard(); 
    });
    
    const lbHeader = document.getElementById('scoreboard-header');
    if (lbHeader) {
        lbHeader.addEventListener('click', () => {
            const lbBody = document.getElementById('scoreboard');
            const lbToggle = document.getElementById('leaderboard-toggle');
            if (lbBody.style.display === 'none' || lbBody.style.display === '') {
                lbBody.style.display = 'block';
                lbToggle.style.transform = 'rotate(180deg)';
            } else {
                lbBody.style.display = 'none';
                lbToggle.style.transform = 'rotate(0deg)';
            }
        });
    }
}

function fixUI() {
    const fixStyle = document.createElement('style');
    fixStyle.innerHTML = `
        *, *::before, *::after { box-shadow: none !important; text-shadow: none !important; }
        #my-score-div, #my-score-div *, .ui-text-scoreboard, .ui-text-scoreboard div { user-select: none !important; -webkit-user-select: none !important; -moz-user-select: none !important; -ms-user-select: none !important; }
        input:hover, textarea:hover, #note-textarea:hover, #player-input-field:hover, select:hover { transform: none !important; filter: none !important; }
        .navbar-container { top: 20px !important; left: 20px !important; margin: 0 !important; padding: 0 !important; gap: 10px !important; align-items: flex-start !important; background: transparent !important; border: none !important; }
        .nav-button { width: 44px !important; height: 44px !important; padding: 0 !important; margin: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; background: #111111 !important; border: none !important; border-bottom: 3px solid #e67e22 !important; border-radius: 6px !important; }
        .nav-button:hover { background: #181818 !important; transform: translateY(-2px) !important; }
        .nav-button:active { transform: scale(0.95) !important; }
        .nav-button svg { width: 20px !important; height: 20px !important; fill: #ffffff !important; }
        .nav-button::after { display: none !important; }
        .leaderboard-container { top: 20px !important; right: 20px !important; margin: 0 !important; display: flex !important; flex-direction: column !important; align-items: flex-end !important; }
        #scoreboard-header { width: 250px !important; height: 44px !important; box-sizing: border-box !important; background: #111111 !important; border: none !important; border-bottom: 3px solid #e67e22 !important; border-radius: 6px !important; padding: 0 15px !important; margin: 0 !important; display: flex !important; }
        #leaderboard { top: 0 !important; right: 0 !important; padding: 0 !important; margin: 0 !important; position: relative !important; }
        #scoreboard { width: 250px !important; background: #111111 !important; border: none !important; border-bottom: 3px solid #e67e22 !important; border-radius: 6px !important; padding: 8px !important; margin-top: 10px !important; overflow-x: hidden !important; overflow-y: auto !important; }
        .ui-text-scoreboard div { width: 100% !important; box-sizing: border-box !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
        #bottom-right-ui-container { flex-direction: column !important; align-items: flex-end !important; gap: 10px !important; bottom: 20px !important; right: 20px !important; margin: 0 !important; padding: 0 !important; }
        .sidebar-wrapper { position: static !important; width: auto !important; height: auto !important; margin: 0 !important; padding: 0 !important; transform: none !important; }
        #my-score-div > div { height: 44px !important; background: #111111 !important; border: none !important; border-bottom: 3px solid #e67e22 !important; border-radius: 6px !important; padding: 0 15px !important; min-width: 140px !important; box-sizing: border-box !important; }
        #bottom-center-ui-container { position: fixed !important; bottom: 20px !important; left: 50% !important; transform: translateX(-50%) !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; gap: 10px !important; z-index: 9999 !important; pointer-events: none !important; }
        .inv-slots-row, .top-buttons-row { display: flex !important; flex-direction: row !important; gap: 10px !important; pointer-events: none !important; align-items: center !important; justify-content: space-between !important; width: 260px !important; }
        .inv-slot { width: 44px !important; height: 44px !important; background: rgba(17, 17, 17, 0.8) !important; border: 2px solid rgba(255, 255, 255, 0.1) !important; border-bottom: 3px solid rgba(255, 255, 255, 0.2) !important; border-radius: 6px !important; display: flex !important; align-items: center !important; justify-content: center !important; color: rgba(255, 255, 255, 0.5) !important; font-family: 'Segoe UI', Tahoma, sans-serif !important; font-weight: 800 !important; font-size: 16px !important; cursor: pointer !important; user-select: none !important; transition: all 0.15s ease !important; pointer-events: auto !important; box-sizing: border-box !important; }
        .inv-slot:hover { background: rgba(40, 40, 40, 0.9) !important; border-color: rgba(255, 255, 255, 0.3) !important; transform: translateY(-2px); }
        .inv-slot.selected { background: #111111 !important; border-color: #e67e22 !important; border-bottom: 3px solid #e67e22 !important; color: white !important; transform: translateY(-4px); }
        .action-btn { background: #111111 !important; border: none !important; border-bottom: 3px solid #e67e22 !important; border-radius: 6px !important; height: 44px !important; width: 80px !important; min-width: 80px !important; max-width: 80px !important; padding: 0 !important; margin: 0 !important; box-sizing: border-box !important; display: flex !important; align-items: center !important; justify-content: center !important; color: #ffffff !important; font-family: 'Segoe UI', Tahoma, sans-serif !important; font-size: 10px !important; font-weight: 900 !important; letter-spacing: 0.5px !important; text-transform: uppercase !important; pointer-events: auto !important; cursor: pointer !important; transition: transform 0.1s ease, background 0.2s ease !important; }
        .action-btn:hover { background: #181818 !important; transform: translateY(-2px) !important; }
        .action-btn:active { transform: scale(0.96) !important; }
        #open-inventory-button { width: 80px !important; min-width: 80px !important; max-width: 80px !important; background: #111111 !important; border: none !important; border-bottom: 3px solid #e67e22 !important; border-radius: 6px !important; height: 44px !important; padding: 0 !important; margin: 0 !important; left: auto !important; right: auto !important; top: auto !important; bottom: auto !important; position: relative !important; box-sizing: border-box !important; display: flex !important; align-items: center !important; justify-content: center !important; pointer-events: auto !important; }
        #open-inventory-button:hover { background: #181818 !important; transform: translateY(-2px) !important; }
        #open-inventory-button:active { transform: scale(0.96) !important; }
        #open-inventory-button .open-inventory-name { font-family: 'Segoe UI', Tahoma, sans-serif !important; font-size: 10px !important; font-weight: 900 !important; letter-spacing: 0.5px !important; text-transform: uppercase !important; color: #ffffff !important; margin: 0 !important; }
        .sidebar-btn, body #open-shop-menu, body #open-settings-menu, body #open-note-menu, body #open-teams-menu, body #open-management-menu { width: 70px !important; height: 70px !important; background: #111111 !important; border: none !important; border-bottom: 3px solid #e67e22 !important; border-radius: 6px !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; padding: 0 !important; margin: 0 !important; pointer-events: auto !important; transition: transform 0.1s ease, background 0.2s ease !important; }
        .sidebar-btn:hover, body #open-shop-menu:hover, body #open-settings-menu:hover, body #open-note-menu:hover, body #open-teams-menu:hover, body #open-management-menu:hover { background: #181818 !important; border-color: transparent !important; border-bottom: 3px solid #e67e22 !important; transform: translateY(-2px) !important; }
        .sidebar-btn:active, body #open-shop-menu:active, body #open-settings-menu:active, body #open-note-menu:active, body #open-teams-menu:active, body #open-management-menu:active { transform: scale(0.95) !important; }
        .sidebar-btn svg, body #open-shop-menu svg, body #open-settings-menu svg, body #open-note-menu svg, body #open-teams-menu svg, body #open-management-menu svg { margin-bottom: 4px !important; width: 22px !important; height: 22px !important; fill: none !important; stroke: #fff !important; transform: none !important; }
        .sidebar-btn span, body #open-shop-menu span, body #open-settings-menu span, body #open-note-menu span, body #open-teams-menu span, body #open-management-menu span { font-size: 10px !important; font-weight: 800 !important; text-transform: uppercase !important; letter-spacing: 0.5px !important; color: #fff !important; font-family: 'Segoe UI', sans-serif !important; margin-top: 2px !important; }
        .modal-content, #division-selector-ui, #note-ui, #locker-ui, #mp-locker-ui, #ss-locker-ui, #civ-locker-ui, #raider-locker-ui, #arrest-ui, #settings-ui, #shop-ui, #management-ui { border: 1px solid #333 !important; border-bottom: 4px solid #e67e22 !important; }
        #modd-shop-modal { position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background: rgba(0, 0, 0, 0.7) !important; z-index: 10005 !important; display: none; align-items: center !important; justify-content: center !important; padding: 0 !important; }
        #modd-shop-modal.show { display: flex !important; }
        #modd-shop-modal .modal-dialog { margin: auto !important; width: 850px !important; max-width: 95vw !important; transform: none !important; }
        #modd-shop-modal .modal-content { background: rgba(15, 15, 15, 0.98) !important; border: 1px solid rgba(255, 255, 255, 0.1) !important; border-radius: 12px !important; height: auto !important; max-height: 90vh !important; display: flex !important; flex-direction: column !important; overflow: hidden !important; animation: shopFadeIn 0.3s ease-out forwards; }
        #modd-shop-modal .modal-header { background: #e67e22 !important; padding: 15px 20px !important; border-bottom: none !important; border-radius: 0 !important; display: flex !important; justify-content: space-between !important; align-items: center !important; }
        #modd-shop-modal .modal-body { padding: 20px !important; overflow-y: auto !important; color: white !important; }
        .modal-backdrop { display: none !important; }
        #navbar-subscription-button, #navbar-moderate-button, #navbar-chat-button, #navbar-leaderboard-button, #open-moderation, #navbar-setting-button { display: none !important; }
        #bottom-right-ui-container #my-score-div { background: #111111 !important; border: none !important; border-bottom: 3px solid #e67e22 !important; border-radius: 6px !important; height: 44px !important; display: flex !important; align-items: center !important; justify-content: center !important; padding: 0 15px !important; pointer-events: auto !important; min-width: 120px !important; box-sizing: border-box !important; margin: 0 !important; transition: transform 0.1s ease !important; position: relative !important; left: auto !important; right: auto !important; top: auto !important; bottom: auto !important; }
        #bottom-right-ui-container #my-score-div:active { transform: scale(0.96) !important; }
        #bottom-right-ui-container #my-score-div > div { display: flex !important; align-items: center !important; justify-content: center !important; width: 100% !important; height: 100% !important; background: transparent !important; border: none !important; padding: 0 !important; }
        #bottom-right-ui-container #my-score-div > div > span:first-child { display: none !important; }
        #players-attribute-div { color: #fff !important; font-size: 16px !important; font-weight: 800 !important; font-family: 'Segoe UI', sans-serif !important; display: flex !important; align-items: center !important; gap: 8px !important; }
        #players-attribute-div::before { content: "$"; color: #2ecc71 !important; font-size: 18px !important; font-weight: 900 !important; }
    `;
    document.head.appendChild(fixStyle);
    const uiLayer = document.getElementById('game-ui-layer');
    const brContainer = document.getElementById('bottom-right-ui-container');
    const scoreDiv = document.getElementById('my-score-div');
    if (brContainer) {
        brContainer.style.setProperty('display', 'none', 'important');
    }
    if (scoreDiv) {
        scoreDiv.style.display = 'none'; 
        scoreDiv.className = 'sidebar-wrapper';
        if (brContainer) brContainer.appendChild(scoreDiv); 
    }
    const navContainer = document.querySelector('.navbar-container');
    const shopNavBtn = document.getElementById('navbar-shop-button');
    if (navContainer && shopNavBtn) {
        const homeBtn = document.createElement('div');
        homeBtn.className = 'nav-button';
        homeBtn.id = 'navbar-home-button';
        homeBtn.setAttribute('data-tooltip', 'Return Home');
        homeBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="white"/></svg>`;
        homeBtn.onclick = () => {
            document.getElementById('game-ui-layer').style.display = 'none';
            document.getElementById('play-menu').style.display = 'block';
            document.getElementById('play-btn').innerText = 'CONTINUE ➔';
            document.getElementById('player-name-input').disabled = true;
            if (brContainer) {
                brContainer.style.setProperty('display', 'none', 'important');
            }
            const blContainer = document.getElementById('bottom-left-ui-container');
            if (blContainer) {
                blContainer.style.setProperty('display', 'none', 'important');
            }
        };
        navContainer.insertBefore(homeBtn, shopNavBtn);
    }
    const leftSidebar = document.createElement('div');
    leftSidebar.style.cssText = "position: fixed !important; left: 20px !important; top: 50% !important; transform: translateY(-50%) !important; display: flex !important; flex-direction: column !important; gap: 12px !important; z-index: 9999 !important; pointer-events: none !important;";
    if (uiLayer) uiLayer.appendChild(leftSidebar);
    const leftButtons = ['open-shop-menu', 'open-settings-menu', 'open-note-menu', 'open-teams-menu', 'open-management-menu'];
    leftButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            const wrapper = btn.parentElement;
            if (wrapper) {
                wrapper.className = 'sidebar-wrapper';
                btn.className = 'sidebar-btn';
                btn.style.cssText = '';
                leftSidebar.appendChild(wrapper);
            }
        }
    });
    ['music', 'tooltips'].forEach(setting => {
        const btnEnabled = document.getElementById(`${setting}-enabled`);
        const btnDisabled = document.getElementById(`${setting}-disabled`);
        if (btnEnabled && btnDisabled) {
            btnEnabled.style.cssText = "position: absolute; border-radius: 6px; font-weight: 800; width: 100%; height: 100%; cursor: pointer; font-size: 11px; text-transform: uppercase; transition: all 0.2s; background: #e67e22; color: white; border: none;";
            btnDisabled.style.cssText = "position: absolute; border-radius: 6px; font-weight: 800; width: 100%; height: 100%; cursor: pointer; font-size: 11px; text-transform: uppercase; transition: all 0.2s; background: #1a1a1a; color: #777; border: 1px solid rgba(255,255,255,0.1); display: none;";
            btnEnabled.addEventListener('click', () => {
                btnEnabled.style.display = 'none';
                btnDisabled.style.display = 'block';
            });
            btnDisabled.addEventListener('click', () => {
                btnDisabled.style.display = 'none';
                btnEnabled.style.display = 'block';
            });
        }
    });
    const bottomCenterContainer = document.createElement('div');
    bottomCenterContainer.id = 'bottom-center-ui-container';
    const topButtonsRow = document.createElement('div');
    topButtonsRow.className = 'top-buttons-row';
    const invBtn = document.getElementById('open-inventory-button');
    const invBtnWrapper = invBtn?.parentElement;
    if (invBtn) {
        invBtn.classList.add('action-btn');
        topButtonsRow.appendChild(invBtn);
        if (invBtnWrapper) invBtnWrapper.remove();
    }
    const saluteBtn = document.createElement('button');
    saluteBtn.className = 'action-btn';
    saluteBtn.innerText = 'SALUTE';
    topButtonsRow.appendChild(saluteBtn);
    const atEaseBtn = document.createElement('button');
    atEaseBtn.className = 'action-btn';
    atEaseBtn.innerText = 'AT EASE';
    topButtonsRow.appendChild(atEaseBtn);
    const invSlotsRow = document.createElement('div');
    invSlotsRow.className = 'inv-slots-row';
    window.selectSlot = function(index) {
        for(let i=1; i<=5; i++) {
            const s = document.getElementById('inv-slot-' + i);
            if(s) {
                if(i === index) s.classList.add('selected');
                else s.classList.remove('selected');
            }
        }
    };
    for (let i = 1; i <= 5; i++) {
        const slot = document.createElement('div');
        slot.id = 'inv-slot-' + i;
        slot.className = 'inv-slot' + (i === 1 ? ' selected' : '');
        slot.innerText = i;
        slot.onclick = () => window.selectSlot(i);
        invSlotsRow.appendChild(slot);
    }
    bottomCenterContainer.appendChild(topButtonsRow);
    bottomCenterContainer.appendChild(invSlotsRow);
    if (uiLayer) uiLayer.appendChild(bottomCenterContainer);
    window.addEventListener('keydown', (e) => {
        if (document.activeElement !== document.getElementById('chat-input') && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            if (e.key >= '1' && e.key <= '5') {
                window.selectSlot(parseInt(e.key));
            }
        }
    });
    const noteTextArea = document.getElementById('note-textarea');
    if (noteTextArea) noteTextArea.classList.remove('trigger');
    ['navbar-subscription-button', 'navbar-moderate-button', 'navbar-chat-button', 'navbar-leaderboard-button', 'open-moderation', 'navbar-setting-button'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
}

function setupMap(jsonObj) {
    const gameData = jsonObj.data || jsonObj;
    const m = gameData.map;
    columns = m.width;
    rows = m.height;
    layers = m.layers;
    try {
        const spawnRegion = gameData.variables["civilian spawn"].default;
        if (spawnRegion) {
            player.x = spawnRegion.x + (spawnRegion.width / 2) - (player.width / 2);
            player.y = spawnRegion.y + (spawnRegion.height / 2) - (player.height / 2);
        } else {
            player.x = 1500;
            player.y = 2200;
        }
    } catch (e) {
        player.x = 1500;
        player.y = 2200;
    }
}

function loadImages() {
    tilesheetImg.crossOrigin = "Anonymous";
    tilesheetImg.onload = onAssetLoad;
    tilesheetImg.onerror = () => {
        document.getElementById('loading-text').innerText = "ERROR: Could not load tilesheet from Cache!";
        document.getElementById('loading-text').style.color = "red";
    };
    tilesheetImg.src = "assets/tilesheet.png";
    playerImg.crossOrigin = "Anonymous";
    playerImg.onload = onAssetLoad;
    playerImg.onerror = () => {
        document.getElementById('loading-text').innerText = "ERROR: Could not load player sprite!";
        document.getElementById('loading-text').style.color = "red";
    };
    playerImg.src = "assets/player.png";
}

function onAssetLoad() {
    assetsLoaded++;
    if (assetsLoaded === 2) {
        document.getElementById('loading-text').innerText = "LOADING...";
        requestAnimationFrame(() => {
            setTimeout(() => {
                preRenderMap(); 
                document.querySelectorAll('#loading-screen, .engine-loading-screen').forEach(el => el.remove());
                canvas.style.display = 'block';
                document.getElementById('play-menu').style.display = 'block';
                resizeCanvas();
                lastTime = performance.now();
                requestAnimationFrame(gameLoop);
            }, 50);
        });
    }
}

function preRenderMap() {
    const numChunksX = Math.ceil((columns * TILE_SIZE) / CHUNK_SIZE);
    const numChunksY = Math.ceil((rows * TILE_SIZE) / CHUNK_SIZE);
    for (let cy = 0; cy < numChunksY; cy++) {
        bgChunks[cy] = [];
        fgChunks[cy] = [];
        for (let cx = 0; cx < numChunksX; cx++) {
            const bgCanvas = document.createElement('canvas');
            bgCanvas.width = CHUNK_SIZE;
            bgCanvas.height = CHUNK_SIZE;
            const bgCtx = bgCanvas.getContext('2d', { alpha: true });
            bgCtx.imageSmoothingEnabled = false;
            const fgCanvas = document.createElement('canvas');
            fgCanvas.width = CHUNK_SIZE;
            fgCanvas.height = CHUNK_SIZE;
            const fgCtx = fgCanvas.getContext('2d', { alpha: true });
            fgCtx.imageSmoothingEnabled = false;
            layers.forEach(layer => {
                if (layer.type !== "tilelayer" || !layer.visible) return;
                const targetCtx = layer.name === "trees" ? fgCtx : bgCtx;
                const startCol = Math.floor((cx * CHUNK_SIZE) / TILE_SIZE);
                const endCol = Math.ceil(((cx + 1) * CHUNK_SIZE) / TILE_SIZE);
                const startRow = Math.floor((cy * CHUNK_SIZE) / TILE_SIZE);
                const endRow = Math.ceil(((cy + 1) * CHUNK_SIZE) / TILE_SIZE);
                for (let r = Math.max(0, startRow); r < Math.min(rows, endRow); r++) {
                    for (let c = Math.max(0, startCol); c < Math.min(columns, endCol); c++) {
                        const tileIndex = r * columns + c;
                        const gid = layer.data[tileIndex];
                        if (gid > 0) {
                            const tileId = gid - 1;
                            const srcX = (tileId % tilesetCols) * TILE_SIZE;
                            const srcY = Math.floor(tileId / tilesetCols) * TILE_SIZE;
                            const destX = (c * TILE_SIZE) - (cx * CHUNK_SIZE);
                            const destY = (r * TILE_SIZE) - (cy * CHUNK_SIZE);
                            targetCtx.drawImage(
                                tilesheetImg,
                                srcX, srcY, TILE_SIZE, TILE_SIZE,
                                destX, destY, TILE_SIZE, TILE_SIZE
                            );
                        }
                    }
                }
            });
            bgChunks[cy][cx] = bgCanvas;
            fgChunks[cy][cx] = fgCanvas;
        }
    }
}

function resolveCircleCollisions() {
    const currentScale = keys['c'] ? 0.92 : 1;
    const radius = (player.width * currentScale) / 2;
    let cx = player.x + (player.width / 2);
    let cy = player.y + (player.height / 2);
    const left = Math.floor((cx - radius) / TILE_SIZE);
    const right = Math.floor((cx + radius) / TILE_SIZE);
    const top = Math.floor((cy - radius) / TILE_SIZE);
    const bottom = Math.floor((cy + radius) / TILE_SIZE);
    const wallLayer = layers.find(l => l.name === "walls");
    if (!wallLayer) return;
    for (let r = top; r <= bottom; r++) {
        for (let c = left; c <= right; c++) {
            if (c < 0 || c >= columns || r < 0 || r >= rows) continue;
            const index = r * columns + c;
            if (wallLayer.data[index] > 0) {
                const tileX = c * TILE_SIZE;
                const tileY = r * TILE_SIZE;
                let testX = cx;
                let testY = cy;
                if (cx < tileX) testX = tileX;
                else if (cx > tileX + TILE_SIZE) testX = tileX + TILE_SIZE;
                if (cy < tileY) testY = tileY;
                else if (cy > tileY + TILE_SIZE) testY = tileY + TILE_SIZE;
                const distX = cx - testX;
                const distY = cy - testY;
                const distance = Math.sqrt(distX * distX + distY * distY);
                if (distance > 0 && distance < radius) {
                    const overlap = radius - distance;
                    const nx = distX / distance;
                    const ny = distY / distance;
                    cx += nx * overlap;
                    cy += ny * overlap;
                }
            }
        }
    }
    player.x = cx - (player.width / 2);
    player.y = cy - (player.height / 2);
}

function update(dt) {
    if (document.getElementById('play-menu').style.display !== 'none') return;
    
    let inputX = 0;
    let inputY = 0;
    if (keys['w'] || keys['arrowup']) inputY -= 1;
    if (keys['s'] || keys['arrowdown']) inputY += 1;
    if (keys['a'] || keys['arrowleft']) inputX -= 1;
    if (keys['d'] || keys['arrowright']) inputX += 1;
    
    let isMoving = (inputX !== 0 || inputY !== 0);
    if (isMoving) {
        const length = Math.sqrt(inputX * inputX + inputY * inputY);
        inputX /= length;
        inputY /= length;
    }
    
    if (keys['shift'] && isMoving) {
        player.bopTimer += dt;
    } else {
        player.bopTimer = 0;
    }
    
    let bopScale = 0;
    if (player.bopTimer > 0) {
        bopScale = Math.sin(player.bopTimer * 15) * 0.05;
    }
    player.scale = (keys['c'] ? 0.92 : 1) + bopScale;
    
    const friction = Math.pow(0.001, dt);
    let accel = 1493; 
    if (keys['shift']) accel = 1866; 
    if (keys['c']) accel = 663; 
    
    player.vx += inputX * accel * dt;
    player.vy += inputY * accel * dt;
    player.vx *= friction;
    player.vy *= friction;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    
    for (let i = 0; i < 3; i++) {
        resolveCircleCollisions();
    }
    
    if (player.x < 0) player.x = 0;
    if (player.y < 0) player.y = 0;
    if (player.x + player.width > columns * TILE_SIZE) player.x = columns * TILE_SIZE - player.width;
    if (player.y + player.height > rows * TILE_SIZE) player.y = rows * TILE_SIZE - player.height;

    camera.x = player.x + (player.width / 2) - (camera.width / 2);
    camera.y = player.y + (player.height / 2) - (camera.height / 2);

    const scaledMouseX = mouseX / viewScale;
    const scaledMouseY = mouseY / viewScale;
    const playerScreenX = player.x - camera.x + (player.width / 2);
    const playerScreenY = player.y - camera.y + (player.height / 2);
    player.angle = Math.atan2(scaledMouseY - playerScreenY, scaledMouseX - playerScreenX) + (Math.PI / 2);

    if (myId && document.getElementById('play-menu').style.display === 'none') {
        const now = performance.now();
        if (now - lastSyncTime > 100) { 
            set(ref(db, `players/${myId}`), {
                name: player.name,
                team: player.team,
                x: player.x,
                y: player.y,
                angle: player.angle,
                scale: player.scale,
                chats: player.chats
            });
            lastSyncTime = now;
        }
    }

    for (let id in allPlayers) {
        if (id === myId) continue;
        let p = allPlayers[id];
        
        if (p.targetX !== undefined) {
            p.x += (p.targetX - p.x) * dt * 12;
            p.y += (p.targetY - p.y) * dt * 12;
            
            let diff = p.targetAngle - p.angle;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            p.angle += diff * dt * 12;
        }
    }
}

function render() {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(viewScale, viewScale);

    const startCX = Math.max(0, Math.floor(camera.x / CHUNK_SIZE));
    const endCX = Math.min(bgChunks[0].length - 1, Math.floor((camera.x + camera.width) / CHUNK_SIZE));
    const startCY = Math.max(0, Math.floor(camera.y / CHUNK_SIZE));
    const endCY = Math.min(bgChunks.length - 1, Math.floor((camera.y + camera.height) / CHUNK_SIZE));

    for (let cy = startCY; cy <= endCY; cy++) {
        for (let cx = startCX; cx <= endCX; cx++) {
            const destX = Math.floor(cx * CHUNK_SIZE - camera.x);
            const destY = Math.floor(cy * CHUNK_SIZE - camera.y);
            ctx.drawImage(bgChunks[cy][cx], destX, destY);
        }
    }

    if (!allPlayers[myId]) {
        allPlayers[myId] = player;
    }

    for (let id in allPlayers) {
        const p = (id === myId) ? player : allPlayers[id];
        
        if (!p.name && id !== myId) continue;
        
        const drawX = p.x;
        const drawY = p.y;
        const drawAngle = p.angle;
        const drawScale = p.scale;
        const drawName = p.name;
        const drawTeam = p.team || "Civilians";
        const tColor = drawTeam === 'Military' ? '#22b534' : '#b7ffa1';

        const pRenderX = drawX - camera.x + (player.width / 2);
        const pRenderY = drawY - camera.y + (player.height / 2);
        const pScaledW = player.width * drawScale;
        const pScaledH = player.height * drawScale;

        ctx.save();
        ctx.translate(pRenderX, pRenderY);
        ctx.rotate(drawAngle);
        ctx.drawImage(playerImg, -pScaledW / 2, -pScaledH / 2, pScaledW, pScaledH);
        ctx.restore();

        if (drawName && document.getElementById('play-menu').style.display === 'none') {
            ctx.textAlign = "center";
            ctx.lineJoin = "round";
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
            
            let divisionY = pRenderY - (pScaledH / 2) - 8;
            ctx.font = "bold 12px 'Segoe UI'";
            ctx.fillStyle = tColor; 
            ctx.strokeText(drawTeam, pRenderX, divisionY);
            ctx.fillText(drawTeam, pRenderX, divisionY);
            
            let rankY = divisionY - 16;
            ctx.font = "bold 12px 'Segoe UI'";
            ctx.fillStyle = "rgba(235, 235, 235, 0.9)";
            if (drawTeam === "Military") {
                ctx.strokeText("• [E1] Private •", pRenderX, rankY);
                ctx.fillText("• [E1] Private •", pRenderX, rankY);
            } else {
                ctx.strokeText("• Civilian •", pRenderX, rankY);
                ctx.fillText("• Civilian •", pRenderX, rankY);
            }
            
            let nameY = rankY - 16;
            ctx.font = "bold 13px 'Segoe UI'";
            ctx.fillStyle = tColor;
            ctx.strokeText(drawName, pRenderX, nameY);
            ctx.fillText(drawName, pRenderX, nameY);

            if (p.activeChats && p.activeChats.length > 0) {
                let currentYOffset = 0;
                for (let i = p.activeChats.length - 1; i >= 0; i--) {
                    let chat = p.activeChats[i];
                    let duration = Math.max(4000, chat.m.length * 100);
                    let chatElapsed = performance.now() - chat.localStartTime;

                    if (chatElapsed > duration) {
                        p.activeChats.splice(i, 1);
                        continue;
                    }

                    let chatAlpha = 1;
                    let slideOffsetY = 0;
                    
                    if (chatElapsed < 300) {
                        let prog = chatElapsed / 300;
                        chatAlpha = prog;
                        slideOffsetY = 10 * (1 - prog); 
                    } else if (chatElapsed > duration - 300) {
                        let prog = (chatElapsed - (duration - 300)) / 300;
                        chatAlpha = 1 - prog;
                        slideOffsetY = -10 * prog; 
                    }
                    
                    ctx.globalAlpha = chatAlpha;
                    ctx.font = "bold 13px 'Segoe UI'";
                    
                    let lines = getLines(ctx, chat.m, 180);
                    let bubbleHeight = 10 + (lines.length * 16);
                    let bubbleWidth = 0;
                    lines.forEach(l => {
                        let w = ctx.measureText(l).width;
                        if (w > bubbleWidth) bubbleWidth = w;
                    });
                    bubbleWidth += 20;

                    const bubbleX = pRenderX - (bubbleWidth / 2);
                    const bubbleY = nameY - 35 - currentYOffset - bubbleHeight + slideOffsetY; 
                    
                    ctx.fillStyle = "rgba(10, 10, 10, 0.92)";
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
                    ctx.lineWidth = 1;
                    
                    ctx.beginPath();
                    ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 8);
                    ctx.fill();
                    ctx.stroke();

                    ctx.fillStyle = "#fff";
                    lines.forEach((line, index) => {
                        ctx.fillText(line, pRenderX, bubbleY + 16 + (index * 16));
                    });
                    
                    ctx.globalAlpha = 1.0;
                    currentYOffset += bubbleHeight + 5;
                }
            }
        }
    }

    for (let cy = startCY; cy <= endCY; cy++) {
        for (let cx = startCX; cx <= endCX; cx++) {
            const destX = Math.floor(cx * CHUNK_SIZE - camera.x);
            const destY = Math.floor(cy * CHUNK_SIZE - camera.y);
            ctx.drawImage(fgChunks[cy][cx], destX, destY);
        }
    }

    ctx.restore();
}

function gameLoop(now) {
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt > 0.1) dt = 0.1;
    update(dt);
    render();
    requestAnimationFrame(gameLoop);
}
