'use strict';
/* Required employment notices for staff, kept with the Teacher Policies and Procedures. Every notice links to its official
   agency page and never copies a notice's text. Each was checked on the date below against the agency pages named, by
   search, since the pages themselves could not be opened while this list was built. A notice marked unconfirmed waits
   for the director to open its official link and confirm the rule. */
const CHECKED = '2026-10-25';
const DIR_POSTINGS = 'https://www.dir.ca.gov/wpnodb.html';
const DLSE_POSTERS = 'https://dir.ca.gov/dlse/RequiredPosters.html';
const EDD_NOTICES = 'https://edd.ca.gov/en/payroll_taxes/required_notices_and_pamphlets/';
const CRD_PUBS = 'https://calcivilrights.ca.gov/publications/';
const KYR_LETTER = 'https://dir.ca.gov/DLSE/LCO-Letter-to-Employers-New-Laws-2026.pdf';

// the posters that hang in the staff area, for finding and replacing them
const POSTERS = [
  { id: 'minwage', title: 'California minimum wage', agency: 'Department of Industrial Relations, Labor Commissioner', url: DLSE_POSTERS, when: 'Replaced each year when the new rate is published' },
  { id: 'wageorder', title: 'The Industrial Welfare Commission wage order for Fulton\'s industry', agency: 'Department of Industrial Relations, Labor Commissioner', url: DLSE_POSTERS, when: 'Kept current' },
  { id: 'payday', title: 'Pay day notice', agency: 'Department of Industrial Relations, Labor Commissioner', url: DLSE_POSTERS, when: 'Kept current' },
  { id: 'sickleave', title: 'Paid sick leave', agency: 'Department of Industrial Relations, Labor Commissioner', url: DLSE_POSTERS, when: 'Kept current' },
  { id: 'whistle', title: 'Whistleblower protections, in lettering larger than 14 point', agency: 'Department of Industrial Relations, Labor Commissioner', url: DIR_POSTINGS, when: 'Kept current' },
  { id: 'calosha', title: 'Safety and Health Protection on the Job', agency: 'Department of Industrial Relations, Cal/OSHA', url: DIR_POSTINGS, when: 'Kept current. California\'s own plan, used in place of the federal OSHA poster' },
  { id: 'emergencynums', title: 'Emergency phone numbers, form S-500', agency: 'Department of Industrial Relations, Cal/OSHA', url: DIR_POSTINGS, when: 'Kept current' },
  { id: 'nosmoking', title: 'No smoking', agency: 'Department of Industrial Relations', url: DIR_POSTINGS, when: 'Kept current' },
  { id: 'wcomp', title: 'Workers\' compensation notice to employees', agency: 'Department of Industrial Relations, Division of Workers\' Compensation', url: DIR_POSTINGS, when: 'Kept current, with the insurer\'s details' },
  { id: 'edd1857', title: 'Notice to Employees, DE 1857A', agency: 'Employment Development Department', url: EDD_NOTICES, when: 'Kept current' },
  { id: 'crdharass', title: 'California Law Prohibits Workplace Discrimination and Harassment', agency: 'Civil Rights Department', url: CRD_PUBS, when: 'Kept current. Required of every employer' },
  { id: 'crdpreg', title: 'Your Rights and Obligations as a Pregnant Employee', agency: 'Civil Rights Department', url: CRD_PUBS, when: 'Kept current. For employers of five or more' },
  { id: 'crdcfra', title: 'Family Care and Medical Leave and Pregnancy Disability Leave', agency: 'Civil Rights Department', url: CRD_PUBS, when: 'Kept current. For employers of five or more' },
  { id: 'flsa', title: 'Employee Rights Under the Fair Labor Standards Act', agency: 'U.S. Department of Labor, Wage and Hour Division', url: 'https://www.dol.gov/agencies/whd/posters/flsa', when: 'Kept current' },
  { id: 'eppa', title: 'Employee Polygraph Protection Act', agency: 'U.S. Department of Labor', url: 'https://www.dol.gov/general/topics/posters', when: 'Kept current' },
  { id: 'userra', title: 'Your Rights Under USERRA', agency: 'U.S. Department of Labor', url: 'https://www.dol.gov/general/topics/posters', when: 'Kept current' },
  { id: 'eeoc', title: 'Know Your Rights, Workplace Discrimination is Illegal', agency: 'U.S. Equal Employment Opportunity Commission', url: 'https://www.eeoc.gov/poster', when: 'For employers of 15 or more. Fulton\'s own count decides' },
  { id: 'fmla', title: 'Family and Medical Leave Act', agency: 'U.S. Department of Labor', url: 'https://www.dol.gov/general/topics/posters', when: 'For employers of 50 or more, so not at Fulton\'s size' },
].map(x => Object.assign({ checked: CHECKED, status: 'unconfirmed' }, x));

// what a new hire receives. A notice that is a filled-in form stays in the paper and QuickBooks Workforce hiring packet,
// and TREE only notes it is there. The others the new hire acknowledges in TREE, with the date on their records page.
const NEWHIRE = [
  { id: 'kyr', title: 'California Workplace Know Your Rights notice', agency: 'Department of Industrial Relations, Labor Commissioner', url: KYR_LETTER, when: 'At hire, then each year by February 1', how: 'ack' },
  { id: 'wcnotice', title: 'Workers\' compensation notice for new employees, once called the time of hire pamphlet', agency: 'Department of Industrial Relations, Division of Workers\' Compensation', url: 'https://dir.ca.gov/DIRNews/2024/2024-30.html', when: 'At hire or by the end of the first pay period', how: 'ack' },
  { id: 'de2515', title: 'Disability Insurance Provisions, DE 2515', agency: 'Employment Development Department', url: EDD_NOTICES, when: 'At hire', how: 'ack' },
  { id: 'de2511', title: 'Paid Family Leave, DE 2511', agency: 'Employment Development Department', url: EDD_NOTICES, when: 'At hire', how: 'ack' },
  { id: 'crdsh', title: 'Sexual harassment fact sheet', agency: 'Civil Rights Department', url: CRD_PUBS, when: 'Given to each employee. The timing at hire is unconfirmed', how: 'ack' },
  { id: 'wtpa', title: 'Wage Theft Prevention Act notice, Labor Code 2810.5, with paid sick leave', agency: 'Department of Industrial Relations, Labor Commissioner', url: DLSE_POSTERS, when: 'At hire', how: 'packet' },
].map(x => Object.assign({ checked: CHECKED, status: 'unconfirmed' }, x));

// the languages the Labor Commissioner names for the yearly notice. English is the default. Only the English file was
// seen by its own address, so each other language opens the Workplace Postings page, where its file is listed.
const KYR_LANGS = ['English', 'Spanish', 'Chinese, simplified', 'Chinese, traditional', 'Vietnamese', 'Korean', 'Tagalog', 'Hindi', 'Punjabi', 'Arabic', 'Urdu'];
const kyrLink = lang => lang === 'English' || !KYR_LANGS.includes(lang) ? 'https://www.dir.ca.gov/dlse/Know-Your-Rights-Notice/Know-Your-Rights-Notice-English.pdf' : DIR_POSTINGS;
// the ways of giving the yearly notice the official pages name, for the record TREE keeps
const KYR_WAYS = [['person', 'In person, on paper'], ['email', 'By email'], ['text', 'By text message']];
const KYR_RULES = { checked: CHECKED, status: 'unconfirmed', url: KYR_LETTER, postings: DIR_POSTINGS,
  languages: 'In a language the employee understands, where the Labor Commissioner offers the notice in it, and otherwise in English',
  ways: 'In the way Fulton usually reaches each employee, such as in person, by email or by text message, when it can reasonably be expected to arrive within one business day',
  due: 'By February 1 each year, and to each new hire at hire',
  emergency: 'Each employee may name an emergency contact, and say whether that person should be told if the employee is arrested or detained at work. Offered at hire and with the yearly notice, and the contact can be changed at any time' };

module.exports = { POSTERS, NEWHIRE, KYR_LANGS, KYR_WAYS, KYR_RULES, kyrLink, CHECKED };
