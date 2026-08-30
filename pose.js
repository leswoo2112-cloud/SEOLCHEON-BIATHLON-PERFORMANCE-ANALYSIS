/* =========================================================
   설천 BIATHLON 자세분석 PRO
   pose.js
   ---------------------------------------------------------
   핵심 기능
   1. MediaPipe Pose 기반 사람 인식
   2. 사람 중심점 추적
   3. 스켈레톤 튐 방지
   4. 관절 좌표 EMA/Smoothing
   5. 일시적인 인식 실패 보정
   6. 정면 / 측면 / 후면 분석
   7. 스키 / 롤러스키 / 사격 공통 사용
   8. 관절각 계산
   9. 좌우 무릎 / 고관절 / 팔꿈치 분석
   10. 중심 궤적 데이터 생성
   11. 총구 기준점 추적 지원
   12. 사격 격발 이벤트 전후 데이터 지원
   13. 분석 프레임 캡처
========================================================= */

"use strict";


/* =========================================================
   01. POSE CONSTANTS
========================================================= */

const POSE_CONFIG = {

    modelComplexity: 1,

    smoothLandmarks: true,

    minDetectionConfidence: 0.55,

    minTrackingConfidence: 0.55,

    /*
     * 스켈레톤이 갑자기 다른 사람/물체로
     * 이동하는 것을 막기 위한 설정
     */
    maxJumpDistance: 0.18,

    /*
     * 이전 프레임을 유지할 최대 횟수
     * 사람이 잠깐 가려져도 스켈레톤이 사라지지 않음
     */
    maxLostFrames: 8,

    /*
     * EMA smoothing
     * 낮을수록 부드럽고
     * 높을수록 실제 움직임을 빠르게 따라감
     */
    smoothingAlpha: 0.45,

    /*
     * 중심점 추적
     */
    centerAlpha: 0.35,

    /*
     * 최소 visibility
     */
    minVisibility: 0.45,

    /*
     * 사람 영역 크기 최소값
     */
    minPersonArea: 0.035,

    /*
     * 사람 선택 영역
     */
    maxPersonArea: 0.95

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
   03. POSE STATE
========================================================= */

const POSE_STATE = {

    initialized: false,

    pose: null,

    currentType: "ski",

    currentCamera: "side",

    previousLandmarks: null,

    smoothedLandmarks: null,

    lastGoodLandmarks: null,

    lostFrames: 0,

    frameNumber: 0,

    timestamp: 0,

    confidence: 0,

    person: {

        detected: false,

        confidence: 0,

        center: {

            x: 0.5,
            y: 0.5

        },

        width: 0,
        height: 0,

        area: 0

    },

    trajectory: [],

    maxTrajectoryPoints: 600,

    angles: {},

    snapshots: [],

    initializedVideo: null,

    canvas: null,

    ctx: null

};


/* =========================================================
   04. SKELETON CONNECTIONS
========================================================= */

const POSE_CONNECTIONS = [

    [LM.NOSE, LM.LEFT_EYE],
    [LM.NOSE, LM.RIGHT_EYE],

    [LM.LEFT_EYE, LM.LEFT_EAR],
    [LM.RIGHT_EYE, LM.RIGHT_EAR],

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
    [LM.LEFT_ANKLE, LM.LEFT_HEEL],
    [LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX],

    [LM.RIGHT_HIP, LM.RIGHT_KNEE],
    [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
    [LM.RIGHT_ANKLE, LM.RIGHT_HEEL],
    [LM.RIGHT_HEEL, LM.RIGHT_FOOT_INDEX]

];


/* =========================================================
   05. BASIC MATH
========================================================= */

function clamp(value, min, max) {

    return Math.max(
        min,
        Math.min(
            max,
            value
        )
    );

}


function distance(a, b) {

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


function lerp(a, b, alpha) {

    return (
        a +
        (b - a) *
        alpha
    );

}


function midpoint(a, b) {

    if (!a || !b) {

        return {

            x: 0.5,
            y: 0.5,
            visibility: 0

        };

    }

    return {

        x:
            (a.x + b.x) / 2,

        y:
            (a.y + b.y) / 2,

        visibility:
            Math.min(
                a.visibility ?? 1,
                b.visibility ?? 1
            )

    };

}


/* =========================================================
   06. ANGLE
========================================================= */

function calculateAngle(
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
            ba.x * ba.x +
            ba.y * ba.y
        );


    const magB =
        Math.sqrt(
            bc.x * bc.x +
            bc.y * bc.y
        );


    if (
        magA === 0 ||
        magB === 0
    ) {

        return null;

    }


    const cosine =
        clamp(
            dot /
            (magA * magB),
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


/* =========================================================
   07. LANDMARK VISIBILITY
========================================================= */

function isVisible(
    point
) {

    return !!(
        point &&
        (
            point.visibility === undefined ||
            point.visibility >=
            POSE_CONFIG.minVisibility
        )
    );

}


/* =========================================================
   08. LANDMARK COPY
========================================================= */

function cloneLandmarks(
    landmarks
) {

    if (!landmarks) {

        return null;

    }


    return landmarks.map(
        point => ({

            x: point.x,
            y: point.y,
            z: point.z || 0,

            visibility:
                point.visibility === undefined
                    ? 1
                    : point.visibility

        })
    );

}


/* =========================================================
   09. SMOOTH LANDMARKS
========================================================= */

function smoothLandmarks(
    current
) {

    if (!current) {

        return POSE_STATE.lastGoodLandmarks;

    }


    if (
        !POSE_STATE.smoothedLandmarks
    ) {

        POSE_STATE.smoothedLandmarks =
            cloneLandmarks(
                current
            );

        return POSE_STATE.smoothedLandmarks;

    }


    const previous =
        POSE_STATE.smoothedLandmarks;


    const result =
        current.map(
            (point, index) => {

                const old =
                    previous[index];


                if (!old) {

                    return {

                        ...point

                    };

                }


                const visibility =
                    point.visibility ??
                    1;


                /*
                 * 인식도가 낮은 관절은
                 * 기존 위치를 조금 더 신뢰
                 */

                let alpha =
                    POSE_CONFIG.smoothingAlpha;


                if (
                    visibility <
                    0.6
                ) {

                    alpha *= 0.45;

                }


                return {

                    x: lerp(
                        old.x,
                        point.x,
                        alpha
                    ),

                    y: lerp(
                        old.y,
                        point.y,
                        alpha
                    ),

                    z: lerp(
                        old.z || 0,
                        point.z || 0,
                        alpha
                    ),

                    visibility

                };

            }
        );


    POSE_STATE.smoothedLandmarks =
        result;


    return result;

}


/* =========================================================
   10. JUMP PROTECTION
========================================================= */

function rejectLargeJumps(
    current
) {

    if (
        !POSE_STATE.lastGoodLandmarks
    ) {

        return current;

    }


    const previous =
        POSE_STATE.lastGoodLandmarks;


    const result =
        current.map(
            (point, index) => {

                const old =
                    previous[index];


                if (!old) {

                    return point;

                }


                const d =
                    distance(
                        point,
                        old
                    );


                /*
                 * 갑자기 너무 멀리 이동하면
                 * 해당 관절만 이전 위치 유지
                 */

                if (
                    d >
                    POSE_CONFIG.maxJumpDistance
                ) {

                    return {

                        ...old,

                        visibility:
                            Math.min(
                                old.visibility ??
                                1,
                                point.visibility ??
                                1
                            )

                    };

                }


                return point;

            }
        );


    return result;

}


/* =========================================================
   11. PERSON BOUNDING BOX
========================================================= */

function calculatePersonBox(
    landmarks
) {

    const valid =
        landmarks.filter(
            point =>
                point &&
                (
                    point.visibility ===
                        undefined ||
                    point.visibility >=
                        POSE_CONFIG.minVisibility
                )
        );


    if (
        valid.length < 6
    ) {

        return null;

    }


    let minX = 1;
    let minY = 1;
    let maxX = 0;
    let maxY = 0;


    valid.forEach(
        point => {

            minX =
                Math.min(
                    minX,
                    point.x
                );

            minY =
                Math.min(
                    minY,
                    point.y
                );

            maxX =
                Math.max(
                    maxX,
                    point.x
                );

            maxY =
                Math.max(
                    maxY,
                    point.y
                );

        }
    );


    const width =
        maxX - minX;

    const height =
        maxY - minY;


    const area =
        width *
        height;


    return {

        minX,
        minY,
        maxX,
        maxY,

        width,
        height,

        area,

        center: {

            x:
                (minX + maxX) /
                2,

            y:
                (minY + maxY) /
                2

        }

    };

}


/* =========================================================
   12. PERSON CENTER
========================================================= */

function calculateBodyCenter(
    landmarks
) {

    const shoulder =
        midpoint(
            landmarks[
                LM.LEFT_SHOULDER
            ],
            landmarks[
                LM.RIGHT_SHOULDER
            ]
        );


    const hip =
        midpoint(
            landmarks[
                LM.LEFT_HIP
            ],
            landmarks[
                LM.RIGHT_HIP
            ]
        );


    return {

        x:
            (shoulder.x +
             hip.x) / 2,

        y:
            (shoulder.y +
             hip.y) / 2

    };

}


/* =========================================================
   13. CENTER TRACKING
========================================================= */

function updatePersonTracking(
    landmarks,
    confidence
) {

    const box =
        calculatePersonBox(
            landmarks
        );


    if (!box) {

        POSE_STATE.lostFrames++;

        if (
            POSE_STATE.lostFrames <=
            POSE_CONFIG.maxLostFrames
        ) {

            POSE_STATE.person.detected =
                true;

            POSE_STATE.person.confidence =
                confidence * 0.75;

            return;

        }


        POSE_STATE.person.detected =
            false;

        return;

    }


    /*
     * 너무 작은 검출은 사람으로 취급하지 않음
     */

    if (
        box.area <
        POSE_CONFIG.minPersonArea
    ) {

        POSE_STATE.lostFrames++;

        return;

    }


    if (
        box.area >
        POSE_CONFIG.maxPersonArea
    ) {

        /*
         * 화면 전체가 잡히는 경우에도
         * 분석 자체는 허용
         */

    }


    const bodyCenter =
        calculateBodyCenter(
            landmarks
        );


    const oldCenter =
        POSE_STATE.person.center;


    POSE_STATE.person.center = {

        x: lerp(
            oldCenter.x,
            bodyCenter.x,
            POSE_CONFIG.centerAlpha
        ),

        y: lerp(
            oldCenter.y,
            bodyCenter.y,
            POSE_CONFIG.centerAlpha
        )

    };


    POSE_STATE.person.width =
        box.width;

    POSE_STATE.person.height =
        box.height;

    POSE_STATE.person.area =
        box.area;

    POSE_STATE.person.confidence =
        confidence;

    POSE_STATE.person.detected =
        true;


    POSE_STATE.lostFrames = 0;


    /*
     * 중심 궤적
     */

    POSE_STATE.trajectory.push({

        x:
            POSE_STATE.person.center.x,

        y:
            POSE_STATE.person.center.y,

        time:
            POSE_STATE.timestamp,

        frame:
            POSE_STATE.frameNumber,

        confidence

    });


    if (
        POSE_STATE.trajectory.length >
        POSE_STATE.maxTrajectoryPoints
    ) {

        POSE_STATE.trajectory.shift();

    }

}


/* =========================================================
   14. ANGLE ANALYSIS
========================================================= */

function calculatePoseAngles(
    lm
) {

    const angles = {};


    angles.leftElbow =
        calculateAngle(
            lm[
                LM.LEFT_SHOULDER
            ],
            lm[
                LM.LEFT_ELBOW
            ],
            lm[
                LM.LEFT_WRIST
            ]
        );


    angles.rightElbow =
        calculateAngle(
            lm[
                LM.RIGHT_SHOULDER
            ],
            lm[
                LM.RIGHT_ELBOW
            ],
            lm[
                LM.RIGHT_WRIST
            ]
        );


    angles.leftKnee =
        calculateAngle(
            lm[
                LM.LEFT_HIP
            ],
            lm[
                LM.LEFT_KNEE
            ],
            lm[
                LM.LEFT_ANKLE
            ]
        );


    angles.rightKnee =
        calculateAngle(
            lm[
                LM.RIGHT_HIP
            ],
            lm[
                LM.RIGHT_KNEE
            ],
            lm[
                LM.RIGHT_ANKLE
            ]
        );


    angles.leftHip =
        calculateAngle(
            lm[
                LM.LEFT_SHOULDER
            ],
            lm[
                LM.LEFT_HIP
            ],
            lm[
                LM.LEFT_KNEE
            ]
        );


    angles.rightHip =
        calculateAngle(
            lm[
                LM.RIGHT_SHOULDER
            ],
            lm[
                LM.RIGHT_HIP
            ],
            lm[
                LM.RIGHT_KNEE
            ]
        );


    angles.shoulder =
        calculateAngle(
            lm[
                LM.LEFT_ELBOW
            ],
            lm[
                LM.LEFT_SHOULDER
            ],
            lm[
                LM.RIGHT_SHOULDER
            ]
        );


    angles.body =
        calculateBodyLean(
            lm
        );


    POSE_STATE.angles =
        angles;


    return angles;

}


/* =========================================================
   15. BODY LEAN
========================================================= */

function calculateBodyLean(
    lm
) {

    const shoulder =
        midpoint(
            lm[
                LM.LEFT_SHOULDER
            ],
            lm[
                LM.RIGHT_SHOULDER
            ]
        );


    const hip =
        midpoint(
            lm[
                LM.LEFT_HIP
            ],
            lm[
                LM.RIGHT_HIP
            ]
        );


    const dx =
        shoulder.x -
        hip.x;

    const dy =
        shoulder.y -
        hip.y;


    /*
     * 화면 수직 기준
     */

    const radians =
        Math.atan2(
            Math.abs(dx),
            Math.abs(dy)
        );


    return (
        radians *
        180 /
        Math.PI
    );

}


/* =========================================================
   16. SPORT ANALYSIS
========================================================= */

function analyzeSport(
    type,
    lm
) {

    const angles =
        calculatePoseAngles(
            lm
        );


    const result = {

        type,

        confidence:
            POSE_STATE.confidence,

        balance:
            calculateBalanceScore(
                lm
            ),

        stability:
            calculateStabilityScore(),

        movement:
            calculateMovementScore(),

        angles,

        timestamp:
            POSE_STATE.timestamp

    };


    if (
        type === "ski"
    ) {

        result.ski =
            analyzeSki(
                lm,
                angles
            );

    }


    if (
        type === "roller"
    ) {

        result.roller =
            analyzeRoller(
                lm,
                angles
            );

    }


    if (
        type === "shooting"
    ) {

        result.shooting =
            analyzeShooting(
                lm,
                angles
            );

    }


    return result;

}


/* =========================================================
   17. BALANCE
========================================================= */

function calculateBalanceScore(
    lm
) {

    const shoulder =
        midpoint(
            lm[
                LM.LEFT_SHOULDER
            ],
            lm[
                LM.RIGHT_SHOULDER
            ]
        );


    const hip =
        midpoint(
            lm[
                LM.LEFT_HIP
            ],
            lm[
                LM.RIGHT_HIP
            ]
        );


    const ankle =
        midpoint(
            lm[
                LM.LEFT_ANKLE
            ],
            lm[
                LM.RIGHT_ANKLE
            ]
        );


    const centerX =
        (
            shoulder.x +
            hip.x +
            ankle.x
        ) / 3;


    const deviation =
        Math.abs(
            centerX -
            0.5
        );


    return Math.round(
        clamp(
            100 -
            deviation * 180,
            0,
            100
        )
    );

}


/* =========================================================
   18. STABILITY
========================================================= */

function calculateStabilityScore() {

    const points =
        POSE_STATE.trajectory;


    if (
        points.length < 5
    ) {

        return 0;

    }


    const recent =
        points.slice(
            -30
        );


    let movement = 0;


    for (
        let i = 1;
        i < recent.length;
        i++
    ) {

        movement +=
            distance(
                recent[i],
                recent[i - 1]
            );

    }


    const average =
        movement /
        Math.max(
            1,
            recent.length - 1
        );


    return Math.round(
        clamp(
            100 -
            average * 700,
            0,
            100
        )
    );

}


/* =========================================================
   19. MOVEMENT SCORE
========================================================= */

function calculateMovementScore() {

    if (
        POSE_STATE.trajectory.length <
        10
    ) {

        return 0;

    }


    const recent =
        POSE_STATE.trajectory.slice(
            -20
        );


    let movement = 0;


    for (
        let i = 1;
        i < recent.length;
        i++
    ) {

        movement +=
            distance(
                recent[i],
                recent[i - 1]
            );

    }


    return Math.round(
        clamp(
            movement * 250,
            0,
            100
        )
    );

}


/* =========================================================
   20. SKI ANALYSIS
========================================================= */

function analyzeSki(
    lm,
    angles
) {

    const knee =
        average(
            angles.leftKnee,
            angles.rightKnee
        );


    const hip =
        average(
            angles.leftHip,
            angles.rightHip
        );


    return {

        kneeAngle:
            round(
                knee
            ),

        hipAngle:
            round(
                hip
            ),

        bodyLean:
            round(
                angles.body
            ),

        leftKnee:
            round(
                angles.leftKnee
            ),

        rightKnee:
            round(
                angles.rightKnee
            ),

        techniqueScore:
            calculateTechniqueScore(
                knee,
                hip,
                angles.body
            )

    };

}


/* =========================================================
   21. ROLLER SKI ANALYSIS
========================================================= */

function analyzeRoller(
    lm,
    angles
) {

    const knee =
        average(
            angles.leftKnee,
            angles.rightKnee
        );


    const hip =
        average(
            angles.leftHip,
            angles.rightHip
        );


    const arm =
        average(
            angles.leftElbow,
            angles.rightElbow
        );


    return {

        kneeAngle:
            round(
                knee
            ),

        hipAngle:
            round(
                hip
            ),

        elbowAngle:
            round(
                arm
            ),

        bodyLean:
            round(
                angles.body
            ),

        techniqueScore:
            calculateTechniqueScore(
                knee,
                hip,
                angles.body
            )

    };

}


/* =========================================================
   22. SHOOTING ANALYSIS
========================================================= */

function analyzeShooting(
    lm,
    angles
) {

    const shoulder =
        midpoint(
            lm[
                LM.LEFT_SHOULDER
            ],
            lm[
                LM.RIGHT_SHOULDER
            ]
        );


    const wrist =
        midpoint(
            lm[
                LM.LEFT_WRIST
            ],
            lm[
                LM.RIGHT_WRIST
            ]
        );


    return {

        kneeLeft:
            round(
                angles.leftKnee
            ),

        kneeRight:
            round(
                angles.rightKnee
            ),

        elbowLeft:
            round(
                angles.leftElbow
            ),

        elbowRight:
            round(
                angles.rightElbow
            ),

        hipLeft:
            round(
                angles.leftHip
            ),

        hipRight:
            round(
                angles.rightHip
            ),

        bodyLean:
            round(
                angles.body
            ),

        shoulderX:
            shoulder.x,

        shoulderY:
            shoulder.y,

        wristX:
            wrist.x,

        wristY:
            wrist.y,

        stability:
            calculateStabilityScore()

    };

}


/* =========================================================
   23. TECHNIQUE SCORE
========================================================= */

function calculateTechniqueScore(
    knee,
    hip,
    lean
) {

    if (
        knee === null ||
        hip === null
    ) {

        return 0;

    }


    /*
     * 특정 정답 자세를 강제로
     * 판정하지 않고 움직임의 안정성을
     * 중심으로 계산
     */

    const kneeScore =
        clamp(
            100 -
            Math.abs(
                knee - 145
            ) * 1.4,
            0,
            100
        );


    const hipScore =
        clamp(
            100 -
            Math.abs(
                hip - 150
            ) * 1.2,
            0,
            100
        );


    const leanScore =
        clamp(
            100 -
            lean * 3,
            0,
            100
        );


    return Math.round(
        (
            kneeScore +
            hipScore +
            leanScore
        ) / 3
    );

}


/* =========================================================
   24. AVERAGE
========================================================= */

function average(
    a,
    b
) {

    if (
        a === null &&
        b === null
    ) {

        return null;

    }


    if (
        a === null
    ) {

        return b;

    }


    if (
        b === null
    ) {

        return a;

    }


    return (
        a + b
    ) / 2;

}


/* =========================================================
   25. ROUND
========================================================= */

function round(
    value
) {

    if (
        value === null ||
        value === undefined ||
        Number.isNaN(value)
    ) {

        return null;

    }


    return Math.round(
        value * 10
    ) / 10;

}


/* =========================================================
   26. POSE RESULT CALLBACK
========================================================= */

function handlePoseResults(
    results
) {

    POSE_STATE.frameNumber++;

    POSE_STATE.timestamp =
        performance.now();


    /*
     * MediaPipe 결과
     */

    let landmarks =
        results?.poseLandmarks;


    /*
     * 사람을 찾지 못한 경우
     */

    if (
        !landmarks ||
        landmarks.length < 33
    ) {

        POSE_STATE.lostFrames++;


        /*
         * 짧은 인식 실패라면
         * 마지막 정상 스켈레톤 유지
         */

        if (
            POSE_STATE.lastGoodLandmarks &&
            POSE_STATE.lostFrames <=
                POSE_CONFIG.maxLostFrames
        ) {

            landmarks =
                POSE_STATE.lastGoodLandmarks;

        } else {

            POSE_STATE.person.detected =
                false;

            drawSkeleton(
                landmarks
            );

            return;

        }

    }


    /*
     * 튀는 관절 제거
     */

    landmarks =
        rejectLargeJumps(
            landmarks
        );


    /*
     * 부드럽게 이동
     */

    landmarks =
        smoothLandmarks(
            landmarks
        );


    /*
     * 정상 데이터 저장
     */

    POSE_STATE.lastGoodLandmarks =
        cloneLandmarks(
            landmarks
        );


    POSE_STATE.previousLandmarks =
        cloneLandmarks(
            landmarks
        );


    POSE_STATE.lostFrames = 0;


    /*
     * 전체 신뢰도
     */

    POSE_STATE.confidence =
        calculateConfidence(
            landmarks
        );


    /*
     * 사람 추적
     */

    updatePersonTracking(
        landmarks,
        POSE_STATE.confidence
    );


    /*
     * 스포츠 분석
     */

    const analysis =
        analyzeSport(
            POSE_STATE.currentType,
            landmarks
        );


    /*
     * 화면 출력
     */

    drawSkeleton(
        landmarks
    );


    drawPersonBox(
        landmarks
    );


    drawCenterTrajectory();


    /*
     * 외부 app.js에 전달
     */

    if (
        typeof window.onPoseAnalysisUpdate ===
        "function"
    ) {

        window.onPoseAnalysisUpdate(
            analysis,
            POSE_STATE
        );

    }


    /*
     * 기존 프로그램 호환
     */

    if (
        typeof window.updatePoseMetrics ===
        "function"
    ) {

        window.updatePoseMetrics(
            analysis
        );

    }

}


/* =========================================================
   27. CONFIDENCE
========================================================= */

function calculateConfidence(
    landmarks
) {

    if (
        !landmarks ||
        landmarks.length === 0
    ) {

        return 0;

    }


    const important = [

        LM.NOSE,

        LM.LEFT_SHOULDER,
        LM.RIGHT_SHOULDER,

        LM.LEFT_ELBOW,
        LM.RIGHT_ELBOW,

        LM.LEFT_HIP,
        LM.RIGHT_HIP,

        LM.LEFT_KNEE,
        LM.RIGHT_KNEE,

        LM.LEFT_ANKLE,
        LM.RIGHT_ANKLE

    ];


    let total = 0;
    let count = 0;


    important.forEach(
        index => {

            const point =
                landmarks[index];


            if (!point) return;


            total +=
                point.visibility ??
                1;

            count++;

        }
    );


    if (
        count === 0
    ) {

        return 0;

    }


    return (
        total /
        count
    );

}


/* =========================================================
   28. DRAW SKELETON
========================================================= */

function drawSkeleton(
    landmarks
) {

    const canvas =
        POSE_STATE.canvas;


    const ctx =
        POSE_STATE.ctx;


    if (
        !canvas ||
        !ctx
    ) {

        return;

    }


    /*
     * 영상 위에 놓인 캔버스만
     * 지움
     */

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    if (
        !landmarks ||
        landmarks.length < 33
    ) {

        return;

    }


    /*
     * 연결선
     */

    ctx.lineWidth = 3;


    POSE_CONNECTIONS.forEach(
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
                !b ||
                !isVisible(a) ||
                !isVisible(b)
            ) {

                return;

            }


            ctx.beginPath();

            ctx.moveTo(
                a.x *
                    canvas.width,
                a.y *
                    canvas.height
            );

            ctx.lineTo(
                b.x *
                    canvas.width,
                b.y *
                    canvas.height
            );

            ctx.stroke();

        }
    );


    /*
     * 관절점
     */

    landmarks.forEach(
        point => {

            if (
                !point ||
                !isVisible(point)
            ) {

                return;

            }


            ctx.beginPath();

            ctx.arc(
                point.x *
                    canvas.width,
                point.y *
                    canvas.height,
                4,
                0,
                Math.PI * 2
            );

            ctx.fill();

        }
    );

}


/* =========================================================
   29. PERSON BOX
========================================================= */

function drawPersonBox(
    landmarks
) {

    const canvas =
        POSE_STATE.canvas;

    const ctx =
        POSE_STATE.ctx;


    if (
        !canvas ||
        !ctx ||
        !landmarks
    ) {

        return;

    }


    const box =
        calculatePersonBox(
            landmarks
        );


    if (!box) return;


    ctx.save();


    ctx.lineWidth = 2;


    ctx.setLineDash([
        8,
        6
    ]);


    ctx.strokeRect(

        box.minX *
            canvas.width,

        box.minY *
            canvas.height,

        box.width *
            canvas.width,

        box.height *
            canvas.height

    );


    ctx.setLineDash([]);


    ctx.font =
        "14px sans-serif";


    ctx.fillText(

        `PERSON ${
            Math.round(
                POSE_STATE.confidence *
                100
            )
        }%`,

        box.minX *
            canvas.width,

        Math.max(
            16,
            box.minY *
                canvas.height -
                6
        )

    );


    ctx.restore();

}


/* =========================================================
   30. CENTER TRAJECTORY
========================================================= */

function drawCenterTrajectory() {

    const canvas =
        POSE_STATE.canvas;

    const ctx =
        POSE_STATE.ctx;


    if (
        !canvas ||
        !ctx
    ) {

        return;

    }


    const points =
        POSE_STATE.trajectory;


    if (
        points.length < 2
    ) {

        return;

    }


    const recent =
        points.slice(
            -120
        );


    ctx.save();


    ctx.lineWidth = 2;


    ctx.beginPath();


    recent.forEach(
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


    ctx.stroke();


    ctx.restore();

}


/* =========================================================
   31. INITIALIZE MEDIAPIPE
========================================================= */

async function initializePose() {

    /*
     * 이미 초기화되어 있으면 종료
     */

    if (
        POSE_STATE.initialized
    ) {

        return POSE_STATE.pose;

    }


    /*
     * MediaPipe Pose가 로드되어 있는지 확인
     */

    if (
        typeof window.Pose !==
        "function"
    ) {

        console.warn(
            "MediaPipe Pose가 아직 로드되지 않았습니다."
        );

        return null;

    }


    const pose =
        new window.Pose({

            locateFile:
                file =>
                    `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`

        });


    pose.setOptions({

        modelComplexity:
            POSE_CONFIG.modelComplexity,

        smoothLandmarks:
            POSE_CONFIG.smoothLandmarks,

        minDetectionConfidence:
            POSE_CONFIG.minDetectionConfidence,

        minTrackingConfidence:
            POSE_CONFIG.minTrackingConfidence

    });


    pose.onResults(
        handlePoseResults
    );


    await pose.initialize();


    POSE_STATE.pose =
        pose;

    POSE_STATE.initialized =
        true;


    console.log(
        "설천 Pose Engine 초기화 완료"
    );


    return pose;

}


/* =========================================================
   32. CONNECT VIDEO
========================================================= */

async function connectPoseVideo(
    video,
    canvas
) {

    if (
        !video
    ) {

        console.warn(
            "분석할 영상이 없습니다."
        );

        return false;

    }


    if (
        !canvas
    ) {

        console.warn(
            "Pose canvas가 없습니다."
        );

        return false;

    }


    const pose =
        await initializePose();


    if (!pose) {

        return false;

    }


    POSE_STATE.initializedVideo =
        video;

    POSE_STATE.canvas =
        canvas;

    POSE_STATE.ctx =
        canvas.getContext(
            "2d"
        );


    resizePoseCanvas();


    /*
     * 영상 프레임 분석
     */

    if (
        !video._seolcheonPoseLoop
    ) {

        video._seolcheonPoseLoop =
            true;


        const process =
            async () => {

                if (
                    video.readyState >=
                    2 &&
                    !video.paused &&
                    !video.ended
                ) {

                    try {

                        await pose.send({

                            image:
                                video

                        });

                    } catch (
                        error
                    ) {

                        console.warn(
                            "Pose frame error:",
                            error
                        );

                    }

                }


                requestAnimationFrame(
                    process
                );

            };


        process();

    }


    return true;

}


/* =========================================================
   33. RESIZE CANVAS
========================================================= */

function resizePoseCanvas() {

    const canvas =
        POSE_STATE.canvas;

    const video =
        POSE_STATE.initializedVideo;


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
            Math.round(
                rect.width *
                window.devicePixelRatio
            )
        );


    const height =
        Math.max(
            1,
            Math.round(
                rect.height *
                window.devicePixelRatio
            )
        );


    canvas.width =
        width;

    canvas.height =
        height;


    canvas.style.width =
        `${rect.width}px`;

    canvas.style.height =
        `${rect.height}px`;

}


/* =========================================================
   34. RESET
========================================================= */

function resetPoseTracking() {

    POSE_STATE.previousLandmarks =
        null;

    POSE_STATE.smoothedLandmarks =
        null;

    POSE_STATE.lastGoodLandmarks =
        null;

    POSE_STATE.lostFrames =
        0;

    POSE_STATE.frameNumber =
        0;

    POSE_STATE.confidence =
        0;

    POSE_STATE.trajectory =
        [];

    POSE_STATE.angles =
        {};

    POSE_STATE.person = {

        detected: false,

        confidence: 0,

        center: {

            x: 0.5,
            y: 0.5

        },

        width: 0,
        height: 0,
        area: 0

    };


    if (
        POSE_STATE.ctx &&
        POSE_STATE.canvas
    ) {

        POSE_STATE.ctx.clearRect(

            0,
            0,

            POSE_STATE.canvas.width,
            POSE_STATE.canvas.height

        );

    }

}


/* =========================================================
   35. SET SPORT
========================================================= */

function setPoseSport(
    type
) {

    if (
        ![
            "ski",
            "roller",
            "shooting"
        ].includes(type)
    ) {

        return;

    }


    POSE_STATE.currentType =
        type;


    resetPoseTracking();

}


/* =========================================================
   36. SET CAMERA
========================================================= */

function setPoseCamera(
    camera
) {

    if (
        ![
            "front",
            "side",
            "rear"
        ].includes(camera)
    ) {

        return;

    }


    POSE_STATE.currentCamera =
        camera;

}


/* =========================================================
   37. CAPTURE POSE
========================================================= */

function capturePoseFrame(
    type =
        POSE_STATE.currentType
) {

    const video =
        POSE_STATE.initializedVideo;

    const canvas =
        POSE_STATE.canvas;


    if (
        !video ||
        !canvas
    ) {

        return null;

    }


    const output =
        document.createElement(
            "canvas"
        );


    output.width =
        video.videoWidth ||
        canvas.width;

    output.height =
        video.videoHeight ||
        canvas.height;


    const ctx =
        output.getContext(
            "2d"
        );


    ctx.drawImage(

        video,

        0,
        0,

        output.width,
        output.height

    );


    /*
     * 현재 스켈레톤을
     * 영상 위에 다시 그림
     */

    if (
        POSE_STATE.lastGoodLandmarks
    ) {

        drawLandmarksToCanvas(

            ctx,

            output.width,
            output.height,

            POSE_STATE.lastGoodLandmarks

        );

    }


    const dataURL =
        output.toDataURL(
            "image/jpeg",
            0.92
        );


    const snapshot = {

        id:
            `pose-${Date.now()}`,

        type,

        camera:
            POSE_STATE.currentCamera,

        time:
            video.currentTime,

        frame:
            POSE_STATE.frameNumber,

        confidence:
            POSE_STATE.confidence,

        dataURL,

        angles:
            {
                ...POSE_STATE.angles
            },

        createdAt:
            new Date().toISOString()

    };


    POSE_STATE.snapshots.push(
        snapshot
    );


    /*
     * 최대 50장
     */

    if (
        POSE_STATE.snapshots.length >
        50
    ) {

        POSE_STATE.snapshots.shift();

    }


    return snapshot;

}


/* =========================================================
   38. DRAW LANDMARKS TO EXPORT CANVAS
========================================================= */

function drawLandmarksToCanvas(
    ctx,
    width,
    height,
    landmarks
) {

    ctx.save();


    ctx.lineWidth = 5;


    POSE_CONNECTIONS.forEach(
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


    landmarks.forEach(
        point => {

            if (!point) return;


            ctx.beginPath();


            ctx.arc(

                point.x * width,
                point.y * height,

                6,

                0,
                Math.PI * 2

            );


            ctx.fill();

        }
    );


    ctx.restore();

}


/* =========================================================
   39. GET CURRENT DATA
========================================================= */

function getPoseData() {

    return {

        sport:
            POSE_STATE.currentType,

        camera:
            POSE_STATE.currentCamera,

        detected:
            POSE_STATE.person.detected,

        confidence:
            POSE_STATE.confidence,

        person:
            {
                ...POSE_STATE.person
            },

        angles:
            {
                ...POSE_STATE.angles
            },

        trajectory:
            [
                ...POSE_STATE.trajectory
            ],

        snapshots:
            [
                ...POSE_STATE.snapshots
            ],

        frame:
            POSE_STATE.frameNumber

    };

}


/* =========================================================
   40. WINDOW RESIZE
========================================================= */

window.addEventListener(
    "resize",
    () => {

        resizePoseCanvas();

    }
);


/* =========================================================
   41. PUBLIC API
========================================================= */

window.SeolcheonPose = {

    initialize:
        initializePose,

    connectVideo:
        connectPoseVideo,

    reset:
        resetPoseTracking,

    setSport:
        setPoseSport,

    setCamera:
        setPoseCamera,

    capture:
        capturePoseFrame,

    getData:
        getPoseData,

    getState:
        () =>
            POSE_STATE,

    calculateAngle,

    calculateConfidence,

    getLandmarks:
        () =>
            POSE_STATE.lastGoodLandmarks,

    getTrajectory:
        () =>
            POSE_STATE.trajectory

};


/* =========================================================
   42. COMPATIBILITY API
========================================================= */

window.capturePose =
    capturePoseFrame;


window.resetPose =
    resetPoseTracking;


window.setPoseSport =
    setPoseSport;


window.setPoseCamera =
    setPoseCamera;


/* =========================================================
   43. AUTO INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "설천 BIATHLON Pose Engine Ready"
        );

    }
);


/* =========================================================
   END OF pose.js
========================================================= */