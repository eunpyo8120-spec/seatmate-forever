import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, RefreshCw, Save, Plus, Trash2, RotateCcw } from 'lucide-react';

// ── 타입 ──────────────────────────────────────────────────────────────────
type Point = [number, number]; // normalized [x, y] ∈ [0,1]

interface RoiConfig {
  seat_label: string;
  camera_id: string;
  points: Point[];
}

// ── 기본 폴리곤 (테이블 구도 기준 타일링) ─────────────────────────────────
// 카메라: 정면 상단에서 내려다봄
// N23=좌상단  N27=우상단  N22=좌하단  N25=우하단
const DEFAULT_ROIS: RoiConfig[] = [
  { seat_label: 'N23', camera_id: 'main', points: [[0.0, 0.0], [0.5, 0.0], [0.5, 0.5], [0.0, 0.5]] },
  { seat_label: 'N27', camera_id: 'main', points: [[0.5, 0.0], [1.0, 0.0], [1.0, 0.5], [0.5, 0.5]] },
  { seat_label: 'N22', camera_id: 'main', points: [[0.0, 0.5], [0.5, 0.5], [0.5, 1.0], [0.0, 1.0]] },
  { seat_label: 'N25', camera_id: 'main', points: [[0.5, 0.5], [1.0, 0.5], [1.0, 1.0], [0.5, 1.0]] },
];

const SEAT_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];

const VERTEX_RADIUS = 7;  // px — hit area for vertex dragging
const EDGE_HIT = 8;       // px — hit area for edge click (add vertex)

// ── 유틸 ─────────────────────────────────────────────────────────────────
function polygonCentroid(pts: Point[], W: number, H: number): [number, number] {
  const px = pts.map(p => p[0] * W);
  const py = pts.map(p => p[1] * H);
  return [px.reduce((a, b) => a + b, 0) / px.length, py.reduce((a, b) => a + b, 0) / py.length];
}

function pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ── コンポーネント ─────────────────────────────────────────────────────────
export default function AdminCalibratePage() {
  const navigate = useNavigate();
  const { isAdmin } = useAppStore();

  const [serverUrl, setServerUrl] = useState('http://localhost:8000');
  const [polling, setPolling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [selectedSeat, setSelectedSeat] = useState<string | null>('N23');

  const [rois, setRois] = useState<RoiConfig[]>(DEFAULT_ROIS);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgEl = useRef<HTMLImageElement | null>(null);
  const blobUrl = useRef<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 드래그 상태
  const dragging = useRef<{ seat: string; idx: number } | null>(null);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });

  useEffect(() => { if (!isAdmin) navigate('/main'); }, [isAdmin, navigate]);

  // Supabase에서 ROI 로드
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from('seat_roi_configs')
        .select('seat_label,camera_id,points')
        .eq('camera_id', 'main');
      if (data && data.length > 0) {
        setRois(data as RoiConfig[]);
        setSelectedSeat((data[0] as any).seat_label);
      }
    })();
  }, []);

  // ── 캔버스 좌표 변환 ────────────────────────────────────────────────────
  const canvasToNorm = useCallback((e: React.MouseEvent<HTMLCanvasElement>): { px: number; py: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      px: (e.clientX - rect.left) * (canvas.width / rect.width),
      py: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  // ── 히트 테스트: 꼭짓점 ────────────────────────────────────────────────
  const hitVertex = useCallback((px: number, py: number): { seat: string; idx: number } | null => {
    const canvas = canvasRef.current!;
    const W = canvas.width, H = canvas.height;
    // 선택된 좌석 먼저
    const order = selectedSeat
      ? [rois.find(r => r.seat_label === selectedSeat)!, ...rois.filter(r => r.seat_label !== selectedSeat)]
      : rois;
    for (const roi of order) {
      if (!roi) continue;
      for (let i = 0; i < roi.points.length; i++) {
        const [nx, ny] = roi.points[i];
        if (Math.hypot(px - nx * W, py - ny * H) <= VERTEX_RADIUS + 2) {
          return { seat: roi.seat_label, idx: i };
        }
      }
    }
    return null;
  }, [rois, selectedSeat]);

  // ── 히트 테스트: 엣지 (꼭짓점 추가용) ────────────────────────────────
  const hitEdge = useCallback((px: number, py: number): { seat: string; edgeIdx: number; t: number } | null => {
    const canvas = canvasRef.current!;
    const W = canvas.width, H = canvas.height;
    if (!selectedSeat) return null;
    const roi = rois.find(r => r.seat_label === selectedSeat);
    if (!roi) return null;
    for (let i = 0; i < roi.points.length; i++) {
      const [ax, ay] = roi.points[i];
      const [bx, by] = roi.points[(i + 1) % roi.points.length];
      const dist = pointToSegmentDist(px, py, ax * W, ay * H, bx * W, by * H);
      if (dist <= EDGE_HIT) {
        const dx = bx * W - ax * W, dy = by * H - ay * H;
        const lenSq = dx * dx + dy * dy;
        const t = lenSq === 0 ? 0 : ((px - ax * W) * dx + (py - ay * H) * dy) / lenSq;
        return { seat: selectedSeat, edgeIdx: i, t: Math.max(0, Math.min(1, t)) };
      }
    }
    return null;
  }, [rois, selectedSeat]);

  // ── 폴리곤 내부 클릭 (좌석 선택) ──────────────────────────────────────
  const hitPolygon = useCallback((px: number, py: number): string | null => {
    const canvas = canvasRef.current!;
    const W = canvas.width, H = canvas.height;
    for (let ri = rois.length - 1; ri >= 0; ri--) {
      const roi = rois[ri];
      const pts = roi.points;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0] * W, yi = pts[i][1] * H;
        const xj = pts[j][0] * W, yj = pts[j][1] * H;
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) return roi.seat_label;
    }
    return null;
  }, [rois]);

  // ── 캔버스 그리기 ────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (imgEl.current) {
      ctx.drawImage(imgEl.current, 0, 0, W, H);
    } else {
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#666';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FastAPI 서버 연결 시 카메라 화면이 표시됩니다', W / 2, H / 2);
    }

    rois.forEach((roi, colorIdx) => {
      if (roi.points.length < 3) return;
      const color = SEAT_COLORS[colorIdx % SEAT_COLORS.length];
      const isSelected = roi.seat_label === selectedSeat;
      const pts = roi.points.map(([nx, ny]) => [nx * W, ny * H] as [number, number]);

      // 채우기
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      pts.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.closePath();
      ctx.fillStyle = color + (isSelected ? '44' : '22');
      ctx.fill();

      // 테두리
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.stroke();

      // 라벨
      const [cx, cy] = polygonCentroid(roi.points, W, H);
      ctx.font = `bold ${isSelected ? 15 : 13}px monospace`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      ctx.strokeText(roi.seat_label, cx, cy + 5);
      ctx.fillStyle = '#fff';
      ctx.fillText(roi.seat_label, cx, cy + 5);

      // 선택된 좌석: 꼭짓점 핸들
      if (isSelected) {
        pts.forEach(([x, y], i) => {
          ctx.beginPath();
          ctx.arc(x, y, VERTEX_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
          // 인덱스 번호
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#333';
          ctx.textAlign = 'center';
          ctx.fillText(String(i), x, y + 3.5);
        });
      }
    });
  }, [rois, selectedSeat]);

  useEffect(() => { draw(); }, [draw]);

  // ── 마우스 이벤트 ────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const { px, py } = canvasToNorm(e);
    const vhit = hitVertex(px, py);
    if (vhit) {
      dragging.current = vhit;
      const roi = rois.find(r => r.seat_label === vhit.seat)!;
      const [ox, oy] = roi.points[vhit.idx];
      dragStart.current = { mx: px, my: py, ox, oy };
      return;
    }
    const poly = hitPolygon(px, py);
    if (poly) setSelectedSeat(poly);
  }, [canvasToNorm, hitVertex, hitPolygon, rois]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const { px, py } = canvasToNorm(e);

    if (dragging.current) {
      canvas.style.cursor = 'grabbing';
      const W = canvas.width, H = canvas.height;
      const newNx = Math.max(0, Math.min(1, dragStart.current.ox + (px - dragStart.current.mx) / W));
      const newNy = Math.max(0, Math.min(1, dragStart.current.oy + (py - dragStart.current.my) / H));
      setRois(prev => prev.map(r =>
        r.seat_label === dragging.current!.seat
          ? { ...r, points: r.points.map((p, i) => i === dragging.current!.idx ? [newNx, newNy] : p) as Point[] }
          : r
      ));
      return;
    }

    if (hitVertex(px, py)) { canvas.style.cursor = 'grab'; return; }
    if (hitEdge(px, py)) { canvas.style.cursor = 'crosshair'; return; }
    if (hitPolygon(px, py)) { canvas.style.cursor = 'pointer'; return; }
    canvas.style.cursor = 'default';
  }, [canvasToNorm, hitVertex, hitEdge, hitPolygon]);

  const onMouseUp = useCallback(() => {
    dragging.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'default';
  }, []);

  // 더블클릭: 엣지에서 꼭짓점 추가
  const onDblClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { px, py } = canvasToNorm(e);
    const ehit = hitEdge(px, py);
    if (!ehit) return;
    const canvas = canvasRef.current!;
    const newPoint: Point = [px / canvas.width, py / canvas.height];
    setRois(prev => prev.map(r => {
      if (r.seat_label !== ehit.seat) return r;
      const pts = [...r.points];
      pts.splice(ehit.edgeIdx + 1, 0, newPoint);
      return { ...r, points: pts };
    }));
  }, [canvasToNorm, hitEdge]);

  // 우클릭: 꼭짓점 삭제 (최소 3개 유지)
  const onContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { px, py } = canvasToNorm(e);
    const vhit = hitVertex(px, py);
    if (!vhit) return;
    setRois(prev => prev.map(r => {
      if (r.seat_label !== vhit.seat || r.points.length <= 3) return r;
      return { ...r, points: r.points.filter((_, i) => i !== vhit.idx) };
    }));
  }, [canvasToNorm, hitVertex]);

  // ── 카메라 연결 ──────────────────────────────────────────────────────
  const loadFrame = useCallback(async () => {
    try {
      const imgRes = await fetch(`${serverUrl}/frame`);
      if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
      const blob = await imgRes.blob();
      const url = URL.createObjectURL(blob);
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
      blobUrl.current = url;
      const img = new Image();
      img.onload = () => { imgEl.current = img; draw(); };
      img.src = url;
    } catch (e: any) {
      toast.error('연결 실패: ' + (e.message ?? '서버를 확인하세요'));
      setPolling(false);
    }
  }, [serverUrl, draw]);

  useEffect(() => {
    if (polling) { loadFrame(); pollTimer.current = setInterval(loadFrame, 1000); }
    else if (pollTimer.current) clearInterval(pollTimer.current);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [polling, loadFrame]);

  useEffect(() => () => { if (blobUrl.current) URL.revokeObjectURL(blobUrl.current); }, []);

  // ── Supabase 저장 ────────────────────────────────────────────────────
  const saveRois = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('seat_roi_configs')
      .upsert(
        rois.map(r => ({ ...r, updated_at: new Date().toISOString() })),
        { onConflict: 'seat_label,camera_id' }
      );
    setSaving(false);
    if (error) toast.error('저장 실패: ' + error.message);
    else toast.success('ROI 설정 저장 완료');
  };

  // ── 기타 조작 ────────────────────────────────────────────────────────
  const addSeat = () => {
    const label = newLabel.trim().toUpperCase();
    if (!label || rois.some(r => r.seat_label === label)) { toast.error('이미 있거나 빈 이름'); return; }
    const newRoi: RoiConfig = {
      seat_label: label, camera_id: 'main',
      points: [[0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7]],
    };
    setRois(prev => [...prev, newRoi]);
    setSelectedSeat(label);
    setNewLabel('');
  };

  const removeSeat = (label: string) => {
    setRois(prev => prev.filter(r => r.seat_label !== label));
    if (selectedSeat === label) setSelectedSeat(rois.find(r => r.seat_label !== label)?.seat_label ?? null);
  };

  const resetToDefault = () => { setRois(DEFAULT_ROIS); setSelectedSeat('N23'); toast.info('기본값으로 초기화했습니다'); };

  const selectedRoi = rois.find(r => r.seat_label === selectedSeat);
  const selectedColorIdx = rois.findIndex(r => r.seat_label === selectedSeat);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* 헤더 */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-display font-bold text-foreground flex-1">좌석 ROI 폴리곤 설정</h1>
        <Button variant="outline" size="sm" onClick={resetToDefault}>
          <RotateCcw className="w-4 h-4 mr-1" /> 초기화
        </Button>
        <Button size="sm" onClick={saveRois} disabled={saving}>
          <Save className="w-4 h-4 mr-1" />
          {saving ? '저장중...' : '저장'}
        </Button>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* 서버 URL + 연결 */}
        <div className="flex gap-2">
          <Input
            value={serverUrl}
            onChange={e => setServerUrl(e.target.value)}
            placeholder="http://localhost:8000"
            className="font-mono text-sm"
          />
          <Button variant={polling ? 'destructive' : 'default'} onClick={() => setPolling(p => !p)}>
            <RefreshCw className={`w-4 h-4 mr-1 ${polling ? 'animate-spin' : ''}`} />
            {polling ? '중지' : '실시간'}
          </Button>
          <Button variant="outline" onClick={loadFrame}>1회</Button>
        </div>

        {/* 조작 안내 */}
        <div className="bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground space-y-0.5">
          <p>• <b>클릭</b>: 좌석 선택 &nbsp;|&nbsp; <b>꼭짓점 드래그</b>: 위치 조정</p>
          <p>• <b>엣지 더블클릭</b>: 꼭짓점 추가 &nbsp;|&nbsp; <b>꼭짓점 우클릭</b>: 꼭짓점 삭제</p>
        </div>

        {/* 캔버스 */}
        <div className="rounded-lg overflow-hidden border border-border">
          <canvas
            ref={canvasRef}
            width={960}
            height={720}
            className="w-full"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onDoubleClick={onDblClick}
            onContextMenu={onContextMenu}
          />
        </div>

        {/* 선택된 좌석 정보 */}
        {selectedRoi && (
          <div className="bg-card border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: SEAT_COLORS[selectedColorIdx % SEAT_COLORS.length] }}
              />
              <span className="font-display font-bold">{selectedRoi.seat_label}</span>
              <span className="text-xs text-muted-foreground ml-auto">꼭짓점 {selectedRoi.points.length}개</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {selectedRoi.points.map(([x, y], i) => (
                <div key={i} className="bg-muted rounded px-2 py-1 text-xs font-mono text-center">
                  <div className="text-muted-foreground">{i}</div>
                  <div>{x.toFixed(2)}</div>
                  <div>{y.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ROI 목록 */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">좌석 목록</p>
          {rois.map((roi, i) => (
            <button
              key={roi.seat_label}
              className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-mono text-left transition-colors ${
                selectedSeat === roi.seat_label ? 'bg-primary/10 ring-1 ring-primary' : 'bg-muted hover:bg-muted/80'
              }`}
              onClick={() => setSelectedSeat(roi.seat_label)}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: SEAT_COLORS[i % SEAT_COLORS.length] }}
              />
              <span className="font-bold w-10">{roi.seat_label}</span>
              <span className="text-muted-foreground flex-1">꼭짓점 {roi.points.length}개</span>
              <Button
                variant="ghost" size="icon"
                className="w-6 h-6 text-destructive"
                onClick={e => { e.stopPropagation(); removeSeat(roi.seat_label); }}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </button>
          ))}

          {/* 새 좌석 추가 */}
          <div className="flex gap-2 pt-1">
            <Input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="좌석 번호 (예: N24)"
              className="text-sm"
              onKeyDown={e => e.key === 'Enter' && addSeat()}
            />
            <Button variant="outline" onClick={addSeat}><Plus className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
