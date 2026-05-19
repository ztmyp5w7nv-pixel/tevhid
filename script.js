const audio = document.getElementById("poemAudio");
const startScreen = document.getElementById("startScreen");
const playState = document.getElementById("playState");
const currentTimeLabel = document.getElementById("currentTime");
const totalTimeLabel = document.getElementById("totalTime");
const soundToggle = document.getElementById("soundToggle");
const restartButton = document.getElementById("restartButton");
const progressRing = document.querySelector(".progress-ring__value");
const verseCards = [...document.querySelectorAll(".verse-card")];
const equalizer = document.getElementById("equalizer");

const RING_LENGTH = 465;
const DEFAULT_DURATION = 534.86;
const BAR_COUNT = 20;

let interactionUnlocked = false;
let audioContext = null;
let analyser = null;
let sourceNode = null;
let dataArray = null;
let activeVerseIndex = 0;
let animationFrameId = null;

const verseTimeline = verseCards.map((card) => ({
  start: Number(card.dataset.start),
  end: Number(card.dataset.end),
}));

for (let index = 0; index < BAR_COUNT; index += 1) {
  const bar = document.createElement("span");
  bar.className = "equalizer__bar";
  bar.style.setProperty("--level", "0.18");
  equalizer.appendChild(bar);
}

const equalizerBars = [...equalizer.children];

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function getDuration() {
  return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : DEFAULT_DURATION;
}

function updateVerseHighlight(currentTime) {
  const nextIndex = verseTimeline.findIndex(
    (verse) => currentTime >= verse.start && currentTime < verse.end,
  );
  const resolvedIndex = nextIndex === -1 ? verseTimeline.length - 1 : nextIndex;

  if (resolvedIndex === activeVerseIndex) {
    return;
  }

  verseCards[activeVerseIndex]?.classList.remove("is-active");
  verseCards[resolvedIndex]?.classList.add("is-active");
  activeVerseIndex = resolvedIndex;
}

function updatePlaybackUi() {
  const duration = getDuration();
  const current = audio.currentTime || 0;
  const progress = Math.min(current / duration, 1);
  const offset = RING_LENGTH - progress * RING_LENGTH;

  currentTimeLabel.textContent = formatTime(current);
  totalTimeLabel.textContent = formatTime(duration);
  progressRing.style.strokeDashoffset = String(offset);

  updateVerseHighlight(current);
}

function setPlayStateLabel() {
  if (!interactionUnlocked) {
    playState.textContent = "Başlatılmadı";
    return;
  }

  if (audio.muted) {
    playState.textContent = "Sessiz döngü";
    return;
  }

  playState.textContent = audio.paused ? "Durakladı" : "Döngüde çalıyor";
}

function setOrbPulse(level) {
  const pulse = Math.min(Math.max(level, 0), 1);
  document.documentElement.style.setProperty("--pulse", pulse.toFixed(2));
}

function animateEqualizer() {
  if (!analyser || !dataArray) {
    equalizerBars.forEach((bar, index) => {
      const value = 0.18 + Math.sin((Date.now() / 360) + index * 0.45) * 0.05;
      bar.style.setProperty("--level", value.toFixed(2));
    });
    setOrbPulse(0.22);
    animationFrameId = requestAnimationFrame(animateEqualizer);
    return;
  }

  analyser.getByteFrequencyData(dataArray);

  let total = 0;
  equalizerBars.forEach((bar, index) => {
    const bin = Math.floor((index / BAR_COUNT) * dataArray.length);
    const level = Math.max(0.16, dataArray[bin] / 255);
    total += level;
    bar.style.setProperty("--level", level.toFixed(2));
  });

  setOrbPulse(total / BAR_COUNT);
  animationFrameId = requestAnimationFrame(animateEqualizer);
}

function ensureVisualizer() {
  if (audioContext) {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    if (!animationFrameId) {
      animateEqualizer();
    }
    return;
  }

  audioContext = new AudioContextClass();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 128;
  dataArray = new Uint8Array(analyser.frequencyBinCount);
  sourceNode = audioContext.createMediaElementSource(audio);
  sourceNode.connect(analyser);
  analyser.connect(audioContext.destination);

  if (!animationFrameId) {
    animateEqualizer();
  }
}

async function unlockAudio() {
  try {
    ensureVisualizer();

    if (audioContext && audioContext.state === "suspended") {
      await audioContext.resume();
    }

    audio.currentTime = audio.currentTime || 0;
    await audio.play();

    interactionUnlocked = true;
    document.body.classList.remove("is-locked");
    startScreen.classList.add("is-hidden");
    updatePlaybackUi();
    setPlayStateLabel();
  } catch (error) {
    playState.textContent = "Başlatmak için tekrar dokun";
  }
}

startScreen.addEventListener("click", unlockAudio);

audio.addEventListener("loadedmetadata", updatePlaybackUi);
audio.addEventListener("timeupdate", updatePlaybackUi);
audio.addEventListener("play", setPlayStateLabel);
audio.addEventListener("pause", setPlayStateLabel);
audio.addEventListener("volumechange", () => {
  soundToggle.textContent = audio.muted ? "Sesi Aç" : "Sesi Kapat";
  setPlayStateLabel();
});

audio.addEventListener("ended", () => {
  updateVerseHighlight(0);
});

restartButton.addEventListener("click", async () => {
  audio.currentTime = 0;
  updatePlaybackUi();

  if (interactionUnlocked) {
    try {
      if (audioContext && audioContext.state === "suspended") {
        await audioContext.resume();
      }

      await audio.play();
    } catch (error) {
      playState.textContent = "Yeniden başlatılamadı";
    }
  }
});

soundToggle.addEventListener("click", () => {
  audio.muted = !audio.muted;
});

document.addEventListener("visibilitychange", async () => {
  if (!document.hidden && interactionUnlocked && audio.paused) {
    try {
      if (audioContext && audioContext.state === "suspended") {
        await audioContext.resume();
      }

      await audio.play();
    } catch (error) {
      setPlayStateLabel();
    }
  }
});

window.addEventListener("load", () => {
  updatePlaybackUi();
  setPlayStateLabel();
  if (!animationFrameId) {
    animateEqualizer();
  }
});
