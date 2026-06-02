import './global.css';
import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import Slider from '@react-native-community/slider';
import {
  calculateBill,
  calculateSolarSetup,
  DISCO_LIST,
  DISCO_PRESETS,
} from './src/utils/tariffEngine';
import {
  requestNotificationPermission,
  ensureAndroidChannel,
  schedulePeakAlerts,
  cancelPeakAlerts,
  arePeakAlertsScheduled,
} from './src/utils/notifications';
import {
  getBillLogs,
  saveBillLog,
  deleteBillLog,
} from './src/utils/historyEngine';
import {
  getCachedTariffs,
  saveCachedTariffs,
  fetchRemoteTariffs,
  FALLBACK_TARIFFS,
  FALLBACK_EFFECTIVE_DATE,
} from './src/data/tariffStore';

/**
 * BijliCut — dark-mode dashboard.
 *
 * UI uses ONLY native elements (View, Text, ScrollView, TouchableOpacity) plus
 * the native @react-native-community/slider. Styling via NativeWind className.
 * No web tags.
 */

const PEAK_START_HOUR = 18; // 6:00 PM
const PEAK_END_HOUR = 22; //   10:00 PM

// Upper bound for the bill slider. High enough for commercial / multi-AC heavy
// users; the engine's 701+ slab applies to everything above 700 regardless.
const MAX_UNITS = 10000;

const formatRs = (n) => 'Rs. ' + Math.round(n).toLocaleString('en-PK');

function isPeakHour(date) {
  const h = date.getHours();
  return h >= PEAK_START_HOUR && h < PEAK_END_HOUR;
}

export default function App() {
  const [tab, setTab] = useState('bill'); // 'bill' | 'solar'
  const [units, setUnits] = useState(300);
  const [isProtected, setIsProtected] = useState(false);
  const [disco, setDisco] = useState('LESCO');
  const [now, setNow] = useState(new Date());
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [logs, setLogs] = useState([]);
  // Tariff rows fed into the calc engine. Seeded with the bundled fallback so
  // the first render has data instantly (zero loading delay), even offline.
  const [tariffRows, setTariffRows] = useState(FALLBACK_TARIFFS);

  // Keep the grid-status badge accurate as the clock crosses the peak window.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // On first load: request notification permission, set up the Android channel,
  // and restore the toggle if the alarms are already scheduled.
  useEffect(() => {
    (async () => {
      await requestNotificationPermission();
      await ensureAndroidChannel();
      setAlertsEnabled(await arePeakAlertsScheduled());
    })().catch(() => {});
  }, []);

  // Toggle the daily peak-hour alarms on/off.
  const togglePeakAlerts = async () => {
    if (!alertsEnabled) {
      const granted = await requestNotificationPermission();
      if (!granted) return; // permission denied — leave the switch off
      await schedulePeakAlerts();
      setAlertsEnabled(true);
    } else {
      await cancelPeakAlerts();
      setAlertsEnabled(false);
    }
  };

  // Load saved bill logs on first render.
  useEffect(() => {
    getBillLogs().then(setLogs).catch(() => {});
  }, []);

  // Offline-first tariff sync: instant cache → background fetch → adopt-if-newer.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Step A — read the local cache and use it immediately (zero delay).
      const cached = await getCachedTariffs();
      if (cancelled) return;
      if (cached) setTariffRows(cached.rows);

      // Step B — background fetch (returns null when offline/unreachable).
      const remote = await fetchRemoteTariffs();
      if (cancelled || !remote) return;

      // Step C — adopt only when Supabase is newer than the cache (or no cache
      // exists yet), updating BOTH the live state and AsyncStorage.
      const cachedVersion = cached?.version ?? FALLBACK_EFFECTIVE_DATE;
      if (!cached || remote.version > cachedVersion) {
        setTariffRows(remote.rows);
        await saveCachedTariffs(remote);
      }
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const peak = isPeakHour(now);

  const bill = useMemo(
    () => calculateBill(units, { isProtected, disco, tariffRows }),
    [units, isProtected, disco, tariffRows]
  );

  // Save the currently-active calculation, then refresh the list.
  const handleLogCurrent = async () => {
    await saveBillLog({ disco, units, total: bill.totalCost });
    setLogs(await getBillLogs());
  };

  // Delete one log entry, then refresh the list.
  const handleDeleteLog = async (id) => {
    setLogs(await deleteBillLog(id));
  };

  const tip = bill.smartSavingTip;
  const timeLabel = now.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <ScrollView
      className="flex-1 bg-slate-950"
      contentContainerClassName="px-5 pt-16 pb-12"
    >
      {/* App title */}
      <View className="mb-6">
        <Text className="text-3xl font-extrabold text-white tracking-tight">
          Bijli<Text className="text-amber-400">⚡</Text>Cut
        </Text>
        <Text className="text-slate-400 text-sm mt-1">
          Decode your bill. Beat the slab.
        </Text>
      </View>

      {/* ───────── Top Header: Live Grid Status ───────── */}
      <View className="rounded-3xl bg-slate-900 border border-slate-800 p-5 mb-5 shadow-lg">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-slate-400 text-xs uppercase tracking-widest">
              Live Grid Status
            </Text>
            <Text className="text-white text-2xl font-bold mt-1">
              {timeLabel}
            </Text>
          </View>

          <View
            className={
              'rounded-full px-4 py-2 ' +
              (peak ? 'bg-red-500/15' : 'bg-emerald-500/15')
            }
          >
            <View className="flex-row items-center">
              <View
                className={
                  'h-2 w-2 rounded-full mr-2 ' +
                  (peak ? 'bg-red-400' : 'bg-emerald-400')
                }
              />
              <Text
                className={
                  'text-xs font-bold ' +
                  (peak ? 'text-red-300' : 'text-emerald-300')
                }
              >
                {peak ? 'PEAK HOURS (High Tax Rate)' : 'OFF-PEAK HOURS'}
              </Text>
            </View>
          </View>
        </View>

        <Text className="text-slate-500 text-xs mt-4">
          {peak
            ? 'Heavy appliances cost more right now. Defer ironing, pumping & EV charging until after 10 PM.'
            : 'Good time to run high-load appliances at the standard rate.'}
        </Text>

        {/* Peak-hour alarm toggle */}
        <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-slate-800">
          <View className="flex-1 pr-3">
            <Text className="text-slate-100 text-sm font-semibold">
              🔔 Enable Peak Hour Alerts
            </Text>
            <Text className="text-slate-500 text-xs mt-0.5">
              Daily reminders at 6 PM &amp; 10 PM
            </Text>
          </View>
          <Toggle value={alertsEnabled} onToggle={togglePeakAlerts} />
        </View>
      </View>

      {/* ───────── DISCO / Region selector ───────── */}
      <View className="rounded-3xl bg-slate-900 border border-slate-800 p-4 mb-5">
        <Text className="text-slate-400 text-xs uppercase tracking-widest mb-3">
          Your Distribution Company
        </Text>
        <View className="flex-row">
          {DISCO_LIST.map((d, i) => {
            const active = disco === d.code;
            return (
              <TouchableOpacity
                key={d.code}
                activeOpacity={0.85}
                onPress={() => setDisco(d.code)}
                className={
                  'flex-1 rounded-xl py-2.5 ' +
                  (i < DISCO_LIST.length - 1 ? 'mr-2 ' : '') +
                  (active ? 'bg-amber-400' : 'bg-slate-800')
                }
              >
                <Text
                  className={
                    'text-center text-xs font-bold ' +
                    (active ? 'text-slate-950' : 'text-slate-300')
                  }
                >
                  {d.code}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text className="text-slate-500 text-xs mt-3">
          📍 {DISCO_PRESETS[disco].region} · FCA Rs.{' '}
          {DISCO_PRESETS[disco].fuelAdjustment}/unit
          {DISCO_PRESETS[disco].surcharge > 0
            ? ` · +Rs. ${DISCO_PRESETS[disco].surcharge} surcharge`
            : ''}
        </Text>
      </View>

      {/* ───────── Tab switcher: Bill ⚡ / Solar ☀️ / History 📈 ───────── */}
      <View className="flex-row bg-slate-900 border border-slate-800 rounded-2xl p-1 mb-5">
        <TouchableOpacity
          className={'flex-1 rounded-xl py-3 ' + (tab === 'bill' ? 'bg-emerald-500' : '')}
          activeOpacity={0.85}
          onPress={() => setTab('bill')}
        >
          <Text
            className={
              'text-center text-xs font-bold ' +
              (tab === 'bill' ? 'text-slate-950' : 'text-slate-400')
            }
          >
            ⚡ Bill
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={'flex-1 rounded-xl py-3 ' + (tab === 'solar' ? 'bg-amber-400' : '')}
          activeOpacity={0.85}
          onPress={() => setTab('solar')}
        >
          <Text
            className={
              'text-center text-xs font-bold ' +
              (tab === 'solar' ? 'text-slate-950' : 'text-slate-400')
            }
          >
            ☀️ Solar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={'flex-1 rounded-xl py-3 ' + (tab === 'history' ? 'bg-amber-400' : '')}
          activeOpacity={0.85}
          onPress={() => setTab('history')}
        >
          <Text
            className={
              'text-center text-xs font-bold ' +
              (tab === 'history' ? 'text-slate-950' : 'text-slate-400')
            }
          >
            📈 History
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'solar' && <SolarConsultant />}

      {tab === 'history' && (
        <HistoryLog
          units={units}
          disco={disco}
          total={bill.totalCost}
          logs={logs}
          onLog={handleLogCurrent}
          onDelete={handleDeleteLog}
        />
      )}

      {/* ───────── Main Segment: interactive slider + live bill ───────── */}
      {tab === 'bill' && (
      <>
      <View className="rounded-3xl bg-slate-900 border border-slate-800 p-5 mb-5">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-slate-400 text-xs uppercase tracking-widest">
            Estimated Monthly Bill
          </Text>
          <View className="rounded-full bg-slate-800 px-3 py-1">
            <Text className="text-emerald-300 text-xs font-semibold">
              {bill.slabLabel}
            </Text>
          </View>
        </View>

        <Text className="text-emerald-400 text-5xl font-extrabold tracking-tight">
          {formatRs(bill.totalCost)}
        </Text>

        <View className="flex-row items-baseline mt-2">
          <Text className="text-white text-lg font-bold">{units}</Text>
          <Text className="text-slate-400 text-sm ml-1">units / month</Text>
        </View>

        <Slider
          style={{ width: '100%', height: 44, marginTop: 12 }}
          minimumValue={0}
          maximumValue={MAX_UNITS}
          step={10}
          value={units}
          onValueChange={(v) => setUnits(Math.round(v))}
          minimumTrackTintColor="#34d399"
          maximumTrackTintColor="#1e293b"
          thumbTintColor="#34d399"
        />
        <View className="flex-row justify-between -mt-1">
          <Text className="text-slate-500 text-xs">0</Text>
          <Text className="text-slate-500 text-xs">5k</Text>
          <Text className="text-slate-500 text-xs">10k</Text>
        </View>

        {/* Protected / Unprotected toggle (drives the engine) */}
        <View className="flex-row mt-5 bg-slate-800 rounded-2xl p-1">
          <TouchableOpacity
            className={
              'flex-1 rounded-xl py-2.5 ' + (isProtected ? 'bg-emerald-500' : '')
            }
            activeOpacity={0.8}
            onPress={() => setIsProtected(true)}
          >
            <Text
              className={
                'text-center text-xs font-bold ' +
                (isProtected ? 'text-slate-950' : 'text-slate-400')
              }
            >
              Protected (≤200)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={
              'flex-1 rounded-xl py-2.5 ' + (!isProtected ? 'bg-emerald-500' : '')
            }
            activeOpacity={0.8}
            onPress={() => setIsProtected(false)}
          >
            <Text
              className={
                'text-center text-xs font-bold ' +
                (!isProtected ? 'text-slate-950' : 'text-slate-400')
              }
            >
              Unprotected
            </Text>
          </TouchableOpacity>
        </View>

        {/* Cost breakdown */}
        <View className="mt-5 border-t border-slate-800 pt-4">
          <Row label="Energy charge" value={formatRs(bill.energyCharge)} />
          <Row label="Fixed charges" value={formatRs(bill.fixedCharge)} />
          {bill.fuelAdjustment > 0 && (
            <Row
              label={`Fuel adjustment (${bill.disco || 'std'})`}
              value={formatRs(bill.fuelAdjustment)}
            />
          )}
          {bill.surcharge > 0 && (
            <Row label="Regional surcharge" value={formatRs(bill.surcharge)} />
          )}
          <Row label="GST (18%)" value={formatRs(bill.tax)} />
        </View>
      </View>

      {/* ───────── Bottom Card: Smart Saving Tip ───────── */}
      <View className="rounded-3xl bg-amber-400/10 border border-amber-400/30 p-5">
        <View className="flex-row items-center mb-2">
          <Text className="text-amber-300 text-base font-bold">
            💡 Smart Saving Tip
          </Text>
        </View>
        <Text className="text-amber-100 text-base leading-6">
          {tip.message}
        </Text>

        {tip.applicable && (
          <View className="flex-row items-center mt-4">
            <View className="rounded-2xl bg-amber-400 px-4 py-2 mr-3">
              <Text className="text-slate-950 text-lg font-extrabold">
                −{tip.unitsToCut} units
              </Text>
            </View>
            <View>
              <Text className="text-amber-200 text-xs">You could save</Text>
              <Text className="text-amber-100 text-lg font-bold">
                {formatRs(tip.estimatedSaving)}/mo
              </Text>
            </View>
          </View>
        )}
      </View>
      </>
      )}

      {tab === 'bill' && (
        <Text className="text-slate-600 text-[11px] text-center mt-6">
          Tariffs are indicative and change via NEPRA notifications & monthly
          FCA. Always confirm with your official bill.
        </Text>
      )}
    </ScrollView>
  );
}

/** Native pill toggle switch, styled with NativeWind (no web tags). */
function Toggle({ value, onToggle }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onToggle}
      className={
        'w-14 h-8 rounded-full p-1 flex-row items-center ' +
        (value ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start')
      }
    >
      <View className="h-6 w-6 rounded-full bg-white shadow" />
    </TouchableOpacity>
  );
}

/** Small labelled breakdown row. */
function Row({ label, value }) {
  return (
    <View className="flex-row justify-between py-1.5">
      <Text className="text-slate-400 text-sm">{label}</Text>
      <Text className="text-slate-200 text-sm font-semibold">{value}</Text>
    </View>
  );
}

/** Compact lakh formatter (1 lakh = 100,000) for tight stat tiles. */
const lakhs = (n) => 'Rs. ' + (n / 100000).toFixed(1) + 'L';

/** Format an ISO date as e.g. "12 Jun 2026". */
const formatLogDate = (iso) =>
  new Date(iso).toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

/**
 * History Log — log the current calculation and review past saved bills.
 * Receives the live units/disco/total + persisted logs and handlers from App.
 * Native elements only; dark-mode/amber aesthetic.
 */
function HistoryLog({ units, disco, total, logs, onLog, onDelete }) {
  return (
    <View>
      {/* Log current calculation */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onLog}
        className="rounded-3xl bg-amber-400 p-5 mb-5"
      >
        <Text className="text-slate-950 text-base font-extrabold text-center">
          ＋ Log Current Calculation
        </Text>
        <Text className="text-amber-900 text-xs font-semibold text-center mt-1">
          {disco} · {units} units · {formatRs(total)}
        </Text>
      </TouchableOpacity>

      {/* Saved logs */}
      {logs.length === 0 ? (
        <View className="rounded-3xl bg-slate-900 border border-slate-800 p-6">
          <Text className="text-slate-400 text-center text-sm">
            No saved bills yet. Tap “Log Current Calculation” to start tracking
            your consumption. 📈
          </Text>
        </View>
      ) : (
        logs.map((log) => (
          <View
            key={log.id}
            className="rounded-3xl bg-slate-900 border border-slate-800 p-4 mb-3 flex-row items-center"
          >
            <View className="flex-1">
              <View className="flex-row items-center mb-1">
                <Text className="text-white text-sm font-bold">
                  {formatLogDate(log.date)}
                </Text>
                {log.disco ? (
                  <View className="rounded-full bg-amber-400/15 px-2 py-0.5 ml-2">
                    <Text className="text-amber-300 text-[10px] font-bold">
                      {log.disco}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-slate-400 text-xs">{log.units} units</Text>
            </View>

            <Text className="text-emerald-400 text-lg font-extrabold mr-3">
              {formatRs(log.total)}
            </Text>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onDelete(log.id)}
              className="h-9 w-9 rounded-full bg-slate-800 items-center justify-center"
            >
              <Text className="text-base">🗑️</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      <Text className="text-slate-600 text-[11px] text-center mt-5">
        Logs are saved on this device only.
      </Text>
    </View>
  );
}

/**
 * Solar Consultant — type an average summer bill, get an instant rooftop
 * system recommendation from calculateSolarSetup(). Same dark-mode aesthetic,
 * native elements only (View / Text / TextInput).
 */
function SolarConsultant() {
  const [billText, setBillText] = useState('25000');
  const bill = parseFloat(billText) || 0;
  const solar = useMemo(() => calculateSolarSetup(bill), [bill]);
  const hasResult = solar.systemSizeKw > 0;

  return (
    <View>
      {/* Input card */}
      <View className="rounded-3xl bg-slate-900 border border-slate-800 p-5 mb-5">
        <Text className="text-slate-400 text-xs uppercase tracking-widest">
          Solar Consultant
        </Text>
        <Text className="text-white text-lg font-bold mt-1 mb-4">
          Size your rooftop system ☀️
        </Text>
        <Text className="text-slate-400 text-xs mb-2">
          Your average summer bill
        </Text>
        <View className="flex-row items-center bg-slate-800 rounded-2xl px-4 border border-slate-700">
          <Text className="text-amber-400 text-xl font-extrabold mr-2">Rs.</Text>
          <TextInput
            className="flex-1 text-white text-2xl font-extrabold py-3"
            keyboardType="numeric"
            value={billText}
            onChangeText={setBillText}
            placeholder="25000"
            placeholderTextColor="#475569"
            selectionColor="#fbbf24"
          />
        </View>
      </View>

      {hasResult ? (
        <>
          {/* Headline: recommended system size */}
          <View className="rounded-3xl bg-amber-400 p-5 mb-3">
            <Text className="text-amber-900 text-xs font-bold uppercase tracking-widest">
              Recommended System
            </Text>
            <View className="flex-row items-end mt-1">
              <Text className="text-slate-950 text-6xl font-extrabold tracking-tighter">
                {solar.systemSizeKw}
              </Text>
              <Text className="text-slate-900 text-2xl font-extrabold mb-2 ml-1">
                kW
              </Text>
            </View>
            <Text className="text-amber-900 text-sm font-semibold mt-1">
              {solar.panels} × {solar.panelWattage}W panels · offsets ~
              {solar.estimatedMonthlyUnits} units/mo
            </Text>
          </View>

          {/* Stat tiles: investment + payback */}
          <View className="flex-row mb-3">
            <View className="flex-1 rounded-3xl bg-slate-900 border border-slate-800 p-4 mr-3">
              <Text className="text-slate-400 text-xs uppercase tracking-widest">
                Total Investment
              </Text>
              <Text className="text-emerald-400 text-2xl font-extrabold mt-2">
                {formatRs(solar.investmentEstimate)}
              </Text>
              <Text className="text-slate-500 text-xs mt-1">
                {lakhs(solar.investmentLow)} – {lakhs(solar.investmentHigh)} range
              </Text>
            </View>

            <View className="flex-1 rounded-3xl bg-slate-900 border border-slate-800 p-4">
              <Text className="text-slate-400 text-xs uppercase tracking-widest">
                Payback Period
              </Text>
              <Text className="text-emerald-400 text-2xl font-extrabold mt-2">
                {solar.paybackMonths} mo
              </Text>
              <Text className="text-slate-500 text-xs mt-1">
                ~{solar.paybackYears} years to recover
              </Text>
            </View>
          </View>

          {/* Net-metering note */}
          <View className="rounded-3xl bg-emerald-500/10 border border-emerald-500/30 p-4">
            <Text className="text-emerald-200 text-sm leading-5">
              ⚡ With net metering, surplus daytime generation is exported to the
              grid and credited against your night-time usage — sharpening the
              payback above.
            </Text>
          </View>
        </>
      ) : (
        <View className="rounded-3xl bg-slate-900 border border-slate-800 p-6">
          <Text className="text-slate-400 text-center text-sm">
            Enter your average monthly bill to see a tailored solar plan.
          </Text>
        </View>
      )}

      <Text className="text-slate-600 text-[11px] text-center mt-5">
        Estimates assume ~125 units/kW/month and Rs.150k–175k/kW installed.
        Actual sizing depends on roof space, shading & sanctioned load.
      </Text>
    </View>
  );
}
