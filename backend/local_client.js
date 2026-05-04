/**
 * 로컬 PC에서 실행 — Tapo RTSP → EC2 전송
 * 실행: node local_client.js
 */

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);

const EC2_URL = 'http://3.34.177.253:8000';
const RTSP_URL = 'rtsp://tapo1234:123456788@10.17.239.85/stream1';
const INTERVAL_MS = 5000;  // 5초마다 캡처

// 좌석 ROI (x, y, width, height) — reference.jpg 확인 후 수정
// 일단은 전체 화면을 좌석 1개로 전송 (테스트용)
const SEAT_ROIS = [
  { seat_id: 1, x: 0,   y: 0,   w: 640, h: 360 },
  { seat_id: 2, x: 640, y: 0,   w: 640, h: 360 },
  { seat_id: 3, x: 0,   y: 360, w: 640, h: 360 },
  { seat_id: 4, x: 640, y: 360, w: 640, h: 360 },
];

const TMP_DIR = path.join(__dirname, 'tmp_frames');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);


async function captureFrame(outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(RTSP_URL)
      .inputOptions(['-rtsp_transport', 'tcp'])
      .frames(1)
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}


async function cropAndSend(fullFramePath, roi) {
  const cropPath = path.join(TMP_DIR, `seat_${roi.seat_id}.jpg`);

  // ROI 크롭
  await new Promise((resolve, reject) => {
    ffmpeg(fullFramePath)
      .videoFilter(`crop=${roi.w}:${roi.h}:${roi.x}:${roi.y}`)
      .frames(1)
      .output(cropPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  // EC2로 전송
  const form = new FormData();
  form.append('file', fs.createReadStream(cropPath), 'frame.jpg');

  try {
    const res = await fetch(`${EC2_URL}/analyze?seat_id=${roi.seat_id}`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
      timeout: 15000,
    });
    const data = await res.json();
    console.log(`  좌석 ${roi.seat_id}: ${data.status} | 사람=${data.has_person} 물건=${data.has_items}`);
  } catch (e) {
    console.log(`  좌석 ${roi.seat_id} 전송 실패: ${e.message}`);
  }
}


async function checkEC2() {
  try {
    const res = await fetch(`${EC2_URL}/health`, { timeout: 5000 });
    const data = await res.json();
    console.log('EC2 연결 확인:', data);
    return true;
  } catch (e) {
    console.error('EC2 연결 실패:', e.message);
    return false;
  }
}


async function loop() {
  const fullFramePath = path.join(TMP_DIR, 'full_frame.jpg');

  console.log(`[${new Date().toLocaleTimeString()}] 프레임 캡처 중...`);

  try {
    await captureFrame(fullFramePath);

    // 첫 실행 시 reference.jpg 저장
    const refPath = path.join(__dirname, 'reference.jpg');
    if (!fs.existsSync(refPath)) {
      fs.copyFileSync(fullFramePath, refPath);
      console.log(`참조 이미지 저장됨 → ${refPath}`);
      console.log('이 이미지를 열어 좌석 ROI 좌표를 확인하고 local_client.js의 SEAT_ROIS를 수정하세요.');
    }

    for (const roi of SEAT_ROIS) {
      await cropAndSend(fullFramePath, roi);
    }
  } catch (e) {
    console.error('캡처 실패:', e.message);
  }

  setTimeout(loop, INTERVAL_MS);
}


(async () => {
  console.log('=== Tapo → EC2 클라이언트 시작 ===');
  console.log(`RTSP: ${RTSP_URL}`);
  console.log(`EC2:  ${EC2_URL}\n`);

  const ok = await checkEC2();
  if (!ok) process.exit(1);

  await loop();
})();
