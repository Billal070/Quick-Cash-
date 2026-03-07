// ==========================================
// CONFIGURATIONS (Using Firebase Compat Version)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyC8XsyQBman9S2Cpl7tvze7bUtoW_cKUcA",
    authDomain: "quick-cash-07.firebaseapp.com",
    projectId: "quick-cash-07",
    storageBucket: "quick-cash-07.firebasestorage.app",
    messagingSenderId: "972085950022",
    appId: "1:972085950022:web:4731ee1eb622fad8117c47",
    measurementId: "G-XJ7W2H04BM"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ==========================================
// LOGIN & UI LOGIC
// ==========================================
const ADMIN_PASSWORD = "admin"; // <--- TYPE "admin" TO LOGIN!

document.getElementById("btn-login").addEventListener("click", () => {
    const pass = document.getElementById("admin-pass").value;
    if (pass === ADMIN_PASSWORD) {
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("admin-layout").style.display = "flex";
        loadData(); 
    } else {
        document.getElementById("login-error").style.display = "block";
    }
});

document.getElementById("admin-pass").addEventListener("keypress", (e) => {
    if (e.key === 'Enter') document.getElementById("btn-login").click();
});

document.getElementById("btn-logout").addEventListener("click", () => {
    document.getElementById("admin-pass").value = "";
    document.getElementById("login-screen").style.display = "flex";
    document.getElementById("admin-layout").style.display = "none";
});

document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
        if(e.currentTarget.id === "btn-logout") return; 

        document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".admin-sec").forEach(s => s.classList.remove("active"));
        
        e.currentTarget.classList.add("active");
        const targetId = e.currentTarget.getAttribute("data-target");
        document.getElementById(targetId).classList.add("active");
    });
});

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.remove("hidden");
    setTimeout(() => { toast.classList.add("hidden"); }, 3000);
}

// ==========================================
// FETCH & RENDER DATA
// ==========================================
async function loadData() {
    try {
        await loadSettings();
        await loadTasks();

        // 1. Fetch Users
        const usersSnap = await db.collection("users").get();
        let totalUsers = 0;
        let totalBalances = 0;
        let usersHtml = "";

        usersSnap.forEach((doc) => {
            const user = doc.data();
            totalUsers++;
            totalBalances += (user.balance || 0);

            usersHtml += `
                <tr>
                    <td><strong>${user.fullName || user.username}</strong></td>
                    <td>${user.userId}</td>
                    <td style="color: #01B574; font-weight:bold;">${(user.balance || 0).toFixed(2)}</td>
                    <td>${(user.totalIncome || 0).toFixed(2)} BDT</td>
                    <td>${user.totalAds || 0}</td>
                    <td>
                        <button class="btn-action btn-edit" onclick="editUserBalance('${user.userId}', ${user.balance || 0})"><i class="fa-solid fa-pen"></i> Balance</button>
                    </td>
                </tr>
            `;
        });

        document.getElementById("dash-users").textContent = totalUsers;
        document.getElementById("dash-balances").textContent = totalBalances.toFixed(2) + " BDT";
        document.getElementById("users-table-body").innerHTML = usersHtml || "<tr><td colspan='6' style='text-align: center;'>No users found.</td></tr>";

        // 2. Fetch Withdrawals
        const withdrawSnap = await db.collection("withdrawRequests").orderBy("requestTime", "desc").get();
        let pendingCount = 0;
        let withdrawHtml = "";

        withdrawSnap.forEach((docSnap) => {
            const req = docSnap.data();
            const reqId = docSnap.id;
            
            if (req.status === "Pending") pendingCount++;

            let statusClass = "pending";
            if (req.status === "Approved") statusClass = "approved";
            if (req.status === "Rejected") statusClass = "rejected";

            let actionButtons = "";
            if (req.status === "Pending") {
                actionButtons = `
                    <button class="btn-action btn-approve" onclick="handleWithdraw('${reqId}', 'Approved', '${req.userId}', ${req.amount})">Approve</button>
                    <button class="btn-action btn-reject" onclick="handleWithdraw('${reqId}', 'Rejected', '${req.userId}', ${req.amount})">Reject</button>
                `;
            } else {
                actionButtons = `<span style="color: #a3aed1; font-size: 13px;">Completed</span>`;
            }

            withdrawHtml += `
                <tr>
                    <td><strong>${req.username || "User"}</strong><br><span style="font-size:12px;color:#a3aed1">${req.userId}</span></td>
                    <td>${req.method}</td>
                    <td>${req.account}</td>
                    <td style="font-weight:bold;">${(req.amount || 0).toFixed(2)}</td>
                    <td><span class="badge ${statusClass}">${req.status}</span></td>
                    <td class="action-btns">${actionButtons}</td>
                </tr>
            `;
        });

        document.getElementById("dash-pending").textContent = pendingCount;
        document.getElementById("withdrawals-table-body").innerHTML = withdrawHtml || "<tr><td colspan='6' style='text-align: center;'>No requests found.</td></tr>";

    } catch (error) {
        console.error("Error loading data:", error);
    }
}

// ==========================================
// USER CONTROLS
// ==========================================
window.editUserBalance = async function(userId, currentBalance) {
    const newBal = prompt(`Enter new balance for User ${userId}:`, currentBalance);
    if (newBal !== null && newBal.trim() !== "" && !isNaN(newBal)) {
        try {
            await db.collection("users").doc(userId).update({ balance: parseFloat(newBal) });
            showToast("Balance updated successfully!");
            loadData(); // refresh table
        } catch (error) {
            alert("Error updating balance!");
        }
    }
}

window.handleWithdraw = async function(docId, newStatus, userId, amount) {
    if (!confirm(`Are you sure you want to ${newStatus.toUpperCase()} this?`)) return;

    try {
        await db.collection("withdrawRequests").doc(docId).update({ status: newStatus });

        // Refund on reject
        if (newStatus === "Rejected") {
            const userRef = db.collection("users").doc(userId);
            const userSnap = await userRef.get();
            if (userSnap.exists) {
                const currentBalance = userSnap.data().balance || 0;
                await userRef.update({ balance: currentBalance + amount });
            }
        }
        showToast(`Request ${newStatus}!`);
        loadData();
    } catch (error) {
        alert("Failed to update.");
    }
}

// ==========================================
// SETTINGS CONTROLS
// ==========================================
async function loadSettings() {
    const docSnap = await db.collection("settings").doc("appConfig").get();
    if (docSnap.exists) {
        const config = docSnap.data();
        document.getElementById("set-min-withdraw").value = config.minWithdraw || 50;
        document.getElementById("set-ad-reward").value = config.adReward || 0.50;
        document.getElementById("set-daily-limit").value = config.dailyLimit || 50;
        document.getElementById("set-hourly-limit").value = config.hourlyLimit || 17;
        document.getElementById("set-ad-duration").value = config.adDuration || 15;
    }
}

window.saveSettings = async function() {
    const config = {
        minWithdraw: parseFloat(document.getElementById("set-min-withdraw").value),
        adReward: parseFloat(document.getElementById("set-ad-reward").value),
        dailyLimit: parseInt(document.getElementById("set-daily-limit").value),
        hourlyLimit: parseInt(document.getElementById("set-hourly-limit").value),
        adDuration: parseInt(document.getElementById("set-ad-duration").value)
    };

    try {
        await db.collection("settings").doc("appConfig").set(config);
        showToast("App Settings Saved!");
    } catch (error) {
        alert("Error saving settings.");
    }
}

// ==========================================
// TASK CONTROLS
// ==========================================
async function loadTasks() {
    const snap = await db.collection("tasks").get();
    let html = "";
    snap.forEach(doc => {
        const t = doc.data();
        html += `
            <tr>
                <td><strong>${t.title}</strong></td>
                <td><a href="${t.link}" target="_blank" style="color:var(--primary)">Link</a></td>
                <td style="color:#01B574; font-weight:bold;">${t.reward.toFixed(2)}</td>
                <td>
                    <button class="btn-action btn-delete" onclick="deleteTask('${doc.id}')"><i class="fa-solid fa-trash"></i> Delete</button>
                </td>
            </tr>
        `;
    });
    document.getElementById("tasks-table-body").innerHTML = html || "<tr><td colspan='4' style='text-align: center;'>No tasks found. Add one above.</td></tr>";
}

window.addTask = async function() {
    const title = document.getElementById("task-title").value;
    const link = document.getElementById("task-link").value;
    const reward = parseFloat(document.getElementById("task-reward").value);

    if(!title || !link || isNaN(reward)) {
        alert("Please fill all fields correctly.");
        return;
    }

    try {
        await db.collection("tasks").add({
            title: title,
            link: link,
            reward: reward,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast("Task Added!");
        document.getElementById("task-title").value = "";
        document.getElementById("task-link").value = "";
        document.getElementById("task-reward").value = "";
        loadTasks();
    } catch (error) {
        alert("Failed to add task.");
    }
}

window.deleteTask = async function(id) {
    if(confirm("Delete this task?")) {
        await db.collection("tasks").doc(id).delete();
        showToast("Task Deleted");
        loadTasks();
    }
          }
