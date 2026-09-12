const adminToast = document.querySelector(".toast");
const draftCount = document.querySelector(".draft-count");
let changes = 0;

function notify(message) {
  adminToast.textContent = message;
  adminToast.classList.add("visible");
  window.setTimeout(() => adminToast.classList.remove("visible"), 2800);
}

function recordDraft(message) {
  changes += 1;
  draftCount.textContent = changes;
  notify(message);
}

function showPanel(name) {
  document.querySelectorAll("[data-panel-content]").forEach((panel) => {
    panel.hidden = panel.dataset.panelContent !== name;
  });
  document.querySelectorAll("[data-panel]").forEach((button) => {
    button.classList.toggle("active", button.dataset.panel === name);
  });
  const labels = { overview: "Good morning, Claire.", schedule: "Manage your schedule.", classes: "Shape your class library.", pricing: "Set your pricing.", studio: "Studio & team details." };
  document.querySelector("#panel-title").textContent = labels[name];
}

document.querySelectorAll("[data-panel], [data-open]").forEach((button) => {
  button.addEventListener("click", () => showPanel(button.dataset.panel || button.dataset.open));
});
document.querySelectorAll("[data-edit]").forEach((button) => {
  button.addEventListener("click", () => recordDraft("Draft change recorded. Database saving will be connected here."));
});
document.querySelectorAll("[data-preview]").forEach((button) => {
  button.addEventListener("click", () => notify("Preview mode will show draft changes before publishing."));
});
document.querySelector("[data-publish]").addEventListener("click", () => {
  notify(changes ? "Publishing will be available once the database is connected." : "No draft changes to publish.");
});
document.querySelectorAll("[data-schedule-view]").forEach((button) => {
  button.addEventListener("click", () => {
    const calendar = button.dataset.scheduleView === "calendar";
    document.querySelector(".calendar-view").hidden = !calendar;
    document.querySelector(".table-view").hidden = calendar;
    document.querySelectorAll("[data-schedule-view]").forEach((item) => item.classList.toggle("active", item === button));
  });
});
