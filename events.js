/* =========================================================
   설천 BIATHLON PERFORMANCE CENTER PRO
   events.js
   ---------------------------------------------------------
   공통 데이터 저장 / 페이지 이동 / UI 이벤트
========================================================= */


/* =========================================================
   01. LOCAL STORAGE STORE
========================================================= */

const Store = {

  key:
    "seolcheon-biathlon-pro-v2",

  records: [],

  current: null,


  load() {

    try {

      this.records =
        JSON.parse(
          localStorage.getItem(
            this.key
          ) || "[]"
        );

    } catch (error) {

      console.warn(
        "기록 데이터를 불러오지 못했습니다.",
        error
      );

      this.records = [];

    }

  },


  save() {

    localStorage.setItem(
      this.key,
      JSON.stringify(
        this.records
      )
    );

  },


  add(record) {

    const id =
      typeof crypto !== "undefined" &&
      crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;


    record.id = id;

    record.createdAt =
      new Date().toISOString();


    this.records.unshift(
      record
    );


    this.save();


    this.current =
      record.id;


    return record;

  },


  get(id) {

    return this.records.find(
      record =>
        record.id === id
    ) || null;

  },


  remove(id) {

    this.records =
      this.records.filter(
        record =>
          record.id !== id
      );


    this.save();


    if (
      this.current === id
    ) {

      this.current =
        this.records[0]?.id ||
        null;

    }

  },


  latest(type = null) {

    if (!type) {

      return (
        this.records[0] ||
        null
      );

    }


    return (
      this.records.find(
        record =>
          record.type === type
      ) || null
    );

  }

};


/* =========================================================
   02. LOAD DATA
========================================================= */

Store.load();


/* =========================================================
   03. UI CONTROLLER
========================================================= */

const UI = {

  pageTitles: {

    dashboard:
      "대시보드",

    ski:
      "스키 자세분석",

    roller:
      "롤러스키 자세분석",

    shooting:
      "사격 자세분석",

    compare:
      "비교분석",

    records:
      "분석 기록",

    report:
      "리포트"

  },


  /* -------------------------------------------------------
     페이지 이동
  ------------------------------------------------------- */

  go(page) {

    document
      .querySelectorAll(
        ".page"
      )
      .forEach(
        section => {

          section.classList.toggle(
            "active",
            section.id === page
          );

        }
      );


    document
      .querySelectorAll(
        ".sidebar nav button"
      )
      .forEach(
        button => {

          button.classList.toggle(
            "active",
            button.dataset.page === page
          );

        }
      );


    const title =
      document.getElementById(
        "pageTitle"
      );


    if (title) {

      title.textContent =
        this.pageTitles[page] ||
        page;

    }


    /*
     * 모바일 메뉴 닫기
     */

    const sidebar =
      document.querySelector(
        ".sidebar"
      );


    if (
      sidebar &&
      window.innerWidth <= 700
    ) {

      sidebar.classList.remove(
        "open"
      );

    }


    /*
     * 페이지별 갱신
     */

    if (
      page === "dashboard" &&
      window.App
    ) {

      App.refreshDashboard();

    }


    if (
      page === "records" &&
      window.App
    ) {

      App.renderRecords();

    }


    if (
      page === "compare" &&
      window.App
    ) {

      App.refreshCompare();

    }


    if (
      page === "report" &&
      window.Report
    ) {

      Report.render(
        Store.current ||
        Store.records[0]?.id ||
        null
      );

    }

  },


  /* -------------------------------------------------------
     토스트
  ------------------------------------------------------- */

  toast(message) {

    let toast =
      document.getElementById(
        "toast"
      );


    if (!toast) {

      toast =
        document.createElement(
          "div"
        );


      toast.id =
        "toast";


      toast.style.cssText = `
        position:fixed;
        right:20px;
        bottom:20px;
        z-index:9999;
        max-width:calc(100vw - 40px);
        padding:12px 17px;
        border-radius:11px;
        background:#173c50;
        color:#fff;
        font-size:13px;
        box-shadow:0 8px 25px rgba(0,0,0,.18);
        animation:toastIn .2s ease;
      `;


      document.body.appendChild(
        toast
      );

    }


    toast.textContent =
      message;


    clearTimeout(
      toast._timer
    );


    toast._timer =
      setTimeout(
        () => {

          toast.style.opacity =
            "0";


          toast.style.transform =
            "translateY(6px)";


          setTimeout(
            () => toast.remove(),
            180
          );

        },
        1800
      );

  }

};


/* =========================================================
   04. GLOBAL PAGE BUTTON EVENT
========================================================= */

document.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        "[data-page]"
      );


    if (!button) {
      return;
    }


    const page =
      button.dataset.page;


    if (!page) {
      return;
    }


    UI.go(
      page
    );

  }
);


/* =========================================================
   05. MOBILE MENU
========================================================= */

const menuButton =
  document.getElementById(
    "menuButton"
  );


if (menuButton) {

  menuButton.addEventListener(
    "click",
    () => {

      const sidebar =
        document.querySelector(
          ".sidebar"
        );


      sidebar?.classList.toggle(
        "open"
      );

    }
  );

}


/* =========================================================
   06. CLOCK
========================================================= */

function updateClock() {

  const clock =
    document.getElementById(
      "clock"
    );


  if (!clock) {
    return;
  }


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


updateClock();


setInterval(
  updateClock,
  1000
);


/* =========================================================
   07. GLOBAL KEYBOARD SHORTCUTS
========================================================= */

document.addEventListener(
  "keydown",
  event => {

    /*
     * 입력창에서는 단축키 무시
     */

    const tag =
      event.target?.tagName;


    if (
      tag === "INPUT" ||
      tag === "SELECT" ||
      tag === "TEXTAREA"
    ) {

      return;

    }


    /*
     * Space
     * 현재 영상 재생 / 일시정지
     */

    if (
      event.code === "Space"
    ) {

      const activePage =
        document.querySelector(
          ".page.active"
        );


      const videos =
        activePage?.querySelectorAll(
          "video"
        );


      if (
        videos &&
        videos.length
      ) {

        event.preventDefault();


        const video =
          videos[0];


        if (
          video.paused
        ) {

          video.play();

        } else {

          video.pause();

        }

      }

    }


    /*
     * ArrowLeft
     * 한 프레임 전
     */

    if (
      event.code === "ArrowLeft"
    ) {

      const activePage =
        document.querySelector(
          ".page.active"
        );


      const button =
        activePage?.querySelector(
          ".controls button:first-child"
        );


      button?.click();

    }


    /*
     * ArrowRight
     * 한 프레임 후
     */

    if (
      event.code === "ArrowRight"
    ) {

      const activePage =
        document.querySelector(
          ".page.active"
        );


      const buttons =
        activePage?.querySelectorAll(
          ".controls button"
        );


      if (
        buttons &&
        buttons.length >= 3
      ) {

        buttons[2].click();

      }

    }

  }
);


/* =========================================================
   08. BEFORE UNLOAD
========================================================= */

window.addEventListener(
  "beforeunload",
  () => {

    try {

      Store.save();

    } catch (error) {

      console.warn(
        "종료 전 데이터 저장 실패",
        error
      );

    }

  }
);


/* =========================================================
   09. STORAGE CHANGE
========================================================= */

window.addEventListener(
  "storage",
  event => {

    if (
      event.key !==
      Store.key
    ) {

      return;

    }


    Store.load();


    if (
      window.App
    ) {

      App.refreshDashboard();

      App.renderRecords();

      App.refreshCompare();

    }


    if (
      window.Report &&
      document
        .getElementById("report")
        ?.classList.contains(
          "active"
        )
    ) {

      Report.render(
        Store.current ||
        Store.records[0]?.id ||
        null
      );

    }

  }
);


/* =========================================================
   10. DEFAULT PAGE
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    UI.go(
      "dashboard"
    );

  }
);


/* =========================================================
   11. SIMPLE TOAST STYLE
========================================================= */

const toastStyle =
  document.createElement(
    "style"
  );


toastStyle.textContent = `

@keyframes toastIn {

  from {

    opacity:0;

    transform:
      translateY(8px);

  }

  to {

    opacity:1;

    transform:
      translateY(0);

  }

}

`;


document.head.appendChild(
  toastStyle
);


/* =========================================================
   12. PUBLIC EVENTS API
========================================================= */

window.BiathlonEvents = {

  store:
    Store,

  ui:
    UI,

  toast:
    message =>
      UI.toast(
        message
      )

};