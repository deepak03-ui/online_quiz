let timerInterval = null;
let endTime = 0; // Store the target end time
let timerEl = null;
let onTimeUpCallback = null;

export function initTimer(dependencies) {
    timerEl = dependencies.element;
    onTimeUpCallback = dependencies.onTimeUp;
}

export function start(durationSeconds) {
    stop();
    // 1. Calculate the exact time when the timer should end
    endTime = Date.now() + (durationSeconds * 1000);
    
    // 2. Start a high-frequency (but efficient) tick loop
    timerInterval = setInterval(tick, 250); // Tick 4 times a second
    tick(); // Run immediately to show the initial time
}

export function stop() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function tick() {
    // 3. Calculate remaining time by checking against the end time
    const timeRemainingMs = endTime - Date.now();
    const timeRemaining = Math.ceil(timeRemainingMs / 1000);

    updateDisplay(timeRemaining);

    if (timeRemainingMs < 0) {
        stop();
        if (onTimeUpCallback) onTimeUpCallback();
    }
}

function updateDisplay(timeRemaining) {
    if (!timerEl) return;
    const displayTime = Math.max(0, timeRemaining);
    const minutes = Math.floor(displayTime / 60).toString().padStart(2, '0');
    const seconds = (displayTime % 60).toString().padStart(2, '0');
    timerEl.textContent = `${minutes}:${seconds}`;

    timerEl.classList.remove('timer-warning', 'timer-critical');
    if (timeRemaining <= 5 && timeRemaining > 0) {
        timerEl.classList.add('timer-critical');
    } else if (timeRemaining <= 15 && timeRemaining > 0) {
        timerEl.classList.add('timer-warning');
    }
}