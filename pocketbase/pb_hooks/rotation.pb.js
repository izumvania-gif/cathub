/// <reference path="../pb_data/types.d.ts" />

// Rotating chores: after someone does (or skips) a task with a rotation, it becomes the next
// person's turn — the assignee moves to whoever follows the completer in the list.
onRecordAfterCreateSuccess((e) => {
  e.next();
  try {
    const task = e.app.findRecordById('tasks', e.record.getString('task'));
    const order = task.getStringSlice('rotation');
    if (order.length < 2) return;
    const by = e.record.getString('user');
    const pivot = order.indexOf(by) >= 0 ? by : task.getString('assignee');
    const i = order.indexOf(pivot);
    task.set('assignee', order[(i + 1) % order.length]);
    e.app.save(task);
  } catch (err) {
    console.error('rotation: could not advance', err);
  }
}, 'completions');

// Undo: if the completion that advanced the rotation is deleted, give the turn back.
onRecordAfterDeleteSuccess((e) => {
  e.next();
  try {
    const task = e.app.findRecordById('tasks', e.record.getString('task'));
    const order = task.getStringSlice('rotation');
    const by = e.record.getString('user');
    const i = order.indexOf(by);
    if (order.length < 2 || i < 0) return;
    if (task.getString('assignee') === order[(i + 1) % order.length]) {
      task.set('assignee', by);
      e.app.save(task);
    }
  } catch (_) {
    /* task deleted together with its completions */
  }
}, 'completions');
