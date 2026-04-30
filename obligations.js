import { APP_CONFIG } from "./config.js";
import { state, canEdit } from "./state.js";
import { getAuthorizedProfile, loginWithGoogle, logout, watchAuth } from "./firebase.service.js";
import { listObligations, saveObligation, setObligationActive } from "./obligations.service.js";

const $ = (selector) => document.querySelector(selector);
const els = {
  loginView: $("#loginView"),
  appView: $("#appView"),
  btnLogin: $("#btnLogin"),
  loginMessage: $("#loginMessage"),
  btnLogout: $("#btnLogout"),
  userLabel: $("#userLabel"),
  btnNew: $("#btnNew"),
  searchInput: $("#searchInput"),
  activeFilter: $("#activeFilter"),
  categoryFilter: $("#categoryFilter"),
  statusLine: $("#statusLine"),
  obligationsBody: $("#obligationsBody"),
  dialog: $("#obligationDialog"),
  form: $("#obligationForm"),
  dialogTitle: $("#dialogTitle"),
  id: $("#obligationId"),
  name: $("#name"),
  category: $("#category"),
  frequency: $("#frequency"),
  dueDay: $("#dueDay"),
  monthsApply: $("#monthsApply"),
  estimatedValue: $("#estimatedValue"),
  paymentMethod: $("#paymentMethod"),
  provider: $("#provider"),
  priority: $("#priority"),
  active: $("#active"),
  notes: $("#notes"),
  categoryOptions: $("#categoryOptions"),
  toast: $("#toast")
};

init();

function init() {
  bindEvents();
  fillCategoryOptions();

  watchAuth(async (user) => {
    if (!user) return showLogin();
    try {
      const profile = await getAuthorizedProfile(user);
      if (!profile) {
        await logout();
        return showLogin("Tu correo no esta autorizado.");
      }
      state.user = user;
      state.profile = profile;
      showApp();
      await loadObligations();
    } catch (error) {
      showError(error);
    }
  });
}

function bindEvents() {
  els.btnLogin?.addEventListener("click", () => loginWithGoogle().catch(showError));
  els.btnLogout?.addEventListener("click", logout);
  els.btnNew?.addEventListener("click", openCreate);
  [els.searchInput, els.activeFilter, els.categoryFilter].forEach((el) => {
    el?.addEventListener("input", () => {
      state.filters.search = els.searchInput.value.trim().toLowerCase();
      state.filters.active = els.activeFilter.value;
      state.filters.category = els.categoryFilter.value;
      render();
    });
  });
  els.form?.addEventListener("submit", handleSubmit);
  document.addEventListener("click", handleTableClick);
  document.querySelectorAll("[data-close-dialog]").forEach((btn) => {
    btn.addEventListener("click", () => btn.closest("dialog")?.close());
  });
}

async function loadObligations() {
  els.statusLine.textContent = "Cargando obligaciones...";
  try {
    state.obligations = await listObligations();
    populateFilters();
    render();
  } catch (error) {
    showError(error);
  }
}

function render() {
  const items = filtered();
  els.statusLine.textContent = state.obligations.length
    ? `Mostrando ${items.length} de ${state.obligations.length} obligaciones.`
    : "No hay obligaciones registradas.";

  if (!items.length) {
    els.obligationsBody.innerHTML = `<tr><td colspan="6" class="empty">No hay obligaciones con estos filtros.</td></tr>`;
    return;
  }

  els.obligationsBody.innerHTML = items.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.provider || item.paymentMethod || "")}</small></td>
      <td>${escapeHtml(item.category || "-")}</td>
      <td>Dia ${escapeHtml(item.dueDay || "-")}<small>${monthsText(item.monthsApply)}</small></td>
      <td>${money(item.estimatedValue)}</td>
      <td><span class="badge ${item.active ? "paid" : "pending"}">${item.active ? "Activa" : "Inactiva"}</span></td>
      <td class="actions">
        <button class="btn btn-small btn-ghost" data-action="edit" data-id="${escapeAttr(item.id)}" ${!canEdit() ? "disabled" : ""}>Editar</button>
        <button class="btn btn-small btn-primary" data-action="toggle" data-id="${escapeAttr(item.id)}" ${!canEdit() ? "disabled" : ""}>${item.active ? "Inactivar" : "Activar"}</button>
      </td>
    </tr>
  `).join("");
}

function filtered() {
  return state.obligations.filter((item) => {
    const haystack = `${item.name} ${item.category} ${item.provider}`.toLowerCase();
    if (state.filters.search && !haystack.includes(state.filters.search)) return false;
    if (state.filters.active === "true" && !item.active) return false;
    if (state.filters.active === "false" && item.active) return false;
    if (state.filters.category && item.category !== state.filters.category) return false;
    return true;
  });
}

function openCreate() {
  els.form.reset();
  els.id.value = "";
  els.active.value = "true";
  els.priority.value = "Normal";
  els.frequency.value = "monthly";
  els.dialogTitle.textContent = "Nueva obligacion";
  els.dialog.showModal();
}

function openEdit(item) {
  els.id.value = item.id;
  els.name.value = item.name || "";
  els.category.value = item.category || "";
  els.frequency.value = item.frequency || "monthly";
  els.dueDay.value = item.dueDay || 1;
  els.monthsApply.value = Array.isArray(item.monthsApply) ? item.monthsApply.join(",") : "";
  els.estimatedValue.value = item.estimatedValue || "";
  els.paymentMethod.value = item.paymentMethod || "";
  els.provider.value = item.provider || "";
  els.priority.value = item.priority || "Normal";
  els.active.value = item.active === false ? "false" : "true";
  els.notes.value = item.notes || "";
  els.dialogTitle.textContent = "Editar obligacion";
  els.dialog.showModal();
}

async function handleSubmit(event) {
  event.preventDefault();
  try {
    await saveObligation({
      id: els.id.value,
      name: els.name.value,
      category: els.category.value,
      responsible: "",
      frequency: els.frequency.value,
      dueDay: els.dueDay.value,
      monthsApply: els.monthsApply.value,
      estimatedValue: els.estimatedValue.value,
      paymentMethod: els.paymentMethod.value,
      provider: els.provider.value,
      priority: els.priority.value,
      active: els.active.value === "true",
      receiptRequired: true,
      notes: els.notes.value
    }, state.user);
    els.dialog.close();
    showToast("Obligacion guardada.");
    await loadObligations();
  } catch (error) {
    showError(error);
  }
}

async function handleTableClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const item = state.obligations.find((obligation) => obligation.id === button.dataset.id);
  if (!item) return;
  if (button.dataset.action === "edit") return openEdit(item);
  if (button.dataset.action === "toggle") {
    try {
      await setObligationActive(item.id, !item.active, state.user);
      await loadObligations();
    } catch (error) {
      showError(error);
    }
  }
}

function populateFilters() {
  fillSelect(els.categoryFilter, unique(state.obligations.map((item) => item.category).filter(Boolean)), "Todas las categorias");
}

function fillCategoryOptions() {
  els.categoryOptions.innerHTML = APP_CONFIG.categories.map((item) => `<option value="${escapeAttr(item)}"></option>`).join("");
}

function fillSelect(select, values, label) {
  const current = select.value;
  select.innerHTML = `<option value="">${label}</option>${values.map((value) => `<option>${escapeHtml(value)}</option>`).join("")}`;
  if (values.includes(current)) select.value = current;
}

function showLogin(message = "") {
  els.loginView.classList.remove("is-hidden");
  els.appView.classList.add("is-hidden");
  els.loginMessage.textContent = message;
}

function showApp() {
  els.loginView.classList.add("is-hidden");
  els.appView.classList.remove("is-hidden");
  els.userLabel.textContent = `${state.profile.name || state.profile.email} · ${state.profile.role}`;
  els.btnNew.disabled = !canEdit();
}

function monthsText(months) {
  if (!Array.isArray(months) || !months.length) return "Todos los meses";
  return months.map((month) => APP_CONFIG.months[Number(month) - 1]?.slice(0, 3)).join(", ");
}

function money(value) {
  return new Intl.NumberFormat(APP_CONFIG.locale, { style: "currency", currency: APP_CONFIG.currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));
}

function showError(error) {
  console.error(error);
  showToast(error.message || "Ocurrio un error.", "error");
}

function showToast(message, type = "success") {
  els.toast.textContent = message;
  els.toast.className = `toast is-visible ${type}`;
  setTimeout(() => els.toast.classList.remove("is-visible"), 3200);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
