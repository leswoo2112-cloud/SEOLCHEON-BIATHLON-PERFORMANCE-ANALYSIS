/* =========================================================
   설천 바이애슬론 자세분석 PRO
   events.js
   ---------------------------------------------------------
   - 선수 데이터 관리
   - 분석 세션 관리
   - 로컬 저장
   - 공통 이벤트
   - 기록 검색 / 필터
   ========================================================= */


/* =========================================================
   01. STORAGE
========================================================= */

const STORAGE_KEYS = {
  athletes: "seolcheon_biathlon_athletes",
  records: "seolcheon_biathlon_records",
  settings: "seolcheon_biathlon_settings"
};


/* =========================================================
   02. SAFE STORAGE
========================================================= */

function loadStorage(key, fallback = []) {
  try {
    const value = localStorage.getItem(key);

    if (!value) {
      return fallback;
    }

    const parsed = JSON.parse(value);

    return parsed ?? fallback;

  } catch (error) {
    console.warn("Storage load error:", error);
    return fallback;
  }
}


function saveStorage(key, value) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );

    return true;

  } catch (error) {
    console.warn("Storage save error:", error);
    return false;
  }
}


/* =========================================================
   03. GLOBAL STATE
========================================================= */

window.BiathlonStore = {

  athletes:
    loadStorage(
      STORAGE_KEYS.athletes,
      []
    ),

  records:
    loadStorage(
      STORAGE_KEYS.records,
      []
    ),

  settings:
    loadStorage(
      STORAGE_KEYS.settings,
      {
        camera: "side",
        shootingMode: "prone",
        currentPage: "dashboard"
      }
    ),

  currentAthleteId: null,

  currentRecordId: null

};


/* =========================================================
   04. ID
========================================================= */

function createId(prefix = "id") {

  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    "_" +
    Math.random()
      .toString(36)
      .slice(2, 8)
  );

}


/* =========================================================
   05. DATE
========================================================= */

function getDateTimeString(date = new Date()) {

  const year =
    date.getFullYear();

  const month =
    String(date.getMonth() + 1)
      .padStart(2, "0");

  const day =
    String(date.getDate())
      .padStart(2, "0");

  const hour =
    String(date.getHours())
      .padStart(2, "0");

  const minute =
    String(date.getMinutes())
      .padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}`;

}


/* =========================================================
   06. ATHLETE
========================================================= */

function addAthlete(data = {}) {

  const name =
    String(data.name || "").trim();

  if (!name) {

    showToast(
      "선수 이름을 입력하세요."
    );

    return null;
  }


  const athlete = {

    id: createId("athlete"),

    name,

    birth:
      String(data.birth || "").trim(),

    team:
      String(data.team || "").trim(),

    event:
      data.event || "ski",

    createdAt:
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString()

  };


  BiathlonStore.athletes.push(
    athlete
  );


  saveStorage(
    STORAGE_KEYS.athletes,
    BiathlonStore.athletes
  );


  BiathlonStore.currentAthleteId =
    athlete.id;


  updateCurrentAthleteUI();

  renderAthleteList();

  showToast(
    `${athlete.name} 선수가 등록되었습니다.`
  );


  return athlete;
}


/* =========================================================
   07. UPDATE ATHLETE
========================================================= */

function updateAthlete(
  athleteId,
  data = {}
) {

  const athlete =
    BiathlonStore.athletes.find(
      item => item.id === athleteId
    );


  if (!athlete) {
    return null;
  }


  if (data.name !== undefined) {

    athlete.name =
      String(data.name).trim();

  }


  if (data.birth !== undefined) {

    athlete.birth =
      String(data.birth).trim();

  }


  if (data.team !== undefined) {

    athlete.team =
      String(data.team).trim();

  }


  if (data.event !== undefined) {

    athlete.event =
      data.event;

  }


  athlete.updatedAt =
    new Date().toISOString();


  saveStorage(
    STORAGE_KEYS.athletes,
    BiathlonStore.athletes
  );


  updateCurrentAthleteUI();

  renderAthleteList();


  return athlete;
}


/* =========================================================
   08. DELETE ATHLETE
========================================================= */

function deleteAthlete(
  athleteId
) {

  const athlete =
    BiathlonStore.athletes.find(
      item => item.id === athleteId
    );


  if (!athlete) {
    return false;
  }


  const confirmed =
    window.confirm(
      `${athlete.name} 선수를 삭제할까요?`
    );


  if (!confirmed) {
    return false;
  }


  BiathlonStore.athletes =
    BiathlonStore.athletes.filter(
      item => item.id !== athleteId
    );


  BiathlonStore.records =
    BiathlonStore.records.filter(
      record =>
        record.athleteId !== athleteId
    );


  saveStorage(
    STORAGE_KEYS.athletes,
    BiathlonStore.athletes
  );


  saveStorage(
    STORAGE_KEYS.records,
    BiathlonStore.records
  );


  if (
    BiathlonStore.currentAthleteId ===
    athleteId
  ) {

    BiathlonStore.currentAthleteId =
      BiathlonStore.athletes[0]?.id ||
      null;

  }


  updateCurrentAthleteUI();

  renderAthleteList();

  renderRecordList();


  showToast(
    "선수와 관련 기록을 삭제했습니다."
  );


  return true;
}


/* =========================================================
   09. SELECT ATHLETE
========================================================= */

function selectAthlete(
  athleteId
) {

  const athlete =
    BiathlonStore.athletes.find(
      item => item.id === athleteId
    );


  if (!athlete) {
    return null;
  }


  BiathlonStore.currentAthleteId =
    athlete.id;


  updateCurrentAthleteUI();

  renderAthleteList();

  showToast(
    `${athlete.name} 선수가 선택되었습니다.`
  );


  return athlete;
}


/* =========================================================
   10. GET CURRENT ATHLETE
========================================================= */

function getCurrentAthlete() {

  return BiathlonStore.athletes.find(
    athlete =>
      athlete.id ===
      BiathlonStore.currentAthleteId
  ) || null;

}


/* =========================================================
   11. ATHLETE UI
========================================================= */

function updateCurrentAthleteUI() {

  const athlete =
    getCurrentAthlete();


  const nameElement =
    document.getElementById(
      "currentAthleteName"
    );


  const metaElement =
    document.getElementById(
      "currentAthleteMeta"
    );


  if (!nameElement ||
      !metaElement) {

    return;
  }


  if (!athlete) {

    nameElement.textContent =
      "선수 미선택";

    metaElement.textContent =
      "분석 선수를 선택하세요";

    return;
  }


  nameElement.textContent =
    athlete.name;


  const meta = [
    athlete.team,
    athlete.birth
  ]
    .filter(Boolean)
    .join(" · ");


  metaElement.textContent =
    meta ||
    "바이애슬론 선수";
}


/* =========================================================
   12. RENDER ATHLETES
========================================================= */

function renderAthleteList() {

  const container =
    document.getElementById(
      "athleteList"
    );


  if (!container) {
    return;
  }


  if (
    BiathlonStore.athletes.length === 0
  ) {

    container.innerHTML = `
      <div class="empty-state">
        등록된 선수가 없습니다.
      </div>
    `;

    return;
  }


  container.innerHTML =
    BiathlonStore.athletes
      .map(athlete => {

        const selected =
          athlete.id ===
          BiathlonStore.currentAthleteId;


        const eventName =
          getEventName(
            athlete.event
          );


        return `
          <div
            class="athlete-list-item
              ${selected ? "selected" : ""}"
            data-athlete-id="${athlete.id}"
          >

            <div class="athlete-avatar">
              ${escapeHtml(
                athlete.name
                  .slice(0, 1)
              )}
            </div>


            <div class="athlete-list-info">

              <strong>
                ${escapeHtml(
                  athlete.name
                )}
              </strong>

              <span>
                ${escapeHtml(
                  athlete.team || "소속 미입력"
                )}
                ·
                ${eventName}
              </span>

            </div>


            <button
              type="button"
              class="secondary-button athlete-select-button"
              data-select-athlete="${athlete.id}"
            >
              ${selected ? "선택됨" : "선택"}
            </button>


            <button
              type="button"
              class="icon-button athlete-delete-button"
              data-delete-athlete="${athlete.id}"
              title="삭제"
            >
              ×
            </button>

          </div>
        `;

      })
      .join("");

}


/* =========================================================
   13. EVENT NAME
========================================================= */

function getEventName(type) {

  const names = {

    ski: "스키",

    roller: "롤러스키",

    shooting: "사격"

  };


  return names[type] ||
    "바이애슬론";
}


/* =========================================================
   14. RECORD
========================================================= */

function createAnalysisRecord(
  data = {}
) {

  const athlete =
    getCurrentAthlete();


  const type =
    data.type || "ski";


  const record = {

    id: createId("record"),

    athleteId:
      data.athleteId ||
      athlete?.id ||
      null,

    athleteName:
      data.athleteName ||
      athlete?.name ||
      "선수 미선택",

    type,

    typeName:
      getEventName(type),

    camera:
      data.camera ||
      BiathlonStore.settings.camera ||
      "side",

    shootingMode:
      data.shootingMode ||
      null,

    createdAt:
      new Date().toISOString(),

    date:
      getDateTimeString(),

    score:
      Number.isFinite(
        Number(data.score)
      )
        ? Number(data.score)
        : null,

    angles:
      data.angles || {},

    trajectory:
      data.trajectory || [],

    keyFrames:
      data.keyFrames || [],

    shots:
      data.shots || [],

    triggerData:
      data.triggerData || [],

    feedback:
      data.feedback || {},

    metrics:
      data.metrics || {},

    notes:
      data.notes || "",

    videoName:
      data.videoName || "",

    videoDuration:
      data.videoDuration || 0

  };


  BiathlonStore.records.unshift(
    record
  );


  saveStorage(
    STORAGE_KEYS.records,
    BiathlonStore.records
  );


  BiathlonStore.currentRecordId =
    record.id;


  renderRecordList();

  updateDashboard();


  return record;
}


/* =========================================================
   15. UPDATE RECORD
========================================================= */

function updateAnalysisRecord(
  recordId,
  updates = {}
) {

  const record =
    BiathlonStore.records.find(
      item => item.id === recordId
    );


  if (!record) {
    return null;
  }


  Object.assign(
    record,
    updates,
    {
      updatedAt:
        new Date().toISOString()
    }
  );


  saveStorage(
    STORAGE_KEYS.records,
    BiathlonStore.records
  );


  updateDashboard();

  renderRecordList();


  return record;
}


/* =========================================================
   16. DELETE RECORD
========================================================= */

function deleteAnalysisRecord(
  recordId
) {

  const record =
    BiathlonStore.records.find(
      item => item.id === recordId
    );


  if (!record) {
    return false;
  }


  const confirmed =
    window.confirm(
      "이 분석 기록을 삭제할까요?"
    );


  if (!confirmed) {
    return false;
  }


  BiathlonStore.records =
    BiathlonStore.records.filter(
      item => item.id !== recordId
    );


  saveStorage(
    STORAGE_KEYS.records,
    BiathlonStore.records
  );


  if (
    BiathlonStore.currentRecordId ===
    recordId
  ) {

    BiathlonStore.currentRecordId =
      null;

  }


  renderRecordList();

  updateDashboard();


  showToast(
    "분석 기록을 삭제했습니다."
  );


  return true;
}


/* =========================================================
   17. GET RECORD
========================================================= */

function getRecord(
  recordId
) {

  return BiathlonStore.records.find(
    record =>
      record.id === recordId
  ) || null;

}


/* =========================================================
   18. GET RECORDS BY TYPE
========================================================= */

function getRecordsByType(
  type
) {

  return BiathlonStore.records.filter(
    record =>
      record.type === type
  );

}


/* =========================================================
   19. GET ATHLETE RECORDS
========================================================= */

function getAthleteRecords(
  athleteId
) {

  return BiathlonStore.records.filter(
    record =>
      record.athleteId === athleteId
  );

}


/* =========================================================
   20. RENDER RECORDS
========================================================= */

function renderRecordList() {

  const container =
    document.getElementById(
      "recordList"
    );


  if (!container) {
    return;
  }


  const filter =
    document.getElementById(
      "recordFilter"
    )?.value ||
    "all";


  const search =
    (
      document.getElementById(
        "recordSearch"
      )?.value || ""
    )
      .trim()
      .toLowerCase();


  let records =
    [...BiathlonStore.records];


  if (filter !== "all") {

    records =
      records.filter(
        record =>
          record.type === filter
      );

  }


  if (search) {

    records =
      records.filter(
        record => {

          const text = [
            record.athleteName,
            record.typeName,
            record.date,
            record.videoName
          ]
            .join(" ")
            .toLowerCase();


          return text.includes(
            search
          );

        }
      );

  }


  if (records.length === 0) {

    container.innerHTML = `
      <div class="empty-state">
        조건에 맞는 분석 기록이 없습니다.
      </div>
    `;

    return;
  }


  container.innerHTML =
    records
      .map(record => {

        const icon =
          getEventIcon(
            record.type
          );


        const score =
          Number.isFinite(
            Number(record.score)
          )
            ? `${Math.round(record.score)}`
            : "-";


        return `
          <div
            class="record-item"
            data-record-id="${record.id}"
          >

            <div class="record-type">
              ${icon}
            </div>


            <div class="record-info">

              <strong>
                ${escapeHtml(
                  record.athleteName
                )}
                ·
                ${escapeHtml(
                  record.typeName
                )}
              </strong>

              <span>
                ${escapeHtml(
                  record.date || "-"
                )}
                ·
                ${getCameraName(
                  record.camera
                )}
                ${record.shootingMode
                  ? ` · ${getShootingModeName(
                      record.shootingMode
                    )}`
                  : ""}
              </span>

            </div>


            <div
              class="record-score"
            >
              ${score}
            </div>


            <button
              type="button"
              class="icon-button"
              data-delete-record="${record.id}"
              title="삭제"
            >
              ×
            </button>

          </div>
        `;

      })
      .join("");

}


/* =========================================================
   21. DASHBOARD
========================================================= */

function updateDashboard() {

  const records =
    BiathlonStore.records;


  const sessionCount =
    document.getElementById(
      "dashboardSessionCount"
    );


  if (sessionCount) {

    sessionCount.textContent =
      records.length;

  }


  updateDashboardType(
    "ski",
    "dashboardSkiScore",
    "dashboardSkiDate"
  );


  updateDashboardType(
    "roller",
    "dashboardRollerScore",
    "dashboardRollerDate"
  );


  updateDashboardType(
    "shooting",
    "dashboardShootingScore",
    "dashboardShootingDate"
  );


  renderDashboardRecent();

}


/* =========================================================
   22. DASHBOARD TYPE
========================================================= */

function updateDashboardType(
  type,
  scoreId,
  dateId
) {

  const records =
    getRecordsByType(type);


  const latest =
    records[0];


  const scoreElement =
    document.getElementById(
      scoreId
    );


  const dateElement =
    document.getElementById(
      dateId
    );


  if (!scoreElement ||
      !dateElement) {

    return;
  }


  if (!latest) {

    scoreElement.textContent =
      "-";

    dateElement.textContent =
      "분석 기록 없음";

    return;
  }


  scoreElement.textContent =
    Number.isFinite(
      Number(latest.score)
    )
      ? Math.round(latest.score)
      : "-";


  dateElement.textContent =
    latest.date ||
    "최근 분석";

}


/* =========================================================
   23. DASHBOARD RECENT
========================================================= */

function renderDashboardRecent() {

  const container =
    document.getElementById(
      "dashboardRecentList"
    );


  if (!container) {
    return;
  }


  const records =
    BiathlonStore.records
      .slice(0, 5);


  if (records.length === 0) {

    container.innerHTML = `
      <div class="empty-state">
        아직 분석 기록이 없습니다.
      </div>
    `;

    return;
  }


  container.innerHTML =
    records
      .map(record => {

        return `
          <div
            class="recent-item"
            data-open-record="${record.id}"
          >

            <div class="recent-icon">
              ${getEventIcon(
                record.type
              )}
            </div>


            <div class="recent-info">

              <strong>
                ${escapeHtml(
                  record.athleteName
                )}
                ·
                ${escapeHtml(
                  record.typeName
                )}
              </strong>

              <span>
                ${escapeHtml(
                  record.date || "-"
                )}
              </span>

            </div>

          </div>
        `;

      })
      .join("");

}


/* =========================================================
   24. SETTINGS
========================================================= */

function updateSetting(
  key,
  value
) {

  BiathlonStore.settings[key] =
    value;


  saveStorage(
    STORAGE_KEYS.settings,
    BiathlonStore.settings
  );

}


/* =========================================================
   25. PAGE
========================================================= */

function changePage(
  pageName
) {

  if (!pageName) {
    return;
  }


  document
    .querySelectorAll(".page")
    .forEach(page => {

      page.classList.toggle(
        "active",
        page.id ===
        `page-${pageName}`
      );

    });


  document
    .querySelectorAll(".nav-button")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page ===
        pageName
      );

    });


  const titles = {

    dashboard:
      "대시보드",

    athletes:
      "선수 관리",

    ski:
      "스키 자세분석",

    roller:
      "롤러스키 자세분석",

    shooting:
      "사격 자세분석",

    comparison:
      "비교분석",

    records:
      "분석 기록",

    report:
      "자세분석 리포트"

  };


  const title =
    document.getElementById(
      "pageTitle"
    );


  if (title) {

    title.textContent =
      titles[pageName] ||
      "설천 바이애슬론";

  }


  updateSetting(
    "currentPage",
    pageName
  );


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  if (
    window.innerWidth <= 760
  ) {

    document
      .getElementById("sidebar")
      ?.classList.remove(
        "open"
      );

  }

}


/* =========================================================
   26. CAMERA
========================================================= */

function setCamera(
  camera
) {

  updateSetting(
    "camera",
    camera
  );


  document
    .querySelectorAll(
      ".camera-button"
    )
    .forEach(button => {

      const buttonCamera =
        button.dataset.camera ||
        button.dataset.shootingCamera;


      button.classList.toggle(
        "active",
        buttonCamera === camera
      );

    });

}


/* =========================================================
   27. SHOOTING MODE
========================================================= */

function setShootingMode(
  mode
) {

  updateSetting(
    "shootingMode",
    mode
  );


  document
    .querySelectorAll(
      ".shooting-mode"
    )
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.shootingMode ===
        mode
      );

    });

}


/* =========================================================
   28. TOAST
========================================================= */

let toastTimer = null;


function showToast(
  message,
  duration = 2400
) {

  const toast =
    document.getElementById(
      "toast"
    );


  if (!toast) {
    return;
  }


  toast.textContent =
    message;


  toast.classList.add(
    "show"
  );


  clearTimeout(
    toastTimer
  );


  toastTimer =
    setTimeout(() => {

      toast.classList.remove(
        "show"
      );

    }, duration);

}


/* =========================================================
   29. EVENT ICON
========================================================= */

function getEventIcon(
  type
) {

  const icons = {

    ski: "🎿",

    roller: "🛼",

    shooting: "🎯"

  };


  return icons[type] ||
    "•";
}


/* =========================================================
   30. CAMERA NAME
========================================================= */

function getCameraName(
  camera
) {

  const names = {

    side: "측면",

    front: "정면",

    rear: "후면"

  };


  return names[camera] ||
    "측면";
}


/* =========================================================
   31. SHOOTING MODE NAME
========================================================= */

function getShootingModeName(
  mode
) {

  const names = {

    prone: "엎드려쏴",

    standing: "서서쏴"

  };


  return names[mode] ||
    mode ||
    "";
}


/* =========================================================
   32. HTML ESCAPE
========================================================= */

function escapeHtml(
  value
) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


/* =========================================================
   33. DOWNLOAD JSON
========================================================= */

function downloadJson(
  data,
  filename
) {

  const blob =
    new Blob(
      [
        JSON.stringify(
          data,
          null,
          2
        )
      ],
      {
        type:
          "application/json"
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;

  link.download =
    filename;


  document.body.appendChild(
    link
  );

  link.click();

  link.remove();


  setTimeout(() => {

    URL.revokeObjectURL(
      url
    );

  }, 1000);

}


/* =========================================================
   34. EXPORT ALL DATA
========================================================= */

function exportAllData() {

  downloadJson(
    {
      exportedAt:
        new Date().toISOString(),

      athletes:
        BiathlonStore.athletes,

      records:
        BiathlonStore.records,

      settings:
        BiathlonStore.settings
    },

    `seolcheon-biathlon-${Date.now()}.json`
  );


  showToast(
    "분석 데이터가 저장되었습니다."
  );

}


/* =========================================================
   35. IMPORT DATA
========================================================= */

function importData(
  json
) {

  if (!json ||
      typeof json !== "object") {

    showToast(
      "올바른 데이터 파일이 아닙니다."
    );

    return false;
  }


  if (
    Array.isArray(
      json.athletes
    )
  ) {

    BiathlonStore.athletes =
      json.athletes;

  }


  if (
    Array.isArray(
      json.records
    )
  ) {

    BiathlonStore.records =
      json.records;

  }


  if (
    json.settings &&
    typeof json.settings ===
      "object"
  ) {

    BiathlonStore.settings =
      {
        ...BiathlonStore.settings,
        ...json.settings
      };

  }


  saveStorage(
    STORAGE_KEYS.athletes,
    BiathlonStore.athletes
  );


  saveStorage(
    STORAGE_KEYS.records,
    BiathlonStore.records
  );


  saveStorage(
    STORAGE_KEYS.settings,
    BiathlonStore.settings
  );


  updateCurrentAthleteUI();

  renderAthleteList();

  renderRecordList();

  updateDashboard();


  showToast(
    "데이터를 불러왔습니다."
  );


  return true;
}


/* =========================================================
   36. GLOBAL EVENT HANDLER
========================================================= */

document.addEventListener(
  "click",
  event => {

    const navButton =
      event.target.closest(
        ".nav-button"
      );


    if (navButton) {

      changePage(
        navButton.dataset.page
      );

      return;
    }


    const openPage =
      event.target.closest(
        "[data-open-page]"
      );


    if (openPage) {

      changePage(
        openPage.dataset.openPage
      );

      return;
    }


    const selectAthleteButton =
      event.target.closest(
        "[data-select-athlete]"
      );


    if (selectAthleteButton) {

      selectAthlete(
        selectAthleteButton.dataset
          .selectAthlete
      );

      return;
    }


    const deleteAthleteButton =
      event.target.closest(
        "[data-delete-athlete]"
      );


    if (deleteAthleteButton) {

      deleteAthlete(
        deleteAthleteButton.dataset
          .deleteAthlete
      );

      return;
    }


    const deleteRecordButton =
      event.target.closest(
        "[data-delete-record]"
      );


    if (deleteRecordButton) {

      deleteAnalysisRecord(
        deleteRecordButton.dataset
          .deleteRecord
      );

      return;
    }


    const openRecord =
      event.target.closest(
        "[data-open-record]"
      );


    if (openRecord) {

      BiathlonStore.currentRecordId =
        openRecord.dataset.openRecord;

      changePage(
        "records"
      );

      return;
    }


    const cameraButton =
      event.target.closest(
        ".camera-button"
      );


    if (cameraButton) {

      setCamera(
        cameraButton.dataset.camera ||
        cameraButton.dataset
          .shootingCamera
      );

      return;
    }


    const shootingModeButton =
      event.target.closest(
        ".shooting-mode"
      );


    if (shootingModeButton) {

      setShootingMode(
        shootingModeButton
          .dataset
          .shootingMode
      );

      return;
    }

  }
);


/* =========================================================
   37. ATHLETE FORM
========================================================= */

document.addEventListener(
  "click",
  event => {

    if (
      event.target.id !==
      "addAthleteButton"
    ) {

      return;
    }


    const nameInput =
      document.getElementById(
        "athleteNameInput"
      );


    const birthInput =
      document.getElementById(
        "athleteBirthInput"
      );


    const teamInput =
      document.getElementById(
        "athleteTeamInput"
      );


    const eventInput =
      document.getElementById(
        "athleteEventInput"
      );


    const athlete =
      addAthlete({

        name:
          nameInput?.value,

        birth:
          birthInput?.value,

        team:
          teamInput?.value,

        event:
          eventInput?.value

      });


    if (!athlete) {
      return;
    }


    if (nameInput) {
      nameInput.value = "";
    }

    if (birthInput) {
      birthInput.value = "";
    }

    if (teamInput) {
      teamInput.value = "";
    }

  }
);


/* =========================================================
   38. RECORD FILTER
========================================================= */

document.addEventListener(
  "input",
  event => {

    if (
      event.target.id ===
      "recordSearch"
    ) {

      renderRecordList();

    }

  }
);


document.addEventListener(
  "change",
  event => {

    if (
      event.target.id ===
      "recordFilter"
    ) {

      renderRecordList();

    }

  }
);


/* =========================================================
   39. SIDEBAR TOGGLE
========================================================= */

document.addEventListener(
  "click",
  event => {

    if (
      event.target.id !==
      "sidebarToggle"
    ) {

      return;
    }


    const sidebar =
      document.getElementById(
        "sidebar"
      );


    if (!sidebar) {
      return;
    }


    sidebar.classList.toggle(
      "open"
    );

  }
);


/* =========================================================
   40. CLOCK
========================================================= */

function updateClock() {

  const element =
    document.getElementById(
      "clock"
    );


  if (!element) {
    return;
  }


  const now =
    new Date();


  const hours =
    String(
      now.getHours()
    ).padStart(2, "0");


  const minutes =
    String(
      now.getMinutes()
    ).padStart(2, "0");


  const seconds =
    String(
      now.getSeconds()
    ).padStart(2, "0");


  element.textContent =
    `${hours}:${minutes}:${seconds}`;

}


/* =========================================================
   41. INIT
========================================================= */

function initBiathlonEvents() {

  if (
    BiathlonStore.athletes.length > 0 &&
    !BiathlonStore.currentAthleteId
  ) {

    BiathlonStore.currentAthleteId =
      BiathlonStore.athletes[0].id;

  }


  updateCurrentAthleteUI();

  renderAthleteList();

  renderRecordList();

  updateDashboard();


  changePage(
    BiathlonStore.settings
      .currentPage ||
      "dashboard"
  );


  setCamera(
    BiathlonStore.settings
      .camera ||
      "side"
  );


  setShootingMode(
    BiathlonStore.settings
      .shootingMode ||
      "prone"
  );


  updateClock();


  setInterval(
    updateClock,
    1000
  );

}


/* =========================================================
   42. PUBLIC API
========================================================= */

window.BiathlonEvents = {

  addAthlete,

  updateAthlete,

  deleteAthlete,

  selectAthlete,

  getCurrentAthlete,

  createAnalysisRecord,

  updateAnalysisRecord,

  deleteAnalysisRecord,

  getRecord,

  getRecordsByType,

  getAthleteRecords,

  changePage,

  setCamera,

  setShootingMode,

  showToast,

  exportAllData,

  importData,

  getEventName,

  getCameraName,

  getShootingModeName

};


/* =========================================================
   START
========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initBiathlonEvents
  );

} else {

  initBiathlonEvents();

}