/* =========================================================
   설천 바이애슬론 자세분석 PRO
   report.js
   ---------------------------------------------------------
   리포트 시스템
   - 스키 리포트
   - 롤러스키 리포트
   - 사격 리포트
   - 격발 그래프
   - 중심 궤적
   - 관절각
   - 5발 분석
   - 핵심 프레임
   - 자동 코칭
   - 인쇄 / PDF 저장
========================================================= */


/* =========================================================
   01. REPORT STATE
========================================================= */

const ReportState = {

  currentRecord: null,

  currentType: "ski",

  charts: {
    angle: null,
    trajectory: null,
    trigger: null,
    stability: null
  }

};


/* =========================================================
   02. TYPE INFORMATION
========================================================= */

const REPORT_TYPES = {

  ski: {

    title:
      "바이애슬론 스키 자세분석 리포트",

    subtitle:
      "SKI TECHNIQUE ANALYSIS",

    icon:
      "🎿"

  },


  roller: {

    title:
      "바이애슬론 롤러스키 자세분석 리포트",

    subtitle:
      "ROLLER SKI TECHNIQUE ANALYSIS",

    icon:
      "🛼"

  },


  shooting: {

    title:
      "바이애슬론 사격 자세분석 리포트",

    subtitle:
      "SHOOTING TECHNIQUE ANALYSIS",

    icon:
      "🎯"

  }

};


/* =========================================================
   03. SET CURRENT RECORD
========================================================= */

function setCurrentRecord(
  record
) {

  if (!record) {
    return;
  }


  ReportState.currentRecord =
    record;


  ReportState.currentType =
    record.type ||
    "ski";


  renderReport();

}


/* =========================================================
   04. GET CURRENT RECORD
========================================================= */

function getCurrentRecord() {

  if (
    ReportState.currentRecord
  ) {

    return ReportState.currentRecord;

  }


  if (
    window.BiathlonStore &&
    BiathlonStore.currentRecordId
  ) {

    return BiathlonStore.records.find(
      record =>
        record.id ===
        BiathlonStore.currentRecordId
    ) || null;

  }


  return null;

}


/* =========================================================
   05. OPEN REPORT
========================================================= */

function openReport(
  type,
  recordId = null
) {

  ReportState.currentType =
    type || "ski";


  if (
    recordId &&
    window.BiathlonStore
  ) {

    ReportState.currentRecord =
      BiathlonStore.records.find(
        record =>
          record.id === recordId
      ) || null;

  }


  if (
    !ReportState.currentRecord &&
    window.BiathlonStore
  ) {

    ReportState.currentRecord =
      BiathlonStore.records.find(
        record =>
          record.type ===
          ReportState.currentType
      ) || null;

  }


  renderReport();

}


/* =========================================================
   06. RENDER REPORT
========================================================= */

function renderReport() {

  const record =
    getCurrentRecord();


  const container =
    document.getElementById(
      "reportContainer"
    );


  if (!container) {
    return;
  }


  if (!record) {

    renderEmptyReport(
      container
    );

    return;
  }


  const type =
    REPORT_TYPES[
      record.type
    ] ||
    REPORT_TYPES.ski;


  container.innerHTML = `

    <div class="report-document">

      ${renderReportHeader(
        record,
        type
      )}

      ${renderAthleteSummary(
        record
      )}

      ${renderScoreSection(
        record
      )}

      ${
        record.type === "shooting"
          ? renderShootingReport(
              record
            )
          : record.type === "roller"
            ? renderRollerReport(
                record
              )
            : renderSkiReport(
                record
              )
      }

      ${renderFeedbackSection(
        record
      )}

      ${renderReportFooter(
        record
      )}

    </div>

  `;


  renderReportCharts(
    record
  );

}


/* =========================================================
   07. EMPTY REPORT
========================================================= */

function renderEmptyReport(
  container
) {

  container.innerHTML = `

    <div class="report-empty">

      <div class="report-empty-icon">
        📊
      </div>

      <h2>
        분석 리포트
      </h2>

      <p>
        먼저 자세분석을 완료하면
        분석 결과가 이곳에 표시됩니다.
      </p>

    </div>

  `;

}


/* =========================================================
   08. REPORT HEADER
========================================================= */

function renderReportHeader(
  record,
  type
) {

  return `

    <div class="report-header">

      <div class="report-brand">

        <div class="report-logo">
          ${type.icon}
        </div>

        <div>

          <div class="report-brand-name">
            설천
          </div>

          <div class="report-brand-sub">
            BIATHLON PERFORMANCE ANALYSIS
          </div>

        </div>

      </div>


      <div class="report-title">

        <h1>
          ${type.title}
        </h1>

        <span>
          ${type.subtitle}
        </span>

      </div>


      <div class="report-date">

        ${escapeReportHtml(
          record.date ||
          formatReportDate(
            record.createdAt
          )
        )}

      </div>

    </div>

  `;

}


/* =========================================================
   09. ATHLETE SUMMARY
========================================================= */

function renderAthleteSummary(
  record
) {

  return `

    <section
      class="report-section
             athlete-summary"
    >

      <div class="section-heading">

        <span>
          01
        </span>

        <h2>
          선수 정보
        </h2>

      </div>


      <div class="athlete-report-grid">

        <div class="report-info-card">

          <span>
            선수명
          </span>

          <strong>
            ${escapeReportHtml(
              record.athleteName ||
              "선수 미등록"
            )}
          </strong>

        </div>


        <div class="report-info-card">

          <span>
            분석 종목
          </span>

          <strong>
            ${escapeReportHtml(
              record.typeName ||
              getReportTypeName(
                record.type
              )
            )}
          </strong>

        </div>


        <div class="report-info-card">

          <span>
            분석 카메라
          </span>

          <strong>
            ${getReportCameraName(
              record.camera
            )}
          </strong>

        </div>


        <div class="report-info-card">

          <span>
            분석 영상
          </span>

          <strong>
            ${escapeReportHtml(
              record.videoName ||
              "영상 기록"
            )}
          </strong>

        </div>


        ${
          record.shootingMode
            ? `

              <div class="report-info-card">

                <span>
                  사격 자세
                </span>

                <strong>
                  ${getReportShootingMode(
                    record.shootingMode
                  )}
                </strong>

              </div>

            `
            : ""
        }

      </div>

    </section>

  `;

}


/* =========================================================
   10. SCORE
========================================================= */

function renderScoreSection(
  record
) {

  const score =
    Number.isFinite(
      Number(record.score)
    )
      ? Math.round(
          Number(record.score)
        )
      : "-";


  return `

    <section
      class="report-section
             report-score-section"
    >

      <div class="section-heading">

        <span>
          02
        </span>

        <h2>
          종합 분석 점수
        </h2>

      </div>


      <div class="report-score-layout">

        <div class="report-score-main">

          <div class="report-score-number">
            ${score}
          </div>

          <div class="report-score-label">
            PERFORMANCE SCORE
          </div>

        </div>


        <div class="report-score-bars">

          ${renderMetricBar(
            "좌우 대칭성",
            record.metrics?.symmetry
          )}

          ${renderMetricBar(
            "중심 안정성",
            record.metrics?.stability
          )}

          ${renderMetricBar(
            "동작 일관성",
            record.metrics?.consistency
          )}

        </div>

      </div>

    </section>

  `;

}


/* =========================================================
   11. METRIC BAR
========================================================= */

function renderMetricBar(
  name,
  value
) {

  const score =
    Number.isFinite(
      Number(value)
    )
      ? Math.round(
          Number(value)
        )
      : 0;


  return `

    <div class="report-metric">

      <div class="report-metric-top">

        <span>
          ${name}
        </span>

        <strong>
          ${score}
        </strong>

      </div>


      <div class="report-metric-track">

        <div
          class="report-metric-fill"
          style="width:${clampReport(
            score,
            0,
            100
          )}%"
        ></div>

      </div>

    </div>

  `;

}


/* =========================================================
   12. SKI REPORT
========================================================= */

function renderSkiReport(
  record
) {

  return `

    <section
      class="report-section"
    >

      <div class="section-heading">

        <span>
          03
        </span>

        <h2>
          스키 자세분석
        </h2>

      </div>


      <div class="report-two-column">

        <div>

          <h3>
            관절각 분석
          </h3>

          <div
            class="report-angle-grid"
          >

            ${renderAngleCard(
              "좌측 무릎",
              record.metrics?.leftKnee
            )}

            ${renderAngleCard(
              "우측 무릎",
              record.metrics?.rightKnee
            )}

            ${renderAngleCard(
              "좌측 고관절",
              record.metrics?.leftHip
            )}

            ${renderAngleCard(
              "우측 고관절",
              record.metrics?.rightHip
            )}

            ${renderAngleCard(
              "상체 각도",
              record.metrics?.trunk
            )}

          </div>

        </div>


        <div>

          <h3>
            중심 궤적
          </h3>

          <div class="report-chart-box">

            <canvas
              id="reportTrajectoryChart"
            ></canvas>

          </div>

        </div>

      </div>


      <div class="report-chart-wide">

        <h3>
          무릎각 변화
        </h3>

        <div class="report-chart-box">

          <canvas
            id="reportAngleChart"
          ></canvas>

        </div>

      </div>


      ${renderKeyFrames(
        record
      )}

    </section>

  `;

}


/* =========================================================
   13. ROLLER REPORT
========================================================= */

function renderRollerReport(
  record
) {

  return `

    <section
      class="report-section"
    >

      <div class="section-heading">

        <span>
          03
        </span>

        <h2>
          롤러스키 자세분석
        </h2>

      </div>


      <div class="report-analysis-grid">

        ${renderMetricCard(
          "좌우 대칭성",
          record.metrics?.symmetry
        )}

        ${renderMetricCard(
          "중심 안정성",
          record.metrics?.stability
        )}

        ${renderMetricCard(
          "동작 일관성",
          record.metrics?.consistency
        )}

        ${renderMetricCard(
          "좌측 무릎",
          record.metrics?.leftKnee,
          "°"
        )}

        ${renderMetricCard(
          "우측 무릎",
          record.metrics?.rightKnee,
          "°"
        )}

      </div>


      <div class="report-chart-wide">

        <h3>
          추진 / 회복 동작 변화
        </h3>

        <div class="report-chart-box">

          <canvas
            id="reportAngleChart"
          ></canvas>

        </div>

      </div>


      <div class="report-chart-wide">

        <h3>
          신체중심 궤적
        </h3>

        <div class="report-chart-box">

          <canvas
            id="reportTrajectoryChart"
          ></canvas>

        </div>

      </div>


      ${renderKeyFrames(
        record
      )}

    </section>

  `;

}


/* =========================================================
   14. SHOOTING REPORT
========================================================= */

function renderShootingReport(
  record
) {

  const shots =
    Array.isArray(
      record.shots
    )
      ? record.shots
      : [];


  return `

    <section
      class="report-section
             shooting-report"
    >

      <div class="section-heading">

        <span>
          03
        </span>

        <h2>
          사격 자세분석
        </h2>

      </div>


      <div
        class="shooting-report-alert"
      >

        <strong>
          사격 분석 안내
        </strong>

        <p>
          영상 기반으로 추정된 격발 후보와
          신체 움직임을 표시합니다.
          실제 격발 여부는 영상과 기록을
          함께 확인해야 합니다.
        </p>

      </div>


      <div class="report-analysis-grid">

        ${renderMetricCard(
          "종합 안정성",
          record.metrics?.stability
        )}

        ${renderMetricCard(
          "자세 일관성",
          record.metrics?.consistency
        )}

        ${renderMetricCard(
          "좌우 대칭성",
          record.metrics?.symmetry
        )}

        ${renderMetricCard(
          "무릎 평균각",
          averageReportAngles(
            record.metrics
          ),
          "°"
        )}

      </div>


      <div class="report-chart-wide">

        <h3>
          격발 후보 변화 그래프
        </h3>

        <div class="report-chart-box">

          <canvas
            id="reportTriggerChart"
          ></canvas>

        </div>

      </div>


      <div class="report-chart-wide">

        <h3>
          신체중심 궤적 변화
        </h3>

        <div class="report-chart-box">

          <canvas
            id="reportTrajectoryChart"
          ></canvas>

        </div>

      </div>


      <div class="report-chart-wide">

        <h3>
          격발 전후 자세 변화
        </h3>

        <div class="report-chart-box">

          <canvas
            id="reportAngleChart"
          ></canvas>

        </div>

      </div>


      <div class="report-section-inner">

        <h3>
          5발 사격 분석
        </h3>


        <div class="shot-report-grid">

          ${renderShotReportCards(
            shots
          )}

        </div>

      </div>


      ${renderKeyFrames(
        record
      )}

    </section>

  `;

}


/* =========================================================
   15. SHOT CARDS
========================================================= */

function renderShotReportCards(
  shots
) {

  const cards = [];


  for (
    let i = 1;
    i <= 5;
    i++
  ) {

    const shot =
      shots.find(
        item =>
          Number(
            item.number
          ) === i
      );


    cards.push(`

      <div class="shot-report-card">

        <div class="shot-report-number">
          ${i}
        </div>


        <div class="shot-report-info">

          <span>
            격발 후보
          </span>

          <strong>
            ${
              shot
                ? formatReportTime(
                    shot.time
                  )
                : "-"
            }
          </strong>

        </div>


        <div class="shot-report-info">

          <span>
            간격
          </span>

          <strong>
            ${
              shot &&
              Number.isFinite(
                Number(
                  shot.interval
                )
              )
                ? `${Number(
                    shot.interval
                  ).toFixed(2)}초`
                : "-"
            }
          </strong>

        </div>


        <div class="shot-report-status">

          ${
            shot?.status ||
            "분석 필요"
          }

        </div>

      </div>

    `);

  }


  return cards.join("");

}


/* =========================================================
   16. KEY FRAMES
========================================================= */

function renderKeyFrames(
  record
) {

  const frames =
    Array.isArray(
      record.keyFrames
    )
      ? record.keyFrames
      : [];


  return `

    <div class="report-section-inner">

      <h3>
        핵심 자세 프레임
      </h3>


      ${
        frames.length
          ? `

            <div
              class="report-key-frame-grid"
            >

              ${frames
                .slice(0, 6)
                .map(
                  (frame, index) => `

                    <div
                      class="report-key-frame"
                    >

                      <div
                        class="report-frame-placeholder"
                      >
                        FRAME
                        ${index + 1}
                      </div>

                      <div
                        class="report-frame-meta"
                      >

                        <span>
                          ${formatReportTime(
                            frame.time
                          )}
                        </span>

                        <strong>
                          ${Math.round(
                            frame.quality ||
                            0
                          )}점
                        </strong>

                      </div>

                    </div>

                  `
                )
                .join("")}

            </div>

          `
          : `

            <div class="report-empty-small">
              분석 중 자동으로 핵심 프레임이 생성됩니다.
            </div>

          `
      }

    </div>

  `;

}


/* =========================================================
   17. ANGLE CARD
========================================================= */

function renderAngleCard(
  name,
  value
) {

  return `

    <div class="report-angle-card">

      <span>
        ${name}
      </span>

      <strong>
        ${
          Number.isFinite(
            Number(value)
          )
            ? `${Math.round(
                Number(value)
              )}°`
            : "-"
        }
      </strong>

    </div>

  `;

}


/* =========================================================
   18. METRIC CARD
========================================================= */

function renderMetricCard(
  name,
  value,
  suffix = ""
) {

  const number =
    Number.isFinite(
      Number(value)
    )
      ? Math.round(
          Number(value)
        )
      : null;


  return `

    <div class="report-analysis-card">

      <span>
        ${name}
      </span>

      <strong>
        ${
          number !== null
            ? `${number}${suffix}`
            : "-"
        }
      </strong>

    </div>

  `;

}


/* =========================================================
   19. FEEDBACK
========================================================= */

function renderFeedbackSection(
  record
) {

  const feedback =
    record.feedback ||
    {};


  const strengths =
    Array.isArray(
      feedback.strengths
    )
      ? feedback.strengths
      : [];


  const improvements =
    Array.isArray(
      feedback.improvements
    )
      ? feedback.improvements
      : [];


  return `

    <section
      class="report-section
             report-feedback"
    >

      <div class="section-heading">

        <span>
          04
        </span>

        <h2>
          코치 분석
        </h2>

      </div>


      <div class="report-summary-box">

        <strong>
          ${escapeReportHtml(
            feedback.summary ||
            "분석 결과를 바탕으로 자세를 확인하세요."
          )}
        </strong>

        <p>
          ${escapeReportHtml(
            feedback.coach ||
            "분석 데이터를 참고하여 다음 훈련을 계획하세요."
          )}
        </p>

      </div>


      <div class="feedback-columns">

        <div class="feedback-box">

          <h3>
            잘된 점
          </h3>

          ${
            strengths.length
              ? `

                <ul>

                  ${strengths
                    .map(
                      item =>
                        `<li>
                          ${escapeReportHtml(
                            item
                          )}
                        </li>`
                    )
                    .join("")}

                </ul>

              `
              : `
                <p>
                  분석 데이터가 누적되면
                  강점이 표시됩니다.
                </p>
              `
          }

        </div>


        <div class="feedback-box">

          <h3>
            개선 포인트
          </h3>

          ${
            improvements.length
              ? `

                <ul>

                  ${improvements
                    .map(
                      item =>
                        `<li>
                          ${escapeReportHtml(
                            item
                          )}
                        </li>`
                    )
                    .join("")}

                </ul>

              `
              : `
                <p>
                  현재 큰 개선 포인트가 없습니다.
                </p>
              `
          }

        </div>

      </div>

    </section>

  `;

}


/* =========================================================
   20. FOOTER
========================================================= */

function renderReportFooter(
  record
) {

  return `

    <div class="report-footer">

      <div>
        설천 바이애슬론 자세분석 PRO
      </div>

      <div>
        ${escapeReportHtml(
          record.athleteName ||
          "Athlete"
        )}
      </div>

    </div>

  `;

}


/* =========================================================
   21. REPORT CHARTS
========================================================= */

function renderReportCharts(
  record
) {

  if (
    typeof Chart ===
    "undefined"
  ) {

    return;
  }


  setTimeout(
    () => {

      if (
        record.type ===
        "shooting"
      ) {

        createReportTriggerChart(
          record
        );

      }


      createReportAngleChart(
        record
      );


      createReportTrajectoryChart(
        record
      );

    },
    50
  );

}


/* =========================================================
   22. ANGLE CHART
========================================================= */

function createReportAngleChart(
  record
) {

  const canvas =
    document.getElementById(
      "reportAngleChart"
    );


  if (!canvas) {
    return;
  }


  destroyReportChart(
    "angle"
  );


  const history =
    buildAngleHistory(
      record
    );


  const labels =
    history.map(
      item =>
        Number(
          item.time
        ).toFixed(1)
    );


  const left =
    history.map(
      item =>
        item.leftKnee
    );


  const right =
    history.map(
      item =>
        item.rightKnee
    );


  ReportState.charts.angle =
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

              data:
                left,

              borderWidth: 2,

              pointRadius: 0,

              tension: 0.25

            },

            {
              label:
                "우측 무릎",

              data:
                right,

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

          animation: false,

          scales: {

            y: {

              min: 0,

              max: 180,

              title: {

                display: true,

                text:
                  "관절각(°)"

              }

            },

            x: {

              title: {

                display: true,

                text:
                  "시간(초)"

              }

            }

          }

        }

      }
    );

}


/* =========================================================
   23. TRIGGER CHART
========================================================= */

function createReportTriggerChart(
  record
) {

  const canvas =
    document.getElementById(
      "reportTriggerChart"
    );


  if (!canvas) {
    return;
  }


  destroyReportChart(
    "trigger"
  );


  const triggerData =
    Array.isArray(
      record.triggerData
    )
      ? record.triggerData
      : [];


  const labels =
    triggerData.map(
      item =>
        formatReportTime(
          item.time
        )
    );


  const values =
    triggerData.map(
      item =>
        Number(
          item.confidence || 0
        ) * 100
    );


  ReportState.charts.trigger =
    new Chart(
      canvas,
      {

        type: "line",

        data: {

          labels,

          datasets: [

            {
              label:
                "격발 후보 신뢰도",

              data:
                values,

              borderWidth: 2,

              pointRadius: 5,

              tension: 0.15

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

            },

            x: {

              title: {

                display: true,

                text:
                  "영상 시간"

              }

            }

          }

        }

      }
    );

}


/* =========================================================
   24. TRAJECTORY CHART
========================================================= */

function createReportTrajectoryChart(
  record
) {

  const canvas =
    document.getElementById(
      "reportTrajectoryChart"
    );


  if (!canvas) {
    return;
  }


  destroyReportChart(
    "trajectory"
  );


  const trajectory =
    Array.isArray(
      record.trajectory
    )
      ? record.trajectory
      : [];


  if (
    trajectory.length < 2
  ) {

    return;
  }


  const labels =
    trajectory.map(
      item =>
        Number(
          item.t
        ).toFixed(1)
    );


  const xValues =
    trajectory.map(
      item =>
        Number(
          item.x
        ).toFixed(4)
    );


  const yValues =
    trajectory.map(
      item =>
        Number(
          item.y
        ).toFixed(4)
    );


  ReportState.charts.trajectory =
    new Chart(
      canvas,
      {

        type: "line",

        data: {

          labels,

          datasets: [

            {
              label:
                "중심 X",

              data:
                xValues,

              borderWidth: 2,

              pointRadius: 0,

              tension: 0.15

            },

            {
              label:
                "중심 Y",

              data:
                yValues,

              borderWidth: 2,

              pointRadius: 0,

              tension: 0.15

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

              title: {

                display: true,

                text:
                  "시간(초)"

              }

            },

            y: {

              title: {

                display: true,

                text:
                  "화면 좌표"

              }

            }

          }

        }

      }
    );

}


/* =========================================================
   25. ANGLE HISTORY
========================================================= */

function buildAngleHistory(
  record
) {

  /*
    현재 record에는 최근 프레임 데이터가
    들어올 수 있고, 없는 경우 metrics를
    이용하여 최소한의 결과를 표시한다.
  */

  if (
    Array.isArray(
      record.angleHistory
    ) &&
    record.angleHistory.length
  ) {

    return record.angleHistory;

  }


  if (
    record.metrics
  ) {

    return [

      {

        time: 0,

        leftKnee:
          record.metrics.leftKnee,

        rightKnee:
          record.metrics.rightKnee,

        leftHip:
          record.metrics.leftHip,

        rightHip:
          record.metrics.rightHip,

        trunk:
          record.metrics.trunk

      }

    ];

  }


  return [];

}


/* =========================================================
   26. DESTROY CHART
========================================================= */

function destroyReportChart(
  type
) {

  const chart =
    ReportState.charts[
      type
    ];


  if (chart) {

    chart.destroy();

    ReportState.charts[
      type
    ] = null;

  }

}


/* =========================================================
   27. PRINT
========================================================= */

function printReport() {

  const record =
    getCurrentRecord();


  if (!record) {

    alert(
      "먼저 분석 리포트를 선택하세요."
    );

    return;
  }


  window.print();

}


/* =========================================================
   28. DOWNLOAD HTML REPORT
========================================================= */

function downloadReportHtml() {

  const record =
    getCurrentRecord();


  if (!record) {

    BiathlonEvents?.showToast(
      "다운로드할 리포트가 없습니다."
    );

    return;
  }


  const container =
    document.getElementById(
      "reportContainer"
    );


  if (!container) {
    return;
  }


  const html = `

<!DOCTYPE html>

<html lang="ko">

<head>

<meta charset="UTF-8">

<title>
설천 바이애슬론 분석 리포트
</title>

<style>

body {
  font-family:
    Arial,
    sans-serif;

  margin: 0;

  padding: 40px;

  color: #17232b;

  background: #f5f8fa;
}

.report-document {
  max-width: 1000px;

  margin: auto;

  background: white;

  padding: 40px;
}

h1,
h2,
h3 {
  margin-top: 0;
}

.report-header {
  border-bottom:
    2px solid #dce6eb;

  padding-bottom: 25px;

  margin-bottom: 30px;
}

.report-section {
  margin-bottom: 35px;
}

.report-score-number {
  font-size: 70px;

  font-weight: 800;
}

.report-score-layout {
  display: grid;

  grid-template-columns:
    220px 1fr;

  gap: 30px;
}

.report-metric {
  margin-bottom: 18px;
}

.report-metric-track {
  height: 8px;

  background: #e7edf0;

  border-radius: 20px;
}

.report-metric-fill {
  height: 100%;

  background: #315f76;

  border-radius: 20px;
}

.report-chart-box {
  height: 300px;

  position: relative;
}

.report-analysis-grid {
  display: grid;

  grid-template-columns:
    repeat(4, 1fr);

  gap: 12px;
}

.report-analysis-card {
  border:
    1px solid #dce6eb;

  padding: 20px;

  border-radius: 10px;
}

.report-analysis-card span {
  display: block;

  font-size: 12px;

  color: #6b7b84;
}

.report-analysis-card strong {
  display: block;

  font-size: 28px;

  margin-top: 8px;
}

.shot-report-grid {
  display: grid;

  grid-template-columns:
    repeat(5, 1fr);

  gap: 10px;
}

.shot-report-card {
  border:
    1px solid #dce6eb;

  padding: 15px;

  border-radius: 10px;
}

.shot-report-number {
  font-size: 25px;

  font-weight: bold;
}

.shot-report-info span {
  display: block;

  font-size: 11px;

  color: #71808a;

  margin-top: 10px;
}

.report-key-frame-grid {
  display: grid;

  grid-template-columns:
    repeat(3, 1fr);

  gap: 15px;
}

.report-frame-placeholder {
  height: 160px;

  display: flex;

  align-items: center;

  justify-content: center;

  background: #edf3f6;
}

.report-frame-meta {
  display: flex;

  justify-content:
    space-between;

  padding: 8px;
}

.report-footer {
  border-top:
    1px solid #dce6eb;

  margin-top: 40px;

  padding-top: 15px;

  display: flex;

  justify-content:
    space-between;

  color: #6b7b84;

  font-size: 12px;
}

@media print {

  body {
    background: white;

    padding: 0;
  }

  .report-document {
    padding: 20px;
  }

}

</style>

</head>

<body>

${container.innerHTML}

</body>

</html>

  `;


  const blob =
    new Blob(
      [html],
      {
        type:
          "text/html;charset=utf-8"
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
    `설천_${getReportTypeName(
      record.type
    )}_리포트.html`;


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


  URL.revokeObjectURL(
    url
  );


  BiathlonEvents?.showToast(
    "리포트를 저장했습니다."
  );

}


/* =========================================================
   29. REPORT BUTTONS
========================================================= */

document.addEventListener(
  "click",
  event => {

    const printButton =
      event.target.closest(
        "#printReportButton"
      );


    if (printButton) {

      printReport();

      return;
    }


    const downloadButton =
      event.target.closest(
        "#downloadReportButton"
      );


    if (downloadButton) {

      downloadReportHtml();

      return;
    }


    const typeButton =
      event.target.closest(
        "[data-report-select]"
      );


    if (typeButton) {

      const type =
        typeButton.dataset
          .reportSelect;


      openReport(
        type
      );

      return;
    }

  }
);


/* =========================================================
   30. REPORT TYPE NAME
========================================================= */

function getReportTypeName(
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


  return names[type] ||
    "바이애슬론";

}


/* =========================================================
   31. CAMERA NAME
========================================================= */

function getReportCameraName(
  camera
) {

  const names = {

    side:
      "측면",

    front:
      "정면",

    rear:
      "후면"

  };


  return names[camera] ||
    "측면";

}


/* =========================================================
   32. SHOOTING MODE
========================================================= */

function getReportShootingMode(
  mode
) {

  const names = {

    prone:
      "엎드려쏴",

    standing:
      "서서쏴"

  };


  return names[mode] ||
    mode ||
    "-";

}


/* =========================================================
   33. REPORT TIME
========================================================= */

function formatReportTime(
  seconds
) {

  if (
    !Number.isFinite(
      Number(seconds)
    )
  ) {

    return "-";

  }


  const value =
    Number(seconds);


  const minute =
    Math.floor(
      value / 60
    );


  const second =
    value % 60;


  return (
    String(minute)
      .padStart(2, "0") +
    ":" +
    second
      .toFixed(2)
      .padStart(5, "0")
  );

}


/* =========================================================
   34. REPORT DATE
========================================================= */

function formatReportDate(
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


  return (
    date.getFullYear() +
    "-" +
    String(
      date.getMonth() + 1
    ).padStart(2, "0") +
    "-" +
    String(
      date.getDate()
    ).padStart(2, "0")
  );

}


/* =========================================================
   35. AVERAGE REPORT ANGLES
========================================================= */

function averageReportAngles(
  metrics
) {

  if (!metrics) {
    return null;
  }


  const values = [

    metrics.leftKnee,

    metrics.rightKnee

  ].filter(
    Number.isFinite
  );


  if (!values.length) {
    return null;
  }


  return Math.round(
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    ) /
    values.length
  );

}


/* =========================================================
   36. CLAMP
========================================================= */

function clampReport(
  value,
  min,
  max
) {

  return Math.max(
    min,
    Math.min(
      max,
      Number(value) || 0
    )
  );

}


/* =========================================================
   37. HTML ESCAPE
========================================================= */

function escapeReportHtml(
  value
) {

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}


/* =========================================================
   38. PUBLIC API
========================================================= */

window.ReportSystem = {

  open:
    openReport,

  render:
    renderReport,

  setCurrentRecord:
    setCurrentRecord,

  getCurrentRecord:
    getCurrentRecord,

  print:
    printReport,

  download:
    downloadReportHtml

};


/* =========================================================
   39. INITIALIZE
========================================================= */

function initReportSystem() {

  const record =
    getCurrentRecord();


  if (record) {

    renderReport();

  }

}


if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initReportSystem
  );

} else {

  initReportSystem();

}