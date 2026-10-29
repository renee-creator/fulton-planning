/* The Educators pages' own words, the lines that explain records, notices and paperwork, each training's note and each
   paper's reason, the New Educator checklist, the PD library's descriptions and the Growth questions. The director edits
   them in place, as the page staff/wording/educator-pages-text.md, each part one line or paragraph, its heading its name.
   These are the words as they first read, used until a part is written there, and the page starts from them the first
   time she opens it. Words in braces, such as {goTo}, are filled in and stay as they are. A part of two paragraphs keeps
   a title above its question. The regulation names, their links and the eight growth areas stay in the code. */
const TEXT = [
  ['Add a new educator', 'They sign in with their first name before their first day and reach only the New Educator section. You turn on full access once their clearances are in.'],
  ['Record a training for a group', 'For an in-house Pediatric First Aid and CPR class, or the yearly emergency and disaster plan training. Everyone chosen gets the same date, and the class roster is kept with each record.'],
  ['The flu vaccine, when it is due', 'Due each year between August 1 and December 1.'],
  ['Proof of enrollment, below twelve units', 'Below twelve units, upload proof of enrollment each semester until you reach twelve.'],
  ['Continuing hours, what counts', 'Only courses from Department-approved sources count toward the 12 continuing hours required each year from October 1, 2027. Licensing at Fulton Community School, PD modules and PD days count toward our own professional development hours.'],
  ['Continuing hours, the required topics', 'Only courses from Department-approved sources count toward the 12 hours. The required topics are emergency and disaster preparedness, building and premises safety including bodies of water and traffic, safe sleep, prevention of shaken baby syndrome and child maltreatment, transporting children safely, infectious diseases, food and allergy emergencies, hazardous materials and biocontaminants, and giving medication with family consent.'],
  ['Immunizations, on a records page', 'California requires everyone who works at a child care center to be immunized against influenza, pertussis and measles, under Health and Safety Code 1596.7995. Records and exemptions are seen only by {who} and the director.'],
  ['Immunizations, for a new educator', 'California requires everyone who works or volunteers at a child care center to be immunized against influenza, pertussis and measles, under Health and Safety Code 1596.7995.'],
  ['Immunizations, where they are kept', 'Records or exemptions are kept in the personnel file. In TREE they are seen only by you and the director.'],
  ['Suggested Focus Until Next Time', 'A licensing item marked Let\'s review together becomes a suggested focus, which {who} and the director confirm together.'],
  ['Licensing and Safety', 'Go over the list together at the August PD day and when a new educator starts. Let\'s review together adds a suggested Focus Until Next Time, which you confirm together.'],
  ['Notices for a new educator', 'Each notice comes from the agency that publishes it. Read it on the official page, or on the copy the director gives you, then say you have received it.'],
  ['Workplace posters', 'The posters still hang in the staff area. This list is for finding and replacing them.'],
  ['New hire notices', 'Shown in the New Educator section. A filled-in form stays in the paper and QuickBooks Workforce hiring packet.'],
  ['The go-to person, for the director', '{goTo} answers their questions, walks them through paperwork and routines, and checks in briefly at the end of each of their first weeks. The educators on their class team help on the floor every day.'],
  ['The go-to person, for a new educator', '{goTo} answers your questions, walks you through paperwork and routines, and checks in with you briefly at the end of each of your first weeks. The educators on your class team help you on the floor every day. You can bring {goTo} into your starting-point conversation if you like.'],
  ['Paperwork', 'Each form has a blank copy to download and print, and a place to upload the completed form as a photo or PDF. Uploads save to the school\'s Google Drive. Payroll and tax forms are completed in QuickBooks Workforce.'],
  ['Social Security card and driver\'s license', 'Shown to the director in person and copied for the paper personnel file only. They are never uploaded to TREE.'],
  ['Growth Plan reflection, what was difficult', 'What was difficult for me'],
  ['Growth Plan reflection, a moment I am proud of', 'A moment I\'m proud of'],
  ['Growth Plan reflection, what comes naturally', 'What comes naturally'],
  ['Growth Plan reflection, what drains me', 'What drains me'],
  ['Growth Plan reflection, a pattern', 'A pattern I keep noticing'],
  ['Growth Plan reflection, why these goals', 'Why these goals'],
  ['Growth Plan, what went well last year', 'What went well for me last year'],
  ['Growth Plan, the first weeks', 'What has gone well in my first weeks here, or in my work before coming here'],
  ['Journal prompt, joy', 'A moment of joy\n\nA moment that brought me joy this week.'],
  ['Journal prompt, a challenge', 'A challenge I navigated\n\nA challenge I worked through this week, and what I learned from it.'],
  ['Journal prompt, a connection', 'A connection I made\n\nOne meaningful connection I made with a child, a family or a colleague.'],
  ['Journal prompt, my language', 'My language this week\n\nSomething I noticed about my own words or tone this week, and one language strategy I will practice next week.'],
  ['Check-in, professional temperature', 'Professional temperature, about 2 minutes\n\nHow has the last month felt? The educator gives their own number from 1 to 5, and you add yours beside it.'],
  ['Check-in, plus delta', 'Plus delta, about 7 minutes\n\nWhat went well this month, and what they would change, side by side. This is the place for strong moments, stretches and challenges.'],
  ['Check-in, Growth Plan check', 'Growth Plan check, about 3 minutes\n\nA line on where they are with their Growth Plan goals.'],
  ['Check-in, one support', 'One support, about 2 minutes\n\nOne support they need from you or their teammates.'],
  ['Check-in, Focus Until Next Time', 'Focus Until Next Time, about 5 minutes\n\nThe educator names what they want to focus on first. You add what you have seen, and the two of you settle on one focus together.'],
  ['After a check-in, follow-up notes', 'Follow-up notes\n\nSpecific actions, agreements and timelines, with any leadership follow-up.'],
  ['After a check-in, team alignment', 'Team alignment\n\nHow aligned the team is in routines, expectations and communication, from 1 to 5.'],
  ['After a check-in, how well it served them', 'Check-in effectiveness\n\nHow well the check-in served them, from 1 to 5.']
];
// the Growth questions in the code, by their key, and the part that words each
const GROWTH = { refl: { difficult: 'Growth Plan reflection, what was difficult', proud: 'Growth Plan reflection, a moment I am proud of', natural: 'Growth Plan reflection, what comes naturally', drains: 'Growth Plan reflection, what drains me', pattern: 'Growth Plan reflection, a pattern', why: 'Growth Plan reflection, why these goals' },
  went: { last: 'Growth Plan, what went well last year', new: 'Growth Plan, the first weeks' },
  prompts: { joy: 'Journal prompt, joy', challenge: 'Journal prompt, a challenge', connection: 'Journal prompt, a connection', language: 'Journal prompt, my language' },
  checkin: { temp: 'Check-in, professional temperature', plusdelta: 'Check-in, plus delta', goals: 'Check-in, Growth Plan check', support: 'Check-in, one support', focus: 'Check-in, Focus Until Next Time' },
  after: { followup: 'After a check-in, follow-up notes', align: 'After a check-in, team alignment', effect: 'After a check-in, how well it served them' } };
const PAGE = 'staff/wording/educator-pages-text.md';
// the parts that come from the records definitions, each named by what it words, so a change never moves a record
const fromDefs = ({ items, papers, checklist, modules }) => [
  ...(items || []).filter(it => it.note).map(it => ['Training, ' + it.label, it.note]),
  ...(papers || []).filter(x => x.why).map(x => ['Paper, ' + x.form, x.why]),
  ...(checklist || []).map((c, i) => ['New Educator checklist, item ' + (i + 1), c]),
  ...(modules || []).map(([, t, d]) => ['PD library, ' + t, d])];
const all = defs => [...TEXT, ...fromDefs(defs || {})];
const defaults = defs => Object.fromEntries(all(defs));
const startPage = defs => '# The Educators pages\' own words\n\nThe lines that explain records, notices and paperwork, each training\'s note and each paper\'s reason, the New Educator checklist, the PD library\'s descriptions until a module is written, and the Growth questions. Words in braces, such as {goTo}, are filled in. Keep them as they are. A part of two paragraphs keeps its title above its question.\n\n' +
  all(defs).map(([k, t]) => '## ' + k + '\n\n' + t + '\n').join('\n');
module.exports = { TEXT, GROWTH, PAGE, defaults, startPage };
