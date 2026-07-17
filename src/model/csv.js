export function parseCsv(text) {
  // Parse the full text char-by-char to handle quoted fields containing newlines
  const rows = [];
  let row = [], cur = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { row.push(cur); cur = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && i + 1 < text.length && text[i + 1] === "\n") i++;
        if (cur.length > 0 || row.length > 0) { row.push(cur); cur = ""; }
        if (row.length > 0) { rows.push(row); row = []; }
      } else cur += ch;
    }
  }
  if (cur.length > 0 || row.length > 0) { row.push(cur); rows.push(row); }
  if (rows.length < 2) return { headers: [], rows: [] };
  const headers = rows[0];
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const vals = rows[i];
    if (vals.length === 0) continue;
    if (vals.length === 1 && vals[0] === "") continue;
    const rowObj = {};
    headers.forEach((h, j) => { rowObj[h.trim()] = j < vals.length ? vals[j].trim() : ""; });
    data.push(rowObj);
  }
  return { headers, rows: data };
}
