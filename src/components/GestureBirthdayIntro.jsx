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
    .filter(([tip, joint]) => distance(landmarks[tip], landmarks[0]) > distance(landmarks[joint], landmarks[0]) * 1.1).length;
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
  const musicContextRef = useRef(null);
  const musicTimerRef = useRef(null);
  const musicNodesRef = useRef([]);
  const opennessRef = useRef(0.08);
  const handTargetRef = useRef({ x: 0, y: 0 });
  const smoothedGestureRef = useRef({ x: null, openness: 0 });
  const lastHandXRef = useRef(null);
  const rotationRef = useRef(0);
  const gestureFramesRef = useRef(0);
  const swipeRef = useRef({ zone: 'center', passes: 0, lastPassAt: 0 });
  const revealedRef = useRef(false);
  const phaseRef = useRef('openHeart');
  const interactionRef = useRef({ mode: 'heart', starCount: 0 });
  const [cameraState, setCameraState] = useState('idle');
  const [interactionPhase, setInteractionPhase] = useState('openHeart');
  const [gestureText, setGestureText] = useState('慢慢张开手掌');
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState('');
  const [musicPlaying, setMusicPlaying] = useState(false);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return undefined;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02030d, 0.095);
    const camera = new THREE.PerspectiveCamera(52, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.z = 6.2;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.setClearColor(0x02030d, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const bases = new Float32Array(PARTICLE_COUNT * 3);
    const directions = new Float32Array(PARTICLE_COUNT * 3);
    const starTargets = new Float32Array(PARTICLE_COUNT * 3);
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
      const starAngle = Math.random() * Math.PI * 2;
      const starRay = Math.pow((Math.cos(starAngle * 5) + 1) / 2, 5);
      const starRadius = (0.16 + starRay * 0.42) * Math.sqrt(Math.random());
      starTargets.set([Math.cos(starAngle) * starRadius, Math.sin(starAngle) * starRadius, (Math.random() - 0.5) * 0.12], offset);
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

    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.115, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xffedbd, transparent: true, opacity: 0.96 })
    );
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeParticleTexture(), color: 0xffe2a2, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }));
    halo.scale.set(0.9, 0.9, 1);
    orb.add(halo);
    orb.visible = false;
    scene.add(orb);

    const searchStarTexture = makeParticleTexture();
    const searchStarLeft = new THREE.Sprite(new THREE.SpriteMaterial({ map: searchStarTexture, color: 0xffb9dc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const searchStarRight = new THREE.Sprite(new THREE.SpriteMaterial({ map: searchStarTexture, color: 0xbad8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    searchStarLeft.scale.set(0.82, 0.82, 1);
    searchStarRight.scale.set(0.82, 0.82, 1);
    scene.add(searchStarLeft, searchStarRight);

    let frame;
    let currentOpen = 0.08;
    const clock = new THREE.Clock();
    const animate = () => {
      const time = clock.getElapsedTime();
      currentOpen = THREE.MathUtils.lerp(currentOpen, opennessRef.current, 0.07);
      const array = geometry.attributes.position.array;
      const interaction = interactionRef.current;
      const isSearch = interaction.mode === 'search';
      const isGather = interaction.mode === 'gather';
      for (let i = 0; i < PARTICLE_COUNT; i += 1) {
        const o = i * 3;
        const wave = Math.sin(time * 1.4 + i * 0.013) * 0.025;
        let targetX = bases[o] + directions[o] * currentOpen + wave;
        let targetY = bases[o + 1] + directions[o + 1] * currentOpen + wave;
        let targetZ = bases[o + 2] + directions[o + 2] * currentOpen;
        if (interaction.mode === 'scatter' || isSearch) {
          targetX = bases[o] * 0.22 + directions[o] * 1.48 + wave;
          targetY = bases[o + 1] * 0.22 + directions[o + 1] * 1.48 + wave;
          targetZ = bases[o + 2] * 0.22 + directions[o + 2] * 1.48;
        } else if (isGather) {
          const staysBehind = i % 6 === 0;
          targetX = staysBehind ? bases[o] * 0.2 + directions[o] * 1.42 : starTargets[o] + wave;
          targetY = staysBehind ? bases[o + 1] * 0.2 + directions[o + 1] * 1.42 : starTargets[o + 1] + wave;
          targetZ = staysBehind ? bases[o + 2] * 0.2 + directions[o + 2] * 1.42 : starTargets[o + 2];
        } else if (interaction.mode === 'burst') {
          targetX = directions[o] * 3.6 + wave;
          targetY = directions[o + 1] * 3.6 + wave;
          targetZ = directions[o + 2] * 3.6;
        } else if (interaction.mode === 'reveal') {
          targetX = bases[o] + directions[o] * currentOpen + wave;
          targetY = bases[o + 1] + directions[o + 1] * currentOpen + wave;
          targetZ = bases[o + 2] + directions[o + 2] * currentOpen;
        }
        const speed = isSearch ? 0.038 : (isGather ? 0.048 : (interaction.mode === 'burst' ? 0.026 : (interaction.mode === 'reveal' ? 0.022 : 0.075)));
        array[o] = THREE.MathUtils.lerp(array[o], targetX, speed);
        array[o + 1] = THREE.MathUtils.lerp(array[o + 1], targetY, speed);
        array[o + 2] = THREE.MathUtils.lerp(array[o + 2], targetZ, speed);
      }
      geometry.attributes.position.needsUpdate = true;
      heart.rotation.y = THREE.MathUtils.lerp(heart.rotation.y, handTargetRef.current.x, 0.055) + 0.0014;
      heart.rotation.x = THREE.MathUtils.lerp(heart.rotation.x, handTargetRef.current.y, 0.05);
      heart.scale.setScalar(1 + Math.sin(time * 1.7) * 0.018);
      orb.visible = false;
      const searchRotation = handTargetRef.current.x * 1.85;
      const leftAngle = -1.18 + searchRotation;
      const rightAngle = 1.18 + searchRotation;
      searchStarLeft.position.set(Math.sin(leftAngle) * 2.15, -0.22, Math.cos(leftAngle) * 1.35);
      searchStarRight.position.set(Math.sin(rightAngle) * 2.15, 0.28, Math.cos(rightAngle) * 1.35);
      const leftDepth = THREE.MathUtils.clamp((searchStarLeft.position.z + 1.35) / 2.7, 0.08, 0.96);
      const rightDepth = THREE.MathUtils.clamp((searchStarRight.position.z + 1.35) / 2.7, 0.08, 0.96);
      searchStarLeft.material.opacity = isSearch && interaction.starCount >= 1 ? leftDepth : 0;
      searchStarRight.material.opacity = isSearch && interaction.starCount >= 2 ? rightDepth : 0;
      const starPulse = 0.82 + Math.sin(time * 3.5) * 0.1;
      searchStarLeft.scale.set(starPulse, starPulse, 1);
      searchStarRight.scale.set(starPulse, starPulse, 1);
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
      geometry.dispose(); material.map?.dispose(); material.dispose(); orb.geometry.dispose(); orb.material.dispose(); halo.material.map?.dispose(); halo.material.dispose();
      searchStarLeft.material.dispose(); searchStarRight.material.dispose(); searchStarTexture.dispose();
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

  const stopBirthdayMusic = () => {
    if (musicTimerRef.current) window.clearTimeout(musicTimerRef.current);
    musicTimerRef.current = null;
    musicNodesRef.current.forEach((node) => {
      try { node.stop(); } catch { /* already stopped */ }
    });
    musicNodesRef.current = [];
    setMusicPlaying(false);
  };

  const startBirthdayMusic = () => {
    stopBirthdayMusic();
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!musicContextRef.current) musicContextRef.current = new AudioContext();
    const context = musicContextRef.current;
    context.resume();
    const notes = [
      ['G4', .38], ['G4', .22], ['A4', .62], ['G4', .62], ['C5', .62], ['B4', 1.05],
      ['G4', .38], ['G4', .22], ['A4', .62], ['G4', .62], ['D5', .62], ['C5', 1.05],
      ['G4', .38], ['G4', .22], ['G5', .62], ['E5', .62], ['C5', .62], ['B4', .62], ['A4', 1.05],
      ['F5', .38], ['F5', .22], ['E5', .62], ['C5', .62], ['D5', .62], ['C5', 1.15],
    ];
    const frequencies = { G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99 };

    const schedule = () => {
      let cursor = context.currentTime + 0.12;
      const master = context.createGain();
      master.gain.value = 0.19;
      master.connect(context.destination);
      notes.forEach(([note, duration]) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequencies[note];
        gain.gain.setValueAtTime(0.0001, cursor);
        gain.gain.exponentialRampToValueAtTime(0.38, cursor + 0.035);
        gain.gain.exponentialRampToValueAtTime(0.0001, cursor + duration * 0.92);
        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start(cursor);
        oscillator.stop(cursor + duration);
        musicNodesRef.current.push(oscillator);
        cursor += duration;
      });
      const loopDelay = Math.max(1000, (cursor - context.currentTime + 1.3) * 1000);
      musicTimerRef.current = window.setTimeout(schedule, loopDelay);
    };
    schedule();
    setMusicPlaying(true);
  };

  useEffect(() => () => {
    if (musicTimerRef.current) window.clearTimeout(musicTimerRef.current);
    musicNodesRef.current.forEach((node) => { try { node.stop(); } catch { /* already stopped */ } });
    musicContextRef.current?.close?.();
  }, []);

  const revealBirthday = () => {
    revealedRef.current = true;
    setRevealed(true);
    window.setTimeout(() => {
      interactionRef.current.mode = 'reveal';
      opennessRef.current = 0.34;
    }, 380);
  };

  const setPhase = (phase, mode = phase) => {
    phaseRef.current = phase;
    interactionRef.current.mode = mode;
    gestureFramesRef.current = 0;
    setInteractionPhase(phase);
  };

  const startCamera = async () => {
    setCameraState('loading');
    setError('');
    startBirthdayMusic();
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
      let lastDetectionAt = 0;
      const detect = () => {
        if (!landmarkerRef.current || !videoRef.current) return;
        const now = performance.now();
        if (video.currentTime !== lastTime && now - lastDetectionAt >= 34) {
          lastTime = video.currentTime;
          lastDetectionAt = now;
          const result = landmarkerRef.current.detectForVideo(video, now);
          const gesture = readGesture(result.landmarks?.[0]);
          if (gesture) {
            const previous = smoothedGestureRef.current;
            const smoothX = previous.x === null ? gesture.x : THREE.MathUtils.lerp(previous.x, gesture.x, 0.48);
            const smoothOpen = THREE.MathUtils.lerp(previous.openness, gesture.openness, 0.52);
            smoothedGestureRef.current = { x: smoothX, openness: smoothOpen };
            const phase = phaseRef.current;
            if (revealedRef.current) opennessRef.current = smoothOpen * 0.92;
            else if (phase === 'openHeart') opennessRef.current = smoothOpen * 1.1;
            if (lastHandXRef.current !== null) {
              const handDelta = THREE.MathUtils.clamp(smoothX - lastHandXRef.current, -0.12, 0.12);
              rotationRef.current += handDelta * 4.8;
            }
            lastHandXRef.current = smoothX;
            handTargetRef.current = { x: rotationRef.current, y: (gesture.y - 0.5) * 0.75 };

            if (revealedRef.current) {
              setGestureText(smoothOpen > 0.5 ? '星光随你散开' : '爱心正在重新聚拢');
            } else if (phase === 'openHeart') {
              gestureFramesRef.current = smoothOpen > 0.55
                ? gestureFramesRef.current + 1
                : Math.max(0, gestureFramesRef.current - 1);
              if (gestureFramesRef.current > 3) {
                swipeRef.current = { zone: 'center', passes: 0, lastPassAt: 0 };
                setPhase('searchStars', 'search');
                opennessRef.current = 1.25;
                setGestureText('左右慢慢翻动星海，寻找隐藏的星光');
              }
            } else if (phase === 'searchStars') {
              const zone = smoothX < 0.42 ? 'left' : (smoothX > 0.58 ? 'right' : 'center');
              const swipe = swipeRef.current;
              if ((zone === 'left' || zone === 'right') && zone !== swipe.zone && now - swipe.lastPassAt > 180) {
                if (swipe.zone === 'left' || swipe.zone === 'right') swipe.passes += 1;
                swipe.zone = zone;
                swipe.lastPassAt = now;
                if (swipe.passes === 2) {
                  interactionRef.current.starCount = 1;
                  setGestureText('找到第一颗了，继续左右翻动');
                } else if (swipe.passes >= 4) {
                  interactionRef.current.starCount = 2;
                  setPhase('closeStars', 'search');
                  setGestureText('两颗星都找到了，请慢慢闭合手掌');
                }
              }
            } else if (phase === 'closeStars') {
              gestureFramesRef.current = smoothOpen < 0.34
                ? gestureFramesRef.current + 1
                : Math.max(0, gestureFramesRef.current - 1);
              if (gestureFramesRef.current > 3) {
                setPhase('finalOpen', 'gather');
                setGestureText('最后一次张开手掌');
              }
            } else if (phase === 'finalOpen') {
              gestureFramesRef.current = smoothOpen > 0.55
                ? gestureFramesRef.current + 1
                : Math.max(0, gestureFramesRef.current - 1);
              if (gestureFramesRef.current > 3) {
                setPhase('birthdayBurst', 'burst');
                setGestureText('生日星光已被唤醒');
                window.setTimeout(revealBirthday, 1600);
              }
            }
          } else {
            lastHandXRef.current = null;
            smoothedGestureRef.current.x = null;
            setGestureText('把一只手放入镜头范围');
          }
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
    stopBirthdayMusic();
    sessionStorage.setItem('nh-birthday-intro-seen', 'true');
    onDone();
  };

  return (
    <div className={`gesture-intro particle-version ${revealed ? 'is-revealed' : ''}`} role="dialog" aria-modal="true" aria-label="生日粒子宇宙">
      <div ref={canvasHostRef} className="gesture-particle-canvas" aria-hidden="true" />
      <video ref={videoRef} className="gesture-camera-source" playsInline muted />
      <button
        className={`birthday-music-toggle ${musicPlaying ? 'is-playing' : ''}`}
        onClick={musicPlaying ? stopBirthdayMusic : startBirthdayMusic}
        aria-label={musicPlaying ? '暂停生日音乐' : '播放生日音乐'}
        title={musicPlaying ? '暂停生日音乐' : '播放生日音乐'}
      >
        <span>{musicPlaying ? '♫' : '♪'}</span>
        <small>{musicPlaying ? '生日旋律' : '播放音乐'}</small>
      </button>
      {cameraState === 'idle' && !revealed && (
        <div className="particle-welcome">
          <p>N &amp; H · A GIFT FROM THE UNIVERSE</p>
          <h1>把星辰握在掌心</h1>
          <button className="gesture-primary" onClick={startCamera}>开启手势宇宙</button>
        </div>
      )}
      {cameraState === 'loading' && !revealed && <p className="particle-hint">正在连接星辰…</p>}
      {cameraState === 'tracking' && !revealed && (
        <div className="particle-controls"><span className="camera-live"><i /> GESTURE ACTIVE</span><p>{gestureText}</p></div>
      )}
      {cameraState === 'error' && !revealed && (
        <div className="particle-error"><p>{error}</p><button className="gesture-primary" onClick={startCamera}>重新尝试</button></div>
      )}
      {revealed && (
        <div className="particle-birthday">
          <div className="birthday-burst" aria-hidden="true">✦</div>
          <p>25 · 09 · 2026</p>
          <h1>Happy Birthday, 稼晖</h1>
          <h2>愿你的每一岁，都有新的星辰与惊喜。</h2>
          <span>— N ❤️ H</span>
          <button className="gesture-primary" onClick={completeIntro}>进入我们的宇宙</button>
        </div>
      )}
    </div>
  );
}
