import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import sharp from 'react-native-sharp'
import {
  summarize,
  validateSharp,
  type CaseResult,
} from './src/validateSharp'

export default function App() {
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<CaseResult[] | null>(null)

  const vipsVersion = useMemo(() => {
    try {
      return sharp.vipsVersion
    } catch (e) {
      return `unavailable: ${String(e)}`
    }
  }, [])

  const summary = useMemo(
    () => (results ? summarize(results) : null),
    [results]
  )

  const runValidation = useCallback(async () => {
    setBusy(true)
    setResults(null)
    try {
      setResults(await validateSharp())
    } catch (e) {
      setResults([
        {
          name: 'suite',
          ok: false,
          detail: e instanceof Error ? e.message : String(e),
        },
      ])
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <SafeAreaView style={styles.safe} testID="sharp-example-root">
      <View style={styles.header}>
        <Text style={styles.brand}>react-native-sharp</Text>
        <Text style={styles.sub}>Native behaviour checks</Text>
        <Text style={styles.meta}>vips {vipsVersion}</Text>
      </View>

      <TouchableOpacity
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={runValidation}
        disabled={busy}
        testID="run-validation"
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Run validation suite</Text>
        )}
      </TouchableOpacity>

      {summary ? (
        <Text
          style={[
            styles.summary,
            summary.ok ? styles.summaryOk : styles.summaryFail,
          ]}
          testID="validation-summary"
        >
          {summary.ok
            ? `ALL PASSED (${summary.passed}/${results!.length})`
            : `FAILED ${summary.failed}/${results!.length}`}
        </Text>
      ) : null}

      <ScrollView style={styles.log} contentContainerStyle={styles.logContent}>
        {(results ?? []).map((row) => (
          <View
            key={row.name}
            style={styles.row}
            testID={`case-${row.ok ? 'pass' : 'fail'}-${row.name}`}
          >
            <Text style={row.ok ? styles.pass : styles.fail}>
              {row.ok ? 'PASS' : 'FAIL'}
            </Text>
            <View style={styles.rowBody}>
              <Text style={styles.caseName}>{row.name}</Text>
              <Text style={styles.caseDetail}>{row.detail}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f1419', padding: 20 },
  header: { marginBottom: 24, gap: 6 },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f4f7fb',
    letterSpacing: -0.5,
  },
  sub: { fontSize: 15, color: '#9aa7b5' },
  meta: { fontSize: 13, color: '#6f7f90', marginTop: 4 },
  button: {
    backgroundColor: '#1f6feb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  summary: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Menlo',
  },
  summaryOk: { color: '#3fb950' },
  summaryFail: { color: '#f85149' },
  log: { marginTop: 16, flex: 1 },
  logContent: { gap: 10, paddingBottom: 40 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowBody: { flex: 1, gap: 2 },
  pass: {
    color: '#3fb950',
    fontFamily: 'Menlo',
    fontSize: 12,
    fontWeight: '700',
    width: 40,
  },
  fail: {
    color: '#f85149',
    fontFamily: 'Menlo',
    fontSize: 12,
    fontWeight: '700',
    width: 40,
  },
  caseName: { color: '#f4f7fb', fontSize: 13, fontWeight: '600' },
  caseDetail: {
    color: '#9aa7b5',
    fontFamily: 'Menlo',
    fontSize: 11,
    lineHeight: 16,
  },
})
