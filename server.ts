import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import {
  db,
  getSettings,
  saveSettings,
  listDoctors,
  listTreatments,
  listGallery,
  listTestimonials,
  listFaqs,
  listBlockedDates,
  listAppointments,
  listEnquiries,
  mapAppointment,
  verifyPassword,
  hashPassword,
} from './src/server/db.ts';
import {
  requireAdmin,
  extractAdminFromRequest,
  signAdminToken,
  SESSION_COOKIE_NAME,
} from './src/server/auth.ts';
import type { AdminRequest } from './src/server/auth.ts';
import {
  getAvailableSlotsForDate,
  createBookingAtomically,
  rescheduleAppointmentAtomically,
  dispatchBookingNotifications,
  getIntegrationStatus,
} from './src/server/booking.ts';
import {
  checkSupabaseHealth,
  getSupabaseBusySlots,
  listAppointmentsFromSupabase,
  listEnquiriesFromSupabase,
  syncAppointmentToSupabase,
  updateAppointmentInSupabase,
  deleteAppointmentInSupabase,
  syncEnquiryToSupabase,
} from './src/server/supabase.ts';

const PORT = 3000;
const app = express();

app.use(express.json({ limit: '8mb' }));

// Simple in-memory rate limiter for public write endpoints (spam protection)
const rateMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const entry = rateMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= maxPerMinute) return false;
  entry.count += 1;
  return true;
}

// ---------- SEO Routes ----------
app.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${baseUrl}/sitemap.xml\n`,
  );
});

app.get('/sitemap.xml', (req, res) => {
  const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const treatments = listTreatments(true);
  const staticPaths = ['/', '/treatments', '/book', '/gallery', '/contact', '/privacy-policy', '/terms-and-conditions'];
  const urls = [
    ...staticPaths.map((p) => `${baseUrl}${p}`),
    ...treatments.map((t) => `${baseUrl}/treatments/${t.slug}`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc><changefreq>weekly</changefreq></url>`).join('\n')}
</urlset>`;
  res.type('application/xml').send(xml);
});

// ---------- Public Read APIs ----------
app.get('/api/bootstrap', (_req, res) => {
  try {
    res.json({
      settings: getSettings(),
      doctors: listDoctors(true),
      treatments: listTreatments(true),
      gallery: listGallery(),
      testimonials: listTestimonials(true),
      faqs: listFaqs(true),
      integrations: getIntegrationStatus(),
    });
  } catch (err) {
    console.error('Bootstrap error:', err);
    res.status(500).json({ error: 'Unable to load clinic data.' });
  }
});

app.get('/api/availability', async (req, res) => {
  const date = String(req.query.date || '');
  const doctorId = Number(req.query.doctorId || 1);
  const treatmentId = Number(req.query.treatmentId || 0);
  let duration: number | undefined;
  if (treatmentId > 0) {
    const tr = listTreatments(true).find((t) => t.id === treatmentId);
    if (tr) duration = tr.durationMinutes;
  }
  const externalBusy = await getSupabaseBusySlots(date, doctorId);
  const result = getAvailableSlotsForDate(date, doctorId, duration, undefined, externalBusy);
  res.json(result);
});

// Public appointment status lookup requires BOTH referenceCode and last 4 phone digits (never exposes bulk patient data)
app.get('/api/appointments/lookup', (req, res) => {
  const ref = String(req.query.ref || '').trim().toUpperCase();
  const phoneLast4 = String(req.query.last4 || '').trim();
  if (!ref || !/^\d{4}$/.test(phoneLast4)) {
    res.status(400).json({ error: 'Provide booking reference and last 4 digits of mobile number.' });
    return;
  }
  const row = db.prepare('SELECT * FROM appointments WHERE reference_code = ?').get(ref) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }
  const appt = mapAppointment(row);
  const digits = appt.patientPhone.replace(/[^\d]/g, '');
  if (!digits.endsWith(phoneLast4)) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }
  res.json({
    referenceCode: appt.referenceCode,
    treatmentTitle: appt.treatmentTitle,
    doctorName: appt.doctorName,
    appointmentDate: appt.appointmentDate,
    appointmentTime: appt.appointmentTime,
    durationMinutes: appt.durationMinutes,
    status: appt.status,
    paymentStatus: appt.paymentStatus,
  });
});

// ---------- Public Booking & Payment APIs ----------
app.post('/api/payments/razorpay/order', async (req, res) => {
  const settings = getSettings();
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  if (!settings.razorpayEnabled || !keyId || !keySecret) {
    res.status(400).json({ error: 'Online Razorpay payments are not enabled or configured.' });
    return;
  }
  const treatmentId = Number(req.body?.treatmentId || 0);
  const tr = listTreatments(true).find((t) => t.id === treatmentId);
  const amountInr = tr?.consultationFeeInr || settings.defaultConsultationFeeInr || 500;
  const amountPaise = Math.max(100, Math.round(amountInr * 100));

  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const resp = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: `raghan_${Date.now()}`,
      }),
    });
    const data = (await resp.json()) as Record<string, unknown>;
    if (!resp.ok) {
      res.status(502).json({ error: 'Could not initialize payment order with Razorpay.' });
      return;
    }
    res.json({ orderId: data.id, amountPaise, keyId });
  } catch (err) {
    console.error('Razorpay order creation failed:', err);
    res.status(500).json({ error: 'Payment gateway connection error.' });
  }
});

app.post('/api/appointments', async (req, res) => {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(`book:${ip}`, 12)) {
    res.status(429).json({ error: 'Too many booking attempts. Please wait a minute and try again.' });
    return;
  }
  // Honeypot check
  if (req.body?.websiteUrl) {
    res.status(400).json({ error: 'Invalid submission.' });
    return;
  }

  const result = createBookingAtomically({
    treatmentId: Number(req.body?.treatmentId),
    doctorId: Number(req.body?.doctorId),
    appointmentDate: String(req.body?.appointmentDate || ''),
    appointmentTime: String(req.body?.appointmentTime || ''),
    patientName: String(req.body?.patientName || ''),
    patientPhone: String(req.body?.patientPhone || ''),
    patientEmail: String(req.body?.patientEmail || ''),
    patientType: req.body?.patientType === 'returning' ? 'returning' : 'first-time',
    notes: String(req.body?.notes || ''),
    paymentMode: req.body?.paymentMode === 'razorpay' ? 'razorpay' : 'clinic',
    razorpayOrderId: req.body?.razorpayOrderId ? String(req.body.razorpayOrderId) : undefined,
    razorpayPaymentId: req.body?.razorpayPaymentId ? String(req.body.razorpayPaymentId) : undefined,
    razorpaySignature: req.body?.razorpaySignature ? String(req.body.razorpaySignature) : undefined,
  });

  if (!result.ok || !result.appointment) {
    res.status(result.statusCode).json({ error: result.error });
    return;
  }

  const supaRes = await syncAppointmentToSupabase(result.appointment);
  if (supaRes.conflict) {
    db.prepare('DELETE FROM appointments WHERE id = ?').run(result.appointment.id);
    res.status(409).json({
      error: 'This appointment slot was already reserved in Supabase. Please choose another time slot.',
    });
    return;
  }

  const logs = await dispatchBookingNotifications(
    result.appointment,
    result.appointment.status === 'Confirmed' ? 'confirmed' : 'created',
  );
  logs.unshift({
    channel: 'Supabase Database',
    status: supaRes.synced ? 'synced' : 'pending_setup',
    timestamp: new Date().toISOString(),
    detail: supaRes.synced
      ? 'Saved to public.appointments in Supabase'
      : supaRes.error || 'Supabase table pending creation',
  });

  db.prepare('UPDATE appointments SET notification_log_json = ? WHERE id = ?').run(
    JSON.stringify(logs),
    result.appointment.id,
  );
  result.appointment.notificationLog = logs;

  res.status(201).json({ appointment: result.appointment });
});

app.post('/api/enquiries', async (req, res) => {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(`enq:${ip}`, 10)) {
    res.status(429).json({ error: 'Too many enquiries sent. Please try again shortly.' });
    return;
  }
  if (req.body?.websiteUrl) {
    res.status(400).json({ error: 'Invalid submission.' });
    return;
  }
  const name = String(req.body?.name || '').trim();
  const phone = String(req.body?.phone || '').trim();
  const email = String(req.body?.email || '').trim();
  const subject = String(req.body?.subject || 'General Enquiry').trim();
  const message = String(req.body?.message || '').trim();

  if (name.length < 2 || phone.replace(/[^\d]/g, '').length < 10 || message.length < 5) {
    res.status(400).json({ error: 'Please fill in your name, a valid 10-digit phone number, and your message.' });
    return;
  }

  const info = db
    .prepare('INSERT INTO enquiries (name, phone, email, subject, message) VALUES (?, ?, ?, ?, ?)')
    .run(name, phone, email, subject, message);
  const supaEnq = await syncEnquiryToSupabase({ name, phone, email, subject, message });
  res.status(201).json({ id: Number(info.lastInsertRowid), ok: true, supabaseSynced: supaEnq.synced });
});

// ---------- Admin Authentication Routes ----------
app.post('/api/admin/login', (req, res) => {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(`login:${ip}`, 15)) {
    res.status(429).json({ error: 'Too many sign-in attempts. Please wait a minute.' });
    return;
  }
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  const user = db.prepare('SELECT * FROM admin_users WHERE email = ?').get(email) as
    | { id: number; email: string; name: string; password_hash: string; role: string }
    | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const token = signAdminToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 12,
    path: '/',
  });

  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

app.post('/api/admin/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/admin/me', (req, res) => {
  const admin = extractAdminFromRequest(req);
  if (!admin) {
    res.status(401).json({ authenticated: false });
    return;
  }
  res.json({ authenticated: true, user: admin });
});

// ---------- Protected Admin Dashboard APIs ----------
app.get('/api/admin/dashboard', requireAdmin, async (_req: AdminRequest, res) => {
  const supaHealth = await checkSupabaseHealth();
  const baseIntegrations = getIntegrationStatus();

  // Pull any appointments stored in Supabase and merge/upsert into local SQLite so all bookings appear uniformly
  const supaAppts = await listAppointmentsFromSupabase();
  if (supaAppts.rows.length > 0) {
    const localByRef = new Map(listAppointments().map((a) => [a.referenceCode, a]));
    const fallbackTreatmentId = listTreatments(false)[0]?.id || 1;
    const fallbackDoctorId = listDoctors(false)[0]?.id || 1;
    for (const sa of supaAppts.rows) {
      const local = localByRef.get(sa.referenceCode);
      if (!local) {
        try {
          db.prepare(
            `INSERT INTO appointments (
              reference_code, treatment_id, treatment_title, doctor_id, doctor_name,
              appointment_date, appointment_time, duration_minutes,
              patient_name, patient_phone, patient_email, patient_type, notes,
              status, payment_status, payment_amount_inr, razorpay_order_id, razorpay_payment_id,
              notification_log_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            sa.referenceCode,
            sa.treatmentId || fallbackTreatmentId,
            sa.treatmentTitle,
            sa.doctorId || fallbackDoctorId,
            sa.doctorName,
            sa.appointmentDate,
            sa.appointmentTime,
            sa.durationMinutes,
            sa.patientName,
            sa.patientPhone,
            sa.patientEmail,
            sa.patientType,
            sa.notes,
            sa.status,
            sa.paymentStatus,
            sa.paymentAmountInr,
            sa.razorpayOrderId,
            sa.razorpayPaymentId,
            JSON.stringify(sa.notificationLog),
          );
        } catch {
          // ignore duplicate/constraint edge cases
        }
      } else if (
        sa.updatedAt &&
        local.updatedAt &&
        new Date(sa.updatedAt).getTime() > new Date(local.updatedAt + (local.updatedAt.endsWith('Z') ? '' : 'Z')).getTime() + 2000
      ) {
        try {
          db.prepare(
            `UPDATE appointments SET
              treatment_id = ?, treatment_title = ?, doctor_id = ?, doctor_name = ?,
              appointment_date = ?, appointment_time = ?, duration_minutes = ?,
              patient_name = ?, patient_phone = ?, patient_email = ?, patient_type = ?,
              notes = ?, status = ?, payment_status = ?, payment_amount_inr = ?,
              updated_at = ?
             WHERE id = ?`,
          ).run(
            sa.treatmentId || local.treatmentId,
            sa.treatmentTitle || local.treatmentTitle,
            sa.doctorId || local.doctorId,
            sa.doctorName || local.doctorName,
            sa.appointmentDate,
            sa.appointmentTime,
            sa.durationMinutes,
            sa.patientName,
            sa.patientPhone,
            sa.patientEmail,
            sa.patientType,
            sa.notes,
            sa.status,
            sa.paymentStatus,
            sa.paymentAmountInr,
            sa.updatedAt,
            local.id,
          );
        } catch {
          // ignore slot conflict edge cases on background sync
        }
      }
    }
  }

  // Merge Supabase contact enquiries if any exist
  const supaEnquiries = await listEnquiriesFromSupabase();
  if (supaEnquiries.length > 0) {
    const existingKeys = new Set(
      listEnquiries().map((e) => `${e.phone}|${e.message.slice(0, 40)}`),
    );
    for (const se of supaEnquiries) {
      const key = `${se.phone}|${se.message.slice(0, 40)}`;
      if (!existingKeys.has(key)) {
        db.prepare('INSERT INTO enquiries (name, phone, email, subject, message, status) VALUES (?, ?, ?, ?, ?, ?)').run(
          se.name,
          se.phone,
          se.email,
          se.subject,
          se.message,
          se.status,
        );
      }
    }
  }

  res.json({
    settings: getSettings(),
    appointments: listAppointments(),
    treatments: listTreatments(false),
    doctors: listDoctors(false),
    blockedDates: listBlockedDates(),
    gallery: listGallery(),
    testimonials: listTestimonials(false),
    faqs: listFaqs(false),
    enquiries: listEnquiries(),
    integrations: {
      ...baseIntegrations,
      supabaseConfigured: supaHealth.configured,
      supabaseSecretConfigured: supaHealth.secretConfigured,
      supabaseProjectUrl: supaHealth.projectUrl,
      supabaseAppointmentsTableReady: supaHealth.appointmentsTableReady,
      supabaseStatusMessage: supaHealth.statusMessage,
    },
  });
});

app.get('/api/admin/supabase-schema', requireAdmin, (_req: AdminRequest, res) => {
  const schemaPath = path.resolve(process.cwd(), 'supabase', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    res.status(404).json({ error: 'Schema file not found.' });
    return;
  }
  res.json({ sql: fs.readFileSync(schemaPath, 'utf8') });
});

app.patch('/api/admin/appointments/:id', requireAdmin, async (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }
  const allowedStatuses = ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'Rescheduled', 'No-show'];
  const status = req.body?.status ? String(req.body.status) : undefined;
  const paymentStatus = req.body?.paymentStatus ? String(req.body.paymentStatus) : undefined;

  if (status && !allowedStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid appointment status.' });
    return;
  }

  try {
    if (status) {
      db.prepare("UPDATE appointments SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
    }
    if (paymentStatus) {
      db.prepare("UPDATE appointments SET payment_status = ?, updated_at = datetime('now') WHERE id = ?").run(
        paymentStatus,
        id,
      );
    }
    const updatedRow = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as Record<string, unknown>;
    const appt = mapAppointment(updatedRow);
    const supaUpdate = await updateAppointmentInSupabase(appt.referenceCode, {
      ...(status ? { status } : {}),
      ...(paymentStatus ? { payment_status: paymentStatus } : {}),
    });
    if (status === 'Confirmed' || status === 'Cancelled') {
      const logs = await dispatchBookingNotifications(
        appt,
        status === 'Confirmed' ? 'confirmed' : 'cancelled',
      );
      const merged = [...appt.notificationLog, ...logs];
      db.prepare('UPDATE appointments SET notification_log_json = ? WHERE id = ?').run(
        JSON.stringify(merged),
        id,
      );
      appt.notificationLog = merged;
    }
    res.json({ appointment: appt, supabaseSynced: supaUpdate.synced, supabaseError: supaUpdate.error });
  } catch (err) {
    console.error('Update appointment error:', err);
    res.status(409).json({ error: 'Could not update status due to a slot conflict.' });
  }
});

app.post('/api/admin/appointments', requireAdmin, async (req: AdminRequest, res) => {
  const result = createBookingAtomically({
    treatmentId: Number(req.body?.treatmentId),
    doctorId: Number(req.body?.doctorId),
    appointmentDate: String(req.body?.appointmentDate || ''),
    appointmentTime: String(req.body?.appointmentTime || ''),
    patientName: String(req.body?.patientName || ''),
    patientPhone: String(req.body?.patientPhone || ''),
    patientEmail: String(req.body?.patientEmail || ''),
    patientType: req.body?.patientType === 'returning' ? 'returning' : 'first-time',
    notes: String(req.body?.notes || ''),
    paymentMode: 'clinic',
  });
  if (!result.ok || !result.appointment) {
    res.status(result.statusCode).json({ error: result.error });
    return;
  }
  if (req.body?.status && ['Pending', 'Confirmed', 'Completed', 'Cancelled'].includes(String(req.body.status))) {
    db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(String(req.body.status), result.appointment.id);
    result.appointment.status = String(req.body.status) as typeof result.appointment.status;
  }
  const supaRes = await syncAppointmentToSupabase(result.appointment);
  const logs = [
    {
      channel: 'Supabase Database',
      status: supaRes.synced ? 'synced' : 'pending_setup',
      timestamp: new Date().toISOString(),
      detail: supaRes.synced
        ? 'Saved to public.appointments in Supabase'
        : supaRes.error || 'Supabase sync pending',
    },
  ];
  db.prepare('UPDATE appointments SET notification_log_json = ? WHERE id = ?').run(
    JSON.stringify(logs),
    result.appointment.id,
  );
  result.appointment.notificationLog = logs;
  res.status(201).json({ appointment: result.appointment, supabaseSynced: supaRes.synced, supabaseError: supaRes.error });
});

app.put('/api/admin/appointments/:id', requireAdmin, async (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  const existingRow = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!existingRow) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }
  const existing = mapAppointment(existingRow);

  const treatmentId = Number(req.body?.treatmentId || existing.treatmentId);
  const doctorId = Number(req.body?.doctorId || existing.doctorId);
  const treatment = listTreatments(false).find((t) => t.id === treatmentId);
  const doctor = listDoctors(false).find((d) => d.id === doctorId);
  if (!treatment || !doctor) {
    res.status(400).json({ error: 'Invalid treatment or dentist selected.' });
    return;
  }

  const appointmentDate = String(req.body?.appointmentDate || existing.appointmentDate);
  const appointmentTime = String(req.body?.appointmentTime || existing.appointmentTime);
  const patientName = String(req.body?.patientName ?? existing.patientName).trim();
  const patientPhone = String(req.body?.patientPhone ?? existing.patientPhone).trim();
  const patientEmail = String(req.body?.patientEmail ?? existing.patientEmail).trim();
  const patientType = req.body?.patientType === 'returning' ? 'returning' : 'first-time';
  const notes = String(req.body?.notes ?? existing.notes).trim();
  const status = String(req.body?.status || existing.status);
  const paymentStatus = String(req.body?.paymentStatus || existing.paymentStatus);
  const paymentAmountInr = Number(req.body?.paymentAmountInr ?? existing.paymentAmountInr);

  if (patientName.length < 2 || patientPhone.replace(/[^\d]/g, '').length < 10) {
    res.status(400).json({ error: 'Valid patient name and 10-digit phone number are required.' });
    return;
  }

  const slotChanged =
    appointmentDate !== existing.appointmentDate ||
    appointmentTime !== existing.appointmentTime ||
    doctorId !== existing.doctorId;

  if (slotChanged && status !== 'Cancelled' && status !== 'Rescheduled') {
    const conflict = db
      .prepare(
        `SELECT id FROM appointments
         WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ?
           AND id != ? AND status NOT IN ('Cancelled', 'Rescheduled')`,
      )
      .get(doctorId, appointmentDate, appointmentTime, id);
    if (conflict) {
      res.status(409).json({ error: 'Another active appointment already exists for this dentist and slot.' });
      return;
    }
  }

  try {
    db.prepare(
      `UPDATE appointments SET
        treatment_id = ?, treatment_title = ?, doctor_id = ?, doctor_name = ?,
        appointment_date = ?, appointment_time = ?, duration_minutes = ?,
        patient_name = ?, patient_phone = ?, patient_email = ?, patient_type = ?,
        notes = ?, status = ?, payment_status = ?, payment_amount_inr = ?,
        updated_at = datetime('now')
       WHERE id = ?`,
    ).run(
      treatment.id,
      treatment.title,
      doctor.id,
      doctor.name,
      appointmentDate,
      appointmentTime,
      treatment.durationMinutes,
      patientName,
      patientPhone,
      patientEmail,
      patientType,
      notes,
      status,
      paymentStatus,
      paymentAmountInr,
      id,
    );

    const updatedRow = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as Record<string, unknown>;
    const appt = mapAppointment(updatedRow);
    const supaRes = await updateAppointmentInSupabase(appt.referenceCode, {
      treatment_id: appt.treatmentId,
      treatment_title: appt.treatmentTitle,
      doctor_id: appt.doctorId,
      doctor_name: appt.doctorName,
      duration_minutes: appt.durationMinutes,
      appointment_date: appt.appointmentDate,
      appointment_time: appt.appointmentTime,
      patient_name: appt.patientName,
      patient_phone: appt.patientPhone,
      patient_email: appt.patientEmail,
      patient_type: appt.patientType,
      notes: appt.notes,
      status: appt.status,
      payment_status: appt.paymentStatus,
      payment_amount_inr: appt.paymentAmountInr,
    });
    res.json({ appointment: appt, supabaseSynced: supaRes.synced, supabaseError: supaRes.error });
  } catch (err) {
    console.error('Full appointment update error:', err);
    res.status(409).json({ error: 'Unable to update appointment due to a slot conflict.' });
  }
});

app.delete('/api/admin/appointments/:id', requireAdmin, async (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  const existingRow = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!existingRow) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }
  const appt = mapAppointment(existingRow);
  db.prepare('DELETE FROM appointments WHERE id = ?').run(id);
  const supaDel = await deleteAppointmentInSupabase(appt.referenceCode);
  res.json({ ok: true, supabaseSynced: supaDel.synced, supabaseError: supaDel.error });
});

app.post('/api/admin/appointments/:id/reschedule', requireAdmin, async (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  const newDate = String(req.body?.appointmentDate || '');
  const newTime = String(req.body?.appointmentTime || '');
  const result = rescheduleAppointmentAtomically(id, newDate, newTime);
  if (!result.ok || !result.appointment) {
    res.status(result.statusCode).json({ error: result.error });
    return;
  }
  const supaRes = await updateAppointmentInSupabase(result.appointment.referenceCode, {
    appointment_date: newDate,
    appointment_time: newTime,
    status: 'Rescheduled',
  });
  const logs = await dispatchBookingNotifications(result.appointment, 'rescheduled');
  const merged = [...result.appointment.notificationLog, ...logs];
  db.prepare('UPDATE appointments SET notification_log_json = ? WHERE id = ?').run(
    JSON.stringify(merged),
    id,
  );
  result.appointment.notificationLog = merged;
  res.json({ appointment: result.appointment, supabaseSynced: supaRes.synced, supabaseError: supaRes.error });
});

app.put('/api/admin/settings', requireAdmin, (req: AdminRequest, res) => {
  const updated = saveSettings(req.body || {});
  res.json({ settings: updated });
});

app.post('/api/admin/password', requireAdmin, (req: AdminRequest, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters.' });
    return;
  }
  const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.adminUser!.userId) as
    | { id: number; password_hash: string }
    | undefined;
  if (!user || !verifyPassword(currentPassword, user.password_hash)) {
    res.status(401).json({ error: 'Current password is incorrect.' });
    return;
  }
  db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(
    hashPassword(newPassword),
    user.id,
  );
  res.json({ ok: true });
});

// Treatments CRUD
app.post('/api/admin/treatments', requireAdmin, (req: AdminRequest, res) => {
  const t = req.body || {};
  const title = String(t.title || '').trim();
  if (!title) {
    res.status(400).json({ error: 'Treatment title is required.' });
    return;
  }
  const slug =
    String(t.slug || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-') ||
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  try {
    const info = db
      .prepare(
        `INSERT INTO treatments (
          slug, title, category, short_description, introduction, what_it_involves,
          when_needed, procedure_overview, faqs_json, image_url, duration_minutes,
          consultation_fee_inr, is_confirmed_available, is_active, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        slug,
        title,
        String(t.category || 'General Dentistry'),
        String(t.shortDescription || ''),
        String(t.introduction || ''),
        String(t.whatItInvolves || ''),
        String(t.whenNeeded || ''),
        String(t.procedureOverview || ''),
        JSON.stringify(Array.isArray(t.faqs) ? t.faqs : []),
        String(t.imageUrl || '/src/assets/images/dental_care_consultation_1794820374752.jpg'),
        Number(t.durationMinutes || 30),
        Number(t.consultationFeeInr || 500),
        t.isConfirmedAvailable ? 1 : 0,
        t.isActive !== false ? 1 : 0,
        Number(t.sortOrder || 99),
      );
    res.status(201).json({ id: Number(info.lastInsertRowid), treatments: listTreatments(false) });
  } catch {
    res.status(409).json({ error: 'A treatment with that URL slug already exists.' });
  }
});

app.put('/api/admin/treatments/:id', requireAdmin, (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  const t = req.body || {};
  db.prepare(
    `UPDATE treatments SET
      title = ?, category = ?, short_description = ?, introduction = ?,
      what_it_involves = ?, when_needed = ?, procedure_overview = ?,
      faqs_json = ?, image_url = ?, duration_minutes = ?,
      consultation_fee_inr = ?, is_confirmed_available = ?, is_active = ?
     WHERE id = ?`,
  ).run(
    String(t.title || ''),
    String(t.category || ''),
    String(t.shortDescription || ''),
    String(t.introduction || ''),
    String(t.whatItInvolves || ''),
    String(t.whenNeeded || ''),
    String(t.procedureOverview || ''),
    JSON.stringify(Array.isArray(t.faqs) ? t.faqs : []),
    String(t.imageUrl || ''),
    Number(t.durationMinutes || 30),
    Number(t.consultationFeeInr || 500),
    t.isConfirmedAvailable ? 1 : 0,
    t.isActive ? 1 : 0,
    id,
  );
  res.json({ treatments: listTreatments(false) });
});

// Doctors CRUD
app.post('/api/admin/doctors', requireAdmin, (req: AdminRequest, res) => {
  const d = req.body || {};
  const name = String(d.name || '').trim();
  if (!name) {
    res.status(400).json({ error: 'Doctor name is required.' });
    return;
  }
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
    '-' +
    crypto.randomBytes(2).toString('hex');
  db.prepare(
    `INSERT INTO doctors (slug, name, qualifications, specialization, experience_note, languages, bio, photo_url, is_photo_verified, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    slug,
    name,
    String(d.qualifications || ''),
    String(d.specialization || ''),
    String(d.experienceNote || ''),
    String(d.languages || ''),
    String(d.bio || ''),
    String(d.photoUrl || ''),
    d.photoUrl ? (d.isPhotoVerified !== false ? 1 : 0) : 0,
    d.isActive !== false ? 1 : 0,
    Number(d.sortOrder || 10),
  );
  res.status(201).json({ doctors: listDoctors(false) });
});

app.put('/api/admin/doctors/:id', requireAdmin, (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  const d = req.body || {};
  db.prepare(
    `UPDATE doctors SET
      name = ?, qualifications = ?, specialization = ?, experience_note = ?,
      languages = ?, bio = ?, photo_url = ?, is_photo_verified = ?, is_active = ?
     WHERE id = ?`,
  ).run(
    String(d.name || ''),
    String(d.qualifications || ''),
    String(d.specialization || ''),
    String(d.experienceNote || ''),
    String(d.languages || ''),
    String(d.bio || ''),
    String(d.photoUrl || ''),
    d.photoUrl ? (d.isPhotoVerified ? 1 : 0) : 0,
    d.isActive ? 1 : 0,
    id,
  );
  res.json({ doctors: listDoctors(false) });
});

// Blocked Dates / Holidays
app.post('/api/admin/blocked-dates', requireAdmin, (req: AdminRequest, res) => {
  const b = req.body || {};
  const date = String(b.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'Valid YYYY-MM-DD date required.' });
    return;
  }
  db.prepare(
    'INSERT INTO blocked_dates (date, doctor_id, start_time, end_time, reason) VALUES (?, ?, ?, ?, ?)',
  ).run(
    date,
    b.doctorId ? Number(b.doctorId) : null,
    b.startTime ? String(b.startTime) : null,
    b.endTime ? String(b.endTime) : null,
    String(b.reason || 'Clinic Holiday / Blocked'),
  );
  res.status(201).json({ blockedDates: listBlockedDates() });
});

app.delete('/api/admin/blocked-dates/:id', requireAdmin, (req: AdminRequest, res) => {
  db.prepare('DELETE FROM blocked_dates WHERE id = ?').run(Number(req.params.id));
  res.json({ blockedDates: listBlockedDates() });
});

// Gallery CRUD
app.post('/api/admin/gallery', requireAdmin, (req: AdminRequest, res) => {
  const g = req.body || {};
  if (!g.title || !g.imageUrl) {
    res.status(400).json({ error: 'Title and image are required.' });
    return;
  }
  db.prepare(
    'INSERT INTO gallery_items (title, category, image_url, caption, is_official_photo, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(
    String(g.title),
    String(g.category || 'Clinic Interior'),
    String(g.imageUrl),
    String(g.caption || ''),
    g.isOfficialPhoto ? 1 : 0,
    Number(g.sortOrder || 10),
  );
  res.status(201).json({ gallery: listGallery() });
});

app.put('/api/admin/gallery/:id', requireAdmin, (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  const g = req.body || {};
  db.prepare(
    'UPDATE gallery_items SET title = ?, category = ?, image_url = ?, caption = ?, is_official_photo = ? WHERE id = ?',
  ).run(
    String(g.title || ''),
    String(g.category || 'Clinic Interior'),
    String(g.imageUrl || ''),
    String(g.caption || ''),
    g.isOfficialPhoto ? 1 : 0,
    id,
  );
  res.json({ gallery: listGallery() });
});

app.delete('/api/admin/gallery/:id', requireAdmin, (req: AdminRequest, res) => {
  db.prepare('DELETE FROM gallery_items WHERE id = ?').run(Number(req.params.id));
  res.json({ gallery: listGallery() });
});

// Testimonials CRUD (genuine feedback only)
app.post('/api/admin/testimonials', requireAdmin, (req: AdminRequest, res) => {
  const t = req.body || {};
  if (!t.patientName || !t.quote) {
    res.status(400).json({ error: 'Patient name and feedback text are required.' });
    return;
  }
  db.prepare(
    'INSERT INTO testimonials (patient_name, treatment_name, quote, visit_date, is_approved, source) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(
    String(t.patientName).trim(),
    String(t.treatmentName || '').trim(),
    String(t.quote).trim(),
    String(t.visitDate || '').trim(),
    t.isApproved ? 1 : 0,
    String(t.source || 'Verified Clinic Feedback'),
  );
  res.status(201).json({ testimonials: listTestimonials(false) });
});

app.put('/api/admin/testimonials/:id', requireAdmin, (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  const t = req.body || {};
  db.prepare(
    'UPDATE testimonials SET patient_name = ?, treatment_name = ?, quote = ?, visit_date = ?, is_approved = ?, source = ? WHERE id = ?',
  ).run(
    String(t.patientName || ''),
    String(t.treatmentName || ''),
    String(t.quote || ''),
    String(t.visitDate || ''),
    t.isApproved ? 1 : 0,
    String(t.source || 'Verified Clinic Feedback'),
    id,
  );
  res.json({ testimonials: listTestimonials(false) });
});

app.delete('/api/admin/testimonials/:id', requireAdmin, (req: AdminRequest, res) => {
  db.prepare('DELETE FROM testimonials WHERE id = ?').run(Number(req.params.id));
  res.json({ testimonials: listTestimonials(false) });
});

// FAQs CRUD
app.post('/api/admin/faqs', requireAdmin, (req: AdminRequest, res) => {
  const f = req.body || {};
  if (!f.question || !f.answer) {
    res.status(400).json({ error: 'Question and answer are required.' });
    return;
  }
  db.prepare('INSERT INTO faqs (question, answer, category, sort_order, is_published) VALUES (?, ?, ?, ?, ?)').run(
    String(f.question),
    String(f.answer),
    String(f.category || 'General'),
    Number(f.sortOrder || 10),
    f.isPublished !== false ? 1 : 0,
  );
  res.status(201).json({ faqs: listFaqs(false) });
});

app.put('/api/admin/faqs/:id', requireAdmin, (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  const f = req.body || {};
  db.prepare('UPDATE faqs SET question = ?, answer = ?, category = ?, is_published = ? WHERE id = ?').run(
    String(f.question || ''),
    String(f.answer || ''),
    String(f.category || 'General'),
    f.isPublished !== false ? 1 : 0,
    id,
  );
  res.json({ faqs: listFaqs(false) });
});

app.delete('/api/admin/faqs/:id', requireAdmin, (req: AdminRequest, res) => {
  db.prepare('DELETE FROM faqs WHERE id = ?').run(Number(req.params.id));
  res.json({ faqs: listFaqs(false) });
});

// Enquiries status update
app.patch('/api/admin/enquiries/:id', requireAdmin, (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || 'Reviewed');
  db.prepare('UPDATE enquiries SET status = ? WHERE id = ?').run(status, id);
  res.json({ enquiries: listEnquiries() });
});

// ---------- Frontend Serving (Vite Dev Middleware or Production Dist) ----------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist'));

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Raghan Dental and Implant Care server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
