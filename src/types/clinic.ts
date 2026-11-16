export type AppointmentStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Completed'
  | 'Cancelled'
  | 'Rescheduled'
  | 'No-show';

export type PaymentStatus =
  | 'Not Required'
  | 'Pay at Clinic'
  | 'Pending Payment'
  | 'Paid';

export type PatientType = 'first-time' | 'returning';

export interface WeeklyDaySchedule {
  day: number; // 0 = Sunday ... 6 = Saturday
  label: string;
  isOpen: boolean;
  openTime: string; // HH:MM
  closeTime: string; // HH:MM
  breakStart: string; // HH:MM or ""
  breakEnd: string; // HH:MM or ""
}

export interface ClinicSettings {
  clinicName: string;
  tagline: string;
  heroHeadline: string;
  heroSubheadline: string;
  aboutHeading: string;
  aboutBody: string;
  phone: string;
  whatsappNumber: string;
  email: string;
  address: string;
  googleMapsUrl: string;
  googleReviewsUrl: string;
  logoUrl: string;
  heroImageUrl: string;
  aboutImageUrl: string;
  slotDurationMinutes: number;
  advanceBookingDays: number;
  minNoticeHours: number;
  autoConfirmBookings: boolean;
  cancellationPolicy: string;
  razorpayEnabled: boolean;
  allowPayAtClinic: boolean;
  defaultConsultationFeeInr: number;
  privacyPolicy: string;
  termsAndConditions: string;
  weeklySchedule: WeeklyDaySchedule[];
}

export interface Doctor {
  id: number;
  slug: string;
  name: string;
  qualifications: string;
  specialization: string;
  experienceNote: string;
  languages: string;
  bio: string;
  photoUrl: string;
  isPhotoVerified: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface TreatmentFaq {
  question: string;
  answer: string;
}

export interface Treatment {
  id: number;
  slug: string;
  title: string;
  category: string;
  shortDescription: string;
  introduction: string;
  whatItInvolves: string;
  whenNeeded: string;
  procedureOverview: string;
  faqs: TreatmentFaq[];
  imageUrl: string;
  durationMinutes: number;
  consultationFeeInr: number;
  isConfirmedAvailable: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface BlockedDate {
  id: number;
  date: string; // YYYY-MM-DD
  doctorId: number | null;
  startTime: string | null; // HH:MM or null for full day
  endTime: string | null;
  reason: string;
}

export interface Appointment {
  id: number;
  referenceCode: string;
  treatmentId: number;
  treatmentTitle: string;
  doctorId: number;
  doctorName: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:MM
  durationMinutes: number;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  patientType: PatientType;
  notes: string;
  status: AppointmentStatus;
  paymentStatus: PaymentStatus;
  paymentAmountInr: number;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  notificationLog: Array<{ channel: string; status: string; timestamp: string; detail: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryItem {
  id: number;
  title: string;
  category: 'Clinic Reception' | 'Treatment Rooms' | 'Dental Equipment' | 'Dentist & Team' | 'Clinic Interior';
  imageUrl: string;
  caption: string;
  isOfficialPhoto: boolean;
  sortOrder: number;
}

export interface Testimonial {
  id: number;
  patientName: string;
  treatmentName: string;
  quote: string;
  visitDate: string;
  isApproved: boolean;
  source: string;
  createdAt: string;
}

export interface FaqItem {
  id: number;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  isPublished: boolean;
}

export interface ContactEnquiry {
  id: number;
  name: string;
  phone: string;
  email: string;
  subject: string;
  message: string;
  status: 'New' | 'Reviewed' | 'Responded';
  createdAt: string;
}

export interface AvailabilitySlot {
  time: string; // HH:MM
  label: string; // 10:00 AM
  available: boolean;
  reason?: string;
}

export interface IntegrationStatus {
  razorpayConfigured: boolean;
  razorpayKeyIdPublic: string;
  whatsappConfigured: boolean;
  emailConfigured: boolean;
  databaseEngine: string;
  supabaseConfigured?: boolean;
  supabaseSecretConfigured?: boolean;
  supabaseProjectUrl?: string;
  supabaseAppointmentsTableReady?: boolean;
  supabaseStatusMessage?: string;
}

export interface PublicBootstrapData {
  settings: ClinicSettings;
  doctors: Doctor[];
  treatments: Treatment[];
  gallery: GalleryItem[];
  testimonials: Testimonial[];
  faqs: FaqItem[];
  integrations: IntegrationStatus;
}
