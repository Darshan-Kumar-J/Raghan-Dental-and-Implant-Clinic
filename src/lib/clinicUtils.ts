import type { Appointment } from '../types/clinic.ts';

export function formatTime12h(hhmm: string): string {
  if (!hhmm || !hhmm.includes(':')) return hhmm;
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatDateReadable(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function getTodayIstIso(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date());
}

export function buildWhatsAppUrl(whatsappNumber: string, message: string): string {
  const digits = whatsappNumber.replace(/[^\d]/g, '');
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function buildGoogleCalendarUrl(appt: Appointment, clinicAddress: string): string {
  const [y, m, d] = appt.appointmentDate.split('-').map(Number);
  const [hh, mm] = appt.appointmentTime.split(':').map(Number);
  const startUtc = new Date(Date.UTC(y, m - 1, d, hh, mm) - 5.5 * 60 * 60 * 1000);
  const endUtc = new Date(startUtc.getTime() + (appt.durationMinutes || 30) * 60 * 1000);

  const toGCal = (dt: Date) =>
    dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Dental Appointment — ${appt.treatmentTitle} (${appt.doctorName})`,
    dates: `${toGCal(startUtc)}/${toGCal(endUtc)}`,
    details: `Raghan Dental and Implant Care\nReference: ${appt.referenceCode}\nDoctor: ${appt.doctorName}\nTreatment: ${appt.treatmentTitle}\nStatus: ${appt.status}`,
    location: clinicAddress,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function resizeImageFileToDataUrl(file: File, maxWidth = 1200, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format.'));
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/webp', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
