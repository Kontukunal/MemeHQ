import { auth, db } from "./firebase.js";
import { doc, getDoc, collection, query, where, orderBy, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showToast, formatDate } from "./utils.js";
import { handleLogout } from "./scripts/auth.js";
import { getUserBadges, getAllBadges, getBadgeProgress } from "./badges.js";
import { initAnalyticsPage } from "./analytics.js";

// Global variables for analytics
let engagementChart = null;
let historicalChart = null;
let currentPeriod = "24h";

// Update user profile UI
async function updateUserProfile() {
  if (!auth.currentUser) return;

  const userNameElement = document.getElementById("userName");
  const userAvatarElement = document.getElementById("userAvatar");
  const logoutBtn = document.getElementById("logoutBtn");

  try {
    // Get user data from Firestore
    const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
    const userData = userDoc.data() || {};

    // Update username
    const displayName = userData.displayName || auth.currentUser.displayName || "User";
    if (userNameElement) {
      userNameElement.textContent = displayName;
    }

    // Update avatar
    const avatarUrl = userData.photoURL || auth.currentUser.photoURL || 
      `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
    if (userAvatarElement) {
      userAvatarElement.src = avatarUrl;
      userAvatarElement.alt = displayName;
    }

    // Setup logout button
    if (logoutBtn) {
      logoutBtn.addEventListener("click", handleLogout);
    }
  } catch (error) {
    console.error("Error updating user profile:", error);
    showToast("Failed to load user data", "error");
  }
}

// Initialize analytics page with user data
export async function initAnalyticsPageWithUser() {
  try {
    // Check authentication
    if (!auth.currentUser) {
      showToast("Please login to view analytics", "error");
      window.location.href = "index.html";
      return;
    }

    // Update user profile
    await updateUserProfile();

    // Get meme ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const memeId = urlParams.get("id");

    if (!memeId) {
      showToast("No meme specified", "error");
      window.location.href = "index.html";
      return;
    }

    // Show loading state
    document.querySelector(".analytics-container").innerHTML = '<div class="empty-state">Loading analytics...</div>';

    // Load meme data and verify ownership
    const memeRef = doc(db, "memes", memeId);
    const memeSnap = await getDoc(memeRef);

    if (!memeSnap.exists()) {
      showToast("Meme not found", "error");
      window.location.href = "index.html";
      return;
    }

    const memeData = {
      id: memeSnap.id,
      ...memeSnap.data(),
      createdAt: memeSnap.data().createdAt?.toDate()
    };

    if (memeData.userId !== auth.currentUser.uid) {
      showToast("You can only view analytics for your own memes", "error");
      window.location.href = "index.html";
      return;
    }

    // Clear loading state
    document.querySelector(".analytics-container").innerHTML = document.querySelector(".analytics-container").innerHTML;

    // Update meme overview
    document.getElementById("memeImage").src = memeData.imageUrl;
    document.getElementById("memeTitle").textContent = memeData.title || "Untitled Meme";

    // Format numbers
    const formatNumber = (num) => {
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
      return num.toString();
    };

    // Update stats
    document.getElementById("totalViews").textContent = formatNumber(memeData.views || 0);
    document.getElementById("totalLikes").textContent = formatNumber(memeData.likes || 0);
    document.getElementById("totalComments").textContent = formatNumber(memeData.commentCount || 0);

    // Calculate and update engagement rate
    const engagementRate = memeData.views > 0 ? ((memeData.likes / memeData.views) * 1000).toFixed(1) : "0";
    document.getElementById("engagementRate").textContent = engagementRate;

    // Update performance rating
    updatePerformanceRating(memeData);

    // Load and render charts
    await renderCharts(memeId, memeData);

    // Load and render recent activity
    await renderRecentActivity(memeId);

    // Set up event listeners
    setupEventListeners(memeId);

  } catch (error) {
    console.error("Error initializing analytics:", error);
    showToast("Failed to load analytics", "error");
    document.querySelector(".analytics-container").innerHTML = `
      <div class="empty-state">
        <h3>Error Loading Analytics</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

// Update performance rating
function updatePerformanceRating(memeData) {
  const hoursSinceCreation = Math.max(1, (new Date() - memeData.createdAt) / (1000 * 60 * 60));
  const likesPerHour = (memeData.likes || 0) / hoursSinceCreation;
  const engagementRate = memeData.views > 0 ? (memeData.likes / memeData.views) * 100 : 0;

  let rating, className, description;

  if (likesPerHour > 10 || engagementRate > 15) {
    rating = "Viral";
    className = "viral";
    description = "🔥 Your meme is on fire! It's getting exceptional engagement.";
  } else if (likesPerHour > 5 || engagementRate > 8) {
    rating = "Great";
    className = "great";
    description = "👍 Performing better than 80% of memes. Keep it up!";
  } else if (likesPerHour > 2 || engagementRate > 3) {
    rating = "Good";
    className = "good";
    description = "💪 Solid performance. Try optimizing posting time.";
  } else if (likesPerHour > 0.5 || engagementRate > 1) {
    rating = "Average";
    className = "average";
    description = "🤔 Getting some traction. Consider improving your tags.";
  } else {
    rating = "Low";
    className = "low";
    description = "📉 Needs improvement. Try different content or audience.";
  }

  const performanceRating = document.getElementById("performanceRating");
  const performanceDescription = document.getElementById("performanceDescription");

  performanceRating.textContent = rating;
  performanceRating.className = `rating ${className}`;
  performanceDescription.innerHTML = `
    ${description}<br><br>
    <small>
      Stats: ${Math.round(likesPerHour * 10) / 10} likes/hour • 
      ${engagementRate.toFixed(1)}% engagement
    </small>
  `;
}

// Render charts
async function renderCharts(memeId, memeData) {
  // Render engagement doughnut chart
  const engagementCtx = document.getElementById("engagementChart").getContext("2d");
  if (engagementChart) engagementChart.destroy();

  engagementChart = new Chart(engagementCtx, {
    type: "doughnut",
    data: {
      labels: ["Likes", "Comments", "Views"],
      datasets: [{
        data: [
          memeData.likes || 0,
          memeData.commentCount || 0,
          memeData.views || 0
        ],
        backgroundColor: ["#4CAF50", "#2196F3", "#FF9800"],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${context.raw.toLocaleString()}`
          }
        }
      },
      cutout: "70%"
    }
  });

  // Get historical data
  const historicalData = await getHistoricalData(memeId, currentPeriod);

  // Render historical line chart
  const historicalCtx = document.getElementById("historicalChart").getContext("2d");
  if (historicalChart) historicalChart.destroy();

  if (historicalData.length < 2) {
    document.getElementById("historicalChart").closest(".chart-container").style.display = "none";
    return;
  }

  historicalChart = new Chart(historicalCtx, {
    type: "line",
    data: {
      labels: historicalData.map(data => formatDate(data.date, true)),
      datasets: [
        {
          label: "Likes",
          data: historicalData.map(data => data.likes),
          borderColor: "#4CAF50",
          backgroundColor: "rgba(76, 175, 80, 0.1)",
          tension: 0.3,
          fill: true
        },
        {
          label: "Views",
          data: historicalData.map(data => data.views),
          borderColor: "#FF9800",
          backgroundColor: "rgba(255, 152, 0, 0.1)",
          tension: 0.3,
          fill: true
        },
        {
          label: "Comments",
          data: historicalData.map(data => data.comments),
          borderColor: "#2196F3",
          backgroundColor: "rgba(33, 150, 243, 0.1)",
          tension: 0.3,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: "index",
          intersect: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => value >= 1000 ? `${value / 1000}k` : value
          }
        }
      }
    }
  });
}

// Get historical data
async function getHistoricalData(memeId, period) {
  try {
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case "24h":
        startDate.setHours(now.getHours() - 24);
        break;
      case "7d":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        break;
      case "all":
        startDate = new Date(0);
        break;
    }

    const historyRef = collection(db, `memes/${memeId}/history`);
    const q = query(historyRef, where("date", ">=", startDate), orderBy("date", "asc"));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      const memeRef = doc(db, "memes", memeId);
      const memeSnap = await getDoc(memeRef);
      if (memeSnap.exists()) {
        return [{
          date: memeSnap.data().createdAt?.toDate() || new Date(),
          likes: memeSnap.data().likes || 0,
          views: memeSnap.data().views || 0,
          comments: memeSnap.data().commentCount || 0
        }];
      }
      return [];
    }

    return querySnapshot.docs.map(doc => ({
      date: doc.data().date?.toDate(),
      likes: doc.data().likes || 0,
      views: doc.data().views || 0,
      comments: doc.data().comments || 0
    }));
  } catch (error) {
    console.error("Error getting historical data:", error);
    return [];
  }
}

// Render recent activity
async function renderRecentActivity(memeId) {
  try {
    const recentActivity = document.getElementById("recentActivity");
    
    // Get recent comments
    const commentsRef = collection(db, `memes/${memeId}/comments`);
    const commentsQuery = query(commentsRef, orderBy("createdAt", "desc"), limit(5));
    const commentsSnapshot = await getDocs(commentsQuery);
    
    const comments = commentsSnapshot.docs.map(doc => ({
      type: "comment",
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate()
    }));

    // Get recent likes
    const memeRef = doc(db, "memes", memeId);
    const memeSnap = await getDoc(memeRef);
    const likes = memeSnap.data()?.likedBy?.slice(0, 5).map(userId => ({
      type: "like",
      userId,
      createdAt: new Date()
    })) || [];

    // Combine and sort activities
    const activities = [...comments, ...likes].sort((a, b) => b.createdAt - a.createdAt);

    if (activities.length === 0) {
      recentActivity.innerHTML = '<div class="empty-state">No recent activity yet</div>';
      return;
    }

    recentActivity.innerHTML = activities.map(activity => {
      if (activity.type === "comment") {
        return `
          <div class="activity-item">
            <i class="fas fa-comment"></i>
            <div class="activity-content">
              <strong>${activity.author}</strong> commented: "${activity.text}"
              <small>${formatDate(activity.createdAt)}</small>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="activity-item">
            <i class="fas fa-heart"></i>
            <div class="activity-content">
              <strong>User ${activity.userId.slice(0, 6)}</strong> liked your meme
              <small>${formatDate(activity.createdAt)}</small>
            </div>
          </div>
        `;
      }
    }).join("");
  } catch (error) {
    console.error("Error rendering recent activity:", error);
    document.getElementById("recentActivity").innerHTML = '<div class="empty-state">Failed to load recent activity</div>';
  }
}

// Set up event listeners
function setupEventListeners(memeId) {
  // Time filter buttons
  const timeFilterBtns = document.querySelectorAll(".time-filter button");
  timeFilterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      timeFilterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentPeriod = btn.dataset.period;
      renderCharts(memeId, currentPeriod);
    });
  });

  // Logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }
}

// Initialize badges page
export async function initBadgesPage() {
  try {
    // Check authentication
    if (!auth.currentUser) {
      showToast("Please login to view badges", "error");
      window.location.href = "index.html";
      return;
    }

    // Update user profile
    await updateUserProfile();

    const badgesContainer = document.querySelector(".badges-grid");
    if (!badgesContainer) return;

    // Show loading state
    badgesContainer.innerHTML = '<div class="empty-state">Loading badges...</div>';

    // Get user's badges and all available badges
    const [userBadges, allBadges, badgeProgress] = await Promise.all([
      getUserBadges(auth.currentUser.uid),
      getAllBadges(),
      getBadgeProgress(auth.currentUser.uid)
    ]);

    // Clear loading state
    badgesContainer.innerHTML = '';

    // Update stats
    document.querySelector("#total-badges").textContent = userBadges.length;
    document.querySelector("#available-badges").textContent = Object.keys(allBadges).length;
    document.querySelector("#completion-rate").textContent = 
      Math.round((userBadges.length / Object.keys(allBadges).length) * 100) + "%";

    // Render each badge
    Object.values(allBadges).forEach(badge => {
      const progress = badgeProgress[badge.id] || 0;
      const isUnlocked = userBadges.includes(badge.id);
      
      const badgeCard = document.createElement("div");
      badgeCard.className = `badge-card ${isUnlocked ? "" : "locked"}`;
      
      badgeCard.innerHTML = `
        <div class="badge-icon ${badge.rarity}">
          <i class="${badge.icon}"></i>
        </div>
        <h3 class="badge-name">${badge.name}</h3>
        <p class="badge-description">${badge.description}</p>
        <div class="badge-progress">
          <div class="progress-bar" style="width: ${progress}%"></div>
        </div>
      `;
      
      badgesContainer.appendChild(badgeCard);
    });

  } catch (error) {
    console.error("Error initializing badges page:", error);
    showToast("Failed to load badges", "error");
    document.querySelector(".badges-grid").innerHTML = `
      <div class="empty-state">
        <h3>Error Loading Badges</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

// Initialize page based on current path
export function initCurrentPage() {
  const path = window.location.pathname;
  
  if (path.includes("analytics.html")) {
    initAnalyticsPageWithUser();
  } else if (path.includes("badges.html")) {
    initBadgesPage();
  }
  // Add other page initializations as needed
} 