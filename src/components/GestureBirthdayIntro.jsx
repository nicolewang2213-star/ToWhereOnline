import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const PARTICLE_COUNT = 7200;

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
}

function readGesture(landmarks) {
  if (!landmarks) return null;
  const palmSize = Math.max(distance(landmarks[0], landmarks[9]), 0.06);
  const extended = [[8, 6], [12, 10], [16, 14], [20, 18]]
    .filter(([tip, joint]) => distance(landmarks[tip], landmarks[0]) > distance(landmarks[joint], landmarks[0]) * 1.18).length;
  return {
    openness: THREE.MathUtils.clamp((extended - 0.4) / 3.4, 0, 1),
    pinch: distance(landmarks[4], landmarks[8]) / palmSize < 0.43,
    x: 1 - landmarks[9].x,
    y: landmarks[9].y,
  };
}

function createHeartPoint(index) {
  const t = (index / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
  const layer = 0.56 + Math.pow(Math.random(), 0.38) * 0.44;
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  return new THREE.Vector3(x * 0.098 * layer, y * 0.098 * layer + 0.15, (Math.random() - 0.5) * (0.3 + (1 - layer) * 1.2));
}

function makeParticleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(255,245,210,.95)');
  gradient.addColorStop(0.48, 'rgba(255,160,210,.45)');
  gradient.addColorStop(1, 'rgba(120,140,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export default function GestureBirthdayIntro({ onDone }) {
  const canvasHostRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const detectionFrameRef = useRef(null);
  const opennessRef = useRef(0.08);
  const handTargetRef = useRef({ x: 0, y: 0 });
  const pinchFramesRef = useRef(0);
  const revealedRef = useRef(false);
  const [cameraState, setCameraState] = useState('idle');
  const [gestureText, setGestureText] = useState('握拳聚拢 · 张手散开 · 捏合开启');
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return undefined;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02030d, 0.095);
    const camera = new THREE.PerspectiveCamera(52, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.z = 6.2;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.setClearColor(0x02030d, 1);
    host.appendChild(renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const bases = new Float32Array(PARTICLE_COUNT * 3);
    const directions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const palette = [new THREE.Color('#ff79b7'), new THREE.Color('#ffd88f'), new THREE.Color('#8fbcff'), new THREE.Color('#d8a8ff')];
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const p = createHeartPoint(i);
      const offset = i * 3;
      positions.set([p.x, p.y, p.z], offset);
      bases.set([p.x, p.y, p.z], offset);
      const direction = new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.5)
        .normalize().multiplyScalar(1.6 + Math.random() * 3.5);
      directions.set([direction.x, direction.y, direction.z], offset);
      const color = palette[Math.floor(Math.random() * palette.length)].clone().multiplyScalar(0.72 + Math.random() * 0.4);
      colors.set([color.r, color.g, color.b], offset);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 0.075, map: makeParticleTexture(), transparent: true, opacity: 0.96,
      vertexColors: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const heart = new THREE.Points(geometry, material);
    scene.add(heart);

    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i += 1) {
      const radius = 6 + Math.random() * 14;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions.set([radius * Math.sin(phi) * Math.cos(theta), radius * Math.sin(phi) * Math.sin(theta), radius * Math.cos(phi)], i * 3);
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0x8da9ff, size: 0.025, transparent: true, opacity: 0.55 }));
    scene.add(stars);

    let frame;
    let currentOpen = 0.08;
    const clock = new THREE.Clock();
    const animate = () => {
      const time = clock.getElapsedTime();
      currentOpen = THREE.MathUtils.lerp(currentOpen, opennessRef.current, 0.07);
      const array = geometry.attributes.position.array;
      for (let i = 0; i < PARTICLE_COUNT; i += 1) {
        const o = i * 3;
        const wave = Math.sin(time * 1.4 + i * 0.013) * 0.025;
        array[o] = THREE.MathUtils.lerp(array[o], bases[o] + directions[o] * currentOpen + wave, 0.075);
        array[o + 1] = THREE.MathUtils.lerp(array[o + 1], bases[o + 1] + directions[o + 1] * currentOpen + wave, 0.075);
        array[o + 2] = THREE.MathUtils.lerp(array[o + 2], bases[o + 2] + directions[o + 2] * currentOpen, 0.075);
      }
      geometry.attributes.position.needsUpdate = true;
      heart.rotation.y = THREE.MathUtils.lerp(heart.rotation.y, handTargetRef.current.x, 0.055) + 0.0014;
      heart.rotation.x = THREE.MathUtils.lerp(heart.rotation.x, handTargetRef.current.y, 0.05);
      heart.scale.setScalar(1 + Math.sin(time * 1.7) * 0.018);
      stars.rotation.y += 0.00018;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    const resize = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      geometry.dispose(); material.map?.dispose(); material.dispose();
      starGeometry.dispose(); stars.material.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  const stopCamera = () => {
    if (detectionFrameRef.current) cancelAnimationFrame(detectionFrameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    landmarkerRef.current?.close?.();
    landmarkerRef.current = null;
  };

  useEffect(() => stopCamera, []);

  const revealBirthday = () => {
    revealedRef.current = true;
    opennessRef.current = 0.28;
    setRevealed(true);
  };

  const startCamera = async () => {
    setCameraState('loading');
    setError('');
    try {
      const [{ FilesetResolver, HandLandmarker }, stream] = await Promise.all([
        import('@mediapipe/tasks-vision'),
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }),
      ]);
      streamRef.current = stream;
      const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
      landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 1,
        minHandDetectionConfidence: 0.55, minTrackingConfidence: 0.55,
      });
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      setCameraState('tracking');
      let lastTime = -1;
      const detect = () => {
        if (!landmarkerRef.current || !videoRef.current) return;
        if (video.currentTime !== lastTime) {
          lastTime = video.currentTime;
          const result = landmarkerRef.current.detectForVideo(video, performance.now());
          const gesture = readGesture(result.landmarks?.[0]);
          if (gesture) {
            opennessRef.current = gesture.openness * 1.15;
            handTargetRef.current = { x: (gesture.x - 0.5) * 1.55, y: (gesture.y - 0.5) * 0.75 };
            pinchFramesRef.current = gesture.pinch ? pinchFramesRef.current + 1 : Math.max(0, pinchFramesRef.current - 2);
            if (pinchFramesRef.current > 9 && !revealedRef.current) revealBirthday();
            setGestureText(gesture.pinch ? '保持捏合，开启生日星光' : gesture.openness > 0.62 ? '星辰正在你的掌心绽放' : '握拳聚拢 · 张手散开 · 捏合开启');
          } else setGestureText('把一只手放入镜头范围');
        }
        detectionFrameRef.current = requestAnimationFrame(detect);
      };
      detect();
    } catch (cameraError) {
      stopCamera();
      setCameraState('error');
      setError(cameraError?.name === 'NotAllowedError' ? '请允许摄像头权限后重试。' : '手势识别暂时无法启动。');
    }
  };

  const completeIntro = () => {
    stopCamera();
    sessionStorage.setItem('nh-birthday-intro-seen', 'true');
    onDone();
  };

  return (
    <div className={`gesture-intro particle-version ${revealed ? 'is-revealed' : ''}`} role="dialog" aria-modal="true" aria-label="生日粒子宇宙">
      <div ref={canvasHostRef} className="gesture-particle-canvas" aria-hidden="true" />
      <video ref={videoRef} className="gesture-camera-source" playsInline muted />
      {cameraState === 'idle' && !revealed && (
        <div className="particle-welcome">
          <p>N &amp; H · A GIFT FROM THE UNIVERSE</p>
          <h1>把星辰握在掌心</h1>
          <button className="gesture-primary" onClick={startCamera}>开启手势宇宙</button>
          <button className="gesture-skip" onClick={revealBirthday}>直接开启惊喜</button>
        </div>
      )}
      {cameraState === 'loading' && !revealed && <p className="particle-hint">正在连接星辰…</p>}
      {cameraState === 'tracking' && !revealed && (
        <div className="particle-controls"><span className="camera-live"><i /> HAND TRACKING</span><p>{gestureText}</p></div>
      )}
      {cameraState === 'error' && !revealed && (
        <div className="particle-error"><p>{error}</p><button className="gesture-primary" onClick={startCamera}>重新尝试</button><button className="gesture-skip" onClick={revealBirthday}>直接开启惊喜</button></div>
      )}
      {revealed && (
        <div className="particle-birthday">
          <p>25 · 09 · 2026</p><h1>Happy Birthday</h1><h2>稼晖</h2>
          <span>愿你的每一岁，都有新的星辰与惊喜。</span>
          <button className="gesture-primary" onClick={completeIntro}>进入我们的宇宙</button>
        </div>
      )}
    </div>
  );
}
