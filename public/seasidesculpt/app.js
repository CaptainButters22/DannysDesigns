const page = document.body.dataset.page;

document.querySelector(".menu-toggle")?.addEventListener("click", (event) => {
  const menu = document.querySelector(".nav-links");
  const isOpen = menu.classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", isOpen);
});

document.querySelectorAll(".nav-links a").forEach((link) => {
  if (link.getAttribute("href").startsWith(page)) link.setAttribute("aria-current", "page");
});

const showToast = (message) => {
  const toast = document.querySelector(".toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2600);
};

document.querySelector("#class-filter")?.addEventListener("change", (event) => {
  document.querySelectorAll("[data-class]").forEach((row) => {
    row.hidden = event.target.value !== "all" && row.dataset.class !== event.target.value;
  });
});

document.querySelectorAll("[data-book]").forEach((button) => {
  button.addEventListener("click", () => showToast("Demo booking selected. Connect this button to your scheduling platform."));
});

document.querySelectorAll("[data-staff-action]").forEach((button) => {
  button.addEventListener("click", () => {
    button.textContent = "Completed";
    button.disabled = true;
    showToast(`${button.dataset.staffAction} recorded in this prototype.`);
  });
});
