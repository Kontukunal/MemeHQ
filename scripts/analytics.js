import { db, auth } from "./firebase.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showToast, formatDate } from "./utils.js";

// Load Chart.js from CDN
const Chart = await import("https://cdn.jsdelivr.net/npm/chart.js@4.4.0/+esm");

// Initialize the analytics page
export async function initAnalyticsPage() {
  try {
    // Check authentication
    if (!auth.currentUser) {
      showToast("Please login to view analytics", "error");
      window.location.href = "index.html";
      return;
    }

    // Get meme ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const memeId = urlParams.get("id");

    if (!memeId) {
      showToast("No meme specified", "error");
      window.location.href = "index.html";
      return;
    }

    // Load meme data and verify ownership
    const [memeData, historicalData] = await Promise.all([
      getMemeWithVerification(memeId),
      getHistoricalEngagement(memeId),
    ]);

    if (!memeData) return;

    // Render all data
    renderBasicStats(memeData);
    renderEngagementChart(memeData);
    renderHistoricalChart(historicalData);
    setupEventListeners();

    // Record analytics view
    await recordAnalyticsView(memeId);
  } catch (error) {
    console.error("Error initializing analytics:", error);
    showToast("Failed to load analytics", "error");
  }
}

// Get meme data with ownership verification
async function getMemeWithVerification(memeId) {
  const memeRef = doc(db, "memes", memeId);
  const memeSnap = await getDoc(memeRef);

  if (!memeSnap.exists()) {
    showToast("Meme not found", "error");
    window.location.href = "index.html";
    return null;
  }

  const memeData = memeSnap.data();

  // Verify the current user owns this meme
  if (memeData.userId !== auth.currentUser.uid) {
    showToast("You can only view analytics for your own memes", "error");
    window.location.href = "index.html";
    return null;
  }

  // Calculate additional metrics
  const now = new Date();
  const createdAt = memeData.createdAt.toDate();
  const hoursSinceCreation = Math.floor((now - createdAt) / (1000 * 60 * 60));

  // Engagement rate (likes per 1000 views)
  const engagementRate =
    memeData.views > 0
      ? ((memeData.likes / memeData.views) * 1000).toFixed(1)
      : 0;

  return {
    id: memeSnap.id,
    ...memeData,
    createdAt,
    hoursSinceCreation,
    engagementRate,
    commentsPerHour: memeData.commentCount / Math.max(1, hoursSinceCreation),
    likesPerHour: memeData.likes / Math.max(1, hoursSinceCreation),
  };
}

// Get historical engagement data from Firestore
async function getHistoricalEngagement(memeId) {
  try {
    // First try to get from history subcollection
    const historyRef = collection(db, `memes/${memeId}/history`);
    const q = query(historyRef, orderBy("timestamp", "asc"));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      return querySnapshot.docs.map((doc) => ({
        timestamp: doc.data().timestamp.toDate(),
        likes: doc.data().likes || 0,
        views: doc.data().views || 0,
        comments: doc.data().comments || 0,
      }));
    }

    // If no history exists, create initial data points from meme creation time
    const memeRef = doc(db, "memes", memeId);
    const memeSnap = await getDoc(memeRef);

    if (!memeSnap.exists()) return [];

    const memeData = memeSnap.data();
    const now = new Date();
    const createdAt = memeData.createdAt.toDate();

    const historicalData = [
      {
        timestamp: createdAt,
        likes: 0,
        views: 0,
        comments: 0,
      },
    ];

    // Add current data if meme wasn't just created
    if (now > createdAt) {
      historicalData.push({
        timestamp: now,
        likes: memeData.likes || 0,
        views: memeData.views || 0,
        comments: memeData.commentCount || 0,
      });
    }

    return historicalData;
  } catch (error) {
    console.error("Error getting historical data:", error);
    return [];
  }
}

// Record that the user viewed these analytics
async function recordAnalyticsView(memeId) {
  try {
    const analyticsRef = collection(db, `memes/${memeId}/analyticsViews`);
    await addDoc(analyticsRef, {
      userId: auth.currentUser.uid,
      viewedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error recording analytics view:", error);
  }
}

// Render basic stats
function renderBasicStats(memeData) {
  document.getElementById("meme-title").textContent =
    memeData.title || "Untitled Meme";
  document.getElementById("meme-image").src = memeData.imageUrl;

  // Format numbers with k/M suffixes
  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  // Update stats
  document.getElementById("total-views").textContent = formatNumber(
    memeData.views || 0
  );
  document.getElementById("total-likes").textContent = formatNumber(
    memeData.likes || 0
  );
  document.getElementById("total-comments").textContent = formatNumber(
    memeData.commentCount || 0
  );
  document.getElementById("engagement-rate").textContent =
    memeData.engagementRate;

  // Calculate time since creation
  const hours = memeData.hoursSinceCreation;
  let timeText;
  if (hours < 1) {
    timeText = "Less than an hour ago";
  } else if (hours < 24) {
    timeText = `${Math.floor(hours)} hours ago`;
  } else {
    timeText = `${Math.floor(hours / 24)} days ago`;
  }

  // Calculate performance rating
  const rating = calculatePerformanceRating(memeData);
  document.getElementById("performance-rating").textContent = rating.score;
  document.getElementById(
    "performance-rating"
  ).className = `rating ${rating.class}`;
  document.getElementById("performance-description").textContent =
    rating.description;
}

// Calculate performance rating based on engagement metrics
function calculatePerformanceRating(memeData) {
  const likesPerHour = memeData.likesPerHour;
  const commentsPerHour = memeData.commentsPerHour;
  const engagementRate = parseFloat(memeData.engagementRate);

  let score, className, description;

  // Viral - exceptional performance
  if (likesPerHour > 50 || engagementRate > 50) {
    score = "Viral";
    className = "viral";
    description =
      "🔥 Your meme is on fire! It has high engagement and is spreading quickly.";
  }
  // Great - strong performance
  else if (likesPerHour > 20 || engagementRate > 20) {
    score = "Great";
    className = "great";
    description =
      "👍 Your meme is performing exceptionally well! Keep up the great work.";
  }
  // Good - solid performance
  else if (likesPerHour > 5 || engagementRate > 5) {
    score = "Good";
    className = "good";
    description =
      "💪 Your meme is doing well. Try sharing it more to increase reach.";
  }
  // Average - needs improvement
  else if (likesPerHour > 1 || engagementRate > 1) {
    score = "Average";
    className = "average";
    description =
      "🤔 Your meme is getting some attention. Consider improving the content or timing.";
  }
  // Low - poor performance
  else {
    score = "Low";
    className = "low";
    description =
      "📉 Your meme needs more exposure. Try different tags or posting at peak times.";
  }

  return { score, class: className, description };
}

// Render engagement doughnut chart
function renderEngagementChart(memeData) {
  const ctx = document.getElementById("engagement-chart").getContext("2d");

  new Chart.default(ctx, {
    type: "doughnut",
    data: {
      labels: ["Likes", "Comments", "Views"],
      datasets: [
        {
          data: [memeData.likes, memeData.commentCount, memeData.views],
          backgroundColor: [
            "#4CAF50", // green for likes
            "#2196F3", // blue for comments
            "#FF9800", // orange for views
          ],
          borderWidth: 0,
          hoverOffset: 10,
        },
      ],
    },
    options: {
      responsive: true,
      cutout: "70%",
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.label || "";
              const value = context.raw || 0;
              return `${label}: ${value.toLocaleString()}`;
            },
          },
        },
      },
      animation: {
        animateScale: true,
        animateRotate: true,
      },
    },
  });
}

// Render historical line chart with time filtering
function renderHistoricalChart(historicalData) {
  const ctx = document.getElementById("historicalChart").getContext("2d");
  const container = ctx.canvas.closest(".chart-container");

  if (historicalChart) {
    historicalChart.destroy();
  }

  // Show container in case it was hidden previously
  container.style.display = "block";

  // Format dates based on time period
  const formatDateLabel = (date) => {
    if (currentPeriod === "24h") {
      return date.toLocaleTimeString([], { hour: "2-digit" });
    } else if (currentPeriod === "7d") {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  historicalChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: historicalData.map((data) => formatDateLabel(data.date)),
      datasets: [
        {
          label: "Likes",
          data: historicalData.map((data) => data.likes),
          borderColor: "#4CAF50",
          backgroundColor: "rgba(76, 175, 80, 0.1)",
          tension: 0.3,
          fill: true,
          yAxisID: "y",
        },
        {
          label: "Views",
          data: historicalData.map((data) => data.views),
          borderColor: "#FF9800",
          backgroundColor: "rgba(255, 152, 0, 0.1)",
          tension: 0.3,
          fill: true,
          yAxisID: "y",
        },
        {
          label: "Comments",
          data: historicalData.map((data) => data.comments),
          borderColor: "#2196F3",
          backgroundColor: "rgba(33, 150, 243, 0.1)",
          tension: 0.3,
          fill: true,
          yAxisID: "y",
        },
      ],
    },
    options: {
      responsive: true,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => {
              let label = context.dataset.label || "";
              if (label) label += ": ";
              label += context.parsed.y.toLocaleString();
              return label;
            },
          },
        },
      },
      scales: {
        y: {
          type: "linear",
          display: true,
          position: "left",
          ticks: {
            callback: (value) =>
              value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value,
          },
        },
      },
    },
  });
}

// Set up event listeners
function setupEventListeners() {
  // Back button
  document.getElementById("backButton").addEventListener("click", () => {
    window.history.back();
  });

  // Share button
  document.getElementById("shareButton")?.addEventListener("click", () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator
        .share({
          title: "Check out my meme stats!",
          url: url,
        })
        .catch((err) => {
          console.error("Error sharing:", err);
          copyToClipboard(url);
        });
    } else {
      copyToClipboard(url);
    }
  });
}

// Helper function to copy to clipboard
function copyToClipboard(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  showToast("Link copied to clipboard!", "success");
}
