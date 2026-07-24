export function pushUndoSnapshot(snapshotRef, undoStackRef, redoStackRef, setUndoVersion, currentState) {
  if (currentState && undoStackRef.current.length > 0 && currentState === undoStackRef.current[undoStackRef.current.length - 1]) return;
  undoStackRef.current.push(currentState);
  if (undoStackRef.current.length > 200) undoStackRef.current.shift();
  redoStackRef.current = [];
  setUndoVersion(v => v + 1);
}

export function undoAction(snapshotRef, undoStackRef, redoStackRef, setUndoVersion, setPlacing, restoreSnapshot) {
  if (!undoStackRef.current.length) return;
  redoStackRef.current.push(snapshotRef.current());
  const prev = undoStackRef.current.pop();
  setUndoVersion(v => v + 1);
  restoreSnapshot(prev);
  setPlacing(false, [], 0);
}

export function redoAction(snapshotRef, undoStackRef, redoStackRef, setUndoVersion, restoreSnapshot, setPlacing) {
  if (!redoStackRef.current.length) return;
  undoStackRef.current.push(snapshotRef.current());
  const next = redoStackRef.current.pop();
  setUndoVersion(v => v + 1);
  restoreSnapshot(next);
  setPlacing(false, [], 0);
}
