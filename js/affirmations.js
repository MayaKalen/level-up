// Built-in library of ORIGINAL affirmations written for LEVEL UP.
// None of these are attributed to real people. User-added quotes keep whatever
// author the user enters.
// [theme, text, practical action, reflection question]
const RAW = [
  ['discipline', 'I build confidence by keeping the promises I make to myself.', 'Pick one small promise for today and keep it before noon.', 'Which promise to yourself matters most this week?'],
  ['discipline', 'I do not need a perfect day. I need consistent actions.', 'Finish one mission you have been postponing, even if imperfectly.', 'What would “good enough” look like today?'],
  ['discipline', 'Small actions, repeated daily, quietly become who I am.', 'Do the first five minutes of your hardest task now.', 'Which tiny habit has already changed you?'],
  ['discipline', 'Motivation starts the engine; routine keeps it running.', 'Attach one habit to something you already do every day.', 'Where in your day could a routine replace a decision?'],
  ['discipline', 'I show up on the days it is hard, because those days count the most.', 'Set a 10-minute timer and start, no matter how you feel.', 'What makes showing up easier for you?'],
  ['discipline', 'Consistency is a vote I cast for my future self every day.', 'Log one habit before the evening.', 'What would your future self thank you for today?'],

  ['sales', 'Every meaningful follow-up is another opportunity created.', 'Send three thoughtful follow-ups before lunch.', 'Who have you been meaning to follow up with?'],
  ['sales', 'A “no” today is information, not a verdict on my worth.', 'Review one lost deal and write down one lesson.', 'What did your last rejection teach you?'],
  ['sales', 'I sell best when I listen more than I speak.', 'In your next call, ask two more questions before pitching.', 'What does your customer actually need right now?'],
  ['sales', 'My pipeline grows from the conversations I start today.', 'Reach out to two new leads.', 'Which conversation could open the most doors this week?'],
  ['sales', 'Confidence in sales comes from preparation and repetition.', 'Prepare answers to the two objections you hear most.', 'Which objection still catches you off guard?'],
  ['sales', 'I measure my day by the value I create, not only by the deals I close.', 'Send one useful resource to a prospect without asking for anything.', 'How did you help a customer this week?'],

  ['leadership', 'Clear words create clear outcomes.', 'Rewrite one important message to be half as long.', 'Where could you communicate more simply?'],
  ['leadership', 'I lead by example before I lead by instruction.', 'Do one thing today you would want your team to copy.', 'What example are you setting right now?'],
  ['leadership', 'Listening fully is one of the strongest things I can offer.', 'In one conversation today, listen without planning your reply.', 'Who deserves more of your attention?'],
  ['leadership', 'I speak up with respect, even when my voice shakes.', 'Share one honest idea in a meeting or message today.', 'What have you been hesitating to say?'],
  ['leadership', 'Good communication is a skill, and skills grow with practice.', 'Practise a two-minute explanation of your current project.', 'Which conversation would you like to handle better?'],
  ['leadership', 'I make others feel heard, and they help me go further.', 'Thank someone specifically for their work today.', 'Who helped you recently?'],

  ['finance', 'Every intentional rupee and dollar is a step toward freedom.', 'Review yesterday’s spending in under five minutes.', 'Which expense brought you real value this week?'],
  ['finance', 'I pay my future self first.', 'Move a small amount into savings today, even a token one.', 'What is your next financial milestone?'],
  ['finance', 'Financial calm is built from small, boring, repeated choices.', 'Cancel or pause one subscription you do not use.', 'Where does money leak without you noticing?'],
  ['finance', 'I earn, save and invest with clear intention.', 'Write down your top financial priority for this month.', 'What does financial independence mean to you?'],
  ['finance', 'Knowing my numbers gives me power over them.', 'Check one account balance and note it down.', 'Which number do you avoid looking at?'],

  ['health', 'Taking care of my body is part of doing great work.', 'Take a 10-minute walk between tasks.', 'What does your body need today?'],
  ['health', 'Rest is part of progress, not the opposite of it.', 'Set a time tonight to switch off screens.', 'How rested do you feel right now?'],
  ['health', 'I treat my energy as something worth protecting.', 'Drink a glass of water before your next task.', 'What drains your energy that you could change?'],
  ['health', 'Movement is a gift I give my future self.', 'Stand up and stretch for two minutes now.', 'Which kind of movement do you actually enjoy?'],
  ['health', 'Self-care is maintenance for the person doing the work.', 'Plan one balanced meal for today.', 'What is one kind thing you can do for yourself today?'],
  ['health', 'Consistency beats intensity for a healthier life.', 'Choose an easy version of your workout and do it.', 'What is the smallest healthy action you could repeat daily?'],

  ['learning', 'Every expert I admire was once a beginner who kept going.', 'Spend 15 focused minutes on your current skill.', 'What did you learn this week that surprised you?'],
  ['learning', 'I learn faster when I am willing to be bad at something first.', 'Try one exercise slightly beyond your comfort level.', 'Where are you avoiding being a beginner?'],
  ['learning', 'Curiosity is a habit I practise on purpose.', 'Write down one question and find its answer today.', 'What are you curious about right now?'],
  ['learning', 'Notes I review become knowledge I keep.', 'Review your notes from the last session for five minutes.', 'What would you teach someone from what you learned?'],
  ['learning', 'A little learning every day compounds into mastery.', 'Read or watch one short lesson in your field.', 'Which skill would most change your next year?'],
  ['learning', 'I grow by doing, reflecting and adjusting.', 'Apply one thing you recently learned to a real task.', 'What will you do differently next time?'],

  ['confidence', 'I respect myself enough to keep growing.', 'Write down one thing you did well yesterday.', 'What are you proud of that nobody else saw?'],
  ['confidence', 'My worth is not up for negotiation.', 'Say no to one thing that does not serve your priorities.', 'Where do you need a clearer boundary?'],
  ['confidence', 'Confidence is built by evidence, and I create evidence every day.', 'Complete one mission and notice that you did it.', 'What evidence do you have that you can do hard things?'],
  ['confidence', 'I can feel unsure and still take the next step.', 'Take one action you have been nervous about.', 'What would you try if you felt 10% braver?'],
  ['confidence', 'I speak to myself the way I would speak to a friend.', 'Replace one self-critical thought with a fair one.', 'How would a good friend describe your progress?'],
  ['confidence', 'I belong in the rooms I am working to enter.', 'Introduce yourself to one new person or contact.', 'Which opportunity are you ready for?'],

  ['resilience', 'My progress is measured by the habits I build, not by one difficult day.', 'Name one thing that went right today, however small.', 'What helped you recover from your last setback?'],
  ['resilience', 'Setbacks are part of the path, not the end of it.', 'Restart one habit you dropped, at an easier level.', 'What would a fresh start look like today?'],
  ['resilience', 'I can feel the hard feeling and keep moving gently.', 'Take three slow breaths before your next task.', 'What do you need when things feel heavy?'],
  ['resilience', 'Bending is not breaking. I adapt and continue.', 'Adjust one plan instead of abandoning it.', 'Which plan needs adjusting rather than quitting?'],
  ['resilience', 'I am allowed to begin again as many times as I need.', 'Choose one mission for today and let the rest wait.', 'What can you let go of today?'],
  ['resilience', 'Calm is a skill, and I am practising it.', 'Step away for five quiet minutes this afternoon.', 'What brings you back to calm?'],

  ['focus', 'Where my attention goes, my results follow.', 'Start a 25-minute focus session on your top priority.', 'What deserves your best attention today?'],
  ['focus', 'One thing at a time, done well, is enough.', 'Close every tab not needed for your current task.', 'What can you stop doing this week?'],
  ['focus', 'I protect my best hours for my most important work.', 'Block one hour in your working hours for deep work.', 'When are you sharpest during the day?'],
  ['focus', 'Busy is not the same as productive.', 'Pick the one mission that would make today a success.', 'Which task actually moves your goals forward?'],
  ['focus', 'A clear plan turns a long list into a short path.', 'Choose your top three priorities in the planner.', 'What are your three priorities for today?'],
  ['focus', 'Finishing creates more energy than starting ten things.', 'Finish one open mission before starting a new one.', 'What is almost done that just needs a push?'],

  ['ambition', 'I am building something that takes time, and that is the point.', 'Spend 20 minutes on your most important long-term goal.', 'Where do you want to be one year from now?'],
  ['ambition', 'Big goals are reached through ordinary days done well.', 'Break one goal into a smaller next milestone.', 'What is the next milestone on your biggest goal?'],
  ['ambition', 'My ambition is a direction, not a source of pressure.', 'Write one sentence about why your main goal matters.', 'Why does your biggest goal matter to you?'],
  ['ambition', 'I think long-term and act today.', 'Do one task today that your future self will benefit from.', 'What are you building that will last?'],
  ['ambition', 'I give my dreams a schedule.', 'Set a target date for one goal that has none.', 'Which goal needs a deadline?'],
  ['ambition', 'Each level I reach prepares me for the next.', 'Review your goals and mark any finished milestone.', 'What have you outgrown recently?'],
];

export const AFFIRMATIONS = RAW.map(([theme, text, action, question], i) => ({
  id: `a${i + 1}`, theme, text, action, question, author: null, original: true,
}));
