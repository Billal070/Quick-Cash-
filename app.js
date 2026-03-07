import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, collection, addDoc, serverTimestamp, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC8XsyQBman9S2Cpl7tvze7bUtoW_cKUcA", authDomain: "quick-cash-07.firebaseapp.com", projectId: "quick-cash-07",
  storageBucket: "quick-cash-07.firebasestorage.app", messagingSenderId: "972085950022", appId: "1:972085950022:web:4731ee1eb622fad8117c47"
};
const app = initializeApp(firebaseConfig); const db = getFirestore(app);
const tg = window.Telegram.WebApp; tg.expand(); tg.ready();

let appConfig = { announcement: "Welcome to Quick Cash!", minWithdraw: 50, adReward: 0.50, refReward: 2.00, dailyLimit: 50, hourlyLimit: 17, adDuration: 15 };
let userData = { userId: "test_user", username: "User", fullName: "User", photoUrl: null, balance: 0, totalAds: 0, referralCount: 0, totalIncome: 0, totalTasks: 0, completedTasks: [], hourlyCount: 0, dailyCount: 0, lastDailyReset: Date.now(), lastHourlyReset: Date.now() };
let isWatchingAd = false;

document.addEventListener("DOMContentLoaded", async () => {
    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", (e) => {
            window.switchTab(e.currentTarget.getAttribute("data-target"));
            document.querySelectorAll(".nav-item").forEach(nav => nav.classList.remove("active"));
            e.currentTarget.classList.add("active");
        });
    });

    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        const tU = tg.initDataUnsafe.user;
        userData.userId = tU.id.toString(); userData.username = tU.username || "User";
        userData.fullName = `${tU.first_name||""} ${tU.last_name||""}`.trim() || tU.username;
        userData.photoUrl = tU.photo_url || null;
    }

    await loadAppConfig();
    await syncFirebaseUser();
    await loadDynamicTasks();
    updateUI();
});

async function loadAppConfig() {
    try {
        const snap = await getDoc(doc(db, "settings", "appConfig"));
        if (snap.exists()) appConfig = { ...appConfig, ...snap.data() };
        document.getElementById("app-announcement").textContent = appConfig.announcement;
        document.getElementById("withdraw-amount").placeholder = `Min ${appConfig.minWithdraw} BDT`;
        document.getElementById("ref-reward-text").textContent = appConfig.refReward.toFixed(2);
    } catch (e) {}
}

async function syncFirebaseUser() {
    const userRef = doc(db, "users", userData.userId);
    const docSnap = await getDoc(userRef);
    const startParam = tg.initDataUnsafe?.start_param; // REAL REFERRAL CHECK

    if (docSnap.exists()) {
        userData = { ...userData, ...docSnap.data(), fullName: userData.fullName, photoUrl: userData.photoUrl };
        const now = Date.now();
        let needsUpdate = false;
        if (now - userData.lastDailyReset > 86400000) { userData.dailyCount = 0; userData.lastDailyReset = now; needsUpdate = true; }
        if (now - userData.lastHourlyReset > 3600000) { userData.hourlyCount = 0; userData.lastHourlyReset = now; needsUpdate = true; }
        await updateDoc(userRef, needsUpdate ? { dailyCount: 0, hourlyCount: 0, lastDailyReset: now, lastHourlyReset: now, fullName: userData.fullName, photoUrl: userData.photoUrl } : { fullName: userData.fullName, photoUrl: userData.photoUrl });
    } else {
        // NEW USER JOINED! Give Referral Reward to Inviter!
        if (startParam && startParam !== userData.userId) {
            const refRef = doc(db, "users", startParam);
            const refSnap = await getDoc(refRef);
            if (refSnap.exists()) {
                const rData = refSnap.data();
                await updateDoc(refRef, { balance: (rData.balance||0) + appConfig.refReward, referralCount: (rData.referralCount||0) + 1, totalIncome: (rData.totalIncome||0) + appConfig.refReward });
                userData.referredBy = startParam;
            }
        }
        await setDoc(userRef, userData);
    }
}

async function updateFirebaseState() {
    await updateDoc(doc(db, "users", userData.userId), { balance: userData.balance, totalAds: userData.totalAds, totalIncome: userData.totalIncome, totalTasks: userData.totalTasks, completedTasks: userData.completedTasks, hourlyCount: userData.hourlyCount, dailyCount: userData.dailyCount });
}

window.switchTab = function(tabId) {
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
    document.getElementById(tabId).classList.add("active");
    if(tabId === 'tab-leaderboard') loadLeaderboard('earn');
    if(tabId === 'tab-withdraw') loadWithdrawHistory();
};

function updateUI() {
    document.getElementById("home-username").textContent = userData.fullName;
    document.getElementById("home-avatar").innerHTML = userData.photoUrl ? `<img src="${userData.photoUrl}">` : `<i class="fa-solid fa-user"></i>`;
    document.getElementById("main-balance").textContent = userData.balance.toFixed(2);
    document.getElementById("stat-balance").textContent = userData.balance.toFixed(2);
    document.getElementById("stat-referral").textContent = userData.referralCount;
    document.getElementById("stat-tasks").textContent = userData.totalTasks;
    document.getElementById("stat-income").textContent = userData.totalIncome.toFixed(2);
    document.getElementById("ads-limit-text").textContent = appConfig.dailyLimit;
    document.getElementById("ads-completed").textContent = userData.dailyCount;
    document.getElementById("withdraw-balance").textContent = userData.balance.toFixed(2);
    document.getElementById("acc-username").textContent = userData.fullName;
    document.getElementById("acc-avatar").innerHTML = userData.photoUrl ? `<img src="${userData.photoUrl}">` : `<i class="fa-solid fa-user"></i>`;
    document.getElementById("acc-id").textContent = userData.userId;
    document.getElementById("ref-link").value = `https://t.me/EarningBot?start=${userData.userId}`;
}

window.showModal = function(t, m, s=true) {
    document.getElementById("modal-title").textContent = t; document.getElementById("modal-message").textContent = m;
    const i = document.getElementById("modal-icon"); i.innerHTML = s ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-xmark"></i>';
    i.style.color = s ? 'var(--primary)' : '#ff4d4f'; document.getElementById("notification-modal").classList.remove("hidden");
};
window.closeModal = () => document.getElementById("notification-modal").classList.add("hidden");

// Ads
document.getElementById("btn-watch-ad").addEventListener("click", async () => {
    if (isWatchingAd) return;
    if (userData.dailyCount >= appConfig.dailyLimit) return showModal("Limit Reached", "Daily ad limit reached.", false);
    if (userData.hourlyCount >= appConfig.hourlyLimit) return showModal("Limit Reached", "Hourly ad limit reached.", false);
    
    isWatchingAd = true;
    document.getElementById("btn-watch-ad").classList.add("hidden");
    document.getElementById("ad-progress-container").classList.remove("hidden");
    if (typeof show_10689761 === "function") show_10689761();

    let timeLeft = appConfig.adDuration, progress = 0;
    const timer = setInterval(async () => {
        progress += (100 / (appConfig.adDuration * 10));
        document.getElementById("ad-progress-bar").style.width = `${progress}%`;
        if (progress % (100/appConfig.adDuration) < (100/(appConfig.adDuration*10))) document.getElementById("ad-progress-text").textContent = `Watching: ${--timeLeft}s`;
        if (progress >= 100) {
            clearInterval(timer);
            userData.balance += appConfig.adReward; userData.totalIncome += appConfig.adReward; userData.totalAds++; userData.dailyCount++; userData.hourlyCount++;
            await updateFirebaseState(); updateUI();
            isWatchingAd = false;
            document.getElementById("ad-progress-container").classList.add("hidden"); document.getElementById("btn-watch-ad").classList.remove("hidden");
            if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
            showModal("Rewarded!", `+${appConfig.adReward} BDT added.`);
        }
    }, 100);
});

// Tasks
async function loadDynamicTasks() {
    const snap = await getDocs(collection(db, "tasks"));
    const c = document.getElementById("task-list-container"); c.innerHTML = ""; 
    snap.forEach(d => {
        const t = d.data(), id = d.id, isD = userData.completedTasks.includes(id);
        const btn = isD ? `<button class="btn-primary btn-sm" style="background:#e2e8f0; color:#2d3748;" disabled>DONE</button>` : `<button class="btn-primary btn-sm" id="btn-task-${id}" onclick="joinTask('${id}', '${t.link}', ${t.reward})">JOIN</button>`;
        c.innerHTML += `<div class="task-card"><div class="task-icon"><i class="fa-brands fa-telegram"></i></div><div class="task-details"><h4>${t.title}</h4><p class="bold-money">+${t.reward.toFixed(2)} BDT</p></div><div>${btn}</div></div>`;
    });
}
window.joinTask = (id, link, reward) => {
    const b = document.getElementById(`btn-task-${id}`);
    if (b.textContent === "JOIN") { tg.openLink ? tg.openLink(link) : window.open(link); b.textContent = "VERIFY"; b.style.background = "#e2e8f0"; b.style.color = "#2d3748"; }
    else if (b.textContent === "VERIFY") {
        b.textContent = "Wait...";
        setTimeout(async () => {
            userData.balance += reward; userData.totalIncome += reward; userData.totalTasks++; userData.completedTasks.push(id);
            await updateFirebaseState(); updateUI();
            b.textContent = "DONE"; b.style.background = "var(--primary-grad)"; b.style.color = "white"; b.disabled = true;
            showModal("Task Verified!", `+${reward} BDT.`);
        }, 3000);
    }
};

// Withdraw & History
document.getElementById("withdraw-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const amt = parseFloat(document.getElementById("withdraw-amount").value);
    if (amt < appConfig.minWithdraw) return showModal("Error", `Min ${appConfig.minWithdraw} BDT.`, false);
    if (amt > userData.balance) return showModal("Error", "Not enough balance.", false);
    
    const b = e.target.querySelector('button'); b.textContent = "Wait..."; b.disabled = true;
    await addDoc(collection(db, "withdrawRequests"), { userId: userData.userId, username: userData.username, method: document.getElementById("withdraw-method").value, account: document.getElementById("withdraw-account").value, amount: amt, status: "Pending", requestTime: serverTimestamp() });
    userData.balance -= amt; await updateFirebaseState(); updateUI(); e.target.reset();
    showModal("Success", `Request pending.`); b.textContent = "Submit"; b.disabled = false; loadWithdrawHistory();
});

async function loadWithdrawHistory() {
    const snap = await getDocs(query(collection(db, "withdrawRequests"), where("userId", "==", userData.userId)));
    let arr = []; snap.forEach(d => arr.push(d.data()));
    arr.sort((a,b) => b.requestTime - a.requestTime);
    let h = "";
    arr.forEach(r => { h += `<div class="history-item"><div>${r.method} (${r.amount} BDT)</div><div class="history-status ${r.status.toLowerCase()}">${r.status}</div></div>`; });
    document.getElementById("history-container").innerHTML = h || `<p style="text-align:center; font-size:13px; color:#718096;">No history yet.</p>`;
}

// Leaderboard
window.loadLeaderboard = async (type) => {
    document.querySelectorAll(".lb-toggle").forEach(b => b.classList.remove("active"));
    document.getElementById(type === 'earn' ? 'btn-lb-earn' : 'btn-lb-ref').classList.add("active");
    const c = document.getElementById("leaderboard-container"); c.innerHTML = "<p style='text-align:center; padding: 20px;'>Loading...</p>";
    
    const field = type === 'earn' ? "totalIncome" : "referralCount";
    const snap = await getDocs(query(collection(db, "users"), orderBy(field, "desc"), limit(10)));
    let h = "", rank = 1;
    snap.forEach(d => {
        const u = d.data();
        const score = type === 'earn' ? `${(u.totalIncome||0).toFixed(2)} BDT` : `${u.referralCount||0} Refers`;
        const ava = u.photoUrl ? `<img src="${u.photoUrl}">` : `<i class="fa-solid fa-user"></i>`;
        h += `<div class="lb-item"><div class="lb-rank">#${rank}</div><div class="avatar" style="width:35px;height:35px;font-size:15px;">${ava}</div><div class="lb-info"><h4>${u.fullName}</h4></div><div class="lb-score">${score}</div></div>`;
        rank++;
    });
    c.innerHTML = h || "<p style='text-align:center; padding: 20px;'>No data yet.</p>";
}

window.copyRef = () => {
    const c = document.getElementById("ref-link"); c.select(); document.execCommand("copy");
    if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred("light"); showModal("Copied!", "Link copied.");
};
