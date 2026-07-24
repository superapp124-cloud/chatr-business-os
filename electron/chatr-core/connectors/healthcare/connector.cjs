'use strict';

/**
 * CHATR Kernel v2.0 — Healthcare Connector
 *
 * Implements doctor search and appointment booking via Practo & Apollo 247.
 * Realistic simulation with specialties, fees, and availability slots.
 */

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

const MANIFEST = require('./manifest.json');

// ── Simulation data pools ────────────────────────────────────────────────────

const DOCTORS = [
  { name: 'Dr. Priya Sharma',    specialty: 'General Physician',    qualification: 'MBBS, MD',      experience: 12, fee: 500,  rating: 4.7, platform: 'practo' },
  { name: 'Dr. Anil Kapoor',     specialty: 'Cardiologist',         qualification: 'MBBS, DM Cardio', experience: 18, fee: 1200, rating: 4.8, platform: 'apollo' },
  { name: 'Dr. Sunita Rao',      specialty: 'Dermatologist',        qualification: 'MBBS, MD Derm',  experience: 10, fee: 800,  rating: 4.6, platform: 'practo' },
  { name: 'Dr. Rajesh Menon',    specialty: 'Orthopedic Surgeon',   qualification: 'MBBS, MS Ortho', experience: 15, fee: 1000, rating: 4.5, platform: 'apollo' },
  { name: 'Dr. Meera Nair',      specialty: 'Paediatrician',        qualification: 'MBBS, DCH',      experience: 8,  fee: 600,  rating: 4.6, platform: 'practo' },
  { name: 'Dr. Suresh Pillai',   specialty: 'ENT Specialist',       qualification: 'MBBS, MS ENT',   experience: 14, fee: 700,  rating: 4.4, platform: 'apollo' },
  { name: 'Dr. Kavita Joshi',    specialty: 'Gynaecologist',        qualification: 'MBBS, MS OBG',   experience: 16, fee: 900,  rating: 4.7, platform: 'practo' },
  { name: 'Dr. Mohammed Salim',  specialty: 'Neurologist',          qualification: 'MBBS, DM Neuro', experience: 20, fee: 1500, rating: 4.9, platform: 'apollo' }
];

const SLOTS = [
  '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM',
  '02:00 PM', '02:30 PM', '03:00 PM', '04:00 PM', '05:00 PM'
];

function _rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function _uuid()        { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function _pick(arr)     { return arr[_rnd(0, arr.length - 1)]; }

// ── HealthcareConnector ────────────────────────────────────────────────────────

class HealthcareConnector {
  constructor() {
    this.id   = MANIFEST.id;
    this.name = MANIFEST.name;
  }

  getManifest()  { return MANIFEST; }
  getProviders() { return MANIFEST.providers; }

  /**
   * Search for doctors.
   * @param {{ specialty?: string, location?: string, symptoms?: string }} params
   * @returns {Promise<{ doctors: object[] }>}
   */
  async searchDoctors(params) {
    log.info(`[HealthcareConnector] Searching doctors — specialty='${params.specialty || 'any'}', location='${params.location || 'any'}'`);
    return { options: this.simulateDoctors(params) };
  }

  /**
   * Book a doctor appointment.
   * @param {{ doctorId: string, slot: string }} params
   * @param {object} [session]
   * @returns {Promise<object>}
   */
  async bookAppointment(params, session = null) {
    log.info(`[HealthcareConnector] Booking appointment for doctor '${params.doctorId}' at '${params.slot}'`);
    return this.simulateBooking(params);
  }

  /**
   * Generate realistic doctor listings.
   * @param {{ specialty?: string, location?: string, symptoms?: string }} params
   * @returns {object[]}
   */
  simulateDoctors(params) {
    let pool = [...DOCTORS];

    // Filter by specialty if provided
    if (params.specialty) {
      const sp = params.specialty.toLowerCase();
      const filtered = pool.filter(d => d.specialty.toLowerCase().includes(sp));
      if (filtered.length > 0) pool = filtered;
    }

    // Map symptoms to specialty suggestions
    if (params.symptoms && !params.specialty) {
      const sym = params.symptoms.toLowerCase();
      if (sym.includes('heart') || sym.includes('chest')) {
        pool = pool.filter(d => d.specialty.includes('Cardio'));
        if (!pool.length) pool = DOCTORS.filter(d => d.specialty.includes('Cardio'));
      } else if (sym.includes('skin') || sym.includes('rash')) {
        pool = pool.filter(d => d.specialty.includes('Derm'));
        if (!pool.length) pool = DOCTORS.filter(d => d.specialty.includes('Derm'));
      } else if (sym.includes('child') || sym.includes('fever') || sym.includes('kid')) {
        pool = pool.filter(d => d.specialty.includes('Paed'));
        if (!pool.length) pool = DOCTORS.filter(d => d.specialty.includes('Paed'));
      }
    }

    // Limit to 4 results
    pool = pool.slice(0, 4);
    if (!pool.length) pool = DOCTORS.slice(0, 4);

    const today    = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return pool.map((d, i) => ({
      optionId:      `doc_${_uuid()}`,
      provider:      d.platform,
      providerName:  d.platform === 'practo' ? 'Practo' : 'Apollo 24/7',
      title:         d.name,
      subtitle:      `${d.specialty} · ${d.qualification} · ⭐ ${d.rating}`,
      price:         d.fee,
      currency:      'INR',
      availability:  'available',
      confidence:    _rnd(85, 99),
      badges:        d.rating >= 4.7 ? ['RECOMMENDED'] : [],
      
      // Original fields
      doctorId:      `doc_${_uuid()}`,
      platform:      d.platform,
      name:          d.name,
      specialty:     d.specialty,
      qualification: d.qualification,
      experienceYears: d.experience,
      consultationFee: d.fee,
      rating:        d.rating,
      reviewCount:   _rnd(50, 500),
      location:      params.location || 'Bangalore',
      clinicName:    `${d.name.replace('Dr. ', '')} Clinic`,
      availableSlots: [
        { date: today.toISOString().split('T')[0],     time: _pick(SLOTS), available: true },
        { date: today.toISOString().split('T')[0],     time: _pick(SLOTS), available: true },
        { date: tomorrow.toISOString().split('T')[0],  time: _pick(SLOTS), available: true }
      ],
      teleconsult: true
    }));
  }

  /**
   * Generate realistic appointment booking confirmation.
   * @param {{ doctorId: string, slot: string }} params
   * @returns {object}
   */
  simulateBooking(params) {
    return {
      appointmentId: `APT${Date.now()}`,
      doctorId:      params.doctorId,
      status:        'confirmed',
      time:          params.slot || _pick(SLOTS),
      date:          new Date().toISOString().split('T')[0],
      platform:      'practo',
      confirmationCode: `CHATR-${_rnd(100000, 999999)}`,
      instructions: 'Please carry your Aadhaar card and previous prescriptions.',
      bookedAt:     new Date().toISOString()
    };
  }

  simulateTask(task, parameters) {
    if (task === 'healthcare.search_doctors')    return { options: this.simulateDoctors(parameters) };
    if (task === 'healthcare.book_appointment') return this.simulateBooking(parameters);
    return { simulated: true, task, parameters };
  }
}

const healthcareConnector = new HealthcareConnector();
module.exports = { healthcareConnector, HealthcareConnector };
