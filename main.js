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
    const searchMonth = month.toString().padStart(2, '0');

    for (let line of data) {
        const parts = line.split(',');
        if (parts[0] === driverID) {
            found = true;
            const recordMonth = parts[2].split('-')[1];
            if (recordMonth === searchMonth && parts[9] === 'true') {
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
    const rateData = fs.readFileSync(rateFile, 'utf8').trim().split('\n');
    let dayOff = "";
    for (let line of rateData) {
        const parts = line.split(',');
        if (parts[0] === driverID) {
            dayOff = parts[1];
            break;
        }
    }

    const year = 2025;
    const daysInMonth = new Date(year, month, 0).getDate();
    let totalRequiredSeconds = 0;

    for (let d = 1; d <= daysInMonth; d++) {
        let dateStr = `${year}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        let dateObj = new Date(dateStr);
        let dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

        if (dayName !== dayOff) {
            let quotaSec = (8 * 3600) + (24 * 60); 
            let eidStart = new Date("2025-04-10");
            let eidEnd = new Date("2025-04-30");

            if (dateObj >= eidStart && dateObj <= eidEnd) {
                quotaSec = 6 * 3600;
            }
            totalRequiredSeconds += quotaSec;
        }
    }

    const bonusDeduction = Math.min(bonusCount, 4) * 3600;
    totalRequiredSeconds -= bonusDeduction;

    return secondsToTime(Math.max(0, totalRequiredSeconds), true);
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
    const rateData = fs.readFileSync(rateFile, 'utf8').trim().split('\n');
    let salary = 0, tier = 0;

    for (let line of rateData) {
        const parts = line.split(',');
        if (parts[0] === driverID) {
            salary = parseInt(parts[2]);
            tier = parseInt(parts[3]);
            break;
        }
    }

    const actualSec = timeToSeconds(actualHours);
    const requiredSec = timeToSeconds(requiredHours);

    if (actualSec >= requiredSec) return salary;

    const allowances = { 1: 0.10, 2: 0.05, 3: 0.02, 4: 0.00 };
    const allowedMissingSec = requiredSec * (allowances[tier] || 0);

    if (requiredSec - actualSec <= allowedMissingSec) return salary;

    const missingSec = requiredSec - actualSec;
    const hourlyRate = salary / (requiredSec / 3600);
    const deduction = (missingSec / 3600) * hourlyRate;

    return Math.floor(salary - deduction);
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
