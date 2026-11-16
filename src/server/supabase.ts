import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Appointment, ContactEnquiry } from '../types/clinic.ts';

function getSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || '').trim();
  const publishableKey = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY || '').trim();
  return { url, publishableKey, secretKey };
}

let cachedAnonClient: SupabaseClient | null = null;
let cachedAdminClient: SupabaseClient | null = null;

export function getSupabaseAnonClient(): SupabaseClient | null {
  const { url, publishableKey } = getSupabaseConfig();
  if (!url || !publishableKey) return null;
  if (!cachedAnonClient) {
    cachedAnonClient = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedAnonClient;
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  const { url, secretKey } = getSupabaseConfig();
  if (!url || !secretKey) return null;
  if (!cachedAdminClient) {
    cachedAdminClient = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedAdminClient;
}

export async function checkSupabaseHealth(): Promise<{
  configured: boolean;
  secretConfigured: boolean;
  projectUrl: string;
  appointmentsTableReady: boolean;
  statusMessage: string;
}> {
  const { url, publishableKey, secretKey } = getSupabaseConfig();
  if (!url || !publishableKey) {
    return {
      configured: false,
      secretConfigured: false,
      projectUrl: '',
      appointmentsTableReady: false,
      statusMessage: 'Not configured (set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env)',
    };
  }

  const client = getSupabaseAdminClient() || getSupabaseAnonClient();
  if (!client) {
    return {
      configured: false,
      secretConfigured: Boolean(secretKey),
      projectUrl: url,
      appointmentsTableReady: false,
      statusMessage: 'Client initialization failed.',
    };
  }

  try {
    const { error } = await client.from('appointments').select('id').limit(1);
    if (!error) {
      return {
        configured: true,
        secretConfigured: Boolean(secretKey),
        projectUrl: url,
        appointmentsTableReady: true,
        statusMessage: secretKey
          ? 'Connected (Full Admin Read, Edit & Cancel Sync Active)'
          : 'Connected (Public Booking Insert Active — set SUPABASE_SECRET_KEY in .env to read/edit/cancel Supabase rows under RLS)',
      };
    }
    if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
      return {
        configured: true,
        secretConfigured: Boolean(secretKey),
        projectUrl: url,
        appointmentsTableReady: false,
        statusMessage:
          'Connected to Supabase, but public.appointments table does not exist yet. Run supabase/schema.sql in Supabase SQL Editor.',
      };
    }
    // 42501 / RLS permission denied on SELECT means the table DOES exist and RLS is protecting PII!
    if (error.code === '42501' || error.message.toLowerCase().includes('permission denied')) {
      return {
        configured: true,
        secretConfigured: Boolean(secretKey),
        projectUrl: url,
        appointmentsTableReady: true,
        statusMessage: 'Connected (public.appointments active with RLS PII protection)',
      };
    }
    return {
      configured: true,
      secretConfigured: Boolean(secretKey),
      projectUrl: url,
      appointmentsTableReady: false,
      statusMessage: `Supabase notice: ${error.message}`,
    };
  } catch (err) {
    return {
      configured: true,
      secretConfigured: Boolean(secretKey),
      projectUrl: url,
      appointmentsTableReady: false,
      statusMessage: err instanceof Error ? err.message : 'Unable to reach Supabase.',
    };
  }
}

export async function getSupabaseBusySlots(
  dateStr: string,
  doctorId: number,
): Promise<Array<{ appointment_time: string; duration_minutes: number }>> {
  const client = getSupabaseAdminClient() || getSupabaseAnonClient();
  if (!client) return [];
  try {
    const { data, error } = await client.rpc('get_busy_slots', {
      p_date: dateStr,
      p_doctor_id: doctorId,
    });
    if (error || !Array.isArray(data)) return [];
    return data as Array<{ appointment_time: string; duration_minutes: number }>;
  } catch {
    return [];
  }
}

export async function syncAppointmentToSupabase(
  appt: Appointment,
): Promise<{ synced: boolean; conflict?: boolean; error?: string }> {
  const client = getSupabaseAdminClient() || getSupabaseAnonClient();
  if (!client) {
    return { synced: false, error: 'Supabase not configured' };
  }

  try {
    // Note: Do NOT call .select() after .insert() when using publishable key + strict RLS (no public SELECT on PII)
    const { error } = await client.from('appointments').insert({
      reference_code: appt.referenceCode,
      treatment_id: appt.treatmentId,
      treatment_title: appt.treatmentTitle,
      doctor_id: appt.doctorId,
      doctor_name: appt.doctorName,
      appointment_date: appt.appointmentDate,
      appointment_time: appt.appointmentTime,
      duration_minutes: appt.durationMinutes,
      patient_name: appt.patientName,
      patient_phone: appt.patientPhone,
      patient_email: appt.patientEmail,
      patient_type: appt.patientType,
      notes: appt.notes,
      status: appt.status,
      payment_status: appt.paymentStatus,
      payment_amount_inr: appt.paymentAmountInr,
      razorpay_order_id: appt.razorpayOrderId,
      razorpay_payment_id: appt.razorpayPaymentId,
    });

    if (error) {
      console.error('Supabase appointment insert error:', error.code, error.message);
      const isConflict = error.code === '23505';
      return { synced: false, conflict: isConflict, error: error.message };
    }
    return { synced: true };
  } catch (err) {
    console.error('Supabase appointment sync exception:', err);
    return { synced: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function listAppointmentsFromSupabase(): Promise<{
  rows: Appointment[];
  error?: string;
}> {
  const client = getSupabaseAdminClient() || getSupabaseAnonClient();
  if (!client) return { rows: [], error: 'Supabase not configured' };

  try {
    const { data, error } = await client
      .from('appointments')
      .select('*')
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: false });

    if (error) {
      return { rows: [], error: error.message };
    }

    const mapped: Appointment[] = (data || []).map((r: Record<string, unknown>) => ({
      id: Number(r.id),
      referenceCode: String(r.reference_code),
      treatmentId: Number(r.treatment_id || 1),
      treatmentTitle: String(r.treatment_title || ''),
      doctorId: Number(r.doctor_id || 1),
      doctorName: String(r.doctor_name || ''),
      appointmentDate: String(r.appointment_date || '').slice(0, 10),
      appointmentTime: String(r.appointment_time || '').slice(0, 5),
      durationMinutes: Number(r.duration_minutes || 30),
      patientName: String(r.patient_name || ''),
      patientPhone: String(r.patient_phone || ''),
      patientEmail: String(r.patient_email || ''),
      patientType: (String(r.patient_type) === 'returning' ? 'returning' : 'first-time') as Appointment['patientType'],
      notes: String(r.notes || ''),
      status: String(r.status || 'Pending') as Appointment['status'],
      paymentStatus: String(r.payment_status || 'Pay at Clinic') as Appointment['paymentStatus'],
      paymentAmountInr: Number(r.payment_amount_inr || 0),
      razorpayOrderId: String(r.razorpay_order_id || ''),
      razorpayPaymentId: String(r.razorpay_payment_id || ''),
      notificationLog: [
        {
          channel: 'Supabase Database',
          status: 'synced',
          timestamp: String(r.updated_at || r.created_at || new Date().toISOString()),
          detail: 'Retrieved from Supabase public.appointments',
        },
      ],
      createdAt: String(r.created_at || ''),
      updatedAt: String(r.updated_at || ''),
    }));

    return { rows: mapped };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function updateAppointmentInSupabase(
  referenceCode: string,
  updates: Partial<{
    treatment_id: number;
    treatment_title: string;
    doctor_id: number;
    doctor_name: string;
    duration_minutes: number;
    patient_name: string;
    patient_phone: string;
    patient_email: string;
    patient_type: string;
    notes: string;
    status: string;
    payment_status: string;
    payment_amount_inr: number;
    appointment_date: string;
    appointment_time: string;
  }>,
): Promise<{ synced: boolean; error?: string }> {
  const adminClient = getSupabaseAdminClient();
  const client = adminClient || getSupabaseAnonClient();
  if (!client) {
    return { synced: false, error: 'Supabase not configured' };
  }
  try {
    const { data, error } = await client
      .from('appointments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('reference_code', referenceCode)
      .select('reference_code');
    if (error) return { synced: false, error: error.message };
    if (!Array.isArray(data) || data.length === 0) {
      return {
        synced: false,
        error: adminClient
          ? 'Matching appointment not found in Supabase.'
          : 'SUPABASE_SECRET_KEY required to update existing Supabase rows under RLS.',
      };
    }
    return { synced: true };
  } catch (err) {
    return { synced: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function deleteAppointmentInSupabase(
  referenceCode: string,
): Promise<{ synced: boolean; error?: string }> {
  const adminClient = getSupabaseAdminClient();
  const client = adminClient || getSupabaseAnonClient();
  if (!client) return { synced: false, error: 'Supabase not configured' };
  try {
    const { data, error } = await client
      .from('appointments')
      .delete()
      .eq('reference_code', referenceCode)
      .select('reference_code');
    if (error) return { synced: false, error: error.message };
    if (!Array.isArray(data) || data.length === 0) {
      return {
        synced: false,
        error: adminClient
          ? 'Matching appointment not found in Supabase.'
          : 'SUPABASE_SECRET_KEY required to delete Supabase rows under RLS.',
      };
    }
    return { synced: true };
  } catch (err) {
    return { synced: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function listEnquiriesFromSupabase(): Promise<ContactEnquiry[]> {
  const client = getSupabaseAdminClient() || getSupabaseAnonClient();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from('contact_enquiries')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !Array.isArray(data)) return [];
    return data.map((r: Record<string, unknown>) => ({
      id: Number(r.id),
      name: String(r.name || ''),
      phone: String(r.phone || ''),
      email: String(r.email || ''),
      subject: String(r.subject || ''),
      message: String(r.message || ''),
      status: String(r.status || 'New') as ContactEnquiry['status'],
      createdAt: String(r.created_at || ''),
    }));
  } catch {
    return [];
  }
}

export async function syncEnquiryToSupabase(
  enquiry: Omit<ContactEnquiry, 'id' | 'createdAt' | 'status'>,
): Promise<{ synced: boolean; error?: string }> {
  const client = getSupabaseAdminClient() || getSupabaseAnonClient();
  if (!client) return { synced: false, error: 'Supabase not configured' };

  try {
    const { error } = await client.from('contact_enquiries').insert({
      name: enquiry.name,
      phone: enquiry.phone,
      email: enquiry.email,
      subject: enquiry.subject,
      message: enquiry.message,
      status: 'New',
    });
    if (error) {
      console.error('Supabase enquiry insert error:', error.code, error.message);
      return { synced: false, error: error.message };
    }
    return { synced: true };
  } catch (err) {
    return { synced: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}
