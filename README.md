# Seguimiento de Pagos Musicala

Radar mensual de pagos y obligaciones para Musicala. Es una app estatica en HTML, CSS y JavaScript vanilla, pensada para GitHub Pages y Firebase.

## Arquitectura

- Frontend estatico: `index.html`, `obligaciones.html`, `styles.css`.
- JavaScript modular: `app.js`, `obligations.js`, `firebase.service.js`, `payments.service.js`, `obligations.service.js`, `state.js`, `config.js`.
- Firebase Auth con Google.
- Cloud Firestore como unica base de datos.
- Apps Script solo para alertas automaticas por correo, consultando Firestore directamente.
- Sin Google Sheets, sin backend propio, sin React, sin Tailwind, sin Vite.

## Modelo Firestore

### obligations

Guarda obligaciones recurrentes.

Campos:

- `name`
- `category`
- `responsible`
- `frequency`
- `dueDay`
- `monthsApply`
- `estimatedValue`
- `paymentMethod`
- `provider`
- `priority`
- `active`
- `receiptRequired`
- `notes`
- `createdAt`
- `updatedAt`
- `createdBy`
- `updatedBy`

### monthlyPayments

Guarda pagos generados para un periodo. El id es `YYYY-MM_obligationId`.

Campos:

- `obligationId`
- `period`
- `year`
- `month`
- `name`
- `category`
- `responsible`
- `dueDate`
- `estimatedValue`
- `paidValue`
- `paidAt`
- `paymentMethod`
- `provider`
- `priority`
- `status`
- `receiptUrl`
- `notes`
- `receiptRequired`
- `createdAt`
- `updatedAt`
- `createdBy`
- `updatedBy`

### notificationLogs

Guarda el historial diario de alertas automaticas para evitar correos duplicados.

Campos:

- `type`
- `date`
- `windowDays`
- `sentAt`
- `sent`
- `count`
- `recipients`
- `paymentIds`

### users

Guarda usuarios autorizados.

Campos:

- `uid`
- `email`
- `name`
- `role`
- `active`
- `createdAt`
- `updatedAt`

Roles:

- `admin`: puede todo.
- `editor`: puede crear y editar obligaciones y pagos.
- `viewer`: solo lectura.

## Estados

La funcion central esta en `payments.service.js` como `computePaymentStatus`.

- `pending`: Pendiente
- `upcoming`: Proximo
- `urgent`: Urgente
- `overdue`: Vencido
- `scheduled`: Programado
- `paid`: Pagado
- `not_applicable`: No aplica

Reglas:

- Si `status` es `paid` o existe `paidAt`: Pagado.
- Si `status` es `scheduled`: Programado.
- Si `status` es `not_applicable`: No aplica.
- Si `dueDate` ya paso y no esta pagado: Vencido.
- Si vence hoy o en maximo 2 dias: Urgente.
- Si vence en maximo 5 dias: Proximo.
- En otro caso: Pendiente.

## Configurar Firebase

1. Crear o abrir el proyecto Firebase `seguimiento-pagos-y-facturas`.
2. En Authentication, activar proveedor Google.
3. En Firestore Database, crear la base en modo produccion.
4. Publicar las reglas de `firebase.rules`.
5. Confirmar que `config.js` tenga los datos del proyecto Firebase.

## Usuarios autorizados

La app trae una whitelist inicial en `config.js`:

- `alekcaballeromusic@gmail.com`
- `catalina.medina.leal@gmail.com`
- `musicalaasesor@gmail.com`

En el primer ingreso, si el correo esta en la whitelist, la app crea su documento en `users`.

Para administrar roles, editar o crear documentos en `users/{uid}` con:

```json
{
  "email": "correo@dominio.com",
  "name": "Nombre",
  "role": "editor",
  "active": true
}
```

## Desplegar en GitHub Pages

1. Subir estos archivos al repositorio.
2. En GitHub, abrir Settings > Pages.
3. Seleccionar la rama y carpeta donde esta `index.html`.
4. Guardar.
5. En Firebase Authentication > Settings > Authorized domains, agregar el dominio de GitHub Pages.

## Alertas automaticas con Apps Script

Las alertas por correo viven en `apps-script/codigo.gs`. No dependen de que alguien abra la app: Apps Script corre con un disparador diario, consulta Firestore con una cuenta de servicio, crea los `monthlyPayments` faltantes para la ventana de vencimiento y envia correo si hay pagos pendientes que vencen hoy o manana.

El boton del frontend `Probar alerta manual` queda solo como prueba. La alerta real es `runDailyPaymentAlerts()`.

### Crear cuenta de servicio

1. En Google Cloud Console, abrir el proyecto Firebase.
2. Ir a IAM & Admin > Service Accounts.
3. Crear una cuenta de servicio para alertas, por ejemplo `payments-alerts`.
4. Darle permisos minimos para Firestore:
   - `Cloud Datastore User` suele ser suficiente para leer y escribir documentos.
   - Si la organizacion restringe permisos, usar un rol personalizado con lectura/escritura en Datastore/Firestore.
5. Crear una key JSON para esa cuenta.
6. No subir ese JSON al repositorio.

### Configurar Script Properties

En Apps Script, abrir Project Settings > Script Properties y crear:

```txt
FIREBASE_PROJECT_ID=seguimiento-pagos-y-facturas
FIREBASE_CLIENT_EMAIL=correo-de-la-cuenta@proyecto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
ALERT_RECIPIENTS=imusicala@gmail.com
ALERT_DUE_WINDOW_DAYS=1
ALERT_TIMEZONE=America/Bogota
PAYMENTS_NOTIFY_TOKEN=un-token-opcional-para-pruebas-manuales
```

`FIREBASE_PRIVATE_KEY` puede pegarse con `\n`; el script lo normaliza antes de firmar el JWT.

### Publicar y programar

1. Copiar `apps-script/codigo.gs` en el editor de Apps Script.
2. Guardar.
3. Ejecutar `testDailyPaymentAlerts()` desde Apps Script para probar permisos y envio.
4. Autorizar los permisos de Apps Script cuando Google lo pida.
5. Ejecutar `setupDailyPaymentAlertTrigger()` una vez.
6. Confirmar en Triggers que exista un disparador diario para `runDailyPaymentAlerts()`.

Funciones utiles:

- `runDailyPaymentAlerts()`: ejecucion automatica diaria. Respeta `notificationLogs` y no duplica correos del mismo dia.
- `testDailyPaymentAlerts()`: prueba manual. No bloquea por log duplicado.
- `setupDailyPaymentAlertTrigger()`: elimina triggers anteriores de esta alerta y crea uno diario a las 8 a. m. en `America/Bogota`.
- `removePaymentAlertTriggers()`: elimina triggers de `runDailyPaymentAlerts()`.

### Seguridad

- No poner `FIREBASE_PRIVATE_KEY` ni credenciales privadas en `config.js`.
- No subir JSON de cuenta de servicio al repositorio.
- `config.js` solo puede contener la URL publica del Apps Script para pruebas manuales. La alerta automatica no usa secretos del frontend.
- La cuenta de servicio accede por Google Cloud IAM, no por las reglas de cliente de `firebase.rules`.

## Pruebas minimas

1. Abrir `index.html` desde GitHub Pages.
2. Iniciar sesion con Google usando un correo autorizado.
3. Intentar iniciar sesion con un correo no autorizado y confirmar bloqueo.
4. Ir a `obligaciones.html`.
5. Crear una obligacion.
6. Editarla.
7. Inactivarla y activarla.
8. Volver al dashboard.
9. Generar pagos del mes.
10. Generar pagos otra vez y confirmar que no duplica.
11. Registrar un pago.
12. Marcar otro como programado.
13. Marcar otro como no aplica.
14. Reabrir un pago.
15. Cambiar de mes.
16. Confirmar KPIs y alertas de vencidos, urgentes y proximos.
17. En Apps Script, ejecutar `testDailyPaymentAlerts()` y revisar el registro de ejecucion.
18. Confirmar que se cree o actualice un documento en `notificationLogs` al ejecutar `runDailyPaymentAlerts()`.

## Diagnostico de migracion

`Pago Facturas AC` sirvio como referencia por su flujo directo: estados simples, filtros visibles, KPIs y registro rapido de pago. Su `codigo.gs` no se migro porque depende de Sheets.

El proyecto antiguo de Musicala ya tenia una intencion visual y pantallas separadas para dashboard y obligaciones, pero conservaba una capa `services.api.js` hacia Apps Script, textos con encoding roto, ruta incorrecta del logo (`logo.png`) y duplicacion de calculos/render. Esa capa fue reemplazada por Firebase y los archivos no usados fueron eliminados.
