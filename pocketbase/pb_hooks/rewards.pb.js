/// <reference path="../pb_data/types.d.ts" />

// A mark moved to another time (e.g. a health record's date was corrected) is priced again:
// its fish are cleared and the bot's next tick recomputes them from the task's status at the
// new time (core's rewardFor), the same way as for a new mark.
onRecordUpdate((e) => {
  if (e.record.getString('done_at') !== e.record.original().getString('done_at')) {
    e.record.set('fish', 0);
    e.record.set('rewarded', false);
  }
  e.next();
}, 'completions');
