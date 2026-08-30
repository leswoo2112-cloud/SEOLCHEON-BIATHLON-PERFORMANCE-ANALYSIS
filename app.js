/* =========================================================
   설천 BIATHLON 자세분석 PRO
   app.js
   ---------------------------------------------------------
   - 페이지 전환
   - 영상 선택
   - 영상 재생/정지
   - Pose Engine 연결
   - 실시간 지표
   - 관절각 그래프
   - 중심 궤적 그래프
   - 자세 캡처
   - 분석 저장
   - 기록 관리
   - 비교분석
========================================================= */

"use strict";


/* =========================================================
   01. APPLICATION STATE
========================================================= */

const APP = {

    currentPage: "dashboard",

    currentType: null,

    analysisRunning: false,

    videos: {
        ski: null,
        roller: null,
        shooting: null
    },

    videoURLs: {
        ski: null,
        roller: null,
        shooting: null
    },

    analysis: {

        ski: [],
        roller: [],
        shooting: []

    },

    records: [],

    currentSession: {

        type: null,

        startedAt: null,

        frames: [],

        snapshots: [],

        maxScore: 0,

        sumScore: 0,

        sampleCount: 0

    },

    charts: {},

    currentMetrics: {

        ski: null,
        roller: null,
        shooting: null

    }

};


/* =========================================================
   02. EXPOSE GLOBAL APP
========================================================= */

window.SeolcheonApp = {

    APP,

    capturePose:
        capturePose,

    bookmarkFrame:
        bookmarkFrame,

    markShotEvent:
        markShotEvent,

    clearShotEvents:
        clearShotEvents

};


/* =========================================================
   03. DOM HELPERS
========================================================= */

function $(selector) {

    return document.querySelector(
        selector
    );

}


function $all(selector) {

    return document.querySelectorAll(
        selector
    );

}


/* =========================================================
   04. TOAST
========================================================= */

function toast(message) {

    const element =
        $("#toast");


    if (!element) {

        console.log(message);

        return;

    }


    element.textContent =
        message;


    element.style.opacity =
        "1";


    element.style.transform =
        "translate(-50%, 0)";


    clearTimeout(
        toast.timer
    );


    toast.timer =
        setTimeout(
            () => {

                element.style.opacity =
                    "0";

                element.style.transform =
                    "translate(-50%, 10px)";

            },
            1800
        );

}


window.toast =
    toast;


/* =========================================================
   05. PAGE TITLES
========================================================= */

const PAGE_TITLES = {

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

};


/* =========================================================
   06. PAGE NAVIGATION
========================================================= */

function showPage(
    page
) {

    if (
        !PAGE_TITLES[page]
    ) {

        return;

    }


    APP.currentPage =
        page;


    $all(".page").forEach(
        element => {

            element.classList.toggle(

                "active",

                element.id ===
                `page-${page}`

            );

        }
    );


    $all(".nav-item").forEach(
        button => {

            button.classList.toggle(

                "active",

                button.dataset.page ===
                page

            );

        }
    );


    const title =
        $("#pageTitle");


    if (title) {

        title.textContent =
            PAGE_TITLES[page];

    }


    if (
        page === "records"
    ) {

        renderRecords();

    }


    if (
        page === "compare"
    ) {

        populateCompareSelects();

    }


    if (
        page === "report"
    ) {

        populateReportSelect();

    }

}


/* =========================================================
   07. NAVIGATION EVENTS
========================================================= */

function setupNavigation() {

    $all(
        ".nav-item"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    showPage(
                        button.dataset.page
                    );

                }
            );

        }
    );

}


/* =========================================================
   08. CLOCK
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
   09. VIDEO ELEMENT
========================================================= */

function getVideo(
    type
) {

    if (
        APP.videos[type]
    ) {

        return APP.videos[type];

    }


    const element =
        document.querySelector(
            `#${type}Video`
        );


    if (element) {

        APP.videos[type] =
            element;

    }


    return element;

}


/* =========================================================
   10. POSE CANVAS
========================================================= */

function getPoseCanvas(
    type
) {

    return document.querySelector(
        `#${type}PoseCanvas`
    );

}


/* =========================================================
   11. FILE INPUT
========================================================= */

function getFileInput(
    type
) {

    return document.querySelector(
        `#${type}FileInput`
    );

}


/* =========================================================
   12. SELECT VIDEO
========================================================= */

function selectVideo(
    type
) {

    const input =
        getFileInput(
            type
        );


    if (!input) {

        toast(
            "파일 입력을 찾을 수 없습니다."
        );

        return;

    }


    input.value =
        "";


    input.click();

}


/* =========================================================
   13. VIDEO FILE LOADED
========================================================= */

function loadVideo(
    type,
    file
) {

    if (!file) return;


    if (
        !file.type.startsWith(
            "video/"
        )
    ) {

        toast(
            "영상 파일만 선택할 수 있습니다."
        );

        return;

    }


    const video =
        getVideo(
            type
        );


    if (!video) {

        toast(
            "영상 영역을 찾을 수 없습니다."
        );

        return;

    }


    /*
     * 기존 URL 제거
     */

    if (
        APP.videoURLs[type]
    ) {

        URL.revokeObjectURL(
            APP.videoURLs[type]
        );

    }


    const url =
        URL.createObjectURL(
            file
        );


    APP.videoURLs[type] =
        url;


    APP.videos[type] =
        video;


    video.src =
        url;


    video.load();


    const wrapper =
        video.closest(
            ".video-wrapper"
        );


    if (wrapper) {

        wrapper.classList.add(
            "has-video"
        );

    }


    video.addEventListener(
        "loadedmetadata",
        async () => {

            /*
             * Pose Canvas 연결
             */

            const canvas =
                getPoseCanvas(
                    type
                );


            if (
                window.SeolcheonPose &&
                canvas
            ) {

                window.SeolcheonPose
                    .setSport(
                        type
                    );


                await window.SeolcheonPose
                    .connectVideo(
                        video,
                        canvas
                    );

            }


            toast(
                `${typeName(type)} 영상이 준비되었습니다.`
            );

        },
        {
            once: true
        }
    );


    setupVideoEvents(
        type,
        video
    );

}


/* =========================================================
   14. VIDEO EVENTS
========================================================= */

function setupVideoEvents(
    type,
    video
) {

    if (
        video._seolcheonAppEvents
    ) {

        return;

    }


    video._seolcheonAppEvents =
        true;


    video.addEventListener(
        "timeupdate",
        () => {

            updateTimeline(
                type
            );

        }
    );


    video.addEventListener(
        "ended",
        () => {

            updatePlayButton(
                type
            );

        }
    );


    video.addEventListener(
        "play",
        () => {

            updatePlayButton(
                type
            );

        }
    );


    video.addEventListener(
        "pause",
        () => {

            updatePlayButton(
                type
            );

        }
    );

}


/* =========================================================
   15. TYPE NAME
========================================================= */

function typeName(
    type
) {

    const names = {

        ski:
            "스키",

        roller:
            "롤러스키",

        shooting:
            "사격"

    };


    return (
        names[type] ||
        type
    );

}


/* =========================================================
   16. PLAY / PAUSE
========================================================= */

function togglePlay(
    type
) {

    const video =
        getVideo(
            type
        );


    if (
        !video ||
        !video.src
    ) {

        toast(
            "먼저 영상을 선택하세요."
        );

        return;

    }


    if (
        video.paused
    ) {

        video.play();

    } else {

        video.pause();

    }

}


/* =========================================================
   17. PLAY BUTTON UI
========================================================= */

function updatePlayButton(
    type
) {

    const button =
        document.querySelector(
            `[data-play="${type}"]`
        );


    const video =
        getVideo(
            type
        );


    if (
        !button ||
        !video
    ) {

        return;

    }


    button.textContent =
        video.paused
            ? "▶"
            : "Ⅱ";

}


/* =========================================================
   18. TIMELINE
========================================================= */

function updateTimeline(
    type
) {

    const video =
        getVideo(
            type
        );


    const timeline =
        document.querySelector(
            `#${type}Seek`
        );


    if (
        !video ||
        !timeline ||
        !video.duration
    ) {

        return;

    }


    timeline.value =
        (
            video.currentTime /
            video.duration
        ) * 100;

}


/* =========================================================
   19. SEEK
========================================================= */

function seekVideo(
    type,
    value
) {

    const video =
        getVideo(
            type
        );


    if (
        !video ||
        !video.duration
    ) {

        return;

    }


    video.currentTime =
        (
            Number(value) /
            100
        ) *
        video.duration;

}


/* =========================================================
   20. START ANALYSIS
========================================================= */

async function startAnalysis(
    type
) {

    const video =
        getVideo(
            type
        );


    if (
        !video ||
        !video.src
    ) {

        toast(
            "먼저 영상을 선택하세요."
        );

        return;

    }


    APP.currentType =
        type;


    APP.analysisRunning =
        true;


    APP.currentSession = {

        type,

        startedAt:
            new Date().toISOString(),

        frames: [],

        snapshots: [],

        maxScore: 0,

        sumScore: 0,

        sampleCount: 0

    };


    if (
        window.SeolcheonPose
    ) {

        window.SeolcheonPose
            .setSport(
                type
            );

    }


    try {

        await video.play();

        toast(
            `${typeName(type)} 자세분석을 시작합니다.`
        );

    } catch (
        error
    ) {

        toast(
            "재생을 시작하지 못했습니다."
        );

    }

}


/* =========================================================
   21. ANALYSIS CALLBACK
========================================================= */

function onPoseAnalysisUpdate(
    analysis,
    state
) {

    if (
        !analysis ||
        !state
    ) {

        return;

    }


    const type =
        analysis.type;


    APP.currentMetrics[type] =
        analysis;


    updateMetricsUI(
        type,
        analysis,
        state
    );


    updateAnalysisCharts(
        type,
        analysis,
        state
    );


    if (
        APP.analysisRunning &&
        APP.currentSession.type ===
        type
    ) {

        const score =
            calculateOverallScore(
                analysis,
                state
            );


        APP.currentSession.frames.push({

            time:
                getVideo(type)?.currentTime ||
                0,

            score,

            confidence:
                state.confidence,

            angles:
                {
                    ...(analysis.angles || {})
                },

            center:
                {
                    ...(state.person?.center || {})
                }

        });


        APP.currentSession.sumScore +=
            score;


        APP.currentSession.maxScore =
            Math.max(
                APP.currentSession.maxScore,
                score
            );


        APP.currentSession.sampleCount++;

    }

}


window.onPoseAnalysisUpdate =
    onPoseAnalysisUpdate;


/* =========================================================
   22. METRICS UI
========================================================= */

function updateMetricsUI(
    type,
    analysis,
    state
) {

    const prefix =
        type;


    const angles =
        analysis.angles || {};


    setText(
        `#${prefix}LeftKnee`,
        formatAngle(
            angles.leftKnee
        )
    );


    setText(
        `#${prefix}RightKnee`,
        formatAngle(
            angles.rightKnee
        )
    );


    setText(
        `#${prefix}Lean`,
        formatAngle(
            angles.body
        )
    );


    const stability =
        analysis.stability ??
        state.person?.confidence *
        100;


    setText(
        `#${prefix}Stability`,
        formatScore(
            stability
        )
    );


    const symmetry =
        calculateSymmetry(
            angles
        );


    setText(
        `#${prefix}Symmetry`,
        formatScore(
            symmetry
        )
    );


    const consistency =
        calculateConsistency(
            type
        );


    setText(
        `#${prefix}Consistency`,
        formatScore(
            consistency
        )
    );

}


/* =========================================================
   23. SET TEXT
========================================================= */

function setText(
    selector,
    value
) {

    const element =
        $(selector);


    if (
        element
    ) {

        element.textContent =
            value;

    }

}


/* =========================================================
   24. FORMAT
========================================================= */

function formatAngle(
    value
) {

    if (
        value === null ||
        value === undefined ||
        Number.isNaN(
            Number(value)
        )
    ) {

        return "-";

    }


    return `${Math.round(
        Number(value)
    )}°`;

}


function formatScore(
    value
) {

    if (
        value === null ||
        value === undefined ||
        Number.isNaN(
            Number(value)
        )
    ) {

        return "-";

    }


    return `${Math.round(
        Number(value)
    )}`;

}


/* =========================================================
   25. SYMMETRY
========================================================= */

function calculateSymmetry(
    angles
) {

    const pairs = [

        [
            angles.leftKnee,
            angles.rightKnee
        ],

        [
            angles.leftHip,
            angles.rightHip
        ],

        [
            angles.leftElbow,
            angles.rightElbow
        ]

    ];


    let total = 0;
    let count = 0;


    pairs.forEach(
        pair => {

            const a =
                pair[0];

            const b =
                pair[1];


            if (
                a === null ||
                a === undefined ||
                b === null ||
                b === undefined
            ) {

                return;

            }


            total +=
                Math.abs(
                    a - b
                );

            count++;

        }
    );


    if (
        count === 0
    ) {

        return 0;

    }


    return Math.max(

        0,

        Math.min(

            100,

            100 -
            (
                total /
                count
            ) *
            1.7

        )

    );

}


/* =========================================================
   26. CONSISTENCY
========================================================= */

function calculateConsistency(
    type
) {

    const frames =
        APP.currentSession.frames;


    if (
        frames.length < 5
    ) {

        return 0;

    }


    const recent =
        frames.slice(
            -30
        );


    const scores =
        recent.map(
            item =>
                item.score
        );


    const mean =
        scores.reduce(
            (sum, value) =>
                sum + value,
            0
        ) /
        scores.length;


    const variance =
        scores.reduce(
            (sum, value) =>
                sum +
                Math.pow(
                    value - mean,
                    2
                ),
            0
        ) /
        scores.length;


    const sd =
        Math.sqrt(
            variance
        );


    return Math.max(

        0,

        Math.min(

            100,

            100 -
            sd * 3

        )

    );

}


/* =========================================================
   27. OVERALL SCORE
========================================================= */

function calculateOverallScore(
    analysis,
    state
) {

    const confidence =
        (
            state.confidence ||
            0
        ) *
        100;


    const stability =
        Number(
            analysis.stability ||
            0
        );


    const symmetry =
        calculateSymmetry(
            analysis.angles || {}
        );


    const score =
        (
            confidence +
            stability +
            symmetry
        ) /
        3;


    return Math.round(
        Math.max(
            0,
            Math.min(
                100,
                score
            )
        )
    );

}


/* =========================================================
   28. CHART DATA
========================================================= */

function updateAnalysisCharts(
    type,
    analysis,
    state
) {

    if (
        !window.Chart
    ) {

        return;

    }


    const angles =
        analysis.angles || {};


    const chartKey =
        `${type}Angle`;


    if (
        !APP.charts[chartKey]
    ) {

        const canvas =
            document.querySelector(
                `#${type}AngleChart`
            );


        if (!canvas) return;


        APP.charts[chartKey] =
            new Chart(
                canvas,
                {

                    type: "line",

                    data: {

                        labels: [],

                        datasets: [

                            {
                                label:
                                    "왼쪽 무릎",

                                data: []
                            },

                            {
                                label:
                                    "오른쪽 무릎",

                                data: []
                            },

                            {
                                label:
                                    "몸통",

                                data: []
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
                                display: true
                            }

                        },

                        scales: {

                            y: {

                                min: 0,
                                max: 180

                            }

                        }

                    }

                }
            );

    }


    const chart =
        APP.charts[chartKey];


    const time =
        getVideo(type)?.currentTime ||
        0;


    chart.data.labels.push(
        time.toFixed(2)
    );


    chart.data.datasets[0].data.push(
        angles.leftKnee ?? null
    );


    chart.data.datasets[1].data.push(
        angles.rightKnee ?? null
    );


    chart.data.datasets[2].data.push(
        angles.body ?? null
    );


    /*
     * 그래프가 너무 길어지지 않도록
     * 최근 120개만 유지
     */

    while (
        chart.data.labels.length >
        120
    ) {

        chart.data.labels.shift();

        chart.data.datasets.forEach(
            dataset =>
                dataset.data.shift()
        );

    }


    chart.update(
        "none"
    );


    updateTrajectoryChart(
        type,
        state
    );

}


/* =========================================================
   29. TRAJECTORY CHART
========================================================= */

function updateTrajectoryChart(
    type,
    state
) {

    if (
        !window.Chart
    ) {

        return;

    }


    const key =
        `${type}Trajectory`;


    if (
        !APP.charts[key]
    ) {

        const canvas =
            document.querySelector(
                `#${type}TrajectoryChart`
            );


        if (!canvas) return;


        APP.charts[key] =
            new Chart(
                canvas,
                {

                    type: "line",

                    data: {

                        datasets: [

                            {
                                label:
                                    "신체 중심",

                                data: [],

                                parsing: false,

                                showLine: true

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
                                display: false
                            }

                        },

                        scales: {

                            x: {

                                min: 0,
                                max: 1

                            },

                            y: {

                                min: 0,
                                max: 1,

                                reverse: false

                            }

                        }

                    }

                }
            );

    }


    const chart =
        APP.charts[key];


    const trajectory =
        state.trajectory ||
        [];


    chart.data.datasets[0].data =
        trajectory
            .slice(-120)
            .map(
                point => ({

                    x:
                        point.x,

                    y:
                        point.y

                })
            );


    chart.update(
        "none"
    );

}


/* =========================================================
   30. CAPTURE
========================================================= */

function capturePose(
    type
) {

    if (
        !window.SeolcheonPose
    ) {

        return;

    }


    const snapshot =
        window.SeolcheonPose
            .capture(
                type
            );


    if (!snapshot) {

        toast(
            "자세 캡처에 실패했습니다."
        );

        return;

    }


    if (
        APP.currentSession.type ===
        type
    ) {

        APP.currentSession
            .snapshots
            .push(
                snapshot
            );

    }


    toast(
        "자세 프레임을 저장했습니다."
    );

}


/* =========================================================
   31. BOOKMARK
========================================================= */

function bookmarkFrame(
    type
) {

    const video =
        getVideo(
            type
        );


    if (
        !video
    ) {

        return;

    }


    const bookmark = {

        type,

        time:
            video.currentTime,

        createdAt:
            new Date().toISOString()

    };


    const key =
        "seolcheon_bookmarks";


    const data =
        loadJSON(
            key,
            []
        );


    data.push(
        bookmark
    );


    saveJSON(
        key,
        data
    );


    toast(
        `${typeName(type)} 프레임을 북마크했습니다.`
    );

}


/* =========================================================
   32. SHOT EVENTS
========================================================= */

function markShotEvent() {

    /*
     * 안전상 총구나 총기 움직임을
     * 분석하지 않는다.
     *
     * 대신 사격 영상의 일반적인
     * 자세 분석 구간 표시용 이벤트만
     * 저장한다.
     */

    const video =
        getVideo(
            "shooting"
        );


    if (
        !video
    ) {

        toast(
            "사격 영상을 먼저 선택하세요."
        );

        return;

    }


    const event = {

        time:
            video.currentTime,

        frame:
            Math.round(
                video.currentTime * 60
            ),

        type:
            "posture-event",

        createdAt:
            new Date().toISOString()

    };


    if (
        !APP.currentSession
            .events
    ) {

        APP.currentSession.events =
            [];

    }


    APP.currentSession
        .events
        .push(
            event
        );


    toast(
        "사격 자세 이벤트를 기록했습니다."
    );

}


function clearShotEvents() {

    if (
        APP.currentSession
    ) {

        APP.currentSession.events =
            [];

    }


    toast(
        "사격 이벤트를 초기화했습니다."
    );

}


/* =========================================================
   33. SAVE ANALYSIS
========================================================= */

function saveAnalysis(
    type
) {

    if (
        !APP.currentSession ||
        APP.currentSession.type !==
        type
    ) {

        toast(
            "현재 분석 세션이 없습니다."
        );

        return;

    }


    const session =
        APP.currentSession;


    const frames =
        session.frames || [];


    const averageScore =
        frames.length
            ? frames.reduce(
                (sum, frame) =>
                    sum +
                    frame.score,
                0
            ) /
            frames.length
            : 0;


    const record = {

        id:
            `record-${Date.now()}`,

        type,

        typeName:
            typeName(type),

        createdAt:
            new Date().toISOString(),

        startedAt:
            session.startedAt,

        duration:
            getVideo(type)?.duration ||
            0,

        averageScore:
            Math.round(
                averageScore
            ),

        maxScore:
            Math.round(
                session.maxScore ||
                0
            ),

        frames:
            frames,

        snapshots:
            session.snapshots || [],

        events:
            session.events || []

    };


    APP.records.push(
        record
    );


    saveRecords();


    APP.analysis[type].push(
        record
    );


    APP.analysisRunning =
        false;


    APP.currentSession = {

        type: null,

        startedAt: null,

        frames: [],

        snapshots: [],

        maxScore: 0,

        sumScore: 0,

        sampleCount: 0

    };


    updateDashboard();


    toast(
        `${typeName(type)} 분석을 저장했습니다.`
    );


    return record;

}


/* =========================================================
   34. LOCAL STORAGE
========================================================= */

function saveJSON(
    key,
    value
) {

    try {

        localStorage.setItem(

            key,

            JSON.stringify(
                value
            )

        );

    } catch (
        error
    ) {

        console.warn(
            "Storage save error:",
            error
        );

    }

}


function loadJSON(
    key,
    fallback
) {

    try {

        const raw =
            localStorage.getItem(
                key
            );


        if (!raw) {

            return fallback;

        }


        return JSON.parse(
            raw
        );

    } catch (
        error
    ) {

        return fallback;

    }

}


/* =========================================================
   35. RECORD STORAGE
========================================================= */

function saveRecords() {

    saveJSON(
        "seolcheon_records",
        APP.records
    );

}


function loadRecords() {

    APP.records =
        loadJSON(
            "seolcheon_records",
            []
        );


    APP.analysis = {

        ski:
            APP.records.filter(
                record =>
                    record.type ===
                    "ski"
            ),

        roller:
            APP.records.filter(
                record =>
                    record.type ===
                    "roller"
            ),

        shooting:
            APP.records.filter(
                record =>
                    record.type ===
                    "shooting"
            )

    };


}


/* =========================================================
   36. RECORD RENDER
========================================================= */

function renderRecords() {

    const container =
        $("#recordsList");


    if (!container) return;


    if (
        APP.records.length === 0
    ) {

        container.innerHTML =
            `
            <div class="empty-state">
                아직 분석 기록이 없습니다.
            </div>
            `;

        return;

    }


    const records =
        [
            ...APP.records
        ]
        .sort(
            (a, b) =>
                new Date(b.createdAt) -
                new Date(a.createdAt)
        );


    container.innerHTML =
        records
            .map(
                record =>
                    `

                    <article
                        class="record-card"
                        data-record-id="${record.id}"
                    >

                        <div>

                            <h3>
                                ${escapeHTML(
                                    record.typeName
                                )}
                                자세분석
                            </h3>

                            <p>
                                ${formatDate(
                                    record.createdAt
                                )}
                                ·
                                평균 ${record.averageScore}점
                            </p>

                        </div>

                        <div class="record-score">
                            ${record.averageScore}
                        </div>

                        <div class="record-actions">

                            <button
                                data-record-view="${record.id}"
                            >
                                보기
                            </button>

                            <button
                                data-record-report="${record.id}"
                            >
                                리포트
                            </button>

                            <button
                                data-record-delete="${record.id}"
                            >
                                삭제
                            </button>

                        </div>

                    </article>

                    `
            )
            .join("");

}


/* =========================================================
   37. DELETE RECORD
========================================================= */

function deleteRecord(
    id
) {

    const record =
        APP.records.find(
            item =>
                item.id === id
        );


    if (!record) return;


    APP.records =
        APP.records.filter(
            item =>
                item.id !== id
        );


    saveRecords();

    loadRecords();

    renderRecords();

    updateDashboard();

    populateCompareSelects();

    populateReportSelect();


    toast(
        "분석 기록을 삭제했습니다."
    );

}


/* =========================================================
   38. DASHBOARD
========================================================= */

function updateDashboard() {

    setText(
        "#dashboardRecords",
        APP.records.length
    );


    const latest =
        [
            ...APP.records
        ]
        .sort(
            (a, b) =>
                new Date(b.createdAt) -
                new Date(a.createdAt)
        )[0];


    setText(

        "#dashboardScore",

        latest
            ? latest.averageScore
            : "-"

    );


    setText(

        "#dashboardCompare",

        APP.records.length >= 2
            ? APP.records.length
            : 0

    );


    renderRecentAnalyses();

}


/* =========================================================
   39. RECENT
========================================================= */

function renderRecentAnalyses() {

    const container =
        $("#recentAnalyses");


    if (!container) return;


    if (
        APP.records.length === 0
    ) {

        container.className =
            "empty-state";

        container.textContent =
            "최근 분석 기록이 없습니다.";

        return;

    }


    const recent =
        [
            ...APP.records
        ]
        .sort(
            (a, b) =>
                new Date(b.createdAt) -
                new Date(a.createdAt)
        )
        .slice(
            0,
            5
        );


    container.className =
        "records-list";


    container.innerHTML =
        recent
            .map(
                record =>
                    `

                    <div
                        class="record-card"
                    >

                        <div>

                            <h3>
                                ${escapeHTML(
                                    record.typeName
                                )}
                                자세분석
                            </h3>

                            <p>
                                ${formatDate(
                                    record.createdAt
                                )}
                            </p>

                        </div>

                        <div class="record-score">
                            ${record.averageScore}
                        </div>

                    </div>

                    `
            )
            .join("");

}


/* =========================================================
   40. COMPARE SELECTS
========================================================= */

function populateCompareSelects() {

    const a =
        $("#compareA");

    const b =
        $("#compareB");


    if (
        !a ||
        !b
    ) {

        return;

    }


    const options =
        APP.records
            .map(
                record =>
                    `

                    <option value="${record.id}">
                        ${escapeHTML(
                            record.typeName
                        )}
                        ·
                        ${formatDate(
                            record.createdAt
                        )}
                        ·
                        ${record.averageScore}점
                    </option>

                    `
            )
            .join("");


    a.innerHTML =
        `
        <option value="">
            분석 기록 선택
        </option>
        ${options}
        `;


    b.innerHTML =
        `
        <option value="">
            분석 기록 선택
        </option>
        ${options}
        `;

}


/* =========================================================
   41. COMPARE
========================================================= */

function compareRecords() {

    const aID =
        $("#compareA")?.value;


    const bID =
        $("#compareB")?.value;


    const container =
        $("#compareResult");


    if (!container) return;


    if (
        !aID ||
        !bID
    ) {

        container.className =
            "compare-result empty-state";

        container.textContent =
            "두 개의 분석 기록을 선택하세요.";

        return;

    }


    if (
        aID === bID
    ) {

        container.className =
            "compare-result empty-state";

        container.textContent =
            "서로 다른 두 기록을 선택하세요.";

        return;

    }


    const a =
        APP.records.find(
            record =>
                record.id === aID
        );


    const b =
        APP.records.find(
            record =>
                record.id === bID
        );


    if (
        !a ||
        !b
    ) {

        return;

    }


    container.className =
        "compare-result";


    const scoreDiff =
        b.averageScore -
        a.averageScore;


    const aFrames =
        a.frames || [];


    const bFrames =
        b.frames || [];


    const aConfidence =
        averageFrames(
            aFrames,
            "confidence"
        ) *
        100;


    const bConfidence =
        averageFrames(
            bFrames,
            "confidence"
        ) *
        100;


    container.innerHTML =
        `

        <div class="panel">

            <h3>
                ${escapeHTML(
                    a.typeName
                )}
                vs
                ${escapeHTML(
                    b.typeName
                )}
            </h3>

            <table class="comparison-table">

                <thead>

                    <tr>

                        <th>
                            지표
                        </th>

                        <th>
                            A
                        </th>

                        <th>
                            B
                        </th>

                        <th>
                            변화
                        </th>

                    </tr>

                </thead>

                <tbody>

                    <tr>

                        <td>
                            평균 점수
                        </td>

                        <td>
                            ${a.averageScore}
                        </td>

                        <td>
                            ${b.averageScore}
                        </td>

                        <td
                            class="${
                                scoreDiff >= 0
                                    ? "compare-good"
                                    : ""
                            }"
                        >
                            ${
                                scoreDiff > 0
                                    ? "+"
                                    : ""
                            }${scoreDiff}
                        </td>

                    </tr>


                    <tr>

                        <td>
                            최고 점수
                        </td>

                        <td>
                            ${a.maxScore}
                        </td>

                        <td>
                            ${b.maxScore}
                        </td>

                        <td>
                            ${
                                b.maxScore -
                                a.maxScore
                            }
                        </td>

                    </tr>


                    <tr>

                        <td>
                            인식 신뢰도
                        </td>

                        <td>
                            ${Math.round(
                                aConfidence
                            )}%
                        </td>

                        <td>
                            ${Math.round(
                                bConfidence
                            )}%
                        </td>

                        <td>
                            ${Math.round(
                                bConfidence -
                                aConfidence
                            )}%
                        </td>

                    </tr>


                    <tr>

                        <td>
                            분석 프레임
                        </td>

                        <td>
                            ${aFrames.length}
                        </td>

                        <td>
                            ${bFrames.length}
                        </td>

                        <td>
                            ${
                                bFrames.length -
                                aFrames.length
                            }
                        </td>

                    </tr>

                </tbody>

            </table>

        </div>

        `;

}


/* =========================================================
   42. REPORT SELECT
========================================================= */

function populateReportSelect() {

    const select =
        $("#reportRecord");


    if (!select) return;


    const options =
        APP.records
            .map(
                record =>
                    `

                    <option
                        value="${record.id}"
                    >
                        ${escapeHTML(
                            record.typeName
                        )}
                        ·
                        ${formatDate(
                            record.createdAt
                        )}
                        ·
                        ${record.averageScore}점
                    </option>

                    `
            )
            .join("");


    select.innerHTML =
        `
        <option value="">
            분석 기록 선택
        </option>
        ${options}
        `;

}


/* =========================================================
   43. RECORD VIEW
========================================================= */

function viewRecord(
    id
) {

    const record =
        APP.records.find(
            item =>
                item.id === id
        );


    if (!record) return;


    showPage(
        "report"
    );


    populateReportSelect();


    const select =
        $("#reportRecord");


    if (select) {

        select.value =
            id;

    }


    generateReport();

}


/* =========================================================
   44. HELPERS
========================================================= */

function averageFrames(
    frames,
    property
) {

    const values =
        frames
            .map(
                frame =>
                    Number(
                        frame[property]
                    )
            )
            .filter(
                value =>
                    Number.isFinite(
                        value
                    )
            );


    if (
        values.length === 0
    ) {

        return 0;

    }


    return (
        values.reduce(
            (sum, value) =>
                sum + value,
            0
        ) /
        values.length
    );

}


function formatDate(
    value
) {

    if (!value) {

        return "-";

    }


    return new Date(
        value
    ).toLocaleString(
        "ko-KR",
        {
            year:
                "numeric",

            month:
                "2-digit",

            day:
                "2-digit",

            hour:
                "2-digit",

            minute:
                "2-digit"
        }
    );

}


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
   45. EVENT DELEGATION
========================================================= */

function setupAppEvents() {

    document.addEventListener(
        "click",
        event => {

            const selectButton =
                event.target.closest(
                    "[data-select-video]"
                );


            if (
                selectButton
            ) {

                selectVideo(
                    selectButton.dataset
                        .selectVideo
                );

                return;

            }


            const playButton =
                event.target.closest(
                    "[data-play]"
                );


            if (
                playButton
            ) {

                togglePlay(
                    playButton.dataset.play
                );

                return;

            }


            const startButton =
                event.target.closest(
                    "[data-start-analysis]"
                );


            if (
                startButton
            ) {

                startAnalysis(
                    startButton.dataset
                        .startAnalysis
                );

                return;

            }


            const saveButton =
                event.target.closest(
                    "[data-save-analysis]"
                );


            if (
                saveButton
            ) {

                saveAnalysis(
                    saveButton.dataset
                        .saveAnalysis
                );

                return;

            }


            const captureButton =
                event.target.closest(
                    "[data-capture]"
                );


            if (
                captureButton
            ) {

                capturePose(
                    captureButton.dataset
                        .capture
                );

                return;

            }


            const viewButton =
                event.target.closest(
                    "[data-record-view]"
                );


            if (
                viewButton
            ) {

                viewRecord(
                    viewButton.dataset
                        .recordView
                );

                return;

            }


            const reportButton =
                event.target.closest(
                    "[data-record-report]"
                );


            if (
                reportButton
            ) {

                viewRecord(
                    reportButton.dataset
                        .recordReport
                );

                return;

            }


            const deleteButton =
                event.target.closest(
                    "[data-record-delete]"
                );


            if (
                deleteButton
            ) {

                deleteRecord(
                    deleteButton.dataset
                        .recordDelete
                );

                return;

            }

        }
    );


    document.addEventListener(
        "input",
        event => {

            if (
                event.target.matches(
                    ".timeline"
                )
            ) {

                const id =
                    event.target.id;


                const type =
                    id.replace(
                        "Seek",
                        ""
                    );


                seekVideo(
                    type,
                    event.target.value
                );

            }

        }
    );


    const compareButton =
        $("#compareButton");


    if (
        compareButton
    ) {

        compareButton.addEventListener(
            "click",
            compareRecords
        );

    }


    const reportButton =
        $("#generateReport");


    if (
        reportButton
    ) {

        reportButton.addEventListener(
            "click",
            generateReport
        );

    }


    const printButton =
        $("#printReport");


    if (
        printButton
    ) {

        printButton.addEventListener(
            "click",
            () => {

                window.print();

            }
        );

    }


    [
        "ski",
        "roller",
        "shooting"
    ].forEach(
        type => {

            const input =
                getFileInput(
                    type
                );


            if (!input) return;


            input.addEventListener(
                "change",
                event => {

                    const file =
                        event.target
                            .files?.[0];


                    if (file) {

                        loadVideo(
                            type,
                            file
                        );

                    }

                }
            );

        }
    );

}


/* =========================================================
   46. REPORT BRIDGE
========================================================= */

function generateReport() {

    const select =
        $("#reportRecord");


    const id =
        select?.value;


    if (!id) {

        toast(
            "리포트에 사용할 기록을 선택하세요."
        );

        return;

    }


    const record =
        APP.records.find(
            item =>
                item.id === id
        );


    if (!record) return;


    if (
        window.SeolcheonReport &&
        typeof window.SeolcheonReport
            .generate ===
        "function"
    ) {

        window.SeolcheonReport
            .generate(
                record
            );

        return;

    }


    const container =
        $("#reportContainer");


    if (!container) return;


    container.innerHTML =
        `

        <div class="report-header">

            <h2>
                ${escapeHTML(
                    record.typeName
                )}
                자세분석 리포트
            </h2>

            <p>
                ${formatDate(
                    record.createdAt
                )}
            </p>

        </div>


        <div class="report-section">

            <div class="report-metrics">

                <div class="report-metric">

                    <span>
                        평균 점수
                    </span>

                    <strong>
                        ${record.averageScore}
                    </strong>

                </div>


                <div class="report-metric">

                    <span>
                        최고 점수
                    </span>

                    <strong>
                        ${record.maxScore}
                    </strong>

                </div>


                <div class="report-metric">

                    <span>
                        분석 프레임
                    </span>

                    <strong>
                        ${record.frames.length}
                    </strong>

                </div>


                <div class="report-metric">

                    <span>
                        자세 캡처
                    </span>

                    <strong>
                        ${record.snapshots.length}
                    </strong>

                </div>

            </div>

        </div>

        `;

}


/* =========================================================
   47. INITIALIZATION
========================================================= */

function initializeApp() {

    loadRecords();

    setupNavigation();

    setupAppEvents();

    updateDashboard();

    showPage(
        "dashboard"
    );


    console.log(
        "설천 BIATHLON APP READY"
    );

}


/* =========================================================
   48. DOM READY
========================================================= */

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
   END OF app.js
========================================================= */