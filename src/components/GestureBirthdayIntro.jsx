import React, { useEffect, useRef, useState } from 'react';

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

function getHandPose(landmarks) {
  if (!landmarks) return 'none';
  const extendedFingers = [[8, 6], [12, 10], [16, 14], [20, 18]]
    .filter(([tip, joint]) => landmarks[tip].y < landmarks[joint].y - 0.025).length;
  if (extendedFingers >= 3) return 'open';
  if (extendedFingers <= 1) return 'fist';
  return 'other';
}

export default function GestureBirthdayIntro({ onDone }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const animationRef = useRef(null);
  const phaseRef = useRef('open');
  const stablePoseRef = useRef({ pose: 'none', frames: 0 });
  const [cameraState, setCameraState] = useState('idle');
  const [phase, setPhase] = useState('open');
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState('');

  const stopCamera = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    landmarkerRef.current?.close?.();
    landmarkerRef.current = null;
  };

  useEffect(() => stopCamera, []);

  const finish = () => {
    stopCamera();
    setRevealed(true);
    setCameraState('complete');
  };

  const advancePose = (pose) => {
    const stable = stablePoseRef.current;
    if (stable.pose === pose) stable.frames += 1;
    else stablePoseRef.current = { pose, frames: 1 };
    if (stablePoseRef.current.frames < 6) return;

    if (phaseRef.current === 'open' && pose === 'open') {
      phaseRef.current = 'fist';
      setPhase('fist');
      stablePoseRef.current = { pose: 'none', frames: 0 };
    } else if (phaseRef.current === 'fist' && pose === 'fist') {
      phaseRef.current = 'release';
      setPhase('release');
      stablePoseRef.current = { pose: 'none', frames: 0 };
    } else if (phaseRef.current === 'release' && pose === 'open') {
      finish();
    }
  };

  const startCamera = async () => {
    setCameraState('loading');
    setError('');
    try {
      const [{ FilesetResolver, HandLandmarker }, stream] = await Promise.all([
        import('@mediapipe/tasks-vision'),
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        }),
      ]);
      streamRef.current = stream;
      const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
      landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });

      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      setCameraState('tracking');
      let lastVideoTime = -1;
      const detect = () => {
        if (!landmarkerRef.current || !videoRef.current) return;
        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const result = landmarkerRef.current.detectForVideo(video, performance.now());
          advancePose(getHandPose(result.landmarks?.[0]));
        }
        animationRef.current = requestAnimationFrame(detect);
      };
      detect();
    } catch (cameraError) {
      stopCamera();
      setCameraState('error');
      setError(cameraError?.name === 'NotAllowedError'
        ? '没有获得摄像头权限，可以在浏览器地址栏重新允许。'
        : '暂时无法开启手势识别，请使用下方备用方式。');
    }
  };

  const completeIntro = () => {
    sessionStorage.setItem('nh-birthday-intro-seen', 'true');
    onDone();
  };

  const prompt = phase === 'open'
    ? '向镜头张开手掌'
    : phase === 'fist'
      ? '慢慢握拳，抓住这颗星'
      : '再次张开手掌，释放星光';

  return (
    <div className={`gesture-intro ${revealed ? 'is-revealed' : ''}`} role="dialog" aria-modal="true" aria-label="生日惊喜">
      <div className="gesture-space" aria-hidden="true" />
      <div className="gesture-content">
        {!revealed ? (
          <>
            <p className="gesture-kicker">N &amp; H · A GIFT FROM THE UNIVERSE</p>
            <div className={`gesture-star ${cameraState === 'tracking' ? 'is-listening' : ''}`}>✦</div>
            <h1>有一份宇宙礼物，等你亲手开启</h1>
            {cameraState === 'idle' && (
              <>
                <p>让摄像头看见你的手，用一个动作点亮星空。</p>
                <button className="gesture-primary" onClick={startCamera}>开启摄像头手势</button>
              </>
            )}
            {(cameraState === 'loading' || cameraState === 'tracking') && (
              <>
                <div className={`gesture-video-wrap ${cameraState === 'loading' ? 'is-loading' : ''}`}>
                  <video ref={videoRef} className="gesture-video" playsInline muted />
                  <span className="gesture-scan" />
                </div>
                <p className="gesture-status">{cameraState === 'loading' ? '正在寻找你的手势星光…' : prompt}</p>
                {cameraState === 'tracking' && (
                  <div className="gesture-steps" aria-label="手势进度">
                    <i className="done" /><i className={phase !== 'open' ? 'done' : ''} /><i className={phase === 'release' ? 'done' : ''} />
                  </div>
                )}
              </>
            )}
            {error && <p className="gesture-error">{error}</p>}
            <button className="gesture-skip" onClick={finish}>{cameraState === 'error' ? '点击开启惊喜' : '暂时跳过手势'}</button>
          </>
        ) : (
          <div className="birthday-reveal">
            <div className="birthday-burst" aria-hidden="true">✦</div>
            <p>25 · 09 · 2026</p>
            <h1>Happy Birthday, 稼晖</h1>
            <h2>愿你的每一岁，都有新的星辰与惊喜。</h2>
            <span>— N ❤️ H</span>
            <button className="gesture-primary" onClick={completeIntro}>进入我们的宇宙</button>
          </div>
        )}
      </div>
    </div>
  );
}
