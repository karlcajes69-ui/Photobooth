import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  Aperture,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  Flower2,
  Heart,
  ImagePlus,
  LockKeyhole,
  Maximize2,
  Minimize2,
  PartyPopper,
  Printer,
  RotateCcw,
  Share2,
  Sparkles,
  Star,
  Trash2,
  Type,
  Upload,
  X,
} from 'lucide-react';

type View = 'welcome' | 'layouts' | 'camera' | 'select' | 'edit' | 'review' | 'printing' | 'complete';
type LayoutId = '1x1' | '2x2' | '2x4' | '2x3_dup' | '2x3_six' | '1x4' | '1x3' | '2x3';
type Shot = { id: string; blob: Blob; url: string; filter: string };
type CustomBackground = { id: string; name: string; url: string };
type CustomSticker = { id: string; name: string; url: string };
type Decor = {
  id: string;
  kind: 'text' | 'heart' | 'star' | 'flower' | 'sparkle' | 'smiley' | 'party' | 'custom';
  text?: string;
  customUrl?: string;
  x: number;
  y: number;
  size: number;
  color: string;
};
type Design = { template: string; background: string; pattern: string; border: boolean };
type RetainedDesign = { id: string; blob: Blob; createdAt: string; label: string };
type Settings = {
  business: string;
  event: string;
  logo: string;
  accent: string;
  defaultLayout: LayoutId;
  printSize: '2x6' | '4x6' | '4x4' | 'custom';
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
  countdown: number;
  copies: number;
  template: string;
  background: string;
  pattern: string;
  border: boolean;
  showBrand: boolean;
  margin: number;
  retention: boolean;
  enabled: string[];
  extraShots: number;
  enabledLayouts: LayoutId[];
  enabledTemplates: string[];
  enabledFilters: string[];
  kioskMode: boolean;
  customStickers: CustomSticker[];
  customBackgrounds: CustomBackground[];
  activeBackgroundId: string | null;
  welcomeHeadline: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  welcomeImage: string;
  allowCustomText: boolean;
  printMethod: 'auto' | 'share' | 'browser' | 'bridge';
  localBridgeUrl: string;
};

const BASE_SETTINGS: Settings = {
  business: 'Studio Booth',
  event: '',
  logo: '',
  accent: '#a9684d',
  defaultLayout: '2x4',
  printSize: '4x6',
  width: 4,
  height: 6,
  orientation: 'portrait',
  countdown: 10,
  copies: 1,
  template: 'Minimal',
  background: '#ffffff',
  pattern: 'none',
  border: false,
  showBrand: true,
  margin: 6,
  retention: false,
  enabled: ['templates', 'backgrounds', 'stickers', 'filters'],
  extraShots: 2,
  enabledLayouts: ['1x1', '2x2', '2x4', '2x3_dup', '2x3_six'],
  enabledTemplates: ['Minimal', 'Party', 'Retro'],
  enabledFilters: ['None', 'Warm', 'Cool', 'B&W', 'Vintage'],
  kioskMode: false,
  customStickers: [],
  customBackgrounds: [],
  activeBackgroundId: null,
  welcomeHeadline: 'the good kind of blur',
  welcomeTitle: 'Step in.\nLet it happen.',
  welcomeSubtitle: '',
  welcomeImage: '',
  allowCustomText: true,
  printMethod: 'auto',
  localBridgeUrl: '',
};

const ALL_LAYOUTS: {
  id: LayoutId;
  label: string;
  count: number;
  displayCells: number;
  rows: number;
  cols: number;
  duplicated: boolean;
  isStrip: boolean;
  description: string;
}[] = [
  { id: '1x1', label: 'Big 1 × 1', count: 1, displayCells: 1, rows: 1, cols: 1, duplicated: false, isStrip: false, description: 'One large 4×6 portrait' },
  { id: '2x2', label: '2 × 2 grid', count: 4, displayCells: 4, rows: 2, cols: 2, duplicated: false, isStrip: false, description: 'Four-photo 4×6 print' },
  { id: '2x4', label: '2 × 4 twin strips', count: 4, displayCells: 8, rows: 4, cols: 2, duplicated: true, isStrip: true, description: 'Two matching 4-photo strips' },
  { id: '2x3_dup', label: '2 × 3 twin strips', count: 3, displayCells: 6, rows: 3, cols: 2, duplicated: true, isStrip: true, description: 'Two matching 3-photo strips' },
  { id: '2x3_six', label: '2 × 3 collage', count: 6, displayCells: 6, rows: 3, cols: 2, duplicated: false, isStrip: false, description: 'Six different photos' },
];

const ALL_FILTERS = ['None', 'Warm', 'Cool', 'B&W', 'Vintage'];
const ALL_TEMPLATES = ['Minimal', 'Party', 'Retro'];

const PAPER_COLORS: { name: string; hex: string }[] = [
  { name: 'Black', hex: '#000000' },
  { name: 'Red', hex: '#C30010' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Pastel Pink', hex: '#fbcfe8' },
  { name: 'Baby Blue', hex: '#bfdbfe' },
  { name: 'Mint Green', hex: '#bbf7d0' },
  { name: 'Beige', hex: '#f5e6dc' },
];
const PALETTE = PAPER_COLORS.map(c => c.hex);

const TEXT_COLORS: { name: string; hex: string }[] = [
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Espresso', hex: '#4a3b32' },
  { name: 'Terracotta', hex: '#a9684d' },
  { name: 'Navy', hex: '#1d3557' },
];

const FILTER_CSS: Record<string, string> = {
  None: 'none',
  Natural: 'none',
  Warm: 'sepia(.18) saturate(1.12)',
  Cool: 'saturate(.88) hue-rotate(8deg)',
  'B&W': 'grayscale(1)',
  Vintage: 'sepia(.35) contrast(.92) saturate(.82)',
};

function isColorDark(hex: string): boolean {
  if (!hex || typeof hex !== 'string') return false;
  let c = hex.trim();
  if (!c.startsWith('#')) return false;
  c = c.slice(1);
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.45;
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const layoutFor = (id: LayoutId) => {
  if (id === '1x4') return ALL_LAYOUTS.find(x => x.id === '2x4') || ALL_LAYOUTS[2];
  if (id === '1x3' || id === '2x3') return ALL_LAYOUTS.find(x => x.id === '2x3_dup') || ALL_LAYOUTS[3];
  return ALL_LAYOUTS.find(x => x.id === id) || ALL_LAYOUTS[0];
};
const designFor = (settings: Settings): Design => ({
  template: ALL_TEMPLATES.includes(settings.template) ? settings.template : 'Minimal',
  background: PALETTE.includes(settings.background) ? settings.background : '#ffffff',
  pattern: settings.pattern,
  border: false,
});

const openSessionDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = indexedDB.open('studio-booth-session', 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('media')) db.createObjectStore('media');
      if (!db.objectStoreNames.contains('retained')) db.createObjectStore('retained');
      if (!db.objectStoreNames.contains('custom_assets')) db.createObjectStore('custom_assets');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

async function saveShots(shots: Shot[], meta: Record<string, unknown>) {
  const db = await openSessionDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('media', 'readwrite');
    tx.objectStore('media').put(
      {
        shots: shots.map(s => ({ id: s.id, blob: s.blob, filter: s.filter })),
        meta,
      },
      'active',
    );
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadShots(): Promise<{
  shots: { id: string; blob: Blob; filter: string }[];
  meta: Record<string, unknown>;
} | null> {
  const db = await openSessionDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('media', 'readonly').objectStore('media').get('active');
    req.onsuccess = () => {
      db.close();
      resolve(req.result || null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

async function clearSessionDb() {
  let db: IDBDatabase | undefined;
  try {
    db = await openSessionDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction('media', 'readwrite');
      tx.objectStore('media').delete('active');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

async function saveRetainedDesign(item: RetainedDesign) {
  const db = await openSessionDb();
  if (!db.objectStoreNames.contains('retained')) {
    db.close();
    throw new Error('Retained storage unavailable');
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('retained', 'readwrite');
    tx.objectStore('retained').put(item, item.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function readRetainedDesigns(): Promise<RetainedDesign[]> {
  const db = await openSessionDb();
  if (!db.objectStoreNames.contains('retained')) {
    db.close();
    return [];
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction('retained', 'readonly');
    const req = tx.objectStore('retained').getAll();
    req.onsuccess = () => {
      db.close();
      resolve(req.result || []);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

async function deleteRetainedDesign(id: string) {
  const db = await openSessionDb();
  if (!db.objectStoreNames.contains('retained')) {
    db.close();
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('retained', 'readwrite');
    tx.objectStore('retained').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function deleteAllRetainedDesigns() {
  const db = await openSessionDb();
  if (!db.objectStoreNames.contains('retained')) {
    db.close();
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('retained', 'readwrite');
    tx.objectStore('retained').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function LayoutThumbnail({ layout }: { layout: (typeof ALL_LAYOUTS)[number] }) {
  const isSquare = layout.id === '1x1';
  const totalCells = layout.displayCells || layout.count;
  return (
    <div
      className={`strip ${isSquare ? 'strip-square' : 'strip-4x6'}`}
      style={{
        '--rows': layout.rows,
        '--cols': layout.cols,
        position: 'relative',
      } as React.CSSProperties}
    >
      {Array.from({ length: totalCells }, (_, i) => (
        <div className="mini-photo" key={i} />
      ))}
      {layout.isStrip && (
        <div
          style={{
            position: 'absolute',
            top: 2,
            bottom: 2,
            left: '50%',
            width: 1,
            borderLeft: '1px dashed rgba(0,0,0,0.35)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

function Sticker({
  kind,
  color,
  size = '100%',
  customUrl,
}: {
  kind: string;
  color: string;
  size?: number | string;
  customUrl?: string;
}) {
  const sizeStyle = typeof size === 'number' ? { width: `${size}px`, height: `${size}px` } : { width: size, height: size };
  if (kind === 'custom' && customUrl) {
    return (
      <img
        src={customUrl}
        alt="Custom sticker"
        style={{ ...sizeStyle, objectFit: 'contain', pointerEvents: 'none', display: 'block' }}
      />
    );
  }
  const common = {
    width: typeof size === 'number' ? size : '100%',
    height: typeof size === 'number' ? size : '100%',
    stroke: color,
    strokeWidth: 1.8,
    fill: 'none',
    style: { ...sizeStyle, display: 'block' },
  };
  if (kind === 'heart') return <Heart {...common} />;
  if (kind === 'star') return <Star {...common} />;
  if (kind === 'flower') return <Flower2 {...common} />;
  if (kind === 'party') return <PartyPopper {...common} />;
  if (kind === 'smiley')
    return (
      <svg
        width={typeof size === 'number' ? size : '100%'}
        height={typeof size === 'number' ? size : '100%'}
        viewBox="0 0 36 36"
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        style={{ ...sizeStyle, display: 'block' }}
      >
        <circle cx="18" cy="18" r="14" />
        <path d="M12 21c1.4 3 3.4 4.5 6 4.5s4.6-1.5 6-4.5M13 14h.1M23 14h.1" />
      </svg>
    );
  return <Sparkles {...common} />;
}

function drawSticker(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 36, size / 36);
  ctx.translate(-18, -18);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (kind === 'heart') {
    ctx.beginPath();
    ctx.moveTo(18, 31);
    ctx.bezierCurveTo(15, 27, 4, 20, 4, 12);
    ctx.bezierCurveTo(4, 4, 14, 3, 18, 11);
    ctx.bezierCurveTo(22, 3, 32, 4, 32, 12);
    ctx.bezierCurveTo(32, 20, 21, 27, 18, 31);
    ctx.stroke();
  } else if (kind === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 7 : 15;
      const px = 18 + Math.cos(a) * r;
      const py = 18 + Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  } else if (kind === 'flower') {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ctx.ellipse(18 + Math.cos(a) * 8, 18 + Math.sin(a) * 8, 4.5, 7, a, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(18, 18, 3, 0, Math.PI * 2);
    ctx.stroke();
  } else if (kind === 'smiley') {
    ctx.beginPath();
    ctx.arc(18, 18, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(13, 14, 1, 0, Math.PI * 2);
    ctx.arc(23, 14, 1, 0, Math.PI * 2);
    ctx.moveTo(11, 21);
    ctx.quadraticCurveTo(18, 29, 25, 21);
    ctx.stroke();
  } else if (kind === 'party') {
    ctx.beginPath();
    ctx.moveTo(9, 27);
    ctx.lineTo(26, 10);
    ctx.lineTo(30, 28);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, 8);
    ctx.lineTo(12, 4);
    ctx.moveTo(28, 7);
    ctx.lineTo(32, 4);
    ctx.moveTo(6, 17);
    ctx.lineTo(2, 17);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(18, 2);
    ctx.lineTo(20, 15);
    ctx.lineTo(33, 18);
    ctx.lineTo(20, 21);
    ctx.lineTo(18, 34);
    ctx.lineTo(15, 21);
    ctx.lineTo(3, 18);
    ctx.lineTo(15, 15);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function App() {
  const [view, setView] = useState<View>('welcome');
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('studio-booth-settings') || '{}');
      return {
        ...BASE_SETTINGS,
        ...stored,
        template: ALL_TEMPLATES.includes(stored.template) ? stored.template : BASE_SETTINGS.template,
        background: PALETTE.includes(stored.background) ? stored.background : BASE_SETTINGS.background,
        pattern: stored.pattern || BASE_SETTINGS.pattern,
        border: false,
        extraShots: stored.extraShots ?? BASE_SETTINGS.extraShots,
        enabledLayouts: stored.enabledLayouts || BASE_SETTINGS.enabledLayouts,
        enabledTemplates: (stored.enabledTemplates || BASE_SETTINGS.enabledTemplates).filter((t: string) =>
          ALL_TEMPLATES.includes(t),
        ),
        enabledFilters: stored.enabledFilters || BASE_SETTINGS.enabledFilters,
        customStickers: stored.customStickers || [],
        customBackgrounds: stored.customBackgrounds || [],
        activeBackgroundId: stored.activeBackgroundId ?? null,
        welcomeHeadline: stored.welcomeHeadline || BASE_SETTINGS.welcomeHeadline,
        welcomeTitle: stored.welcomeTitle || BASE_SETTINGS.welcomeTitle,
        welcomeSubtitle: stored.welcomeSubtitle || '',
        welcomeImage: stored.welcomeImage || '',
        allowCustomText: stored.allowCustomText ?? BASE_SETTINGS.allowCustomText,
      };
    } catch {
      return BASE_SETTINGS;
    }
  });

  const [design, setDesign] = useState<Design>(() => designFor(settings));
  const [sessionCaption, setSessionCaption] = useState(() => settings.event);
  const [customText, setCustomText] = useState(() => settings.event || '');
  const [customTextColor, setCustomTextColor] = useState<string>('#000000');
  const [layout, setLayout] = useState<LayoutId>(settings.defaultLayout);
  const [shots, setShots] = useState<Shot[]>([]);
  const [selectedShotIds, setSelectedShotIds] = useState<string[]>([]);
  const [decor, setDecor] = useState<Decor[]>([]);
  const decorRef = useRef<Decor[]>(decor);
  decorRef.current = decor;
  const [selectedDecor, setSelectedDecor] = useState<string | null>(null);
  const [previewFilter, setPreviewFilter] = useState('None');
  const [selectedShotForFilter, setSelectedShotForFilter] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [cameraStatus, setCameraStatus] = useState('Camera not started');
  const [streamReady, setStreamReady] = useState(false);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [flashPulse, setFlashPulse] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [sessionNotice, setSessionNotice] = useState('');
  const [dbAvailable, setDbAvailable] = useState(true);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // Staff and Settings Modal
  const [staffOpen, setStaffOpen] = useState(false);
  const [staffUnlocked, setStaffUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinSetup, setPinSetup] = useState(false);
  const [pinFirst, setPinFirst] = useState('');
  const [staffPin, setStaffPin] = useState(() => localStorage.getItem('studio-booth-pin') || '');
  const [staffTab, setStaffTab] = useState<'settings' | 'welcome' | 'assets' | 'status' | 'help'>('settings');
  const [bgUploadName, setBgUploadName] = useState('');
  const [bgUploadPreview, setBgUploadPreview] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  // Print workflow
  const [printUrl, setPrintUrl] = useState('');
  const [printClosed, setPrintClosed] = useState(false);
  const [printError, setPrintError] = useState('');
  const [received, setReceived] = useState(false);
  const [retentionNotice, setRetentionNotice] = useState('');
  const [retainedDesigns, setRetainedDesigns] = useState<(RetainedDesign & { url: string })[]>([]);
  const [retentionBusy, setRetentionBusy] = useState(false);
  const [isTestPrint, setIsTestPrint] = useState(false);
  const [testPrintNotice, setTestPrintNotice] = useState('');
  const [isPreRendering, setIsPreRendering] = useState(false);

  // Refs
  const staffUnlockedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const sequenceTimerRef = useRef<number | undefined>(undefined);
  const autoSequenceRef = useRef(false);
  const isCapturingRef = useRef(false);
  const sequenceNextRef = useRef<(continuing?: boolean) => void>(() => {});
  const makeShotRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const shotsRef = useRef<Shot[]>([]);
  const targetShotsCountRef = useRef(0);
  const settingsRef = useRef(settings);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniCanvasRef = useRef<HTMLCanvasElement>(null);
  const printUrlRef = useRef('');
  const preRenderedBlobRef = useRef<Blob | null>(null);
  const sessionGenerationRef = useRef(0);
  const customerObjectUrlsRef = useRef(new Set<string>());
  const retainedObjectUrlsRef = useRef<string[]>([]);
  const compositionBlobRef = useRef<Blob | null>(null);
  const retainedForCurrentPrintRef = useRef(false);
  const dragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number; originSize: number; resize: boolean } | null>(null);
  const pendingUpdateRef = useRef<((items: Decor[]) => Decor[]) | null>(null);
  const sessionId = useRef(uid());

  const config = useMemo(() => layoutFor(layout), [layout]);
  const extraShots = settings.extraShots ?? 2;
  const targetShotsCount = config.count + extraShots;

  targetShotsCountRef.current = targetShotsCount;
  shotsRef.current = shots;
  settingsRef.current = settings;

  const accent = settings.accent;
  // Standard Canon SELPHY CP1300 print canvas: 4x6 inches portrait (1200x1800 px @ 300 DPI)
  const dims = useMemo(() => ({ w: 4, h: 6 }), []);

  const compositionRatio = dims.w / dims.h;

  // Active shots are the ones selected manually by the user, ordered according to selection!
  const activeShots = useMemo(() => {
    const map = new Map(shots.map(s => [s.id, s]));
    return selectedShotIds.map(id => map.get(id)).filter((s): s is Shot => Boolean(s));
  }, [shots, selectedShotIds]);

  staffUnlockedRef.current = staffUnlocked;

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('studio-booth-settings', JSON.stringify(settings));
    document.documentElement.style.setProperty('--accent', settings.accent);
  }, [settings]);

  const createCustomerUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    customerObjectUrlsRef.current.add(url);
    return url;
  };

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 3400);
    return () => clearTimeout(t);
  }, [toast]);

  // Session load from IndexedDB
  useEffect(() => {
    let live = true;
    const generation = sessionGenerationRef.current;
    loadShots()
      .then(saved => {
        if (!live || generation !== sessionGenerationRef.current) return;
        if (saved) {
          const restored = saved.shots.map(s => ({ ...s, url: createCustomerUrl(s.blob) }));
          setShots(restored);
          const savedLayout = saved.meta.layout as LayoutId | undefined;
          if (savedLayout && ALL_LAYOUTS.some(l => l.id === savedLayout)) setLayout(savedLayout);
          if (Array.isArray(saved.meta.decor)) setDecor(saved.meta.decor as Decor[]);
          if (Array.isArray(saved.meta.selectedShotIds)) setSelectedShotIds(saved.meta.selectedShotIds as string[]);
          if (typeof saved.meta.caption === 'string') {
            setSessionCaption(saved.meta.caption);
            setCustomText(saved.meta.caption);
          }
          if (saved.meta.customTextColor === '#ffffff' || saved.meta.customTextColor === '#000000') {
            setCustomTextColor(saved.meta.customTextColor as '#000000' | '#ffffff');
          }
          if (saved.meta.design && typeof saved.meta.design === 'object') {
            const d = saved.meta.design as Design;
            setDesign({
              ...designFor(settings),
              ...d,
              template: ALL_TEMPLATES.includes(d.template) ? d.template : 'Minimal',
              background: PALETTE.includes(d.background) ? d.background : '#ffffff',
              border: false,
            });
          }
          const savedView = saved.meta.view as View | undefined;
          if (savedView && ['layouts', 'camera', 'select', 'edit', 'review', 'printing'].includes(savedView)) {
            setView(savedView === 'printing' ? 'review' : savedView);
          }
          setSessionNotice('An unfinished session was restored on this iPad.');
        }
        setDbAvailable(true);
        setSessionLoaded(true);
      })
      .catch(() => {
        if (live && generation === sessionGenerationRef.current) {
          setDbAvailable(false);
          setSessionNotice('Session storage is unavailable. This session will remain in memory only.');
          setSessionLoaded(true);
        }
      });
    return () => {
      live = false;
    };
  }, []);

  // Save active session to IndexedDB (debounced to avoid I/O churn during drag operations)
  useEffect(() => {
    if (!dbAvailable || !sessionLoaded || shots.length === 0) return;
    const timer = window.setTimeout(() => {
      saveShots(shots, {
        layout,
        view,
        decor,
        design,
        selectedShotIds,
        caption: customText,
        customTextColor,
        sessionId: sessionId.current,
      }).catch(() => {
        setDbAvailable(false);
        setSessionNotice('Session storage unavailable. Photos held in memory until closed.');
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [shots, layout, view, decor, design, selectedShotIds, sessionCaption, customText, customTextColor, dbAvailable, sessionLoaded]);

  const releaseCamera = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = undefined;
    if (sequenceTimerRef.current) window.clearTimeout(sequenceTimerRef.current);
    sequenceTimerRef.current = undefined;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStreamReady(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    return () => {
      releaseCamera();
      customerObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      customerObjectUrlsRef.current.clear();
      retainedObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      if (printUrlRef.current) URL.revokeObjectURL(printUrlRef.current);
    };
  }, [releaseCamera]);

  useEffect(() => {
    if (view !== 'camera' || !streamReady || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {});
  }, [view, streamReady]);

  useEffect(() => {
    if (view !== 'camera') return;
    const onVisibility = () => {
      if (document.hidden) {
        autoSequenceRef.current = false;
        setPaused(true);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = undefined;
        setCountdown(null);
        setIsCapturing(false);
        releaseCamera();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [view, releaseCamera]);

  const startCamera = useCallback(async () => {
    releaseCamera();
    setCameraError('');
    setCameraStatus('Requesting camera access…');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access not supported. Open in Safari or modern browser with HTTPS.');
      setCameraStatus('Unavailable');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      streamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        setStreamReady(false);
        setCameraStatus('Camera interrupted');
        setCameraError('The camera connection ended. Tap reconnect to continue.');
        setPaused(true);
      });
      setStreamReady(true);
      setCameraStatus('Camera ready');
      return true;
    } catch (err) {
      const e = err as DOMException;
      let message = 'Camera could not start. Check permissions and reconnect.';
      if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
        message = 'Camera permission denied. Allow camera access in browser settings, then tap reconnect.';
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        message = 'No camera found. Connect a camera and reconnect.';
      } else if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
        message = 'Camera is in use by another app or interrupted. Close other apps and reconnect.';
      } else if (!window.isSecureContext) {
        message = 'A secure HTTPS connection is required for camera access.';
      }
      setCameraError(message);
      setCameraStatus('Camera unavailable');
      setPaused(true);
      return false;
    }
  }, [facing, releaseCamera]);

  const clearTransient = useCallback(async () => {
    sessionGenerationRef.current += 1;
    setSessionLoaded(true);
    releaseCamera();
    const cleared = await clearSessionDb();
    customerObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    customerObjectUrlsRef.current.clear();
    if (printUrlRef.current) {
      URL.revokeObjectURL(printUrlRef.current);
      printUrlRef.current = '';
    }
    setPrintUrl('');
    preRenderedBlobRef.current = null;
    compositionBlobRef.current = null;
    retainedForCurrentPrintRef.current = false;
    if (sequenceTimerRef.current) {
      window.clearTimeout(sequenceTimerRef.current);
      sequenceTimerRef.current = undefined;
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
    autoSequenceRef.current = false;
    isCapturingRef.current = false;
    setIsCapturing(false);
    shotsRef.current = [];
    setShots([]);
    setSelectedShotIds([]);
    setDecor([]);
    setFlashPulse(false);
    setPrintClosed(false);
    setPrintError('');
    setReceived(false);
    setRetentionNotice('');
    setTestPrintNotice('');
    setIsTestPrint(false);
    setPreviewFilter('None');
    setSessionNotice(cleared ? '' : 'IndexedDB cleared in-memory.');
    sessionId.current = uid();
  }, [releaseCamera, settings]);

  const startFresh = async () => {
    await clearTransient();
    shotsRef.current = [];
    setShots([]);
    setSelectedShotIds([]);
    setDecor([]);
    setSessionCaption(settings.event);
    setCustomText(settings.event || '');
    setCustomTextColor('#000000');
    setDesign(designFor(settings));
    setLayout(settings.defaultLayout);
    setView('layouts');
  };

  const enterCamera = async () => {
    await clearTransient();
    shotsRef.current = [];
    setShots([]);
    setSelectedShotIds([]);
    setDecor([]);
    setLayout(layout);
    setView('camera');
    setPaused(false);
    setCameraError('');
    setTimeout(() => {
      void startCamera();
    }, 60);
  };

  // Capture shot without retake logic
  const makeShot = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !streamRef.current || video.readyState < 2) {
      autoSequenceRef.current = false;
      isCapturingRef.current = false;
      setIsCapturing(false);
      setCameraError('Camera preview is not ready. Reconnect and try again.');
      return;
    }
    const c = document.createElement('canvas');
    c.width = video.videoWidth || 1280;
    c.height = video.videoHeight || 960;
    const ctx = c.getContext('2d');
    if (!ctx) {
      autoSequenceRef.current = false;
      isCapturingRef.current = false;
      setIsCapturing(false);
      setCameraError('Could not process photo capture on this device.');
      return;
    }
    // Automatic screen flash effect on photo capture
    setFlashPulse(true);
    window.setTimeout(() => setFlashPulse(false), 160);

    ctx.save();
    if (facing === 'user') {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, c.width, c.height);
    ctx.restore();

    c.toBlob(
      async blob => {
        if (!blob) {
          autoSequenceRef.current = false;
          isCapturingRef.current = false;
          setIsCapturing(false);
          setCameraError('Photo could not be saved. Please try again.');
          return;
        }
        const shotUrl = URL.createObjectURL(blob);
        customerObjectUrlsRef.current.add(shotUrl);
        const shot: Shot = { id: uid(), blob, url: shotUrl, filter: 'None' };

        // Append to ref and state
        const nextShots = [...shotsRef.current, shot];
        shotsRef.current = nextShots;
        setShots(nextShots);
        const countAfter = nextShots.length;

        setCountdown(null);
        setPaused(false);
        setCameraError('');

        // Check if sequence should continue to the next shot
        const target = targetShotsCountRef.current;
        if (autoSequenceRef.current && countAfter < target) {
          isCapturingRef.current = true;
          setIsCapturing(true);
          sequenceTimerRef.current = window.setTimeout(() => {
            if (autoSequenceRef.current) {
              sequenceNextRef.current(true);
            }
          }, 800);
        } else {
          // Finished taking all required + 2 additional shots!
          autoSequenceRef.current = false;
          isCapturingRef.current = false;
          setIsCapturing(false);
          releaseCamera();
          // Manual photo selection: do not auto-select on customer's behalf
          setSelectedShotIds([]);
          setToast(`All ${target} photos taken! Now choose your favorite ${config.count}.`);
          window.setTimeout(() => {
            setView('select');
          }, 600);
        }
      },
      'image/jpeg',
      0.94,
    );
  }, [facing, config.count, releaseCamera]);

  const beginSequence = useCallback((continuing = false) => {
    if (!streamRef.current || !streamReady) {
      autoSequenceRef.current = false;
      isCapturingRef.current = false;
      setIsCapturing(false);
      setCameraError('Reconnect camera before starting.');
      return;
    }
    // Only block if capturing AND NOT continuing an automated sequence
    if (isCapturingRef.current && !continuing) {
      return;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }

    autoSequenceRef.current = true;
    isCapturingRef.current = true;
    setIsCapturing(true);
    setPaused(false);

    let n = Math.max(1, Math.min(30, settingsRef.current.countdown || 10));
    setCountdown(n);
    timerRef.current = window.setInterval(() => {
      if (document.hidden) {
        setPaused(true);
        setCountdown(null);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = undefined;
        }
        return;
      }
      n -= 1;
      if (n <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = undefined;
        }
        setCountdown(null);
        void makeShotRef.current();
      } else {
        setCountdown(n);
      }
    }, 1000);
  }, [streamReady]);

  makeShotRef.current = makeShot;
  sequenceNextRef.current = (continuing = false) => beginSequence(continuing);

  // Photo selection toggle
  const toggleSelectShot = (shotId: string) => {
    setSelectedShotIds(prev => {
      if (prev.includes(shotId)) {
        // Deselect
        return prev.filter(id => id !== shotId);
      } else {
        // Select
        if (prev.length < config.count) {
          return [...prev, shotId];
        } else {
          // Already have required amount - replace the last slot
          const next = [...prev];
          next[next.length - 1] = shotId;
          setToast(`Swapped photo in slot ${config.count}`);
          return next;
        }
      }
    });
  };

  const updateShotFilter = (index: number, filter: string) =>
    setShots(s => s.map((shot, i) => (i === index ? { ...shot, filter } : shot)));

  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const loadImage = useCallback((url: string): Promise<HTMLImageElement | null> => {
    if (!url) return Promise.resolve(null);
    const cached = imageCacheRef.current.get(url);
    if (cached && cached.complete && cached.naturalWidth) {
      return Promise.resolve(cached);
    }
    return new Promise<HTMLImageElement | null>(resolve => {
      const img = new Image();
      img.onload = () => {
        imageCacheRef.current.set(url, img);
        resolve(img);
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }, []);

  // Composition canvas drawing (both high-res 300DPI and on-screen preview)
  const drawComposition = useCallback(
    async (target: HTMLCanvasElement, highRes = false, includeDecor = true) => {
      const ppi = highRes ? 300 : 150;
      const width = Math.round(dims.w * ppi);
      const height = Math.round(dims.h * ppi);
      // Offscreen double-buffer prevents any blank flicker during async decoding or redrawing
      const offscreen = document.createElement('canvas');
      offscreen.width = width;
      offscreen.height = height;
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;

      // Background base
      ctx.fillStyle = design.background;
      ctx.fillRect(0, 0, width, height);

      // Custom background/paper design if active
      const activeCustomBg = settings.customBackgrounds?.find(bg => bg.id === settings.activeBackgroundId);
      if (activeCustomBg?.url) {
        const bgImg = await loadImage(activeCustomBg.url);
        if (bgImg && bgImg.complete && bgImg.naturalWidth) {
          const scale = Math.max(width / bgImg.naturalWidth, height / bgImg.naturalHeight);
          const bw = bgImg.naturalWidth * scale;
          const bh = bgImg.naturalHeight * scale;
          ctx.drawImage(bgImg, (width - bw) / 2, (height - bh) / 2, bw, bh);
        }
      }

      const isDarkBg = isColorDark(design.background);

      // Patterns
      if (design.pattern === 'dots') {
        ctx.fillStyle = isDarkBg ? 'rgba(255,255,255,0.22)' : 'rgba(88,75,59,.13)';
        for (let x = 10; x < width; x += 30) {
          for (let y = 10; y < height; y += 30) {
            ctx.beginPath();
            ctx.arc(x, y, 1.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      if (design.pattern === 'lines') {
        ctx.strokeStyle = isDarkBg ? 'rgba(255,255,255,0.18)' : 'rgba(88,75,59,.1)';
        ctx.lineWidth = 1;
        for (let y = 0; y < height; y += 22) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      }

      // Layout geometry calculation for 4x6 Canon SELPHY CP1300 (1200x1800 at 300DPI, 600x900 at 150DPI)
      const margin = Math.round(width * 0.05); // 60px @ 1200, 30px @ 600
      const bottomText = Math.max(30, Math.round(height * 0.09)); // 162px @ 1800, 81px @ 900
      const availableH = height - margin * 2 - bottomText;

      type CellSlot = { x: number; y: number; w: number; h: number; shotIndex: number };
      const cells: CellSlot[] = [];

      if (layout === '1x1') {
        // Big 1x1: One large photo occupying the 4x6 sheet, centered with proportional aspect-ratio cover crop
        cells.push({
          x: margin,
          y: margin,
          w: width - margin * 2,
          h: availableH,
          shotIndex: 0,
        });
      } else if (layout === '2x2') {
        // 2x2: Four photos in 2 columns x 2 rows
        const gapX = Math.round(width * 0.024);
        const gapY = Math.round(height * 0.016);
        const cellW = (width - margin * 2 - gapX) / 2;
        const cellH = (availableH - gapY) / 2;
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 2; c++) {
            cells.push({
              x: margin + c * (cellW + gapX),
              y: margin + r * (cellH + gapY),
              w: cellW,
              h: cellH,
              shotIndex: r * 2 + c,
            });
          }
        }
      } else if (layout === '2x4') {
        // 2x4 Twin Strips: 4 unique photos duplicated onto left and right strips, ready to cut down center
        const halfW = width / 2;
        const stripMargin = Math.round(halfW * 0.08);
        const cellW = halfW - stripMargin * 2;
        const gapY = Math.round(height * 0.014);
        const cellH = (availableH - 3 * gapY) / 4;
        for (let r = 0; r < 4; r++) {
          const y = margin + r * (cellH + gapY);
          // Left strip
          cells.push({
            x: stripMargin,
            y,
            w: cellW,
            h: cellH,
            shotIndex: r,
          });
          // Right strip (duplicate)
          cells.push({
            x: halfW + stripMargin,
            y,
            w: cellW,
            h: cellH,
            shotIndex: r,
          });
        }
      } else if (layout === '2x3_dup') {
        // 2x3 Variation 1: 3 unique photos duplicated on both left and right strips
        const halfW = width / 2;
        const stripMargin = Math.round(halfW * 0.08);
        const cellW = halfW - stripMargin * 2;
        const gapY = Math.round(height * 0.016);
        const cellH = (availableH - 2 * gapY) / 3;
        for (let r = 0; r < 3; r++) {
          const y = margin + r * (cellH + gapY);
          // Left strip
          cells.push({
            x: stripMargin,
            y,
            w: cellW,
            h: cellH,
            shotIndex: r,
          });
          // Right strip (duplicate)
          cells.push({
            x: halfW + stripMargin,
            y,
            w: cellW,
            h: cellH,
            shotIndex: r,
          });
        }
      } else {
        // 2x3_six (or legacy 2x3 collage): Six different photos
        const gapX = Math.round(width * 0.024);
        const gapY = Math.round(height * 0.016);
        const cellW = (width - margin * 2 - gapX) / 2;
        const cellH = (availableH - 2 * gapY) / 3;
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 2; c++) {
            cells.push({
              x: margin + c * (cellW + gapX),
              y: margin + r * (cellH + gapY),
              w: cellW,
              h: cellH,
              shotIndex: r * 2 + c,
            });
          }
        }
      }

      // Draw Photos in calculated cells with cover-crop aspect ratio preservation
      for (const cell of cells) {
        const shot = activeShots[cell.shotIndex];
        if (shot) {
          const img = await loadImage(shot.url);
          if (img && img.complete && img.naturalWidth && img.naturalHeight) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(cell.x, cell.y, cell.w, cell.h);
            ctx.clip();
            ctx.filter = FILTER_CSS[shot.filter] || 'none';

            // Proportional aspect-ratio cover crop (prevents stretching, squashing, or distortion)
            const imgAspect = img.naturalWidth / img.naturalHeight;
            const targetAspect = cell.w / cell.h;
            let sx = 0;
            let sy = 0;
            let sw = img.naturalWidth;
            let sh = img.naturalHeight;

            if (imgAspect > targetAspect) {
              sw = img.naturalHeight * targetAspect;
              sx = (img.naturalWidth - sw) / 2;
            } else {
              sh = img.naturalWidth / targetAspect;
              sy = (img.naturalHeight - sh) / 2;
            }

            ctx.drawImage(img, sx, sy, sw, sh, cell.x, cell.y, cell.w, cell.h);
            ctx.restore();
          }
        } else {
          ctx.fillStyle = isDarkBg ? '#1c1b18' : '#e9e4dc';
          ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
        }
      }

      // Template Accents (Minimal, Retro, Party)
      const isTwinStrip = layout === '2x4' || layout === '2x3_dup';
      if (design.template === 'Retro') {
        ctx.fillStyle = isDarkBg ? 'rgba(255,255,255,0.25)' : '#8a6348';
        if (isTwinStrip) {
          const halfW = width / 2;
          const stripMargin = Math.round(halfW * 0.08);
          const cellW = halfW - stripMargin * 2;
          ctx.fillRect(stripMargin, height - margin * 0.83, cellW, Math.max(2, width * 0.008));
          ctx.fillRect(halfW + stripMargin, height - margin * 0.83, cellW, Math.max(2, width * 0.008));
        } else {
          ctx.fillRect(margin, height - margin * 0.83, width - margin * 2, Math.max(2, width * 0.008));
        }
      }
      if (design.template === 'Party') {
        for (let i = 0; i < 12; i++) {
          ctx.fillStyle = i % 2 ? settings.accent : isDarkBg ? '#f5e6dc' : '#d2a984';
          ctx.beginPath();
          ctx.arc(
            margin + (i % 6) * ((width - 2 * margin) / 5),
            margin * 0.45 + Math.floor(i / 6) * Math.max(6, margin * 0.26),
            Math.max(2, width * 0.004),
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }

      // Custom Text & Branding Text (Immediate color application, bold typography, support staff disable)
      const defaultText = settings.event || settings.business || sessionCaption || '';
      const textToRender = settings.allowCustomText !== false
        ? ((customText && customText.trim()) || (settings.showBrand ? defaultText : ''))
        : (defaultText || (settings.showBrand ? (settings.business || 'Studio Booth') : ''));

      if (textToRender) {
        ctx.save();
        ctx.fillStyle = customTextColor;
        ctx.textBaseline = 'middle';
        if (isTwinStrip) {
          const halfW = width / 2;
          const stripMargin = Math.round(halfW * 0.08);
          const cellW = halfW - stripMargin * 2;
          ctx.font = `bold ${Math.max(10, Math.round(width * 0.034))}px Georgia, serif`;
          ctx.textAlign = 'center';
          ctx.fillText(textToRender, halfW / 2, height - margin - bottomText / 2, cellW);
          ctx.fillText(textToRender, halfW + halfW / 2, height - margin - bottomText / 2, cellW);
        } else {
          ctx.font = `bold ${Math.max(12, Math.round(width * 0.042))}px Georgia, serif`;
          ctx.textAlign = 'center';
          ctx.fillText(textToRender, width / 2, height - margin - bottomText / 2, width * 0.88);
        }
        ctx.restore();
      }

      // Center Cutting Guide (Active in preview, strictly hidden in highRes exports and physical prints)
      // Dashed vertical guide only - NO "CUT" or "cut" labels
      if (!highRes && isTwinStrip) {
        ctx.save();
        ctx.strokeStyle = isDarkBg ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.28)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(width / 2, margin * 0.3);
        ctx.lineTo(width / 2, height - margin * 0.3);
        ctx.stroke();
        ctx.restore();
      }

      // Stickers and Decor (Using decorRef to eliminate re-creating drawComposition on sticker moves)
      if (includeDecor) {
        const decorList = decorRef.current;
        for (const d of decorList) {
          const sz = ((d.size || 16) / 100) * width;
          if (d.kind === 'custom' && d.customUrl) {
            const cImg = await loadImage(d.customUrl);
            if (cImg && cImg.complete && cImg.naturalWidth) {
              ctx.drawImage(cImg, d.x * width - sz / 2, d.y * height - sz / 2, sz, sz);
            }
          } else if (d.kind !== 'text') {
            drawSticker(ctx, d.kind, d.x * width, d.y * height, sz, d.color);
          } else {
            ctx.save();
            ctx.fillStyle = d.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const fontSize = Math.round((((d.size || 24) * 0.42) / 100) * width);
            ctx.font = `bold ${fontSize}px Georgia, serif`;
            ctx.fillText(d.text || '', d.x * width, d.y * height);
            ctx.restore();
          }
        }
      }

      // Synchronously paint offscreen buffer to target canvas in a single frame
      if (target.width !== width) target.width = width;
      if (target.height !== height) target.height = height;
      const targetCtx = target.getContext('2d');
      targetCtx?.drawImage(offscreen, 0, 0);
    },
    [dims, settings, design, sessionCaption, customText, customTextColor, config, layout, activeShots, loadImage],
  );

  // Redraw preview canvas (decoupled from decor so sticker dragging does not touch or re-decode the canvas)
  useEffect(() => {
    if (!canvasRef.current || !['edit', 'review', 'printing', 'complete'].includes(view)) return;
    const target = canvasRef.current;
    drawComposition(target, false, view !== 'edit').catch(() => {});
  }, [drawComposition, view, design, sessionCaption, customText, customTextColor, settings.allowCustomText, settings.showBrand, settings.event, settings.business, previewFilter]);

  // Mini canvas for select screen
  useEffect(() => {
    if (view !== 'select' || !miniCanvasRef.current) return;
    drawComposition(miniCanvasRef.current, false, false).catch(() => {});
  }, [drawComposition, view, activeShots]);

  const makeExport = useCallback(async (format: 'image/jpeg' | 'image/png' = 'image/jpeg') => {
    const canvas = document.createElement('canvas');
    await drawComposition(canvas, true);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('Could not render print image'))),
        format,
        format === 'image/jpeg' ? 0.98 : undefined,
      ),
    );
  }, [drawComposition]);

  // Pre-render 4x6 300DPI composition when entering review screen to preserve synchronous user gesture
  useEffect(() => {
    if (view !== 'review') return;
    let cancelled = false;
    setIsPreRendering(true);
    makeExport('image/jpeg')
      .then(blob => {
        if (cancelled) return;
        preRenderedBlobRef.current = blob;
        compositionBlobRef.current = blob;
        const u = URL.createObjectURL(blob);
        printUrlRef.current = u;
        setPrintUrl(u);
        setIsPreRendering(false);
      })
      .catch(err => {
        if (cancelled) return;
        console.warn('Pre-render export failed:', err);
        setIsPreRendering(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, makeExport]);

  const addDecor = (kind: Decor['kind'], text?: string, customUrl?: string) => {
    const d: Decor = {
      id: uid(),
      kind,
      text,
      customUrl,
      x: 0.5,
      y: 0.5,
      size: kind === 'text' ? 24 : 16,
      color: kind === 'text' ? '#554a40' : accent,
    };
    setDecor(a => [...a, d]);
    setSelectedDecor(d.id);
  };

  const moveRafRef = useRef<number | null>(null);

  const startDrag = (event: PointerEvent<HTMLElement>, item: Decor, resize = false) => {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
    dragRef.current = {
      id: item.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: item.x,
      originY: item.y,
      originSize: item.size || (item.kind === 'text' ? 24 : 16),
      resize,
    };
    setSelectedDecor(item.id);
  };

  const endDrag = (_event?: PointerEvent<HTMLElement>) => {
    if (moveRafRef.current) {
      cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
    }
    if (pendingUpdateRef.current) {
      setDecor(pendingUpdateRef.current);
      pendingUpdateRef.current = null;
    }
    dragRef.current = null;
  };

  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const comp = (event.currentTarget as HTMLElement).closest('.print-composition') as HTMLElement | null;
    const r = comp?.getBoundingClientRect();
    if (!r || r.width <= 0 || r.height <= 0) return;

    const clientX = event.clientX;
    const clientY = event.clientY;
    const deltaX = clientX - d.startX;
    const deltaY = clientY - d.startY;

    const updater = (items: Decor[]) =>
      items.map(item => {
        if (item.id !== d.id) return item;
        if (d.resize) {
          const deltaPct = ((deltaX + deltaY) / r.width) * 100;
          const minSize = item.kind === 'text' ? 10 : 6;
          const maxSize = item.kind === 'text' ? 80 : 65;
          const newSize = Math.max(minSize, Math.min(maxSize, Math.round((d.originSize + deltaPct) * 10) / 10));
          return { ...item, size: newSize };
        } else {
          return {
            ...item,
            x: Math.max(0.04, Math.min(0.96, d.originX + deltaX / r.width)),
            y: Math.max(0.04, Math.min(0.96, d.originY + deltaY / r.height)),
          };
        }
      });

    pendingUpdateRef.current = updater;

    if (moveRafRef.current) cancelAnimationFrame(moveRafRef.current);
    moveRafRef.current = requestAnimationFrame(() => {
      setDecor(updater);
      moveRafRef.current = null;
    });
  };

  // Download 4x6 photo strip directly to device Gallery
  const downloadPrintPhoto = () => {
    const blob = preRenderedBlobRef.current || compositionBlobRef.current;
    if (!blob) {
      setToast('Photo composition is preparing...');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studio-booth-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
    setToast('4×6 photo saved to device.');
  };

  // Open native mobile share / print sheet directly
  const openMobileShare = async () => {
    let blob = preRenderedBlobRef.current || compositionBlobRef.current;
    if (!blob) {
      try {
        blob = await makeExport('image/jpeg');
        preRenderedBlobRef.current = blob;
        compositionBlobRef.current = blob;
      } catch {
        setPrintError('Could not prepare photo for print sheet.');
        return;
      }
    }
    const file = new File([blob], 'photostrip-4x6.jpg', { type: 'image/jpeg' });
    if (typeof navigator !== 'undefined' && Boolean(navigator.canShare) && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: settings.event || settings.business || 'Studio Snap Booth Photo Strip',
          text: 'Print to Canon SELPHY CP1300',
        });
        setReceived(true);
        setToast('Handoff complete. Select Print or Canon PRINT.');
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        window.print();
      }
    } else {
      window.print();
    }
  };

  // Open printing with multi-track dispatch
  const openPrint = async () => {
    setPrintError('');
    setPrintClosed(false);
    setReceived(false);
    setRetentionNotice('');
    setIsTestPrint(false);
    setTestPrintNotice('');
    retainedForCurrentPrintRef.current = false;

    let blob = preRenderedBlobRef.current || compositionBlobRef.current;
    if (!blob) {
      try {
        blob = await makeExport('image/jpeg');
        preRenderedBlobRef.current = blob;
        compositionBlobRef.current = blob;
        const u = URL.createObjectURL(blob);
        printUrlRef.current = u;
        setPrintUrl(u);
      } catch {
        setPrintError('Print composition could not be prepared. Please retry.');
        setView('printing');
        return;
      }
    }

    setView('printing');

    // Track 1: Local Kiosk Print Bridge (Zero-Click silent printing)
    if (settings.printMethod === 'bridge' && settings.localBridgeUrl) {
      try {
        setTestPrintNotice('Sending print job directly to local bridge server...');
        const formData = new FormData();
        formData.append('file', blob, 'photostrip-4x6.jpg');
        formData.append('copies', String(settings.copies || 1));
        formData.append('size', '4x6');
        const res = await fetch(settings.localBridgeUrl, {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          setReceived(true);
          setToast('Print sent directly to Canon SELPHY CP1300.');
          return;
        } else {
          throw new Error(`Local bridge returned HTTP ${res.status}`);
        }
      } catch (err) {
        console.warn('Bridge delivery failed:', err);
        setPrintError('Local print server unreachable. Tap below to open system print sheet.');
      }
    }

    // Track 2: Native Mobile Share-to-Print via Web Share API
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const preferShare = settings.printMethod === 'share' || (settings.printMethod === 'auto' && isMobile);
    const file = new File([blob], 'photostrip-4x6.jpg', { type: 'image/jpeg' });
    const canShareFiles = typeof navigator !== 'undefined' &&
                          Boolean(navigator.canShare) &&
                          navigator.canShare({ files: [file] });

    if (preferShare && canShareFiles) {
      try {
        await navigator.share({
          files: [file],
          title: settings.event || settings.business || 'Studio Snap Booth Photo Strip',
          text: 'Print to Canon SELPHY CP1300',
        });
        setReceived(true);
        setToast('Handoff complete. Select Print or Canon PRINT.');
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.warn('Web Share failed, falling back to window.print:', err);
      }
    }

    // Track 3: Synchronous Browser Print Dialog
    try {
      window.print();
    } catch {
      setPrintError('Browser could not open print dialog. Tap "Open Print Sheet" or download below.');
    }
  };

  useEffect(() => {
    const after = () => {
      if (view === 'printing') {
        setPrintClosed(true);
        setPrintError('');
        if (isTestPrint) setTestPrintNotice('Test print dialog closed — printer output not confirmed.');
      }
    };
    window.addEventListener('afterprint', after);
    return () => window.removeEventListener('afterprint', after);
  }, [view, isTestPrint]);

  const retryPrint = () => {
    if (isTestPrint) {
      testPrint();
      return;
    }
    setPrintClosed(false);
    void openPrint();
  };

  const done = async () => {
    await clearTransient();
    setView('welcome');
  };

  const saveLogo = (file?: File) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setSettings(s => ({ ...s, logo: String(r.result || '') }));
    r.readAsDataURL(file);
  };

  const saveCustomSticker = (file?: File) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const newSticker: CustomSticker = {
        id: uid(),
        name: file.name.replace(/\.[^/.]+$/, ''),
        url: String(r.result || ''),
      };
      setSettings(s => ({ ...s, customStickers: [...(s.customStickers || []), newSticker] }));
      setToast('Custom sticker uploaded successfully.');
    };
    r.readAsDataURL(file);
  };

  const handleBgFileSelect = (file?: File) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const dataUrl = String(r.result || '');
      setBgUploadPreview(dataUrl);
      if (!bgUploadName.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setBgUploadName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
    };
    r.readAsDataURL(file);
  };

  const saveCustomBackground = () => {
    if (!bgUploadPreview) return;
    const name = bgUploadName.trim() || 'Custom Background';
    const newBg: CustomBackground = {
      id: uid(),
      name,
      url: bgUploadPreview,
    };
    setSettings(s => ({
      ...s,
      customBackgrounds: [...(s.customBackgrounds || []), newBg],
      activeBackgroundId: newBg.id,
    }));
    setBgUploadPreview(null);
    setBgUploadName('');
    setToast(`Background "${name}" saved and set as active.`);
  };

  const deleteCustomBackground = (id: string, name: string) => {
    if (!window.confirm(`Delete custom background "${name}"?`)) return;
    setSettings(s => ({
      ...s,
      customBackgrounds: (s.customBackgrounds || []).filter(bg => bg.id !== id),
      activeBackgroundId: s.activeBackgroundId === id ? null : s.activeBackgroundId,
    }));
    setToast(`Background "${name}" deleted.`);
  };

  const setActiveBackground = (id: string | null) => {
    setSettings(s => ({ ...s, activeBackgroundId: id }));
    if (id) {
      const found = settings.customBackgrounds?.find(b => b.id === id);
      setToast(`Active background set to "${found?.name || 'Custom'}".`);
    } else {
      setToast('Default plain background restored.');
    }
  };

  const saveWelcomeImage = (file?: File) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const dataUrl = String(r.result || '');
      updateSetting('welcomeImage', dataUrl);
      setToast('Custom welcome image saved.');
    };
    r.readAsDataURL(file);
  };

  const restoreWelcomeDefaults = () => {
    if (!window.confirm('Restore welcome page text and image to default?')) return;
    setSettings(s => ({
      ...s,
      welcomeHeadline: BASE_SETTINGS.welcomeHeadline,
      welcomeTitle: BASE_SETTINGS.welcomeTitle,
      welcomeSubtitle: '',
      welcomeImage: '',
    }));
    setToast('Welcome page defaults restored.');
  };

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings(s => ({ ...s, [key]: value }));

  const refreshRetained = useCallback(async () => {
    const entries = await readRetainedDesigns();
    if (!staffUnlockedRef.current) return;
    retainedObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    retainedObjectUrlsRef.current = entries.map(item => URL.createObjectURL(item.blob));
    setRetainedDesigns(entries.map((item, index) => ({ ...item, url: retainedObjectUrlsRef.current[index] })));
  }, []);

  useEffect(() => {
    if (staffUnlocked) {
      void refreshRetained().catch(() => setRetentionNotice('Could not read retained designs from device.'));
    } else {
      retainedObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      retainedObjectUrlsRef.current = [];
      setRetainedDesigns([]);
    }
  }, [staffUnlocked, refreshRetained]);

  const acknowledgePrint = async () => {
    if (received || retentionBusy) return;
    setReceived(true);
    if (!settings.retention || isTestPrint || retainedForCurrentPrintRef.current || !compositionBlobRef.current) return;
    setRetentionBusy(true);
    try {
      const item: RetainedDesign = {
        id: uid(),
        blob: compositionBlobRef.current,
        createdAt: new Date().toISOString(),
        label: sessionCaption || settings.event || settings.business || 'Photo design',
      };
      await saveRetainedDesign(item);
      retainedForCurrentPrintRef.current = true;
      setRetentionNotice('Design retained on this device. Staff can preview or export in Settings.');
    } catch {
      setRetentionNotice('Print acknowledged, but design could not be retained.');
    } finally {
      setRetentionBusy(false);
    }
  };

  const removeRetained = async (id: string) => {
    try {
      await deleteRetainedDesign(id);
      await refreshRetained();
      setRetentionNotice('Retained design deleted.');
    } catch {
      setRetentionNotice('Could not delete retained design.');
    }
  };

  const removeAllRetained = async () => {
    if (!window.confirm('Delete all retained designs from this device?')) return;
    try {
      await deleteAllRetainedDesigns();
      await refreshRetained();
      setRetentionNotice('All retained designs deleted.');
    } catch {
      setRetentionNotice('Could not delete all designs.');
    }
  };

  // Staff PIN logic
  const staffEntry = () => {
    setStaffOpen(true);
    setStaffUnlocked(false);
    setPin('');
    setPinSetup(!staffPin);
    setStaffTab('settings');
  };

  const pinInput = (digit: string) => {
    if (digit === 'clear') {
      setPin('');
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      if (pinSetup) {
        if (!pinFirst) {
          setPinFirst(next);
          setPin('');
          setToast('Enter PIN once more to confirm.');
        } else if (next === pinFirst) {
          localStorage.setItem('studio-booth-pin', next);
          setStaffPin(next);
          setStaffUnlocked(true);
          setPinSetup(false);
          setPin('');
        } else {
          setPin('');
          setPinFirst('');
          setToast('PINs did not match. Start again.');
        }
      } else if (next === staffPin) {
        setStaffUnlocked(true);
        setPin('');
      } else {
        setPin('');
        setToast('Incorrect PIN.');
      }
    }
  };

  const closeStaff = () => {
    retainedObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    retainedObjectUrlsRef.current = [];
    setRetainedDesigns([]);
    setStaffOpen(false);
    setStaffUnlocked(false);
    setPin('');
    setPinFirst('');
  };

  const testPrint = async () => {
    closeStaff();
    setIsTestPrint(true);
    setTestPrintNotice('Sending test page to Canon SELPHY CP1300...');
    setPrintError('');
    setPrintClosed(false);
    setReceived(false);
    retainedForCurrentPrintRef.current = false;

    const c = document.createElement('canvas');
    c.width = 1200; // 4 inches @ 300 DPI
    c.height = 1800; // 6 inches @ 300 DPI
    const ctx = c.getContext('2d');
    if (!ctx) {
      setPrintError('Could not prepare test print.');
      setView('printing');
      return;
    }
    // High-contrast clean 4x6 test pattern
    ctx.fillStyle = '#fffefa';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 6;
    ctx.strokeRect(60, 60, c.width - 120, c.height - 120);

    ctx.fillStyle = '#222';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 72px Georgia, serif';
    ctx.fillText(settings.business || 'Studio Booth', c.width / 2, c.height * 0.40);

    ctx.fillStyle = accent;
    ctx.font = '600 38px sans-serif';
    ctx.fillText('Canon SELPHY CP1300 Test Page', c.width / 2, c.height * 0.48);

    ctx.fillStyle = '#666';
    ctx.font = '28px sans-serif';
    ctx.fillText('4 × 6 in · 300 DPI · 1200 × 1800 px', c.width / 2, c.height * 0.54);
    ctx.fillText(new Date().toLocaleString(), c.width / 2, c.height * 0.58);

    const testBlob = await new Promise<Blob | null>(resolve => c.toBlob(resolve, 'image/jpeg', 0.98));
    if (!testBlob) {
      setPrintError('Could not prepare test print.');
      setView('printing');
      return;
    }

    compositionBlobRef.current = testBlob;
    const testUrl = URL.createObjectURL(testBlob);
    printUrlRef.current = testUrl;
    setPrintUrl(testUrl);
    setView('printing');

    // Local Bridge
    if (settings.printMethod === 'bridge' && settings.localBridgeUrl) {
      try {
        const formData = new FormData();
        formData.append('file', testBlob, 'test-page-4x6.jpg');
        formData.append('copies', '1');
        formData.append('size', '4x6');
        const res = await fetch(settings.localBridgeUrl, { method: 'POST', body: formData });
        if (res.ok) {
          setReceived(true);
          setTestPrintNotice('Test print successfully dispatched to local bridge.');
          return;
        }
      } catch (err) {
        console.warn('Test print bridge error:', err);
      }
    }

    // Mobile Share
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const preferShare = settings.printMethod === 'share' || (settings.printMethod === 'auto' && isMobile);
    const file = new File([testBlob], 'selphy-test-4x6.jpg', { type: 'image/jpeg' });
    if (preferShare && typeof navigator !== 'undefined' && Boolean(navigator.canShare) && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Canon SELPHY CP1300 Test Print',
          text: 'Test print from Studio Snap Booth',
        });
        setTestPrintNotice('Test page handed off to system print sheet.');
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    // Browser Print
    try {
      window.print();
    } catch {
      setPrintError('Could not open print dialog.');
    }
  };

  const closeTestPrint = () => {
    if (printUrlRef.current) {
      URL.revokeObjectURL(printUrlRef.current);
      printUrlRef.current = '';
    }
    setPrintUrl('');
    compositionBlobRef.current = null;
    setIsTestPrint(false);
    setPrintError('');
    setPrintClosed(false);
    setView('welcome');
  };

  // Fullscreen / Kiosk Mode handler
  const toggleKioskMode = () => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => {
          updateSetting('kioskMode', true);
          setToast('Kiosk mode activated (Fullscreen).');
        })
        .catch(() => {
          updateSetting('kioskMode', !settings.kioskMode);
          setToast('Kiosk mode toggled.');
        });
    } else {
      document
        .exitFullscreen()
        .then(() => {
          updateSetting('kioskMode', false);
          setToast('Kiosk mode exited.');
        })
        .catch(() => {
          updateSetting('kioskMode', false);
        });
    }
  };

  // System Backup Export
  const exportBackup = () => {
    const backupData = {
      app: 'Studio Booth',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      settings,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studio-booth-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast('Backup file downloaded.');
  };

  // System Backup Restore
  const restoreBackup = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || '{}'));
        if (data.app !== 'Studio Booth' && !data.settings) {
          alert('Invalid backup file. Please select a valid Studio Booth backup JSON.');
          return;
        }
        if (window.confirm('Restore settings and assets from this backup? Your current configuration will be replaced.')) {
          const restoredSettings = { ...BASE_SETTINGS, ...data.settings };
          setSettings(restoredSettings);
          setDesign(designFor(restoredSettings));
          setToast('Configuration restored successfully.');
        }
      } catch {
        alert('Could not parse backup file.');
      }
    };
    reader.readAsText(file);
  };

  const navBack = () => {
    if (view === 'layouts') setView('welcome');
    if (view === 'camera') {
      releaseCamera();
      setView('layouts');
    }
    if (view === 'select') setView('layouts');
    if (view === 'edit') setView('select');
    if (view === 'review') setView('edit');
    if (view === 'printing') setView('review');
  };

  const currentStep = ({
    layouts: 1,
    camera: 2,
    select: 3,
    edit: 4,
    review: 5,
    printing: 5,
    complete: 6,
  } as Partial<Record<View, number>>)[view];

  // Visible Layouts based on staff configuration
  const availableLayouts = useMemo(() => {
    const rawAllowed = (settings.enabledLayouts || ALL_LAYOUTS.map(l => l.id)) as string[];
    const allowed = rawAllowed.map(id => {
      if (id === '1x4') return '2x4';
      if (id === '1x3') return '2x3_dup';
      if (id === '2x3') return '2x3_dup';
      return id;
    });
    const filtered = ALL_LAYOUTS.filter(l => allowed.includes(l.id));
    return filtered.length > 0 ? filtered : ALL_LAYOUTS;
  }, [settings.enabledLayouts]);

  // Visible Templates based on staff configuration
  const availableTemplates = useMemo(() => {
    const allowed = settings.enabledTemplates || ALL_TEMPLATES;
    return ALL_TEMPLATES.filter(t => allowed.includes(t));
  }, [settings.enabledTemplates]);

  // Visible Filters based on staff configuration
  const availableFilters = useMemo(() => {
    const raw = (settings.enabledFilters || ALL_FILTERS) as string[];
    const allowed = raw.map(f => (f === 'Natural' ? 'None' : f));
    const filtered = ALL_FILTERS.filter(f => allowed.includes(f));
    return filtered.length > 0 ? filtered : ALL_FILTERS;
  }, [settings.enabledFilters]);

  // Sizing style for the enlarged, prominent preview in the editor
  const compositionStyle = useMemo(() => {
    if (compositionRatio <= 1) {
      // Tall photostrip or square layout
      return {
        height: 'min(76dvh, 760px)',
        maxWidth: '100%',
        aspectRatio: `${compositionRatio}`,
        background: design.background,
      };
    } else {
      // Landscape layout
      return {
        width: 'min(100%, 740px)',
        maxHeight: 'min(76dvh, 720px)',
        aspectRatio: `${compositionRatio}`,
        background: design.background,
      };
    }
  }, [compositionRatio, design.background]);

  return (
    <div
      className={`app-shell ${settings.kioskMode ? 'is-kiosk' : ''}`}
      style={{ '--accent': accent } as React.CSSProperties}
    >
      <header className="topline">
        <div className="brand">
          {settings.logo ? (
            <img src={settings.logo} alt="Business logo" style={{ width: 38, height: 38, objectFit: 'contain' }} />
          ) : (
            <div className="brand-mark">
              <Aperture size={20} />
            </div>
          )}
          <span className="brand-name">{settings.business || 'Studio Booth'}</span>
          {settings.event && <span className="event-label">{settings.event}</span>}
        </div>
        <div className="top-actions">
          {settings.kioskMode && <span className="kiosk-badge">Kiosk Active</span>}
          <div className="top-note">{currentStep ? `Studio session · 0${currentStep} / 06` : 'A little moment, made yours'}</div>
        </div>
      </header>

      {sessionNotice && view !== 'welcome' && (
        <div role="status" data-testid="status-session" style={{ textAlign: 'center', fontSize: 12, color: '#756d63', padding: '6px 12px' }}>
          {sessionNotice}
        </div>
      )}

      <main className="main-area">
        {/* Step 1: Welcome */}
        {view === 'welcome' && (
          <section className="welcome">
            <div className="welcome-copy">
              <div className="eyebrow">A moment worth keeping</div>
              <h1>
                {settings.welcomeTitle ? (
                  settings.welcomeTitle.split('\n').map((line, idx, arr) => (
                    <span key={idx}>
                      {idx === 0 ? line : <em>{line}</em>}
                      {idx < arr.length - 1 && <br />}
                    </span>
                  ))
                ) : (
                  <>
                    Step in.
                    <br />
                    <em>Let it happen.</em>
                  </>
                )}
              </h1>
              <p className="lead">
                {settings.welcomeSubtitle
                  ? settings.welcomeSubtitle
                  : settings.event
                    ? `A portrait studio, here for ${settings.event}. Gather your people and make something you can take home.`
                    : 'A portrait studio, made for the good moments. Gather your people and make something you can take home.'}
              </p>
              <button className="primary-btn" onClick={() => void startFresh()} data-testid="button-start-booth">
                START PHOTO BOOTH <ArrowRight size={18} />
              </button>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="art-ring" />
              <Sparkles className="art-spark" style={{ top: '13%', right: '16%' }} size={24} />
              <Star className="art-spark" style={{ bottom: '19%', left: '14%' }} size={19} />
              <div className="art-card">
                {settings.welcomeImage ? (
                  <img
                    src={settings.welcomeImage}
                    alt="Welcome studio visual"
                    className="art-photo"
                    style={{ objectFit: 'cover', width: '100%', height: '82%', display: 'block' }}
                    data-testid="welcome-custom-photo"
                  />
                ) : (
                  <div className="art-photo" data-testid="welcome-default-photo" />
                )}
                <div className="art-caption" data-testid="welcome-headline-text">
                  {settings.welcomeHeadline || 'the good kind of blur'}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Step 2: Layouts */}
        {view === 'layouts' && (
          <>
            <div className="step-wrap">
              <div className="step-heading">
                <div>
                  <div className="eyebrow">Step 01 — Format</div>
                  <h1 className="step-title">Choose your layout.</h1>
                  <p className="step-subtitle">Pick a format. We will take {config.count + extraShots} photos so you can choose your favorite {config.count}.</p>
                </div>
                <span className="step-tag">{availableLayouts.length} formats available</span>
              </div>
              <div className="layout-grid">
                {availableLayouts.map(l => (
                  <button
                    key={l.id}
                    className={`layout-card ${layout === l.id ? 'selected' : ''}`}
                    onClick={() => setLayout(l.id)}
                    data-testid={`layout-${l.id}`}
                    aria-pressed={layout === l.id}
                  >
                    <div className="layout-preview">
                      <LayoutThumbnail layout={l} />
                    </div>
                    <div className="layout-meta">
                      <strong>{l.label}</strong>
                      <span>
                        {l.description ? l.description : `${l.count} ${l.count === 1 ? 'photo' : 'photos'}`}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="footer-actions">
              <button className="quiet-btn" onClick={navBack} data-testid="button-back-layout">
                <ArrowLeft size={16} /> Back
              </button>
              <button className="primary-btn" onClick={() => void enterCamera()} data-testid="button-confirm-layout">
                CONTINUE TO CAMERA <ArrowRight size={18} />
              </button>
            </div>
          </>
        )}

        {/* Step 3: Camera Capture Flow (Takes config.count + 2 extra shots, NO retakes) */}
        {view === 'camera' && (
          <>
            <div className="step-wrap">
              <div className="step-heading">
                <div>
                  <div className="eyebrow">Step 02 — Camera</div>
                  <h1 className="step-title">Find your light.</h1>
                  <p className="step-subtitle">
                    Taking {targetShotsCount} photos total ({config.count} for your print + {extraShots} extra bonus shots to choose from!).
                  </p>
                </div>
                <span className="step-tag">{layout} · {targetShotsCount} total takes</span>
              </div>
            </div>
            <section className="camera-panel">
              <div>
                <div className="camera-window">
                  {streamReady ? (
                    <video ref={videoRef} autoPlay muted playsInline data-testid="camera-preview" />
                  ) : (
                    <div className="camera-placeholder">
                      <Aperture size={35} />
                      <strong>Ready when you are.</strong>
                      <p>{cameraError || 'Allow camera access to see yourself in the frame.'}</p>
                    </div>
                  )}
                  {flashPulse && <div className="screen-flash-pulse" aria-hidden="true" />}
                  {countdown !== null && (
                    <div className="camera-countdown-overlay" data-testid="countdown-overlay">
                      <span className="camera-countdown-number" key={countdown} data-testid="countdown-number">
                        {countdown}
                      </span>
                    </div>
                  )}
                </div>
                {cameraError && (
                  <div className="camera-error" role="alert" data-testid="status-camera-error">
                    {cameraError}
                  </div>
                )}
              </div>
              <aside className="camera-side">
                <h2>{isCapturing ? 'Look this way!' : 'Your session'}</h2>
                <div>
                  <div className="progress-label">
                    Photo {Math.min(shots.length + 1, targetShotsCount)} of {targetShotsCount}
                  </div>
                  <div className="progress-track">
                    {Array.from({ length: targetShotsCount }, (_, i) => (
                      <div key={i} className={`progress-dot ${i < shots.length ? 'done' : ''}`} />
                    ))}
                  </div>
                </div>

                <div className="capture-thumbs">
                  {Array.from({ length: targetShotsCount }, (_, i) => (
                    <div key={i} className="capture-thumb" data-testid={`capture-slot-${i}`}>
                      {shots[i] ? (
                        <>
                          <img src={shots[i].url} alt={`Captured take ${i + 1}`} />
                          <small>Take {i + 1}</small>
                        </>
                      ) : (
                        <small>Take {i + 1}</small>
                      )}
                    </div>
                  ))}
                </div>


                {paused && (
                  <div className="camera-error" role="status">
                    {document.hidden
                      ? 'Camera paused while inactive. Tap reconnect to continue.'
                      : 'Camera needs attention. Reconnect to continue.'}
                  </div>
                )}

                <div className="photo-actions">
                  {!streamReady ? (
                    <button className="primary-btn" onClick={() => void startCamera()} data-testid="button-reconnect-camera">
                      RECONNECT CAMERA
                    </button>
                  ) : shots.length === 0 || shots.length < targetShotsCount ? (
                    <button
                      className="primary-btn"
                      onClick={() => beginSequence()}
                      disabled={isCapturing}
                      data-testid="button-start-session"
                    >
                      {isCapturing ? `CAPTURING PHOTO ${shots.length + 1} OF ${targetShotsCount}…` : 'START CAPTURE'} <Aperture size={17} />
                    </button>
                  ) : shots.length >= targetShotsCount && targetShotsCount > 0 ? (
                    <button
                      className="primary-btn"
                      onClick={() => {
                        releaseCamera();
                        setSelectedShotIds(shots.slice(0, config.count).map(s => s.id));
                        setView('select');
                      }}
                      data-testid="button-continue-select"
                    >
                      CHOOSE FAVORITE PHOTOS <ArrowRight size={17} />
                    </button>
                  ) : (
                    <button
                      className="primary-btn"
                      onClick={() => beginSequence()}
                      disabled={isCapturing}
                      data-testid="button-start-session"
                    >
                      START CAPTURE <Aperture size={17} />
                    </button>
                  )}
                  {shots.length > 0 && (
                    <button
                      className="quiet-btn"
                      onClick={() => {
                        void clearTransient().then(() => {
                          setSessionCaption(settings.event);
                          setDesign(designFor(settings));
                          setView('camera');
                          void startCamera();
                        });
                      }}
                      data-testid="button-restart-session"
                    >
                      <RotateCcw size={15} /> Restart session
                    </button>
                  )}
                </div>
              </aside>
            </section>
            <div className="footer-actions">
              <button className="quiet-btn" onClick={navBack} data-testid="button-back-camera">
                <ArrowLeft size={16} /> Layouts
              </button>
              <span className="step-tag">{cameraStatus}</span>
            </div>
          </>
        )}

        {/* Step 4: Photo Selection Workflow (Select config.count from targetShotsCount takes) */}
        {view === 'select' && (
          <>
            <div className="step-wrap">
              <div className="step-heading">
                <div>
                  <div className="eyebrow">Step 03 — Photo Selection</div>
                  <h1 className="step-title">Choose your {config.count} favorite takes.</h1>
                  <p className="step-subtitle">
                    Select exactly {config.count} photos for your {config.label} layout{config.duplicated ? ' (they will be printed onto both twin strips)' : ''}. Tap any photo to select or deselect it.
                  </p>
                </div>
                <span className="step-tag">
                  {selectedShotIds.length} of {config.count} chosen
                </span>
              </div>
            </div>

            <section className="selection-area">
              <div className="takes-grid">
                {shots.map((shot, idx) => {
                  const isSelected = selectedShotIds.includes(shot.id);
                  const slotIndex = selectedShotIds.indexOf(shot.id);
                  return (
                    <div
                      key={shot.id}
                      className={`take-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleSelectShot(shot.id)}
                      data-testid={`take-card-${idx}`}
                      role="checkbox"
                      aria-checked={isSelected}
                    >
                      <img src={shot.url} alt={`Take ${idx + 1}`} />
                      {isSelected ? (
                        <div className="take-badge">
                          <Check size={14} /> Slot #{slotIndex + 1}
                        </div>
                      ) : (
                        <div className="take-unselected-badge">Tap to choose</div>
                      )}
                      <span className="take-num">Take {idx + 1}</span>
                    </div>
                  );
                })}
              </div>

              <aside className="selection-aside">
                <h3>Layout preview</h3>
                <div className="selection-status-box">
                  {selectedShotIds.length === config.count ? (
                    <strong style={{ color: '#2d6a4f' }}>
                      ✓ All {config.count} photos selected! Ready to customize your print.
                    </strong>
                  ) : (
                    <span>
                      Please select <strong>{config.count - selectedShotIds.length} more</strong> {config.count - selectedShotIds.length === 1 ? 'photo' : 'photos'} ({selectedShotIds.length} of {config.count} chosen).
                    </span>
                  )}
                </div>

                <div className="mini-strip-box">
                  <canvas ref={miniCanvasRef} style={{ maxHeight: 220, maxWidth: '100%', objectFit: 'contain' }} />
                </div>

                {selectedShotIds.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      className="quiet-btn"
                      style={{ minHeight: 44, fontSize: 13 }}
                      onClick={() => setSelectedShotIds([])}
                      data-testid="button-clear-selection"
                    >
                      <RotateCcw size={14} /> Clear selections
                    </button>
                  </div>
                )}

                <button
                  className="primary-btn"
                  style={{ width: '100%', marginTop: 8 }}
                  disabled={selectedShotIds.length !== config.count}
                  onClick={() => setView('edit')}
                  data-testid="button-continue-to-edit"
                >
                  CONTINUE TO EDIT <ArrowRight size={17} />
                </button>
              </aside>
            </section>

            <div className="footer-actions">
              <button className="quiet-btn" onClick={navBack} data-testid="button-back-select">
                <ArrowLeft size={16} /> Choose format
              </button>
              <span className="step-tag">
                {selectedShotIds.length === config.count ? 'Ready to continue' : `Select ${config.count - selectedShotIds.length} more`}
              </span>
            </div>
          </>
        )}

        {/* Step 5: Studio Editor (Significantly Enlarged Preview) */}
        {view === 'edit' && (
          <>
            <div className="step-wrap" style={{ paddingBottom: 6 }}>
              <div className="step-heading">
                <div>
                  <div className="eyebrow">Step 04 — Make it yours</div>
                  <h1 className="step-title">Style your print.</h1>
                </div>
                <span className="step-tag">Drag stickers · pinch or drag handle to resize</span>
              </div>
            </div>

            <section className="studio-editor">
              <aside className="edit-controls">
                {/* Templates */}
                {settings.enabled.includes('templates') && availableTemplates.length > 0 && (
                  <div className="control-section">
                    <h3>Studio style</h3>
                    <div className="chip-row">
                      {availableTemplates.map(t => (
                        <button
                          className={`chip ${design.template === t ? 'active' : ''}`}
                          key={t}
                          onClick={() => setDesign(d => ({ ...d, template: t }))}
                          data-testid={`template-${t.toLowerCase()}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Backgrounds & Textures */}
                {settings.enabled.includes('backgrounds') && (
                  <div className="control-section">
                    <h3>Background & Texture</h3>
                    {settings.customBackgrounds && settings.customBackgrounds.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <span style={{ fontSize: 11, color: '#817c74', display: 'block', marginBottom: 6 }}>
                          Custom Paper Designs
                        </span>
                        <div className="chip-row">
                          <button
                            className={`chip ${!settings.activeBackgroundId ? 'active' : ''}`}
                            onClick={() => updateSetting('activeBackgroundId', null)}
                            data-testid="bg-paper-none"
                          >
                            Solid color
                          </button>
                          {settings.customBackgrounds.map(bg => (
                            <button
                              key={bg.id}
                              className={`chip ${settings.activeBackgroundId === bg.id ? 'active' : ''}`}
                              onClick={() => updateSetting('activeBackgroundId', bg.id)}
                              data-testid={`bg-paper-${bg.id}`}
                            >
                              {bg.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="swatches">
                      {PAPER_COLORS.map(color => (
                        <button
                          key={color.hex}
                          className={`swatch ${design.background === color.hex ? 'active' : ''}`}
                          style={{
                            background: color.hex,
                            border: color.hex === '#ffffff' ? '1px solid #d4cec4' : undefined,
                          }}
                          title={color.name}
                          aria-label={`${color.name} paper`}
                          onClick={() => setDesign(d => ({ ...d, background: color.hex }))}
                          data-testid={`background-${color.hex.slice(1)}`}
                        />
                      ))}
                    </div>
                    <div className="chip-row" style={{ marginTop: 12 }}>
                      {['none', 'dots', 'lines'].map(p => (
                        <button
                          key={p}
                          className={`chip ${design.pattern === p ? 'active' : ''}`}
                          onClick={() => setDesign(d => ({ ...d, pattern: p }))}
                          data-testid={`pattern-${p}`}
                        >
                          {p === 'none' ? 'Plain' : p === 'dots' ? 'Soft dots' : 'Fine lines'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tone Filters */}
                {settings.enabled.includes('filters') && availableFilters.length > 0 && (
                  <div className="control-section">
                    <h3>Photo tone · select a frame</h3>
                    <div
                      className="capture-thumbs"
                      style={{ gridTemplateColumns: `repeat(${Math.min(config.count, 4)}, 1fr)`, marginBottom: 10 }}
                    >
                      {activeShots.map((shot, i) => (
                        <button
                          key={shot.id}
                          onClick={() => setSelectedShotForFilter(selectedShotForFilter === i ? null : i)}
                          className={`capture-thumb ${selectedShotForFilter === i ? 'selected' : ''}`}
                          aria-label={`Select photo ${i + 1} or tap again to select all`}
                          data-testid={`edit-photo-${i}`}
                        >
                          <img src={shot.url} alt={`Photo ${i + 1}`} />
                          <small>{i + 1}</small>
                        </button>
                      ))}
                    </div>
                    <div className="chip-row">
                      <span style={{ fontSize: 11, color: '#817c74', alignSelf: 'center' }}>
                        {selectedShotForFilter === null ? 'All frames' : `Frame ${selectedShotForFilter + 1}`}
                      </span>
                      {availableFilters.map(f => (
                        <button
                          key={f}
                          className={`chip ${(selectedShotForFilter === null ? previewFilter : activeShots[selectedShotForFilter]?.filter) === f ? 'active' : ''}`}
                          onClick={() => {
                            setPreviewFilter(f);
                            if (selectedShotForFilter !== null) {
                              updateShotFilter(selectedShotForFilter, f);
                            } else {
                              setShots(items => items.map(s => ({ ...s, filter: f })));
                            }
                          }}
                          data-testid={`filter-${f.toLowerCase().replace(/[^a-z]/g, '')}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stickers & Text */}
                {settings.enabled.includes('stickers') && (
                  <div className="control-section">
                    <h3>Little details & Stickers</h3>
                    <div className="chip-row">
                      {(['heart', 'star', 'flower', 'sparkle', 'smiley', 'party'] as const).map(kind => (
                        <button key={kind} className="chip" onClick={() => addDecor(kind)} aria-label={`Add ${kind} sticker`} data-testid={`sticker-${kind}`}>
                          <Sticker kind={kind} color={accent} size={20} />
                        </button>
                      ))}
                      {/* Custom uploaded stickers */}
                      {settings.customStickers?.map(cs => (
                        <button key={cs.id} className="chip" onClick={() => addDecor('custom', undefined, cs.url)} title={cs.name}>
                          <img src={cs.url} alt={cs.name} style={{ width: 22, height: 22, objectFit: 'contain' }} />
                        </button>
                      ))}
                      <button
                        className="chip"
                        onClick={() => {
                          const text = window.prompt('Add a short message or greeting');
                          if (text?.trim()) addDecor('text', text.trim());
                        }}
                        data-testid="button-add-text"
                      >
                        <Type size={18} /> Add text
                      </button>
                    </div>

                    {selectedDecor && (
                      <button
                        className="quiet-btn"
                        style={{ marginTop: 12 }}
                        onClick={() => {
                          setDecor(ds => ds.filter(d => d.id !== selectedDecor));
                          setSelectedDecor(null);
                        }}
                        data-testid="button-remove-decoration"
                      >
                        <Trash2 size={15} /> Remove selected sticker
                      </button>
                    )}
                  </div>
                )}

                {/* Custom Text Option */}
                <div className="control-section">
                  <h3>{settings.allowCustomText !== false ? 'Custom text' : 'Print text'}</h3>
                  {settings.allowCustomText !== false ? (
                    <div className="field">
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          id="event-line"
                          type="text"
                          value={customText}
                          placeholder="Add custom text or message..."
                          onChange={e => {
                            setCustomText(e.target.value);
                            setSessionCaption(e.target.value);
                          }}
                          data-testid="input-custom-text"
                          style={{ flex: 1 }}
                        />
                        {customText && (
                          <button
                            type="button"
                            className="chip"
                            style={{ padding: '6px 12px', height: 'auto', minHeight: 0 }}
                            onClick={() => {
                              setCustomText('');
                              setSessionCaption('');
                            }}
                            data-testid="button-clear-custom-text"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(0,0,0,0.03)',
                        borderRadius: 6,
                        border: '1px solid #e5dfd5',
                        fontSize: 13,
                        color: '#49423b',
                      }}
                      data-testid="default-text-display"
                    >
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#888', marginBottom: 2 }}>
                        Default print text
                      </div>
                      <strong>{settings.event || settings.business || 'Studio Booth'}</strong>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                        Automatically placed at bottom of photo strip.
                      </div>
                    </div>
                  )}
                  <div style={{ marginTop: 10 }}>
                    <span style={{ fontSize: 12, color: '#686259', display: 'block', marginBottom: 6 }}>
                      Text color
                    </span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {TEXT_COLORS.map(tc => (
                        <button
                          key={tc.hex}
                          type="button"
                          className={`chip ${customTextColor === tc.hex ? 'active' : ''}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontWeight: customTextColor === tc.hex ? 600 : 400,
                          }}
                          onClick={() => setCustomTextColor(tc.hex)}
                          data-testid={`text-color-${tc.name.toLowerCase().replace(/\s+/g, '-')}`}
                          aria-label={`Select ${tc.name} text color`}
                        >
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              background: tc.hex,
                              border: tc.hex === '#ffffff' ? '1px solid #c8c2b8' : undefined,
                              display: 'inline-block',
                            }}
                          />
                          {tc.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </aside>

              {/* High-Priority Enlarged Photo Preview */}
              <div className="preview-wrap">
                <div className="print-composition" style={compositionStyle} data-testid="composition-preview">
                  <canvas ref={canvasRef} aria-label="Live high-resolution print preview" />
                  {decor.map(d => {
                    const isText = d.kind === 'text';
                    const sizeVal = d.size || (isText ? 24 : 16);
                    return (
                      <div
                        key={d.id}
                        className={`editor-object ${selectedDecor === d.id ? 'selected' : ''}`}
                        style={{
                          left: `${d.x * 100}%`,
                          top: `${d.y * 100}%`,
                          width: isText ? 'auto' : `${sizeVal}cqw`,
                          height: isText ? 'auto' : `${sizeVal}cqw`,
                          fontSize: isText ? `${sizeVal * 0.42}cqw` : undefined,
                          color: d.color,
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onPointerDown={e => startDrag(e, d)}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        data-testid={`decoration-${d.id}`}
                      >
                        {isText ? (
                          <span style={{ fontWeight: 'bold', fontFamily: 'Georgia, serif' }}>{d.text}</span>
                        ) : (
                          <Sticker kind={d.kind} color={d.color} size="100%" customUrl={d.customUrl} />
                        )}
                        <span
                          className="resize-handle"
                          onPointerDown={e => {
                            e.stopPropagation();
                            startDrag(e, d, true);
                          }}
                          onPointerMove={moveDrag}
                          onPointerUp={e => {
                            e.stopPropagation();
                            endDrag(e);
                          }}
                          onPointerCancel={e => {
                            e.stopPropagation();
                            endDrag(e);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <div className="footer-actions">
              <button className="quiet-btn" onClick={() => setView('select')} data-testid="button-back-edit">
                <ArrowLeft size={16} /> Change photo selection
              </button>
              <button className="primary-btn" onClick={() => setView('review')} data-testid="button-review-print">
                REVIEW PRINT <ArrowRight size={18} />
              </button>
            </div>
          </>
        )}

        {/* Step 6: Review Screen */}
        {view === 'review' && (
          <>
            <div className="step-wrap" style={{ paddingBottom: 2 }}>
              <div className="eyebrow">Step 05 — The final look</div>
            </div>
            <section className="review-wrap">
              <div className="review-print" style={{ aspectRatio: `${compositionRatio}`, background: design.background }}>
                <canvas ref={canvasRef} data-testid="review-canvas" />
              </div>
              <div className="review-copy">
                <div className="eyebrow">Ready to print</div>
                <h2>
                  Looks like
                  <br />a keeper.
                </h2>
                <p>Take a final look. Your high-resolution 300-DPI composition will be sent to the Canon SELPHY printer.</p>
                <div className="print-info">
                  <strong>
                    {dims.w} × {dims.h} in · 300 DPI · {settings.copies} {settings.copies === 1 ? 'copy' : 'copies'}
                  </strong>
                  <br />
                  Formatted for Canon SELPHY CP1300 postcard photo paper over Wi-Fi.
                </div>
                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                  <button className="secondary-btn" onClick={() => setView('edit')} data-testid="button-back-to-edit">
                    <ArrowLeft size={16} /> Back to edit
                  </button>
                  <button className="secondary-btn" onClick={downloadPrintPhoto} data-testid="button-download-from-review">
                    <Download size={16} /> Save photo
                  </button>
                </div>
                <button
                  className="primary-btn"
                  style={{ marginTop: 14, width: '100%' }}
                  onClick={() => void openPrint()}
                  data-testid="button-print-photos"
                >
                  PRINT MY PHOTOS <Printer size={18} />
                </button>
              </div>
            </section>
          </>
        )}

        {/* Step 7: Printing and Acknowledgement */}
        {view === 'printing' && (
          <section className="review-wrap">
            {!isTestPrint && (
              <div className="review-print" style={{ aspectRatio: `${compositionRatio}`, background: design.background }}>
                <canvas ref={canvasRef} />
              </div>
            )}
            <div className="review-copy">
              <div className="eyebrow">{isTestPrint ? 'Staff · Test print' : 'Step 06 — Photo Output'}</div>
              <h2>
                {isTestPrint
                  ? printError
                    ? 'Test page unavailable'
                    : printClosed
                      ? 'Test print finished'
                      : 'Sending test print'
                  : received
                    ? 'Print sent to printer!'
                    : printError
                      ? 'Let’s try that again.'
                      : printClosed
                        ? 'Confirm physical print'
                        : 'Sending to Canon SELPHY...'}
              </h2>

              {isTestPrint ? (
                printError ? (
                  <>
                    <div className="print-status" role="alert" data-testid="status-print-error">
                      {printError}
                    </div>
                    <button className="primary-btn" onClick={() => void retryPrint()} data-testid="button-retry-test-print">
                      RETRY TEST PRINT <Printer size={17} />
                    </button>
                    <button className="quiet-btn" onClick={closeTestPrint} data-testid="button-close-test-result">
                      Close test result
                    </button>
                  </>
                ) : (
                  <>
                    <div className="print-info">
                      {testPrintNotice || 'Test print dispatched. Confirm paper output on Canon SELPHY CP1300.'}
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                      <button className="primary-btn" onClick={() => void retryPrint()} data-testid="button-retry-test-print">
                        RETRY TEST PRINT <Printer size={17} />
                      </button>
                      <button className="secondary-btn" onClick={downloadPrintPhoto} data-testid="button-download-test-print">
                        <Download size={16} /> Save test image
                      </button>
                    </div>
                    <button className="quiet-btn" style={{ marginTop: 10 }} onClick={closeTestPrint} data-testid="button-close-test-result">
                      Back to staff settings
                    </button>
                  </>
                )
              ) : (
                <>
                  <div className="print-info" style={{ marginTop: 8, marginBottom: 14 }}>
                    <strong>Canon SELPHY CP1300</strong> · 4 × 6 in · 300 DPI
                    <br />
                    {settings.copies} {settings.copies === 1 ? 'copy' : 'copies'} · Wi-Fi / Local Handoff
                  </div>

                  {printError && (
                    <div className="print-status" role="alert" data-testid="status-print-error">
                      {printError}
                    </div>
                  )}

                  {received && !printError && (
                    <div className="print-status" role="status" style={{ borderLeftColor: '#4d8a55' }}>
                      Photo successfully handed off! Check printer for print progress.
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button
                      className="primary-btn"
                      onClick={() => void acknowledgePrint()}
                      disabled={retentionBusy}
                      data-testid="button-acknowledge-print"
                    >
                      <Check size={17} />
                      {retentionBusy ? ' SAVING RETAINED DESIGN…' : received ? ' I RECEIVED MY PRINT' : ' I RECEIVED MY PRINT'}
                    </button>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="secondary-btn" onClick={() => void retryPrint()} data-testid="button-retry-print">
                        <Printer size={16} /> Send to printer again
                      </button>
                      {typeof navigator !== 'undefined' && Boolean(navigator.canShare) && (
                        <button className="secondary-btn" onClick={() => void openMobileShare()} data-testid="button-open-share-sheet">
                          <Share2 size={16} /> Open print sheet
                        </button>
                      )}
                      <button className="secondary-btn" onClick={downloadPrintPhoto} data-testid="button-download-photo">
                        <Download size={16} /> Save photo
                      </button>
                    </div>

                    {retentionNotice && (
                      <div className="print-status" role="status" data-testid="status-retention">
                        {retentionNotice}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                      <button
                        className="quiet-btn"
                        onClick={() => setView('edit')}
                        data-testid="button-back-to-edit-from-print"
                      >
                        <ArrowLeft size={15} /> Back to edit
                      </button>
                      <button
                        className="quiet-btn"
                        onClick={() => setView('complete')}
                        disabled={retentionBusy}
                        data-testid="button-finish-session"
                      >
                        Finish session <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {/* Step 8: Completion Screen */}
        {view === 'complete' && (
          <section className="completion">
            <div className="completion-card">
              <div className="completion-mark">
                <CheckCircle2 size={35} />
              </div>
              <div className="eyebrow" style={{ marginTop: 23 }}>
                A moment to keep
              </div>
              <h1>Lovely, isn't it?</h1>
              <p>Your photo session is complete! Tap Done to reset the booth for the next guest.</p>
              <button className="primary-btn" onClick={() => void done()} data-testid="button-done">
                DONE <Check size={17} />
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Staff Screen Entry Button */}
      {view === 'welcome' && (
        <button className="quiet-btn staff-entry" onClick={staffEntry} data-testid="button-staff-settings">
          <LockKeyhole size={14} /> Staff
        </button>
      )}

      {/* Printable media wrapper - always mounted when printUrl is available to ensure instant readiness */}
      {printUrl && (
        <div
          className="print-only"
          aria-hidden="true"
        >
          {Array.from({ length: isTestPrint ? 1 : settings.copies }, (_, i) => (
            <img
              key={i}
              src={printUrl}
              decoding="sync"
              alt={`${isTestPrint ? 'Canon SELPHY test' : 'Print-ready photo composition'} ${i + 1}`}
              style={!isTestPrint && i < settings.copies - 1 ? { pageBreakAfter: 'always', breakAfter: 'page' } : {}}
            />
          ))}
        </div>
      )}

      {toast && (
        <div className="toast" role="status" data-testid="status-toast">
          {toast}
        </div>
      )}

      {/* Staff Administration Modal */}
      {staffOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-label="Staff settings" data-testid="staff-modal">
            {!staffUnlocked ? (
              <>
                <h2>{pinSetup ? (pinFirst ? 'Confirm staff PIN' : 'Set a staff PIN') : 'Staff access'}</h2>
                <p>
                  {pinSetup
                    ? 'Create a four-digit local screen lock for this kiosk.'
                    : 'Enter the local kiosk PIN to open staff settings.'}
                </p>
                <div className="staff-warning">
                  This is a local screen lock stored on this kiosk only.
                </div>
                <div className="pin-dots">
                  {[0, 1, 2, 3].map(i => (
                    <span key={i} className={pin.length > i ? 'filled' : ''} />
                  ))}
                </div>
                <div className="pin-pad">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'].map(x => (
                    <button
                      key={x}
                      onClick={() => (x === 'back' ? setPin(p => p.slice(0, -1)) : pinInput(x))}
                      data-testid={`pin-${x}`}
                    >
                      {x === 'clear' ? 'Clear' : x === 'back' ? 'Delete' : x}
                    </button>
                  ))}
                </div>
                <div className="modal-actions">
                  <button className="quiet-btn" onClick={closeStaff} data-testid="button-close-staff">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div className="eyebrow">Studio controls</div>
                    <h2>Staff settings</h2>
                  </div>
                  <button className="quiet-btn" aria-label="Close settings" onClick={closeStaff} data-testid="button-close-settings">
                    <X />
                  </button>
                </div>

                <div className="chip-row" style={{ marginBottom: 16 }}>
                  {(['settings', 'welcome', 'assets', 'status', 'help'] as const).map(t => (
                    <button
                      className={`chip ${staffTab === t ? 'active' : ''}`}
                      key={t}
                      onClick={() => setStaffTab(t)}
                      data-testid={`staff-tab-${t}`}
                    >
                      {t === 'settings'
                        ? 'Configuration'
                        : t === 'welcome'
                          ? 'Welcome Page'
                          : t === 'assets'
                            ? 'Backgrounds & Stickers'
                            : t === 'status'
                              ? 'Kiosk & Device'
                              : 'Troubleshooting'}
                    </button>
                  ))}
                </div>

                {/* Tab 1: Configuration */}
                {staffTab === 'settings' && (
                  <div className="settings-grid">
                    <div className="field">
                      <label htmlFor="business">Business name</label>
                      <input
                        id="business"
                        value={settings.business}
                        onChange={e => updateSetting('business', e.target.value)}
                        data-testid="input-business-name"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="event">Event name</label>
                      <input
                        id="event"
                        value={settings.event}
                        onChange={e => updateSetting('event', e.target.value)}
                        data-testid="input-event-name"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="accent">Accent color</label>
                      <input
                        id="accent"
                        type="color"
                        value={settings.accent}
                        onChange={e => updateSetting('accent', e.target.value)}
                        data-testid="input-accent"
                      />
                    </div>
                    <div className="field">
                      <label>Business logo</label>
                      <label className="secondary-btn" style={{ cursor: 'pointer' }}>
                        <ImagePlus size={16} /> Upload logo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => saveLogo(e.target.files?.[0])}
                          style={{ display: 'none' }}
                          data-testid="input-logo-upload"
                        />
                      </label>
                      {settings.logo && (
                        <button className="quiet-btn" onClick={() => updateSetting('logo', '')} data-testid="button-remove-logo">
                          Remove logo
                        </button>
                      )}
                    </div>

                    <div className="field">
                      <label htmlFor="extra-shots">Extra bonus shots to take</label>
                      <select
                        id="extra-shots"
                        value={settings.extraShots}
                        onChange={e => updateSetting('extraShots', Number(e.target.value) || 2)}
                        data-testid="select-extra-shots"
                      >
                        <option value={1}>1 additional shot</option>
                        <option value={2}>2 additional shots (Default)</option>
                        <option value={3}>3 additional shots</option>
                        <option value={4}>4 additional shots</option>
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor="countdown">Countdown seconds</label>
                      <input
                        id="countdown"
                        type="number"
                        min="1"
                        max="30"
                        value={settings.countdown}
                        onChange={e => updateSetting('countdown', Math.max(1, Math.min(30, Number(e.target.value) || 10)))}
                        data-testid="input-countdown"
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="default-layout">Default layout</label>
                      <select
                        id="default-layout"
                        value={settings.defaultLayout}
                        onChange={e => updateSetting('defaultLayout', e.target.value as LayoutId)}
                        data-testid="select-default-layout"
                      >
                        {ALL_LAYOUTS.map(l => (
                          <option value={l.id} key={l.id}>
                            {l.label} · {l.count} photos
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor="print-size">Print size</label>
                      <select
                        id="print-size"
                        value={settings.printSize}
                        onChange={e => updateSetting('printSize', e.target.value as Settings['printSize'])}
                        data-testid="select-print-size"
                      >
                        <option value="2x6">2 × 6 in strip</option>
                        <option value="4x6">4 × 6 in</option>
                        <option value="4x4">4 × 4 in square</option>
                        <option value="custom">Custom dimensions</option>
                      </select>
                    </div>

                    {settings.printSize === 'custom' && (
                      <>
                        <div className="field">
                          <label htmlFor="width">Width in inches</label>
                          <input
                            id="width"
                            type="number"
                            min="1"
                            max="12"
                            value={settings.width}
                            onChange={e => updateSetting('width', Math.max(1, Number(e.target.value) || 1))}
                            data-testid="input-print-width"
                          />
                        </div>
                        <div className="field">
                          <label htmlFor="height">Height in inches</label>
                          <input
                            id="height"
                            type="number"
                            min="1"
                            max="12"
                            value={settings.height}
                            onChange={e => updateSetting('height', Math.max(1, Number(e.target.value) || 1))}
                            data-testid="input-print-height"
                          />
                        </div>
                      </>
                    )}

                    <div className="field">
                      <label htmlFor="orientation">Orientation</label>
                      <select
                        id="orientation"
                        value={settings.orientation}
                        onChange={e => updateSetting('orientation', e.target.value as Settings['orientation'])}
                        data-testid="select-orientation"
                      >
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor="copies">Default print copies</label>
                      <input
                        id="copies"
                        type="number"
                        min="1"
                        max="9"
                        value={settings.copies}
                        onChange={e => updateSetting('copies', Math.max(1, Math.min(9, Number(e.target.value) || 1)))}
                        data-testid="input-copies"
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="margin">Print margin · percent</label>
                      <input
                        id="margin"
                        type="number"
                        min="2"
                        max="20"
                        step="0.5"
                        value={settings.margin}
                        onChange={e => updateSetting('margin', Math.max(2, Math.min(20, Number(e.target.value) || 7.5)))}
                        data-testid="input-print-margin"
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="print-method">Print delivery method</label>
                      <select
                        id="print-method"
                        value={settings.printMethod || 'auto'}
                        onChange={e => updateSetting('printMethod', e.target.value as Settings['printMethod'])}
                        data-testid="select-print-method"
                      >
                        <option value="auto">Auto · Share-to-Print / System Sheet (Mobile)</option>
                        <option value="share">Native Share-to-Print Sheet</option>
                        <option value="browser">Browser Print Dialog (window.print)</option>
                        <option value="bridge">Local Wi-Fi Kiosk Bridge (Zero-Click)</option>
                      </select>
                    </div>

                    {settings.printMethod === 'bridge' && (
                      <div className="field" style={{ gridColumn: '1 / -1' }}>
                        <label htmlFor="local-bridge-url">Local Print Server / Bridge URL</label>
                        <input
                          id="local-bridge-url"
                          type="url"
                          placeholder="e.g. http://localhost:5000/print or http://192.168.1.50:5000/print"
                          value={settings.localBridgeUrl || ''}
                          onChange={e => updateSetting('localBridgeUrl', e.target.value)}
                          data-testid="input-bridge-url"
                        />
                        <small style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4, display: 'block' }}>
                          When configured, Studio-Snap-Booth sends 4×6 photo JPEGs directly to your local printing service for automatic zero-click printing to the Canon SELPHY CP1300.
                        </small>
                      </div>
                    )}

                    <div className="field" style={{ gridColumn: '1 / -1' }}>
                      <label>Guest design tools</label>
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
                        {(['templates', 'backgrounds', 'stickers', 'filters'] as const).map(tool => (
                          <label key={tool} style={{ fontSize: 13, textTransform: 'capitalize' }}>
                            <input
                              type="checkbox"
                              checked={settings.enabled.includes(tool)}
                              onChange={e =>
                                updateSetting(
                                  'enabled',
                                  e.target.checked
                                    ? [...settings.enabled, tool]
                                    : settings.enabled.filter(x => x !== tool),
                                )
                              }
                              data-testid={`toggle-${tool}`}
                            />{' '}
                            {tool}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="field" style={{ gridColumn: '1 / -1' }}>
                      <label>Available customer layouts</label>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                        {ALL_LAYOUTS.map(l => (
                          <label key={l.id} style={{ fontSize: 13 }}>
                            <input
                              type="checkbox"
                              checked={settings.enabledLayouts?.includes(l.id)}
                              onChange={e => {
                                const current = settings.enabledLayouts || ALL_LAYOUTS.map(x => x.id);
                                const next = e.target.checked ? [...current, l.id] : current.filter(x => x !== l.id);
                                if (next.length > 0) updateSetting('enabledLayouts', next);
                              }}
                            />{' '}
                            {l.label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="field" style={{ gridColumn: '1 / -1' }}>
                      <label>Completed design retention</label>
                      <label style={{ fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={settings.retention}
                          onChange={e => updateSetting('retention', e.target.checked)}
                          data-testid="toggle-retention"
                        />{' '}
                        Retain completed prints locally after guest acknowledges receipt
                      </label>
                    </div>

                    <div className="field" style={{ gridColumn: '1 / -1' }}>
                      <label>Print branding</label>
                      <label style={{ fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={settings.showBrand}
                          onChange={e => updateSetting('showBrand', e.target.checked)}
                          data-testid="toggle-print-brand"
                        />{' '}
                        Include business / event caption on bottom of prints
                      </label>
                    </div>

                    <div className="field" style={{ gridColumn: '1 / -1' }}>
                      <label>Customer text permissions</label>
                      <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={settings.allowCustomText ?? true}
                          onChange={e => updateSetting('allowCustomText', e.target.checked)}
                          data-testid="toggle-allow-custom-text"
                        />{' '}
                        Allow customers to write custom text
                      </label>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                        When disabled, customers cannot enter or edit custom text. The default event or business text is automatically placed at the bottom of the photo strip.
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Welcome Page Customization */}
                {staffTab === 'welcome' && (
                  <div className="settings-grid">
                    <div className="field" style={{ gridColumn: '1 / -1' }}>
                      <label htmlFor="welcome-headline">Welcome Card Headline / Caption</label>
                      <input
                        id="welcome-headline"
                        value={settings.welcomeHeadline}
                        placeholder="the good kind of blur"
                        onChange={e => updateSetting('welcomeHeadline', e.target.value)}
                        data-testid="input-welcome-headline"
                      />
                      <small style={{ color: '#817c74', fontSize: 12, marginTop: 4 }}>
                        Displayed as the handwritten-style caption beneath the sample photo on the welcome card.
                      </small>
                    </div>

                    <div className="field" style={{ gridColumn: '1 / -1' }}>
                      <label htmlFor="welcome-title">Main Welcome Title (use new line for italicized text)</label>
                      <textarea
                        id="welcome-title"
                        rows={2}
                        value={settings.welcomeTitle}
                        placeholder={'Step in.\nLet it happen.'}
                        onChange={e => updateSetting('welcomeTitle', e.target.value)}
                        style={{ padding: 10, borderRadius: 3, border: '1px solid #cfc8bd', background: '#fffefa', width: '100%' }}
                        data-testid="input-welcome-title"
                      />
                      <small style={{ color: '#817c74', fontSize: 12, marginTop: 4 }}>
                        The primary headline guests see when walking up to the kiosk.
                      </small>
                    </div>

                    <div className="field" style={{ gridColumn: '1 / -1' }}>
                      <label htmlFor="welcome-subtitle">Welcome Subtitle / Description</label>
                      <textarea
                        id="welcome-subtitle"
                        rows={3}
                        value={settings.welcomeSubtitle}
                        placeholder={
                          settings.event
                            ? `A portrait studio, here for ${settings.event}. Gather your people and make something you can take home.`
                            : 'A portrait studio, made for the good moments. Gather your people and make something you can take home.'
                        }
                        onChange={e => updateSetting('welcomeSubtitle', e.target.value)}
                        style={{ padding: 10, borderRadius: 3, border: '1px solid #cfc8bd', background: '#fffefa', width: '100%' }}
                        data-testid="input-welcome-subtitle"
                      />
                      <small style={{ color: '#817c74', fontSize: 12, marginTop: 4 }}>
                        Leave blank to automatically use the event/business default lead description.
                      </small>
                    </div>

                    <div className="field" style={{ gridColumn: '1 / -1' }}>
                      <label>Welcome Card Photo</label>
                      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                        <div
                          style={{
                            width: 100,
                            height: 130,
                            borderRadius: 4,
                            border: '1px solid #cfc8bd',
                            overflow: 'hidden',
                            background: '#e8ded0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {settings.welcomeImage ? (
                            <img
                              src={settings.welcomeImage}
                              alt="Welcome card preview"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div className="art-photo" style={{ width: '100%', height: '100%' }} />
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <label className="secondary-btn" style={{ cursor: 'pointer', minHeight: 38, fontSize: 13 }}>
                            <Upload size={16} /> Upload Custom Photo
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              onChange={e => saveWelcomeImage(e.target.files?.[0])}
                              style={{ display: 'none' }}
                              data-testid="input-welcome-image-upload"
                            />
                          </label>
                          {settings.welcomeImage && (
                            <button
                              className="quiet-btn"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              onClick={() => updateSetting('welcomeImage', '')}
                              data-testid="button-remove-welcome-image"
                            >
                              <X size={14} /> Restore default card photo
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ gridColumn: '1 / -1', paddingTop: 8 }}>
                      <button
                        className="quiet-btn"
                        onClick={restoreWelcomeDefaults}
                        data-testid="button-restore-welcome-defaults"
                      >
                        <RotateCcw size={15} /> Restore all Welcome Page defaults
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab 2: Status & Kiosk Mode */}
                {staffTab === 'status' && (
                  <>
                    <div className="status-row">
                      <span>Kiosk Mode (Fullscreen)</span>
                      <span>
                        <button className="secondary-btn" style={{ minHeight: 34, padding: '0 12px' }} onClick={toggleKioskMode}>
                          {settings.kioskMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                          {settings.kioskMode ? 'Exit Fullscreen' : 'Enter Kiosk Mode'}
                        </button>
                      </span>
                    </div>
                    <div className="status-row">
                      <span>Camera connection</span>
                      <span>{cameraStatus}</span>
                    </div>
                    <div className="status-row">
                      <span>Secure Context (HTTPS)</span>
                      <span>{window.isSecureContext ? 'Secure' : 'Insecure (Camera unavailable)'}</span>
                    </div>
                    <div className="status-row">
                      <span>IndexedDB Offline Storage</span>
                      <span>{dbAvailable ? 'Operational' : 'Memory-only'}</span>
                    </div>
                    <div className="status-row">
                      <span>Canon SELPHY CP1300 Handoff</span>
                      <span>
                        {settings.printMethod === 'bridge' && settings.localBridgeUrl
                          ? 'Local Kiosk Bridge (Zero-Click Active)'
                          : 'Wi-Fi Print / System Sheet Ready'}
                      </span>
                    </div>

                    <div className="modal-actions" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
                      <button
                        className="secondary-btn"
                        onClick={() => {
                          setView('camera');
                          closeStaff();
                          void startCamera();
                        }}
                        data-testid="button-test-camera"
                      >
                        <Aperture size={16} /> Test camera
                      </button>
                      <button className="secondary-btn" onClick={() => void testPrint()} data-testid="button-test-print">
                        <Printer size={16} /> Test Canon SELPHY print
                      </button>
                    </div>
                  </>
                )}

                {/* Tab: Backgrounds, Stickers & Backup */}
                {staffTab === 'assets' && (
                  <div>
                    {/* Section 1: Custom Backgrounds / Paper Designs */}
                    <div className="control-section" style={{ borderBottom: '1px solid #e5e0d7', paddingBottom: 22, marginBottom: 22 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                        <div>
                          <h3 style={{ margin: 0 }}>Background & Paper Designs</h3>
                          <p style={{ fontSize: 12, color: '#817c74', margin: '4px 0 0' }}>
                            Upload custom paper textures, backdrops, or borders. Active designs composite behind photos on screen and in 300 DPI prints.
                          </p>
                        </div>
                        <label className="secondary-btn" style={{ cursor: 'pointer', minHeight: 36, fontSize: 12 }}>
                          <ImagePlus size={15} /> Upload Paper Design
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={e => handleBgFileSelect(e.target.files?.[0])}
                            style={{ display: 'none' }}
                            data-testid="input-bg-upload"
                          />
                        </label>
                      </div>

                      {/* Pending Upload Preview and Name input */}
                      {bgUploadPreview && (
                        <div
                          style={{
                            margin: '16px 0',
                            padding: 14,
                            background: '#fcfaf6',
                            border: '1.5px solid var(--accent)',
                            borderRadius: 4,
                          }}
                        >
                          <strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                            Preview New Background Design
                          </strong>
                          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div
                              style={{
                                width: 90,
                                height: 120,
                                border: '1px solid #cfc8bd',
                                borderRadius: 3,
                                overflow: 'hidden',
                                background: '#333',
                              }}
                            >
                              <img
                                src={bgUploadPreview}
                                alt="Background preview"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            </div>
                            <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <label style={{ fontSize: 12, color: '#555' }}>Design name:</label>
                              <input
                                value={bgUploadName}
                                placeholder="e.g. Vintage Floral, Summer Gala Paper"
                                onChange={e => setBgUploadName(e.target.value)}
                                style={{ padding: '8px 10px', fontSize: 13 }}
                                data-testid="input-bg-name"
                              />
                              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                <button
                                  className="primary-btn"
                                  style={{ minHeight: 38, padding: '0 16px', fontSize: 12 }}
                                  onClick={saveCustomBackground}
                                  data-testid="button-save-bg"
                                >
                                  Save & Activate Design
                                </button>
                                <button
                                  className="quiet-btn"
                                  style={{ minHeight: 38, fontSize: 12 }}
                                  onClick={() => {
                                    setBgUploadPreview(null);
                                    setBgUploadName('');
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Active Status & Reset Button */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: '#f2eee7',
                          padding: '10px 14px',
                          borderRadius: 4,
                          margin: '14px 0',
                          fontSize: 13,
                        }}
                      >
                        <div>
                          <span>Current Active Background: </span>
                          <strong>
                            {settings.activeBackgroundId
                              ? settings.customBackgrounds?.find(b => b.id === settings.activeBackgroundId)?.name || 'Custom'
                              : 'Default Plain Background'}
                          </strong>
                        </div>
                        {settings.activeBackgroundId && (
                          <button
                            className="quiet-btn"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            onClick={() => setActiveBackground(null)}
                            data-testid="button-disable-bg"
                          >
                            Restore Default Plain Background
                          </button>
                        )}
                      </div>

                      {/* Uploaded Backgrounds Grid */}
                      {!settings.customBackgrounds || settings.customBackgrounds.length === 0 ? (
                        <p style={{ fontSize: 13, color: '#999', margin: '8px 0' }}>
                          No custom backgrounds uploaded yet. Standard solid colors will be used.
                        </p>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                          {settings.customBackgrounds.map(bg => {
                            const isActive = settings.activeBackgroundId === bg.id;
                            return (
                              <div
                                key={bg.id}
                                style={{
                                  border: isActive ? '2px solid var(--accent)' : '1px solid #dcd7ce',
                                  borderRadius: 4,
                                  background: '#fff',
                                  padding: 10,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 8,
                                  position: 'relative',
                                  boxShadow: isActive ? '0 2px 8px rgba(169,104,77,0.18)' : 'none',
                                }}
                                data-testid={`custom-bg-card-${bg.id}`}
                              >
                                <div
                                  style={{
                                    height: 120,
                                    borderRadius: 2,
                                    overflow: 'hidden',
                                    background: '#f7f5f0',
                                    position: 'relative',
                                  }}
                                >
                                  <img
                                    src={bg.url}
                                    alt={bg.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                  {isActive && (
                                    <span
                                      style={{
                                        position: 'absolute',
                                        top: 6,
                                        right: 6,
                                        background: 'var(--accent)',
                                        color: '#fff',
                                        fontSize: 10,
                                        fontWeight: 700,
                                        padding: '2px 6px',
                                        borderRadius: 3,
                                        letterSpacing: '0.04em',
                                      }}
                                    >
                                      ACTIVE
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <strong style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {bg.name}
                                  </strong>
                                </div>
                                <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                                  {isActive ? (
                                    <button
                                      className="secondary-btn"
                                      style={{ flex: 1, minHeight: 32, fontSize: 11, padding: '0 8px' }}
                                      onClick={() => setActiveBackground(null)}
                                      data-testid={`button-disable-bg-${bg.id}`}
                                    >
                                      Disable
                                    </button>
                                  ) : (
                                    <button
                                      className="primary-btn"
                                      style={{ flex: 1, minHeight: 32, fontSize: 11, padding: '0 8px' }}
                                      onClick={() => setActiveBackground(bg.id)}
                                      data-testid={`button-activate-bg-${bg.id}`}
                                    >
                                      Set as Active
                                    </button>
                                  )}
                                  <button
                                    className="quiet-btn"
                                    style={{ minHeight: 32, padding: '0 8px', color: '#8d4434' }}
                                    title="Delete design"
                                    onClick={() => deleteCustomBackground(bg.id, bg.name)}
                                    data-testid={`button-delete-bg-${bg.id}`}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Section 2: Custom Stickers */}
                    <div className="control-section">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0 }}>Custom event stickers</h3>
                        <label className="secondary-btn" style={{ cursor: 'pointer', minHeight: 36, fontSize: 12 }}>
                          <ImagePlus size={15} /> Upload sticker (PNG)
                          <input
                            type="file"
                            accept="image/png,image/webp,image/svg+xml"
                            onChange={e => saveCustomSticker(e.target.files?.[0])}
                            style={{ display: 'none' }}
                          />
                        </label>
                      </div>
                      <p style={{ fontSize: 12, color: '#817c74', margin: '8px 0 12px' }}>
                        Upload transparent PNG logos or event icons. They will appear in the guest's sticker tray.
                      </p>
                      {settings.customStickers?.length === 0 ? (
                        <p style={{ fontSize: 13, color: '#999' }}>No custom stickers uploaded yet.</p>
                      ) : (
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {settings.customStickers?.map(cs => (
                            <div
                              key={cs.id}
                              style={{
                                padding: 8,
                                background: '#f0ece4',
                                borderRadius: 3,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                              }}
                            >
                              <img src={cs.url} alt={cs.name} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                              <span style={{ fontSize: 12 }}>{cs.name}</span>
                              <button
                                className="quiet-btn"
                                style={{ padding: 4, minHeight: 24 }}
                                onClick={() =>
                                  setSettings(s => ({
                                    ...s,
                                    customStickers: s.customStickers.filter(x => x.id !== cs.id),
                                  }))
                                }
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="control-section">
                      <h3>Local system backup & restore</h3>
                      <p style={{ fontSize: 12, color: '#817c74', margin: '6px 0 14px' }}>
                        Export your full configuration and custom stickers to a JSON backup file, or restore on a new kiosk.
                      </p>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button className="secondary-btn" onClick={exportBackup}>
                          <Download size={15} /> Export Backup (.json)
                        </button>
                        <label className="secondary-btn" style={{ cursor: 'pointer' }}>
                          <Upload size={15} /> Restore Backup (.json)
                          <input
                            type="file"
                            accept=".json,application/json"
                            onChange={e => restoreBackup(e.target.files?.[0])}
                            style={{ display: 'none' }}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="control-section">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <h3 style={{ margin: 0 }}>Retained print compositions</h3>
                        <button
                          className="danger-btn"
                          disabled={!retainedDesigns.length}
                          onClick={() => void removeAllRetained()}
                          data-testid="button-delete-all-retained"
                        >
                          <Trash2 size={15} /> Delete all
                        </button>
                      </div>
                      <p style={{ fontSize: 12, color: '#817c74', margin: '10px 0' }}>
                        Finished print designs stored on this kiosk after guest acknowledgement.
                      </p>
                      {retentionNotice && (
                        <div className="print-status" role="status" data-testid="status-retention">
                          {retentionNotice}
                        </div>
                      )}
                      {retainedDesigns.length === 0 ? (
                        <p data-testid="empty-retained-designs" style={{ fontSize: 13, color: '#999' }}>
                          No retained designs stored.
                        </p>
                      ) : (
                        <div className="retained-grid">
                          {retainedDesigns.map(item => (
                            <article className="retained-item" key={item.id} data-testid={`retained-design-${item.id}`}>
                              <img src={item.url} alt={`Retained composition: ${item.label}`} />
                              <div>
                                <strong>{item.label}</strong>
                                <small>{new Date(item.createdAt).toLocaleString()}</small>
                                <button className="quiet-btn" onClick={() => void removeRetained(item.id)}>
                                  <Trash2 size={14} /> Delete
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 4: Troubleshooting & Reset */}
                {staffTab === 'help' && (
                  <>
                    <div className="staff-warning">
                      <strong>Kiosk Operator Guidelines</strong>
                      <br />
                      • Camera access requires a secure connection (HTTPS) and browser camera permission.
                      <br />
                      • The kiosk automatically takes {targetShotsCount} photos ({config.count} print + {extraShots} bonus takes) so guests choose their favorites without needing retakes.
                      <br />
                      • Keep the iPad/kiosk and AirPrint printer on the same Wi-Fi.
                      <br />• On iPads, enable iOS Guided Access (Triple-click Home or Side button) to lock the screen to the kiosk app.
                    </div>
                    <p>
                      Active session photos remain only during the guest's session and are automatically cleared on Done.
                    </p>
                    <button
                      className="danger-btn"
                      onClick={() => {
                        const ok = window.confirm('Clear active session and reset to welcome screen?');
                        if (ok) {
                          void clearTransient();
                          setView('welcome');
                          closeStaff();
                          setToast('Session cleared.');
                        }
                      }}
                      data-testid="button-reset-session"
                    >
                      <Trash2 size={16} /> Emergency reset active session
                    </button>
                  </>
                )}

                <div className="modal-actions">
                  <button className="quiet-btn" onClick={closeStaff} data-testid="button-lock-settings">
                    <LockKeyhole size={15} /> Lock and close
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
