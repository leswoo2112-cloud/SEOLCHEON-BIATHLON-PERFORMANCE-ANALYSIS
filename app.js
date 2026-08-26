/* =========================================================
   설천 BIATHLON PERFORMANCE CENTER PRO
   app.js

   포함:
   - MediaPipe Pose
   - 사람 추적 보정
   - 스켈레톤 표시
   - 스키 분석
   - 롤러스키 분석
   - 사격 자세분석
   - 관절각 계산
   - 중심 궤적
   - 실시간 그래프
   - 점수 계산
   - 분석 기록 저장
   - 비교분석 데이터 생성

   주의:
   사격에서 총기/총구/격발 시점을 자동 판정하지 않음.
========================================================= */


/* =========================================================
   APP
========================================================= */

const App = {

  sessions: {},

  charts: {},


  /* =======================================================
     01. POSE ENGINE
  ======================================================= */

  poseFactory(handler) {

    if (
      typeof Pose === "undefined"
    ) {

      console.error(
        "MediaPipe Pose가 로드되지 않았습니다."
      );

      return null;

    }


    const pose =
      new Pose({

        locateFile: file =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`

      });


    pose.setOptions({

      /*
       * 정확도 우선
       */

      modelComplexity: 2,

      /*
       * 프레임 간 관절 흔들림 감소
       */

      smoothLandmarks: true,

      /*
       * 필요하지 않은 segmentation 제거
       */

      enableSegmentation: false,

      smoothSegmentation: false,

      /*
       * 사람 검출 기준
       */

      minDetectionConfidence: 0.65,

      /*
       * 추적 유지 기준
       */

      minTrackingConfidence: 0.70

    });


    pose.onResults(
      handler
    );


    return pose;

  },


  /* =======================================================
     02. SESSION 생성
  ======================================================= */

  create(
    type,
    ids
  ) {

    const video =
      document.getElementById(
        ids.video
      );


    const canvas =
      document.getElementById(
        ids.canvas
      );


    if (
      !video ||
      !canvas
    ) {

      console.warn(
        `${type} 요소를 찾지 못했습니다.`
      );

      return;

    }


    const ctx =
      canvas.getContext(
        "2d"
      );


    const session = {

      type,

      video,

      canvas,

      ctx,

      pose: null,

      running: false,

      processing: false,

      duration: 0,

      file: "",

      frameCount: 0,

      /*
       * 중심 궤적
       */

      trajectory: [],

      /*
       * 관절각 기록
       */

      angles: [],

      /*
       * 마지막 정상 인식
       */

      lastGood: null,

      /*
       * 마지막 선수 중심
       */

      lastCenter: null,

      /*
       * 잘못된 인식 연속 횟수
       */

      loss: 0,

      /*
       * 마지막 정상 프레임 시간
       */

      lastGoodTime: 0,

      /*
       * 영상 FPS 추정
       */

      fps: 30

    };


    session.pose =
      this.poseFactory(
        result =>
          this.results(
            session,
            result
          )
      );


    this.sessions[type] =
      session;


    /*
     * 영상 선택
     */

    const input =
      document.getElementById(
        ids.input
      );


    const upload =
      document.getElementById(
        ids.upload
      );


    upload?.addEventListener(
      "click",
      () => {

        input?.click();

      }
    );


    input?.addEventListener(
      "change",
      () => {

        const file =
          input.files?.[0];


        if (!file) {
          return;
        }


        if (
          !file.type.startsWith(
            "video/"
          )
        ) {

          UI.toast(
            "영상 파일을 선택해주세요."
          );

          return;

        }


        session.file =
          file.name;


        const oldUrl =
          video.dataset.objectUrl;


        if (oldUrl) {

          URL.revokeObjectURL(
            oldUrl
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


        video.addEventListener(
          "loadedmetadata",
          () => {

            session.duration =
              video.duration || 0;


            this.resize(
              session
            );


            const empty =
              document.getElementById(
                `${type}Empty`
              );


            if (empty) {

              empty.style.display =
                "none";

            }


            /*
             * 새 영상이면
             * 이전 분석 데이터를 초기화
             */

            session.trajectory =
              [];

            session.angles =
              [];

            session.lastGood =
              null;

            session.lastCenter =
              null;

            session.loss =
              0;

            session.frameCount =
              0;


            this.clearCanvas(
              session
            );


            UI.toast(
              "영상이 준비되었습니다."
            );

          },
          {
            once: true
          }
        );

      }
    );


    /*
     * 재생 / 일시정지
     */

    document
      .getElementById(ids.play)
      ?.addEventListener(
        "click",
        () => {

          if (!video.src) {

            UI.toast(
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
      );


    /*
     * 이전 프레임
     */

    document
      .getElementById(ids.prev)
      ?.addEventListener(
        "click",
        () => {

          this.step(
            session,
            -1
          );

        }
      );


    /*
     * 다음 프레임
     */

    document
      .getElementById(ids.next)
      ?.addEventListener(
        "click",
        () => {

          this.step(
            session,
            1
          );

        }
      );


    /*
     * 슬로모션
     */

    document
      .getElementById(ids.slow)
      ?.addEventListener(
        "click",
        () => {

          video.playbackRate =
            type === "shooting"
              ? 0.25
              : 0.5;

          UI.toast(
            `재생속도 ${
              video.playbackRate
            }×`
          );

        }
      );


    /*
     * 일반속도
     */

    document
      .getElementById(ids.normal)
      ?.addEventListener(
        "click",
        () => {

          video.playbackRate =
            1;

        }
      );


    /*
     * 분석 시작
     */

    document
      .getElementById(ids.start)
      ?.addEventListener(
        "click",
        () => {

          this.start(
            session
          );

        }
      );


    /*
     * 분석 종료
     */

    document
      .getElementById(ids.stop)
      ?.addEventListener(
        "click",
        () => {

          this.stop(
            session
          );

        }
      );


    /*
     * Seek bar
     */

    const seek =
      document.getElementById(
        ids.seek
      );


    video.addEventListener(
      "timeupdate",
      () => {

        if (
          seek &&
          session.duration > 0
        ) {

          seek.value =
            (
              video.currentTime /
              session.duration
            ) * 100;

        }

      }
    );


    seek?.addEventListener(
      "input",
      event => {

        if (
          session.duration <= 0
        ) {

          return;

        }


        video.currentTime =
          Number(
            event.target.value
          ) /
          100 *
          session.duration;

      }
    );


    /*
     * 영상이 끝났을 때
     */

    video.addEventListener(
      "ended",
      () => {

        session.running =
          false;

      }
    );

  },


  /* =======================================================
     03. CANVAS SIZE
  ======================================================= */

  resize(session) {

    if (
      !session ||
      !session.video ||
      !session.canvas
    ) {

      return;

    }


    const video =
      session.video;


    if (
      !video.videoWidth ||
      !video.videoHeight
    ) {

      return;

    }


    if (
      session.canvas.width !==
      video.videoWidth
    ) {

      session.canvas.width =
        video.videoWidth;

    }


    if (
      session.canvas.height !==
      video.videoHeight
    ) {

      session.canvas.height =
        video.videoHeight;

    }

  },


  /* =======================================================
     04. CLEAR CANVAS
  ======================================================= */

  clearCanvas(session) {

    if (!session?.ctx) {
      return;
    }


    session.ctx.clearRect(
      0,
      0,
      session.canvas.width,
      session.canvas.height
    );

  },


  /* =======================================================
     05. START
  ======================================================= */

  start(session) {

    if (
      !session.video.src
    ) {

      UI.toast(
        "먼저 영상을 선택하세요."
      );

      return;

    }


    if (!session.pose) {

      UI.toast(
        "자세분석 엔진을 불러오는 중입니다."
      );

      return;

    }


    session.running =
      true;


    session.video
      .play()
      .catch(
        () => {}
      );


    this.loop(
      session
    );


    UI.toast(
      `${this.typeName(session.type)} 자세분석 시작`
    );

  },


  /* =======================================================
     06. ANALYSIS LOOP
  ======================================================= */

  async loop(session) {

    if (
      !session.running
    ) {

      return;

    }


    if (
      !session.processing &&
      session.video.readyState >= 2 &&
      !session.video.ended
    ) {

      session.processing =
        true;


      try {

        await session.pose.send({

          image:
            session.video

        });

      } catch (error) {

        console.warn(
          "Pose 분석 오류:",
          error
        );

      }


      session.processing =
        false;

    }


    requestAnimationFrame(
      () =>
        this.loop(
          session
        )
    );

  },


  /* =======================================================
     07. MEDIAPIPE RESULTS
  ======================================================= */

  results(
    session,
    result
  ) {

    if (
      !result ||
      !result.poseLandmarks
    ) {

      return;

    }


    const landmarks =
      result.poseLandmarks;


    /*
     * 사람 인식 품질 확인
     */

    if (
      !this.usable(
        landmarks
      )
    ) {

      session.loss++;


      /*
       * 짧은 인식 끊김에서는
       * 마지막 정상 자세 유지
       */

      if (
        session.lastGood &&
        session.loss < 8
      ) {

        this.draw(
          session,
          session.lastGood,
          session.lastCenter
        );

      }


      return;

    }


    const center =
      this.center(
        landmarks
      );


    if (!center) {
      return;
    }


    /*
     * 갑작스러운 위치 이동 제거
     *
     * MediaPipe가 다른 위치를
     * 잘못 잡는 경우를 방지
     */

    if (
      session.lastCenter
    ) {

      const movement =
        this.dist(
          center,
          session.lastCenter
        );


      /*
       * 화면 대비 지나치게 큰 이동
       */

      if (
        movement > 0.16
      ) {

        session.loss++;


        /*
         * 일시적 오인식은 무시
         */

        if (
          session.loss < 4
        ) {

          if (
            session.lastGood
          ) {

            this.draw(
              session,
              session.lastGood,
              session.lastCenter
            );

          }


          return;

        }

      }

    }


    /*
     * 정상 인식
     */

    session.loss =
      0;


    session.lastCenter =
      center;


    session.lastGood =
      landmarks.map(
        point => ({
          x: point.x,
          y: point.y,
          z: point.z,
          visibility:
            point.visibility
        })
      );


    session.lastGoodTime =
      session.video.currentTime;


    session.frameCount++;


    /*
     * 관절각
     */

    const angles =
      this.angles(
        landmarks
      );


    /*
     * 시간
     */

    const time =
      session.video.currentTime;


    /*
     * 중심 궤적 저장
     */

    session.trajectory.push({

      x: center.x,

      y: center.y,

      t: time

    });


    /*
     * 최대 데이터 개수 제한
     */

    if (
      session.trajectory.length >
      600
    ) {

      session.trajectory.shift();

    }


    /*
     * 관절각 저장
     */

    session.angles.push({

      time,

      ...angles

    });


    if (
      session.angles.length >
      600
    ) {

      session.angles.shift();

    }


    /*
     * 화면 표시
     */

    this.draw(
      session,
      landmarks,
      center
    );


    /*
     * 실시간 수치

     */

    this.metricsUI(
      session,
      angles
    );


    /*
     * 그래프

     */

    this.chart(
      session
    );

  },


  /* =======================================================
     08. USABLE POSE
  ======================================================= */

  usable(landmarks) {

    /*
     * 주요 관절
     */

    const important = [

      11, // left shoulder
      12, // right shoulder

      23, // left hip
      24, // right hip

      25, // left knee
      26, // right knee

      27, // left ankle
      28  // right ankle

    ];


    let visible =
      0;


    important.forEach(
      index => {

        const point =
          landmarks[index];


        if (!point) {
          return;
        }


        const visibility =
          point.visibility ===
          undefined
            ? 1
            : point.visibility;


        if (
          visibility >= 0.45
        ) {

          visible++;

        }

      }
    );


    return visible >= 6;

  },


  /* =======================================================
     09. CENTER
  ======================================================= */

  center(landmarks) {

    const indexes = [

      11,
      12,
      23,
      24

    ];


    const points =
      indexes
        .map(
          index =>
            landmarks[index]
        )
        .filter(Boolean);


    if (
      points.length < 2
    ) {

      return null;

    }


    let x =
      0;

    let y =
      0;


    points.forEach(
      point => {

        x += point.x;

        y += point.y;

      }
    );


    return {

      x:
        x /
        points.length,

      y:
        y /
        points.length

    };

  },


  /* =======================================================
     10. DISTANCE
  ======================================================= */

  dist(a, b) {

    if (
      !a ||
      !b
    ) {

      return Infinity;

    }


    return Math.hypot(
      a.x - b.x,
      a.y - b.y
    );

  },


  /* =======================================================
     11. ANGLE
  ======================================================= */

  angle(
    a,
    b,
    c
  ) {

    if (
      !a ||
      !b ||
      !c
    ) {

      return null;

    }


    const ab = {

      x:
        a.x - b.x,

      y:
        a.y - b.y

    };


    const cb = {

      x:
        c.x - b.x,

      y:
        c.y - b.y

    };


    const dot =
      ab.x * cb.x +
      ab.y * cb.y;


    const magnitude =
      Math.hypot(
        ab.x,
        ab.y
      ) *
      Math.hypot(
        cb.x,
        cb.y
      );


    if (
      magnitude === 0
    ) {

      return null;

    }


    const cosine =
      Math.max(
        -1,
        Math.min(
          1,
          dot / magnitude
        )
      );


    return (
      Math.acos(
        cosine
      ) *
      180 /
      Math.PI
    );

  },


  /* =======================================================
     12. JOINT ANGLES
  ======================================================= */

  angles(landmarks) {

    return {

      leftKnee:
        this.angle(
          landmarks[23],
          landmarks[25],
          landmarks[27]
        ),

      rightKnee:
        this.angle(
          landmarks[24],
          landmarks[26],
          landmarks[28]
        ),

      leftHip:
        this.angle(
          landmarks[11],
          landmarks[23],
          landmarks[25]
        ),

      rightHip:
        this.angle(
          landmarks[12],
          landmarks[24],
          landmarks[26]
        ),

      leftElbow:
        this.angle(
          landmarks[11],
          landmarks[13],
          landmarks[15]
        ),

      rightElbow:
        this.angle(
          landmarks[12],
          landmarks[14],
          landmarks[16]
        )

    };

  },


  /* =======================================================
     13. DRAW SKELETON
  ======================================================= */

  draw(
    session,
    landmarks,
    center
  ) {

    if (
      !session ||
      !landmarks
    ) {

      return;

    }


    this.resize(
      session
    );


    const ctx =
      session.ctx;


    const width =
      session.canvas.width;


    const height =
      session.canvas.height;


    ctx.clearRect(
      0,
      0,
      width,
      height
    );


    /*
     * 중심 궤적
     */

    if (
      session.trajectory.length > 1
    ) {

      ctx.beginPath();


      session.trajectory.forEach(
        (point, index) => {

          const x =
            point.x *
            width;


          const y =
            point.y *
            height;


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
        "rgba(120,190,210,.75)";


      ctx.lineWidth =
        3;


      ctx.stroke();

    }


    /*
     * MediaPipe Pose 연결
     */

    const connections = [

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
      [26, 28]

    ];


    /*
     * 뼈대
     */

    ctx.strokeStyle =
      "#ffffff";

    ctx.lineWidth =
      Math.max(
        2,
        width / 500
      );


    connections.forEach(
      ([a, b]) => {

        const p1 =
          landmarks[a];

        const p2 =
          landmarks[b];


        if (
          !p1 ||
          !p2
        ) {

          return;

        }


        const v1 =
          p1.visibility ===
          undefined
            ? 1
            : p1.visibility;


        const v2 =
          p2.visibility ===
          undefined
            ? 1
            : p2.visibility;


        if (
          v1 < 0.4 ||
          v2 < 0.4
        ) {

          return;

        }


        ctx.beginPath();


        ctx.moveTo(
          p1.x * width,
          p1.y * height
        );


        ctx.lineTo(
          p2.x * width,
          p2.y * height
        );


        ctx.stroke();

      }
    );


    /*
     * 관절
     */

    landmarks.forEach(
      point => {

        if (!point) {
          return;
        }


        const visibility =
          point.visibility ===
          undefined
            ? 1
            : point.visibility;


        if (
          visibility < 0.4
        ) {

          return;

        }


        ctx.beginPath();


        ctx.arc(
          point.x * width,
          point.y * height,
          Math.max(
            3,
            width / 300
          ),
          0,
          Math.PI * 2
        );


        ctx.fillStyle =
          "#ffffff";


        ctx.fill();

      }
    );


    /*
     * 선수 중심
     */

    if (center) {

      ctx.beginPath();


      ctx.arc(
        center.x * width,
        center.y * height,
        Math.max(
          6,
          width / 180
        ),
        0,
        Math.PI * 2
      );


      ctx.fillStyle =
        "#9bc6d6";


      ctx.fill();

    }

  },


  /* =======================================================
     14. METRICS
  ======================================================= */

  metrics(session) {

    const history =
      session.angles || [];


    const last =
      history[
        history.length - 1
      ] || {};


    const kneeValues =
      history
        .flatMap(
          item => [
            item.leftKnee,
            item.rightKnee
          ]
        )
        .filter(
          Number.isFinite
        );


    const kneeMean =
      kneeValues.length
        ? kneeValues.reduce(
            (sum, value) =>
              sum + value,
            0
          ) /
          kneeValues.length
        : 0;


    /*
     * 좌우 대칭
     */

    let symmetry =
      70;


    if (
      Number.isFinite(
        last.leftKnee
      ) &&
      Number.isFinite(
        last.rightKnee
      )
    ) {

      const difference =
        Math.abs(
          last.leftKnee -
          last.rightKnee
        );


      symmetry =
        Math.max(
          0,
          Math.min(
            100,
            100 -
              difference *
              2
          )
        );

    }


    const stability =
      this.stability(
        session.trajectory
      );


    const consistency =
      this.consistency(
        kneeValues
      );


    return {

      symmetry:
        Math.round(
          symmetry
        ),

      stability:
        Math.round(
          stability
        ),

      consistency:
        Math.round(
          consistency
        ),

      leftKnee:
        last.leftKnee,

      rightKnee:
        last.rightKnee,

      leftHip:
        last.leftHip,

      rightHip:
        last.rightHip,

      leftElbow:
        last.leftElbow,

      rightElbow:
        last.rightElbow,

      kneeMean

    };

  },


  /* =======================================================
     15. STABILITY
  ======================================================= */

  stability(
    trajectory
  ) {

    if (
      !trajectory ||
      trajectory.length < 5
    ) {

      return 70;

    }


    const points =
      trajectory.slice(
        -120
      );


    let meanX =
      0;

    let meanY =
      0;


    points.forEach(
      point => {

        meanX += point.x;

        meanY += point.y;

      }
    );


    meanX /=
      points.length;


    meanY /=
      points.length;


    let variance =
      0;


    points.forEach(
      point => {

        variance +=
          (
            point.x -
            meanX
          ) ** 2 +
          (
            point.y -
            meanY
          ) ** 2;

      }
    );


    variance /=
      points.length;


    const deviation =
      Math.sqrt(
        variance
      );


    return Math.max(
      0,
      Math.min(
        100,
        100 -
          deviation *
          220
      )
    );

  },


  /* =======================================================
     16. CONSISTENCY
  ======================================================= */

  consistency(
    values
  ) {

    if (
      !values ||
      values.length < 5
    ) {

      return 70;

    }


    const mean =
      values.reduce(
        (a, b) =>
          a + b,
        0
      ) /
      values.length;


    const variance =
      values.reduce(
        (sum, value) =>
          sum +
          (
            value -
            mean
          ) ** 2,
        0
      ) /
      values.length;


    const sd =
      Math.sqrt(
        variance
      );


    return Math.max(
      0,
      Math.min(
        100,
        100 -
          sd *
          2.5
      )
    );

  },


  /* =======================================================
     17. SCORE
  ======================================================= */

  score(
    session
  ) {

    const metrics =
      this.metrics(
        session
      );


    return Math.round(

      (
        metrics.symmetry +
        metrics.stability +
        metrics.consistency
      ) / 3

    );

  },


  /* =======================================================
     18. REALTIME METRICS UI
  ======================================================= */

  metricsUI(
    session,
    angles
  ) {

    const element =
      document.getElementById(
        `${session.type}Metrics`
      );


    if (!element) {
      return;
    }


    const metrics =
      this.metrics(
        session
      );


    const value =
      number =>
        Number.isFinite(number)
          ? `${Math.round(number)}°`
          : "-";


    element.innerHTML = `

      <div class="metric">

        <small>
          대칭성
        </small>

        <strong>
          ${metrics.symmetry}
        </strong>

      </div>


      <div class="metric">

        <small>
          중심 안정성
        </small>

        <strong>
          ${metrics.stability}
        </strong>

      </div>


      <div class="metric">

        <small>
          동작 일관성
        </small>

        <strong>
          ${metrics.consistency}
        </strong>

      </div>


      <div class="metric">

        <small>
          좌측 무릎
        </small>

        <strong>
          ${value(
            angles.leftKnee
          )}
        </strong>

      </div>


      <div class="metric">

        <small>
          우측 무릎
        </small>

        <strong>
          ${value(
            angles.rightKnee
          )}
        </strong>

      </div>


      <div class="metric">

        <small>
          좌측 고관절
        </small>

        <strong>
          ${value(
            angles.leftHip
          )}
        </strong>

      </div>

    `;

  },


  /* =======================================================
     19. CHART
  ======================================================= */

  chart(
    session
  ) {

    if (
      typeof Chart ===
      "undefined"
    ) {

      return;

    }


    const canvas =
      document.getElementById(
        `${session.type}Chart`
      );


    if (!canvas) {
      return;
    }


    const history =
      session.angles.slice(
        -180
      );


    if (
      this.charts[
        session.type
      ]
    ) {

      this.charts[
        session.type
      ].destroy();

    }


    this.charts[
      session.type
    ] = new Chart(
      canvas,
      {

        type:
          "line",


        data: {

          labels:
            history.map(
              item =>
                Number(
                  item.time
                ).toFixed(1)
            ),


          datasets: [

            {

              label:
                "좌측 무릎",

              data:
                history.map(
                  item =>
                    item.leftKnee
                ),

              pointRadius:
                0,

              tension:
                0.25

            },


            {

              label:
                "우측 무릎",

              data:
                history.map(
                  item =>
                    item.rightKnee
                ),

              pointRadius:
                0,

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

          scales: {

            y: {

              min:
                0,

              max:
                180

            }

          }

        }

      }
    );


    /*
     * 중심 궤적 캔버스
     */

    this.drawTrajectory(
      session
    );

  },


  /* =======================================================
     20. TRAJECTORY
  ======================================================= */

  drawTrajectory(
    session
  ) {

    const canvas =
      document.getElementById(
        `${session.type}Trajectory`
      );


    if (!canvas) {
      return;
    }


    const rect =
      canvas.getBoundingClientRect();


    const dpr =
      window.devicePixelRatio ||
      1;


    canvas.width =
      Math.max(
        1,
        rect.width * dpr
      );


    canvas.height =
      Math.max(
        1,
        rect.height * dpr
      );


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


    const points =
      session.trajectory;


    if (
      points.length < 2
    ) {

      return;

    }


    ctx.beginPath();


    points.forEach(
      (point, index) => {

        const x =
          point.x *
          canvas.width;


        const y =
          point.y *
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
      2 *
      dpr;


    ctx.stroke();


    /*
     * 시작점
     */

    const start =
      points[0];


    ctx.beginPath();

    ctx.arc(
      start.x *
        canvas.width,
      start.y *
        canvas.height,
      4 * dpr,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      "#315f76";

    ctx.fill();

  },


  /* =======================================================
     21. STEP FRAME
  ======================================================= */

  step(
    session,
    direction
  ) {

    if (
      !session.video.src
    ) {

      UI.toast(
        "먼저 영상을 선택하세요."
      );

      return;

    }


    session.video.pause();


    /*
     * 일반적인 영상의
     * 한 프레임 이동
     */

    const frame =
      1 /
      (
        session.fps ||
        30
      );


    session.video.currentTime =
      Math.max(
        0,
        Math.min(
          session.duration || Infinity,
          session.video.currentTime +
            frame *
            direction
        )
      );

  },


  /* =======================================================
     22. STOP + SAVE
  ======================================================= */

  stop(
    session
  ) {

    if (
      !session.video.src
    ) {

      UI.toast(
        "분석할 영상이 없습니다."
      );

      return;

    }


    session.running =
      false;


    session.video.pause();


    const score =
      this.score(
        session
      );


    const metrics =
      this.metrics(
        session
      );


    const record = {

      type:
        session.type,

      typeName:
        this.typeName(
          session.type
        ),

      athleteName:
        document
          .getElementById(
            "athleteNameSide"
          )
          ?.textContent ||
        "선수",


      camera:
        "side",


      videoName:
        session.file ||
        "영상",


      duration:
        session.duration ||
        0,


      score,


      metrics,


      angleHistory:
        session.angles.slice(
          -600
        ),


      trajectory:
        session.trajectory.slice(
          -600
        ),


      feedback:
        this.feedback(
          session,
          score
        )

    };


    const saved =
      Store.add(
        record
      );


    /*
     * 리포트로 이동
     */

    if (
      window.Report
    ) {

      Report.render(
        saved.id
      );

    }


    UI.go(
      "report"
    );


    UI.toast(
      "분석 결과가 저장되었습니다."
    );


    /*
     * 대시보드 갱신
     */

    this.refreshDashboard();

  },


  /* =======================================================
     23. TYPE NAME
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

    }[type] || type;

  },


  /* =======================================================
     24. FEEDBACK
  ======================================================= */

  feedback(
    session,
    score
  ) {

    const metrics =
      this.metrics(
        session
      );


    const strengths = [];


    const improvements = [];


    /*
     * 강점
     */

    if (
      metrics.symmetry >= 85
    ) {

      strengths.push(
        "좌우 대칭성이 안정적으로 나타났습니다."
      );

    }


    if (
      metrics.stability >= 85
    ) {

      strengths.push(
        "중심 이동이 비교적 안정적입니다."
      );

    }


    if (
      metrics.consistency >= 85
    ) {

      strengths.push(
        "반복 동작의 일관성이 좋습니다."
      );

    }


    /*
     * 개선
     */

    if (
      metrics.symmetry < 85
    ) {

      improvements.push(
        "좌우 관절각 차이를 줄이는 데 집중해 보세요."
      );

    }


    if (
      metrics.stability < 85
    ) {

      improvements.push(
        "동작 중 신체 중심의 불필요한 흔들림을 줄여보세요."
      );

    }


    if (
      metrics.consistency < 85
    ) {

      improvements.push(
        "반복 동작에서 동일한 움직임 패턴을 유지해 보세요."
      );

    }


    if (
      !strengths.length
    ) {

      strengths.push(
        "현재 분석 데이터가 기록되었습니다."
      );

    }


    if (
      !improvements.length
    ) {

      improvements.push(
        "현재 지표를 유지하면서 반복 훈련을 진행해 보세요."
      );

    }


    return {

      summary:
        `${this.typeName(
          session.type
        )} 자세 분석 결과입니다.`,

      coach:
        score >= 85
          ? "전체적인 자세 지표가 안정적인 편입니다."
          : score >= 70
            ? "기본적인 자세는 확인되며 일부 지표의 개선 여지가 있습니다."
            : "중심 안정성과 동작 일관성을 우선적으로 확인해 보세요.",

      strengths,

      improvements

    };

  },


  /* =======================================================
     25. RECORD LIST
  ======================================================= */

  renderRecords() {

    const element =
      document.getElementById(
        "recordsList"
      );


    if (!element) {
      return;
    }


    if (
      !Store.records.length
    ) {

      element.innerHTML = `

        <div class="empty">

          아직 분석 기록이 없습니다.

        </div>

      `;


      return;

    }


    element.innerHTML =
      Store.records
        .map(
          record => {

            const date =
              new Date(
                record.createdAt
              )
                .toLocaleString(
                  "ko-KR"
                );


            return `

              <div class="record-item">

                <div>

                  <b>
                    ${record.typeName}
                  </b>

                  <small>
                    ${
                      record.videoName ||
                      "영상"
                    }
                    ·
                    ${date}
                  </small>

                </div>


                <div>

                  <b>
                    ${
                      record.score ??
                      "-"
                    }점
                  </b>


                  <button
                    class="ghost"
                    onclick="
                      Report.render('${record.id}');
                      UI.go('report');
                    "
                  >
                    리포트
                  </button>


                  <button
                    class="ghost"
                    onclick="
                      App.deleteRecord('${record.id}');
                    "
                  >
                    삭제
                  </button>

                </div>

              </div>

            `;

          }
        )
        .join("");

  },


  /* =======================================================
     26. DELETE RECORD
  ======================================================= */

  deleteRecord(
    id
  ) {

    const record =
      Store.get(
        id
      );


    if (!record) {
      return;
    }


    const ok =
      confirm(
        `${record.typeName} 기록을 삭제할까요?`
      );


    if (!ok) {
      return;
    }


    Store.remove(
      id
    );


    this.renderRecords();

    this.refreshDashboard();

    this.refreshCompare();


    UI.toast(
      "기록을 삭제했습니다."
    );

  },


  /* =======================================================
     27. DASHBOARD
  ======================================================= */

  refreshDashboard() {

    const records =
      Store.records;


    const recordsEl =
      document.getElementById(
        "dashRecords"
      );


    const scoreEl =
      document.getElementById(
        "dashScore"
      );


    const compareEl =
      document.getElementById(
        "dashCompare"
      );


    if (recordsEl) {

      recordsEl.textContent =
        records.length;

    }


    if (scoreEl) {

      scoreEl.textContent =
        records[0]?.score ??
        "-";

    }


    if (compareEl) {

      compareEl.textContent =
        Math.max(
          0,
          records.length - 1
        );

    }


    const recent =
      document.getElementById(
        "recentRecords"
      );


    if (!recent) {
      return;
    }


    if (
      !records.length
    ) {

      recent.innerHTML = `

        <div class="empty">

          최근 분석 기록이 없습니다.

        </div>

      `;


      return;

    }


    recent.innerHTML =
      records
        .slice(
          0,
          4
        )
        .map(
          record => `

            <div class="record-item">

              <div>

                <b>
                  ${record.typeName}
                </b>

                <small>
                  ${
                    new Date(
                      record.createdAt
                    )
                      .toLocaleString(
                        "ko-KR"
                      )
                  }
                </small>

              </div>

              <b>
                ${record.score ?? "-"}점
              </b>

            </div>

          `
        )
        .join("");

  },


  /* =======================================================
     28. COMPARISON SELECT
  ======================================================= */

  refreshCompare() {

    const selectA =
      document.getElementById(
        "compareA"
      );


    const selectB =
      document.getElementById(
        "compareB"
      );


    if (
      !selectA ||
      !selectB
    ) {

      return;

    }


    const records =
      Store.records;


    if (
      !records.length
    ) {

      selectA.innerHTML =
        "";

      selectB.innerHTML =
        "";

      return;

    }


    const options =
      records
        .map(
          record => {

            const date =
              new Date(
                record.createdAt
              )
                .toLocaleString(
                  "ko-KR"
                );


            return `

              <option
                value="${record.id}"
              >

                ${record.typeName}
                ·
                ${date}
                ·
                ${record.score ?? "-"}점

              </option>

            `;

          }
        )
        .join("");


    selectA.innerHTML =
      options;


    selectB.innerHTML =
      options;


    if (
      records.length > 1
    ) {

      selectB.selectedIndex =
        1;

    }

  },


  /* =======================================================
     29. RUN COMPARISON
  ======================================================= */

  runCompare() {

    const a =
      Store.get(
        document.getElementById(
          "compareA"
        )?.value
      );


    const b =
      Store.get(
        document.getElementById(
          "compareB"
        )?.value
      );


    if (
      !a ||
      !b
    ) {

      UI.toast(
        "두 개의 기록을 선택하세요."
      );

      return;

    }


    if (
      a.id === b.id
    ) {

      UI.toast(
        "서로 다른 기록을 선택하세요."
      );

      return;

    }


    const empty =
      document.getElementById(
        "compareEmpty"
      );


    const result =
      document.getElementById(
        "compareResult"
      );


    empty?.classList.add(
      "hidden"
    );


    result?.classList.remove(
      "hidden"
    );


    /*
     * 점수
     */

    const scoreA =
      Number(
        a.score || 0
      );


    const scoreB =
      Number(
        b.score || 0
      );


    const difference =
      scoreB -
      scoreA;


    document.getElementById(
      "scoreA"
    ).textContent =
      a.score ??
      "-";


    document.getElementById(
      "scoreB"
    ).textContent =
      b.score ??
      "-";


    document.getElementById(
      "scoreDiff"
    ).textContent =
      (
        difference >= 0
          ? "+"
          : ""
      ) +
      difference;


    /*
     * 지표
     */

    const keys = [

      "symmetry",

      "stability",

      "consistency"

    ];


    const names = {

      symmetry:
        "대칭성",

      stability:
        "중심 안정성",

      consistency:
        "동작 일관성"

    };


    const bars =
      document.getElementById(
        "compareBars"
      );


    if (bars) {

      bars.innerHTML =
        keys
          .map(
            key => {

              const valueA =
                Number(
                  a.metrics?.[key] ||
                  0
                );


              const valueB =
                Number(
                  b.metrics?.[key] ||
                  0
                );


              return `

                <div
                  class="compare-bar"
                >

                  <div
                    class="compare-bar-top"
                  >

                    <span>
                      ${names[key]}
                    </span>

                    <b>
                      ${Math.round(valueA)}
                      /
                      ${Math.round(valueB)}
                    </b>

                  </div>


                  <div class="bar">

                    <i
                      style="
                        width:
                        ${Math.max(
                          0,
                          Math.min(
                            100,
                            valueB
                          )
                        )}%;
                      "
                    ></i>

                  </div>

                </div>

              `;

            }
          )
          .join("");

    }


    /*
     * 비교 그래프
     */

    this.createComparisonChart(
      a,
      b
    );


    /*
     * 코멘트
     */

    const comment =
      document.getElementById(
        "compareComment"
      );


    if (comment) {

      const changes =
        keys.map(
          key => {

            const oldValue =
              Number(
                a.metrics?.[key] ||
                0
              );


            const newValue =
              Number(
                b.metrics?.[key] ||
                0
              );


            return {

              key,

              diff:
                newValue -
                oldValue

            };

          }
        );


      const improved =
        changes
          .filter(
            item =>
              item.diff > 2
          );


      const declined =
        changes
          .filter(
            item =>
              item.diff < -2
          );


      let html = "";


      if (
        improved.length
      ) {

        html += `

          <p>
            <b>개선된 지표</b>:
            ${
              improved
                .map(
                  item =>
                    names[
                      item.key
                    ]
                )
                .join(", ")
            }
          </p>

        `;

      }


      if (
        declined.length
      ) {

        html += `

          <p>
            <b>확인이 필요한 지표</b>:
            ${
              declined
                .map(
                  item =>
                    names[
                      item.key
                    ]
                )
                .join(", ")
            }
          </p>

        `;

      }


      if (!html) {

        html = `

          <p>
            두 기록의 핵심 지표가
            큰 차이 없이 유지되고 있습니다.
          </p>

        `;

      }


      comment.innerHTML =
        html;

    }

  },


  /* =======================================================
     30. COMPARISON CHART
  ======================================================= */

  createComparisonChart(
    a,
    b
  ) {

    if (
      typeof Chart ===
      "undefined"
    ) {

      return;

    }


    const canvas =
      document.getElementById(
        "compareChart"
      );


    if (!canvas) {
      return;
    }


    if (
      this.charts.compare
    ) {

      this.charts.compare.destroy();

    }


    const keys = [

      "symmetry",

      "stability",

      "consistency"

    ];


    this.charts.compare =
      new Chart(
        canvas,
        {

          type:
            "bar",


          data: {

            labels: [

              "대칭성",

              "중심 안정성",

              "동작 일관성"

            ],


            datasets: [

              {

                label:
                  "A",

                data:
                  keys.map(
                    key =>
                      Number(
                        a.metrics?.[key] ||
                        0
                      )
                  )

              },


              {

                label:
                  "B",

                data:
                  keys.map(
                    key =>
                      Number(
                        b.metrics?.[key] ||
                        0
                      )
                  )

              }

            ]

          },


          options: {

            responsive:
              true,

            maintainAspectRatio:
              false,

            scales: {

              y: {

                min:
                  0,

                max:
                  100

              }

            }

          }

        }
      );

  }

};


/* =========================================================
   31. CREATE ALL ANALYZERS
========================================================= */

App.create(

  "ski",

  {

    video:
      "skiVideo",

    canvas:
      "skiCanvas",

    input:
      "skiInput",

    upload:
      "skiUpload",

    play:
      "skiPlay",

    prev:
      "skiPrev",

    next:
      "skiNext",

    slow:
      "skiSlow",

    normal:
      "skiNormal",

    seek:
      "skiSeek",

    start:
      "skiStart",

    stop:
      "skiStop"

  }

);


App.create(

  "roller",

  {

    video:
      "rollerVideo",

    canvas:
      "rollerCanvas",

    input:
      "rollerInput",

    upload:
      "rollerUpload",

    play:
      "rollerPlay",

    prev:
      "rollerPrev",

    next:
      "rollerNext",

    slow:
      "rollerSlow",

    normal:
      "rollerNormal",

    seek:
      "rollerSeek",

    start:
      "rollerStart",

    stop:
      "rollerStop"

  }

);


App.create(

  "shooting",

  {

    video:
      "shootingVideo",

    canvas:
      "shootingCanvas",

    input:
      "shootingInput",

    upload:
      "shootingUpload",

    play:
      "shootingPlay",

    prev:
      "shootingPrev",

    next:
      "shootingNext",

    slow:
      "shootingSlow",

    normal:
      "shootingNormal",

    seek:
      "shootingSeek",

    start:
      "shootingStart",

    stop:
      "shootingStop"

  }

);


/* =========================================================
   32. COMPARE BUTTON
========================================================= */

document
  .getElementById(
    "runCompare"
  )
  ?.addEventListener(
    "click",
    () => {

      App.runCompare();

    }
  );


/* =========================================================
   33. INITIAL DASHBOARD
========================================================= */

App.refreshDashboard();


/* =========================================================
   34. INITIAL RECORD LIST
========================================================= */

App.renderRecords();


/* =========================================================
   35. INITIAL COMPARISON
========================================================= */

App.refreshCompare();