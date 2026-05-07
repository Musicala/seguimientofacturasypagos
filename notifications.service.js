import { APP_CONFIG } from "./config.js";
import { state } from "./state.js";

const EXCLUDED_STATUSES = new Set(["paid", "not_applicable", "scheduled"]);

export function getDueNotificationPayments(payments, options = {}) {
  const dueWindowDays = Number(options.dueWindowDays ?? APP_CONFIG.notifications?.dueWindowDays ?? 1);
  const timezone = options.timezone || APP_CONFIG.timezone || "America/Bogota";
  const dueDates = buildLocalDateWindow(dueWindowDays, timezone);

  return payments
    .filter((payment) => {
      const status = payment.computedStatus || payment.status || "pending";
      const dueDate = normalizeDueDate(payment.dueDate);
      return dueDate && dueDates.has(dueDate) && !EXCLUDED_STATUSES.has(status);
    })
    .map(toNotificationPayment);
}

export async function sendDuePaymentNotifications() {
  const config = APP_CONFIG.notifications || {};

  if (!config.enabled) {
    return { ok: true, sent: false, skipped: true, message: "Las notificaciones estan desactivadas." };
  }

  if (!config.appsScriptUrl) {
    throw new Error("Falta configurar APP_CONFIG.notifications.appsScriptUrl.");
  }

  const response = await fetch(config.appsScriptUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(buildNotificationPayload())
  });

  const text = await response.text();
  let result = {};

  try {
    result = text ? JSON.parse(text) : {};
  } catch (error) {
    result = { ok: response.ok, raw: text };
  }

  if (!response.ok || result.ok === false) {
    throw new Error(result.error || `No se pudo enviar la alerta (${response.status}).`);
  }

  return result;
}

export function buildNotificationPayload() {
  return {
    app: "Seguimiento de Pagos Musicala",
    triggeredBy: {
      email: state.user?.email || "",
      name: state.user?.displayName || state.user?.email || ""
    },
    token: APP_CONFIG.notifications?.token || "",
    generatedAt: new Date().toISOString()
  };
}

function toNotificationPayment(payment) {
  return {
    id: payment.id || "",
    name: payment.name || "",
    category: payment.category || "",
    responsible: payment.responsible || "",
    dueDate: normalizeDueDate(payment.dueDate) || "",
    estimatedValue: Number(payment.estimatedValue || 0),
    paymentMethod: payment.paymentMethod || "",
    provider: payment.provider || "",
    priority: payment.priority || "",
    notes: payment.notes || "",
    computedStatus: payment.computedStatus || payment.status || "pending"
  };
}

function buildLocalDateWindow(dueWindowDays, timezone) {
  const dates = new Set();
  const [year, month, day] = formatInTimezone(new Date(), timezone).split("-").map(Number);
  const limit = Math.max(0, dueWindowDays);

  for (let dayOffset = 0; dayOffset <= limit; dayOffset += 1) {
    const date = new Date(Date.UTC(year, month - 1, day + dayOffset, 12));
    dates.add(formatInTimezone(date, timezone));
  }

  return dates;
}

function formatInTimezone(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeDueDate(value) {
  if (!value) return "";
  if (value.toDate) return formatInTimezone(value.toDate(), APP_CONFIG.timezone || "America/Bogota");
  return String(value).slice(0, 10);
}
