import crypto from 'node:crypto';
import {
  db,
  getSettings,
  getDoctorById,
  getTreatmentById,
  listBlockedDates,
  mapAppointment,
} from './db.ts';
import type {
  Appointment,
  AvailabilitySlot,
  IntegrationStatus,
  PatientType,
} from '../types/clinic.ts';

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatTime12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function getIstNow(): { dateStr: string; minutesNow: number } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  return { dateStr, minutesNow: hour * 60 + minute };
}

export function getDayOfWeekFromIso(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCDay();
}

export function daysBetweenIso(fromDate: string, toDate: string): number {
  const [y1, m1, d1] = fromDate.split('-').map(Number);
  const [y2, m2, d2] = toDate.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

export function getAvailableSlotsForDate(
  dateStr: string,
  doctorId: number,
  durationMinutesOverride?: number,
  excludeAppointmentId?: number,
  externalBusySlots: Array<{ appointment_time: string; duration_minutes: number }> = [],
): { slots: AvailabilitySlot[]; closedReason?: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { slots: [], closedReason: 'Invalid date format.' };
  }

  const settings = getSettings();
  const doctor = getDoctorById(doctorId);
  if (!doctor || !doctor.isActive) {
    return { slots: [], closedReason: 'Selected dentist is not currently active.' };
  }

  const { dateStr: todayIst, minutesNow } = getIstNow();
  const dayDiff = daysBetweenIso(todayIst, dateStr);
  if (dayDiff < 0) {
    return { slots: [], closedReason: 'Past dates cannot be booked.' };
  }
  if (dayDiff > settings.advanceBookingDays) {
    return {
      slots: [],
      closedReason: `Appointments can be booked up to ${settings.advanceBookingDays} days in advance.`,
    };
  }

  const dow = getDayOfWeekFromIso(dateStr);
  const daySched = settings.weeklySchedule.find((d) => d.day === dow);
  if (!daySched || !daySched.isOpen) {
    return { slots: [], closedReason: 'The clinic is closed on this day.' };
  }

  const blocked = listBlockedDates().filter(
    (b) => b.date === dateStr && (b.doctorId === null || b.doctorId === doctorId),
  );
  const fullDayBlock = blocked.find((b) => !b.startTime || !b.endTime);
  if (fullDayBlock) {
    return {
      slots: [],
      closedReason: fullDayBlock.reason || 'Unavailable due to clinic holiday or blocked schedule.',
    };
  }

  const slotStep = Math.max(15, settings.slotDurationMinutes || 30);
  const neededDuration = Math.max(15, durationMinutesOverride || slotStep);
  const openMin = toMinutes(daySched.openTime);
  const closeMin = toMinutes(daySched.closeTime);
  const hasBreak = Boolean(daySched.breakStart && daySched.breakEnd);
  const breakStartMin = hasBreak ? toMinutes(daySched.breakStart) : -1;
  const breakEndMin = hasBreak ? toMinutes(daySched.breakEnd) : -1;

  // Query active appointments for this doctor on this date
  const existingRows = db
    .prepare(
      `SELECT id, appointment_time, duration_minutes FROM appointments
       WHERE doctor_id = ? AND appointment_date = ? AND status NOT IN ('Cancelled', 'Rescheduled')`,
    )
    .all(doctorId, dateStr) as Array<{ id: number; appointment_time: string; duration_minutes: number }>;

  const busyIntervals = [
    ...existingRows
      .filter((r) => (excludeAppointmentId ? r.id !== excludeAppointmentId : true))
      .map((r) => {
        const start = toMinutes(r.appointment_time);
        return { start, end: start + Number(r.duration_minutes || slotStep) };
      }),
    ...externalBusySlots.map((r) => {
      const start = toMinutes(r.appointment_time);
      return { start, end: start + Number(r.duration_minutes || slotStep) };
    }),
  ];

  const minNoticeMin = dayDiff === 0 ? minutesNow + settings.minNoticeHours * 60 : -1;

  const slots: AvailabilitySlot[] = [];
  for (let start = openMin; start + neededDuration <= closeMin; start += slotStep) {
    const end = start + neededDuration;
    const timeStr = fromMinutes(start);
    let available = true;
    let reason: string | undefined;

    if (dayDiff === 0 && start < minNoticeMin) {
      available = false;
      reason = 'Minimum advance notice elapsed';
    } else if (hasBreak && start < breakEndMin && end > breakStartMin) {
      available = false;
      reason = 'Clinic break';
    } else {
      for (const b of blocked) {
        if (b.startTime && b.endTime) {
          const bStart = toMinutes(b.startTime);
          const bEnd = toMinutes(b.endTime);
          if (start < bEnd && end > bStart) {
            available = false;
            reason = b.reason || 'Blocked period';
            break;
          }
        }
      }
    }

    if (available) {
      for (const busy of busyIntervals) {
        if (start < busy.end && end > busy.start) {
          available = false;
          reason = 'Already booked';
          break;
        }
      }
    }

    slots.push({
      time: timeStr,
      label: formatTime12h(timeStr),
      available,
      reason,
    });
  }

  return { slots };
}

export function getIntegrationStatus(): IntegrationStatus {
  const razorpayId = process.env.RAZORPAY_KEY_ID || '';
  const razorpaySecret = process.env.RAZORPAY_KEY_SECRET || '';
  const waToken = process.env.WHATSAPP_API_TOKEN || '';
  const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  const resendKey = process.env.RESEND_API_KEY || '';
  const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  const supabaseKey = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  return {
    razorpayConfigured: Boolean(razorpayId && razorpaySecret),
    razorpayKeyIdPublic: razorpayId || '',
    whatsappConfigured: Boolean(waToken && waPhoneId),
    emailConfigured: Boolean(resendKey),
    databaseEngine: supabaseUrl && supabaseKey ? 'Supabase + Local SQLite Sync' : 'SQLite (ACID Transactional Slot Locking)',
    supabaseConfigured: Boolean(supabaseUrl && supabaseKey),
    supabaseProjectUrl: supabaseUrl,
  };
}

export async function dispatchBookingNotifications(
  appointment: Appointment,
  eventLabel: 'created' | 'confirmed' | 'rescheduled' | 'cancelled',
): Promise<Array<{ channel: string; status: string; timestamp: string; detail: string }>> {
  const logs: Array<{ channel: string; status: string; timestamp: string; detail: string }> = [];
  const nowIso = new Date().toISOString();

  // 1. WhatsApp Business Cloud API (real call when configured; honest status when not)
  const waToken = process.env.WHATSAPP_API_TOKEN || '';
  const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  if (waToken && waPhoneId) {
    try {
      const digitsPhone = appointment.patientPhone.replace(/[^\d]/g, '');
      const formattedPhone = digitsPhone.length === 10 ? `91${digitsPhone}` : digitsPhone;
      const msgText =
        eventLabel === 'confirmed'
          ? `Hello ${appointment.patientName}, your appointment (${appointment.referenceCode}) at Raghan Dental and Implant Care with ${appointment.doctorName} is confirmed for ${appointment.appointmentDate} at ${formatTime12h(appointment.appointmentTime)}.`
          : `Hello ${appointment.patientName}, we received your appointment request (${appointment.referenceCode}) at Raghan Dental and Implant Care for ${appointment.appointmentDate} at ${formatTime12h(appointment.appointmentTime)}. Status: ${appointment.status}.`;

      const resp = await fetch(`https://graph.facebook.com/v20.0/${waPhoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${waToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'text',
          text: { body: msgText },
        }),
      });
      if (resp.ok) {
        logs.push({
          channel: 'WhatsApp Business API',
          status: 'sent',
          timestamp: nowIso,
          detail: `Message dispatched (${eventLabel}).`,
        });
      } else {
        const errText = await resp.text();
        logs.push({
          channel: 'WhatsApp Business API',
          status: 'failed',
          timestamp: nowIso,
          detail: `API returned ${resp.status}: ${errText.slice(0, 120)}`,
        });
      }
    } catch (err) {
      logs.push({
        channel: 'WhatsApp Business API',
        status: 'failed',
        timestamp: nowIso,
        detail: err instanceof Error ? err.message : 'Network error',
      });
    }
  } else {
    logs.push({
      channel: 'WhatsApp Business API',
      status: 'not_configured',
      timestamp: nowIso,
      detail: 'WHATSAPP_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID not configured — manual WhatsApp link available.',
    });
  }

  // 2. Email via Resend (real call when configured)
  const resendKey = process.env.RESEND_API_KEY || '';
  const clinicNotifyEmail = process.env.CLINIC_NOTIFICATION_EMAIL || '';
  if (resendKey && (appointment.patientEmail || clinicNotifyEmail)) {
    const recipients = [appointment.patientEmail, clinicNotifyEmail].filter(Boolean);
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Raghan Dental Care <appointments@raghandental.in>',
          to: recipients,
          subject: `Appointment ${appointment.status} — ${appointment.referenceCode} | Raghan Dental and Implant Care`,
          text: `Reference: ${appointment.referenceCode}\nPatient: ${appointment.patientName} (${appointment.patientPhone})\nTreatment: ${appointment.treatmentTitle}\nDoctor: ${appointment.doctorName}\nDate & Time: ${appointment.appointmentDate} at ${formatTime12h(appointment.appointmentTime)}\nStatus: ${appointment.status}`,
        }),
      });
      logs.push({
        channel: 'Email (Resend)',
        status: resp.ok ? 'sent' : 'failed',
        timestamp: nowIso,
        detail: resp.ok ? `Sent to ${recipients.join(', ')}` : `HTTP ${resp.status}`,
      });
    } catch (err) {
      logs.push({
        channel: 'Email (Resend)',
        status: 'failed',
        timestamp: nowIso,
        detail: err instanceof Error ? err.message : 'Network error',
      });
    }
  } else {
    logs.push({
      channel: 'Email Notification',
      status: 'not_configured',
      timestamp: nowIso,
      detail: 'RESEND_API_KEY not configured in environment.',
    });
  }

  return logs;
}

export interface CreateBookingInput {
  treatmentId: number;
  doctorId: number;
  appointmentDate: string;
  appointmentTime: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  patientType: PatientType;
  notes?: string;
  paymentMode?: 'clinic' | 'razorpay';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
}

export function createBookingAtomically(input: CreateBookingInput): {
  ok: boolean;
  statusCode: number;
  error?: string;
  appointment?: Appointment;
} {
  const settings = getSettings();
  const treatment = getTreatmentById(input.treatmentId);
  if (!treatment || !treatment.isActive) {
    return { ok: false, statusCode: 400, error: 'Selected treatment is not available.' };
  }

  const doctor = getDoctorById(input.doctorId);
  if (!doctor || !doctor.isActive) {
    return { ok: false, statusCode: 400, error: 'Selected dentist is not available.' };
  }

  const cleanName = input.patientName.trim();
  const cleanPhone = input.patientPhone.trim();
  const cleanEmail = (input.patientEmail || '').trim();
  const cleanNotes = (input.notes || '').trim();

  if (cleanName.length < 2 || cleanName.length > 120) {
    return { ok: false, statusCode: 400, error: 'Please provide a valid full name.' };
  }
  const phoneDigits = cleanPhone.replace(/[^\d]/g, '');
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    return { ok: false, statusCode: 400, error: 'Please provide a valid 10-digit mobile number.' };
  }
  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, statusCode: 400, error: 'Please provide a valid email address.' };
  }

  // Optional Razorpay verification if paid online
  let paymentStatus: Appointment['paymentStatus'] = settings.allowPayAtClinic ? 'Pay at Clinic' : 'Not Required';
  let paymentAmountInr = treatment.consultationFeeInr || settings.defaultConsultationFeeInr;
  let orderId = '';
  let paymentId = '';

  if (input.paymentMode === 'razorpay') {
    const secret = process.env.RAZORPAY_KEY_SECRET || '';
    if (!secret || !settings.razorpayEnabled) {
      return { ok: false, statusCode: 400, error: 'Online Razorpay payment is not currently enabled.' };
    }
    if (!input.razorpayOrderId || !input.razorpayPaymentId || !input.razorpaySignature) {
      return { ok: false, statusCode: 400, error: 'Incomplete Razorpay payment verification details.' };
    }
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
      .digest('hex');
    if (expectedSig !== input.razorpaySignature) {
      return { ok: false, statusCode: 400, error: 'Invalid payment signature. Payment could not be verified.' };
    }
    paymentStatus = 'Paid';
    orderId = input.razorpayOrderId;
    paymentId = input.razorpayPaymentId;
  } else if (!settings.razorpayEnabled && !settings.allowPayAtClinic) {
    paymentStatus = 'Not Required';
    paymentAmountInr = 0;
  }

  const duration = treatment.durationMinutes || settings.slotDurationMinutes || 30;
  const referenceCode = `RD-${input.appointmentDate.replace(/-/g, '')}-${crypto
    .randomBytes(2)
    .toString('hex')
    .toUpperCase()}`;

  const initialStatus = settings.autoConfirmBookings ? 'Confirmed' : 'Pending';

  // Atomic database-level lock and validation inside IMMEDIATE transaction
  try {
    db.exec('BEGIN IMMEDIATE');
    const { slots, closedReason } = getAvailableSlotsForDate(
      input.appointmentDate,
      input.doctorId,
      duration,
    );
    if (closedReason) {
      db.exec('ROLLBACK');
      return { ok: false, statusCode: 409, error: closedReason };
    }

    const chosenSlot = slots.find((s) => s.time === input.appointmentTime);
    if (!chosenSlot || !chosenSlot.available) {
      db.exec('ROLLBACK');
      return {
        ok: false,
        statusCode: 409,
        error:
          chosenSlot?.reason === 'Already booked'
            ? 'This time slot has just been booked. Please choose another available slot.'
            : 'The selected time slot is unavailable. Please choose another time.',
      };
    }

    const res = db
      .prepare(
        `INSERT INTO appointments (
          reference_code, treatment_id, treatment_title, doctor_id, doctor_name,
          appointment_date, appointment_time, duration_minutes,
          patient_name, patient_phone, patient_email, patient_type, notes,
          status, payment_status, payment_amount_inr, razorpay_order_id, razorpay_payment_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        referenceCode,
        treatment.id,
        treatment.title,
        doctor.id,
        doctor.name,
        input.appointmentDate,
        input.appointmentTime,
        duration,
        cleanName,
        cleanPhone,
        cleanEmail,
        input.patientType === 'returning' ? 'returning' : 'first-time',
        cleanNotes,
        initialStatus,
        paymentStatus,
        paymentAmountInr,
        orderId,
        paymentId,
      );

    db.exec('COMMIT');

    const row = db
      .prepare('SELECT * FROM appointments WHERE id = ?')
      .get(Number(res.lastInsertRowid)) as Record<string, unknown>;
    return { ok: true, statusCode: 201, appointment: mapAppointment(row) };
  } catch (err: unknown) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore if already rolled back
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE constraint failed')) {
      return {
        ok: false,
        statusCode: 409,
        error: 'This appointment slot was just reserved by another patient. Please select another slot.',
      };
    }
    console.error('Booking transaction failed:', err);
    return { ok: false, statusCode: 500, error: 'Unable to complete booking right now. Please try again.' };
  }
}

export function rescheduleAppointmentAtomically(
  appointmentId: number,
  newDate: string,
  newTime: string,
): { ok: boolean; statusCode: number; error?: string; appointment?: Appointment } {
  try {
    db.exec('BEGIN IMMEDIATE');
    const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      db.exec('ROLLBACK');
      return { ok: false, statusCode: 404, error: 'Appointment not found.' };
    }
    const appt = mapAppointment(existing);

    const { slots, closedReason } = getAvailableSlotsForDate(
      newDate,
      appt.doctorId,
      appt.durationMinutes,
      appt.id,
    );
    if (closedReason) {
      db.exec('ROLLBACK');
      return { ok: false, statusCode: 409, error: closedReason };
    }
    const chosen = slots.find((s) => s.time === newTime);
    if (!chosen || !chosen.available) {
      db.exec('ROLLBACK');
      return { ok: false, statusCode: 409, error: 'Selected new slot is not available.' };
    }

    db.prepare(
      `UPDATE appointments
       SET appointment_date = ?, appointment_time = ?, status = 'Rescheduled', updated_at = datetime('now')
       WHERE id = ?`,
    ).run(newDate, newTime, appointmentId);

    db.exec('COMMIT');
    const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId) as Record<
      string,
      unknown
    >;
    return { ok: true, statusCode: 200, appointment: mapAppointment(updated) };
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('Reschedule failed:', err);
    return { ok: false, statusCode: 500, error: 'Failed to reschedule appointment.' };
  }
}
