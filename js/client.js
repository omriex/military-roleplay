
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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
const googleProvider = new GoogleAuthProvider();

let myId = null;
let allPlayers = {};

const militaryRanks = [
    "• [E1] Private •", "• [E2] Private First Class •", "• [E3] Corporal •",
    "• [E4] Lance Corporal •", "• [E5] Sergeant •", "• [E6] Staff Sergeant •",
    "• [E7] Sergeant First Class •", "• [E8] Master Sergeant •", "• [E9] Doesn't Exist •",
    "• [E10] First Sergeant •", "• [E11] Sergeant Major •", "• [E12] Command Sergeant Major •",
    "• [O1] Second Lieutenant •", "• [O2] First Lieutenant •", "• [O3] Captain •",
    "• [O4] Major •", "• [O5] Lieutenant Colonel •", "• [O6] Colonel •",
    "• [O7] Brigadier General •", "• [O8] Major General •", "• [O9] Lieutenant General •",
    "• [O10] General •"
];

function syncPlayer() {
    if (!myId) return;
    set(ref(db, `players/${myId}`), {
        name: player.name,
        email: player.email,
        team: player.team,
        rank: player.rank,
        money: player.money,
        x: player.x,
        y: player.y,
        angle: player.angle,
        scale: player.scale,
        chats: player.chats,
        lastSeen: Date.now()
    });
}

function assignRank() {
    if (player.email === "omarshafee037@gmail.com") {
        player.rank = "• [O10] General •";
    } else if (player.team === "Military") {
        player.rank = militaryRanks[0];
    } else {
        player.rank = "• Civilian •";
    }
}

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
    assignRank();
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
    
    const finalLines = [];
    for (let line of lines) {
        if (ctx.measureText(line).width > maxWidth) {
            let temp = "";
            for (let char of line) {
                if (ctx.measureText(temp + char).width > maxWidth) {
                    finalLines.push(temp);
                    temp = char;
                } else {
                    temp += char;
                }
            }
            if (temp) finalLines.push(temp);
        } else {
            finalLines.push(line);
        }
    }
    return finalLines;
}

function updateLeaderboard() {
    const scoreboardList = document.getElementById('ui-text-scoreboard-id');
    const playerAttr = document.getElementById('players-attribute-div');
    if (!scoreboardList) return;

    let html = '';
    const sortedPlayers = Object.values(allPlayers).sort((a, b) => (b.money || 0) - (a.money || 0));

    for (const p of sortedPlayers) {
        if (p && p.name) {
            let tColor = p.team === 'Military' ? '#22b534' : '#b7ffa1';
            
            html += `<div style="display: flex; justify-content: space-between; width: 100%;">
                        <span style="color:${tColor}; text-shadow: 0px 0px 5px rgba(0,0,0,0.8); font-weight: 800;">${p.name}</span>
                        <span style="color:#2ecc71;">$${p.money || 0}</span>
                     </div>`;
        }
    }
    
    scoreboardList.innerHTML = html;
    if (playerAttr) playerAttr.innerText = (player.money || 0).toString();
}

signInAnonymously(auth).catch((error) => {
    alert("Multiplayer Error! Please enable 'Anonymous' in Firebase Authentication. Details: " + error.message);
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        myId = user.uid;
        if (user.email) {
            player.email = user.email;
            assignRank();
            const btn = document.getElementById('google-login-btn');
            const txt = document.getElementById('google-login-text');
            if (txt) txt.innerText = "LOGGED IN";
            if (btn) btn.style.pointerEvents = "none";
        }
        
        onDisconnect(ref(db, `players/${myId}`)).remove();
        onValue(ref(db, 'players'), (snapshot) => {
            const data = snapshot.val() || {};
            const now = Date.now();
            
            for (let id in data) {
                if (id === myId) continue;

                let remote = data[id];
                
                if (now - (remote.lastSeen || 0) > 15000) {
                    delete allPlayers[id];
                    continue;
                }
                
                if (!allPlayers[id]) {
                    allPlayers[id] = {
                        ...remote,
                        targetX: remote.x,
                        targetY: remote.y,
                        targetAngle: remote.angle,
                        activeChats: [],
                        seenChats: new Set()
                    };
                    if (remote.chats) {
                        remote.chats.forEach(rc => {
                            allPlayers[id].seenChats.add(rc.t);
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
                    p.email = remote.email;
                    p.team = remote.team || "Civilians";
                    p.rank = remote.rank || "• Civilian •";
                    p.money = remote.money || 0;
                    p.wearingCap = remote.wearingCap || false;
                    p.wearingUniform = remote.wearingUniform || false;
                    p.lastSeen = remote.lastSeen;
                    p.localLastUpdate = Date.now();
                    
                    if (remote.chats) {
                        if (!p.activeChats) p.activeChats = [];
                        if (!p.seenChats) p.seenChats = new Set();
                        if (p.seenChats.size === 0) {
                            remote.chats.forEach(rc => p.seenChats.add(rc.t));
                        } else {
                            remote.chats.forEach(rc => {
                                if (!p.seenChats.has(rc.t)) {
                                    p.seenChats.add(rc.t);
                                    p.activeChats.push({ m: rc.m, t: rc.t, localStartTime: performance.now() });
                                    if (p.activeChats.length > 3) p.activeChats.shift();
                                }
                            });
                        }
                        if (p.seenChats.size > 20) {
                            p.seenChats = new Set(Array.from(p.seenChats).slice(-10));
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
const militaryCapImg = new Image();
const militaryUniformImg = new Image();
let assetsLoaded = 0;

const outfitOffsets = {
    uniform: { x: 0, y: 0, w: 64, h: 64 },
    cap: { x: 0, y: -5, w: 60, h: 71 }
};

const keys = {
    w: false, a: false, s: false, d: false, c: false, shift: false,
    arrowup: false, arrowleft: false, arrowdown: false, arrowright: false
};
let mouseX = 0, mouseY = 0;

let player = {
    name: "",
    email: "",
    team: "Civilians",
    rank: "• Civilian •",
    money: 0,
    nextMoneyRewardTime: 0,
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
let lastTime = performance.now();
const TILE_SIZE = 64;
let columns = 0, rows = 0, layers = [], tilesetCols = 64;
const CHUNK_SIZE = 1024;
let bgChunks = [];
let fgChunks = [];

window.addEventListener('resize', resizeCanvas);

window.addEventListener('keydown', e => { 
    if (e.key === 'Enter') {
        const playMenu = document.getElementById('play-menu');
        if (playMenu && playMenu.style.display !== 'none') return; 

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
                    
                    const msgTime = Date.now();
                    player.chats.push({ m: msg, t: msgTime });
                    if (player.chats.length > 3) player.chats.shift();
                    
                    if (!player.activeChats) player.activeChats = [];
                    player.activeChats.push({ m: msg, t: msgTime, localStartTime: performance.now() });
                    if (player.activeChats.length > 3) player.activeChats.shift();

                    syncPlayer();
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
                syncPlayer();
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
                syncPlayer();
            }
        });
    }

    document.getElementById('play-btn').addEventListener('click', () => {
        const nameInput = document.getElementById('player-name-input');
        let name = nameInput.value.trim();
        if (!nameInput.disabled) {
            player.name = name ? name : "user" + Math.floor(Math.random() * 1001);
            assignRank();
            player.nextMoneyRewardTime = Date.now() + (Math.random() * 15000 + 15000);
        }
        document.getElementById('play-menu').style.display = 'none';
        
        const loginBtn = document.getElementById('google-login-btn');
        if (loginBtn) loginBtn.style.display = 'none';

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
            syncPlayer();
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

    setTimeout(() => {
        document.querySelectorAll('.sub-toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                let container = btn.nextElementSibling;
                if (container && container.classList.contains('sub-container')) {
                    container.style.display = (container.style.display === 'none' || container.style.display === '') ? 'block' : 'none';
                }
            });
        });
    }, 2000);
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
        #division-selector-ui .division-scroll-container > div { justify-content: center !important; }
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
            
            const loginBtn = document.getElementById('google-login-btn');
            if (loginBtn) loginBtn.style.display = 'flex';

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

    const googleBtn = document.createElement('button');
    googleBtn.id = "google-login-btn";
    googleBtn.innerHTML = `
        <svg viewBox="0 0 48 48" width="18" height="18" style="margin-right: 8px;"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.73 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        <span id="google-login-text">LOGIN</span>
    `;
    googleBtn.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #111111;
        border: none;
        border-bottom: 3px solid #e67e22;
        border-radius: 6px;
        padding: 0 15px;
        height: 44px;
        color: white;
        font-family: 'Segoe UI', Tahoma, sans-serif;
        font-weight: 900;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        transition: transform 0.1s ease, background 0.2s ease;
        z-index: 100000;
    `;
    googleBtn.onmouseover = () => { googleBtn.style.background = "#181818"; googleBtn.style.transform = "translateY(-2px)"; };
    googleBtn.onmouseout = () => { googleBtn.style.background = "#111111"; googleBtn.style.transform = "translateY(0)"; };
    googleBtn.onmousedown = () => { googleBtn.style.transform = "scale(0.95)"; };
    googleBtn.onclick = () => {
        signInWithPopup(auth, googleProvider).then((result) => {
            const user = result.user;
            player.email = user.email;
            document.getElementById('google-login-text').innerText = "LOGGED IN";
            googleBtn.style.pointerEvents = "none";
            assignRank();
            syncPlayer();
        }).catch(error => {
            showNotification("Login failed: " + error.message);
        });
    };
    
    if (player.email) {
        document.getElementById('google-login-text').innerText = "LOGGED IN";
        googleBtn.style.pointerEvents = "none";
    }

    document.body.appendChild(googleBtn);

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
        slot.innerText = '';
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

    militaryCapImg.crossOrigin = "Anonymous";
    militaryCapImg.onload = onAssetLoad;
    militaryCapImg.src = "assets/military-cap.png";

    militaryUniformImg.crossOrigin = "Anonymous";
    militaryUniformImg.onload = onAssetLoad;
    militaryUniformImg.src = "assets/military-uniform.png";
}

function onAssetLoad() {
    assetsLoaded++;
    if (assetsLoaded === 4) {
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

function resolvePlayerCollisions(dt) {
    const currentScale = keys['c'] ? 0.92 : 1;
    const radius = (player.width * currentScale) / 2;
    let cx = player.x + (player.width / 2);
    let cy = player.y + (player.height / 2);

    for (let id in allPlayers) {
        if (id === myId) continue;
        const p2 = allPlayers[id];
        if (p2.zombie || p2.x === undefined || p2.y === undefined) continue;

        const p2Radius = (p2.width || 45) * (p2.scale || 1) / 2;
        let p2cx = p2.x + ((p2.width || 45) / 2);
        let p2cy = p2.y + ((p2.height || 45) / 2);

        let dx = cx - p2cx;
        let dy = cy - p2cy;
        let dist = Math.sqrt(dx * dx + dy * dy);
        let minDist = radius + p2Radius;

        if (dist > 0 && dist < minDist) {
            let overlap = minDist - dist;
            let nx = dx / dist;
            let ny = dy / dist;
            
            cx += nx * overlap * 0.5;
            cy += ny * overlap * 0.5;
            
            player.vx += nx * 125 * dt;
            player.vy += ny * 125 * dt;
        }
    }
    player.x = cx - (player.width / 2);
    player.y = cy - (player.height / 2);
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
    const playMenu = document.getElementById('play-menu');
    if (playMenu && playMenu.style.display !== 'none') return;
    
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
        resolvePlayerCollisions(dt);
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

setInterval(() => {
    const now = Date.now();
    for (let id in allPlayers) {
        if (id === myId) continue;
        let p = allPlayers[id];
        if (p.localLastUpdate && (now - p.localLastUpdate > 5000)) {
            p.zombie = true;
        } else {
            p.zombie = false;
        }
    }
}, 2000);

setInterval(() => {
    if (myId && document.getElementById('play-menu').style.display === 'none') {
        const now = Date.now();
        while (now >= player.nextMoneyRewardTime) {
            player.nextMoneyRewardTime += (Math.random() * 15000 + 15000);
            player.money += Math.floor(Math.random() * 26) + 25;
            updateLeaderboard();
        }
        syncPlayer();
    }
}, 100);

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

    const playMenu = document.getElementById('play-menu');
    const playBtn = document.getElementById('play-btn');
    const isPlayMenuVisible = playMenu && playMenu.style.display !== 'none';
    const isInitialLoad = isPlayMenuVisible && playBtn && playBtn.innerText.toUpperCase().includes('PLAY');

    if (!isInitialLoad) {
        if (!allPlayers[myId] && !isPlayMenuVisible) {
            allPlayers[myId] = player;
        }

        for (let id in allPlayers) {
            const p = (id === myId) ? player : allPlayers[id];
            
            if ((!p.name || p.zombie) && id !== myId) continue;
            if (id === myId && isPlayMenuVisible) continue;
            
            const drawX = p.x;
            const drawY = p.y;
            const drawAngle = p.angle;
            const drawScale = p.scale;

            const pRenderX = drawX - camera.x + ((p.width || 45) / 2);
            const pRenderY = drawY - camera.y + ((p.height || 45) / 2);
            const pScaledW = (p.width || 45) * drawScale;
            const pScaledH = (p.height || 45) * drawScale;

            ctx.save();
            ctx.translate(pRenderX, pRenderY);
            ctx.rotate(drawAngle);
            ctx.drawImage(playerImg, -pScaledW / 2, -pScaledH / 2, pScaledW, pScaledH);
            const outfitRatio = (p.width || 45) / 64;
            if (p.wearingUniform && militaryUniformImg) {
                const uw = outfitOffsets.uniform.w * drawScale * outfitRatio;
                const uh = outfitOffsets.uniform.h * drawScale * outfitRatio;
                const ux = outfitOffsets.uniform.x * drawScale * outfitRatio;
                const uy = outfitOffsets.uniform.y * drawScale * outfitRatio;
                ctx.drawImage(militaryUniformImg, ux - uw / 2, uy - uh / 2, uw, uh);
            }
            if (p.wearingCap && militaryCapImg) {
                const cw = outfitOffsets.cap.w * drawScale * outfitRatio;
                const ch = outfitOffsets.cap.h * drawScale * outfitRatio;
                const cx = outfitOffsets.cap.x * drawScale * outfitRatio;
                const cy = outfitOffsets.cap.y * drawScale * outfitRatio;
                ctx.drawImage(militaryCapImg, cx - cw / 2, cy - ch / 2, cw, ch);
            }
            ctx.restore();
        }
    }

    for (let cy = startCY; cy <= endCY; cy++) {
        for (let cx = startCX; cx <= endCX; cx++) {
            const destX = Math.floor(cx * CHUNK_SIZE - camera.x);
            const destY = Math.floor(cy * CHUNK_SIZE - camera.y);
            ctx.drawImage(fgChunks[cy][cx], destX, destY);
        }
    }

    if (!isInitialLoad) {
        for (let id in allPlayers) {
            const p = (id === myId) ? player : allPlayers[id];
            
            if (!p.name && id !== myId) continue;
            if (id === myId && isPlayMenuVisible) continue;

            let drawTeam = p.team || "Civilians";
            let drawRank = p.rank || "• Civilian •";
            const drawName = p.name;
            let tColor = drawTeam === 'Military' ? '#22b534' : '#b7ffa1';

            const pRenderX = p.x - camera.x + ((p.width || 45) / 2);
            const pRenderY = p.y - camera.y + ((p.height || 45) / 2);
            const pScaledH = (p.height || 45) * (p.scale || 1);

            ctx.textAlign = "center";
            ctx.lineJoin = "round";
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";

            let teamY = pRenderY - (pScaledH / 2) - 8;
            let rankY = teamY - 16;
            let nameY = rankY - 16;

            if (drawTeam) {
                ctx.font = "bold 12px 'Segoe UI'";
                ctx.fillStyle = tColor; 
                ctx.strokeText(drawTeam, pRenderX, teamY);
                ctx.fillText(drawTeam, pRenderX, teamY);
            }

            if (drawRank) {
                ctx.font = "bold 12px 'Segoe UI'";
                ctx.fillStyle = "rgba(235, 235, 235, 0.9)";
                ctx.strokeText(drawRank, pRenderX, rankY);
                ctx.fillText(drawRank, pRenderX, rankY);
            }

            ctx.font = "bold 13px 'Segoe UI'";
            ctx.fillStyle = tColor;
            ctx.strokeText(drawName, pRenderX, nameY);
            ctx.fillText(drawName, pRenderX, nameY);
        }

        for (let id in allPlayers) {
            const p = (id === myId) ? player : allPlayers[id];
            
            if (!p.name && id !== myId) continue;
            if (id === myId && isPlayMenuVisible) continue;
            
            const pRenderX = p.x - camera.x + ((p.width || 45) / 2);
            const pRenderY = p.y - camera.y + ((p.height || 45) / 2);
            const pScaledH = (p.height || 45) * (p.scale || 1);
            let nameY = pRenderY - (pScaledH / 2) - 40; 

            if (p.activeChats && p.activeChats.length > 0) {
                let currentYOffset = 0;
                for (let i = p.activeChats.length - 1; i >= 0; i--) {
                    let chat = p.activeChats[i];
                    let duration = Math.min(8000, Math.max(4000, chat.m.length * 100));
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
                    
                    let lines = getLines(ctx, chat.m, 220);
                    let bubbleHeight = 10 + (lines.length * 16);
                    let bubbleWidth = 0;
                    lines.forEach(l => {
                        let w = ctx.measureText(l).width;
                        if (w > bubbleWidth) bubbleWidth = w;
                    });
                    bubbleWidth += 20;

                    const bubbleX = pRenderX - (bubbleWidth / 2);
                    const bubbleY = nameY - 10 - currentYOffset - bubbleHeight + slideOffsetY; 
                    
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

(function() {
    const lockerHTML = `
        <div id="locker-prompt" style="display: none; position: fixed; top: 60px; left: 50%; transform: translateX(-50%); background: #e67e22; color: white; padding: 10px 20px; border-radius: 4px; font-weight: 800; font-family: 'Segoe UI', sans-serif; text-transform: uppercase; letter-spacing: 2px; font-size: 14px; z-index: 10000; box-shadow: 0 5px 15px rgba(0,0,0,0.5); pointer-events: none; animation: divFadeIn 0.2s ease-out forwards;">PRESS [F] TO INTERACT</div>
        <div id="custom-military-locker" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(10, 10, 10, 0.98); border: 1px solid #333; border-bottom: 4px solid #e67e22; border-radius: 12px; width: 400px; max-height: 480px; box-shadow: 0 20px 50px rgba(0,0,0,0.9); font-family: 'Segoe UI', sans-serif; z-index: 10000; display: none; flex-direction: column; animation: divFadeIn 0.3s ease-out forwards; overflow: hidden;">
            <div style="background: #e67e22; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                <span style="color: white; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; font-size: 16px;">Military Locker</span>
                <button id="close-locker-btn" style="background: #c0392b; border: none; color: white; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-weight: bold; transition: transform 0.1s ease;">X</button>
            </div>
            <div style="padding: 30px; display: flex; gap: 20px; justify-content: center; overflow-y: auto; color: white;">
                <button id="equip-cap-btn" class="action-btn" style="width: 120px !important; height: 120px !important; max-width: none !important; flex-direction: column; gap: 10px; cursor: pointer;">
                    <img src="assets/military-cap.png" style="width: 64px; height: 64px; object-fit: contain; pointer-events: none;">
                    <span style="pointer-events: none;">CAP</span>
                </button>
                <button id="equip-uniform-btn" class="action-btn" style="width: 120px !important; height: 120px !important; max-width: none !important; flex-direction: column; gap: 10px; cursor: pointer;">
                    <img src="assets/military-uniform.png" style="width: 64px; height: 64px; object-fit: contain; pointer-events: none;">
                    <span style="pointer-events: none;">UNIFORM</span>
                </button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', lockerHTML);

    const lockerUI = document.getElementById('custom-military-locker');
    document.getElementById('close-locker-btn').addEventListener('click', () => {
        lockerUI.style.display = 'none';
    });

    setInterval(() => {
        const prompt = document.getElementById('locker-prompt');
        if (!prompt) return;
        if (isInLockerRegion() && lockerUI.style.display !== 'flex' && player.team === 'Military') {
            if (prompt.style.display !== 'block') prompt.style.display = 'block';
        } else {
            if (prompt.style.display !== 'none') prompt.style.display = 'none';
        }
    }, 100);

    function isInLockerRegion() {
        const gameData = GAME_JSON.data || GAME_JSON;
        if (!gameData || !gameData.variables) return false;
        const pw = player.width || 45;
        const ph = player.height || 45;
        const P = 40;
        for (const key in gameData.variables) {
            if (key.toLowerCase().includes('locker') && gameData.variables[key].default) {
                const r = gameData.variables[key].default;
                if (player.x < r.x + r.width + P && player.x + pw > r.x - P &&
                    player.y < r.y + r.height + P && player.y + ph > r.y - P) {
                    return true;
                }
            }
        }
        return false;
    }

    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'f' && isInLockerRegion()) {
            if (player.team === 'Military') {
                lockerUI.style.display = lockerUI.style.display === 'none' ? 'flex' : 'none';
            }
        }
    });

    const inventoryState = { cap: false, uniform: false };

    function toggleItem(type) {
        let existing = document.querySelector(`.draggable-item[data-type="${type}"]`);
        if (existing) {
            existing.remove();
            inventoryState[type] = false;
        } else {
            let slotFound = null;
            for(let i=1; i<=5; i++) {
                let s = document.getElementById('inv-slot-' + i);
                if (s && s.children.length === 0) {
                    slotFound = s;
                    break;
                }
            }
            if (slotFound) {
                let img = document.createElement('img');
                img.src = `assets/military-${type}.png`;
                img.dataset.type = type;
                img.className = 'draggable-item';
                img.style.cssText = 'width: 32px; height: 32px; object-fit: contain; cursor: grab; pointer-events: auto; z-index: 10000;';
                slotFound.innerHTML = '';
                slotFound.appendChild(img);
                inventoryState[type] = true;
            }
        }
        
        player.wearingCap = inventoryState.cap;
        player.wearingUniform = inventoryState.uniform;
        if (typeof syncPlayer === 'function') syncPlayer();
    }

    document.getElementById('equip-cap-btn').addEventListener('click', () => toggleItem('cap'));
    document.getElementById('equip-uniform-btn').addEventListener('click', () => toggleItem('uniform'));

    let draggedItem = null;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let originalSlot = null;

    document.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('draggable-item')) {
            draggedItem = e.target;
            originalSlot = draggedItem.parentElement;
            
            const rect = draggedItem.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
            
            draggedItem.style.position = 'fixed';
            draggedItem.style.pointerEvents = 'none';
            draggedItem.style.cursor = 'grabbing';
            document.body.appendChild(draggedItem);
            
            draggedItem.style.left = (e.clientX - dragOffsetX) + 'px';
            draggedItem.style.top = (e.clientY - dragOffsetY) + 'px';
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (draggedItem) {
            draggedItem.style.left = (e.clientX - dragOffsetX) + 'px';
            draggedItem.style.top = (e.clientY - dragOffsetY) + 'px';
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (draggedItem) {
            let elemBelow = document.elementFromPoint(e.clientX, e.clientY);
            let targetSlot = elemBelow ? elemBelow.closest('.inv-slot') : null;
            
            if (targetSlot) {
                const existingItem = targetSlot.querySelector('.draggable-item');
                if (existingItem && existingItem !== draggedItem) {
                    originalSlot.appendChild(existingItem);
                }
                Array.from(targetSlot.childNodes).forEach(n => {
                    if (n.nodeType === 3) n.remove();
                });
                targetSlot.appendChild(draggedItem);
            } else {
                originalSlot.appendChild(draggedItem);
            }
            
            draggedItem.style.position = '';
            draggedItem.style.pointerEvents = 'auto';
            draggedItem.style.cursor = 'grab';
            draggedItem.style.left = '';
            draggedItem.style.top = '';
            
            draggedItem = null;
            originalSlot = null;
        }
    });
})();
