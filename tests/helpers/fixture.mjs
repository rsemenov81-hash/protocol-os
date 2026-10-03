// Shared e2e fixture: a localStorage blob shaped like Roman's live data, plus the init script that
// seeds it into a fresh browser context before the app boots.
//
// Date keys ('dk') are local calendar days as 'YYYY-MM-DD'. The fixture is anchored on the process's
// idea of "today" (process.env.TZ), so run the browser context in the same time zone.

export const STORAGE_KEYS = {
  protocols: 'protocol_os_protocols',
  vials: 'protocol_os_vials',
  logs: 'protocol_os_logs',
  meta: 'protocol_os_meta',
  loaded: 'protocol_os_loaded_v4',
  profile: 'protocol_os_active_profile',
};
export const PROFILE = 'Roman';

const pad2 = (n) => String(n).padStart(2, '0');
export const dkFromDate = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
export const todayDk = () => dkFromDate(new Date());
export const addDays = (dk, n) => { const d = new Date(dk + 'T12:00:00'); d.setDate(d.getDate() + n); return dkFromDate(d); };

// The seed. `today` lets a caller pin the fixture to a day; by default it tracks the real date so the
// "yesterday / today" log entries line up with what the app considers today.
export function romanFixture(today = todayDk()) {
  const yesterday = addDays(today, -1);
  return {
    protocols: [
      { id: 'p_live_t', profile: PROFILE, peptideId: 'testosterone', peptideName: 'Testosterone Cyp (20mg / 10u)', doseMcg: 20000, schedule: { days: [2, 4, 6], timeOfDay: 'morning' }, cycleDays: 365, startDate: '2026-05-29', active: true, createdAt: '2026-05-29T12:00:00.000Z' },
      { id: 'p_hcg', profile: PROFILE, peptideId: 'hcg', peptideName: 'HCG', doseMcg: 500, doseUnit: 'IU', doseValue: 500, schedule: { days: [2, 6], timeOfDay: 'morning' }, cycleDays: 365, startDate: '2026-05-29', active: true },
      { id: 'p_ss31', profile: PROFILE, peptideId: 'ss31', peptideName: 'SS-31 (Elamipretide)', doseMcg: 2000, schedule: { days: [0, 1, 2, 3, 4, 5, 6], timeOfDay: 'morning' }, cycleDays: 365, startDate: '2026-05-29', active: true },
      { id: 'p_dsip', profile: PROFILE, peptideId: 'dsip', peptideName: 'DSIP', doseMcg: 300, schedule: { days: [0, 1, 2, 3, 4, 5, 6], timeOfDay: 'evening' }, cycleDays: 365, startDate: '2026-05-29', active: true },
    ],
    vials: [
      { id: 'v_t', peptideId: 'testosterone', peptideName: 'Testosterone Cyp 200 mg/mL', mgPerVial: 2000, diluentMl: 10, totalMcg: 2000000, remainingMcg: 1500000, mcgPerMl: 200000, mcgPerUnit: 2000, unitsPerDose: 10, doseMcg: 20000, active: true, formType: 'liquid', reconstitutedAt: '2026-05-29T12:00:00.000Z' },
      { id: 'v_ss', peptideId: 'ss31', peptideName: 'SS-31', mgPerVial: 10, diluentMl: 2, totalMcg: 10000, remainingMcg: 6000, mcgPerMl: 5000, mcgPerUnit: 50, unitsPerDose: 40, doseMcg: 2000, active: true, formType: 'liquid' },
    ],
    logs: [
      { id: 'l1', protocolId: 'p_live_t', peptideId: 'testosterone', peptide: 'Testosterone Cyp (20mg / 10u)', profile: PROFILE, datetime: yesterday + 'T07:06', doseMcg: 20000, doseMl: 0.1, vialId: 'v_t' },
      { id: 'l2', protocolId: 'p_ss31', peptideId: 'ss31', peptide: 'SS-31 (Elamipretide)', profile: PROFILE, datetime: yesterday + 'T07:02', doseMcg: 2000, doseMl: 0.4, vialId: 'v_ss' },
      { id: 'l3', protocolId: 'p_ss31', peptideId: 'ss31', peptide: 'SS-31 (Elamipretide)', profile: PROFILE, datetime: today + 'T07:02', doseMcg: 2000, doseMl: 0.4, vialId: 'v_ss' },
    ],
  };
}

// Runs inside the browser on every navigation (context.addInitScript(seedLocalStorage, seedArgs(fx))).
// It is serialized with Function#toString, so it must not close over anything from this module.
export function seedLocalStorage({ keys, profile, fixture }) {
  if (localStorage.getItem('__seeded')) return;
  localStorage.setItem(keys.protocols, JSON.stringify(fixture.protocols));
  localStorage.setItem(keys.vials, JSON.stringify(fixture.vials));
  localStorage.setItem(keys.logs, JSON.stringify(fixture.logs));
  localStorage.setItem(keys.loaded, 'true');
  localStorage.setItem(keys.profile, profile);
  localStorage.setItem('__seeded', '1');
}
export const seedArgs = (fixture, profile = PROFILE) => ({ keys: STORAGE_KEYS, profile, fixture });
