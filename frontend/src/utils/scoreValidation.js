export function validateScoresClient(matrix, fencers) {
  const anomalies = [];
  const n = matrix.length;
  if (n === 0) return [{ level: 'error', message: 'Empty score matrix' }];

  const tsArr = [];
  const trArr = [];
  for (let i = 0; i < n; i++) {
    let ts = 0, tr = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (matrix[i][j] != null) ts += matrix[i][j];
      if (matrix[j][i] != null) tr += matrix[j][i];
    }
    tsArr.push(ts);
    trArr.push(tr);
  }

  const indSum = tsArr.reduce((a, v, i) => a + (v - trArr[i]), 0);
  if (indSum !== 0) {
    anomalies.push({ level: 'error', message: `Indicator sum is ${indSum}, should be 0` });
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const val = matrix[i][j];
      if (val != null && (val < 0 || val > 5)) {
        const name = fencers[i]?.last_name || `Fencer ${i + 1}`;
        anomalies.push({ level: 'error', message: `${name} vs opponent ${j + 1}: score ${val} out of 0-5 range` });
      }
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = matrix[i][j], b = matrix[j][i];
      if (a != null && b != null) {
        if (a !== 5 && b !== 5) {
          const fa = fencers[i]?.last_name || `Fencer ${i + 1}`;
          const fb = fencers[j]?.last_name || `Fencer ${j + 1}`;
          anomalies.push({ level: 'warning', message: `${fa} (${a}) vs ${fb} (${b}): neither scored 5` });
        }
        if (a === b) {
          const fa = fencers[i]?.last_name || `Fencer ${i + 1}`;
          const fb = fencers[j]?.last_name || `Fencer ${j + 1}`;
          anomalies.push({ level: 'error', message: `${fa} vs ${fb}: tied at ${a}-${b}` });
        }
      }
    }
  }

  return anomalies;
}

export function computeResultsClient(matrix, fencers) {
  const n = matrix.length;
  const results = [];
  for (let i = 0; i < n; i++) {
    let v = 0, ts = 0, tr = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const sf = matrix[i][j], sa = matrix[j][i];
      if (sf != null) ts += sf;
      if (sa != null) tr += sa;
      if (sf != null && sa != null && sf > sa) v++;
    }
    results.push({
      last_name: fencers[i]?.last_name || `Fencer ${i + 1}`,
      first_name: fencers[i]?.first_name || '',
      V: v, TS: ts, TR: tr, indicator: ts - tr, place: 0,
    });
  }
  results.sort((a, b) => b.V - a.V || b.indicator - a.indicator || b.TS - a.TS);
  results.forEach((r, i) => { r.place = i + 1; });
  return results;
}

export function isCellProblematic(row, col, value, cellConf, threshold = 0.7) {
  if (row === col) return false;
  if (value === null || value === undefined) return true;
  if (value < 0 || value > 5) return true;
  if (cellConf != null && cellConf < threshold) return true;
  return false;
}
