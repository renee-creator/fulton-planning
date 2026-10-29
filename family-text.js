/* The Family page's own words, the lines that explain each step and section to a family. The director edits them in
   place, as the page staff/wording/family-page-text.md, each part one line or paragraph, its heading its name. These are
   the words as they first read, used until a part is written there, and the page starts from them the first time she
   opens it. Words in braces, such as {first}, are filled in for each family and stay as they are. */
const TEXT = [
  ['First steps, the Family Handbook', 'Required before enrollment. Please read the Family Handbook in full.'],
  ['First steps, enrollment information', 'Required. Your answers complete the state licensing forms, which you sign at your visit.'],
  ['First steps, enrollment information in progress', 'In progress. Every box is required before your visit.'],
  ['First steps, enrollment information complete', 'Complete. The state licensing forms will be ready for your signature at your visit.'],
  ['First steps, admission agreement', 'Required. Complete every section, initial each term and sign.'],
  ['First steps, admission agreement in progress', 'In progress. Every section, initial and signature is required before your visit.'],
  ['First steps, Family Questionnaire', 'Required. Your answers help your child\'s educators get to know your family.'],
  ['First steps, Family Questionnaire received', 'Received. Your child\'s educators will read it before your visit.'],
  ['First steps, your visit', 'Required. Choose a time for your visit.'],
  ['First steps, your visit chosen', 'Please bring the doctor\'s report and immunization record.'],
  ['First steps, bring to your visit', 'The Physician\'s Report signed by your doctor, and your child\'s immunization record (the yellow or blue card, CDPH 286) showing the shots required for child care. The originals, please, since a photo cannot be accepted.'],
  ['First steps, All About Me book', 'Four pages with photos and words about your child. We print and laminate it.'],
  ['First steps, All About Me book ready', 'Ready. We print and laminate it for your child.'],
  ['First steps, the notices', 'Required. Your rights as a parent and other notices the state requires every family to receive. You sign for them at your visit.'],
  ['First steps, ready for the first day', 'Rain gear and spare clothes stay at school all season.'],
  ['Toilet learning at our school', 'When and how a child learns to use the toilet is very individual, and most children are out of diapers by three and a half. Children show they are ready when they want to use the toilet, tell you about a wet or soiled diaper, can pull their own pants up and down, notice when they are going, and have had a weekend at home without accidents.\n\nPower struggles are common, since children learn they have control over their bodies. Stay calm and matter of fact, and if it becomes a struggle, take the pressure off and wait for your child\'s interest.\n\nChildren at our school use the bathroom independently. Before your child comes to school in underwear, they need to be fully independent and tell us when they need to go. Until then, please send diapers or pull-ups. Talk with your child\'s educators any time.'],
  ['All About Me book, on a child\'s page', 'Photos and words about your child, which we print and laminate for the classroom.'],
  ['All About Me book, made', '{pages} pages. Add a page with new photos any time, and we print it for {first}\'s book.'],
  ['Before the conference', 'A few questions to think about at home. Your answers go to {first}\'s educators before you meet.'],
  ['What our family can share', 'Something you know, love to do, or could share with the children, such as a craft, a language, music, building or cooking. Educators may invite you in when it fits what the children are exploring.'],
  ['What our family can share, again', 'Anything new your family would like to share this season? Your last answer is below.'],
  ['Share a specialty or passion', 'A craft, a trade, music, a language, a tradition or anything your family loves. The director reads each idea first and talks with a class team about when it fits what the children are exploring. Volunteers are never alone with children. An educator is always with the group.'],
  ['Participation hours', 'Each child takes part for {goal} hours a year. Every entry rounds up to the next whole hour.'],
  ['Our seed library', 'Seeds we share with families. Ask at the office.'],
  ['Our site', 'The classes, the yards, the garden and the farm, from above. Pinch or use the zoom buttons to look closer.'],
  ['Gatherings', 'Second Saturday each month, Play Garden and our work days, for the whole family. Sign up to come, or for a job, and log your hours after the day.'],
  ['Ways to take part, when none are posted', 'Nothing is posted right now. New ways to take part will appear here.'],
  ['Our wish list', 'Things the school would love, from fruit trees to art materials. Bringing one counts toward your hours.'],
  ['Share a family recipe', 'The director reads each recipe before it joins our recipe library. We are nut free, so please share recipes without nuts. You can log the time it took above, as you would any way of taking part.'],
  ['The Family Handbook, read and acknowledge', 'Please read the {year} Family Handbook, then say so. It counts for {names}.'],
  ['The Family Handbook, the current edition', 'The current edition. Open a part to read it.'],
  ['The Family Handbook, an earlier edition', 'An earlier edition, kept to read. Open a part to read it.'],
  ['The Family Handbook, for each child', 'Required before enrollment.'],
  ['The admission agreement', 'This agreement is a legal document. We have filled in what we already have from your enrollment information. Please check each entry and complete every section, initial each term and sign. Every part is required.'],
  ['The admission agreement, program', 'Choose one program.'],
  ['The admission agreement, early care and after care', 'Early Care and After Care, if your family needs them.'],
  ['The admission agreement, tuition', 'Please read carefully, initial and sign. Type your initials, then tap the box beside each term to initial it.'],
  ['Notices for every family', 'The state asks every child care center to give these to families. Please read them before your visit. You sign that you received them at the visit.'],
  ['Notice, Notification of Parents\' Rights', 'Your rights as a parent at a licensed child care center.'],
  ['Notice, Caregiver Background Check Process', 'How everyone who works with children is checked.'],
  ['Notice, Personal Rights', 'Your child\'s personal rights at a child care center.'],
  ['Notice, Risks and Effects of Lead Poisoning', 'Every family receives this when a child enrolls.'],
  ['Notice, Immunizations required for child care', 'The shots your child needs before starting, and at each age after. Bring your child\'s immunization record to the visit.'],
  ['Notice, Drinking water lead test', 'No lead was found at any of the 8 taps tested, including the kitchen and the classrooms.'],
  ['All About Me, the form', 'Four pages to start, each with up to four photos and a few words, and you can add more pages. We print each page and laminate it, and it stays in {first}\'s stories at school.'],
  ['Family Questionnaire, the form', 'Each child is unique. Your answers help {first}\'s educators build a relationship with your family. They are kept confidential and used only for this purpose. Please answer every question.'],
  ['Enrollment information, the form', 'Please complete every section. Your answers fill in the state licensing forms, which you sign at your visit. Every box is required. Write None when something does not apply. Your answers are saved as you type.']
];
const PAGE = 'staff/wording/family-page-text.md';
// the words as a map from each part's name to its words
const defaults = () => Object.fromEntries(TEXT);
// the page as it first reads, for the director to change
const startPage = () => '# The Family page\'s own words\n\nThe lines that explain each step and section of the Family page. Words in braces, such as {first}, are filled in for each family. Keep them as they are.\n\n' +
  TEXT.map(([k, t]) => '## ' + k + '\n\n' + t + '\n').join('\n');
module.exports = { TEXT, PAGE, defaults, startPage };
