/* =========================================================
   설천 BIATHLON 자세분석 PRO
   events.js
   ---------------------------------------------------------
   - 키보드 단축키
   - 프레임 이동
   - 격발 이벤트
   - 총구 기준점 지정 모드
   - 북마크
   - 자세 캡처
   - 분석 도구 연결
========================================================= */

"use strict";


/* =========================================================
   01. STATE
========================================================= */

const EVENTS = {

  muzzleSelectMode: false,

  selectedType: null,

  frameStep: {
    normal: 1 / 30,
    shooting: 1 / 60
  },

  shortcutsEnabled: true

};


/* =========================================================
   02. HELPERS
========================================================= */

function eventVideo(type) {

  return (
    window.SeolcheonApp
      ?.APP
      ?.videos
      ?. [type]
  ) || null;

}


function eventToast(message) {

  if (
    typeof window.toast ===
    "function"
  ) {

    window.toast(message);

    return;

  }


  const toast =
    document.querySelector(
      "#toast"
    );


  if (!toast) return;


  toast.textContent =
    message;

  toast.style.opacity =
    "1";

  toast.style.transform =
    "translateY(0)";


  setTimeout(
    () => {

      toast.style.opacity =
        "0";

      toast.style.transform =
        "translateY(8px)";

    },
    2000
  );

}


/* =========================================================
   03. FRAME CONTROL
========================================================= */

function moveFrame(
  type,
  direction
) {

  const video =
    eventVideo(type);


  if (
    !video ||
    !video.src
  ) {

    eventToast(
      "먼저 영상을 선택하세요."
    );

    return;

  }


  video.pause();


  const step =
    type === "shooting"
      ? EVENTS.frameStep.shooting
      : EVENTS.frameStep.normal;


  video.currentTime =
    Math.max(
      0,
      Math.min(
        video.duration || Infinity,
        video.currentTime +
          step * direction
      )
    );


  updateTimeUI(
    type
  );

}


function updateTimeUI(type) {

  const video =
    eventVideo(type);


  if (!video) return;


  const seek =
    document.querySelector(
      `#${type}Seek`
    );


  if (
    seek &&
    video.duration
  ) {

    seek.value =
      (
        video.currentTime /
        video.duration
      ) * 100;

  }

}


/* =========================================================
   04. EXACT FRAME
========================================================= */

function moveFrameFast(
  type,
  direction
) {

  const video =
    eventVideo(type);


  if (
    !video ||
    !video.src
  ) {
    return;
  }


  video.pause();


  const step =
    type === "shooting"
      ? 1 / 15
      : 1 / 10;


  video.currentTime =
    Math.max(
      0,
      Math.min(
        video.duration || Infinity,
        video.currentTime +
          step * direction
      )
    );


  updateTimeUI(
    type
  );

}


/* =========================================================
   05. MUZZLE MODE
========================================================= */

function enableMuzzleSelection() {

  EVENTS.muzzleSelectMode =
    true;

  EVENTS.selectedType =
    "shooting";


  const canvas =
    document.querySelector(
      "#shootingMuzzleCanvas"
    );


  if (canvas) {

    canvas.style.pointerEvents =
      "auto";

    canvas.style.cursor =
      "crosshair";

  }


  eventToast(
    "영상에서 총구 위치를 눌러주세요."
  );

}


function disableMuzzleSelection() {

  EVENTS.muzzleSelectMode =
    false;

  EVENTS.selectedType =
    null;


  const canvas =
    document.querySelector(
      "#shootingMuzzleCanvas"
    );


  if (canvas) {

    canvas.style.cursor =
      "default";

  }

}


/* =========================================================
   06. MUZZLE CLICK
========================================================= */

function handleMuzzleClick(
  event
) {

  if (
    !EVENTS.muzzleSelectMode
  ) {
    return;
  }


  const canvas =
    event.currentTarget;


  const rect =
    canvas.getBoundingClientRect();


  if (
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return;
  }


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


  const app =
    window.SeolcheonApp?.APP;


  if (!app) return;


  app.shooting.muzzlePoint = {

    x: Math.max(
      0,
      Math.min(
        1,
        x
      )
    ),

    y: Math.max(
      0,
      Math.min(
        1,
        y
      )
    )

  };


  EVENTS.muzzleSelectMode =
    false;


  canvas.style.cursor =
    "default";


  if (
    typeof window.updateMuzzleStatus ===
    "function"
  ) {

    window.updateMuzzleStatus();

  }


  if (
    typeof window.drawMuzzleMarker ===
    "function"
  ) {

    window.drawMuzzleMarker();

  }


  eventToast(
    "총구 기준점을 지정했습니다."
  );

}


/* =========================================================
   07. SHOT EVENT
========================================================= */

function triggerShot() {

  if (
    typeof window.SeolcheonApp
      ?.markShotEvent ===
    "function"
  ) {

    window.SeolcheonApp
      .markShotEvent();

    return;

  }


  /*
   * app.js가 직접 노출하지 않은 경우
   * 내부 객체를 이용한다.
   */

  const app =
    window.SeolcheonApp?.APP;


  if (!app) return;


  const video =
    app.videos.shooting;


  if (
    !video ||
    !video.src
  ) {

    eventToast(
      "사격 영상을 먼저 선택하세요."
    );

    return;

  }


  if (
    app.shooting.shotEvents.length >=
    app.shooting.maxShots
  ) {

    eventToast(
      "격발 이벤트는 최대 5개입니다."
    );

    return;

  }


  const id =
    `shot-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;


  app.shooting.shotEvents.push({

    id,

    index:
      app.shooting.shotEvents.length +
      1,

    time:
      video.currentTime,

    frame:
      Math.round(
        video.currentTime * 60
      ),

    confidence:
      app.tracking.confidence,

    createdAt:
      new Date().toISOString()

  });


  app.shooting.shotEvents.sort(
    (a, b) =>
      a.time - b.time
  );


  app.shooting.shotEvents.forEach(
    (item, index) => {

      item.index =
        index + 1;

    }
  );


  if (
    typeof window.renderShotEvents ===
    "function"
  ) {

    window.renderShotEvents();

  }


  eventToast(
    "격발 이벤트를 기록했습니다."
  );

}


/* =========================================================
   08. KEYBOARD SHORTCUTS
========================================================= */

function handleKeyboard(
  event
) {

  if (
    !EVENTS.shortcutsEnabled
  ) {
    return;
  }


  const target =
    event.target;


  /*
   * 입력창에서는 단축키를
   * 작동시키지 않는다.
   */

  if (
    target &&
    (
      target.tagName ===
        "INPUT" ||
      target.tagName ===
        "SELECT" ||
      target.tagName ===
        "TEXTAREA"
    )
  ) {

    return;

  }


  const key =
    event.key.toLowerCase();


  const page =
    window.SeolcheonApp
      ?.APP
      ?.currentPage;


  let type =
    null;


  if (page === "ski") {

    type = "ski";

  }


  if (page === "roller") {

    type = "roller";

  }


  if (page === "shooting") {

    type = "shooting";

  }


  /*
   * Space
   * 재생 / 일시정지
   */

  if (
    event.code ===
    "Space"
  ) {

    event.preventDefault();


    if (!type) return;


    const video =
      eventVideo(type);


    if (!video) return;


    if (
      video.paused
    ) {

      video.play();

    } else {

      video.pause();

    }


    return;

  }


  /*
   * ← / →
   * 한 프레임
   */

  if (
    event.key ===
    "ArrowLeft"
  ) {

    if (type) {

      moveFrame(
        type,
        -1
      );

    }

    return;

  }


  if (
    event.key ===
    "ArrowRight"
  ) {

    if (type) {

      moveFrame(
        type,
        1
      );

    }

    return;

  }


  /*
   * Shift + ← / →
   * 조금 크게 이동
   */

  if (
    event.shiftKey &&
    event.key ===
      "ArrowLeft"
  ) {

    if (type) {

      moveFrameFast(
        type,
        -1
      );

    }

    return;

  }


  if (
    event.shiftKey &&
    event.key ===
      "ArrowRight"
  ) {

    if (type) {

      moveFrameFast(
        type,
        1
      );

    }

    return;

  }


  /*
   * S
   * 사격 격발
   */

  if (
    key === "s" &&
    page === "shooting"
  ) {

    triggerShot();

    return;

  }


  /*
   * M
   * 총구 지정
   */

  if (
    key === "m" &&
    page === "shooting"
  ) {

    enableMuzzleSelection();

    return;

  }


  /*
   * C
   * 자세 캡처
   */

  if (
    key === "c" &&
    type
  ) {

    if (
      typeof window.SeolcheonApp
        ?.capturePose ===
      "function"
    ) {

      window.SeolcheonApp
        .capturePose(type);

    }

    return;

  }


  /*
   * B
   * 북마크
   */

  if (
    key === "b" &&
    type
  ) {

    if (
      typeof window.SeolcheonApp
        ?.bookmarkFrame ===
      "function"
    ) {

      window.SeolcheonApp
        .bookmarkFrame(type);

    }

    return;

  }

}


/* =========================================================
   09. DOUBLE CLICK = SHOT
========================================================= */

function setupShootingTimeline() {

  const video =
    document.querySelector(
      "#shootingVideo"
    );


  if (!video) return;


  video.addEventListener(
    "dblclick",
    event => {

      /*
       * 영상 자체를 더블클릭하면
       * 격발 이벤트로 기록.
       */

      event.preventDefault();

      triggerShot();

    }
  );

}


/* =========================================================
   10. BUTTON BINDING
========================================================= */

function bindEventButtons() {

  /*
   * 프레임 버튼
   */

  document.addEventListener(
    "click",
    event => {

      const target =
        event.target.closest(
          "[data-frame]"
        );


      if (!target) return;


      const type =
        target.dataset.type;


      const direction =
        Number(
          target.dataset.frame
        );


      if (
        type &&
        Number.isFinite(
          direction
        )
      ) {

        moveFrame(
          type,
          direction
        );

      }

    }
  );


  /*
   * 총구 선택
   */

  document.addEventListener(
    "click",
    event => {

      const target =
        event.target.closest(
          "[data-muzzle-select]"
        );


      if (!target) return;


      enableMuzzleSelection();

    }
  );


  /*
   * 격발
   */

  document.addEventListener(
    "click",
    event => {

      const target =
        event.target.closest(
          "[data-shot]"
        );


      if (!target) return;


      triggerShot();

    }
  );


  /*
   * 초기화
   */

  document.addEventListener(
    "click",
    event => {

      const target =
        event.target.closest(
          "[data-clear-shots]"
        );


      if (!target) return;


      if (
        typeof window.SeolcheonApp
          ?.clearShotEvents ===
        "function"
      ) {

        window.SeolcheonApp
          .clearShotEvents();

      }

    }
  );

}


/* =========================================================
   11. MUZZLE CANVAS BINDING
========================================================= */

function bindMuzzleCanvas() {

  const canvas =
    document.querySelector(
      "#shootingMuzzleCanvas"
    );


  if (!canvas) return;


  canvas.addEventListener(
    "click",
    handleMuzzleClick
  );

}


/* =========================================================
   12. CAMERA CHANGE EVENTS
========================================================= */

function setupCameraEvents() {

  document.addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          ".camera-button"
        );


      if (!button) return;


      const camera =
        button.dataset.camera;


      if (!camera) return;


      eventToast(
        `카메라 방향: ${
          camera === "side"
            ? "측면"
            : camera === "front"
              ? "정면"
              : "후면"
        }`
      );

    }
  );

}


/* =========================================================
   13. VIDEO RATE
========================================================= */

function setupSpeedEvents() {

  document.addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          "[data-speed]"
        );


      if (!button) return;


      const type =
        button.dataset.type;


      const rate =
        Number(
          button.dataset.speed
        );


      const video =
        eventVideo(type);


      if (
        !video ||
        !Number.isFinite(rate)
      ) {
        return;
      }


      video.playbackRate =
        rate;


      eventToast(
        `재생속도 ${rate}×`
      );

    }
  );

}


/* =========================================================
   14. TIMELINE UPDATE
========================================================= */

function setupTimelineEvents() {

  [
    "ski",
    "roller",
    "shooting"
  ].forEach(
    type => {

      const video =
        eventVideo(type);


      if (!video) return;


      video.addEventListener(
        "timeupdate",
        () => {

          updateTimeUI(
            type
          );

        }
      );

    }
  );

}


/* =========================================================
   15. INIT
========================================================= */

function initializeEvents() {

  bindEventButtons();

  bindMuzzleCanvas();

  setupCameraEvents();

  setupSpeedEvents();

  setupTimelineEvents();

  setupShootingTimeline();


  document.addEventListener(
    "keydown",
    handleKeyboard
  );


  console.log(
    "설천 events.js 연결 완료"
  );

}


if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initializeEvents
  );

} else {

  initializeEvents();

}


/* =========================================================
   16. PUBLIC API
========================================================= */

window.SeolcheonEvents = {

  moveFrame,

  moveFrameFast,

  triggerShot,

  enableMuzzleSelection,

  disableMuzzleSelection,

  handleMuzzleClick

};


/* =========================================================
   END
========================================================= */