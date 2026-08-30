/* =========================================================
   설천 BIATHLON 자세분석 PRO
   report.js
   ---------------------------------------------------------
   - 스키 리포트
   - 롤러스키 리포트
   - 사격 자세 리포트
   - 분석 점수
   - 관절각 통계
   - 자세 변화 그래프
   - 중심 궤적
   - 캡처 자세 사진
   - 분석 구간 정보
========================================================= */

"use strict";


/* =========================================================
   01. REPORT API
========================================================= */

window.SeolcheonReport = {

    generate:
        generateReport,

    create:
        generateReport

};


/* =========================================================
   02. MAIN REPORT
========================================================= */

function generateReport(record) {

    const container =
        document.querySelector(
            "#reportContainer"
        );


    if (!container) {

        return;

    }


    if (!record) {

        container.innerHTML = `

            <div class="empty-state">

                리포트를 생성할
                분석 기록을 선택하세요.

            </div>

        `;

        return;

    }


    const type =
        record.type;


    const title =
        getReportTitle(
            type
        );


    const frames =
        Array.isArray(
            record.frames
        )
            ? record.frames
            : [];


    const snapshots =
        Array.isArray(
            record.snapshots
        )
            ? record.snapshots
            : [];


    const statistics =
        calculateStatistics(
            frames
        );


    container.innerHTML = `

        <div class="report-header">

            <div class="eyebrow">
                SEOLCHEON PERFORMANCE CENTER
            </div>

            <h2>
                ${escapeHTML(title)}
            </h2>

            <p>
                분석일시 :
                ${formatDate(
                    record.createdAt
                )}
            </p>

        </div>


        ${createSummary(
            record,
            statistics
        )}


        ${createAngleSection(
            type,
            statistics
        )}


        ${createTrajectorySection(
            frames
        )}


        ${createPostureSection(
            type,
            statistics
        )}


        ${createSnapshotSection(
            snapshots
        )}


        ${createRecommendationSection(
            type,
            statistics
        )}

    `;


    drawReportTrajectory(
        frames
    );


    drawReportAngleChart(
        frames
    );

}


/* =========================================================
   03. REPORT TITLE
========================================================= */

function getReportTitle(
    type
) {

    const titles = {

        ski:
            "스키 자세분석 리포트",

        roller:
            "롤러스키 자세분석 리포트",

        shooting:
            "사격 자세분석 리포트"

    };


    return (
        titles[type] ||
        "자세분석 리포트"
    );

}


/* =========================================================
   04. SUMMARY
========================================================= */

function createSummary(
    record,
    statistics
) {

    return `

        <section class="report-section">

            <h3>
                종합 분석
            </h3>


            <div class="report-metrics">

                <div class="report-metric">

                    <span>
                        평균 점수
                    </span>

                    <strong>
                        ${safeNumber(
                            record.averageScore
                        )}
                    </strong>

                </div>


                <div class="report-metric">

                    <span>
                        최고 점수
                    </span>

                    <strong>
                        ${safeNumber(
                            record.maxScore
                        )}
                    </strong>

                </div>


                <div class="report-metric">

                    <span>
                        분석 프레임
                    </span>

                    <strong>
                        ${statistics.frameCount}
                    </strong>

                </div>


                <div class="report-metric">

                    <span>
                        자세 캡처
                    </span>

                    <strong>
                        ${
                            Array.isArray(
                                record.snapshots
                            )
                                ? record.snapshots.length
                                : 0
                        }
                    </strong>

                </div>

            </div>

        </section>

    `;

}


/* =========================================================
   05. ANGLE SECTION
========================================================= */

function createAngleSection(
    type,
    statistics
) {

    const angle =
        statistics.angle;


    return `

        <section class="report-section">

            <h3>
                관절각 분석
            </h3>


            <div class="report-metrics">

                <div class="report-metric">

                    <span>
                        왼쪽 무릎 평균
                    </span>

                    <strong>
                        ${formatAngle(
                            angle.leftKnee
                        )}
                    </strong>

                </div>


                <div class="report-metric">

                    <span>
                        오른쪽 무릎 평균
                    </span>

                    <strong>
                        ${formatAngle(
                            angle.rightKnee
                        )}
                    </strong>

                </div>


                <div class="report-metric">

                    <span>
                        왼쪽 팔꿈치
                    </span>

                    <strong>
                        ${formatAngle(
                            angle.leftElbow
                        )}
                    </strong>

                </div>


                <div class="report-metric">

                    <span>
                        오른쪽 팔꿈치
                    </span>

                    <strong>
                        ${formatAngle(
                            angle.rightElbow
                        )}
                    </strong>

                </div>


                <div class="report-metric">

                    <span>
                        왼쪽 고관절
                    </span>

                    <strong>
                        ${formatAngle(
                            angle.leftHip
                        )}
                    </strong>

                </div>


                <div class="report-metric">

                    <span>
                        오른쪽 고관절
                    </span>

                    <strong>
                        ${formatAngle(
                            angle.rightHip
                        )}
                    </strong>

                </div>


                <div class="report-metric">

                    <span>
                        몸통 기울기
                    </span>

                    <strong>
                        ${formatAngle(
                            angle.body
                        )}
                    </strong>

                </div>


                <div class="report-metric">

                    <span>
                        좌우 무릎 차이
                    </span>

                    <strong>
                        ${formatAngle(
                            angle.kneeDifference
                        )}
                    </strong>

                </div>

            </div>


            <div class="chart-panel">

                <h3>
                    관절각 변화 그래프
                </h3>

                <canvas
                    id="reportAngleChart"
                ></canvas>

            </div>

        </section>

    `;

}


/* =========================================================
   06. TRAJECTORY
========================================================= */

function createTrajectorySection(
    frames
) {

    if (
        frames.length === 0
    ) {

        return "";

    }


    return `

        <section class="report-section">

            <h3>
                신체 중심 궤적
            </h3>


            <div class="chart-panel">

                <canvas
                    id="reportTrajectoryChart"
                ></canvas>

            </div>

        </section>

    `;

}


/* =========================================================
   07. POSTURE SECTION
========================================================= */

function createPostureSection(
    type,
    statistics
) {

    const symmetry =
        statistics.symmetry;


    const stability =
        statistics.stability;


    const confidence =
        statistics.confidence;


    return `

        <section class="report-section">

            <h3>
                자세 품질 분석
            </h3>


            <div class="report-metrics">

                <div class="report-metric">

                    <span>
                        좌우 대칭성
                    </span>

                    <strong>
                        ${Math.round(
                            symmetry
                        )}
                    </strong>

                </div>


                <div class="report-metric">

                    <span>
                        중심 안정성
                    </span>

                    <strong>
                        ${Math.round(
                            stability
                        )}
                    </strong>

                </div>


                <div class="report-metric">

                    <span>
                        인식 신뢰도
                    </span>

                    <strong>
                        ${Math.round(
                            confidence
                        )}%
                    </strong>

                </div>


                <div class="report-metric">

                    <span>
                        동작 일관성
                    </span>

                    <strong>
                        ${Math.round(
                            statistics.consistency
                        )}
                    </strong>

                </div>

            </div>


            <div class="panel report-analysis-text">

                ${createAnalysisComment(
                    type,
                    statistics
                )}

            </div>

        </section>

    `;

}


/* =========================================================
   08. SNAPSHOTS
========================================================= */

function createSnapshotSection(
    snapshots
) {

    if (
        !snapshots ||
        snapshots.length === 0
    ) {

        return `

            <section class="report-section">

                <h3>
                    자세 캡처
                </h3>

                <div class="empty-state">

                    저장된 자세 사진이 없습니다.

                </div>

            </section>

        `;

    }


    const images =
        snapshots
            .slice(
                -12
            )
            .map(
                (snapshot, index) => `

                    <div class="report-image">

                        <img
                            src="${snapshot.dataURL}"
                            alt="자세 캡처 ${index + 1}"
                        >

                    </div>

                `
            )
            .join("");


    return `

        <section class="report-section">

            <h3>
                자세 캡처
            </h3>

            <div class="report-images">

                ${images}

            </div>

        </section>

    `;

}


/* =========================================================
   09. RECOMMENDATION
========================================================= */

function createRecommendationSection(
    type,
    statistics
) {

    const comments = [];


    if (
        statistics.symmetry <
        85
    ) {

        comments.push(
            "좌우 관절각 차이를 줄이는 동작을 확인해 보세요."
        );

    }


    if (
        statistics.stability <
        80
    ) {

        comments.push(
            "신체 중심의 흔들림이 큰 구간을 영상으로 다시 확인해 보세요."
        );

    }


    if (
        statistics.consistency <
        80
    ) {

        comments.push(
            "동작 패턴이 일정하지 않은 구간을 슬로모션으로 확인해 보세요."
        );

    }


    if (
        statistics.confidence <
        70
    ) {

        comments.push(
            "카메라 위치나 조명을 조정하면 사람 인식 품질이 좋아질 수 있습니다."
        );

    }


    if (
        comments.length === 0
    ) {

        comments.push(
            "전체적으로 안정적인 자세 데이터가 수집되었습니다."
        );

    }


    return `

        <section class="report-section">

            <h3>
                분석 메모
            </h3>

            <div class="panel">

                <ul class="report-comments">

                    ${
                        comments
                            .map(
                                comment =>
                                    `<li>
                                        ${escapeHTML(
                                            comment
                                        )}
                                    </li>`
                            )
                            .join("")
                    }

                </ul>

            </div>

        </section>

    `;

}


/* =========================================================
   10. ANALYSIS COMMENT
========================================================= */

function createAnalysisComment(
    type,
    statistics
) {

    const name =
        getReportTitle(
            type
        )
        .replace(
            " 리포트",
            ""
        );


    return `

        <p>

            <strong>
                ${escapeHTML(
                    name
                )}
            </strong>
            분석에서 수집된 자세 데이터를
            기준으로 좌우 대칭성,
            신체 중심 안정성,
            관절각 변화와
            인식 신뢰도를 종합했습니다.

        </p>


        <p>

            이 결과는 영상 기반 자세분석값이므로
            실제 경기 환경에서는 카메라 위치,
            촬영 각도와 영상 품질에 따라
            측정값이 달라질 수 있습니다.

        </p>

    `;

}


/* =========================================================
   11. STATISTICS
========================================================= */

function calculateStatistics(
    frames
) {

    const angleKeys = [

        "leftKnee",
        "rightKnee",

        "leftElbow",
        "rightElbow",

        "leftHip",
        "rightHip",

        "body"

    ];


    const angle = {};


    angleKeys.forEach(
        key => {

            angle[key] =
                averageProperty(
                    frames,
                    `angles.${key}`
                );

        }
    );


    angle.kneeDifference =
        difference(
            angle.leftKnee,
            angle.rightKnee
        );


    const symmetryValues =
        frames
            .map(
                frame =>
                    calculateFrameSymmetry(
                        frame
                    )
            )
            .filter(
                Number.isFinite
            );


    const stabilityValues =
        frames
            .map(
                frame =>
                    Number(
                        frame.score
                    )
            )
            .filter(
                Number.isFinite
            );


    const confidenceValues =
        frames
            .map(
                frame =>
                    Number(
                        frame.confidence
                    )
            )
            .filter(
                Number.isFinite
            );


    const symmetry =
        average(
            symmetryValues
        );


    const confidence =
        average(
            confidenceValues
        ) * 100;


    const stability =
        calculateStability(
            frames
        );


    const consistency =
        calculateConsistency(
            stabilityValues
        );


    return {

        frameCount:
            frames.length,

        angle,

        symmetry:
            Number.isFinite(
                symmetry
            )
                ? symmetry
                : 0,

        stability,

        confidence:
            Number.isFinite(
                confidence
            )
                ? confidence
                : 0,

        consistency

    };

}


/* =========================================================
   12. FRAME SYMMETRY
========================================================= */

function calculateFrameSymmetry(
    frame
) {

    const angles =
        frame?.angles;


    if (!angles) {

        return NaN;

    }


    const differences = [

        difference(
            angles.leftKnee,
            angles.rightKnee
        ),

        difference(
            angles.leftHip,
            angles.rightHip
        ),

        difference(
            angles.leftElbow,
            angles.rightElbow
        )

    ]
    .filter(
        Number.isFinite
    );


    if (
        differences.length === 0
    ) {

        return NaN;

    }


    const avg =
        average(
            differences
        );


    return Math.max(
        0,
        Math.min(
            100,
            100 -
            avg * 1.5
        )
    );

}


/* =========================================================
   13. STABILITY
========================================================= */

function calculateStability(
    frames
) {

    if (
        frames.length < 2
    ) {

        return 0;

    }


    const centers =
        frames
            .map(
                frame =>
                    frame.center
            )
            .filter(
                point =>
                    point &&
                    Number.isFinite(
                        Number(point.x)
                    ) &&
                    Number.isFinite(
                        Number(point.y)
                    )
            );


    if (
        centers.length < 2
    ) {

        return 0;

    }


    let movement = 0;


    for (
        let i = 1;
        i < centers.length;
        i++
    ) {

        const dx =
            centers[i].x -
            centers[i - 1].x;


        const dy =
            centers[i].y -
            centers[i - 1].y;


        movement +=
            Math.sqrt(
                dx * dx +
                dy * dy
            );

    }


    const averageMovement =
        movement /
        Math.max(
            1,
            centers.length - 1
        );


    return Math.max(
        0,
        Math.min(
            100,
            100 -
            averageMovement * 700
        )
    );

}


/* =========================================================
   14. CONSISTENCY
========================================================= */

function calculateConsistency(
    values
) {

    if (
        values.length < 2
    ) {

        return 0;

    }


    const avg =
        average(
            values
        );


    const variance =
        average(
            values.map(
                value =>
                    Math.pow(
                        value - avg,
                        2
                    )
            )
        );


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
   15. REPORT ANGLE CHART
========================================================= */

function drawReportAngleChart(
    frames
) {

    if (
        !window.Chart
    ) {

        return;

    }


    const canvas =
        document.querySelector(
            "#reportAngleChart"
        );


    if (!canvas) return;


    const labels =
        frames.map(
            (frame, index) =>
                frame.time !== undefined
                    ? Number(
                        frame.time
                    ).toFixed(2)
                    : index
        );


    const leftKnee =
        frames.map(
            frame =>
                frame.angles?.leftKnee ??
                null
        );


    const rightKnee =
        frames.map(
            frame =>
                frame.angles?.rightKnee ??
                null
        );


    const body =
        frames.map(
            frame =>
                frame.angles?.body ??
                null
        );


    new Chart(
        canvas,
        {

            type: "line",

            data: {

                labels,

                datasets: [

                    {
                        label:
                            "왼쪽 무릎",

                        data:
                            leftKnee
                    },

                    {
                        label:
                            "오른쪽 무릎",

                        data:
                            rightKnee
                    },

                    {
                        label:
                            "몸통",

                        data:
                            body
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
                        max: 180

                    }

                }

            }

        }
    );

}


/* =========================================================
   16. REPORT TRAJECTORY
========================================================= */

function drawReportTrajectory(
    frames
) {

    if (
        !window.Chart
    ) {

        return;

    }


    const canvas =
        document.querySelector(
            "#reportTrajectoryChart"
        );


    if (!canvas) return;


    const data =
        frames
            .map(
                frame => {

                    const center =
                        frame.center;


                    if (
                        !center
                    ) {

                        return null;

                    }


                    return {

                        x:
                            Number(
                                center.x
                            ),

                        y:
                            Number(
                                center.y
                            )

                    };

                }
            )
            .filter(
                Boolean
            );


    new Chart(
        canvas,
        {

            type: "line",

            data: {

                datasets: [

                    {

                        label:
                            "신체 중심",

                        data,

                        parsing:
                            false,

                        showLine:
                            true,

                        pointRadius:
                            2

                    }

                ]

            },

            options: {

                responsive: true,

                maintainAspectRatio:
                    false,

                animation: false,

                scales: {

                    x: {

                        min: 0,
                        max: 1

                    },

                    y: {

                        min: 0,
                        max: 1

                    }

                }

            }

        }
    );

}


/* =========================================================
   17. HELPERS
========================================================= */

function average(
    values
) {

    const valid =
        values
            .map(
                Number
            )
            .filter(
                Number.isFinite
            );


    if (
        valid.length === 0
    ) {

        return 0;

    }


    return (
        valid.reduce(
            (sum, value) =>
                sum + value,
            0
        ) /
        valid.length
    );

}


function averageProperty(
    objects,
    path
) {

    const parts =
        path.split(".");


    const values =
        objects
            .map(
                object => {

                    let value =
                        object;


                    parts.forEach(
                        part => {

                            value =
                                value?.[part];

                        }
                    );


                    return Number(
                        value
                    );

                }
            )
            .filter(
                Number.isFinite
            );


    return values.length
        ? average(values)
        : null;

}


function difference(
    a,
    b
) {

    if (
        !Number.isFinite(
            Number(a)
        ) ||
        !Number.isFinite(
            Number(b)
        )
    ) {

        return null;

    }


    return Math.abs(
        Number(a) -
        Number(b)
    );

}


function safeNumber(
    value
) {

    const number =
        Number(
            value
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return "-";

    }


    return Math.round(
        number
    );

}


function formatAngle(
    value
) {

    if (
        !Number.isFinite(
            Number(value)
        )
    ) {

        return "-";

    }


    return `${Math.round(
        Number(value)
    )}°`;

}


function formatDate(
    value
) {

    if (!value) {

        return "-";

    }


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "-";

    }


    return date.toLocaleString(
        "ko-KR"
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
   END
========================================================= */