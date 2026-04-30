import { APP_CONFIG } from "./config.js";
import { state, canEdit } from "./state.js";
import { getAuthorizedProfile, loginWithGoogle, logout, watchAuth } from "./firebase.service.js";
import {
  buildKpis,
  generateMonthlyPayments,
  listMonthlyPayments,
  markPaymentPaid,
  updatePayment
} from "./payments.service.js";

const $ = (selector) => document.querySelector(selector);
const els = {
  loginView: $("#loginView"),
  appView: $("#appView"),
  btnLogin: $("#btnLogin"),
  loginMessage: $("#loginMessage"),
  btnLogout: $("#btnLogout"),
  userLabel: $("#userLabel"),
  monthSelect: $("#monthSelect"),
  yearSelect: $("#yearSelect"),
  btnRefresh: $("#btnRefresh"),
  searchInput: $("#searchInput"),
  statusFilter: $("#statusFilter"),
  categoryFilter: $("#categoryFilter"),
  responsibleFilter: $("#responsibleFilter"),
  statusLine: $("#statusLine"),
  periodTitle: $("#periodTitle"),
  paymentsBody: $("#paymentsBody"),
  alertsList: $("#alertsList"),
  kpiEstimated: $("#kpiEstimated"),
  kpiPaid: $("#kpiPaid"),
  kpiPending: $("#kpiPending"),
  kpiOverdue: $("#kpiOverdue"),
  kpiUrgent: $("#kpiUrgent"),
  kpiUpcoming: $("#kpiUpcoming"),
  paymentDialog: $("#paymentDialog"),
  paymentForm: $("#paymentForm"),
  paymentId: $("#paymentId"),
  paidAt: $("#paidAt"),
  paidValue: $("#paidValue"),
  paymentMethod: $("#paymentMethod"),
  receiptUrl: $("#receiptUrl"),
  paymentNotes: $("#paymentNotes"),
  editDialog: $("#editDialog"),
  editForm: $("#editForm"),
  editPaymentId: $("#editPaymentId"),
  editName: $("#editName"),
  editResponsible: $("#editResponsible"),
  editDueDate: $("#editDueDate"),
  editEstimatedValue: $("#editEstimatedValue"),
  editNotes: $("#editNotes"),
  toast: $("#toast")
};

init();

function init() {
  fillPeriodSelectors();
  fillPaymentMethods();
  bindEvents();

  watchAuth(async (user) => {
    if (!user) {
      state.user = null;
      state.profile = null;
      showLogin();
      return;
    }

    try {
      const profile = await getAuthorizedProfile(user);
      if (!profile) {
        await logout();
        showLogin("Tu correo no esta autorizado para entrar a este radar.");
        return;
      }

      state.user = user;
      state.profile = profile;
      showApp();
      await loadPayments();
    } catch (error) {
      console.error(error);
      showLogin("No se pudo validar tu usuario.");
    }
  });
}

function bindEvents() {
  els.btnLogin?.addEventListener("click", () => loginWithGoogle().catch(showError));
  els.btnLogout?.addEventListener("click", () => logout());
  els.btnRefresh?.addEventListener("click", loadPayments);
  els.monthSelect?.addEventListener("change", () => {
    state.selectedMonth = Number(els.monthSelect.value);
    loadPayments();
  });
  els.yearSelect?.addEventListener("change", () => {
    state.selectedYear = Number(els.yearSelect.value);
    loadPayments();
  });
  [els.searchInput, els.statusFilter, els.categoryFilter, els.responsibleFilter].forEach((el) => {
    el?.addEventListener("input", () => {
      state.filters.search = els.searchInput.value.trim().toLowerCase();
      state.filters.status = els.statusFilter.value;
      state.filters.category = els.categoryFilter.value;
      state.filters.responsible = els.responsibleFilter.value;
      render();
    });
  });
  els.paymentForm?.addEventListener("submit", savePayment);
  els.editForm?.addEventListener("submit", savePaymentEdit);
  document.addEventListener("click", handleActionClick);
  document.querySelectorAll("[data-close-dialog]").forEach((btn) => {
    btn.addEventListener("click", () => btn.closest("dialog")?.close());
  });
}

async function loadPayments() {
  setBusy(true, "Cargando pagos...");
  try {
    if (canEdit()) {
      await generateMonthlyPayments(state.selectedYear, state.selectedMonth, state.user);
    }
    state.payments = await listMonthlyPayments(state.selectedYear, state.selectedMonth);
    populateFilters();
    render();
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}

function render() {
  const items = filteredPayments();
  const kpis = buildKpis(state.payments);
  els.periodTitle.textContent = `${APP_CONFIG.months[state.selectedMonth - 1]} ${state.selectedYear}`;
  els.kpiEstimated.textContent = money(kpis.totalEstimated);
  els.kpiPaid.textContent = money(kpis.totalPaid);
  els.kpiPending.textContent = money(kpis.pendingAmount);
  els.kpiOverdue.textContent = String(kpis.overdue);
  els.kpiUrgent.textContent = String(kpis.urgent);
  els.kpiUpcoming.textContent = String(kpis.upcoming);
  renderAlerts();
  renderTable(items);
  els.statusLine.textContent = state.payments.length
    ? `Mostrando ${items.length} de ${state.payments.length} pagos.`
    : "No hay pagos para este mes.";
}

function renderAlerts() {
  const ordered = state.payments
    .filter((p) => ["overdue", "urgent", "upcoming"].includes(p.computedStatus))
    .sort((a, b) => statusWeight(a.computedStatus) - statusWeight(b.computedStatus))
    .slice(0, 8);

  if (!ordered.length) {
    els.alertsList.innerHTML = `<article class="alert-card ok"><strong>Todo bajo control</strong><span>No hay pagos vencidos ni urgentes.</span></article>`;
    return;
  }

  els.alertsList.innerHTML = ordered.map((p) => `
    <article class="alert-card ${p.computedStatus}">
      <strong>${escapeHtml(label(p.computedStatus))}: ${escapeHtml(p.name)}</strong>
      <span>vence ${formatDate(p.dueDate)} · ${money(p.estimatedValue)}</span>
    </article>
  `).join("");
}

function renderTable(items) {
  if (!items.length) {
    els.paymentsBody.innerHTML = `<tr><td colspan="7" class="empty">No hay pagos que coincidan con los filtros.</td></tr>`;
    return;
  }

  els.paymentsBody.innerHTML = items.map((p) => `
    <tr>
      <td><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.category || "Sin categoria")}</small></td>
      <td>${escapeHtml(p.responsible || "-")}</td>
      <td>${formatDate(p.dueDate)}</td>
      <td><strong>${money(p.estimatedValue)}</strong><small>${p.paidValue ? `Pagado: ${money(p.paidValue)}` : ""}</small></td>
      <td><span class="badge ${p.computedStatus}">${label(p.computedStatus)}</span></td>
      <td><small>${escapeHtml(p.paymentMethod || "")}</small><small>${escapeHtml(p.notes || "")}</small>${p.receiptUrl ? `<a href="${escapeAttr(p.receiptUrl)}" target="_blank" rel="noopener">Comprobante</a>` : ""}</td>
      <td class="actions">
        <button class="btn btn-small btn-primary" data-action="pay" data-id="${escapeAttr(p.id)}" ${!canEdit() || p.computedStatus === "paid" ? "disabled" : ""}>Pago</button>
        <button class="btn btn-small btn-ghost" data-action="edit" data-id="${escapeAttr(p.id)}" ${!canEdit() ? "disabled" : ""}>Editar</button>
        <button class="btn btn-small btn-ghost" data-action="scheduled" data-id="${escapeAttr(p.id)}" ${!canEdit() ? "disabled" : ""}>Programado</button>
        <button class="btn btn-small btn-ghost" data-action="na" data-id="${escapeAttr(p.id)}" ${!canEdit() ? "disabled" : ""}>No aplica</button>
        <button class="btn btn-small btn-ghost" data-action="reopen" data-id="${escapeAttr(p.id)}" ${!canEdit() ? "disabled" : ""}>Reabrir</button>
      </td>
    </tr>
  `).join("");
}

async function handleActionClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const payment = state.payments.find((p) => p.id === button.dataset.id);
  if (!payment) return;

  if (button.dataset.action === "pay") return openPaymentDialog(payment);
  if (button.dataset.action === "edit") return openEditDialog(payment);

  const updates = {
    scheduled: { status: "scheduled" },
    na: { status: "not_applicable", paidAt: null, paidValue: 0 },
    reopen: { status: "pending", paidAt: null, paidValue: 0 }
  }[button.dataset.action];

  try {
    await updatePayment(payment.id, updates, state.user);
    await loadPayments();
  } catch (error) {
    showError(error);
  }
}

function openPaymentDialog(payment) {
  els.paymentId.value = payment.id;
  els.paidAt.value = todayISO();
  els.paidValue.value = payment.estimatedValue || "";
  els.paymentMethod.value = payment.paymentMethod || "";
  els.receiptUrl.value = payment.receiptUrl || "";
  els.paymentNotes.value = payment.notes || "";
  els.paymentDialog.showModal();
}

async function savePayment(event) {
  event.preventDefault();
  try {
    await markPaymentPaid(els.paymentId.value, {
      paidAt: els.paidAt.value,
      paidValue: els.paidValue.value,
      paymentMethod: els.paymentMethod.value,
      receiptUrl: els.receiptUrl.value,
      notes: els.paymentNotes.value
    }, state.user);
    els.paymentDialog.close();
    await loadPayments();
  } catch (error) {
    showError(error);
  }
}

function openEditDialog(payment) {
  els.editPaymentId.value = payment.id;
  els.editName.value = payment.name || "";
  els.editResponsible.value = payment.responsible || "";
  els.editDueDate.value = String(payment.dueDate || "").slice(0, 10);
  els.editEstimatedValue.value = payment.estimatedValue || "";
  els.editNotes.value = payment.notes || "";
  els.editDialog.showModal();
}

async function savePaymentEdit(event) {
  event.preventDefault();
  try {
    await updatePayment(els.editPaymentId.value, {
      name: els.editName.value.trim(),
      responsible: els.editResponsible.value.trim(),
      dueDate: els.editDueDate.value,
      estimatedValue: Number(els.editEstimatedValue.value || 0),
      notes: els.editNotes.value.trim()
    }, state.user);
    els.editDialog.close();
    await loadPayments();
  } catch (error) {
    showError(error);
  }
}

function filteredPayments() {
  return state.payments.filter((p) => {
    const haystack = `${p.name} ${p.category} ${p.responsible}`.toLowerCase();
    if (state.filters.search && !haystack.includes(state.filters.search)) return false;
    if (state.filters.status && p.computedStatus !== state.filters.status) return false;
    if (state.filters.category && p.category !== state.filters.category) return false;
    if (state.filters.responsible && p.responsible !== state.filters.responsible) return false;
    return true;
  });
}

function populateFilters() {
  fillSelect(els.categoryFilter, unique(state.payments.map((p) => p.category).filter(Boolean)), "Todas las categorias");
  fillSelect(els.responsibleFilter, unique(state.payments.map((p) => p.responsible).filter(Boolean)), "Todos los responsables");
}

function fillPeriodSelectors() {
  els.monthSelect.innerHTML = APP_CONFIG.months.map((name, index) => `<option value="${index + 1}">${name}</option>`).join("");
  els.monthSelect.value = String(state.selectedMonth);
  const year = new Date().getFullYear();
  els.yearSelect.innerHTML = Array.from({ length: 7 }, (_, i) => year - 3 + i).map((y) => `<option value="${y}">${y}</option>`).join("");
  els.yearSelect.value = String(state.selectedYear);
}

function fillPaymentMethods() {
  els.paymentMethod.innerHTML = `<option value="">Seleccionar</option>${APP_CONFIG.paymentMethods.map((item) => `<option>${item}</option>`).join("")}`;
}

function fillSelect(select, values, labelText) {
  const current = select.value;
  select.innerHTML = `<option value="">${labelText}</option>${values.map((value) => `<option>${escapeHtml(value)}</option>`).join("")}`;
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
}

function setBusy(isBusy, message = "") {
  els.statusLine.textContent = message || els.statusLine.textContent;
  [els.btnRefresh, els.btnGenerate].forEach((btn) => { if (btn) btn.disabled = isBusy; });
}

function label(status) {
  return APP_CONFIG.statusLabels[status] || "Pendiente";
}

function statusWeight(status) {
  return { overdue: 1, urgent: 2, upcoming: 3 }[status] || 9;
}

function money(value) {
  return new Intl.NumberFormat(APP_CONFIG.locale, { style: "currency", currency: APP_CONFIG.currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat(APP_CONFIG.locale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(y, m - 1, d));
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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
