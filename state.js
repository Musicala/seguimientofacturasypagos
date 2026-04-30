export const state = {
  user: null,
  profile: null,
  authorized: false,
  selectedYear: new Date().getFullYear(),
  selectedMonth: new Date().getMonth() + 1,
  payments: [],
  obligations: [],
  filters: {
    search: "",
    status: "",
    category: "",
    responsible: "",
    active: ""
  }
};

export function canEdit() {
  return ["admin", "editor"].includes(state.profile?.role);
}

export function isAdmin() {
  return state.profile?.role === "admin";
}
