/* =========================================================
   설천 BIATHLON 자세분석 PRO
   events.js
   ---------------------------------------------------------
   공통 이벤트 / 프레임 이동 / 배속 / 키보드 조작
========================================================= */

"use strict";


/* =========================================================
   01. FRAME STEP
========================================================= */

function stepFrame(type, direction) {

    const video =
        document.querySelector(`#${type}Video`);

    if (!video) return;

    if (!video.duration) {
        toast("먼저 영상을 선택하세요.");
        return;
    }

    /*
     * 기본 영상은 약 30fps를 기준으로
     * 한 프레임씩 이동
     */
    const frameTime = 1 / 30;

    video.pause();

    video.currentTime =
        Math.max(
            0,
            Math.min(
                video.duration,
                video.currentTime +
                frameTime * direction
            )
        );

    updatePlayButton(type);

}


/* =========================================================
   02. PLAYBACK SPEED
========================================================= */

function setPlaybackSpeed(type, speed) {

    const video =
        document.querySelector(`#${type}Video`);

    if (!video) return;

    video.playbackRate =
        Number(speed);

    /*
     * 버튼 표시
     */
    document
        .querySelectorAll(
            `[data-speed][data-type="${type}"]`
        )
        .forEach(button => {

            const active =
                Number(button.dataset.speed) ===
                Number(speed);

            button.classList.toggle(
                "active-speed",
                active
            );

        });

    toast(
        `${speed}× 재생`
    );

}


/* =========================================================
   03. VIDEO TIME DISPLAY
========================================================= */

function formatVideoTime(seconds) {

    if (
        !Number.isFinite(seconds)
    ) {
        return "00:00.00";
    }

    const minutes =
        Math.floor(
            seconds / 60
        );

    const remain =
        seconds % 60;

    return (
        String(minutes)
            .padStart(2, "0")
        +
        ":"
        +
        remain
            .toFixed(2)
            .padStart(5, "0")
    );

}


/* =========================================================
   04. VIDEO DURATION
========================================================= */

function getVideoDuration(type) {

    const video =
        document.querySelector(
            `#${type}Video`
        );

    if (
        !video ||
        !Number.isFinite(
            video.duration
        )
    ) {

        return 0;

    }

    return video.duration;

}


/* =========================================================
   05. SET EXACT TIME
========================================================= */

function setVideoTime(
    type,
    time
) {

    const video =
        document.querySelector(
            `#${type}Video`
        );

    if (!video) return;

    if (!video.duration) return;

    video.currentTime =
        Math.max(
            0,
            Math.min(
                video.duration,
                Number(time)
            )
        );

}


/* =========================================================
   06. KEYBOARD CONTROL
========================================================= */

function setupKeyboardControls() {

    document.addEventListener(
        "keydown",
        event => {

            /*
             * 입력창에 글자를 입력하는 중에는
             * 영상 키보드 조작을 하지 않음
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
             * 현재 분석 페이지 확인
             */

            const page =
                window.SeolcheonApp
                    ?.APP
                    ?.currentPage;


            if (
                ![
                    "ski",
                    "roller",
                    "shooting"
                ].includes(page)
            ) {

                return;

            }


            const video =
                document.querySelector(
                    `#${page}Video`
                );


            if (!video) return;


            /*
             * Space
             * 재생 / 정지
             */

            if (
                event.code ===
                "Space"
            ) {

                event.preventDefault();

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
             * ←
             * 이전 프레임
             */

            if (
                event.code ===
                "ArrowLeft"
            ) {

                event.preventDefault();

                stepFrame(
                    page,
                    -1
                );

                return;

            }


            /*
             * →
             * 다음 프레임
             */

            if (
                event.code ===
                "ArrowRight"
            ) {

                event.preventDefault();

                stepFrame(
                    page,
                    1
                );

                return;

            }


            /*
             * 숫자 1
             * 0.25×
             */

            if (
                event.key === "1"
            ) {

                setPlaybackSpeed(
                    page,
                    0.25
                );

                return;

            }


            /*
             * 숫자 2
             * 0.5×
             */

            if (
                event.key === "2"
            ) {

                setPlaybackSpeed(
                    page,
                    0.5
                );

                return;

            }


            /*
             * 숫자 3
             * 1×
             */

            if (
                event.key === "3"
            ) {

                setPlaybackSpeed(
                    page,
                    1
                );

            }

        }
    );

}


/* =========================================================
   07. FRAME BUTTON EVENTS
========================================================= */

function setupFrameButtons() {

    document.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-frame]"
                );

            if (!button) return;

            const type =
                button.dataset.type;

            const direction =
                Number(
                    button.dataset.frame
                );

            if (
                !type ||
                !Number.isFinite(
                    direction
                )
            ) {

                return;

            }

            stepFrame(
                type,
                direction
            );

        }
    );

}


/* =========================================================
   08. SPEED BUTTON EVENTS
========================================================= */

function setupSpeedButtons() {

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

            const speed =
                Number(
                    button.dataset.speed
                );

            if (
                !type ||
                !Number.isFinite(
                    speed
                )
            ) {

                return;

            }

            setPlaybackSpeed(
                type,
                speed
            );

        }
    );

}


/* =========================================================
   09. VIDEO LOADED EVENTS
========================================================= */

function setupVideoMetadataEvents() {

    [
        "ski",
        "roller",
        "shooting"
    ].forEach(
        type => {

            const video =
                document.querySelector(
                    `#${type}Video`
                );

            if (!video) return;


            video.addEventListener(
                "loadedmetadata",
                () => {

                    video.playbackRate =
                        1;

                    updateTimeline(
                        type
                    );

                }
            );

        }
    );

}


/* =========================================================
   10. VIDEO ERROR
========================================================= */

function setupVideoErrorEvents() {

    [
        "ski",
        "roller",
        "shooting"
    ].forEach(
        type => {

            const video =
                document.querySelector(
                    `#${type}Video`
                );

            if (!video) return;


            video.addEventListener(
                "error",
                () => {

                    toast(
                        `${typeName(type)} 영상 파일을 읽을 수 없습니다.`
                    );

                }
            );

        }
    );

}


/* =========================================================
   11. VISIBILITY RESET
========================================================= */

function resetPoseWhenVideoChanged() {

    [
        "ski",
        "roller",
        "shooting"
    ].forEach(
        type => {

            const video =
                document.querySelector(
                    `#${type}Video`
                );

            if (!video) return;


            video.addEventListener(
                "loadeddata",
                () => {

                    if (
                        window.SeolcheonPose
                    ) {

                        window.SeolcheonPose
                            .reset();

                    }

                }
            );

        }
    );

}


/* =========================================================
   12. PAGE CHANGE RESET
========================================================= */

function setupPageChangeProtection() {

    document.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    ".nav-item"
                );

            if (!button) return;


            /*
             * 다른 분석으로 넘어가면
             * 분석 상태는 초기화하지만
             * 저장된 기록은 유지
             */

            const type =
                button.dataset.page;


            if (
                [
                    "ski",
                    "roller",
                    "shooting"
                ].includes(type)
            ) {

                if (
                    window.SeolcheonPose
                ) {

                    window.SeolcheonPose
                        .setSport(
                            type
                        );

                }

            }

        }
    );

}


/* =========================================================
   13. ANALYSIS SHORTCUTS
========================================================= */

function setupAnalysisShortcuts() {

    document.addEventListener(
        "keydown",
        event => {

            const page =
                window.SeolcheonApp
                    ?.APP
                    ?.currentPage;


            if (
                page !== "shooting"
            ) {

                return;

            }


            /*
             * S
             * 자세 캡처
             */

            if (
                event.key.toLowerCase()
                === "s"
            ) {

                if (
                    window.SeolcheonApp
                        ?.capturePose
                ) {

                    window.SeolcheonApp
                        .capturePose(
                            "shooting"
                        );

                }

            }

        }
    );

}


/* =========================================================
   14. INITIALIZE EVENTS
========================================================= */

function initializeEvents() {

    setupFrameButtons();

    setupSpeedButtons();

    setupKeyboardControls();

    setupVideoMetadataEvents();

    setupVideoErrorEvents();

    resetPoseWhenVideoChanged();

    setupPageChangeProtection();

    setupAnalysisShortcuts();

    console.log(
        "설천 Events Ready"
    );

}


/* =========================================================
   15. PUBLIC API
========================================================= */

window.SeolcheonEvents = {

    stepFrame,

    setPlaybackSpeed,

    setVideoTime,

    formatVideoTime,

    getVideoDuration,

    initialize:
        initializeEvents

};


/* =========================================================
   16. START
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeEvents,
        {
            once: true
        }
    );

} else {

    initializeEvents();

}


/* =========================================================
   END OF events.js
========================================================= */