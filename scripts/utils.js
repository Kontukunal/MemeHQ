export function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }, 100);
}

export function formatDate(dateString) {
  const options = { year: "numeric", month: "short", day: "numeric" };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

export function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}

export function showLoading(button) {
  const originalHTML = button.innerHTML;
  button.dataset.originalHtml = originalHTML;
  button.disabled = true;
  button.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> ' +
    (button.dataset.loadingText || "");
  button.classList.add("btn-loading");
}

export function hideLoading(button) {
  button.disabled = false;
  button.innerHTML = button.dataset.originalHtml || "";
  button.classList.remove("btn-loading");
}

export function validateImageUrl(url) {
  try {
    new URL(url);
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  } catch {
    return false;
  }
}

export function logMemeData(meme) {
  console.group("Meme Data Debug");
  console.log("Meme ID:", meme.id);
  console.log("Image URL:", meme.imageUrl);
  console.log("Text Elements:", meme.textElements);
  if (meme.textElements) {
    meme.textElements.forEach((text, i) => {
      console.group(`Text Element ${i}`);
      console.log("Content:", text.content);
      console.log("Font:", text.fontFamily, text.fontSize);
      console.log("Colors:", text.color, text.outlineColor);
      console.log("Position:", text.position);
      console.groupEnd();
    });
  }
  console.groupEnd();
}

// Add to your existing scripts/utils.js
export function setActiveNavItem() {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-item").forEach((item) => {
    const itemHref = item.getAttribute("href");
    if (itemHref === currentPage) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
}

export function showLoader(show = true) {
  const loader = document.getElementById("globalLoader");
  if (loader) {
    loader.style.display = show ? "flex" : "none";
  }
}

export function showElementLoader(element, show = true, text = "Loading...") {
  if (!element) return;

  if (show) {
    const loader = document.createElement("div");
    loader.className = "loader";
    loader.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${text}`;
    element.appendChild(loader);
  } else {
    const loader = element.querySelector(".loader");
    if (loader) {
      loader.remove();
    }
  }
}
