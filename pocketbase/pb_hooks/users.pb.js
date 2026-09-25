/// <reference path="../pb_data/types.d.ts" />

// New users get the morning digest at 09:00 by default (they can turn it off in the app).
onRecordCreate((e) => {
  if (!e.record.getString('digest_time')) e.record.set('digest_time', '09:00');
  e.next();
}, 'users');
