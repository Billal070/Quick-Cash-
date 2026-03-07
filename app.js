import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// CONFIGURATIONS
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyC8XsyQBman9S2Cpl7tvze7bUtoW_cKUcA",
  authDomain: "quick-cash-07.firebaseapp.com",
  projectId: "quick-cash-07",
  storageBucket: "quick-cash-07.firebasestorage.app",
  messagingSenderId: "972085950022",
  appId: "1:972085950022:web:4731ee1eb622fad8117c47"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Default settings (Overwritten by Admin Panel)
let appConfig = {
    minWithdraw: 50,
    adReward: 0.50,
    dailyLimit: 50,
    hourlyLimit: 17,
    adDuration: 15
};

// ==========================================
// STATE & TELEGRAM INIT
// ==========================================
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

let userData = {
    userId: null,
    username: "TestUser",
    fullName: "Test User",
    photoUrl: null,
    balance: 0,
    totalAds: 0,
    referralCount: 0,
    totalIncome: 0,
    totalTasks: 0,
    completedTasks: [], // Tracks dynamic tasks
    lastAdTime: 0,
    hourlyCount: 0,
    dailyCount: 0,
    lastDailyReset: Date.now(),
    lastHourlyReset: Date.now()
};

let isWatchingAd = false;

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    // Tab Switching Logic
    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", (e) => {
            const target = e.currentTarget.getAttribute("data-target");
            window.switchTab(target);
            document.querySelectorAll(".nav-item").forEach(nav => nav.classList.remove("active"));
            e.currentTarget.classList.add("active");
        });
    });

    // Check Telegram Environment
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        const tgUser = tg.initDataUnsafe.user;
        const firstName = tgUser.first_name || "";
        const lastName = tgUser.last_name || "";
        const computedFullName = `${firstName} ${lastName}`.trim() || tgUser.username || "TG User";

        userData.userId = tgUser.id.toString();
        userData.username = tgUser.username || "User";
        userData.fullName = computedFullName;
        userData.photoUrl = tgUser.photo_url || null;
    } else {
        document.getElementById("tg-warning").classList.remove("hidden");
        userData.userId = "test_browser_user"; 
    }

    await loadAppConfig();
    await syncFirebaseUser();
    await loadDynamicTasks();
    updateUI();
});

// ==========================================
// FIREBASE LOGIC
// ==========================================
async function loadAppConfig() {
    try {
        const snap = await getDoc(doc(db, "settings", "appConfig"));
        if (snap.exists()) {
            appConfig = { ...appConfig, ...snap.data() };
            // Update UI elements dependent on config
            document.getElementById("withdraw-amount").placeholder = `Min ${appConfig.minWithdraw} BDT`;
            document.getElementById("withdraw-amount").min = appConfig.minWithdraw;
        }
    } catch (e) { console.error("Config load error", e); }
}

async function loadDynamicTasks() {
    try {
        const snap = await getDocs(collection(db, "tasks"));
        const container = document.getElementById("task-list-container");
        container.innerHTML = ""; 

        if (snap.empty) {
            container.innerHTML = "<p style='text-align:center; color:#718096;'>No premium tasks right now.</p>";
            return;
        }

        snap.forEach(docSnap => {
            const task = docSnap.data();
            const taskId = docSnap.id;
            const isCompleted = userData.completedTasks && userData.completedTasks.includes(taskId);
            
            const btnHtml = isCompleted 
                ? `<button class="btn-primary btn-sm" style="background:#e2e8f0; color:#2d3748;" disabled>DONE</button>`
                : `<button class="btn-primary btn-sm" id="btn-task-${taskId}" onclick="window.joinTask('${taskId}', '${task.link}', ${task.reward})">JOIN</button>`;

            container.innerHTML += `
                <div class="task-card">
                    <div class="task-icon"><i class="fa-brands fa-telegram"></i></div>
                    <div class="task-details">
                        <h4>${task.title}</h4>
                        <p>+${task.reward.toFixed(2)} BDT</p>
                    </div>
                    <div class="task-actions">
                        ${btnHtml}
                    </div>
                </div>
            `;
        });
    } catch (e) { console.error("Tasks load error", e); }
}

async function syncFirebaseUser() {
    try {
        const userRef = doc(db, "users", userData.userId);
        const docSnap = await getDoc(userRef);
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        const oneHour = 60 * 60 * 1000;

        if (docSnap.exists()) {
            const data = docSnap.data();
            userData = { ...userData, ...data, fullName: userData.fullName, photoUrl: userData.photoUrl };
            if(!userData.completedTasks) userData.completedTasks = []; // Ensure array exists

            let needsUpdate = false;
            if (now - userData.lastDailyReset > oneDay) {
                userData.dailyCount = 0;
                userData.lastDailyReset = now;
                needsUpdate = true;
            }
            if (now - userData.lastHourlyReset > oneHour) {
                userData.hourlyCount = 0;
                userData.lastHourlyReset = now;
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                await updateDoc(userRef, { dailyCount: 0, hourlyCount: 0, lastDailyReset: now, lastHourlyReset: now, fullName: userData.fullName, photoUrl: userData.photoUrl });
            } else {
                await updateDoc(userRef, { fullName: userData.fullName, photoUrl: userData.photoUrl });
            }
        } else {
            await setDoc(userRef, userData);
        }
    } catch (error) { console.error("Firebase Sync Error:", error); }
}

async function updateFirebaseState() {
    try {
        const userRef = doc(db, "users", userData.userId);
        await updateDoc(userRef, {
            balance: userData.balance,
            totalAds: userData.totalAds,
            totalIncome: userData.totalIncome,
            totalTasks: userData.totalTasks,
            completedTasks: userData.completedTasks,
            hourlyCount: userData.hourlyCount,
            dailyCount: userData.dailyCount,
            lastAdTime: userData.lastAdTime
        });
    } catch (error) { console.error("Update Error:", error); }
}

// ==========================================
// UI & ANIMATION LOGIC
// ==========================================
window.switchTab = function(tabId) {
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
    document.getElementById(tabId).classList.add("active");
};

function updateUI() {
    document.getElementById("home-username").textContent = userData.fullName || userData.username;
    const homeAvatar = document.getElementById("home-avatar");
    homeAvatar.innerHTML = userData.photoUrl ? `<img src="${userData.photoUrl}" alt="Profile">` : `<i class="fa-solid fa-user"></i>`;

    animateValue("main-balance", parseFloat(document.getElementById("main-balance").textContent), userData.balance, 500);
    animateValue("stat-balance", parseFloat(document.getElementById("stat-balance").textContent), userData.balance, 500);
    animateValue("stat-referral", parseInt(document.getElementById("stat-referral").textContent), userData.referralCount, 500);
    animateValue("stat-tasks", parseInt(document.getElementById("stat-tasks").textContent), userData.totalTasks, 500);
    animateValue("stat-income", parseFloat(document.getElementById("stat-income").textContent), userData.totalIncome, 500);
    
    // Update Limits UI
    document.querySelector("#tab-ads .stats-grid .stat-card:nth-child(1) h4").textContent = appConfig.dailyLimit;
    document.querySelector("#tab-ads .stats-grid .stat-card:nth-child(3) h4").textContent = appConfig.adDuration + " Sec";
    
    document.getElementById("ads-completed").textContent = userData.dailyCount;
    document.getElementById("ads-hourly").textContent = userData.hourlyCount;
    document.getElementById("ads-hourly").nextSibling.textContent = "/" + appConfig.hourlyLimit;

    document.getElementById("withdraw-balance").textContent = userData.balance.toFixed(2);
    document.getElementById("acc-username").textContent = userData.fullName || userData.username;
    
    const accAvatar = document.getElementById("acc-avatar");
    accAvatar.innerHTML = userData.photoUrl ? `<img src="${userData.photoUrl}" alt="Profile">` : `<i class="fa-solid fa-user"></i>`;

    document.getElementById("acc-id").textContent = userData.userId;
    document.getElementById("acc-total-earning").textContent = userData.totalIncome.toFixed(2) + " BDT";
    document.getElementById("ref-link").value = `https://t.me/EarningBot?start=${userData.userId}`;
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    let startTimestamp = null;
    const isFloat = end % 1 !== 0 || start % 1 !== 0;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = progress * (end - start) + start;
        obj.innerHTML = isFloat ? current.toFixed(2) : Math.floor(current);
        if (progress < 1) window.requestAnimationFrame(step);
        else obj.innerHTML = isFloat ? end.toFixed(2) : end;
    };
    window.requestAnimationFrame(step);
}

window.showModal = function(title, message, isSuccess = true) {
    const modal = document.getElementById("notification-modal");
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-message").textContent = message;
    const icon = document.getElementById("modal-icon");
    if (isSuccess) { icon.innerHTML = '<i class="fa-solid fa-circle-check"></i>'; icon.style.color = 'var(--primary)'; } 
    else { icon.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>'; icon.style.color = '#ff4d4f'; }
    modal.classList.remove("hidden");
};
window.closeModal = function() { document.getElementById("notification-modal").classList.add("hidden"); };

// ==========================================
// ADS LOGIC (Dynamic Config)
// ==========================================
document.getElementById("btn-watch-ad").addEventListener("click", async () => {
    if (isWatchingAd) return;

    if (userData.dailyCount >= appConfig.dailyLimit) {
        showModal("Daily Limit Reached", "You have completed your ads for today.", false);
        return;
    }
    if (userData.hourlyCount >= appConfig.hourlyLimit) {
        showModal("Hourly Limit Reached", "You have hit the hourly limit. Please wait.", false);
        return;
    }

    isWatchingAd = true;
    const btn = document.getElementById("btn-watch-ad");
    const progressContainer = document.getElementById("ad-progress-container");
    const progressBar = document.getElementById("ad-progress-bar");
    const progressText = document.getElementById("ad-progress-text");

    btn.classList.remove("pulse");
    btn.classList.add("hidden");
    progressContainer.classList.remove("hidden");

    if (typeof show_10689761 === "function") show_10689761(); 

    let timeLeft = appConfig.adDuration;
    let progress = 0;
    const intervalTime = 100;
    const step = 100 / (appConfig.adDuration * 10);

    const timer = setInterval(async () => {
        progress += step;
        progressBar.style.width = `${progress}%`;
        
        if (progress % (step * 10) < step) {
            timeLeft--;
            progressText.textContent = `Watching Ad: ${timeLeft}s`;
        }

        if (progress >= 100) {
            clearInterval(timer);
            
            userData.balance += appConfig.adReward;
            userData.totalIncome += appConfig.adReward;
            userData.totalAds += 1;
            userData.dailyCount += 1;
            userData.hourlyCount += 1;
            userData.lastAdTime = Date.now();
            
            await updateFirebaseState();
            updateUI();

            isWatchingAd = false;
            progressContainer.classList.add("hidden");
            btn.classList.remove("hidden");
            btn.classList.add("pulse");
            progressBar.style.width = "0%";
            progressText.textContent = `Watching Ad: ${appConfig.adDuration}s`;
            
            if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
            showModal("Reward Added!", `You earned ${appConfig.adReward} BDT.`);
        }
    }, intervalTime);
});

// ==========================================
// DYNAMIC TASK LOGIC
// ==========================================
window.joinTask = function(taskId, link, reward) {
    const btn = document.getElementById(`btn-task-${taskId}`);

    if (btn.textContent === "JOIN") {
        if(tg.openLink) { tg.openLink(link); } else { window.open(link, '_blank'); }
        btn.textContent = "VERIFY";
        btn.style.background = "#e2e8f0";
        btn.style.color = "#2d3748";
    } else if (btn.textContent === "VERIFY") {
        btn.textContent = "Verifying...";
        
        setTimeout(async () => {
            userData.balance += reward;
            userData.totalIncome += reward;
            userData.totalTasks += 1;
            userData.completedTasks.push(taskId);
            
            await updateFirebaseState();
            updateUI();
            
            btn.textContent = "DONE";
            btn.style.background = "var(--primary-grad)";
            btn.style.color = "white";
            btn.disabled = true;

            if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
            showModal("Task Verified!", `You earned ${reward} BDT.`);
        }, 3000);
    }
};

// ==========================================
// WITHDRAW LOGIC
// ==========================================
document.getElementById("withdraw-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const method = document.getElementById("withdraw-method").value;
    const account = document.getElementById("withdraw-account").value;
    const amount = parseFloat(document.getElementById("withdraw-amount").value);

    if (amount < appConfig.minWithdraw) {
        showModal("Invalid Amount", `Minimum withdrawal is ${appConfig.minWithdraw} BDT.`, false);
        return;
    }
    if (amount > userData.balance) {
        showModal("Insufficient Balance", "You do not have enough balance.", false);
        return;
    }

    try {
        const btn = e.target.querySelector('button');
        btn.textContent = "Processing...";
        btn.disabled = true;

        await addDoc(collection(db, "withdrawRequests"), {
            userId: userData.userId,
            username: userData.username,
            method: method,
            account: account,
            amount: amount,
            status: "Pending",
            requestTime: serverTimestamp()
        });

        userData.balance -= amount;
        await updateFirebaseState();
        updateUI();

        e.target.reset();
        showModal("Request Submitted", `Your withdrawal of ${amount} BDT is pending.`);
        
        btn.textContent = "Submit Request";
        btn.disabled = false;
    } catch (error) {
        showModal("Error", "Failed to submit request.", false);
        e.target.querySelector('button').textContent = "Submit Request";
        e.target.querySelector('button').disabled = false;
    }
});

// ==========================================
// ACCOUNT LOGIC
// ==========================================
window.copyRef = function() {
    const copyText = document.getElementById("ref-link");
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value);
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
    showModal("Copied!", "Referral link copied to clipboard.");
};