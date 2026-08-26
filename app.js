/* =========================================================
   설천 바이애슬론 자세분석 PRO
   app.js
   ---------------------------------------------------------
   실제 분석 엔진
   - 영상 업로드
   - 영상 재생 / 정지
   - 프레임 이동
   - 슬로모션
   - 측면 / 정면 / 후면
   - MediaPipe Pose
   - 관절각 계산
   - 신체중심 계산
   - 중심 궤적
   - 기준선
   - 스켈레톤
   - 스키 분석
   - 롤러스키 분석
   - 사격 분석
   - 격발 타임라인
   - 5발 분석
   - 핵심 프레임
   - 자동 점수
   - 분석 기록 저장
========================================================= */


/* =========================================================
   01. GLOBAL ANALYSIS STATE
========================================================= */

const AnalysisState = {

  ski: {
    video: null,
    canvas: null,
    ctx: null,

    pose: null,
    running: false,
    processing: false,

    camera: "side",

    duration: 0,
    currentTime: 0,

    trajectory: [],
    angleHistory: [],

    keyFrames: [],

    score: null,

    lastLandmarks: null,

    frameCount: 0
  },


  roller: {
    video: null,
    canvas: null,
    ctx: null,

    pose: null,
    running: false,
    processing: false,

    camera: "side",

    duration: 0,
    currentTime: 0,

    trajectory: [],
    angleHistory: [],

    cycleHistory: [],
    keyFrames: [],

    score: null,

    lastLandmarks: null,

    frameCount: 0
  },


  shooting: {
    video: null,
    canvas: null,
    ctx: null,

    pose: null,
    running: false,
    processing: false,

    camera: "side",
    mode: "prone",

    duration: 0,
    currentTime: 0,

    trajectory: [],
    angleHistory: [],

    triggerData: [],
    shots: [],

    keyFrames: [],

    score: null,

    lastLandmarks: null,

    frameCount: 0
  }

};


/* =========================================================
   02. CONSTANTS
========================================================= */

const POSE_CONNECTIONS = [

  [11, 12],

  [11, 13],
  [13, 15],

  [12, 14],
  [14, 16],

  [11, 23],
  [12, 24],

  [23, 24],

  [23, 25],
  [25, 27],

  [24, 26],
  [26, 28],

  [27, 31],
  [28, 32],

  [15, 17],
  [15, 19],
  [15, 21],

  [16, 18],
  [16, 20],
  [16, 22]

];


/* =========================================================
   03. UTILITY
========================================================= */

function clamp(
  value,
  min,
  max
) {

  return Math.max(
    min,
    Math.min(max, value)
  );

}


function average(
  values
) {

  const valid =
    values.filter(
      value =>
        Number.isFinite(value)
    );


  if (!valid.length) {
    return 0;
  }


  return valid.reduce(
    (sum, value) =>
      sum + value,
    0
  ) / valid.length;

}


function distance(
  a,
  b
) {

  if (!a || !b) {
    return 0;
  }


  return Math.sqrt(
    Math.pow(a.x - b.x, 2) +
    Math.pow(a.y - b.y, 2)
  );

}


function midpoint(
  a,
  b
) {

  if (!a || !b) {
    return null;
  }


  return {

    x: (a.x + b.x) / 2,

    y: (a.y + b.y) / 2,

    z:
      ((a.z || 0) +
       (b.z || 0)) / 2

  };

}


function formatTime(
  seconds
) {

  if (!Number.isFinite(seconds)) {
    return "00:00";
  }


  const minutes =
    Math.floor(seconds / 60);

  const secs =
    Math.floor(seconds % 60);


  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(secs).padStart(2, "0")
  );

}


/* =========================================================
   04. LANDMARK
========================================================= */

function landmark(
  landmarks,
  index
) {

  if (
    !landmarks ||
    !landmarks[index]
  ) {

    return null;
  }


  return landmarks[index];
}


/* =========================================================
   05. ANGLE
========================================================= */

function calculateAngle(
  a,
  b,
  c
) {

  if (!a || !b || !c) {
    return null;
  }


  const BA = {

    x: a.x - b.x,
    y: a.y - b.y

  };


  const BC = {

    x: c.x - b.x,
    y: c.y - b.y

  };


  const dot =
    BA.x * BC.x +
    BA.y * BC.y;


  const magBA =
    Math.sqrt(
      BA.x * BA.x +
      BA.y * BA.y
    );


  const magBC =
    Math.sqrt(
      BC.x * BC.x +
      BC.y * BC.y
    );


  if (
    magBA === 0 ||
    magBC === 0
  ) {

    return null;
  }


  const cos =
    clamp(
      dot / (magBA * magBC),
      -1,
      1
    );


  return (
    Math.acos(cos) *
    180 /
    Math.PI
  );

}


/* =========================================================
   06. ANGLE DATA
========================================================= */

function calculatePoseAngles(
  landmarks
) {

  const leftShoulder =
    landmark(landmarks, 11);

  const rightShoulder =
    landmark(landmarks, 12);

  const leftElbow =
    landmark(landmarks, 13);

  const rightElbow =
    landmark(landmarks, 14);

  const leftHip =
    landmark(landmarks, 23);

  const rightHip =
    landmark(landmarks, 24);

  const leftKnee =
    landmark(landmarks, 25);

  const rightKnee =
    landmark(landmarks, 26);

  const leftAnkle =
    landmark(landmarks, 27);

  const rightAnkle =
    landmark(landmarks, 28);


  return {

    leftKnee:
      calculateAngle(
        leftHip,
        leftKnee,
        leftAnkle
      ),

    rightKnee:
      calculateAngle(
        rightHip,
        rightKnee,
        rightAnkle
      ),

    leftHip:
      calculateAngle(
        leftShoulder,
        leftHip,
        leftKnee
      ),

    rightHip:
      calculateAngle(
        rightShoulder,
        rightHip,
        rightKnee
      ),

    leftElbow:
      calculateAngle(
        leftShoulder,
        leftElbow,
        landmark(
          landmarks,
          15
        )
      ),

    rightElbow:
      calculateAngle(
        rightShoulder,
        rightElbow,
        landmark(
          landmarks,
          16
        )
      ),

    trunk:
      calculateAngle(
        midpoint(
          leftShoulder,
          rightShoulder
        ),
        midpoint(
          leftHip,
          rightHip
        ),
        {
          x:
            midpoint(
              leftHip,
              rightHip
            )?.x,

          y:
            (
              midpoint(
                leftHip,
                rightHip
              )?.y || 0
            ) + 1
        }
      )

  };

}


/* =========================================================
   07. CENTER OF MASS APPROXIMATION
========================================================= */

function calculateCenter(
  landmarks
) {

  const points = [

    landmark(landmarks, 11),
    landmark(landmarks, 12),

    landmark(landmarks, 23),
    landmark(landmarks, 24),

    landmark(landmarks, 25),
    landmark(landmarks, 26)

  ].filter(Boolean);


  if (!points.length) {
    return null;
  }


  return {

    x: average(
      points.map(
        point => point.x
      )
    ),

    y: average(
      points.map(
        point => point.y
      )
    )

  };

}


/* =========================================================
   08. POSE VISIBILITY
========================================================= */

function hasUsablePose(
  landmarks
) {

  if (
    !landmarks ||
    landmarks.length < 29
  ) {

    return false;
  }


  const important = [

    11,
    12,
    23,
    24,
    25,
    26,
    27,
    28

  ];


  const visible =
    important.filter(
      index =>
        landmarks[index] &&
        (
          landmarks[index]
            .visibility === undefined ||
          landmarks[index]
            .visibility > 0.45
        )
    );


  return visible.length >= 6;

}


/* =========================================================
   09. DRAW POSE
========================================================= */

function drawPose(
  ctx,
  landmarks,
  width,
  height,
  options = {}
) {

  if (!ctx || !landmarks) {
    return;
  }


  const showSkeleton =
    options.skeleton !== false;


  const showAngles =
    options.angles !== false;


  const showCenter =
    options.center !== false;


  const showBaseline =
    options.baseline !== false;


  const showTrajectory =
    options.trajectory !== false;


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  /* -------------------------------------------------------
     기준선
  ------------------------------------------------------- */

  if (showBaseline) {

    ctx.save();

    ctx.strokeStyle =
      "rgba(155,189,206,0.65)";

    ctx.lineWidth = 1;

    ctx.setLineDash([
      7,
      7
    ]);


    ctx.beginPath();

    ctx.moveTo(
      width / 2,
      0
    );

    ctx.lineTo(
      width / 2,
      height
    );

    ctx.stroke();


    ctx.restore();

  }


  /* -------------------------------------------------------
     궤적
  ------------------------------------------------------- */

  if (
    showTrajectory &&
    Array.isArray(
      options.trajectory
    ) &&
    options.trajectory.length > 1
  ) {

    ctx.save();

    ctx.strokeStyle =
      "rgba(130,190,210,0.9)";

    ctx.lineWidth = 3;

    ctx.beginPath();


    options.trajectory
      .forEach(
        (point, index) => {

          const x =
            point.x * width;

          const y =
            point.y * height;


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

  }


  /* -------------------------------------------------------
     Skeleton
  ------------------------------------------------------- */

  if (showSkeleton) {

    ctx.save();

    ctx.strokeStyle =
      "rgba(235,245,249,0.9)";

    ctx.lineWidth = 3;

    ctx.lineCap = "round";


    POSE_CONNECTIONS
      .forEach(
        connection => {

          const a =
            landmarks[
              connection[0]
            ];

          const b =
            landmarks[
              connection[1]
            ];


          if (
            !a ||
            !b
          ) {

            return;
          }


          if (
            a.visibility !== undefined &&
            a.visibility < 0.35
          ) {

            return;
          }


          if (
            b.visibility !== undefined &&
            b.visibility < 0.35
          ) {

            return;
          }


          ctx.beginPath();

          ctx.moveTo(
            a.x * width,
            a.y * height
          );

          ctx.lineTo(
            b.x * width,
            b.y * height
          );

          ctx.stroke();

        }
      );


    ctx.fillStyle =
      "#ffffff";


    landmarks
      .forEach(
        point => {

          if (
            point.visibility !== undefined &&
            point.visibility < 0.35
          ) {

            return;
          }


          ctx.beginPath();

          ctx.arc(
            point.x * width,
            point.y * height,
            3.2,
            0,
            Math.PI * 2
          );

          ctx.fill();

        }
      );


    ctx.restore();

  }


  /* -------------------------------------------------------
     Center
  ------------------------------------------------------- */

  if (
    showCenter &&
    options.centerPoint
  ) {

    const x =
      options.centerPoint.x *
      width;

    const y =
      options.centerPoint.y *
      height;


    ctx.save();

    ctx.fillStyle =
      "#9bbdce";

    ctx.strokeStyle =
      "#ffffff";

    ctx.lineWidth = 2;


    ctx.beginPath();

    ctx.arc(
      x,
      y,
      7,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.stroke();


    ctx.restore();

  }


  /* -------------------------------------------------------
     Angles
  ------------------------------------------------------- */

  if (
    showAngles &&
    options.angles
  ) {

    drawAngleLabel(
      ctx,
      landmarks,
      23,
      25,
      27,
      options.angles.leftKnee,
      width,
      height
    );


    drawAngleLabel(
      ctx,
      landmarks,
      24,
      26,
      28,
      options.angles.rightKnee,
      width,
      height
    );

  }

}


/* =========================================================
   10. ANGLE LABEL
========================================================= */

function drawAngleLabel(
  ctx,
  landmarks,
  aIndex,
  bIndex,
  cIndex,
  angle,
  width,
  height
) {

  if (
    !Number.isFinite(angle)
  ) {

    return;
  }


  const a =
    landmarks[aIndex];

  const b =
    landmarks[bIndex];

  const c =
    landmarks[cIndex];


  if (
    !a ||
    !b ||
    !c
  ) {

    return;
  }


  const x =
    b.x * width;

  const y =
    b.y * height;


  ctx.save();

  ctx.fillStyle =
    "rgba(7,16,24,0.78)";

  ctx.font =
    "bold 11px sans-serif";


  const text =
    `${Math.round(angle)}°`;


  ctx.fillText(
    text,
    x + 7,
    y - 7
  );


  ctx.restore();

}


/* =========================================================
   11. OVERLAY SETTINGS
========================================================= */

function getOverlayOptions() {

  const options = {};


  document
    .querySelectorAll(
      "[data-overlay]"
    )
    .forEach(
      checkbox => {

        options[
          checkbox.dataset.overlay
        ] =
          checkbox.checked;

      }
    );


  return options;
}


/* =========================================================
   12. CREATE POSE
========================================================= */

function createPose(
  onResults
) {

  if (
    typeof Pose ===
    "undefined"
  ) {

    console.warn(
      "MediaPipe Pose가 아직 로드되지 않았습니다."
    );

    return null;
  }


  const pose =
    new Pose({

      locateFile:
        file =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`

    });


  pose.setOptions({

    modelComplexity: 1,

    smoothLandmarks: true,

    enableSegmentation: false,

    smoothSegmentation: false,

    minDetectionConfidence: 0.5,

    minTrackingConfidence: 0.5

  });


  pose.onResults(
    onResults
  );


  return pose;
}


/* =========================================================
   13. VIDEO ELEMENT
========================================================= */

function prepareVideo(
  video,
  canvas
) {

  if (!video || !canvas) {
    return;
  }


  video.controls = false;

  video.playsInline = true;

  video.muted = true;


  canvas.width =
    video.videoWidth ||
    1280;

  canvas.height =
    video.videoHeight ||
    720;

}


/* =========================================================
   14. VIDEO INPUT
========================================================= */

function loadVideoFile(
  input,
  video,
  placeholder,
  state
) {

  if (
    !input ||
    !video
  ) {

    return;
  }


  const file =
    input.files?.[0];


  if (!file) {
    return;
  }


  const url =
    URL.createObjectURL(
      file
    );


  video.src =
    url;


  video.load();


  state.videoFileName =
    file.name;


  if (placeholder) {

    placeholder.style.display =
      "none";

  }


  video.addEventListener(
    "loadedmetadata",
    () => {

      state.duration =
        video.duration || 0;

      state.currentTime =
        0;


      prepareVideo(
        video,
        state.canvas
      );


      updateVideoUI(
        state,
        video
      );

    },
    {
      once: true
    }
  );


  if (
    window.BiathlonEvents
  ) {

    BiathlonEvents.showToast(
      "영상을 불러왔습니다."
    );

  }

}


/* =========================================================
   15. VIDEO CONTROLS
========================================================= */

function toggleVideo(
  video
) {

  if (!video) {
    return;
  }


  if (video.paused) {

    video.play();

  } else {

    video.pause();

  }

}


function setVideoSpeed(
  video,
  speed
) {

  if (!video) {
    return;
  }


  video.playbackRate =
    speed;

}


function stepFrame(
  video,
  direction
) {

  if (
    !video ||
    !Number.isFinite(
      video.duration
    )
  ) {

    return;
  }


  video.pause();


  const frameTime =
    1 / 30;


  video.currentTime =
    clamp(
      video.currentTime +
      frameTime * direction,
      0,
      video.duration
    );

}


/* =========================================================
   16. VIDEO UI
========================================================= */

function updateVideoUI(
  state,
  video
) {

  if (!video) {
    return;
  }


  state.currentTime =
    video.currentTime;


  const seek =
    getSeekForVideo(
      video
    );


  if (seek) {

    seek.value =
      video.duration
        ? (
            video.currentTime /
            video.duration
          ) * 100
        : 0;

  }


  const current =
    getCurrentTimeElement(
      video
    );


  const duration =
    getDurationElement(
      video
    );


  if (current) {

    current.textContent =
      formatTime(
        video.currentTime
      );

  }


  if (duration) {

    duration.textContent =
      formatTime(
        video.duration
      );

  }

}


function getSeekForVideo(
  video
) {

  if (
    video.id ===
    "analysisVideo"
  ) {

    return document.getElementById(
      "videoSeek"
    );

  }


  return null;

}


function getCurrentTimeElement(
  video
) {

  if (
    video.id ===
    "analysisVideo"
  ) {

    return document.getElementById(
      "videoCurrentTime"
    );

  }


  return null;

}


function getDurationElement(
  video
) {

  if (
    video.id ===
    "analysisVideo"
  ) {

    return document.getElementById(
      "videoDuration"
    );

  }


  return null;

}


/* =========================================================
   17. SKI POSE RESULTS
========================================================= */

function handleSkiResults(
  results
) {

  const state =
    AnalysisState.ski;


  state.processing =
    false;


  if (
    !results ||
    !results.poseLandmarks
  ) {

    return;
  }


  const landmarks =
    results.poseLandmarks;


  state.lastLandmarks =
    landmarks;


  const angles =
    calculatePoseAngles(
      landmarks
    );


  const center =
    calculateCenter(
      landmarks
    );


  const time =
    state.video
      ? state.video.currentTime
      : 0;


  if (center) {

    state.trajectory.push({

      x: center.x,

      y: center.y,

      t: time

    });


    if (
      state.trajectory.length >
      500
    ) {

      state.trajectory.shift();

    }

  }


  state.angleHistory.push({

    time,

    ...angles

  });


  if (
    state.angleHistory.length >
    500
  ) {

    state.angleHistory.shift();

  }


  drawPose(

    state.ctx,

    landmarks,

    state.canvas.width,

    state.canvas.height,

    {

      ...getOverlayOptions(),

      angles,

      centerPoint:
        center,

      trajectory:
        state.trajectory

    }

  );


  updateSkiAngles(
    angles
  );


  updateSkiTrajectory(
    state
  );


  updateSkiChart(
    state
  );


  maybeCreateKeyFrame(
    state,
    landmarks,
    "ski"
  );

}


/* =========================================================
   18. ROLLER RESULTS
========================================================= */

function handleRollerResults(
  results
) {

  const state =
    AnalysisState.roller;


  state.processing =
    false;


  if (
    !results ||
    !results.poseLandmarks
  ) {

    return;
  }


  const landmarks =
    results.poseLandmarks;


  state.lastLandmarks =
    landmarks;


  const angles =
    calculatePoseAngles(
      landmarks
    );


  const center =
    calculateCenter(
      landmarks
    );


  const time =
    state.video
      ? state.video.currentTime
      : 0;


  if (center) {

    state.trajectory.push({

      x: center.x,

      y: center.y,

      t: time

    });


    if (
      state.trajectory.length >
      500
    ) {

      state.trajectory.shift();

    }

  }


  state.angleHistory.push({

    time,

    ...angles

  });


  if (
    state.angleHistory.length >
    500
  ) {

    state.angleHistory.shift();

  }


  drawPose(

    state.ctx,

    landmarks,

    state.canvas.width,

    state.canvas.height,

    {

      ...getOverlayOptions(),

      angles,

      centerPoint:
        center,

      trajectory:
        state.trajectory

    }

  );


  updateRollerMetrics(
    state,
    angles
  );


  updateRollerChart(
    state
  );


  maybeCreateKeyFrame(
    state,
    landmarks,
    "roller"
  );

}


/* =========================================================
   19. SHOOTING RESULTS
========================================================= */

function handleShootingResults(
  results
) {

  const state =
    AnalysisState.shooting;


  state.processing =
    false;


  if (
    !results ||
    !results.poseLandmarks
  ) {

    return;
  }


  const landmarks =
    results.poseLandmarks;


  state.lastLandmarks =
    landmarks;


  const angles =
    calculatePoseAngles(
      landmarks
    );


  const center =
    calculateCenter(
      landmarks
    );


  const time =
    state.video
      ? state.video.currentTime
      : 0;


  if (center) {

    state.trajectory.push({

      x: center.x,

      y: center.y,

      t: time

    });


    if (
      state.trajectory.length >
      500
    ) {

      state.trajectory.shift();

    }

  }


  state.angleHistory.push({

    time,

    ...angles

  });


  if (
    state.angleHistory.length >
    500
  ) {

    state.angleHistory.shift();

  }


  drawPose(

    state.ctx,

    landmarks,

    state.canvas.width,

    state.canvas.height,

    {

      ...getOverlayOptions(),

      angles,

      centerPoint:
        center,

      trajectory:
        state.trajectory

    }

  );


  updateShootingMetrics(
    state,
    angles
  );


  updateShootingCharts(
    state
  );


  maybeDetectTrigger(
    state,
    landmarks
  );


  maybeCreateKeyFrame(
    state,
    landmarks,
    "shooting"
  );

}


/* =========================================================
   20. ANALYSIS LOOP
========================================================= */

async function processVideoFrame(
  state
) {

  if (
    !state.video ||
    !state.pose ||
    !state.running ||
    state.processing
  ) {

    return;
  }


  if (
    state.video.readyState <
    2
  ) {

    return;
  }


  if (
    state.video.ended
  ) {

    state.running =
      false;

    return;
  }


  state.processing =
    true;


  try {

    await state.pose.send({

      image:
        state.video

    });

  } catch (error) {

    state.processing =
      false;

    console.warn(
      "Pose processing error:",
      error
    );

  }

}


/* =========================================================
   21. REQUEST LOOP
========================================================= */

function startAnalysisLoop(
  state
) {

  if (
    state.animationFrame
  ) {

    cancelAnimationFrame(
      state.animationFrame
    );

  }


  const loop = async () => {

    if (
      !state.running
    ) {

      return;
    }


    await processVideoFrame(
      state
    );


    state.animationFrame =
      requestAnimationFrame(
        loop
      );

  };


  loop();

}


/* =========================================================
   22. SKI INIT
========================================================= */

function initSkiAnalysis() {

  const video =
    document.getElementById(
      "analysisVideo"
    );

  const canvas =
    document.getElementById(
      "poseCanvas"
    );


  if (!video || !canvas) {
    return;
  }


  const state =
    AnalysisState.ski;


  state.video =
    video;

  state.canvas =
    canvas;

  state.ctx =
    canvas.getContext(
      "2d"
    );


  state.pose =
    createPose(
      handleSkiResults
    );


  const input =
    document.getElementById(
      "videoInput"
    );


  const placeholder =
    document.getElementById(
      "videoPlaceholder"
    );


  input?.addEventListener(
    "change",
    () => {

      resetAnalysisState(
        state
      );


      loadVideoFile(
        input,
        video,
        placeholder,
        state
      );

    }
  );


  document
    .getElementById(
      "uploadVideoButton"
    )
    ?.addEventListener(
      "click",
      () => input?.click()
    );


  document
    .getElementById(
      "videoPlayPause"
    )
    ?.addEventListener(
      "click",
      () => {

        toggleVideo(
          video
        );

      }
    );


  document
    .getElementById(
      "videoPrevFrame"
    )
    ?.addEventListener(
      "click",
      () => {

        stepFrame(
          video,
          -1
        );

      }
    );


  document
    .getElementById(
      "videoNextFrame"
    )
    ?.addEventListener(
      "click",
      () => {

        stepFrame(
          video,
          1
        );

      }
    );


  document
    .getElementById(
      "videoSlow"
    )
    ?.addEventListener(
      "click",
      () => {

        setVideoSpeed(
          video,
          0.5
        );

      }
    );


  document
    .getElementById(
      "videoNormal"
    )
    ?.addEventListener(
      "click",
      () => {

        setVideoSpeed(
          video,
          1
        );

      }
    );


  document
    .getElementById(
      "videoSeek"
    )
    ?.addEventListener(
      "input",
      event => {

        if (
          !Number.isFinite(
            video.duration
          )
        ) {

          return;
        }


        video.currentTime =
          (
            Number(
              event.target.value
            ) / 100
          ) *
          video.duration;

      }
    );


  video.addEventListener(
    "timeupdate",
    () => {

      updateVideoUI(
        state,
        video
      );

    }
  );


  document
    .getElementById(
      "startAnalysis"
    )
    ?.addEventListener(
      "click",
      () => {

        startSkiAnalysis();

      }
    );


  document
    .getElementById(
      "stopAnalysis"
    )
    ?.addEventListener(
      "click",
      () => {

        stopSkiAnalysis();

      }
    );

}


/* =========================================================
   23. START SKI
========================================================= */

function startSkiAnalysis() {

  const state =
    AnalysisState.ski;


  if (!state.video?.src) {

    BiathlonEvents?.showToast(
      "먼저 스키 영상을 선택하세요."
    );

    return;
  }


  if (!state.pose) {

    BiathlonEvents?.showToast(
      "자세분석 엔진을 불러오는 중입니다."
    );

    return;
  }


  state.running =
    true;


  state.processing =
    false;


  startAnalysisLoop(
    state
  );


  BiathlonEvents?.showToast(
    "스키 자세분석을 시작했습니다."
  );

}


/* =========================================================
   24. STOP SKI
========================================================= */

function stopSkiAnalysis() {

  const state =
    AnalysisState.ski;


  state.running =
    false;


  state.processing =
    false;


  state.video?.pause();


  const score =
    calculateSkiScore(
      state
    );


  state.score =
    score;


  updateSkiScore(
    score
  );


  saveAnalysis(
    "ski",
    state
  );


  BiathlonEvents?.showToast(
    "스키 분석을 저장했습니다."
  );

}


/* =========================================================
   25. SKI SCORE
========================================================= */

function calculateSkiScore(
  state
) {

  if (
    !state.angleHistory.length
  ) {

    return null;
  }


  const kneeValues =
    state.angleHistory.flatMap(
      item => [
        item.leftKnee,
        item.rightKnee
      ]
    )
      .filter(
        Number.isFinite
      );


  const symmetry =
    calculateSymmetry(
      state.angleHistory
    );


  const stability =
    calculateTrajectoryStability(
      state.trajectory
    );


  const kneeAverage =
    average(
      kneeValues
    );


  let angleScore =
    70;


  if (
    kneeAverage >= 100 &&
    kneeAverage <= 150
  ) {

    angleScore =
      90;

  }


  if (
    kneeAverage >= 115 &&
    kneeAverage <= 140
  ) {

    angleScore =
      96;

  }


  return Math.round(
    clamp(
      angleScore * 0.4 +
      symmetry * 0.3 +
      stability * 0.3,
      0,
      100
    )
  );

}


/* =========================================================
   26. ROLLER INIT
========================================================= */

function initRollerAnalysis() {

  const video =
    document.getElementById(
      "rollerVideo"
    );

  const canvas =
    document.getElementById(
      "rollerPoseCanvas"
    );


  if (!video || !canvas) {
    return;
  }


  const state =
    AnalysisState.roller;


  state.video =
    video;

  state.canvas =
    canvas;

  state.ctx =
    canvas.getContext(
      "2d"
    );


  state.pose =
    createPose(
      handleRollerResults
    );


  const input =
    document.getElementById(
      "rollerVideoInput"
    );


  const placeholder =
    document.getElementById(
      "rollerVideoPlaceholder"
    );


  input?.addEventListener(
    "change",
    () => {

      resetAnalysisState(
        state
      );


      loadVideoFile(
        input,
        video,
        placeholder,
        state
      );

    }
  );


  document
    .getElementById(
      "rollerUploadButton"
    )
    ?.addEventListener(
      "click",
      () => input?.click()
    );


  document
    .getElementById(
      "rollerPlayPause"
    )
    ?.addEventListener(
      "click",
      () => toggleVideo(video)
    );


  document
    .getElementById(
      "rollerPrevFrame"
    )
    ?.addEventListener(
      "click",
      () => stepFrame(video, -1)
    );


  document
    .getElementById(
      "rollerNextFrame"
    )
    ?.addEventListener(
      "click",
      () => stepFrame(video, 1)
    );


  document
    .getElementById(
      "rollerSlow"
    )
    ?.addEventListener(
      "click",
      () => setVideoSpeed(video, 0.5)
    );


  document
    .getElementById(
      "rollerNormal"
    )
    ?.addEventListener(
      "click",
      () => setVideoSpeed(video, 1)
    );


  document
    .getElementById(
      "rollerStartAnalysis"
    )
    ?.addEventListener(
      "click",
      startRollerAnalysis
    );


  document
    .getElementById(
      "rollerStopAnalysis"
    )
    ?.addEventListener(
      "click",
      stopRollerAnalysis
    );

}


/* =========================================================
   27. START ROLLER
========================================================= */

function startRollerAnalysis() {

  const state =
    AnalysisState.roller;


  if (!state.video?.src) {

    BiathlonEvents?.showToast(
      "먼저 롤러스키 영상을 선택하세요."
    );

    return;
  }


  if (!state.pose) {

    BiathlonEvents?.showToast(
      "자세분석 엔진을 불러오는 중입니다."
    );

    return;
  }


  state.running =
    true;


  startAnalysisLoop(
    state
  );


  BiathlonEvents?.showToast(
    "롤러스키 분석을 시작했습니다."
  );

}


/* =========================================================
   28. STOP ROLLER
========================================================= */

function stopRollerAnalysis() {

  const state =
    AnalysisState.roller;


  state.running =
    false;


  state.video?.pause();


  const score =
    calculateRollerScore(
      state
    );


  state.score =
    score;


  updateRollerScore(
    score
  );


  saveAnalysis(
    "roller",
    state
  );


  BiathlonEvents?.showToast(
    "롤러스키 분석을 저장했습니다."
  );

}


/* =========================================================
   29. ROLLER SCORE
========================================================= */

function calculateRollerScore(
  state
) {

  if (
    !state.angleHistory.length
  ) {

    return null;
  }


  const symmetry =
    calculateSymmetry(
      state.angleHistory
    );


  const stability =
    calculateTrajectoryStability(
      state.trajectory
    );


  const consistency =
    calculateConsistency(
      state.angleHistory
    );


  return Math.round(
    clamp(
      symmetry * 0.35 +
      stability * 0.3 +
      consistency * 0.35,
      0,
      100
    )
  );

}


/* =========================================================
   30. ROLLER METRICS
========================================================= */

function updateRollerMetrics(
  state,
  angles
) {

  const left =
    angles.leftKnee;

  const right =
    angles.rightKnee;


  const symmetry =
    calculateSingleSymmetry(
      left,
      right
    );


  const consistency =
    calculateConsistency(
      state.angleHistory
    );


  const stability =
    calculateTrajectoryStability(
      state.trajectory
    );


  setText(
    "rollerPropulsion",
    `${Math.round(
      clamp(
        60 +
        (
          average([
            left,
            right
          ]) || 0
        ) * 0.2,
        0,
        100
      )
    )}`
  );


  setText(
    "rollerRecovery",
    `${Math.round(
      clamp(
        70 +
        (
          symmetry - 70
        ) * 0.4,
        0,
        100
      )
    )}`
  );


  setText(
    "rollerSymmetry",
    `${Math.round(
      symmetry
    )}`
  );


  setText(
    "rollerConsistency",
    `${Math.round(
      consistency
    )}`
  );


  const liveScore =
    Math.round(
      (
        symmetry +
        consistency +
        stability
      ) / 3
    );


  setText(
    "rollerAnalysisScore",
    liveScore
  );

}


/* =========================================================
   31. SHOOTING INIT
========================================================= */

function initShootingAnalysis() {

  const video =
    document.getElementById(
      "shootingVideo"
    );

  const canvas =
    document.getElementById(
      "shootingPoseCanvas"
    );


  if (!video || !canvas) {
    return;
  }


  const state =
    AnalysisState.shooting;


  state.video =
    video;

  state.canvas =
    canvas;

  state.ctx =
    canvas.getContext(
      "2d"
    );


  state.pose =
    createPose(
      handleShootingResults
    );


  const input =
    document.getElementById(
      "shootingVideoInput"
    );


  const placeholder =
    document.getElementById(
      "shootingVideoPlaceholder"
    );


  input?.addEventListener(
    "change",
    () => {

      resetAnalysisState(
        state
      );


      loadVideoFile(
        input,
        video,
        placeholder,
        state
      );

    }
  );


  document
    .getElementById(
      "shootingUploadButton"
    )
    ?.addEventListener(
      "click",
      () => input?.click()
    );


  document
    .getElementById(
      "shootingPlayPause"
    )
    ?.addEventListener(
      "click",
      () => toggleVideo(video)
    );


  document
    .getElementById(
      "shootingPrevFrame"
    )
    ?.addEventListener(
      "click",
      () => stepFrame(video, -1)
    );


  document
    .getElementById(
      "shootingNextFrame"
    )
    ?.addEventListener(
      "click",
      () => stepFrame(video, 1)
    );


  document
    .getElementById(
      "shootingSlow"
    )
    ?.addEventListener(
      "click",
      () => setVideoSpeed(video, 0.25)
    );


  document
    .getElementById(
      "shootingNormal"
    )
    ?.addEventListener(
      "click",
      () => setVideoSpeed(video, 1)
    );


  document
    .getElementById(
      "shootingStartAnalysis"
    )
    ?.addEventListener(
      "click",
      startShootingAnalysis
    );


  document
    .getElementById(
      "shootingStopAnalysis"
    )
    ?.addEventListener(
      "click",
      stopShootingAnalysis
    );


  document
    .querySelectorAll(
      ".shot-card"
    )
    .forEach(
      card => {

        card.addEventListener(
          "click",
          () => {

            selectShot(
              Number(
                card.dataset.shot
              )
            );

          }
        );

      }
    );

}


/* =========================================================
   32. START SHOOTING
========================================================= */

function startShootingAnalysis() {

  const state =
    AnalysisState.shooting;


  if (!state.video?.src) {

    BiathlonEvents?.showToast(
      "먼저 사격 영상을 선택하세요."
    );

    return;
  }


  if (!state.pose) {

    BiathlonEvents?.showToast(
      "자세분석 엔진을 불러오는 중입니다."
    );

    return;
  }


  state.running =
    true;


  startAnalysisLoop(
    state
  );


  BiathlonEvents?.showToast(
    "사격 자세분석을 시작했습니다."
  );

}


/* =========================================================
   33. STOP SHOOTING
========================================================= */

function stopShootingAnalysis() {

  const state =
    AnalysisState.shooting;


  state.running =
    false;


  state.video?.pause();


  autoBuildShots(
    state
  );


  const score =
    calculateShootingScore(
      state
    );


  state.score =
    score;


  updateShootingScore(
    score
  );


  saveAnalysis(
    "shooting",
    state
  );


  BiathlonEvents?.showToast(
    "사격 분석을 저장했습니다."
  );

}


/* =========================================================
   34. SHOOTING SCORE
========================================================= */

function calculateShootingScore(
  state
) {

  const stability =
    calculateTrajectoryStability(
      state.trajectory
    );


  const consistency =
    calculateConsistency(
      state.angleHistory
    );


  const shotScore =
    calculateShotScore(
      state.shots
    );


  return Math.round(
    clamp(
      stability * 0.35 +
      consistency * 0.35 +
      shotScore * 0.3,
      0,
      100
    )
  );

}


/* =========================================================
   35. TRIGGER DETECTION
========================================================= */

function maybeDetectTrigger(
  state,
  landmarks
) {

  if (!state.video) {
    return;
  }


  const time =
    state.video.currentTime;


  const history =
    state.angleHistory;


  if (
    history.length < 4
  ) {

    return;
  }


  const current =
    history[
      history.length - 1
    ];


  const previous =
    history[
      history.length - 2
    ];


  const currentKnee =
    average([
      current.leftKnee,
      current.rightKnee
    ]);


  const previousKnee =
    average([
      previous.leftKnee,
      previous.rightKnee
    ]);


  const movement =
    Math.abs(
      currentKnee -
      previousKnee
    );


  /*
    영상만으로 실제 격발 여부를 확정할 수 없으므로
    큰 움직임을 "격발 후보"로 기록한다.
  */

  if (
    movement > 4
  ) {

    const last =
      state.triggerData[
        state.triggerData.length - 1
      ];


    if (
      !last ||
      Math.abs(
        last.time - time
      ) > 0.35
    ) {

      state.triggerData.push({

        time,

        movement,

        confidence:
          clamp(
            movement / 15,
            0,
            1
          ),

        source:
          "video-motion-candidate"

      });

    }

  }


  if (
    state.triggerData.length >
    20
  ) {

    state.triggerData =
      state.triggerData.slice(-20);

  }


  updateTriggerTimeline(
    state
  );

}


/* =========================================================
   36. AUTO BUILD 5 SHOTS
========================================================= */

function autoBuildShots(
  state
) {

  const candidates =
    state.triggerData
      .slice()
      .sort(
        (a, b) =>
          a.time - b.time
      );


  const selected = [];


  candidates.forEach(
    candidate => {

      const tooClose =
        selected.some(
          item =>
            Math.abs(
              item.time -
              candidate.time
            ) < 0.7
        );


      if (!tooClose) {

        selected.push(
          candidate
        );

      }

    }
  );


  state.shots =
    selected
      .slice(0, 5)
      .map(
        (item, index) => ({

          number:
            index + 1,

          time:
            item.time,

          interval:
            index === 0
              ? item.time
              : item.time -
                selected[index - 1]
                  .time,

          status:
            "분석 필요",

          confidence:
            item.confidence

        })
      );


  updateShotCards(
    state
  );

}


/* =========================================================
   37. SHOT SCORE
========================================================= */

function calculateShotScore(
  shots
) {

  if (!shots.length) {
    return 70;
  }


  const values =
    shots.map(
      shot =>
        shot.status === "명중"
          ? 100
          : shot.status === "미스"
            ? 40
            : 70
    );


  return average(
    values
  );

}


/* =========================================================
   38. SELECT SHOT
========================================================= */

function selectShot(
  number
) {

  document
    .querySelectorAll(
      ".shot-card"
    )
    .forEach(
      card => {

        card.classList.toggle(
          "active",
          Number(
            card.dataset.shot
          ) === number
        );

      }
    );


  const state =
    AnalysisState.shooting;


  const shot =
    state.shots.find(
      item =>
        item.number === number
    );


  if (!shot) {
    return;
  }


  if (state.video) {

    state.video.currentTime =
      shot.time;

  }

}


/* =========================================================
   39. UPDATE SHOT CARDS
========================================================= */

function updateShotCards(
  state
) {

  for (
    let i = 1;
    i <= 5;
    i++
  ) {

    const shot =
      state.shots.find(
        item =>
          item.number === i
      );


    const status =
      document.getElementById(
        `shot${i}Status`
      );


    const time =
      document.getElementById(
        `shot${i}Time`
      );


    if (!shot) {

      if (status) {
        status.textContent = "-";
      }

      if (time) {
        time.textContent = "-";
      }

      continue;
    }


    if (status) {

      status.textContent =
        shot.status ||
        "분석 필요";

    }


    if (time) {

      time.textContent =
        formatTime(
          shot.time
        );

    }

  }

}


/* =========================================================
   40. TRIGGER TIMELINE
========================================================= */

function updateTriggerTimeline(
  state
) {

  const container =
    document.getElementById(
      "triggerTimeline"
    );


  if (!container) {
    return;
  }


  if (
    !state.triggerData.length
  ) {

    container.innerHTML = `
      <div class="empty-state">
        영상에서 격발 후보를 찾는 중입니다.
      </div>
    `;

    return;
  }


  container.innerHTML =
    state.triggerData
      .slice(-10)
      .map(
        (item, index) => `

          <div class="trigger-marker">

            <strong>
              ${index + 1}
            </strong>

            <span>
              ${formatTime(
                item.time
              )}
            </span>

          </div>

        `
      )
      .join("");

}


/* =========================================================
   41. RESET
========================================================= */

function resetAnalysisState(
  state
) {

  state.running =
    false;

  state.processing =
    false;

  state.duration =
    0;

  state.currentTime =
    0;

  state.trajectory =
    [];

  state.angleHistory =
    [];

  state.keyFrames =
    [];

  state.triggerData =
    [];

  state.shots =
    [];

  state.score =
    null;

  state.lastLandmarks =
    null;

  state.frameCount =
    0;


  if (state.ctx) {

    state.ctx.clearRect(
      0,
      0,
      state.canvas.width,
      state.canvas.height
    );

  }

}


/* =========================================================
   42. KEY FRAME
========================================================= */

function maybeCreateKeyFrame(
  state,
  landmarks,
  type
) {

  if (
    !state.video ||
    !hasUsablePose(landmarks)
  ) {

    return;
  }


  state.frameCount++;


  /*
    너무 많은 사진을 만들지 않도록
    일정 프레임 간격으로 후보를 저장한다.
  */

  if (
    state.frameCount % 30 !== 0
  ) {

    return;
  }


  const angles =
    calculatePoseAngles(
      landmarks
    );


  const quality =
    calculateFrameQuality(
      angles,
      state.trajectory
    );


  const frame = {

    type,

    time:
      state.video.currentTime,

    quality,

    angles: {
      ...angles
    }

  };


  /*
    상위 8개만 유지
  */

  state.keyFrames.push(
    frame
  );


  state.keyFrames.sort(
    (a, b) =>
      b.quality -
      a.quality
  );


  state.keyFrames =
    state.keyFrames.slice(
      0,
      8
    );


  renderKeyFrames(
    state,
    type
  );

}


/* =========================================================
   43. FRAME QUALITY
========================================================= */

function calculateFrameQuality(
  angles,
  trajectory
) {

  const kneeAverage =
    average([
      angles.leftKnee,
      angles.rightKnee
    ]);


  const symmetry =
    calculateSingleSymmetry(
      angles.leftKnee,
      angles.rightKnee
    );


  const stability =
    calculateTrajectoryStability(
      trajectory
    );


  let angleQuality =
    70;


  if (
    kneeAverage >= 100 &&
    kneeAverage <= 150
  ) {

    angleQuality =
      90;

  }


  return clamp(
    angleQuality * 0.45 +
    symmetry * 0.3 +
    stability * 0.25,
    0,
    100
  );

}


/* =========================================================
   44. RENDER KEY FRAMES
========================================================= */

function renderKeyFrames(
  state,
  type
) {

  const ids = {

    ski:
      "skiKeyFrameList",

    roller:
      "rollerKeyFrameList",

    shooting:
      "shootingKeyFrameList"

  };


  const countIds = {

    shooting:
      "shootingKeyFrameCount",

    ski:
      "skiKeyFrameCount",

    roller:
      null

  };


  const container =
    document.getElementById(
      ids[type]
    );


  if (!container) {
    return;
  }


  const count =
    document.getElementById(
      countIds[type]
    );


  if (count) {

    count.textContent =
      state.keyFrames.length;

  }


  if (!state.keyFrames.length) {

    container.innerHTML = `
      <div class="empty-state">
        분석 후 자동으로 추출됩니다.
      </div>
    `;

    return;
  }


  container.innerHTML =
    state.keyFrames
      .map(
        (frame, index) => `

          <div
            class="key-frame"
            data-key-time="${frame.time}"
            data-key-type="${type}"
          >

            <div
              style="
                width:100%;
                height:100%;
                min-height:150px;
                display:flex;
                align-items:center;
                justify-content:center;
                color:#aebdc6;
                background:#071018;
                font-size:12px;
              "
            >
              FRAME ${index + 1}
            </div>

            <div class="key-frame-label">
              ${formatTime(
                frame.time
              )}
              ·
              ${Math.round(
                frame.quality
              )}점
            </div>

          </div>

        `
      )
      .join("");


  container
    .querySelectorAll(
      "[data-key-time]"
    )
    .forEach(
      element => {

        element.addEventListener(
          "click",
          () => {

            if (state.video) {

              state.video.currentTime =
                Number(
                  element.dataset
                    .keyTime
                );

            }

          }
        );

      }
    );

}


/* =========================================================
   45. SYMMETRY
========================================================= */

function calculateSingleSymmetry(
  left,
  right
) {

  if (
    !Number.isFinite(left) ||
    !Number.isFinite(right)
  ) {

    return 70;
  }


  const difference =
    Math.abs(
      left - right
    );


  return clamp(
    100 -
    difference * 1.8,
    0,
    100
  );

}


function calculateSymmetry(
  history
) {

  if (!history.length) {
    return 70;
  }


  const values =
    history.map(
      item =>
        calculateSingleSymmetry(
          item.leftKnee,
          item.rightKnee
        )
    );


  return average(
    values
  );

}


/* =========================================================
   46. TRAJECTORY STABILITY
========================================================= */

function calculateTrajectoryStability(
  trajectory
) {

  if (
    !trajectory ||
    trajectory.length < 5
  ) {

    return 70;
  }


  const recent =
    trajectory.slice(-100);


  const xs =
    recent.map(
      point =>
        point.x
    );


  const ys =
    recent.map(
      point =>
        point.y
    );


  const xMean =
    average(xs);


  const yMean =
    average(ys);


  const variance =
    average(
      recent.map(
        point =>
          Math.pow(
            point.x - xMean,
            2
          ) +
          Math.pow(
            point.y - yMean,
            2
          )
      )
    );


  /*
    화면 좌표 기준 분산.
    실제 거리/속도값이 아니므로
    자세 안정성의 참고 점수로만 사용.
  */

  return clamp(
    100 -
    Math.sqrt(variance) * 220,
    0,
    100
  );

}


/* =========================================================
   47. CONSISTENCY
========================================================= */

function calculateConsistency(
  history
) {

  if (
    !history ||
    history.length < 5
  ) {

    return 70;
  }


  const values =
    history
      .map(
        item =>
          average([
            item.leftKnee,
            item.rightKnee
          ])
      )
      .filter(
        Number.isFinite
      );


  if (!values.length) {
    return 70;
  }


  const mean =
    average(values);


  const variance =
    average(
      values.map(
        value =>
          Math.pow(
            value - mean,
            2
          )
      )
    );


  const sd =
    Math.sqrt(
      variance
    );


  return clamp(
    100 -
    sd * 2.5,
    0,
    100
  );

}


/* =========================================================
   48. UPDATE SKI ANGLES
========================================================= */

function updateSkiAngles(
  angles
) {

  setText(
    "skiLeftKnee",
    formatAngle(
      angles.leftKnee
    )
  );


  setText(
    "skiRightKnee",
    formatAngle(
      angles.rightKnee
    )
  );


  setText(
    "skiLeftHip",
    formatAngle(
      angles.leftHip
    )
  );


  setText(
    "skiRightHip",
    formatAngle(
      angles.rightHip
    )
  );


  setText(
    "skiTrunk",
    formatAngle(
      angles.trunk
    )
  );


  setText(
    "skiSymmetry",
    `${Math.round(
      calculateSingleSymmetry(
        angles.leftKnee,
        angles.rightKnee
      )
    )}`
  );

}


/* =========================================================
   49. FORMAT ANGLE
========================================================= */

function formatAngle(
  angle
) {

  return Number.isFinite(
    angle
  )
    ? `${Math.round(angle)}°`
    : "-";

}


/* =========================================================
   50. UPDATE SKI SCORE
========================================================= */

function updateSkiScore(
  score
) {

  setText(
    "skiAnalysisScore",
    score ?? "-"
  );


  const bar =
    document.getElementById(
      "skiScoreBar"
    );


  if (bar) {

    bar.style.width =
      `${clamp(
        score || 0,
        0,
        100
      )}%`;

  }

}


/* =========================================================
   51. UPDATE ROLLER SCORE
========================================================= */

function updateRollerScore(
  score
) {

  setText(
    "rollerAnalysisScore",
    score ?? "-"
  );


  setText(
    "rollerTotalScore",
    score ?? "-"
  );


  const bar =
    document.getElementById(
      "rollerScoreBar"
    );


  if (bar) {

    bar.style.width =
      `${clamp(
        score || 0,
        0,
        100
      )}%`;

  }

}


/* =========================================================
   52. UPDATE SHOOTING METRICS
========================================================= */

function updateShootingMetrics(
  state,
  angles
) {

  const stability =
    calculateTrajectoryStability(
      state.trajectory
    );


  const consistency =
    calculateConsistency(
      state.angleHistory
    );


  setText(
    "shootingAccuracy",
    "-"
  );


  setText(
    "shootingTotalTime",
    formatTime(
      state.video?.currentTime ||
      0
    )
  );


  setText(
    "shootingScore",
    Math.round(
      (
        stability +
        consistency
      ) / 2
    )
  );

}


/* =========================================================
   53. UPDATE SHOOTING SCORE
========================================================= */

function updateShootingScore(
  score
) {

  setText(
    "shootingScore",
    score ?? "-"
  );


  const bar =
    document.getElementById(
      "shootingScoreBar"
    );


  if (bar) {

    bar.style.width =
      `${clamp(
        score || 0,
        0,
        100
      )}%`;

  }


  const hits =
    AnalysisState.shooting.shots
      .filter(
        shot =>
          shot.status === "명중"
      ).length;


  const misses =
    AnalysisState.shooting.shots
      .filter(
        shot =>
          shot.status === "미스"
      ).length;


  setText(
    "shootingHits",
    hits
  );


  setText(
    "shootingMisses",
    misses
  );


  if (
    hits + misses > 0
  ) {

    setText(
      "shootingAccuracy",
      `${Math.round(
        hits /
        (hits + misses) *
        100
      )}%`
    );

  }

}


/* =========================================================
   54. CHART STORAGE
========================================================= */

const AnalysisCharts = {

  skiAngle: null,

  rollerCycle: null,

  shootingTrigger: null,

  shootingAngle: null

};


/* =========================================================
   55. UPDATE SKI CHART
========================================================= */

function updateSkiChart(
  state
) {

  if (
    typeof Chart ===
    "undefined"
  ) {

    return;
  }


  const canvas =
    document.getElementById(
      "skiAngleChart"
    );


  if (!canvas) {
    return;
  }


  const data =
    state.angleHistory
      .slice(-120);


  const labels =
    data.map(
      item =>
        Number(
          item.time
        ).toFixed(1)
    );


  const left =
    data.map(
      item =>
        item.leftKnee
    );


  const right =
    data.map(
      item =>
        item.rightKnee
    );


  if (
    AnalysisCharts.skiAngle
  ) {

    AnalysisCharts.skiAngle.destroy();

  }


  AnalysisCharts.skiAngle =
    new Chart(
      canvas,
      {

        type: "line",

        data: {

          labels,

          datasets: [

            {
              label:
                "좌측 무릎",

              data: left,

              borderWidth: 2,

              pointRadius: 0,

              tension: 0.3
            },

            {
              label:
                "우측 무릎",

              data: right,

              borderWidth: 2,

              pointRadius: 0,

              tension: 0.3
            }

          ]

        },

        options: {

          responsive: true,

          maintainAspectRatio:
            false,

          animation: false,

          plugins: {

            legend: {
              position:
                "bottom"
            }

          },

          scales: {

            x: {
              title: {
                display: true,
                text: "시간"
              }
            },

            y: {
              title: {
                display: true,
                text: "각도(°)"
              },

              min: 0,
              max: 180

            }

          }

        }

      }
    );

}


/* =========================================================
   56. UPDATE SKI TRAJECTORY
========================================================= */

function updateSkiTrajectory(
  state
) {

  drawTrajectoryCanvas(
    "skiTrajectoryCanvas",
    state.trajectory
  );

}


/* =========================================================
   57. ROLLER CHART
========================================================= */

function updateRollerChart(
  state
) {

  if (
    typeof Chart ===
    "undefined"
  ) {

    return;
  }


  const canvas =
    document.getElementById(
      "rollerCycleChart"
    );


  if (!canvas) {
    return;
  }


  const data =
    state.angleHistory
      .slice(-120);


  const labels =
    data.map(
      item =>
        Number(
          item.time
        ).toFixed(1)
    );


  const values =
    data.map(
      item =>
        average([
          item.leftKnee,
          item.rightKnee
        ])
    );


  if (
    AnalysisCharts.rollerCycle
  ) {

    AnalysisCharts.rollerCycle
      .destroy();

  }


  AnalysisCharts.rollerCycle =
    new Chart(
      canvas,
      {

        type: "line",

        data: {

          labels,

          datasets: [

            {
              label:
                "무릎 평균각",

              data: values,

              borderWidth: 2,

              pointRadius: 0,

              tension: 0.3

            }

          ]

        },

        options: {

          responsive: true,

          maintainAspectRatio:
            false,

          animation: false,

          plugins: {

            legend: {
              position:
                "bottom"
            }

          }

        }

      }
    );


  drawTrajectoryCanvas(
    "rollerTrajectoryCanvas",
    state.trajectory
  );

}


/* =========================================================
   58. SHOOTING CHARTS
========================================================= */

function updateShootingCharts(
  state
) {

  if (
    typeof Chart ===
    "undefined"
  ) {

    return;
  }


  const triggerCanvas =
    document.getElementById(
      "triggerChart"
    );


  const angleCanvas =
    document.getElementById(
      "shootingAngleChart"
    );


  if (
    triggerCanvas
  ) {

    const triggerLabels =
      state.triggerData.map(
        item =>
          formatTime(
            item.time
          )
      );


    const triggerValues =
      state.triggerData.map(
        item =>
          item.confidence * 100
      );


    if (
      AnalysisCharts.shootingTrigger
    ) {

      AnalysisCharts
        .shootingTrigger
        .destroy();

    }


    AnalysisCharts.shootingTrigger =
      new Chart(
        triggerCanvas,
        {

          type: "line",

          data: {

            labels:
              triggerLabels,

            datasets: [

              {
                label:
                  "격발 후보 신뢰도",

                data:
                  triggerValues,

                borderWidth: 2,

                pointRadius: 4,

                tension: 0.2

              }

            ]

          },

          options: {

            responsive: true,

            maintainAspectRatio:
              false,

            animation: false,

            scales: {

              y: {

                min: 0,
                max: 100,

                title: {

                  display: true,

                  text:
                    "신뢰도(%)"

                }

              }

            }

          }

        }
      );

  }


  if (
    angleCanvas
  ) {

    const data =
      state.angleHistory
        .slice(-120);


    const labels =
      data.map(
        item =>
          Number(
            item.time
          ).toFixed(1)
      );


    const values =
      data.map(
        item =>
          average([
            item.leftKnee,
            item.rightKnee
          ])
      );


    if (
      AnalysisCharts.shootingAngle
    ) {

      AnalysisCharts
        .shootingAngle
        .destroy();

    }


    AnalysisCharts.shootingAngle =
      new Chart(
        angleCanvas,
        {

          type: "line",

          data: {

            labels,

            datasets: [

              {
                label:
                  "무릎 평균각",

                data: values,

                borderWidth: 2,

                pointRadius: 0,

                tension: 0.25

              }

            ]

          },

          options: {

            responsive: true,

            maintainAspectRatio:
              false,

            animation: false

          }

        }
      );

  }


  drawTrajectoryCanvas(
    "shootingTrajectoryCanvas",
    state.trajectory
  );

}


/* =========================================================
   59. TRAJECTORY CANVAS
========================================================= */

function drawTrajectoryCanvas(
  canvasId,
  trajectory
) {

  const canvas =
    document.getElementById(
      canvasId
    );


  if (!canvas) {
    return;
  }


  const rect =
    canvas.getBoundingClientRect();


  const width =
    Math.max(
      1,
      Math.round(
        rect.width
      )
    );


  const height =
    Math.max(
      1,
      Math.round(
        rect.height
      )
    );


  const dpr =
    window.devicePixelRatio ||
    1;


  canvas.width =
    width * dpr;

  canvas.height =
    height * dpr;


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


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  if (
    !trajectory ||
    trajectory.length < 2
  ) {

    return;
  }


  ctx.beginPath();


  trajectory.forEach(
    (point, index) => {

      const x =
        point.x *
        width;

      const y =
        point.y *
        height;


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


  ctx.strokeStyle =
    "#245b78";

  ctx.lineWidth = 2.5;

  ctx.lineJoin =
    "round";

  ctx.lineCap =
    "round";


  ctx.stroke();


  const last =
    trajectory[
      trajectory.length - 1
    ];


  if (last) {

    ctx.beginPath();

    ctx.arc(
      last.x * width,
      last.y * height,
      5,
      0,
      Math.PI * 2
    );


    ctx.fillStyle =
      "#163b52";

    ctx.fill();

  }

}


/* =========================================================
   60. SAVE ANALYSIS
========================================================= */

function saveAnalysis(
  type,
  state
) {

  if (
    !window.BiathlonEvents
  ) {

    return;
  }


  const record =
    BiathlonEvents
      .createAnalysisRecord({

        type,

        camera:
          state.camera ||
          "side",

        shootingMode:
          type === "shooting"
            ? state.mode
            : null,

        score:
          state.score,

        angles:
          getLatestAngles(
            state
          ),

        trajectory:
          state.trajectory
            .slice(),

        keyFrames:
          state.keyFrames
            .slice(),

        shots:
          state.shots
            .slice(),

        triggerData:
          state.triggerData
            .slice(),

        metrics:
          getMetricsForType(
            type,
            state
          ),

        feedback:
          generateFeedback(
            type,
            state
          ),

        videoName:
          state.videoFileName ||
          "",

        videoDuration:
          state.duration ||
          0

      });


  if (
    window.ReportSystem
  ) {

    ReportSystem.setCurrentRecord(
      record
    );

  }

}


/* =========================================================
   61. LATEST ANGLES
========================================================= */

function getLatestAngles(
  state
) {

  return (
    state.angleHistory[
      state.angleHistory.length - 1
    ] || {}
  );

}


/* =========================================================
   62. METRICS
========================================================= */

function getMetricsForType(
  type,
  state
) {

  const latest =
    getLatestAngles(
      state
    );


  const symmetry =
    calculateSymmetry(
      state.angleHistory
    );


  const stability =
    calculateTrajectoryStability(
      state.trajectory
    );


  const consistency =
    calculateConsistency(
      state.angleHistory
    );


  return {

    symmetry,

    stability,

    consistency,

    leftKnee:
      latest.leftKnee,

    rightKnee:
      latest.rightKnee,

    leftHip:
      latest.leftHip,

    rightHip:
      latest.rightHip,

    trunk:
      latest.trunk

  };

}


/* =========================================================
   63. FEEDBACK
========================================================= */

function generateFeedback(
  type,
  state
) {

  const metrics =
    getMetricsForType(
      type,
      state
    );


  const feedback = {

    summary: "",

    strengths: [],

    improvements: [],

    coach: ""

  };


  if (
    metrics.symmetry >= 85
  ) {

    feedback.strengths.push(
      "좌우 자세 대칭성이 안정적입니다."
    );

  } else {

    feedback.improvements.push(
      "좌우 움직임의 차이를 줄이는 것이 좋습니다."
    );

  }


  if (
    metrics.stability >= 85
  ) {

    feedback.strengths.push(
      "신체중심의 흔들림이 비교적 안정적입니다."
    );

  } else {

    feedback.improvements.push(
      "동작 중 신체중심의 불필요한 흔들림을 줄여보세요."
    );

  }


  if (
    metrics.consistency >= 85
  ) {

    feedback.strengths.push(
      "동작 반복성이 좋습니다."
    );

  } else {

    feedback.improvements.push(
      "반복 동작의 일관성을 높이는 훈련이 필요합니다."
    );

  }


  if (type === "shooting") {

    feedback.summary =
      "사격 자세의 안정성과 격발 전후 움직임을 확인했습니다.";

    feedback.coach =
      "격발 직전 자세를 일정하게 유지하는 데 집중하세요.";

  } else if (type === "roller") {

    feedback.summary =
      "롤러스키 추진과 회복 동작의 변화를 분석했습니다.";

    feedback.coach =
      "좌우 추진의 리듬과 중심 이동을 일정하게 유지해보세요.";

  } else {

    feedback.summary =
      "스키 동작 중 관절각과 중심 궤적을 분석했습니다.";

    feedback.coach =
      "추진 구간에서 중심 이동과 하체 각도의 일관성을 확인해보세요.";

  }


  return feedback;

}


/* =========================================================
   64. TEXT
========================================================= */

function setText(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );


  if (element) {

    element.textContent =
      value;

  }

}


/* =========================================================
   65. REPORT BUTTON
========================================================= */

document.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        "[data-report-type]"
      );


    if (!button) {
      return;
    }


    const type =
      button.dataset.reportType;


    if (
      window.ReportSystem
    ) {

      ReportSystem.open(
        type
      );

    }


    if (
      window.BiathlonEvents
    ) {

      BiathlonEvents.changePage(
        "report"
      );

    }

  }
);


/* =========================================================
   66. WINDOW RESIZE
========================================================= */

window.addEventListener(
  "resize",
  () => {

    drawTrajectoryCanvas(
      "skiTrajectoryCanvas",
      AnalysisState.ski.trajectory
    );


    drawTrajectoryCanvas(
      "rollerTrajectoryCanvas",
      AnalysisState.roller.trajectory
    );


    drawTrajectoryCanvas(
      "shootingTrajectoryCanvas",
      AnalysisState.shooting.trajectory
    );

  }
);


/* =========================================================
   67. INIT
========================================================= */

function initBiathlonApp() {

  initSkiAnalysis();

  initRollerAnalysis();

  initShootingAnalysis();


  if (
    window.BiathlonEvents
  ) {

    BiathlonEvents.showToast(
      "설천 바이애슬론 분석 시스템 준비 완료"
    );

  }

}


/* =========================================================
   68. START
========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initBiathlonApp
  );

} else {

  initBiathlonApp();

}