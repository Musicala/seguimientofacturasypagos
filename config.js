export const APP_CONFIG = {
  appName: "Seguimiento de Pagos Musicala",
  locale: "es-CO",
  currency: "COP",
  timezone: "America/Bogota",
  allowedEmails: [
    "alekcaballeromusic@gmail.com",
    "catalina.medina.leal@gmail.com",
    "musicalaasesor@gmail.com"
  ],
  defaultRole: "viewer",
  firebase: {
    apiKey: "AIzaSyBCJY5Hj5Zu2xiDavwDLGezS1lD5S5GIfg",
    authDomain: "seguimiento-pagos-y-facturas.firebaseapp.com",
    projectId: "seguimiento-pagos-y-facturas",
    storageBucket: "seguimiento-pagos-y-facturas.firebasestorage.app",
    messagingSenderId: "50552409806",
    appId: "1:50552409806:web:f1897076748768f31aca9f"
  },
  months: [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ],
  categories: [
    "Servicios publicos",
    "Arriendo",
    "Plataformas",
    "Nomina y seguridad social",
    "Impuestos",
    "Proveedores",
    "Creditos",
    "Mantenimiento",
    "Administrativo",
    "Otro"
  ],
  priorities: ["Alta", "Media", "Normal"],
  paymentMethods: [
    "Transferencia",
    "PSE",
    "Tarjeta",
    "Efectivo",
    "Debito automatico",
    "Otro"
  ],
  statusLabels: {
    pending: "Pendiente",
    upcoming: "Proximo",
    urgent: "Urgente",
    overdue: "Vencido",
    scheduled: "Programado",
    paid: "Pagado",
    not_applicable: "No aplica"
  }
};
