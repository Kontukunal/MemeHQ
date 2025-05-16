import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showToast } from "./utils.js";

export function initAuth() {
  onAuthStateChanged(auth, (user) => {
    const protectedPages = ["index.html", "create.html"];
    const currentPage = window.location.pathname.split("/").pop();

    if (user) {
      if (currentPage === "login.html") {
        window.location.href = "index.html";
      }
      updateUserUI(user);
    } else {
      if (protectedPages.includes(currentPage)) {
        window.location.href = "login.html";
      }
    }
  });
}

function updateUserUI(user) {
  const userNameElements = document.querySelectorAll("#userName, .user-name");
  const userAvatarElements = document.querySelectorAll(
    "#userAvatar, .user-avatar"
  );
  const logoutButtons = document.querySelectorAll("#logoutBtn, .logout-btn");
  const authRequiredElements = document.querySelectorAll(".auth-required");

  userNameElements.forEach((el) => {
    el.textContent = user.email.split("@")[0];
  });

  userAvatarElements.forEach((el) => {
    el.src =
      user.photoURL ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        user.email
      )}&background=random`;
  });

  logoutButtons.forEach((btn) => {
    btn.style.display = "block";
    btn.addEventListener("click", handleLogout);
  });

  authRequiredElements.forEach((el) => {
    el.style.display = "block";
  });
}

export async function handleLogin(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showToast("Login successful!", "success");
    return { success: true };
  } catch (error) {
    let errorMessage = "Login failed";
    switch (error.code) {
      case "auth/invalid-email":
        errorMessage = "Invalid email address";
        break;
      case "auth/user-not-found":
      case "auth/wrong-password":
        errorMessage = "Invalid email or password";
        break;
      default:
        errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

export async function handleSignup(email, password) {
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    showToast("Account created successfully!", "success");
    return { success: true };
  } catch (error) {
    let errorMessage = "Signup failed";
    switch (error.code) {
      case "auth/email-already-in-use":
        errorMessage = "Email already in use";
        break;
      case "auth/invalid-email":
        errorMessage = "Invalid email address";
        break;
      case "auth/weak-password":
        errorMessage = "Password should be at least 6 characters";
        break;
      default:
        errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

export async function handleLogout() {
  try {
    await signOut(auth);
    showToast("Logged out successfully", "success");
    window.location.href = "login.html";
  } catch (error) {
    showToast("Logout failed: " + error.message, "error");
  }
}
