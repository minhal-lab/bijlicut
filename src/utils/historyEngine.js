/**
 * historyEngine.js — BijliCut
 * ---------------------------------------------------------------------------
 * Local persistence for the "Bill History & Consumption Tracker Log".
 * Backed by AsyncStorage — purely on-device, no server.
 *
 * Each log entry records:
 *   { id, date (ISO), disco, units, total }
 * ---------------------------------------------------------------------------
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'bijlicut.bill_logs.v1';

/**
 * @typedef {Object} BillLog
 * @property {string} id     Unique id for the entry.
 * @property {string} date   ISO timestamp of when it was logged.
 * @property {string|null} disco  DISCO code (e.g. 'LESCO'), or null.
 * @property {number} units  Units consumed (kWh).
 * @property {number} total  Calculated bill total in Rs.
 */

/**
 * Read all saved logs, newest first. Never throws — returns [] on any error.
 * @returns {Promise<BillLog[]>}
 */
export async function getBillLogs() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Persist a new bill log entry (prepended so the list stays newest-first).
 * @param {{ disco?: string|null, units: number, total: number }} logEntry
 * @returns {Promise<BillLog>} the saved entry (with generated id + date).
 */
export async function saveBillLog(logEntry) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString(),
    disco: logEntry?.disco ?? null,
    units: Math.max(0, Math.round(Number(logEntry?.units) || 0)),
    total: Math.max(0, Math.round(Number(logEntry?.total) || 0)),
  };

  const logs = await getBillLogs();
  const updated = [entry, ...logs];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return entry;
}

/**
 * Delete a single log by id.
 * @param {string} id
 * @returns {Promise<BillLog[]>} the remaining logs.
 */
export async function deleteBillLog(id) {
  const logs = await getBillLogs();
  const updated = logs.filter((log) => log.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

/** Remove every saved log. */
export async function clearBillLogs() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
