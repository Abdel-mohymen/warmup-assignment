const fs = require("fs");
function timeToSeconds(timeStr) {
    let [time, modifier] = timeStr.split(' ');
    let [hours, minutes, seconds] = time.split(':').map(Number);

    if (modifier) { // Handles "am/pm" format
        if (hours === 12 && modifier.toLowerCase() === 'am') hours = 0;
        if (hours !== 12 && modifier.toLowerCase() === 'pm') hours += 12;
    }
    return hours * 3600 + minutes * 60 + seconds;
}

function secondsToTime(totalSeconds, includeThreeDigits = false) {
    let hours = Math.floor(totalSeconds / 3600);
    let minutes = Math.floor((totalSeconds % 3600) / 60);
    let seconds = totalSeconds % 60;

    let h = includeThreeDigits ? hours : hours;
    let m = minutes.toString().padStart(2, '0');
    let s = seconds.toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}
// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
    let start = timeToSeconds(startTime);
    let end = timeToSeconds(endTime);

    if (end < start) end += 24 * 3600;

    return secondsToTime(end - start);
}


// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
    let start = timeToSeconds(startTime);
    let end = timeToSeconds(endTime);
    if (end < start) end += 24 * 3600;

    const deliveryStart = 8 * 3600;
    const deliveryEnd = 22 * 3600;

    let idleSeconds = 0;

    if (start < deliveryStart) {
        idleSeconds += Math.min(end, deliveryStart) - start;
    }

    if (end > deliveryEnd) {
        idleSeconds += end - Math.max(start, deliveryEnd);
    }

    return secondsToTime(idleSeconds);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    let durationSec = timeToSeconds(shiftDuration);
    let idleSec = timeToSeconds(idleTime);

    return secondsToTime(durationSec - idleSec);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
    let activeSec = timeToSeconds(activeTime);
    let quotaSec = 8 * 3600 + 24 * 60;

    let current = new Date(date);
    let eidStart = new Date("2025-04-10");
    let eidEnd = new Date("2025-04-30");

    if (current >= eidStart && current <= eidEnd) {
        quotaSec = 6 * 3600; // 6h
    }

    return activeSec >= quotaSec;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
    const data = fs.readFileSync(textFile, 'utf8').trim();
    const lines = data.split('\n');
    const header = lines[0];
    const records = lines.slice(1);

    for (let line of records) {
        const parts = line.split(',');
        if (parts[0] === shiftObj.driverID && parts[2] === shiftObj.date) {
            return {};
        }
    }

    const duration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    const idle = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    const active = getActiveTime(duration, idle);
    const quota = metQuota(shiftObj.date, active);

    const newRecord = [
        shiftObj.driverID,
        shiftObj.driverName,
        shiftObj.date,
        shiftObj.startTime,
        shiftObj.endTime,
        duration,
        idle,
        active,
        quota,
        false
    ].join(',');

    fs.writeFileSync(textFile, data + '\n' + newRecord, 'utf8');

    return {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration: duration,
        idleTime: idle,
        activeTime: active,
        metQuota: quota,
        hasBonus: false
    };
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
    let data = fs.readFileSync(textFile, 'utf8').trim().split('\n');
    for (let i = 1; i < data.length; i++) {
        let parts = data[i].split(',');
        if (parts[0] === driverID && parts[2] === date) {
            parts[9] = newValue.toString();
            data[i] = parts.join(',');
            break;
        }
    }
    fs.writeFileSync(textFile, data.join('\n'), 'utf8');
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
    const data = fs.readFileSync(textFile, 'utf8').trim().split('\n').slice(1);
    let count = 0;
    let found = false;

    // Ensure month is a two-digit string (e.g., "4" becomes "04")
    const searchMonth = month.toString().padStart(2, '0');

    for (let line of data) {
        if (!line.trim()) continue;
        const parts = line.split(',');
        if (parts[0] === driverID) {
            found = true;
            const dateParts = parts[2].split('-'); // [yyyy, mm, dd]
            const recordMonth = dateParts[1];

            // Compare as strings and check if HasBonus is true
            if (recordMonth === searchMonth && parts[9].trim() === 'true') {
                count++;
            }
        }
    }
    return found ? count : -1;
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    const data = fs.readFileSync(textFile, 'utf8').trim().split('\n').slice(1);
    let totalSeconds = 0;
    const searchMonth = month.toString().padStart(2, '0');

    for (let line of data) {
        const parts = line.split(',');
        const recordMonth = parts[2].split('-')[1];
        if (parts[0] === driverID && recordMonth === searchMonth) {
            totalSeconds += timeToSeconds(parts[7]);
        }
    }
    return secondsToTime(totalSeconds, true);
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================

function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {

    const shifts = fs.readFileSync(textFile, "utf8").trim().split("\n");
    const rates = fs.readFileSync(rateFile, "utf8").trim().split("\n");

    let dayOff = null;

    for (let i = 0; i < rates.length; i++) {
        let parts = rates[i].split(",");
        if (parts[0] === driverID) {
            dayOff = parts[1];
            break;
        }
    }

    if (dayOff === null) return "0:00:00";

    function timeToSeconds(time) {
        let parts = time.split(":");
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    }

    function secondsToTime(sec) {
        if (sec < 0) sec = 0;

        let h = Math.floor(sec / 3600);
        let m = Math.floor((sec % 3600) / 60);
        let s = sec % 60;

        m = m < 10 ? "0" + m : m;
        s = s < 10 ? "0" + s : s;

        return h + ":" + m + ":" + s;
    }

    let totalSeconds = 0;
    let foundShift = false;

    for (let i = 0; i < shifts.length; i++) {

        let row = shifts[i].split(",");

        let dID = row[0];
        let date = row[2];

        if (dID !== driverID) continue;

        let dateParts = date.split("-");
        let year = parseInt(dateParts[0]);
        let m = parseInt(dateParts[1]);
        let day = parseInt(dateParts[2]);

        if (m !== month) continue;

        foundShift = true;

        let dateObj = new Date(date);
        let weekday = dateObj.toLocaleDateString("en-US", { weekday: "long" });

        if (weekday === dayOff) continue;

        let quota = "8:24:00";

        if (year === 2025 && m === 4 && day >= 10 && day <= 30) {
            quota = "6:00:00";
        }

        totalSeconds += timeToSeconds(quota);
    }

    if (!foundShift) return "0:00:00";

    totalSeconds -= bonusCount * 2 * 3600;

    return secondsToTime(totalSeconds);
}
// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    const fs = require("fs");

    const rates = fs.readFileSync(rateFile, "utf8").trim().split("\n");

    let basePay = null;
    let tier = null;

    for (let i = 0; i < rates.length; i++) {
        let parts = rates[i].split(",");

        if (parts[0] === driverID) {
            basePay = parseInt(parts[2]);
            tier = parseInt(parts[3]);
            break;
        }
    }

    if (basePay === null || tier === null) {
        return 0;
    }

    function timeToSeconds(time) {
        let parts = time.split(":");
        let hours = parseInt(parts[0]);
        let minutes = parseInt(parts[1]);
        let seconds = parseInt(parts[2]);

        return hours * 3600 + minutes * 60 + seconds;
    }

    let actualSeconds = timeToSeconds(actualHours);
    let requiredSeconds = timeToSeconds(requiredHours);

    if (actualSeconds >= requiredSeconds) {
        return basePay;
    }

    let missingSeconds = requiredSeconds - actualSeconds;

    let allowedMissingHours = 0;

    if (tier === 1) {
        allowedMissingHours = 50;
    } else if (tier === 2) {
        allowedMissingHours = 20;
    } else if (tier === 3) {
        allowedMissingHours = 10;
    } else if (tier === 4) {
        allowedMissingHours = 3;
    }

    let allowedMissingSeconds = allowedMissingHours * 3600;

    if (missingSeconds <= allowedMissingSeconds) {
        return basePay;
    }

    let remainingMissingSeconds = missingSeconds - allowedMissingSeconds;

    let billableMissingHours = Math.floor(remainingMissingSeconds / 3600);

    let deductionRatePerHour = Math.floor(basePay / 185);

    let salaryDeduction = billableMissingHours * deductionRatePerHour;

    let netPay = basePay - salaryDeduction;

    return netPay;
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};