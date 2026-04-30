import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "./firebase.service.js";
import { appliesToMonth, listObligations } from "./obligations.service.js";

const COLLECTION = "monthlyPayments";

export function periodId(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export async function listMonthlyPayments(year, month) {
  const period = periodId(year, month);
  const snap = await getDocs(query(collection(db, COLLECTION), where("period", "==", period)));
  return snap.docs
    .map((item) => withComputedStatus({ id: item.id, ...item.data() }))
    .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));
}

export async function generateMonthlyPayments(year, month, user) {
  const obligations = await listObligations();
  const period = periodId(year, month);
  let created = 0;
  let existing = 0;

  for (const obligation of obligations.filter((item) => appliesToMonth(item, month))) {
    const id = `${period}_${obligation.id}`;
    const ref = doc(db, COLLECTION, id);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      existing += 1;
      const current = snap.data();
      if (!current.paidAt && current.status !== "paid") {
        await setDoc(ref, {
          name: obligation.name,
          category: obligation.category || "",
          responsible: obligation.responsible || "",
          estimatedValue: Number(obligation.estimatedValue || 0),
          paymentMethod: obligation.paymentMethod || current.paymentMethod || "",
          updatedAt: serverTimestamp(),
          updatedBy: user?.email || ""
        }, { merge: true });
      }
      continue;
    }

    const dueDate = buildDueDate(year, month, obligation.dueDay);
    await setDoc(ref, {
      obligationId: obligation.id,
      period,
      year: Number(year),
      month: Number(month),
      name: obligation.name,
      category: obligation.category || "",
      responsible: obligation.responsible || "",
      dueDate,
      estimatedValue: Number(obligation.estimatedValue || 0),
      paidValue: 0,
      paidAt: null,
      paymentMethod: obligation.paymentMethod || "",
      provider: obligation.provider || "",
      priority: obligation.priority || "Normal",
      status: "pending",
      receiptUrl: "",
      notes: obligation.notes || "",
      receiptRequired: !!obligation.receiptRequired,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: user?.email || "",
      updatedBy: user?.email || ""
    });
    created += 1;
  }

  return { created, existing };
}

export async function markPaymentPaid(id, payload, user) {
  await updateDoc(doc(db, COLLECTION, id), {
    paidValue: Number(payload.paidValue || 0),
    paidAt: payload.paidAt || todayISO(),
    paymentMethod: payload.paymentMethod || "",
    receiptUrl: payload.receiptUrl || "",
    notes: payload.notes || "",
    status: "paid",
    updatedAt: serverTimestamp(),
    updatedBy: user?.email || ""
  });
}

export async function updatePayment(id, payload, user) {
  await updateDoc(doc(db, COLLECTION, id), {
    ...payload,
    updatedAt: serverTimestamp(),
    updatedBy: user?.email || ""
  });
}

export function computePaymentStatus(payment, refDate = new Date()) {
  if (payment.status === "paid" || payment.paidAt) return "paid";
  if (payment.status === "scheduled") return "scheduled";
  if (payment.status === "not_applicable") return "not_applicable";

  const due = parseLocalDate(payment.dueDate);
  if (!due) return "pending";

  const diff = daysBetween(stripTime(refDate), stripTime(due));
  if (diff < 0) return "overdue";
  if (diff <= 2) return "urgent";
  if (diff <= 5) return "upcoming";
  return "pending";
}

export function withComputedStatus(payment) {
  return { ...payment, computedStatus: computePaymentStatus(payment) };
}

export function buildKpis(payments) {
  const open = payments.filter((p) => !["paid", "not_applicable"].includes(p.computedStatus));
  const totalEstimated = payments
    .filter((p) => p.computedStatus !== "not_applicable")
    .reduce((sum, p) => sum + Number(p.estimatedValue || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.paidValue || 0), 0);

  return {
    totalEstimated,
    totalPaid,
    pendingAmount: Math.max(totalEstimated - totalPaid, 0),
    overdue: open.filter((p) => p.computedStatus === "overdue").length,
    urgent: open.filter((p) => p.computedStatus === "urgent").length,
    upcoming: open.filter((p) => p.computedStatus === "upcoming").length
  };
}

function buildDueDate(year, month, day) {
  const last = new Date(Number(year), Number(month), 0).getDate();
  const safeDay = Math.min(Math.max(Number(day || 1), 1), last);
  return `${year}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

function parseLocalDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(from, to) {
  return Math.round((to - from) / 86400000);
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
