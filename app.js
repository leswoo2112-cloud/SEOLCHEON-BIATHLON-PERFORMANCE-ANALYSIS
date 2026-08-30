/* =========================================================
   설천 BIATHLON 자세분석 PRO
   app.js

   핵심 기능
   ---------------------------------------------------------
   1. 페이지 이동
   2. 영상 업로드 / 재생 / 일시정지 / 배속
   3. MediaPipe Pose 기반 사람 자세 인식
   4. 프레임 간 선수 중심 추적
   5. 스켈레톤 오버레이
   6. 스키 분석
   7. 롤러스키 분석
   8. 사격 분석
   9. 총구 기준점 및 이동 궤적
   10. 격발 이벤트 지정
   11. 분석 기록 localStorage 저장
   12. 비교분석 데이터 제공
========================================================= */

"use strict";


/* =========================================================
   01. GLOBAL STATE
========================================================= */

const APP = {

  athlete: {
    name: "이은성",
    school: "설천고등학교",
    year: "2010"
  },

  currentPage: "dashboard",

  currentCamera: {
    ski: "side",
    roller: "side",
    shooting: "side"
  },

  pose: null,

  poseReady: false,

  analysis: {
    ski: false,
    roller: false,
    shooting: false
  },

  videos: {
    ski: null,
    roller: null,
    shooting: null
  },

  canvases: {
    ski: null,
    roller: null,
    shooting: null,
    muzzle: null
  },

  charts: {},

  trajectory: {
    ski: [],
    roller: [],
    shooting: []
  },

  history: {
    ski: [],
    roller: [],
    shooting: []
  },

  frames: {
    ski: [],
    roller: [],
    shooting: []
  },

  metrics: {
    ski: {
      symmetry: 0,
      stability: 0,
      consistency: 0,
      cycle: 0
    },

    roller: {
      symmetry: 0,
      stability: 0,
      consistency: 0,
      cadence: 0,
      leftPush: 0,
      rightPush: 0
    },

    shooting: {
      symmetry: 0,
      stability: 0,
      consistency: 0,
      posture: 0
    }
  },

  shooting: {
    muzzlePoint: null,

    muzzleHistory: [],

    shotEvents: [],

    maxShots: 5,

    eventWindow: 0.35,

    selectedEvent: null
  },

  tracking: {
    enabled: true,

    locked: false,

    lastCenter: null,

    confidence: 0,

    lostFrames: 0,

    maxLostFrames: 12,

    smoothing: 0.72
  },

  settings: {
    minPoseVisibility: 0.42,

    smoothing: 0.72,

    trajectoryMax: 500,

    frameStep: 1
  }

};


/* =========================================================
   02. LANDMARK INDEX
========================================================= */

const LM = {

  NOSE: 0,

  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,

  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,

  LEFT_EAR: 7,
  RIGHT_EAR: 8,

  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,

  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,

  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,

  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,

  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,

  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,

  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,

  LEFT_HIP: 23,
  RIGHT_HIP: 24,

  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,

  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,

  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,

  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32

};


/* =========================================================
   03. DOM HELPERS
========================================================= */

function $(selector) {
  return document.querySelector(selector);
}


function $all(selector) {
  return [...document.querySelectorAll(selector)];
}


function safeNumber(value, fallback = 0) {

  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;
}


function clamp(value, min, max) {

  return Math.max(
    min,
    Math.min(max, value)
  );
}


function round(value, digits = 1) {

  const p = 10 ** digits;

  return Math.round(value * p) / p;
}


function nowISO() {
  return new Date().toISOString();
}


function formatTime(seconds) {

  seconds = Math.max(
    0,
    safeNumber(seconds)
  );

  const min = Math.floor(seconds / 60);

  const sec = seconds % 60;

  return (
    String(min).padStart(2, "0") +
    ":" +
    sec.toFixed(2).padStart(5, "0")
  );
}


function formatDate(date = new Date()) {

  return date.toLocaleString(
    "ko-KR",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}


/* =========================================================
   04. TOAST
========================================================= */

let toastTimer = null;


function toast(message) {

  const el = $("#toast");

  if (!el) return;

  el.textContent = message;

  el.style.opacity = "1";

  el.style.transform = "translateY(0)";

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {

    el.style.opacity = "0";

    el.style.transform = "translateY(8px)";

  }, 2200);
}


/* =========================================================
   05. LOCAL STORAGE
========================================================= */

const STORAGE_KEY =
  "seolcheon_biathlon_analysis_v4";


function loadRecords() {

  try {

    const raw =
      localStorage.getItem(STORAGE_KEY);

    if (!raw) return [];

    const data = JSON.parse(raw);

    return Array.isArray(data)
      ? data
      : [];

  } catch (error) {

    console.warn(
      "기록을 불러오지 못했습니다.",
      error
    );

    return [];
  }
}


function saveRecords(records) {

  try {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(records)
    );

    return true;

  } catch (error) {

    console.error(
      "기록 저장 실패",
      error
    );

    toast(
      "저장 공간이 부족합니다."
    );

    return false;
  }
}


function getRecords() {
  return loadRecords();
}


function createRecord(record) {

  const records = getRecords();

  records.unshift(record);

  /*
   * 너무 많은 원본 프레임 데이터를
   * localStorage에 저장하지 않도록 제한
   */

  if (records.length > 100) {

    records.splice(
      100
    );
  }

  saveRecords(records);

  updateDashboard();

  renderRecords();

  populateReportSelect();

  populateCompareSelects();
}


function deleteRecord(id) {

  const records =
    getRecords().filter(
      item => item.id !== id
    );

  saveRecords(records);

  updateDashboard();

  renderRecords();

  populateReportSelect();

  populateCompareSelects();

  toast("분석 기록을 삭제했습니다.");
}


/* =========================================================
   06. NAVIGATION
========================================================= */

const PAGE_TITLES = {

  dashboard: "대시보드",

  ski: "스키 자세분석",

  roller: "롤러스키 자세분석",

  shooting: "사격 자세분석",

  compare: "비교분석",

  records: "분석 기록",

  report: "분석 리포트"

};


function navigate(page) {

  if (!PAGE_TITLES[page]) {
    page = "dashboard";
  }

  APP.currentPage = page;

  $all(".page").forEach(el => {

    el.classList.toggle(
      "active",
      el.id === page
    );

  });


  $all(".nav-button").forEach(btn => {

    btn.classList.toggle(
      "active",
      btn.dataset.page === page
    );

  });


  const title =
    $("#pageTitle");

  if (title) {

    title.textContent =
      PAGE_TITLES[page];
  }


  const sidebar =
    $("#sidebar");

  if (sidebar) {

    sidebar.classList.remove(
      "open"
    );
  }


  if (page === "records") {

    renderRecords();
  }


  if (page === "compare") {

    populateCompareSelects();
  }


  if (page === "report") {

    populateReportSelect();
  }
}


function setupNavigation() {

  $all(".nav-button").forEach(btn => {

    btn.addEventListener(
      "click",
      () => {

        navigate(
          btn.dataset.page
        );

      }
    );

  });


  $all("[data-page]").forEach(btn => {

    if (
      btn.classList.contains(
        "nav-button"
      )
    ) {
      return;
    }

    btn.addEventListener(
      "click",
      () => {

        navigate(
          btn.dataset.page
        );

      }
    );

  });


  const menu =
    $("#menuButton");

  if (menu) {

    menu.addEventListener(
      "click",
      () => {

        $("#sidebar")
          ?.classList.toggle(
            "open"
          );

      }
    );
  }
}


/* =========================================================
   07. CLOCK
========================================================= */

function updateClock() {

  const clock =
    $("#clock");

  if (!clock) return;

  const now =
    new Date();

  clock.textContent =
    now.toLocaleTimeString(
      "ko-KR",
      {
        hour12: false
      }
    );
}


setInterval(
  updateClock,
  1000
);


/* =========================================================
   08. MEDIA / VIDEO
========================================================= */

function setupVideoModule(type) {

  const video =
    $(`#${type}Video`);

  const input =
    $(`#${type}Input`);

  const upload =
    $(`#${type}Upload`);

  const play =
    $(`#${type}Play`);

  const prev =
    $(`#${type}Prev`);

  const next =
    $(`#${type}Next`);

  const slow =
    $(`#${type}Slow`);

  const normal =
    $(`#${type}Normal`);

  const seek =
    $(`#${type}Seek`);

  const start =
    $(`#${type}Start`);

  const stop =
    $(`#${type}Stop`);


  if (!video) return;


  APP.videos[type] =
    video;


  /*
   * 영상 선택
   */

  upload?.addEventListener(
    "click",
    () => input?.click()
  );


  input?.addEventListener(
    "change",
    event => {

      const file =
        event.target.files?.[0];

      if (!file) return;

      loadVideo(
        type,
        file
      );

    }
  );


  /*
   * 재생 / 일시정지
   */

  play?.addEventListener(
    "click",
    () => {

      if (
        video.paused
      ) {

        video.play();

      } else {

        video.pause();

      }

    }
  );


  video.addEventListener(
    "play",
    () => {

      if (play) {
        play.textContent =
          "Ⅱ";
      }

    }
  );


  video.addEventListener(
    "pause",
    () => {

      if (play) {
        play.textContent =
          "▶";
      }

    }
  );


  /*
   * 프레임 이동
   */

  prev?.addEventListener(
    "click",
    () => {

      stepVideo(
        type,
        -1
      );

    }
  );


  next?.addEventListener(
    "click",
    () => {

      stepVideo(
        type,
        1
      );

    }
  );


  /*
   * 배속
   */

  slow?.addEventListener(
    "click",
    () => {

      video.playbackRate =
        type === "shooting"
          ? 0.25
          : 0.5;

      toast(
        `재생속도 ${video.playbackRate}×`
      );

    }
  );


  normal?.addEventListener(
    "click",
    () => {

      video.playbackRate =
        1;

      toast(
        "재생속도 1×"
      );

    }
  );


  /*
   * 타임라인
   */

  seek?.addEventListener(
    "input",
    () => {

      if (!video.duration) return;

      video.currentTime =
        (
          Number(
            seek.value
          ) / 100
        ) *
        video.duration;

    }
  );


  video.addEventListener(
    "timeupdate",
    () => {

      if (
        !video.duration ||
        !seek
      ) {
        return;
      }

      seek.value =
        (
          video.currentTime /
          video.duration
        ) *
        100;

    }
  );


  /*
   * 분석 시작
   */

  start?.addEventListener(
    "click",
    () => {

      if (!video.src) {

        toast(
          "먼저 영상을 선택하세요."
        );

        return;
      }

      startAnalysis(
        type
      );

    }
  );


  /*
   * 분석 종료 / 저장
   */

  stop?.addEventListener(
    "click",
    () => {

      stopAnalysis(
        type
      );

    }
  );


  /*
   * 영상 프레임 처리
   */

  video.addEventListener(
    "loadedmetadata",
    () => {

      const empty =
        $(`#${type}Empty`);

      if (empty) {

        empty.style.display =
          "none";
      }

      resizeCanvas(
        type
      );

    }
  );


  video.addEventListener(
    "ended",
    () => {

      if (
        APP.analysis[type]
      ) {

        toast(
          "영상이 끝났습니다. 분석을 종료하고 저장할 수 있습니다."
        );

      }

    }
  );
}


function loadVideo(type, file) {

  const video =
    APP.videos[type];

  if (!video) return;


  const oldURL =
    video.dataset.objectUrl;

  if (oldURL) {

    URL.revokeObjectURL(
      oldURL
    );
  }


  const url =
    URL.createObjectURL(
      file
    );

  video.dataset.objectUrl =
    url;

  video.src =
    url;

  video.load();


  APP.trajectory[type] =
    [];

  APP.frames[type] =
    [];


  if (type === "shooting") {

    APP.shooting.muzzleHistory =
      [];

  }


  toast(
    `${typeName(type)} 영상을 불러왔습니다.`
  );
}


function typeName(type) {

  return {

    ski: "스키",

    roller: "롤러스키",

    shooting: "사격"

  }[type] || type;
}


function stepVideo(
  type,
  direction
) {

  const video =
    APP.videos[type];

  if (
    !video ||
    !video.duration
  ) {
    return;
  }


  /*
   * 일반 영상은 약 1/30초,
   * 사격은 약 1/60초 수준으로
   * 프레임 이동감을 제공
   */

  const step =
    type === "shooting"
      ? 1 / 60
      : 1 / 30;


  video.pause();

  video.currentTime =
    clamp(
      video.currentTime +
      step * direction,
      0,
      video.duration
    );
}


/* =========================================================
   09. CANVAS
========================================================= */

function setupCanvases() {

  APP.canvases.ski =
    $("#skiCanvas");

  APP.canvases.roller =
    $("#rollerCanvas");

  APP.canvases.shooting =
    $("#shootingCanvas");

  APP.canvases.muzzle =
    $("#shootingMuzzleCanvas");


  [
    "ski",
    "roller",
    "shooting"
  ].forEach(type => {

    resizeCanvas(
      type
    );

  });


  window.addEventListener(
    "resize",
    () => {

      resizeCanvas(
        "ski"
      );

      resizeCanvas(
        "roller"
      );

      resizeCanvas(
        "shooting"
      );

    }
  );
}


function resizeCanvas(type) {

  const canvas =
    APP.canvases[type];

  const video =
    APP.videos[type];

  if (
    !canvas ||
    !video
  ) {
    return;
  }


  const rect =
    video.getBoundingClientRect();


  const width =
    Math.max(
      1,
      rect.width
    );

  const height =
    Math.max(
      1,
      rect.height
    );


  const dpr =
    window.devicePixelRatio ||
    1;


  canvas.width =
    Math.round(
      width * dpr
    );

  canvas.height =
    Math.round(
      height * dpr
    );


  canvas.style.width =
    `${width}px`;

  canvas.style.height =
    `${height}px`;


  const ctx =
    canvas.getContext(
      "2d"
    );

  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );


  if (
    type === "shooting"
  ) {

    const muzzle =
      APP.canvases.muzzle;

    if (muzzle) {

      muzzle.width =
        Math.round(
          width * dpr
        );

      muzzle.height =
        Math.round(
          height * dpr
        );

      muzzle.style.width =
        `${width}px`;

      muzzle.style.height =
        `${height}px`;

      muzzle
        .getContext("2d")
        .setTransform(
          dpr,
          0,
          0,
          dpr,
          0,
          0
        );

    }

  }
}


/* =========================================================
   10. MEDIAPIPE POSE
========================================================= */

function initPose() {

  if (
    typeof Pose ===
    "undefined"
  ) {

    console.warn(
      "MediaPipe Pose가 아직 로드되지 않았습니다."
    );

    return;
  }


  APP.pose =
    new Pose({

      locateFile: file => {

        return (
          "https://cdn.jsdelivr.net/npm/@mediapipe/pose/" +
          file
        );

      }

    });


  APP.pose.setOptions({

    modelComplexity: 1,

    smoothLandmarks: true,

    enableSegmentation: false,

    smoothSegmentation: false,

    minDetectionConfidence: 0.45,

    minTrackingConfidence: 0.45

  });


  APP.pose.onResults(
    handlePoseResults
  );


  APP.poseReady =
    true;
}


/* =========================================================
   11. START / STOP ANALYSIS
========================================================= */

function startAnalysis(type) {

  const video =
    APP.videos[type];

  if (
    !video ||
    !video.src
  ) {

    toast(
      "먼저 영상을 선택하세요."
    );

    return;
  }


  APP.analysis[type] =
    true;


  APP.tracking.lastCenter =
    null;

  APP.tracking.confidence =
    0;

  APP.tracking.lostFrames =
    0;


  APP.trajectory[type] =
    [];

  APP.frames[type] =
    [];


  if (
    type === "shooting"
  ) {

    APP.shooting.muzzleHistory =
      [];

  }


  video.currentTime =
    Math.max(
      0,
      video.currentTime
    );


  video.play().catch(
    () => {}
  );


  toast(
    `${typeName(type)} 자세분석을 시작했습니다.`
  );


  processVideoFrame(
    type
  );
}


function stopAnalysis(type) {

  APP.analysis[type] =
    false;


  const video =
    APP.videos[type];

  video?.pause();


  const record =
    buildAnalysisRecord(
      type
    );


  if (!record) {

    toast(
      "저장할 분석 데이터가 없습니다."
    );

    return;
  }


  createRecord(
    record
  );


  toast(
    `${typeName(type)} 분석을 저장했습니다.`
  );
}


/* =========================================================
   12. VIDEO FRAME LOOP
========================================================= */

const processing = {

  ski: false,

  roller: false,

  shooting: false

};


async function processVideoFrame(type) {

  if (
    processing[type]
  ) {
    return;
  }


  processing[type] =
    true;


  const video =
    APP.videos[type];


  if (
    !video ||
    !APP.analysis[type]
  ) {

    processing[type] =
      false;

    return;
  }


  if (
    APP.poseReady &&
    video.readyState >= 2
  ) {

    try {

      await APP.pose.send({
        image: video
      });

    } catch (error) {

      console.warn(
        "Pose 처리 오류",
        error
      );

    }

  }


  processing[type] =
    false;


  if (
    APP.analysis[type] &&
    !video.paused &&
    !video.ended
  ) {

    requestAnimationFrame(
      () => processVideoFrame(type)
    );

  }
}


/* =========================================================
   13. POSE RESULT
========================================================= */

function handlePoseResults(results) {

  const page =
    APP.currentPage;


  let type =
    null;


  if (
    page === "ski"
  ) {

    type = "ski";

  } else if (
    page === "roller"
  ) {

    type = "roller";

  } else if (
    page === "shooting"
  ) {

    type = "shooting";

  }


  /*
   * 다른 페이지에 있어도
   * 현재 분석 중인 종목을 찾는다.
   */

  if (!type) {

    type =
      Object.keys(
        APP.analysis
      ).find(
        key =>
          APP.analysis[key]
      );

  }


  if (!type) return;


  if (
    !results ||
    !results.poseLandmarks ||
    results.poseLandmarks.length < 33
  ) {

    handleTrackingLost(
      type
    );

    return;
  }


  const landmarks =
    results.poseLandmarks;


  const center =
    calculateBodyCenter(
      landmarks
    );


  const confidence =
    calculatePoseConfidence(
      landmarks
    );


  /*
   * 사람이 제대로 잡힌 경우에만
   * 분석 데이터에 반영
   */

  if (
    confidence <
    APP.settings.minPoseVisibility
  ) {

    handleTrackingLost(
      type
    );

    return;
  }


  /*
   * 선수 추적
   */

  if (
    APP.tracking.enabled
  ) {

    const tracked =
      updatePersonTracking(
        center,
        confidence
      );


    if (!tracked) {

      handleTrackingLost(
        type
      );

      return;
    }

  }


  APP.tracking.confidence =
    confidence;

  APP.tracking.lostFrames =
    0;


  /*
   * 스켈레톤 그리기
   */

  drawPose(
    type,
    landmarks
  );


  /*
   * 공통 지표 계산
   */

  const data =
    calculatePoseData(
      landmarks
    );


  /*
   * 종목별 분석
   */

  if (type === "ski") {

    analyzeSki(
      data,
      center
    );

  }


  if (type === "roller") {

    analyzeRoller(
      data,
      center
    );

  }


  if (type === "shooting") {

    analyzeShooting(
      data,
      center
    );

  }


  /*
   * 프레임 기록
   */

  const video =
    APP.videos[type];


  if (video) {

    const frameData = {

      time: video.currentTime,

      center: {
        x: center.x,
        y: center.y
      },

      confidence,

      angles: {
        leftKnee:
          data.leftKnee,
        rightKnee:
          data.rightKnee,

        leftHip:
          data.leftHip,
        rightHip:
          data.rightHip,

        leftAnkle:
          data.leftAnkle,
        rightAnkle:
          data.rightAnkle
      }

    };


    /*
     * 메모리 사용량을 줄이기 위해
     * 최대 3000 프레임만 유지
     */

    APP.frames[type].push(
      frameData
    );


    if (
      APP.frames[type].length >
      3000
    ) {

      APP.frames[type].shift();

    }

  }
}


/* =========================================================
   14. PERSON TRACKING
========================================================= */

function calculateBodyCenter(
  landmarks
) {

  const points = [

    landmarks[LM.LEFT_SHOULDER],

    landmarks[LM.RIGHT_SHOULDER],

    landmarks[LM.LEFT_HIP],

    landmarks[LM.RIGHT_HIP]

  ].filter(Boolean);


  if (!points.length) {

    return {
      x: .5,
      y: .5
    };

  }


  const x =
    points.reduce(
      (sum, p) =>
        sum + p.x,
      0
    ) /
    points.length;


  const y =
    points.reduce(
      (sum, p) =>
        sum + p.y,
      0
    ) /
    points.length;


  return {
    x,
    y
  };
}


function calculatePoseConfidence(
  landmarks
) {

  const important = [

    LM.NOSE,

    LM.LEFT_SHOULDER,
    LM.RIGHT_SHOULDER,

    LM.LEFT_ELBOW,
    LM.RIGHT_ELBOW,

    LM.LEFT_WRIST,
    LM.RIGHT_WRIST,

    LM.LEFT_HIP,
    LM.RIGHT_HIP,

    LM.LEFT_KNEE,
    LM.RIGHT_KNEE,

    LM.LEFT_ANKLE,
    LM.RIGHT_ANKLE

  ];


  let sum = 0;

  let count = 0;


  important.forEach(
    index => {

      const p =
        landmarks[index];

      if (!p) return;


      const visibility =
        p.visibility == null
          ? 1
          : p.visibility;


      sum += visibility;

      count++;

    }
  );


  return count
    ? sum / count
    : 0;
}


function distance2D(a, b) {

  if (!a || !b) {

    return Infinity;
  }


  const dx =
    a.x - b.x;

  const dy =
    a.y - b.y;


  return Math.sqrt(
    dx * dx +
    dy * dy
  );
}


function updatePersonTracking(
  center,
  confidence
) {

  if (
    !APP.tracking.lastCenter
  ) {

    APP.tracking.lastCenter =
      center;

    return true;
  }


  const distance =
    distance2D(
      center,
      APP.tracking.lastCenter
    );


  /*
   * 한 프레임에서 사람이
   * 갑자기 화면의 먼 곳으로 이동하면
   * 잘못된 인식일 가능성이 높다.
   *
   * 단, 빠른 움직임을 고려해
   * 너무 엄격하게 잡지 않는다.
   */

  const maxJump =
    0.23;


  if (
    distance >
    maxJump &&
    confidence <
      0.75
  ) {

    return false;
  }


  const s =
    APP.settings.smoothing;


  APP.tracking.lastCenter = {

    x:
      APP.tracking.lastCenter.x * s +
      center.x * (1 - s),

    y:
      APP.tracking.lastCenter.y * s +
      center.y * (1 - s)

  };


  return true;
}


function handleTrackingLost(type) {

  APP.tracking.lostFrames++;


  if (
    APP.tracking.lostFrames >
    APP.tracking.maxLostFrames
  ) {

    drawTrackingWarning(
      type
    );

  }
}


function drawTrackingWarning(type) {

  const canvas =
    APP.canvases[type];

  if (!canvas) return;


  const ctx =
    canvas.getContext(
      "2d"
    );


  const rect =
    canvas.getBoundingClientRect();


  ctx.save();

  ctx.font =
    "600 14px sans-serif";

  ctx.textAlign =
    "center";

  ctx.fillStyle =
    "rgba(255,220,150,.95)";

  ctx.fillText(
    "선수 인식 대기 중",
    rect.width / 2,
    32
  );

  ctx.restore();
}


/* =========================================================
   15. POSE DRAWING
========================================================= */

function drawPose(
  type,
  landmarks
) {

  const canvas =
    APP.canvases[type];

  const video =
    APP.videos[type];


  if (
    !canvas ||
    !video
  ) {
    return;
  }


  const rect =
    video.getBoundingClientRect();


  const width =
    rect.width;

  const height =
    rect.height;


  const ctx =
    canvas.getContext(
      "2d"
    );


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  /*
   * 영상이 contain 방식이기 때문에
   * 실제 영상 영역을 계산한다.
   */

  const sourceRatio =
    video.videoWidth /
    video.videoHeight;


  const boxRatio =
    width / height;


  let drawW =
    width;

  let drawH =
    height;

  let offsetX =
    0;

  let offsetY =
    0;


  if (
    sourceRatio >
    boxRatio
  ) {

    drawH =
      width /
      sourceRatio;

    offsetY =
      (height - drawH) / 2;

  } else {

    drawW =
      height *
      sourceRatio;

    offsetX =
      (width - drawW) / 2;

  }


  function point(index) {

    const p =
      landmarks[index];

    if (!p) return null;


    return {

      x:
        offsetX +
        p.x * drawW,

      y:
        offsetY +
        p.y * drawH

    };

  }


  const connections = [

    [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],

    [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],

    [LM.LEFT_ELBOW, LM.LEFT_WRIST],

    [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],

    [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],

    [LM.LEFT_SHOULDER, LM.LEFT_HIP],

    [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],

    [LM.LEFT_HIP, LM.RIGHT_HIP],

    [LM.LEFT_HIP, LM.LEFT_KNEE],

    [LM.LEFT_KNEE, LM.LEFT_ANKLE],

    [LM.RIGHT_HIP, LM.RIGHT_KNEE],

    [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],

    [LM.LEFT_ANKLE, LM.LEFT_FOOT_INDEX],

    [LM.RIGHT_ANKLE, LM.RIGHT_FOOT_INDEX],

    [LM.LEFT_ANKLE, LM.LEFT_HEEL],

    [LM.RIGHT_ANKLE, LM.RIGHT_HEEL]

  ];


  ctx.save();

  ctx.lineWidth =
    2.2;

  ctx.lineCap =
    "round";

  ctx.strokeStyle =
    "rgba(160,215,235,.9)";


  connections.forEach(
    pair => {

      const a =
        point(pair[0]);

      const b =
        point(pair[1]);


      if (!a || !b) {
        return;
      }


      ctx.beginPath();

      ctx.moveTo(
        a.x,
        a.y
      );

      ctx.lineTo(
        b.x,
        b.y
      );

      ctx.stroke();

    }
  );


  /*
   * 관절 포인트
   */

  landmarks.forEach(
    (p, index) => {

      if (!p) return;


      const visibility =
        p.visibility == null
          ? 1
          : p.visibility;


      if (
        visibility <
        0.35
      ) {
        return;
      }


      const q =
        point(index);


      if (!q) return;


      ctx.beginPath();

      ctx.arc(
        q.x,
        q.y,
        3.2,
        0,
        Math.PI * 2
      );


      ctx.fillStyle =
        "rgba(235,250,255,.95)";

      ctx.fill();

    }
  );


  ctx.restore();


  /*
   * 중심점
   */

  const center =
    calculateBodyCenter(
      landmarks
    );


  const cx =
    offsetX +
    center.x * drawW;

  const cy =
    offsetY +
    center.y * drawH;


  ctx.save();

  ctx.beginPath();

  ctx.arc(
    cx,
    cy,
    5,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    "rgba(255,255,255,.95)";

  ctx.fill();

  ctx.restore();
}


/* =========================================================
   16. ANGLE CALCULATION
========================================================= */

function angle(
  a,
  b,
  c
) {

  if (
    !a ||
    !b ||
    !c
  ) {

    return 0;
  }


  const ba = {

    x: a.x - b.x,

    y: a.y - b.y

  };


  const bc = {

    x: c.x - b.x,

    y: c.y - b.y

  };


  const dot =
    ba.x * bc.x +
    ba.y * bc.y;


  const magA =
    Math.sqrt(
      ba.x ** 2 +
      ba.y ** 2
    );


  const magB =
    Math.sqrt(
      bc.x ** 2 +
      bc.y ** 2
    );


  if (
    magA === 0 ||
    magB === 0
  ) {

    return 0;
  }


  let cosine =
    dot /
    (magA * magB);


  cosine =
    clamp(
      cosine,
      -1,
      1
    );


  return (
    Math.acos(
      cosine
    ) *
    180 /
    Math.PI
  );
}


function calculatePoseData(
  landmarks
) {

  return {

    leftKnee:
      angle(
        landmarks[LM.LEFT_HIP],
        landmarks[LM.LEFT_KNEE],
        landmarks[LM.LEFT_ANKLE]
      ),

    rightKnee:
      angle(
        landmarks[LM.RIGHT_HIP],
        landmarks[LM.RIGHT_KNEE],
        landmarks[LM.RIGHT_ANKLE]
      ),

    leftHip:
      angle(
        landmarks[LM.LEFT_SHOULDER],
        landmarks[LM.LEFT_HIP],
        landmarks[LM.LEFT_KNEE]
      ),

    rightHip:
      angle(
        landmarks[LM.RIGHT_SHOULDER],
        landmarks[LM.RIGHT_HIP],
        landmarks[LM.RIGHT_KNEE]
      ),

    leftAnkle:
      angle(
        landmarks[LM.LEFT_KNEE],
        landmarks[LM.LEFT_ANKLE],
        landmarks[LM.LEFT_FOOT_INDEX]
      ),

    rightAnkle:
      angle(
        landmarks[LM.RIGHT_KNEE],
        landmarks[LM.RIGHT_ANKLE],
        landmarks[LM.RIGHT_FOOT_INDEX]
      ),

    leftElbow:
      angle(
        landmarks[LM.LEFT_SHOULDER],
        landmarks[LM.LEFT_ELBOW],
        landmarks[LM.LEFT_WRIST]
      ),

    rightElbow:
      angle(
        landmarks[LM.RIGHT_SHOULDER],
        landmarks[LM.RIGHT_ELBOW],
        landmarks[LM.RIGHT_WRIST]
      ),

    shoulder:
      angle(
        landmarks[LM.LEFT_SHOULDER],
        landmarks[LM.RIGHT_SHOULDER],
        landmarks[LM.RIGHT_HIP]
      )

  };
}


/* =========================================================
   17. METRIC FUNCTIONS
========================================================= */

function symmetryScore(
  left,
  right
) {

  if (
    !left ||
    !right
  ) {
    return 0;
  }


  const difference =
    Math.abs(
      left - right
    );


  return clamp(
    100 -
    difference * 1.7,
    0,
    100
  );
}


function stabilityScore(
  history
) {

  if (
    history.length < 3
  ) {
    return 0;
  }


  const points =
    history.slice(
      -60
    );


  const xs =
    points.map(
      p => p.x
    );


  const ys =
    points.map(
      p => p.y
    );


  const avgX =
    xs.reduce(
      (a,b) => a+b,
      0
    ) /
    xs.length;


  const avgY =
    ys.reduce(
      (a,b) => a+b,
      0
    ) /
    ys.length;


  let variance =
    0;


  for (
    let i = 0;
    i < xs.length;
    i++
  ) {

    variance +=
      Math.pow(
        xs[i] - avgX,
        2
      );

    variance +=
      Math.pow(
        ys[i] - avgY,
        2
      );

  }


  variance /=
    xs.length;


  return clamp(
    100 -
    variance * 9000,
    0,
    100
  );
}


function consistencyScore(
  values
) {

  if (
    values.length < 4
  ) {
    return 0;
  }


  const arr =
    values.slice(
      -60
    );


  const avg =
    arr.reduce(
      (a,b) => a+b,
      0
    ) /
    arr.length;


  const variance =
    arr.reduce(
      (sum, value) =>
        sum +
        Math.pow(
          value - avg,
          2
        ),
      0
    ) /
    arr.length;


  const sd =
    Math.sqrt(
      variance
    );


  return clamp(
    100 -
    sd * 2.1,
    0,
    100
  );
}


function overallScore(
  values
) {

  const valid =
    values.filter(
      Number.isFinite
    );


  if (!valid.length) {
    return 0;
  }


  return Math.round(
    valid.reduce(
      (a,b) => a+b,
      0
    ) /
    valid.length
  );
}


/* =========================================================
   18. SKI ANALYSIS
========================================================= */

function analyzeSki(
  data,
  center
) {

  const history =
    APP.trajectory.ski;


  history.push({
    x: center.x,
    y: center.y
  });


  if (
    history.length >
    APP.settings.trajectoryMax
  ) {

    history.shift();

  }


  const symmetry =
    symmetryScore(
      data.leftKnee,
      data.rightKnee
    );


  const stability =
    stabilityScore(
      history
    );


  const consistency =
    consistencyScore(
      [
        data.leftKnee,
        data.rightKnee
      ]
    );


  const cycle =
    estimateCycle(
      "ski"
    );


  APP.metrics.ski = {

    symmetry:
      round(symmetry),

    stability:
      round(stability),

    consistency:
      round(consistency),

    cycle:
      cycle

  };


  updateMetricsUI(
    "ski"
  );


  drawTrajectory(
    "ski",
    history
  );


  updateSkiChart(
    data
  );
}


function estimateCycle(type) {

  const frames =
    APP.frames[type];


  if (
    frames.length < 10
  ) {
    return "-";
  }


  const duration =
    frames[
      frames.length - 1
    ].time -
    frames[0].time;


  if (
    duration <= 0
  ) {
    return "-";
  }


  /*
   * 기본적으로 한 사이클을
   * 약 2개의 좌우 동작으로 계산하는
   * 간단한 추정치.
   */

  const cycles =
    Math.max(
      1,
      Math.floor(
        frames.length / 30
      )
    );


  return round(
    duration / cycles,
    2
  ) + "s";
}


/* =========================================================
   19. ROLLER SKI ANALYSIS
========================================================= */

function analyzeRoller(
  data,
  center
) {

  const history =
    APP.trajectory.roller;


  history.push({
    x: center.x,
    y: center.y
  });


  if (
    history.length >
    APP.settings.trajectoryMax
  ) {

    history.shift();

  }


  const symmetry =
    symmetryScore(
      data.leftKnee,
      data.rightKnee
    );


  const stability =
    stabilityScore(
      history
    );


  const consistency =
    consistencyScore(
      [
        data.leftHip,
        data.rightHip,
        data.leftKnee,
        data.rightKnee
      ]
    );


  const push =
    estimatePushOff(
      data
    );


  const cadence =
    estimateCadence(
      "roller"
    );


  APP.metrics.roller = {

    symmetry:
      round(symmetry),

    stability:
      round(stability),

    consistency:
      round(consistency),

    cadence:
      cadence,

    leftPush:
      round(push.left),

    rightPush:
      round(push.right)

  };


  updateMetricsUI(
    "roller"
  );


  drawTrajectory(
    "roller",
    history
  );


  updateRollerChart(
    data
  );
}


function estimatePushOff(
  data
) {

  /*
   * 무릎 굴곡 정도를
   * 푸시오프 움직임의 간단한 지표로 사용.
   *
   * 실제 힘/지면반력 측정값이 아니라
   * 영상 기반 상대지표임.
   */

  const left =
    clamp(
      180 -
      data.leftKnee,
      0,
      180
    );


  const right =
    clamp(
      180 -
      data.rightKnee,
      0,
      180
    );


  return {

    left:
      clamp(
        50 +
        left * .3,
        0,
        100
      ),

    right:
      clamp(
        50 +
        right * .3,
        0,
        100
      )

  };
}


function estimateCadence(type) {

  const frames =
    APP.frames[type];


  if (
    frames.length < 20
  ) {
    return "-";
  }


  const first =
    frames[0].time;


  const last =
    frames[
      frames.length - 1
    ].time;


  const duration =
    last - first;


  if (
    duration <= 0
  ) {
    return "-";
  }


  /*
   * 프레임 기반 단순 추정.
   * 이후 실제 발목/발끝 이벤트 검출로
   * 교체할 수 있도록 분리해 둠.
   */

  const movements =
    Math.max(
      1,
      Math.floor(
        frames.length / 12
      )
    );


  return round(
    movements /
    duration *
    60,
    1
  );
}


/* =========================================================
   20. SHOOTING ANALYSIS
========================================================= */

function analyzeShooting(
  data,
  center
) {

  const history =
    APP.trajectory.shooting;


  history.push({
    x: center.x,
    y: center.y
  });


  if (
    history.length >
    APP.settings.trajectoryMax
  ) {

    history.shift();

  }


  const symmetry =
    symmetryScore(
      data.leftElbow,
      data.rightElbow
    );


  const stability =
    stabilityScore(
      history
    );


  const consistency =
    consistencyScore(
      [
        data.leftElbow,
        data.rightElbow,
        data.leftShoulder ||
          data.shoulder
      ]
    );


  const posture =
    calculateShootingPosture(
      data
    );


  APP.metrics.shooting = {

    symmetry:
      round(symmetry),

    stability:
      round(stability),

    consistency:
      round(consistency),

    posture:
      round(posture)

  };


  updateMetricsUI(
    "shooting"
  );


  drawTrajectory(
    "shooting",
    history
  );


  /*
   * 총구 추적
   */

  trackMuzzle(
    center
  );


  updateShootingCharts(
    data
  );
}


function calculateShootingPosture(
  data
) {

  /*
   * 엎드린 자세에서는
   * 팔꿈치 / 무릎 / 골반의
   * 안정성을 함께 보는 상대점수.
   */

  const elbow =
    symmetryScore(
      data.leftElbow,
      data.rightElbow
    );


  const knee =
    symmetryScore(
      data.leftKnee,
      data.rightKnee
    );


  return (
    elbow * .45 +
    knee * .25 +
    30
  );
}


/* =========================================================
   21. MUZZLE TRACKING
========================================================= */

function trackMuzzle(
  center
) {

  /*
   * 기준점이 사용자가 지정되어 있지 않으면
   * 자동으로 총구를 추정하지 않는다.
   *
   * 사용자가 현재 프레임에서
   * 총구 기준점을 찍으면
   * 이후 영상 좌표의 움직임을 기록한다.
   */

  if (
    !APP.shooting.muzzlePoint
  ) {
    return;
  }


  const point =
    getCurrentMuzzlePosition();


  if (!point) {
    return;
  }


  const video =
    APP.videos.shooting;


  APP.shooting.muzzleHistory.push({

    time:
      video?.currentTime || 0,

    x:
      point.x,

    y:
      point.y

  });


  if (
    APP.shooting.muzzleHistory.length >
    1500
  ) {

    APP.shooting.muzzleHistory.shift();

  }


  drawMuzzleTrajectory();
}


/*
 * 사용자가 지정한 총구 기준점은
 * 화면상의 상대좌표로 저장한다.
 *
 * 기본적으로 기준점을 지정한 프레임 이후
 * 동일 위치를 유지하지 않고,
 * 사용자가 프레임별로 다시 찍을 수도 있다.
 *
 * 자동 추적이 가능한 환경에서는
 * 후속 버전에서 특징점 추적을 연결할 수 있다.
 */

function getCurrentMuzzlePosition() {

  const point =
    APP.shooting.muzzlePoint;


  if (!point) {
    return null;
  }


  return {

    x: point.x,

    y: point.y

  };
}


/* =========================================================
   22. MUZZLE CANVAS CLICK
========================================================= */

function setupMuzzleSelection() {

  const canvas =
    APP.canvases.muzzle;


  if (!canvas) return;


  canvas.style.pointerEvents =
    "auto";


  canvas.addEventListener(
    "click",
    event => {

      if (
        APP.currentPage !==
        "shooting"
      ) {
        return;
      }


      const rect =
        canvas.getBoundingClientRect();


      const x =
        (
          event.clientX -
          rect.left
        ) /
        rect.width;


      const y =
        (
          event.clientY -
          rect.top
        ) /
        rect.height;


      APP.shooting.muzzlePoint = {

        x,

        y

      };


      updateMuzzleStatus();

      drawMuzzleMarker();


      toast(
        "현재 위치를 총구 기준점으로 지정했습니다."
      );

    }
  );
}


function drawMuzzleMarker() {

  const canvas =
    APP.canvases.muzzle;

  const point =
    APP.shooting.muzzlePoint;


  if (
    !canvas ||
    !point
  ) {
    return;
  }


  const ctx =
    canvas.getContext(
      "2d"
    );


  const rect =
    canvas.getBoundingClientRect();


  ctx.clearRect(
    0,
    0,
    rect.width,
    rect.height
  );


  const x =
    point.x *
    rect.width;

  const y =
    point.y *
    rect.height;


  ctx.save();

  ctx.strokeStyle =
    "rgba(255,220,120,.95)";

  ctx.lineWidth =
    2;


  ctx.beginPath();

  ctx.arc(
    x,
    y,
    8,
    0,
    Math.PI * 2
  );

  ctx.stroke();


  ctx.beginPath();

  ctx.moveTo(
    x - 14,
    y
  );

  ctx.lineTo(
    x + 14,
    y
  );

  ctx.moveTo(
    x,
    y - 14
  );

  ctx.lineTo(
    x,
    y + 14
  );

  ctx.stroke();


  ctx.restore();
}


function drawMuzzleTrajectory() {

  const canvas =
    APP.canvases.muzzle;

  if (!canvas) return;


  const ctx =
    canvas.getContext(
      "2d"
    );


  const rect =
    canvas.getBoundingClientRect();


  ctx.clearRect(
    0,
    0,
    rect.width,
    rect.height
  );


  const history =
    APP.shooting.muzzleHistory;


  if (
    history.length < 2
  ) {

    drawMuzzleMarker();

    return;
  }


  ctx.save();

  ctx.strokeStyle =
    "rgba(125,210,235,.9)";

  ctx.lineWidth =
    2;

  ctx.lineJoin =
    "round";

  ctx.lineCap =
    "round";


  ctx.beginPath();


  history.forEach(
    (point, index) => {

      const x =
        point.x *
        rect.width;

      const y =
        point.y *
        rect.height;


      if (index === 0) {

        ctx.moveTo(
          x,
          y
        );

      } else {

        ctx.lineTo(
          x,
          y
        );

      }

    }
  );


  ctx.stroke();

  ctx.restore();


  drawMuzzleMarker();
}


/* =========================================================
   23. SHOOTING EVENT
========================================================= */

function markShotEvent() {

  const video =
    APP.videos.shooting;


  if (
    !video ||
    !video.src
  ) {

    toast(
      "먼저 사격 영상을 선택하세요."
    );

    return;
  }


  if (
    APP.shooting.shotEvents.length >=
    APP.shooting.maxShots
  ) {

    toast(
      "최대 5개의 격발 이벤트를 지정할 수 있습니다."
    );

    return;
  }


  const event = {

    id:
      cryptoRandomId(),

    index:
      APP.shooting.shotEvents.length + 1,

    time:
      video.currentTime,

    frame:
      Math.round(
        video.currentTime * 60
      ),

    confidence:
      APP.tracking.confidence,

    createdAt:
      nowISO()

  };


  APP.shooting.shotEvents.push(
    event
  );


  APP.shooting.shotEvents.sort(
    (a,b) =>
      a.time -
      b.time
  );


  APP.shooting.shotEvents.forEach(
    (item, index) => {

      item.index =
        index + 1;

    }
  );


  renderShotEvents();

  updateShotMarkers();

  toast(
    `${event.index}번 격발 이벤트를 지정했습니다.`
  );
}


function renderShotEvents() {

  const container =
    $("#shotEvents");

  const count =
    $("#shotCount");


  if (!container) return;


  if (count) {

    count.textContent =
      `${APP.shooting.shotEvents.length} / 5`;

  }


  if (
    !APP.shooting.shotEvents.length
  ) {

    container.innerHTML = `
      <div class="empty">
        지정된 이벤트가 없습니다.
      </div>
    `;

    return;
  }


  container.innerHTML =
    APP.shooting.shotEvents
      .map(
        event => `

          <div
            class="shot-event"
            data-shot-id="${event.id}"
          >

            <div>

              <b>
                격발 ${event.index}
              </b>

              <span>
                ${formatTime(event.time)}
              </span>

            </div>

            <button
              type="button"
              data-delete-shot="${event.id}"
            >
              삭제
            </button>

          </div>

        `
      )
      .join("");


  $all(
    "[data-delete-shot]"
  ).forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          deleteShotEvent(
            button.dataset.deleteShot
          );

        }
      );

    }
  );
}


function deleteShotEvent(id) {

  APP.shooting.shotEvents =
    APP.shooting.shotEvents.filter(
      item =>
        item.id !== id
    );


  APP.shooting.shotEvents.forEach(
    (item, index) => {

      item.index =
        index + 1;

    }
  );


  renderShotEvents();

  updateShotMarkers();
}


function clearShotEvents() {

  APP.shooting.shotEvents =
    [];

  APP.shooting.muzzleHistory =
    [];

  APP.shooting.muzzlePoint =
    null;


  renderShotEvents();

  updateMuzzleStatus();

  clearMuzzleCanvas();

  toast(
    "사격 이벤트와 총구 궤적을 초기화했습니다."
  );
}


function updateShotMarkers() {

  /*
   * 현재 UI에는 간단한 이벤트 표시만 하고,
   * 실제 차트의 수직선은 Chart.js 플러그인 없이
   * 별도의 데이터셋으로 처리할 수 있도록
   * updateShootingCharts에서 반영한다.
   */

  updateShootingCharts();
}


/* =========================================================
   24. MUZZLE STATUS
========================================================= */

function updateMuzzleStatus() {

  const el =
    $("#muzzleStatus");


  if (!el) return;


  const point =
    APP.shooting.muzzlePoint;


  if (!point) {

    el.textContent =
      "기준점이 지정되지 않았습니다.";

    return;
  }


  el.textContent =
    `총구 기준점 지정됨 · X ${round(point.x * 100, 1)}% · Y ${round(point.y * 100, 1)}%`;
}


function clearMuzzleCanvas() {

  const canvas =
    APP.canvases.muzzle;

  if (!canvas) return;


  const rect =
    canvas.getBoundingClientRect();


  canvas
    .getContext("2d")
    .clearRect(
      0,
      0,
      rect.width,
      rect.height
    );
}


/* =========================================================
   25. TRAJECTORY DRAW
========================================================= */

function drawTrajectory(
  type,
  history
) {

  const id =
    `${type}Trajectory`;


  const canvas =
    $(`#${id}`);


  if (!canvas) return;


  const rect =
    canvas.getBoundingClientRect();


  if (
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return;
  }


  const ctx =
    canvas.getContext(
      "2d"
    );


  ctx.clearRect(
    0,
    0,
    rect.width,
    rect.height
  );


  if (
    history.length < 2
  ) {
    return;
  }


  ctx.save();

  ctx.strokeStyle =
    "#5c9ab3";

  ctx.lineWidth =
    2.2;

  ctx.lineJoin =
    "round";

  ctx.lineCap =
    "round";


  ctx.beginPath();


  history.forEach(
    (p, index) => {

      const x =
        p.x *
        rect.width;

      const y =
        p.y *
        rect.height;


      if (index === 0) {

        ctx.moveTo(
          x,
          y
        );

      } else {

        ctx.lineTo(
          x,
          y
        );

      }

    }
  );


  ctx.stroke();


  /*
   * 현재 위치
   */

  const last =
    history[
      history.length - 1
    ];


  if (last) {

    ctx.beginPath();

    ctx.arc(
      last.x * rect.width,
      last.y * rect.height,
      5,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      "#173c50";

    ctx.fill();

  }


  ctx.restore();
}


/* =========================================================
   26. METRICS UI
========================================================= */

function updateMetricsUI(type) {

  const container =
    $(`#${type}Metrics`);


  if (!container) return;


  const metrics =
    APP.metrics[type];


  const strongs =
    container.querySelectorAll(
      ".metric strong"
    );


  if (type === "ski") {

    setMetric(
      strongs[0],
      metrics.symmetry,
      ""
    );

    setMetric(
      strongs[1],
      metrics.stability,
      ""
    );

    setMetric(
      strongs[2],
      metrics.consistency,
      ""
    );

    setMetric(
      strongs[3],
      metrics.cycle,
      ""
    );

  }


  if (type === "roller") {

    setMetric(
      strongs[0],
      metrics.symmetry,
      ""
    );

    setMetric(
      strongs[1],
      metrics.stability,
      ""
    );

    setMetric(
      strongs[2],
      metrics.consistency,
      ""
    );

    setMetric(
      strongs[3],
      metrics.cadence,
      metrics.cadence === "-"
        ? ""
        : " spm"
    );

    setMetric(
      strongs[4],
      metrics.leftPush,
      ""
    );

    setMetric(
      strongs[5],
      metrics.rightPush,
      ""
    );

  }


  if (type === "shooting") {

    setMetric(
      strongs[0],
      metrics.symmetry,
      ""
    );

    setMetric(
      strongs[1],
      metrics.stability,
      ""
    );

    setMetric(
      strongs[2],
      metrics.consistency,
      ""
    );

    setMetric(
      strongs[3],
      metrics.posture,
      ""
    );

  }
}


function setMetric(
  element,
  value,
  suffix
) {

  if (!element) return;


  if (
    value === "-" ||
    value == null
  ) {

    element.textContent =
      "-";

    return;
  }


  element.textContent =
    `${value}${suffix}`;
}


/* =========================================================
   27. CHART HELPERS
========================================================= */

function destroyChart(key) {

  if (
    APP.charts[key]
  ) {

    APP.charts[key].destroy();

    APP.charts[key] =
      null;
  }
}


function chartBaseOptions() {

  return {

    responsive: true,

    maintainAspectRatio: false,

    animation: false,

    interaction: {
      intersect: false,
      mode: "index"
    },

    plugins: {

      legend: {
        position: "top"
      }

    },

    scales: {

      x: {

        ticks: {
          maxTicksLimit: 8
        }

      },

      y: {

        min: 0,

        max: 180

      }

    }

  };
}


/* =========================================================
   28. SKI CHART
========================================================= */

function updateSkiChart(
  data
) {

  const canvas =
    $("#skiChart");

  if (!canvas) return;


  const frames =
    APP.frames.ski.slice(
      -80
    );


  const labels =
    frames.map(
      f =>
        f.time.toFixed(2)
    );


  const left =
    frames.map(
      f =>
        f.angles.leftKnee
    );


  const right =
    frames.map(
      f =>
        f.angles.rightKnee
    );


  destroyChart(
    "ski"
  );


  if (
    typeof Chart ===
    "undefined"
  ) {
    return;
  }


  APP.charts.ski =
    new Chart(
      canvas,
      {

        type: "line",

        data: {

          labels,

          datasets: [

            {
              label: "좌측 무릎",
              data: left,
              tension: .25,
              pointRadius: 0
            },

            {
              label: "우측 무릎",
              data: right,
              tension: .25,
              pointRadius: 0
            }

          ]

        },

        options:
          chartBaseOptions()

      }
    );
}


/* =========================================================
   29. ROLLER CHART
========================================================= */

function updateRollerChart(
  data
) {

  const canvas =
    $("#rollerChart");

  if (!canvas) return;


  const frames =
    APP.frames.roller.slice(
      -80
    );


  const labels =
    frames.map(
      f =>
        f.time.toFixed(2)
    );


  const left =
    frames.map(
      f =>
        f.angles.leftKnee
    );


  const right =
    frames.map(
      f =>
        f.angles.rightKnee
    );


  destroyChart(
    "roller"
  );


  if (
    typeof Chart ===
    "undefined"
  ) {
    return;
  }


  APP.charts.roller =
    new Chart(
      canvas,
      {

        type: "line",

        data: {

          labels,

          datasets: [

            {
              label: "좌측 무릎",
              data: left,
              tension: .2,
              pointRadius: 0
            },

            {
              label: "우측 무릎",
              data: right,
              tension: .2,
              pointRadius: 0
            }

          ]

        },

        options:
          chartBaseOptions()

      }
    );
}


/* =========================================================
   30. SHOOTING CHARTS
========================================================= */

function updateShootingCharts(
  data = null
) {

  updateShootingJointChart();

  updateMuzzleChart();
}


function updateShootingJointChart() {

  const canvas =
    $("#shootingChart");

  if (!canvas) return;


  const frames =
    APP.frames.shooting.slice(
      -100
    );


  const labels =
    frames.map(
      f =>
        f.time.toFixed(2)
    );


  const left =
    frames.map(
      f =>
        f.angles.leftKnee
    );


  const right =
    frames.map(
      f =>
        f.angles.rightKnee
    );


  destroyChart(
    "shootingJoint"
  );


  if (
    typeof Chart ===
    "undefined"
  ) {
    return;
  }


  APP.charts.shootingJoint =
    new Chart(
      canvas,
      {

        type: "line",

        data: {

          labels,

          datasets: [

            {
              label: "좌측 무릎",
              data: left,
              tension: .2,
              pointRadius: 0
            },

            {
              label: "우측 무릎",
              data: right,
              tension: .2,
              pointRadius: 0
            }

          ]

        },

        options:
          chartBaseOptions()

      }
    );
}


function updateMuzzleChart() {

  const canvas =
    $("#shootingMuzzleChart");

  if (!canvas) return;


  const history =
    APP.shooting.muzzleHistory.slice(
      -150
    );


  const labels =
    history.map(
      p =>
        p.time.toFixed(2)
    );


  const xs =
    history.map(
      p =>
        p.x * 100
    );


  const ys =
    history.map(
      p =>
        p.y * 100
    );


  destroyChart(
    "muzzle"
  );


  if (
    typeof Chart ===
    "undefined"
  ) {
    return;
  }


  APP.charts.muzzle =
    new Chart(
      canvas,
      {

        type: "line",

        data: {

          labels,

          datasets: [

            {
              label: "총구 X",
              data: xs,
              tension: .2,
              pointRadius: 0
            },

            {
              label: "총구 Y",
              data: ys,
              tension: .2,
              pointRadius: 0
            }

          ]

        },

        options: {

          ...chartBaseOptions(),

          scales: {

            x: {
              ticks: {
                maxTicksLimit: 8
              }
            },

            y: {
              min: 0,
              max: 100
            }

          }

        }

      }
    );
}


/* =========================================================
   31. BUTTONS / CAMERA
========================================================= */

function setupCameraButtons() {

  $all(
    ".camera-button"
  ).forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const parent =
            button.closest(
              ".analysis-main"
            );


          let type =
            null;


          if (
            parent?.querySelector(
              "#skiVideo"
            )
          ) {

            type = "ski";

          } else if (
            parent?.querySelector(
              "#rollerVideo"
            )
          ) {

            type = "roller";

          } else if (
            parent?.querySelector(
              "#shootingVideo"
            )
          ) {

            type = "shooting";

          }


          if (!type) return;


          const camera =
            button.dataset.camera;


          APP.currentCamera[type] =
            camera;


          parent
            .querySelectorAll(
              ".camera-button"
            )
            .forEach(
              btn =>
                btn.classList.toggle(
                  "active",
                  btn === button
                )
            );


          toast(
            `${typeName(type)} 카메라: ${cameraName(camera)}`
          );

        }
      );

    }
  );
}


function cameraName(camera) {

  return {

    side: "측면",

    front: "정면",

    rear: "후면"

  }[camera] || camera;
}


/* =========================================================
   32. ANALYSIS TOOLS
========================================================= */

function setupToolButtons() {

  $all(
    "[data-tool]"
  ).forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const tool =
            button.dataset.tool;

          const type =
            button.dataset.type;


          if (
            tool === "bookmark"
          ) {

            bookmarkFrame(
              type
            );

          }


          if (
            tool === "capture"
          ) {

            capturePose(
              type
            );

          }


          if (
            tool === "cycle"
          ) {

            toast(
              `${typeName(type)} 사이클 구간 분석을 업데이트했습니다.`
            );

          }


          if (
            tool === "push"
          ) {

            toast(
              "푸시오프 분석 데이터를 업데이트했습니다."
            );

          }

        }
      );

    }
  );
}


function bookmarkFrame(type) {

  const video =
    APP.videos[type];

  if (
    !video ||
    !video.src
  ) {

    toast(
      "먼저 영상을 선택하세요."
    );

    return;
  }


  const record = {

    time:
      video.currentTime,

    label:
      `구간 북마크 ${formatTime(video.currentTime)}`

  };


  if (
    !APP.bookmarks
  ) {

    APP.bookmarks = [];

  }


  APP.bookmarks.push({
    ...record,
    type
  });


  toast(
    `${formatTime(video.currentTime)} 구간을 저장했습니다.`
  );
}


function capturePose(type) {

  const video =
    APP.videos[type];

  if (
    !video ||
    !video.src
  ) {

    toast(
      "먼저 영상을 선택하세요."
    );

    return;
  }


  const canvas =
    document.createElement(
      "canvas"
    );


  const width =
    video.videoWidth || 1280;

  const height =
    video.videoHeight || 720;


  canvas.width =
    width;

  canvas.height =
    height;


  const ctx =
    canvas.getContext(
      "2d"
    );


  ctx.drawImage(
    video,
    0,
    0,
    width,
    height
  );


  const overlay =
    APP.canvases[type];


  /*
   * 실제 리포트에서는
   * 저장된 캡처 데이터를 연결할 수 있도록
   * dataURL을 메모리에 보관한다.
   */

  const image =
    canvas.toDataURL(
      "image/jpeg",
      .82
    );


  if (
    !APP.captures
  ) {

    APP.captures = {};

  }


  if (
    !APP.captures[type]
  ) {

    APP.captures[type] = [];

  }


  APP.captures[type].push({

    time:
      video.currentTime,

    image,

    createdAt:
      nowISO()

  });


  if (
    APP.captures[type].length >
    20
  ) {

    APP.captures[type].shift();

  }


  toast(
    "현재 자세를 캡처했습니다."
  );
}


/* =========================================================
   33. SHOOTING BUTTONS
========================================================= */

function setupShootingButtons() {

  $("#markShot")
    ?.addEventListener(
      "click",
      markShotEvent
    );


  $("#markMuzzle")
    ?.addEventListener(
      "click",
      () => {

        const canvas =
          APP.canvases.muzzle;


        if (!canvas) return;


        toast(
          "영상 화면에서 총구 위치를 눌러주세요."
        );

      }
    );


  $("#clearShots")
    ?.addEventListener(
      "click",
      clearShotEvents
    );
}


/* =========================================================
   34. RECORD CREATION
========================================================= */

function buildAnalysisRecord(
  type
) {

  const video =
    APP.videos[type];


  const frames =
    APP.frames[type];


  if (
    !video ||
    !video.src ||
    frames.length < 2
  ) {

    return null;
  }


  const metrics =
    {
      ...APP.metrics[type]
    };


  const score =
    calculateOverallTypeScore(
      type,
      metrics
    );


  const record = {

    id:
      cryptoRandomId(),

    type,

    typeName:
      typeName(type),

    athlete:
      {
        ...APP.athlete
      },

    date:
      nowISO(),

    dateText:
      formatDate(),

    camera:
      APP.currentCamera[type],

    score,

    metrics,

    duration:
      video.duration || 0,

    analyzedDuration:
      frames[
        frames.length - 1
      ].time -
      frames[0].time,

    confidence:
      round(
        APP.tracking.confidence * 100
      ),

    frameCount:
      frames.length,

    trajectory:
      APP.trajectory[type]
        .slice(-300)
        .map(
          p => ({
            x: round(p.x, 4),
            y: round(p.y, 4)
          })
        ),

    frames:
      compressFrames(
        frames
      ),

    bookmarks:
      (
        APP.bookmarks || []
      )
        .filter(
          b =>
            b.type === type
        ),

    captures:
      (
        APP.captures?.[type] ||
        []
      ).slice(-6)

  };


  if (
    type === "shooting"
  ) {

    record.shooting = {

      shotEvents:
        APP.shooting.shotEvents
          .map(
            event => ({
              ...event
            })
          ),

      muzzlePoint:
        APP.shooting.muzzlePoint
          ? {
              ...APP.shooting.muzzlePoint
            }
          : null,

      muzzleHistory:
        APP.shooting.muzzleHistory
          .slice(-400)
          .map(
            point => ({
              time:
                round(
                  point.time,
                  3
                ),

              x:
                round(
                  point.x,
                  4
                ),

              y:
                round(
                  point.y,
                  4
                )
            })
          )

    };

  }


  return record;
}


function compressFrames(
  frames
) {

  /*
   * 전체 프레임을 저장하지 않고
   * 일정 간격으로 샘플링.
   */

  const step =
    Math.max(
      1,
      Math.ceil(
        frames.length /
        350
      )
    );


  return frames
    .filter(
      (_, index) =>
        index % step === 0
    )
    .map(
      frame => ({
        time:
          round(
            frame.time,
            3
          ),

        center: {

          x:
            round(
              frame.center.x,
              4
            ),

          y:
            round(
              frame.center.y,
              4
            )

        },

        confidence:
          round(
            frame.confidence,
            3
          ),

        angles: {

          leftKnee:
            round(
              frame.angles.leftKnee
            ),

          rightKnee:
            round(
              frame.angles.rightKnee
            ),

          leftHip:
            round(
              frame.angles.leftHip
            ),

          rightHip:
            round(
              frame.angles.rightHip
            ),

          leftAnkle:
            round(
              frame.angles.leftAnkle
            ),

          rightAnkle:
            round(
              frame.angles.rightAnkle
            )

        }

      })
    );
}


function calculateOverallTypeScore(
  type,
  metrics
) {

  if (
    type === "ski"
  ) {

    return overallScore([
      metrics.symmetry,
      metrics.stability,
      metrics.consistency
    ]);

  }


  if (
    type === "roller"
  ) {

    return overallScore([
      metrics.symmetry,
      metrics.stability,
      metrics.consistency
    ]);

  }


  if (
    type === "shooting"
  ) {

    return overallScore([
      metrics.symmetry,
      metrics.stability,
      metrics.consistency,
      metrics.posture
    ]);

  }


  return 0;
}


/* =========================================================
   35. DASHBOARD
========================================================= */

function updateDashboard() {

  const records =
    getRecords();


  const recordCount =
    $("#dashRecords");

  const score =
    $("#dashScore");

  const compare =
    $("#dashCompare");


  if (recordCount) {

    recordCount.textContent =
      records.length;

  }


  if (score) {

    score.textContent =
      records.length
        ? records[0].score
        : "-";

  }


  if (compare) {

    compare.textContent =
      records.length >= 2
        ? Math.floor(
            records.length / 2
          )
        : 0;

  }


  renderRecentRecords(
    records
  );
}


function renderRecentRecords(
  records = getRecords()
) {

  const container =
    $("#recentRecords");

  if (!container) return;


  if (!records.length) {

    container.innerHTML = `
      <div class="empty">
        최근 분석 기록이 없습니다.
      </div>
    `;

    return;
  }


  container.innerHTML =
    records
      .slice(0, 5)
      .map(
        record => `

          <div class="record-item">

            <div>

              <b>
                ${escapeHTML(
                  record.typeName
                )}
              </b>

              <small>
                ${escapeHTML(
                  record.dateText
                )}
                · 점수 ${record.score}
              </small>

            </div>

            <button
              type="button"
              data-open-record="${record.id}"
            >
              보기
            </button>

          </div>

        `
      )
      .join("");


  bindOpenRecordButtons();
}


/* =========================================================
   36. RECORDS PAGE
========================================================= */

function renderRecords() {

  const container =
    $("#recordsList");

  if (!container) return;


  const records =
    getRecords();


  if (!records.length) {

    container.innerHTML = `
      <div class="empty">
        아직 분석 기록이 없습니다.
      </div>
    `;

    return;
  }


  container.innerHTML =
    records
      .map(
        record => `

          <div class="record-item">

            <div>

              <b>
                ${escapeHTML(
                  record.typeName
                )}
                · ${record.score}점
              </b>

              <small>
                ${escapeHTML(
                  record.dateText
                )}
                ·
                ${cameraName(
                  record.camera
                )}
                ·
                프레임 ${record.frameCount}
              </small>

            </div>


            <div>

              <button
                type="button"
                data-report-record="${record.id}"
              >
                리포트
              </button>

              <button
                type="button"
                data-delete-record="${record.id}"
              >
                삭제
              </button>

            </div>

          </div>

        `
      )
      .join("");


  $all(
    "[data-delete-record]"
  ).forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const id =
            button.dataset
              .deleteRecord;

          if (
            confirm(
              "이 분석 기록을 삭제할까요?"
            )
          ) {

            deleteRecord(
              id
            );

          }

        }
      );

    }
  );


  $all(
    "[data-report-record]"
  ).forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const id =
            button.dataset
              .reportRecord;

          navigate(
            "report"
          );

          const select =
            $("#reportSelect");

          if (select) {

            select.value =
              id;

            renderReport(
              id
            );

          }

        }
      );

    }
  );
}


function bindOpenRecordButtons() {

  $all(
    "[data-open-record]"
  ).forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const id =
            button.dataset
              .openRecord;

          navigate(
            "report"
          );


          const select =
            $("#reportSelect");


          if (select) {

            select.value =
              id;

            renderReport(
              id
            );

          }

        }
      );

    }
  );
}


/* =========================================================
   37. COMPARE SELECTS
========================================================= */

function populateCompareSelects() {

  const records =
    getRecords();


  const a =
    $("#compareA");

  const b =
    $("#compareB");


  if (!a || !b) return;


  const options =
    records
      .map(
        record => `

          <option value="${record.id}">
            ${escapeHTML(
              record.typeName
            )}
            ·
            ${escapeHTML(
              record.dateText
            )}
            ·
            ${record.score}점
          </option>

        `
      )
      .join("");


  a.innerHTML =
    `<option value="">분석 기록 A</option>` +
    options;


  b.innerHTML =
    `<option value="">분석 기록 B</option>` +
    options;
}


/* =========================================================
   38. COMPARISON
========================================================= */

function compareRecords() {

  const aId =
    $("#compareA")?.value;

  const bId =
    $("#compareB")?.value;


  if (
    !aId ||
    !bId
  ) {

    toast(
      "두 개의 분석 기록을 선택하세요."
    );

    return;
  }


  if (
    aId === bId
  ) {

    toast(
      "서로 다른 두 기록을 선택하세요."
    );

    return;
  }


  const records =
    getRecords();


  const A =
    records.find(
      record =>
        record.id === aId
    );


  const B =
    records.find(
      record =>
        record.id === bId
    );


  if (!A || !B) {

    toast(
      "분석 기록을 찾을 수 없습니다."
    );

    return;
  }


  renderComparison(
    A,
    B
  );
}


function renderComparison(
  A,
  B
) {

  $("#compareEmpty")
    ?.classList.add(
      "hidden"
    );


  $("#compareResult")
    ?.classList.remove(
      "hidden"
    );


  const scoreA =
    $("#scoreA");

  const scoreB =
    $("#scoreB");

  const diff =
    $("#scoreDiff");


  if (scoreA) {
    scoreA.textContent =
      A.score;
  }

  if (scoreB) {
    scoreB.textContent =
      B.score;
  }


  if (diff) {

    const difference =
      B.score -
      A.score;


    diff.textContent =
      difference > 0
        ? `+${difference}`
        : difference;

  }


  renderCompareBars(
    A,
    B
  );


  renderCompareChart(
    A,
    B
  );


  const comment =
    $("#compareComment");


  if (comment) {

    const difference =
      B.score -
      A.score;


    let text;


    if (difference > 0) {

      text =
        `<b>${escapeHTML(B.typeName)}</b> 기록이 이전 기준보다 ${Math.abs(difference)}점 높습니다. 주요 지표의 변화를 함께 확인하세요.`;

    } else if (
      difference < 0
    ) {

      text =
        `<b>${escapeHTML(B.typeName)}</b> 기록이 A 기록보다 ${Math.abs(difference)}점 낮습니다. 영상의 동일 구간을 다시 비교해보세요.`;

    } else {

      text =
        "두 기록의 종합 점수가 같습니다. 세부 지표와 영상 구간을 확인해보세요.";

    }


    comment.innerHTML =
      text;

  }
}


function renderCompareBars(
  A,
  B
) {

  const container =
    $("#compareBars");

  if (!container) return;


  const metrics = [

    [
      "대칭성",
      A.metrics.symmetry,
      B.metrics.symmetry
    ],

    [
      "중심 안정성",
      A.metrics.stability,
      B.metrics.stability
    ],

    [
      "동작 일관성",
      A.metrics.consistency,
      B.metrics.consistency
    ]

  ];


  container.innerHTML =
    metrics
      .map(
        item => `

          <div class="compare-bar">

            <div class="compare-bar-top">

              <span>
                ${item[0]}
              </span>

              <span>
                ${item[1]} → ${item[2]}
              </span>

            </div>

            <div class="bar">

              <i
                style="width:${clamp(
                  item[2],
                  0,
                  100
                )}%"
              ></i>

            </div>

          </div>

        `
      )
      .join("");
}


function renderCompareChart(
  A,
  B
) {

  const canvas =
    $("#compareChart");

  if (!canvas) return;


  destroyChart(
    "compare"
  );


  if (
    typeof Chart ===
    "undefined"
  ) {
    return;
  }


  APP.charts.compare =
    new Chart(
      canvas,
      {

        type: "bar",

        data: {

          labels: [
            "대칭성",
            "중심 안정성",
            "동작 일관성"
          ],

          datasets: [

            {
              label:
                `A · ${A.typeName}`,
              data: [
                A.metrics.symmetry,
                A.metrics.stability,
                A.metrics.consistency
              ]
            },

            {
              label:
                `B · ${B.typeName}`,
              data: [
                B.metrics.symmetry,
                B.metrics.stability,
                B.metrics.consistency
              ]
            }

          ]

        },

        options: {

          responsive: true,

          maintainAspectRatio: false,

          scales: {

            y: {

              min: 0,

              max: 100

            }

          }

        }

      }
    );
}


/* =========================================================
   39. REPORT SELECT
========================================================= */

function populateReportSelect() {

  const select =
    $("#reportSelect");

  if (!select) return;


  const records =
    getRecords();


  select.innerHTML =
    `<option value="">기록 선택</option>` +
    records
      .map(
        record => `

          <option value="${record.id}">
            ${escapeHTML(
              record.typeName
            )}
            ·
            ${escapeHTML(
              record.dateText
            )}
            ·
            ${record.score}점
          </option>

        `
      )
      .join("");
}


/* =========================================================
   40. REPORT RENDER HOOK
========================================================= */

function renderReport(
  id
) {

  /*
   * 실제 리포트 HTML 생성은
   * report.js가 담당한다.
   *
   * report.js가 로드된 경우
   * window.renderSeolcheonReport를 사용.
   */

  const records =
    getRecords();


  const record =
    records.find(
      item =>
        item.id === id
    );


  if (
    !record
  ) {
    return;
  }


  if (
    typeof window
      .renderSeolcheonReport ===
    "function"
  ) {

    window.renderSeolcheonReport(
      record
    );

  }

}


/* =========================================================
   41. EVENT SETUP
========================================================= */

function setupEvents() {

  /*
   * 네비게이션
   */

  setupNavigation();


  /*
   * 영상 모듈
   */

  setupVideoModule(
    "ski"
  );

  setupVideoModule(
    "roller"
  );

  setupVideoModule(
    "shooting"
  );


  /*
   * 카메라
   */

  setupCameraButtons();


  /*
   * 도구
   */

  setupToolButtons();


  /*
   * 사격
   */

  setupShootingButtons();


  /*
   * 총구 선택
   */

  setupMuzzleSelection();


  /*
   * 비교
   */

  $("#runCompare")
    ?.addEventListener(
      "click",
      compareRecords
    );


  /*
   * 리포트
   */

  $("#reportSelect")
    ?.addEventListener(
      "change",
      event => {

        const id =
          event.target.value;

        if (id) {

          renderReport(
            id
          );

        }

      }
    );


  $("#printReport")
    ?.addEventListener(
      "click",
      () => {

        window.print();

      }
    );


  /*
   * 초기 버튼
   */

  updateDashboard();

  renderRecords();

  populateCompareSelects();

  populateReportSelect();

  renderShotEvents();

  updateMuzzleStatus();

}


/* =========================================================
   42. SECURITY / HTML ESCAPE
========================================================= */

function escapeHTML(
  value
) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


/* =========================================================
   43. RANDOM ID
========================================================= */

function cryptoRandomId() {

  if (
    window.crypto &&
    typeof window.crypto.randomUUID ===
      "function"
  ) {

    return window.crypto.randomUUID();

  }


  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2)
  );
}


/* =========================================================
   44. GLOBAL API
========================================================= */

window.SeolcheonApp = {

  APP,

  navigate,

  getRecords,

  deleteRecord,

  compareRecords,

  renderReport,

  markShotEvent,

  clearShotEvents,

  capturePose,

  bookmarkFrame

};


/* =========================================================
   45. INITIALIZE
========================================================= */

function initializeApp() {

  setupCanvases();

  initPose();

  setupEvents();

  /*
   * Canvas가 실제 레이아웃 크기를
   * 얻은 뒤 한 번 더 맞춘다.
   */

  setTimeout(
    () => {

      resizeCanvas("ski");

      resizeCanvas("roller");

      resizeCanvas("shooting");

    },
    300
  );


  updateClock();


  console.log(
    "설천 BIATHLON 자세분석 PRO 준비 완료"
  );
}


if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initializeApp
  );

} else {

  initializeApp();

}


/* =========================================================
   END OF APP.JS
========================================================= */