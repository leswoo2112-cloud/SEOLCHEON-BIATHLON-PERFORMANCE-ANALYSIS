/* =========================================================
   설천 BIATHLON PERFORMANCE CENTER PRO
   report.js

   기능
   ---------------------------------------------------------
   - 스키 리포트
   - 롤러스키 리포트
   - 사격 자세 리포트
   - 점수
   - 핵심 지표
   - 관절각 변화 그래프
   - 중심 궤적
   - 자동 분석 코멘트
   - 인쇄 / PDF 저장
========================================================= */


const Report = {

  charts: {},


  /* =======================================================
     01. REPORT RENDER
  ======================================================= */

  render(id = null) {

    const container =
      document.getElementById(
        "reportContainer"
      );


    const selector =
      document.getElementById(
        "reportSelect"
      );


    if (!container) {
      return;
    }


    /*
     * 선택된 기록
     */

    const record =
      Store.get(id) ||
      Store.records[0] ||
      null;


    if (!record) {

      container.innerHTML = `

        <div class="report-empty">

          <h3>
            분석 기록이 없습니다.
          </h3>

          <p>
            스키, 롤러스키 또는 사격 자세분석을
            먼저 실행해주세요.
          </p>

        </div>

      `;


      if (selector) {

        selector.innerHTML =
          "";

      }


      return;

    }


    Store.current =
      record.id;


    /*
     * 리포트 선택 메뉴
     */

    this.updateSelector(
      selector,
      record.id
    );


    /*
     * 리포트 종류
     */

    const type =
      record.typeName ||
      this.typeName(
        record.type
      );


    /*
     * 지표
     */

    const metrics =
      record.metrics ||
      {};


    /*
     * 날짜
     */

    const created =
      record.createdAt
        ? new Date(
            record.createdAt
          ).toLocaleString(
            "ko-KR"
          )
        : "-";


    /*
     * 리포트 내용
     */

    container.innerHTML = `

      <article
        class="report-document"
      >


        <!-- =========================================
             HEADER
        ========================================== -->

        <div
          class="report-header"
        >

          <div>

            <span class="eyebrow">
              SEOLCHEON BIATHLON
            </span>

            <h2>
              ${type}
              자세분석 리포트
            </h2>

            <small>
              ${created}
            </small>

          </div>


          <div
            class="report-score"
          >
            ${this.number(
              record.score
            )}
          </div>

        </div>



        <!-- =========================================
             ATHLETE
        ========================================== -->

        <div
          class="report-section"
        >

          <h3>
            선수 정보
          </h3>


          <div
            class="report-grid"
          >

            <div
              class="report-card"
            >

              <small>
                선수
              </small>

              <strong>
                ${
                  record.athleteName ||
                  "-"
                }
              </strong>

            </div>


            <div
              class="report-card"
            >

              <small>
                분석 종목
              </small>

              <strong>
                ${type}
              </strong>

            </div>


            <div
              class="report-card"
            >

              <small>
                분석 영상
              </small>

              <strong>
                ${
                  record.videoName ||
                  "-"
                }
              </strong>

            </div>


            <div
              class="report-card"
            >

              <small>
                영상 길이
              </small>

              <strong>
                ${this.duration(
                  record.duration
                )}
              </strong>

            </div>

          </div>

        </div>



        <!-- =========================================
             CORE METRICS
        ========================================== -->

        <div
          class="report-section"
        >

          <h3>
            핵심 분석 지표
          </h3>


          <div
            class="report-grid"
          >

            <div
              class="report-card"
            >

              <small>
                좌우 대칭성
              </small>

              <strong>
                ${this.number(
                  metrics.symmetry
                )}
              </strong>

            </div>


            <div
              class="report-card"
            >

              <small>
                중심 안정성
              </small>

              <strong>
                ${this.number(
                  metrics.stability
                )}
              </strong>

            </div>


            <div
              class="report-card"
            >

              <small>
                동작 일관성
              </small>

              <strong>
                ${this.number(
                  metrics.consistency
                )}
              </strong>

            </div>


            <div
              class="report-card"
            >

              <small>
                평균 무릎각
              </small>

              <strong>
                ${
                  Number.isFinite(
                    Number(
                      metrics.kneeMean
                    )
                  )
                    ? Math.round(
                        metrics.kneeMean
                      ) + "°"
                    : "-"
                }
              </strong>

            </div>

          </div>

        </div>



        <!-- =========================================
             ANGLE GRAPH
        ========================================== -->

        <div
          class="report-section"
        >

          <h3>
            관절각 변화
          </h3>


          <div
            class="chart-box large"
          >

            <canvas
              id="reportAngle"
            ></canvas>

          </div>

        </div>



        <!-- =========================================
             CENTER TRAJECTORY
        ========================================== -->

        <div
          class="report-section"
        >

          <h3>
            신체중심 궤적
          </h3>


          <div
            class="chart-box large"
          >

            <canvas
              id="reportTrajectory"
            ></canvas>

          </div>

        </div>



        <!-- =========================================
             ANGLE TABLE
        ========================================== -->

        <div
          class="report-section"
        >

          <h3>
            주요 관절각
          </h3>


          <div
            class="report-grid"
          >

            ${this.angleCard(
              "좌측 무릎",
              metrics.leftKnee
            )}

            ${this.angleCard(
              "우측 무릎",
              metrics.rightKnee
            )}

            ${this.angleCard(
              "좌측 고관절",
              metrics.leftHip
            )}

            ${this.angleCard(
              "우측 고관절",
              metrics.rightHip
            )}

          </div>

        </div>



        <!-- =========================================
             COACH FEEDBACK
        ========================================== -->

        <div
          class="report-section"
        >

          <h3>
            분석 코멘트
          </h3>


          <div
            class="feedback"
          >

            <b>
              ${
                record.feedback?.summary ||
                `${type} 자세 분석 결과입니다.`
              }
            </b>


            <p>
              ${
                record.feedback?.coach ||
                "분석 데이터가 기록되었습니다."
              }
            </p>


            ${
              this.feedbackList(
                "강점",
                record.feedback?.strengths
              )
            }


            ${
              this.feedbackList(
                "개선 포인트",
                record.feedback?.improvements
              )
            }

          </div>

        </div>



        <!-- =========================================
             FOOTER
        ========================================== -->

        <div
          class="report-footer"
        >

          <span>
            설천 Biathlon Performance Center
          </span>

          <span>
            자세분석 PRO
          </span>

        </div>


      </article>

    `;


    /*
     * 그래프
     */

    requestAnimationFrame(
      () => {

        this.drawAngleChart(
          record
        );


        this.drawTrajectory(
          record
        );

      }
    );

  },


  /* =======================================================
     02. SELECTOR
  ======================================================= */

  updateSelector(
    selector,
    selectedId
  ) {

    if (!selector) {
      return;
    }


    selector.innerHTML =
      Store.records
        .map(
          record => {

            const date =
              record.createdAt
                ? new Date(
                    record.createdAt
                  ).toLocaleString(
                    "ko-KR"
                  )
                : "-";


            return `

              <option
                value="${record.id}"
                ${
                  record.id ===
                  selectedId
                    ? "selected"
                    : ""
                }
              >

                ${record.typeName}
                ·
                ${date}
                ·
                ${this.number(
                  record.score
                )}점

              </option>

            `;

          }
        )
        .join("");

  },


  /* =======================================================
     03. TYPE NAME
  ======================================================= */

  typeName(
    type
  ) {

    return {

      ski:
        "스키",

      roller:
        "롤러스키",

      shooting:
        "사격"

    }[type] || "자세분석";

  },


  /* =======================================================
     04. NUMBER FORMAT
  ======================================================= */

  number(
    value
  ) {

    if (
      value === null ||
      value === undefined ||
      value === "" ||
      !Number.isFinite(
        Number(value)
      )
    ) {

      return "-";

    }


    return Math.round(
      Number(value)
    );

  },


  /* =======================================================
     05. DURATION
  ======================================================= */

  duration(
    seconds
  ) {

    if (
      !Number.isFinite(
        Number(seconds)
      )
    ) {

      return "-";

    }


    const total =
      Math.max(
        0,
        Math.floor(
          Number(seconds)
        )
      );


    const minutes =
      Math.floor(
        total / 60
      );


    const remain =
      total % 60;


    return `${String(
      minutes
    ).padStart(2, "0")}:${String(
      remain
    ).padStart(2, "0")}`;

  },


  /* =======================================================
     06. ANGLE CARD
  ======================================================= */

  angleCard(
    title,
    value
  ) {

    const valid =
      Number.isFinite(
        Number(value)
      );


    return `

      <div
        class="report-card"
      >

        <small>
          ${title}
        </small>

        <strong>
          ${
            valid
              ? Math.round(
                  Number(value)
                ) + "°"
              : "-"
          }
        </strong>

      </div>

    `;

  },


  /* =======================================================
     07. FEEDBACK LIST
  ======================================================= */

  feedbackList(
    title,
    list
  ) {

    if (
      !Array.isArray(list) ||
      !list.length
    ) {

      return "";

    }


    return `

      <p>

        <b>
          ${title}:
        </b>

        ${list.join(" ")}

      </p>

    `;

  },


  /* =======================================================
     08. ANGLE CHART
  ======================================================= */

  drawAngleChart(
    record
  ) {

    if (
      typeof Chart ===
      "undefined"
    ) {

      return;

    }


    const canvas =
      document.getElementById(
        "reportAngle"
      );


    if (!canvas) {
      return;
    }


    /*
     * 기존 차트 제거
     */

    if (
      this.charts.angle
    ) {

      this.charts.angle.destroy();

    }


    const history =
      Array.isArray(
        record.angleHistory
      )
        ? record.angleHistory
        : [];


    /*
     * 데이터가 없는 경우
     */

    if (!history.length) {

      return;

    }


    const labels =
      history.map(
        item =>
          Number(
            item.time || 0
          ).toFixed(1)
      );


    const leftKnee =
      history.map(
        item =>
          Number.isFinite(
            Number(
              item.leftKnee
            )
          )
            ? Number(
                item.leftKnee
              )
            : null
      );


    const rightKnee =
      history.map(
        item =>
          Number.isFinite(
            Number(
              item.rightKnee
            )
          )
            ? Number(
                item.rightKnee
              )
            : null
      );


    const leftHip =
      history.map(
        item =>
          Number.isFinite(
            Number(
              item.leftHip
            )
          )
            ? Number(
                item.leftHip
              )
            : null
      );


    const rightHip =
      history.map(
        item =>
          Number.isFinite(
            Number(
              item.rightHip
            )
          )
            ? Number(
                item.rightHip
              )
            : null
      );


    this.charts.angle =
      new Chart(
        canvas,
        {

          type:
            "line",


          data: {

            labels,


            datasets: [

              {

                label:
                  "좌측 무릎",

                data:
                  leftKnee,

                pointRadius:
                  0,

                borderWidth:
                  2,

                tension:
                  0.25

              },


              {

                label:
                  "우측 무릎",

                data:
                  rightKnee,

                pointRadius:
                  0,

                borderWidth:
                  2,

                tension:
                  0.25

              },


              {

                label:
                  "좌측 고관절",

                data:
                  leftHip,

                pointRadius:
                  0,

                borderWidth:
                  1.5,

                tension:
                  0.25

              },


              {

                label:
                  "우측 고관절",

                data:
                  rightHip,

                pointRadius:
                  0,

                borderWidth:
                  1.5,

                tension:
                  0.25

              }

            ]

          },


          options: {

            responsive:
              true,

            maintainAspectRatio:
              false,

            animation:
              false,

            interaction: {

              intersect:
                false,

              mode:
                "index"

            },


            plugins: {

              legend: {

                position:
                  "top"

              },

              tooltip: {

                callbacks: {

                  label:
                    context => {

                      const value =
                        context.parsed.y;


                      return `${
                        context.dataset.label
                      }: ${
                        Number.isFinite(
                          value
                        )
                          ? Math.round(
                              value
                            ) + "°"
                          : "-"
                      }`;

                    }

                }

              }

            },


            scales: {

              x: {

                title: {

                  display:
                    true,

                  text:
                    "시간 (초)"

                }

              },


              y: {

                min:
                  0,

                max:
                  180,

                title: {

                  display:
                    true,

                  text:
                    "각도 (°)"

                }

              }

            }

          }

        }
      );

  },


  /* =======================================================
     09. TRAJECTORY GRAPH
  ======================================================= */

  drawTrajectory(
    record
  ) {

    const canvas =
      document.getElementById(
        "reportTrajectory"
      );


    if (!canvas) {
      return;
    }


    const rect =
      canvas.getBoundingClientRect();


    const dpr =
      window.devicePixelRatio ||
      1;


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


    canvas.width =
      width *
      dpr;


    canvas.height =
      height *
      dpr;


    const ctx =
      canvas.getContext(
        "2d"
      );


    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
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

      ctx.fillStyle =
        "#819099";

      ctx.font =
        `${13 * dpr}px sans-serif`;

      ctx.textAlign =
        "center";

      ctx.fillText(
        "중심 궤적 데이터가 없습니다.",
        canvas.width / 2,
        canvas.height / 2
      );


      return;

    }


    /*
     * 배경 격자
     */

    ctx.strokeStyle =
      "rgba(23,60,80,.07)";


    ctx.lineWidth =
      1 * dpr;


    const grid =
      10;


    for (
      let i = 0;
      i <= grid;
      i++
    ) {

      const x =
        canvas.width *
        i /
        grid;


      const y =
        canvas.height *
        i /
        grid;


      ctx.beginPath();

      ctx.moveTo(
        x,
        0
      );

      ctx.lineTo(
        x,
        canvas.height
      );

      ctx.stroke();


      ctx.beginPath();

      ctx.moveTo(
        0,
        y
      );

      ctx.lineTo(
        canvas.width,
        y
      );

      ctx.stroke();

    }


    /*
     * 중심 궤적
     */

    ctx.beginPath();


    trajectory.forEach(
      (point, index) => {

        const x =
          Number(point.x) *
          canvas.width;


        const y =
          Number(point.y) *
          canvas.height;


        if (
          index === 0
        ) {

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
      "#315f76";


    ctx.lineWidth =
      2.5 * dpr;


    ctx.lineJoin =
      "round";


    ctx.lineCap =
      "round";


    ctx.stroke();


    /*
     * 시작점
     */

    const first =
      trajectory[0];


    ctx.beginPath();

    ctx.arc(
      first.x *
        canvas.width,
      first.y *
        canvas.height,
      5 * dpr,
      0,
      Math.PI * 2
    );


    ctx.fillStyle =
      "#315f76";


    ctx.fill();


    /*
     * 마지막점
     */

    const last =
      trajectory[
        trajectory.length - 1
      ];


    ctx.beginPath();

    ctx.arc(
      last.x *
        canvas.width,
      last.y *
        canvas.height,
      6 * dpr,
      0,
      Math.PI * 2
    );


    ctx.fillStyle =
      "#173c50";


    ctx.fill();


  },


  /* =======================================================
     10. CHANGE REPORT
  ======================================================= */

  change(
    id
  ) {

    this.render(
      id
    );

    UI.go(
      "report"
    );

  },


  /* =======================================================
     11. INIT
  ======================================================= */

  init() {

    /*
     * 리포트 선택
     */

    const selector =
      document.getElementById(
        "reportSelect"
      );


    selector?.addEventListener(
      "change",
      event => {

        this.render(
          event.target.value
        );

      }
    );


    /*
     * 인쇄 / PDF
     */

    document
      .getElementById(
        "printReport"
      )
      ?.addEventListener(
        "click",
        () => {

          if (
            !Store.records.length
          ) {

            UI.toast(
              "먼저 분석 기록을 만들어주세요."
            );

            return;

          }


          window.print();

        }
      );


    /*
     * 초기 리포트
     */

    this.render(
      Store.records[0]?.id ||
      null
    );

  }

};


/* =========================================================
   INIT
========================================================= */

Report.init();


/* =========================================================
   PUBLIC API
========================================================= */

window.Report =
  Report;