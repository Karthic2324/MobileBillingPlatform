import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { toISODate, parseISODate, formatDate } from '../utils/tax';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/**
 * Tap-to-open calendar. `value` and `onChange` use 'YYYY-MM-DD' strings.
 * Pure React Native (no extra package to install).
 */
export default function DatePickerField({ value, onChange, dark = false, style }) {
  const [open, setOpen] = useState(false);
  const selected = parseISODate(value);
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  const openPicker = () => {
    const d = parseISODate(value);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setOpen(true);
  };

  const shiftMonth = (delta) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const pick = (iso) => {
    onChange && onChange(iso);
    setOpen(false);
  };

  // Build the grid (weeks start Monday)
  const firstDow = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);

  const todayISO = toISODate(new Date());
  const iso = (d) => toISODate(new Date(viewYear, viewMonth, d));

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={openPicker}
        style={[dark ? styles.fieldDark : styles.fieldLight, style]}
      >
        <Text style={dark ? styles.fieldTextDark : styles.fieldTextLight}>📅 {formatDate(value)}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.navRow}>
              <TouchableOpacity style={styles.navBtn} onPress={() => shiftMonth(-12)}><Text style={styles.navText}>«</Text></TouchableOpacity>
              <TouchableOpacity style={styles.navBtn} onPress={() => shiftMonth(-1)}><Text style={styles.navText}>‹</Text></TouchableOpacity>
              <Text style={styles.monthTitle}>{MONTHS[viewMonth]} {viewYear}</Text>
              <TouchableOpacity style={styles.navBtn} onPress={() => shiftMonth(1)}><Text style={styles.navText}>›</Text></TouchableOpacity>
              <TouchableOpacity style={styles.navBtn} onPress={() => shiftMonth(12)}><Text style={styles.navText}>»</Text></TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((w) => (
                <Text key={w} style={styles.weekday}>{w}</Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((d, idx) => {
                if (d === null) return <View key={idx} style={styles.cell} />;
                const cellISO = iso(d);
                const isSel = cellISO === value;
                const isToday = cellISO === todayISO;
                return (
                  <TouchableOpacity key={idx} style={styles.cell} onPress={() => pick(cellISO)}>
                    <View style={[styles.dayCircle, isToday && styles.todayCircle, isSel && styles.selCircle]}>
                      <Text style={[styles.dayText, isSel && styles.selText]}>{d}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.footer}>
              <TouchableOpacity onPress={() => pick(todayISO)}><Text style={styles.footerLink}>Today</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setOpen(false)}><Text style={[styles.footerLink, { color: '#ef4444' }]}>Cancel</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fieldLight: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4 },
  fieldTextLight: { color: '#991b1b', fontWeight: 'bold', fontSize: 11 },
  fieldDark: { backgroundColor: '#1e293b', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#334155', marginBottom: 6 },
  fieldTextDark: { color: '#fff', fontSize: 14 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 14, padding: 14 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  navBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  navText: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  monthTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: 'bold', color: '#64748b' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  todayCircle: { borderWidth: 1, borderColor: '#0284c7' },
  selCircle: { backgroundColor: '#0284c7' },
  dayText: { fontSize: 14, color: '#0f172a' },
  selText: { color: '#fff', fontWeight: 'bold' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 6 },
  footerLink: { color: '#0284c7', fontWeight: 'bold', fontSize: 14 },
});
