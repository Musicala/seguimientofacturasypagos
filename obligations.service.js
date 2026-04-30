import {
  collection,
  deleteField,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "./firebase.service.js";

const COLLECTION = "obligations";

export async function listObligations() {
  const snap = await getDocs(query(collection(db, COLLECTION), orderBy("name")));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function saveObligation(payload, user) {
  const id = payload.id || slugify(payload.name);
  const ref = doc(db, COLLECTION, id);
  const now = serverTimestamp();
  const clean = {
    name: payload.name.trim(),
    category: payload.category || "",
    responsible: payload.responsible || "",
    frequency: payload.frequency || "monthly",
    dueDay: Number(payload.dueDay || 1),
    monthsApply: normalizeMonths(payload.monthsApply),
    estimatedValue: Number(payload.estimatedValue || 0),
    paymentMethod: payload.paymentMethod || "",
    provider: payload.provider || "",
    priority: payload.priority || "Normal",
    active: payload.active !== false,
    receiptRequired: true,
    notes: payload.notes || "",
    updatedAt: now,
    updatedBy: user?.email || ""
  };

  if (!payload.id) {
    clean.createdAt = now;
    clean.createdBy = user?.email || "";
  }

  await setDoc(ref, clean, { merge: true });
  return { id, ...clean };
}

export async function setObligationActive(id, active, user) {
  await updateDoc(doc(db, COLLECTION, id), {
    active: !!active,
    updatedAt: serverTimestamp(),
    updatedBy: user?.email || "",
    deletedAt: deleteField()
  });
}

export function appliesToMonth(obligation, month) {
  if (!obligation.active) return false;
  const months = normalizeMonths(obligation.monthsApply);
  return !months.length || months.includes(Number(month));
}

function normalizeMonths(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(Number).filter((n) => n >= 1 && n <= 12);
  return String(value)
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((n) => n >= 1 && n <= 12);
}

function slugify(value) {
  return String(value || "obligacion")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
