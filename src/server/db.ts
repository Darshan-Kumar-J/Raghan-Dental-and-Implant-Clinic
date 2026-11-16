import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  ClinicSettings,
  Doctor,
  Treatment,
  GalleryItem,
  Testimonial,
  FaqItem,
  BlockedDate,
  Appointment,
  ContactEnquiry,
  WeeklyDaySchedule,
} from '../types/clinic.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'clinic.db');
export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function hashPassword(password: string, existingSalt?: string): string {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clinic_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      qualifications TEXT NOT NULL,
      specialization TEXT NOT NULL,
      experience_note TEXT NOT NULL,
      languages TEXT NOT NULL,
      bio TEXT NOT NULL,
      photo_url TEXT NOT NULL DEFAULT '',
      is_photo_verified INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS treatments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      short_description TEXT NOT NULL,
      introduction TEXT NOT NULL,
      what_it_involves TEXT NOT NULL,
      when_needed TEXT NOT NULL,
      procedure_overview TEXT NOT NULL,
      faqs_json TEXT NOT NULL DEFAULT '[]',
      image_url TEXT NOT NULL DEFAULT '',
      duration_minutes INTEGER NOT NULL DEFAULT 30,
      consultation_fee_inr INTEGER NOT NULL DEFAULT 500,
      is_confirmed_available INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS blocked_dates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      doctor_id INTEGER NULL REFERENCES doctors(id) ON DELETE CASCADE,
      start_time TEXT NULL,
      end_time TEXT NULL,
      reason TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_code TEXT NOT NULL UNIQUE,
      treatment_id INTEGER NOT NULL REFERENCES treatments(id),
      treatment_title TEXT NOT NULL,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id),
      doctor_name TEXT NOT NULL,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 30,
      patient_name TEXT NOT NULL,
      patient_phone TEXT NOT NULL,
      patient_email TEXT NOT NULL DEFAULT '',
      patient_type TEXT NOT NULL DEFAULT 'first-time',
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Pending',
      payment_status TEXT NOT NULL DEFAULT 'Not Required',
      payment_amount_inr INTEGER NOT NULL DEFAULT 0,
      razorpay_order_id TEXT NOT NULL DEFAULT '',
      razorpay_payment_id TEXT NOT NULL DEFAULT '',
      notification_log_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_active_booking_slot
      ON appointments(doctor_id, appointment_date, appointment_time)
      WHERE status NOT IN ('Cancelled', 'Rescheduled');

    CREATE TABLE IF NOT EXISTS gallery_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      image_url TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      is_official_photo INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_name TEXT NOT NULL,
      treatment_name TEXT NOT NULL DEFAULT '',
      quote TEXT NOT NULL,
      visit_date TEXT NOT NULL DEFAULT '',
      is_approved INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'Clinic Feedback',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_published INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'New',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

const DEFAULT_WEEKLY_SCHEDULE: WeeklyDaySchedule[] = [
  { day: 0, label: 'Sunday', isOpen: false, openTime: '10:00', closeTime: '14:00', breakStart: '', breakEnd: '' },
  { day: 1, label: 'Monday', isOpen: true, openTime: '10:00', closeTime: '20:00', breakStart: '13:30', breakEnd: '16:30' },
  { day: 2, label: 'Tuesday', isOpen: true, openTime: '10:00', closeTime: '20:00', breakStart: '13:30', breakEnd: '16:30' },
  { day: 3, label: 'Wednesday', isOpen: true, openTime: '10:00', closeTime: '20:00', breakStart: '13:30', breakEnd: '16:30' },
  { day: 4, label: 'Thursday', isOpen: true, openTime: '10:00', closeTime: '20:00', breakStart: '13:30', breakEnd: '16:30' },
  { day: 5, label: 'Friday', isOpen: true, openTime: '10:00', closeTime: '20:00', breakStart: '13:30', breakEnd: '16:30' },
  { day: 6, label: 'Saturday', isOpen: true, openTime: '10:00', closeTime: '19:00', breakStart: '13:30', breakEnd: '16:00' },
];

export const DEFAULT_SETTINGS: ClinicSettings = {
  clinicName: 'Raghan Dental and Implant Care',
  tagline: 'Periodontics & Patient-Focused Dental Care in Subramanyanagar, Bengaluru',
  heroHeadline: 'Your Smile Deserves Expert Care.',
  heroSubheadline:
    'Experience compassionate, modern dental care with a focus on healthy gums, confident smiles and long-lasting oral health.',
  aboutHeading: 'Thoughtful, Unhurried Dental Care in Subramanyanagar',
  aboutBody:
    'Raghan Dental and Implant Care serves patients across Subramanyanagar and Bengaluru with a commitment to clear communication, gentle clinical technique, and comfortable consultations. Every visit begins with listening carefully to your concerns and explaining findings transparently before recommending any treatment.',
  phone: '+91 70263 70619',
  whatsappNumber: '+917026370619',
  email: '',
  address: '4338/22/1, 14th Main, 1st Cross, 2nd Stage, Subramanyanagar, Bengaluru, Karnataka 560010, India',
  googleMapsUrl: 'https://maps.app.goo.gl/z8797DHSpok2BPy67',
  googleReviewsUrl: 'https://maps.app.goo.gl/z8797DHSpok2BPy67',
  logoUrl: '',
  heroImageUrl: '/src/assets/images/hero_dental_clinic_1794820372693.jpg',
  aboutImageUrl: '/src/assets/images/clinic_lounge_interior_1794820399310.jpg',
  slotDurationMinutes: 30,
  advanceBookingDays: 30,
  minNoticeHours: 2,
  autoConfirmBookings: false,
  cancellationPolicy:
    'Please notify the clinic at least 4 hours before your scheduled time if you need to reschedule or cancel your visit.',
  razorpayEnabled: false,
  allowPayAtClinic: true,
  defaultConsultationFeeInr: 500,
  privacyPolicy:
    'Raghan Dental and Implant Care collects only the personal contact details necessary to schedule, confirm, and manage your dental appointment. Patient records and appointment details are kept confidential and are never sold or publicly shared.',
  termsAndConditions:
    'Online appointment requests are subject to confirmation based on clinical availability unless automatic confirmation is enabled. Information on treatment pages is intended for general patient education and does not replace an in-person clinical examination.',
  weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
};

function seedIfEmpty() {
  // 1. Admin User
  const adminCount = db.prepare('SELECT COUNT(*) as c FROM admin_users').get() as { c: number };
  if (adminCount.c === 0) {
    const email = (process.env.ADMIN_EMAIL || 'admin@raghandental.in').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'RaghanClinic@2026';
    db.prepare('INSERT INTO admin_users (email, name, password_hash, role) VALUES (?, ?, ?, ?)').run(
      email,
      'Clinic Administrator',
      hashPassword(password),
      'admin',
    );
  }

  // 2. Clinic Settings
  const settingsRow = db.prepare('SELECT value_json FROM clinic_settings WHERE key = ?').get('main') as
    | { value_json: string }
    | undefined;
  if (!settingsRow) {
    db.prepare('INSERT INTO clinic_settings (key, value_json) VALUES (?, ?)').run(
      'main',
      JSON.stringify(DEFAULT_SETTINGS),
    );
  }

  // 3. Doctors
  const docCount = db.prepare('SELECT COUNT(*) as c FROM doctors').get() as { c: number };
  if (docCount.c === 0) {
    db.prepare(
      `INSERT INTO doctors (slug, name, qualifications, specialization, experience_note, languages, bio, photo_url, is_photo_verified, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'dr-deepthi-k',
      'Dr. Deepthi K',
      'BDS, MDS – Periodontics',
      'Periodontics',
      'Approximately 13–14 years of clinical experience (subject to clinic confirmation)',
      'English, Hindi (subject to confirmation)',
      'Dr. Deepthi K leads Raghan Dental and Implant Care in Subramanyanagar, Bengaluru. With postgraduate specialization in Periodontics (MDS), her clinical focus centers on gum health, thorough patient-centered consultations, and long-term preservation of oral tissues in a calm, transparent setting.',
      '',
      0,
      1,
      1,
    );
  }

  // 4. Treatments (all 8 requested categories, proposed until confirmed by clinic in Admin)
  const trCount = db.prepare('SELECT COUNT(*) as c FROM treatments').get() as { c: number };
  if (trCount.c === 0) {
    const seedTreatments = [
      {
        slug: 'general-dental-consultation',
        title: 'General Dental Consultation',
        category: 'Consultations',
        shortDescription:
          'Comprehensive oral examination, discussion of dental concerns, and clear preventive guidance.',
        introduction:
          'A thorough general consultation gives you dedicated one-on-one time to discuss any tooth sensitivity, gum changes, or routine check-up needs in an unhurried environment.',
        whatItInvolves:
          'Visual examination of teeth, gums, and oral tissues, review of dental history, and discussion of diagnostic imaging if clinically indicated.',
        whenNeeded:
          'Recommended for routine periodic check-ups, new patient assessments, mild discomfort, or seeking a second opinion on dental care.',
        procedureOverview:
          'You will meet with the dentist to share your symptoms and goals, undergo a gentle oral examination, and receive a clear explanation of findings and care options.',
        faqs: [
          {
            question: 'What happens during a first dental consultation?',
            answer:
              'Your dentist reviews your concerns and medical history, examines your teeth and gums gently, and explains any recommended next steps clearly before treatment.',
          },
          {
            question: 'How long should I set aside for a consultation?',
            answer:
              'Most initial consultations are scheduled for 30 minutes so there is comfortable time for questions.',
          },
        ],
        imageUrl: '/src/assets/images/dental_care_consultation_1794820374752.jpg',
        durationMinutes: 30,
        consultationFeeInr: 500,
      },
      {
        slug: 'gum-treatment-periodontal-care',
        title: 'Gum Treatment and Periodontal Care',
        category: 'Periodontics',
        shortDescription:
          'Specialized evaluation and management of gum inflammation, bleeding gums, and periodontal support.',
        introduction:
          'Healthy gums form the foundation for every natural tooth and dental restoration. Periodontal care focuses on identifying and addressing gum inflammation and supporting bone health early.',
        whatItInvolves:
          'Periodontal charting, assessment of gum pocket depths, removal of plaque and calculus deposits below the gumline, and tailored oral hygiene guidance.',
        whenNeeded:
          'Consider booking an evaluation if you notice bleeding while brushing, swollen or tender gums, persistent bad breath, or gum recession.',
        procedureOverview:
          'After measuring gum health around each tooth, the periodontist outlines non-surgical or specialized periodontal care tailored to your tissue health and comfort.',
        faqs: [
          {
            question: 'Why see a Periodontist for bleeding gums?',
            answer:
              'A Periodontist (MDS – Periodontics) has specialized postgraduate training in diagnosing and managing conditions affecting the gums and supporting bone.',
          },
          {
            question: 'Is periodontal evaluation uncomfortable?',
            answer:
              'Examinations are carried out gently, and local numbing options are discussed whenever deeper cleaning is needed.',
          },
        ],
        imageUrl: '/src/assets/images/dental_care_consultation_1794820374752.jpg',
        durationMinutes: 45,
        consultationFeeInr: 500,
      },
      {
        slug: 'dental-implant-consultation',
        title: 'Dental Implant Consultation',
        category: 'Implant Care',
        shortDescription:
          'Individualized assessment of bone support, gum readiness, and suitability for dental implants.',
        introduction:
          'Dental implants offer a fixed option for replacing missing teeth. A structured implant consultation evaluates your gum health, jawbone support, and overall oral readiness first.',
        whatItInvolves:
          'Clinical evaluation of the missing tooth space, periodontal health assessment, bite evaluation, and discussion of required diagnostic scans.',
        whenNeeded:
          'Suitable if you have one or more missing teeth or are exploring stable alternatives to removable dentures.',
        procedureOverview:
          'During your consultation, the clinician reviews your medical history, assesses surrounding gum tissues, and outlines phased evaluation steps and timelines.',
        faqs: [
          {
            question: 'Am I immediately scheduled for implant placement on day one?',
            answer:
              'No. The first visit is a thorough consultation and assessment to determine clinical suitability and plan diagnostic imaging.',
          },
          {
            question: 'Why is gum health checked before implants?',
            answer:
              'Healthy periodontal tissues help support long-term stability around implants, so any gum inflammation is addressed first.',
          },
        ],
        imageUrl: '/src/assets/images/dental_implant_periodontics_1794820373161.jpg',
        durationMinutes: 45,
        consultationFeeInr: 500,
      },
      {
        slug: 'root-canal-treatment',
        title: 'Root Canal Treatment',
        category: 'Endodontics & Restorative',
        shortDescription:
          'Consultation and endodontic care aimed at relieving deep tooth pain and preserving natural teeth.',
        introduction:
          'When decay or injury reaches the inner pulp of a tooth, root canal treatment helps clean the canal space and preserve your natural tooth structure.',
        whatItInvolves:
          'Diagnostic evaluation of the affected tooth, local anesthesia for comfort, careful cleaning and shaping of the root canals, and sealing of the tooth.',
        whenNeeded:
          'May be advised for lingering sensitivity to hot or cold, pain on biting, deep cavities, or swelling near a tooth.',
        procedureOverview:
          'Following clinical examination and radiographic assessment, the dentist confirms whether root canal therapy is appropriate and explains the steps and follow-up crown needs.',
        faqs: [
          {
            question: 'Is a crown always needed after root canal treatment?',
            answer:
              'Depending on the remaining tooth structure, a protective crown is often discussed to strengthen back teeth.',
          },
          {
            question: 'How many visits does root canal care take?',
            answer:
              'Depending on the tooth anatomy and clinical findings, care may be completed in one or more appointments.',
          },
        ],
        imageUrl: '/src/assets/images/restorative_dental_care_1794820399300.jpg',
        durationMinutes: 60,
        consultationFeeInr: 500,
      },
      {
        slug: 'wisdom-tooth-removal',
        title: 'Wisdom Tooth Removal',
        category: 'Oral Surgery',
        shortDescription:
          'Careful assessment and planned removal of troublesome or impacted third molars.',
        introduction:
          'Wisdom teeth can sometimes erupt at an angle or remain partially covered by gum tissue, making them difficult to clean and prone to recurrent discomfort.',
        whatItInvolves:
          'Clinical examination, review of jaw imaging to see root and nerve proximity, local anesthesia, and atraumatic removal when indicated.',
        whenNeeded:
          'Evaluated when experiencing recurring gum soreness at the back of the jaw, food trapping, or pressure affecting neighboring teeth.',
        procedureOverview:
          'An initial assessment checks the position of the wisdom tooth before scheduling removal, with clear written aftercare instructions provided.',
        faqs: [
          {
            question: 'Do all wisdom teeth need to be removed?',
            answer:
              'Not necessarily. Only wisdom teeth causing symptoms, decay, gum infection, or risk to adjacent teeth are typically recommended for removal.',
          },
          {
            question: 'What aftercare is provided?',
            answer:
              'You receive clear post-visit instructions on rest, diet, and gentle oral hygiene during healing.',
          },
        ],
        imageUrl: '/src/assets/images/dental_care_consultation_1794820374752.jpg',
        durationMinutes: 45,
        consultationFeeInr: 500,
      },
      {
        slug: 'tooth-extraction',
        title: 'Tooth Extraction',
        category: 'Oral Surgery',
        shortDescription:
          'Gentle removal of severely damaged or non-restorable teeth with focus on patient comfort.',
        introduction:
          'While preserving natural teeth is always prioritized, extraction may occasionally be the healthiest choice when a tooth cannot be predictably restored.',
        whatItInvolves:
          'Assessment of the tooth and surrounding bone, effective local numbing, gentle elevation and removal, and socket care guidance.',
        whenNeeded:
          'Considered for teeth with severe structural breakdown, advanced periodontal mobility, or irreparable root fractures.',
        procedureOverview:
          'Your dentist reviews all options first, ensures complete local numbness before starting, and discusses tooth replacement options if desired.',
        faqs: [
          {
            question: 'Can I discuss replacement options before an extraction?',
            answer:
              'Yes. Replacement possibilities such as bridges or implants are discussed during treatment planning.',
          },
        ],
        imageUrl: '/src/assets/images/dental_care_consultation_1794820374752.jpg',
        durationMinutes: 30,
        consultationFeeInr: 500,
      },
      {
        slug: 'teeth-cleaning-and-scaling',
        title: 'Teeth Cleaning and Scaling',
        category: 'Preventive Care',
        shortDescription:
          'Ultrasonic scaling and gentle polishing to remove plaque, tartar, and surface stains.',
        introduction:
          'Regular professional teeth cleaning removes hardened calculus deposits that daily brushing and flossing cannot reach, supporting healthy gums and fresher breath.',
        whatItInvolves:
          'Ultrasonic scaling to gently dislodge tartar around and slightly below the gumline, followed by polishing and personalized home-care tips.',
        whenNeeded:
          'Typically recommended periodically as part of preventive oral hygiene or when visible tartar buildup or mild gum bleeding is present.',
        procedureOverview:
          'The session includes an initial gum check, gentle ultrasonic cleaning, polishing, and advice on brushing and interdental care.',
        faqs: [
          {
            question: 'Does scaling weaken or thin tooth enamel?',
            answer:
              'No. Ultrasonic scalers use gentle vibration and water to remove calculus deposits without cutting tooth enamel.',
          },
          {
            question: 'How often is professional cleaning advised?',
            answer:
              'Your dentist recommends an interval suited to your gum health and plaque accumulation, commonly every 6 to 12 months.',
          },
        ],
        imageUrl: '/src/assets/images/hero_dental_clinic_1794820372693.jpg',
        durationMinutes: 30,
        consultationFeeInr: 500,
      },
      {
        slug: 'dental-crowns-restorative-dentistry',
        title: 'Dental Crowns and Restorative Dentistry',
        category: 'Restorative Care',
        shortDescription:
          'Tooth-colored fillings, protective crowns, and restorative care tailored to function and aesthetics.',
        introduction:
          'Restorative dentistry repairs worn, chipped, or decayed teeth and protects structurally weakened teeth using natural-looking, durable materials.',
        whatItInvolves:
          'Evaluation of tooth structure and bite, composite restorations or tooth preparation for crowns, shade matching, and precise cementation.',
        whenNeeded:
          'Helpful for fractured cusps, large older fillings needing replacement, cavities, or post-root-canal tooth protection.',
        procedureOverview:
          'After examining the tooth and discussing material options, impressions or scans are taken to craft a well-fitting restoration.',
        faqs: [
          {
            question: 'How is crown shade matched?',
            answer:
              'Shade selection is performed in natural lighting alongside your adjacent teeth for a harmonious appearance.',
          },
        ],
        imageUrl: '/src/assets/images/restorative_dental_care_1794820399300.jpg',
        durationMinutes: 45,
        consultationFeeInr: 500,
      },
    ];

    const insertTr = db.prepare(`
      INSERT INTO treatments (
        slug, title, category, short_description, introduction, what_it_involves,
        when_needed, procedure_overview, faqs_json, image_url, duration_minutes,
        consultation_fee_inr, is_confirmed_available, is_active, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    seedTreatments.forEach((t, idx) => {
      insertTr.run(
        t.slug,
        t.title,
        t.category,
        t.shortDescription,
        t.introduction,
        t.whatItInvolves,
        t.whenNeeded,
        t.procedureOverview,
        JSON.stringify(t.faqs),
        t.imageUrl,
        t.durationMinutes,
        t.consultationFeeInr,
        0, // Proposed category until clinic confirms in Admin
        1,
        idx + 1,
      );
    });
  }

  // 5. Gallery Items (strictly marked is_official_photo = 0 until clinic uploads real photos)
  const galCount = db.prepare('SELECT COUNT(*) as c FROM gallery_items').get() as { c: number };
  if (galCount.c === 0) {
    const insertGal = db.prepare(
      `INSERT INTO gallery_items (title, category, image_url, caption, is_official_photo, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    insertGal.run(
      'Calm Treatment Suite Concept',
      'Treatment Rooms',
      '/src/assets/images/hero_dental_clinic_1794820372693.jpg',
      'Illustrative clinical preview — replace with official clinic photograph in Admin Dashboard.',
      0,
      1,
    );
    insertGal.run(
      'Welcoming Reception Lounge Concept',
      'Clinic Reception',
      '/src/assets/images/clinic_lounge_interior_1794820399310.jpg',
      'Illustrative interior preview — replace with official reception photograph in Admin Dashboard.',
      0,
      2,
    );
    insertGal.run(
      'Sterile Examination & Hygiene Suite',
      'Dental Equipment',
      '/src/assets/images/dental_care_consultation_1794820374752.jpg',
      'Illustrative clinical preview — replace with official equipment photograph in Admin Dashboard.',
      0,
      3,
    );
    insertGal.run(
      'Implant & Restorative Display',
      'Clinic Interior',
      '/src/assets/images/dental_implant_periodontics_1794820373161.jpg',
      'Illustrative educational visual — replace with official clinic photograph in Admin Dashboard.',
      0,
      4,
    );
    insertGal.run(
      'Ceramic Crown & Shade Matching',
      'Dental Equipment',
      '/src/assets/images/restorative_dental_care_1794820399300.jpg',
      'Illustrative educational visual — replace with official clinic photograph in Admin Dashboard.',
      0,
      5,
    );
  }

  // 6. FAQs (verified information only)
  const faqCount = db.prepare('SELECT COUNT(*) as c FROM faqs').get() as { c: number };
  if (faqCount.c === 0) {
    const insertFaq = db.prepare(
      `INSERT INTO faqs (question, answer, category, sort_order, is_published) VALUES (?, ?, ?, ?, ?)`,
    );
    const seedFaqs = [
      {
        q: 'How can I book a dental appointment?',
        a: 'You can book directly online using our appointment scheduler by choosing a treatment category, date, and available time slot, or contact us by phone or WhatsApp at +91 70263 70619.',
        c: 'Appointments',
      },
      {
        q: 'Where is Raghan Dental and Implant Care located?',
        a: 'The clinic is located at 4338/22/1, 14th Main, 1st Cross, 2nd Stage, Subramanyanagar, Bengaluru, Karnataka 560010, India. You can open directions directly via our Google Maps link.',
        c: 'Location',
      },
      {
        q: 'How can I contact the clinic?',
        a: 'You can call +91 70263 70619, message us on WhatsApp at +91 70263 70619, or submit an enquiry through the Contact form on this website.',
        c: 'Contact',
      },
      {
        q: 'What should I expect during my first dental consultation?',
        a: 'Your first visit focuses on understanding your oral health concerns, reviewing relevant medical history, conducting a gentle dental and gum examination, and explaining findings clearly before suggesting any treatment.',
        c: 'Consultations',
      },
      {
        q: 'Do I need to book an appointment before visiting?',
        a: 'Booking an appointment in advance is strongly recommended so we can reserve dedicated consultation time for you and minimize waiting at the clinic.',
        c: 'Appointments',
      },
      {
        q: 'What treatments can I enquire about?',
        a: 'You can enquire about general dental consultations, gum treatment and periodontal care, dental implant consultations, teeth cleaning and scaling, root canal treatment, wisdom tooth removal, tooth extraction, and restorative crowns.',
        c: 'Treatments',
      },
      {
        q: 'How can I reschedule my appointment?',
        a: 'If you need to change your scheduled date or time, please call or message the clinic on +91 70263 70619 with your booking reference code at least 4 hours prior to your visit.',
        c: 'Appointments',
      },
    ];
    seedFaqs.forEach((f, idx) => insertFaq.run(f.q, f.a, f.c, idx + 1, 1));
  }
}

initSchema();
seedIfEmpty();

// Typed Query Helpers
export function getSettings(): ClinicSettings {
  const row = db.prepare('SELECT value_json FROM clinic_settings WHERE key = ?').get('main') as
    | { value_json: string }
    | undefined;
  if (!row) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value_json) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(updated: Partial<ClinicSettings>): ClinicSettings {
  const current = getSettings();
  const merged = { ...current, ...updated };
  db.prepare(
    `INSERT INTO clinic_settings (key, value_json, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = datetime('now')`,
  ).run('main', JSON.stringify(merged));
  return merged;
}

function mapDoctor(row: Record<string, unknown>): Doctor {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    qualifications: String(row.qualifications),
    specialization: String(row.specialization),
    experienceNote: String(row.experience_note),
    languages: String(row.languages),
    bio: String(row.bio),
    photoUrl: String(row.photo_url || ''),
    isPhotoVerified: Boolean(row.is_photo_verified),
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order),
  };
}

export function listDoctors(activeOnly = false): Doctor[] {
  const sql = activeOnly
    ? 'SELECT * FROM doctors WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    : 'SELECT * FROM doctors ORDER BY sort_order ASC, id ASC';
  const rows = db.prepare(sql).all() as Array<Record<string, unknown>>;
  return rows.map(mapDoctor);
}

export function getDoctorById(id: number): Doctor | null {
  const row = db.prepare('SELECT * FROM doctors WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? mapDoctor(row) : null;
}

function mapTreatment(row: Record<string, unknown>): Treatment {
  let faqs = [];
  try {
    faqs = JSON.parse(String(row.faqs_json || '[]'));
  } catch {
    faqs = [];
  }
  return {
    id: Number(row.id),
    slug: String(row.slug),
    title: String(row.title),
    category: String(row.category),
    shortDescription: String(row.short_description),
    introduction: String(row.introduction),
    whatItInvolves: String(row.what_it_involves),
    whenNeeded: String(row.when_needed),
    procedureOverview: String(row.procedure_overview),
    faqs,
    imageUrl: String(row.image_url || ''),
    durationMinutes: Number(row.duration_minutes),
    consultationFeeInr: Number(row.consultation_fee_inr),
    isConfirmedAvailable: Boolean(row.is_confirmed_available),
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order),
  };
}

export function listTreatments(activeOnly = false): Treatment[] {
  const sql = activeOnly
    ? 'SELECT * FROM treatments WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    : 'SELECT * FROM treatments ORDER BY sort_order ASC, id ASC';
  const rows = db.prepare(sql).all() as Array<Record<string, unknown>>;
  return rows.map(mapTreatment);
}

export function getTreatmentById(id: number): Treatment | null {
  const row = db.prepare('SELECT * FROM treatments WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? mapTreatment(row) : null;
}

export function listGallery(): GalleryItem[] {
  const rows = db
    .prepare('SELECT * FROM gallery_items ORDER BY sort_order ASC, id ASC')
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    title: String(r.title),
    category: String(r.category) as GalleryItem['category'],
    imageUrl: String(r.image_url),
    caption: String(r.caption || ''),
    isOfficialPhoto: Boolean(r.is_official_photo),
    sortOrder: Number(r.sort_order),
  }));
}

export function listTestimonials(approvedOnly = false): Testimonial[] {
  const sql = approvedOnly
    ? 'SELECT * FROM testimonials WHERE is_approved = 1 ORDER BY id DESC'
    : 'SELECT * FROM testimonials ORDER BY id DESC';
  const rows = db.prepare(sql).all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    patientName: String(r.patient_name),
    treatmentName: String(r.treatment_name || ''),
    quote: String(r.quote),
    visitDate: String(r.visit_date || ''),
    isApproved: Boolean(r.is_approved),
    source: String(r.source || 'Clinic Feedback'),
    createdAt: String(r.created_at),
  }));
}

export function listFaqs(publishedOnly = false): FaqItem[] {
  const sql = publishedOnly
    ? 'SELECT * FROM faqs WHERE is_published = 1 ORDER BY sort_order ASC, id ASC'
    : 'SELECT * FROM faqs ORDER BY sort_order ASC, id ASC';
  const rows = db.prepare(sql).all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    question: String(r.question),
    answer: String(r.answer),
    category: String(r.category),
    sortOrder: Number(r.sort_order),
    isPublished: Boolean(r.is_published),
  }));
}

export function listBlockedDates(): BlockedDate[] {
  const rows = db
    .prepare('SELECT * FROM blocked_dates ORDER BY date ASC, id ASC')
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    date: String(r.date),
    doctorId: r.doctor_id === null ? null : Number(r.doctor_id),
    startTime: r.start_time === null ? null : String(r.start_time),
    endTime: r.end_time === null ? null : String(r.end_time),
    reason: String(r.reason || ''),
  }));
}

export function mapAppointment(r: Record<string, unknown>): Appointment {
  let notificationLog = [];
  try {
    notificationLog = JSON.parse(String(r.notification_log_json || '[]'));
  } catch {
    notificationLog = [];
  }
  return {
    id: Number(r.id),
    referenceCode: String(r.reference_code),
    treatmentId: Number(r.treatment_id),
    treatmentTitle: String(r.treatment_title),
    doctorId: Number(r.doctor_id),
    doctorName: String(r.doctor_name),
    appointmentDate: String(r.appointment_date),
    appointmentTime: String(r.appointment_time),
    durationMinutes: Number(r.duration_minutes),
    patientName: String(r.patient_name),
    patientPhone: String(r.patient_phone),
    patientEmail: String(r.patient_email || ''),
    patientType: String(r.patient_type) as Appointment['patientType'],
    notes: String(r.notes || ''),
    status: String(r.status) as Appointment['status'],
    paymentStatus: String(r.payment_status) as Appointment['paymentStatus'],
    paymentAmountInr: Number(r.payment_amount_inr),
    razorpayOrderId: String(r.razorpay_order_id || ''),
    razorpayPaymentId: String(r.razorpay_payment_id || ''),
    notificationLog,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function listAppointments(): Appointment[] {
  const rows = db
    .prepare('SELECT * FROM appointments ORDER BY appointment_date DESC, appointment_time DESC, id DESC')
    .all() as Array<Record<string, unknown>>;
  return rows.map(mapAppointment);
}

export function listEnquiries(): ContactEnquiry[] {
  const rows = db
    .prepare('SELECT * FROM enquiries ORDER BY id DESC')
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    phone: String(r.phone),
    email: String(r.email || ''),
    subject: String(r.subject || ''),
    message: String(r.message),
    status: String(r.status) as ContactEnquiry['status'],
    createdAt: String(r.created_at),
  }));
}
