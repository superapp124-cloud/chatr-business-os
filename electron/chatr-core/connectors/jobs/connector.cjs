'use strict';

/**
 * CHATR Kernel v2.0 — Jobs Connector
 *
 * Implements job description generation, job posting, and candidate search
 * across LinkedIn, Naukri, Indeed, and Foundit.
 *
 * JD generation uses a professional template engine — no AI call required.
 */

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

const MANIFEST = require('./manifest.json');

// ── Salary ranges by role ─────────────────────────────────────────────────────

const SALARY_MAP = {
  'software engineer':    { min: 8,  max: 20,  unit: 'LPA' },
  'senior engineer':      { min: 20, max: 40,  unit: 'LPA' },
  'backend developer':    { min: 10, max: 25,  unit: 'LPA' },
  'frontend developer':   { min: 8,  max: 20,  unit: 'LPA' },
  'fullstack developer':  { min: 10, max: 28,  unit: 'LPA' },
  'data scientist':       { min: 12, max: 30,  unit: 'LPA' },
  'product manager':      { min: 15, max: 35,  unit: 'LPA' },
  'devops engineer':      { min: 10, max: 28,  unit: 'LPA' },
  'engineering manager':  { min: 30, max: 60,  unit: 'LPA' },
  'default':              { min: 8,  max: 20,  unit: 'LPA' }
};

// ── Responsibilities by role category ─────────────────────────────────────────

const RESPONSIBILITIES = {
  engineering: [
    'Design, develop, and maintain high-quality scalable software systems.',
    'Collaborate with cross-functional teams to define, design, and ship new features.',
    'Write clean, maintainable, and well-documented code following best practices.',
    'Participate in code reviews and provide constructive feedback to peers.',
    'Identify and resolve performance bottlenecks and bugs.',
    'Contribute to technical architecture decisions and roadmap planning.',
    'Write and maintain unit, integration, and end-to-end tests.'
  ],
  management: [
    'Lead, mentor, and grow a team of high-performing engineers.',
    'Define and own the technical roadmap in alignment with business goals.',
    'Drive agile ceremonies including sprint planning, standups, and retrospectives.',
    'Partner with Product and Design to deliver exceptional user experiences.',
    'Establish engineering best practices, standards, and quality processes.',
    'Hire, onboard, and retain top engineering talent.',
    'Track and report engineering KPIs to leadership.'
  ],
  data: [
    'Build and deploy machine learning models for production use cases.',
    'Analyze large datasets to extract actionable insights for business decisions.',
    'Design and maintain data pipelines and ETL workflows.',
    'Collaborate with product and engineering teams to define data requirements.',
    'Develop dashboards and reports for business stakeholders.',
    'Conduct A/B tests and statistical analysis to evaluate product decisions.',
    'Ensure data quality, governance, and compliance standards are met.'
  ],
  default: [
    'Work closely with cross-functional teams to deliver impactful products.',
    'Take ownership of key deliverables from design to deployment.',
    'Contribute to improving team processes and technical standards.',
    'Participate in design discussions, code reviews, and sprint ceremonies.',
    'Communicate progress and blockers clearly to stakeholders.',
    'Continuously learn and apply new technologies to solve business problems.',
    'Support junior team members through mentorship and knowledge sharing.'
  ]
};

const BENEFITS = [
  'Competitive salary and performance-based bonuses',
  'Comprehensive health insurance for self and family',
  'Flexible working hours and remote-friendly culture',
  'Annual learning & development budget (₹50,000/year)',
  'Generous ESOPs / equity participation',
  '25 days of paid annual leave + public holidays',
  'State-of-the-art home office setup allowance',
  'Quarterly team offsites and annual company retreats',
  'Free meals and snacks at office',
  'Wellness reimbursement (gym, mental health, etc.)'
];

// ── Candidate simulation pools ────────────────────────────────────────────────

const CANDIDATE_NAMES = [
  'Arjun Mehta', 'Priyanka Sharma', 'Kiran Reddy', 'Neha Gupta', 'Rahul Nair',
  'Ananya Singh', 'Vikas Kumar', 'Divya Pillai', 'Siddharth Joshi', 'Pooja Agarwal',
  'Rohan Das', 'Sneha Patel', 'Abhishek Tiwari', 'Ritu Verma', 'Akash Malhotra'
];

const COMPANIES = [
  'Infosys', 'Wipro', 'TCS', 'HCL Technologies', 'Tech Mahindra',
  'Flipkart', 'Amazon India', 'Razorpay', 'Swiggy', 'CRED',
  'Freshworks', 'Zoho', 'PhonePe', 'Ola', 'Paytm'
];

const EDUCATION = ['B.Tech (CSE)', 'B.Tech (IT)', 'MCA', 'M.Tech', 'B.E. (CSE)', 'B.Sc (CS)'];

const SKILL_SETS = {
  javascript: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Express', 'MongoDB'],
  python:     ['Python', 'Django', 'FastAPI', 'Pandas', 'NumPy', 'Machine Learning'],
  java:       ['Java', 'Spring Boot', 'Hibernate', 'Microservices', 'Kafka', 'Docker'],
  react:      ['React', 'Redux', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Jest'],
  devops:     ['Docker', 'Kubernetes', 'AWS', 'Terraform', 'CI/CD', 'Linux'],
  default:    ['Problem Solving', 'Git', 'Agile', 'REST APIs', 'SQL', 'Communication']
};

function _rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function _pick(arr)     { return arr[_rnd(0, arr.length - 1)]; }
function _uuid()        { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ── JobsConnector ─────────────────────────────────────────────────────────────

class JobsConnector {
  constructor() {
    this.id   = MANIFEST.id;
    this.name = MANIFEST.name;
  }

  getManifest()  { return MANIFEST; }
  getProviders() { return MANIFEST.providers; }

  // ── JD Generation ──────────────────────────────────────────────────────────

  /**
   * Generate a professional Job Description from a template.
   * @param {{ role: string, skills?: string[], location?: string }} params
   * @returns {{ jd: string, keywords: string[], salaryRange: string }}
   */
  generateJD(params) {
    const role     = (params.role || 'Software Developer').trim();
    const skills   = params.skills && params.skills.length ? params.skills : this._inferSkills(role);
    const location = params.location || 'Bangalore, India (Hybrid)';

    const roleLower    = role.toLowerCase();
    const responsibilities = this._getResponsibilities(roleLower);
    const salaryInfo   = this._getSalary(roleLower);
    const salaryRange  = `₹${salaryInfo.min}–${salaryInfo.max} ${salaryInfo.unit}`;
    const niceToHave   = this._getNiceToHave(roleLower);
    const keywords     = [...skills, role, location.split(',')[0]].filter(Boolean);

    const jd = `
# ${role} — Job Description

## About the Company
[Company Name] is a fast-growing technology company building products that delight millions of users.
We are a team of passionate engineers, designers, and product thinkers driven by the mission to
solve real-world problems through technology.

## Role Overview
We are looking for a talented and motivated **${role}** to join our engineering team in ${location}.
You will work on challenging problems at scale, collaborate with some of the best minds in the industry,
and have a direct impact on the product roadmap.

## Key Responsibilities
${responsibilities.map(r => `- ${r}`).join('\n')}

## Required Skills & Qualifications
${skills.map(s => `- ${s}`).join('\n')}
- ${_rnd(2, 6)}+ years of relevant professional experience
- Strong problem-solving and communication skills
- Bachelor's or Master's degree in Computer Science, Engineering, or related field

## Nice to Have
${niceToHave.map(n => `- ${n}`).join('\n')}

## Benefits & Perks
${BENEFITS.slice(0, 6).map(b => `- ${b}`).join('\n')}

## Compensation
**CTC Range:** ${salaryRange}
*(Depending on skills, experience, and interview performance)*

## Location
${location}

---
*We are an equal-opportunity employer and value diversity. We do not discriminate on the basis of race, religion, gender, or any other protected characteristic.*
`.trim();

    log.info(`[JobsConnector] Generated JD for '${role}' (${skills.length} skills, ${salaryRange})`);
    return { jd, keywords, salaryRange };
  }

  // ── Job Posting ────────────────────────────────────────────────────────────

  /**
   * Post a job to multiple platforms.
   * @param {{ jd: string, platforms: string[], role: string }} params
   * @param {object[]} [sessions]
   * @returns {Promise<{ listings: object[] }>}
   */
  async post(params, sessions = []) {
    log.info(`[JobsConnector] Posting '${params.role}' to ${(params.platforms || []).join(', ')}`);
    return { listings: this.simulatePost(params) };
  }

  /**
   * Search for matching candidates.
   * @param {{ role: string, location?: string, experience?: string }} params
   * @returns {Promise<{ candidates: object[] }>}
   */
  async searchCandidates(params) {
    log.info(`[JobsConnector] Searching candidates for '${params.role}'`);
    return { options: this.simulateSearch(params) };
  }

  // ── Simulation ─────────────────────────────────────────────────────────────

  /**
   * Simulate job posting results.
   */
  simulatePost(params) {
    const platforms = params.platforms || ['linkedin', 'naukri', 'indeed'];
    const role      = params.role || 'Software Developer';
    const slug      = role.toLowerCase().replace(/\s+/g, '-');

    return platforms.map(platform => ({
      platform,
      listingId:  `${platform}_${_uuid()}`,
      listingUrl: `https://www.${platform}.com/jobs/view/${slug}-${_uuid()}`,
      status:     'live',
      postedAt:   new Date().toISOString(),
      expiresAt:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      viewCount:  0,
      applications: 0
    }));
  }

  /**
   * Simulate candidate search results — returns 5 realistic candidates.
   */
  simulateSearch(params) {
    const role     = (params.role || 'Software Developer').toLowerCase();
    const location = params.location || 'Bangalore';
    const exp      = parseInt(params.experience) || 3;

    const skillKey = Object.keys(SKILL_SETS).find(k => role.includes(k)) || 'default';
    const skills   = SKILL_SETS[skillKey];

    const candidates = [];
    const usedNames  = new Set();

    while (candidates.length < 5) {
      const name = _pick(CANDIDATE_NAMES);
      if (usedNames.has(name)) continue;
      usedNames.add(name);

      const yearsExp = _rnd(exp, exp + 4);
      const candidateSkills = skills.slice(0, _rnd(3, skills.length));

      const ctc = _rnd(12, 45);
      const noticePeriod = _pick(['Immediate', '15 Days', '30 Days', '60 Days', '90 Days']);
      const source = _pick(['linkedin', 'naukri', 'indeed']);
      candidates.push({
        optionId: `cand_${_uuid()}`,
        provider: source,
        providerName: source === 'linkedin' ? 'LinkedIn' : source === 'naukri' ? 'Naukri' : 'Indeed',
        title: name,
        subtitle: `${yearsExp > 5 ? 'Senior' : ''} ${params.role || 'Developer'} @ ${_pick(COMPANIES)}`,
        price: ctc * 100000,
        currency: 'INR',
        availability: 'available',
        confidence: _rnd(70, 98),
        badges: [noticePeriod],

        // Original fields
        candidateId: `cand_${_uuid()}`,
        name,
        currentRole:    `${yearsExp > 5 ? 'Senior' : ''} ${params.role || 'Developer'}`.trim(),
        currentCompany: _pick(COMPANIES),
        yearsExperience: yearsExp,
        location:       `${location}, India`,
        education:      _pick(EDUCATION),
        skills:         candidateSkills,
        noticePeriod:   noticePeriod,
        currentCTC:     `₹${_rnd(8, 30)} LPA`,
        expectedCTC:    `₹${ctc} LPA`,
        source:         source,
        profileScore:   _rnd(70, 98),
        availableForContact: Math.random() > 0.2
      });
    }

    return candidates;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  _inferSkills(role) {
    const r = role.toLowerCase();
    if (r.includes('react') || r.includes('frontend'))    return SKILL_SETS.react;
    if (r.includes('python') || r.includes('data'))       return SKILL_SETS.python;
    if (r.includes('java'))                               return SKILL_SETS.java;
    if (r.includes('devops') || r.includes('cloud'))      return SKILL_SETS.devops;
    if (r.includes('node') || r.includes('javascript'))   return SKILL_SETS.javascript;
    return ['JavaScript', 'Python', 'SQL', 'Git', 'REST APIs', 'Agile'];
  }

  _getResponsibilities(roleLower) {
    if (roleLower.includes('manager') || roleLower.includes('lead')) return RESPONSIBILITIES.management;
    if (roleLower.includes('data') || roleLower.includes('ml'))      return RESPONSIBILITIES.data;
    if (roleLower.includes('engineer') || roleLower.includes('dev'))  return RESPONSIBILITIES.engineering;
    return RESPONSIBILITIES.default;
  }

  _getSalary(roleLower) {
    for (const [key, val] of Object.entries(SALARY_MAP)) {
      if (roleLower.includes(key)) return val;
    }
    return SALARY_MAP.default;
  }

  _getNiceToHave(roleLower) {
    const base = [
      'Experience with cloud platforms (AWS / GCP / Azure)',
      'Open source contributions',
      'Startup or fast-growth environment experience'
    ];
    if (roleLower.includes('engineer') || roleLower.includes('dev')) {
      base.push('Experience with distributed systems or microservices architecture');
    }
    if (roleLower.includes('data') || roleLower.includes('ml')) {
      base.push('Experience with MLOps tooling (MLflow, Kubeflow, SageMaker)');
    }
    return base;
  }

  simulateTask(task, parameters) {
    if (task === 'jobs.generate_jd')        return this.generateJD(parameters);
    if (task === 'jobs.post')               return { listings: this.simulatePost(parameters) };
    if (task === 'jobs.search_candidates')  return { options: this.simulateSearch(parameters) };
    return { simulated: true, task, parameters };
  }
}

const jobsConnector = new JobsConnector();
module.exports = { jobsConnector, JobsConnector };
