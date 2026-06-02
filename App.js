import './global.css';
import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { calculateBill } from './src/utils/tariffEngine';

/**
 * BijliCut — dark-mode dashboard.
 *
 * UI uses ONLY native elements (View, Text, ScrollView, TouchableOpacity) plus
 * the native @react-native-community/slider. Styling via NativeWind className.
 * No web tags.
 */

const PEAK_START_HOUR = 18; // 6:00 PM
const PEAK_END_HOUR = 22; //   10:00 PM

const formatRs = (n) => 'Rs. ' + Math.round(n).toLocaleString('en-PK');

function isPeakHour(date) {
  const h = date.getHours();
  return h >= PEAK_START_HOUR && h < PEAK_END_HOUR;
}

export default function App() {
  const [units, setUnits] = useState(300);
  const [isProtected, setIsProtected] = useState(false);
  const [now, setNow] = useState(new Date());

  // Keep the grid-status badge accurate as the clock crosses the peak window.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const peak = isPeakHour(now);

  const bill = useMemo(
    () => calculateBill(units, { isProtected }),
    [units, isProtected]
  );

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
      </View>

      {/* ───────── Main Segment: interactive slider + live bill ───────── */}
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
          maximumValue={1000}
          step={5}
          value={units}
          onValueChange={(v) => setUnits(Math.round(v))}
          minimumTrackTintColor="#34d399"
          maximumTrackTintColor="#1e293b"
          thumbTintColor="#34d399"
        />
        <View className="flex-row justify-between -mt-1">
          <Text className="text-slate-500 text-xs">0</Text>
          <Text className="text-slate-500 text-xs">500</Text>
          <Text className="text-slate-500 text-xs">1000</Text>
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
            <Row label="Fuel adjustment" value={formatRs(bill.fuelAdjustment)} />
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

      <Text className="text-slate-600 text-[11px] text-center mt-6">
        Tariffs are indicative and change via NEPRA notifications & monthly FCA.
        Always confirm with your official bill.
      </Text>
    </ScrollView>
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
