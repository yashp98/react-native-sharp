import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
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
import {
  DEMO_PNG,
  avatarDemo,
  backgroundBlurDemo,
  blurSharpenDemo,
  compositeDemo,
  cropDemo,
  fitModesDemo,
  pickImageFromLibrary,
  rotateDemo,
  roundCornersDemo,
  saveDemo,
  type DemoGallery,
  type DemoPair,
  type DemoPreview,
} from './src/visualDemo'

type DemoKind =
  | 'rotate'
  | 'crop'
  | 'save'
  | 'fit'
  | 'blur'
  | 'avatar'
  | 'round'
  | 'bgblur'
  | 'watermark'

export default function App() {
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<CaseResult[] | null>(null)
  const [sourceUri, setSourceUri] = useState<string>(DEMO_PNG)
  const [sourceLabel, setSourceLabel] = useState('Sample PNG')
  const [pair, setPair] = useState<DemoPair | null>(null)
  const [gallery, setGallery] = useState<DemoGallery | null>(null)
  const [demoError, setDemoError] = useState<string | null>(null)

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

  const clearDemo = useCallback(() => {
    setPair(null)
    setGallery(null)
    setDemoError(null)
  }, [])

  const runValidation = useCallback(async () => {
    setBusy(true)
    setResults(null)
    setDemoError(null)
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

  const pickPhoto = useCallback(async () => {
    setBusy(true)
    clearDemo()
    try {
      const uri = await pickImageFromLibrary()
      if (!uri) {
        return
      }
      setSourceUri(uri)
      setSourceLabel('Picked photo')
    } catch (e) {
      setDemoError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [clearDemo])

  const useSample = useCallback(() => {
    clearDemo()
    setSourceUri(DEMO_PNG)
    setSourceLabel('Sample PNG')
  }, [clearDemo])

  const runDemo = useCallback(
    async (kind: DemoKind) => {
      setBusy(true)
      clearDemo()
      try {
        switch (kind) {
          case 'rotate':
            setPair(await rotateDemo(sourceUri))
            break
          case 'crop':
            setPair(await cropDemo(sourceUri))
            break
          case 'save':
            setPair(await saveDemo(sourceUri))
            break
          case 'fit':
            setGallery(await fitModesDemo(sourceUri))
            break
          case 'blur':
            setGallery(await blurSharpenDemo(sourceUri))
            break
          case 'avatar':
            setPair(await avatarDemo(sourceUri))
            break
          case 'round':
            setPair(await roundCornersDemo(sourceUri))
            break
          case 'bgblur':
            setPair(await backgroundBlurDemo(sourceUri))
            break
          case 'watermark':
            setPair(await compositeDemo(sourceUri))
            break
        }
      } catch (e) {
        setDemoError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [clearDemo, sourceUri]
  )

  return (
    <SafeAreaView style={styles.safe} testID="sharp-example-root">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>react-native-sharp</Text>
          <Text style={styles.sub}>Native behaviour checks</Text>
          <Text style={styles.meta}>vips {vipsVersion}</Text>
        </View>

        <Text style={styles.section}>Source</Text>
        <View style={styles.demoRow}>
          <TouchableOpacity
            style={[styles.demoButton, styles.demoButtonAccent, busy && styles.buttonDisabled]}
            onPress={pickPhoto}
            disabled={busy}
            testID="demo-pick"
          >
            <Text style={styles.demoButtonText}>Pick photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.demoButton, busy && styles.buttonDisabled]}
            onPress={useSample}
            disabled={busy}
            testID="demo-sample"
          >
            <Text style={styles.demoButtonText}>Use sample</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.sourceCard}>
          <Image
            source={{ uri: sourceUri }}
            style={styles.sourceImage}
            resizeMode="contain"
          />
          <Text style={styles.cardLabel}>{sourceLabel}</Text>
        </View>

        <Text style={[styles.section, styles.sectionSpaced]}>Visual demo</Text>
        <Text style={styles.hint}>
          Runs against the source above (sample or gallery pick)
        </Text>
        <View style={styles.demoRow}>
          <DemoButton
            label="Rotate"
            busy={busy}
            onPress={() => runDemo('rotate')}
            testID="demo-rotate"
          />
          <DemoButton
            label="Crop"
            busy={busy}
            onPress={() => runDemo('crop')}
            testID="demo-crop"
          />
          <DemoButton
            label="Save"
            busy={busy}
            onPress={() => runDemo('save')}
            testID="demo-save"
          />
        </View>
        <View style={[styles.demoRow, styles.demoRowSpaced]}>
          <DemoButton
            label="Fit modes"
            busy={busy}
            onPress={() => runDemo('fit')}
            testID="demo-fit"
          />
          <DemoButton
            label="Blur / sharp"
            busy={busy}
            onPress={() => runDemo('blur')}
            testID="demo-blur"
          />
          <DemoButton
            label="Avatar"
            busy={busy}
            onPress={() => runDemo('avatar')}
            testID="demo-avatar"
          />
        </View>
        <View style={[styles.demoRow, styles.demoRowSpaced]}>
          <DemoButton
            label="Round"
            busy={busy}
            onPress={() => runDemo('round')}
            testID="demo-round"
          />
          <DemoButton
            label="Bg blur"
            busy={busy}
            onPress={() => runDemo('bgblur')}
            testID="demo-bgblur"
          />
          <DemoButton
            label="Watermark"
            busy={busy}
            onPress={() => runDemo('watermark')}
            testID="demo-watermark"
          />
        </View>

        {busy ? (
          <ActivityIndicator color="#8b9cb3" style={styles.spinner} />
        ) : null}

        {demoError ? (
          <Text style={styles.demoError} testID="demo-error">
            {demoError}
          </Text>
        ) : null}

        {pair ? (
          <View style={styles.previewBlock} testID="demo-preview">
            <View style={styles.previewPair}>
              <PreviewCard preview={pair.before} />
              <PreviewCard preview={pair.after} />
            </View>
            {pair.note ? (
              <Text style={styles.note} testID="demo-save-path">
                {pair.note}
              </Text>
            ) : null}
          </View>
        ) : null}

        {gallery ? (
          <View style={styles.previewBlock} testID="demo-gallery">
            <PreviewCard preview={gallery.source} wide />
            <View style={styles.galleryGrid}>
              {gallery.previews.map((preview) => (
                <PreviewCard key={preview.label} preview={preview} />
              ))}
            </View>
            {gallery.note ? (
              <Text style={styles.note}>{gallery.note}</Text>
            ) : null}
          </View>
        ) : null}

        <Text style={[styles.section, styles.sectionSpaced]}>Validation</Text>
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

        <View style={styles.logContent}>
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
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function DemoButton({
  label,
  busy,
  onPress,
  testID,
}: {
  label: string
  busy: boolean
  onPress: () => void
  testID: string
}) {
  return (
    <TouchableOpacity
      style={[styles.demoButton, busy && styles.buttonDisabled]}
      onPress={onPress}
      disabled={busy}
      testID={testID}
    >
      <Text style={styles.demoButtonText}>{label}</Text>
    </TouchableOpacity>
  )
}

function PreviewCard({
  preview,
  wide,
}: {
  preview: DemoPreview
  wide?: boolean
}) {
  const circular = preview.label.toLowerCase().includes('circle')
  return (
    <View style={[styles.card, wide && styles.cardWide]}>
      <Image
        source={{ uri: preview.uri }}
        style={[
          styles.previewImage,
          wide && styles.previewImageWide,
          circular && styles.previewImageCircle,
        ]}
        resizeMode="contain"
      />
      <Text style={styles.cardLabel}>{preview.label}</Text>
      <Text style={styles.cardMeta}>
        {preview.width}×{preview.height}
      </Text>
      <Text style={styles.cardDetail}>{preview.detail}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f1419' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 48 },
  header: { marginBottom: 20, gap: 6 },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f4f7fb',
    letterSpacing: -0.5,
  },
  sub: { fontSize: 15, color: '#9aa7b5' },
  meta: { fontSize: 13, color: '#6f7f90', marginTop: 4 },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c9d4e0',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  sectionSpaced: { marginTop: 28 },
  hint: { fontSize: 13, color: '#6f7f90', marginBottom: 12 },
  demoRow: { flexDirection: 'row', gap: 8 },
  demoRowSpaced: { marginTop: 8 },
  demoButton: {
    flex: 1,
    backgroundColor: '#243044',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  demoButtonAccent: { backgroundColor: '#1f6feb' },
  demoButtonText: { color: '#e7eef8', fontSize: 12, fontWeight: '600' },
  sourceCard: {
    marginTop: 12,
    backgroundColor: '#161c24',
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  sourceImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#0b0f14',
    borderRadius: 8,
  },
  spinner: { marginTop: 16 },
  demoError: {
    marginTop: 12,
    color: '#f85149',
    fontFamily: 'Menlo',
    fontSize: 12,
  },
  previewBlock: { marginTop: 16, gap: 10 },
  previewPair: { flexDirection: 'row', gap: 10 },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: '#161c24',
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  cardWide: { flexBasis: '100%' },
  previewImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#0b0f14',
    borderRadius: 8,
  },
  previewImageWide: { height: 140 },
  previewImageCircle: { borderRadius: 999, alignSelf: 'center', width: 120 },
  cardLabel: { color: '#f4f7fb', fontSize: 13, fontWeight: '600', marginTop: 6 },
  cardMeta: { color: '#9aa7b5', fontFamily: 'Menlo', fontSize: 11 },
  cardDetail: { color: '#6f7f90', fontFamily: 'Menlo', fontSize: 10 },
  note: {
    color: '#9aa7b5',
    fontFamily: 'Menlo',
    fontSize: 10,
    lineHeight: 14,
  },
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
  logContent: { gap: 10, marginTop: 16 },
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
