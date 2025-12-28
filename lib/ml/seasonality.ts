/**
 * Seasonality Detection and Adjustment
 * Adjusts predictions based on time of year, holidays, and trends
 */

// Major holidays and events that affect ad performance
const HOLIDAYS: Record<string, { start: string; end: string; impact: number; name: string }[]> = {
    // Format: MM-DD (month-day)
    '01': [
        { start: '01-01', end: '01-03', impact: -0.15, name: 'New Year' }, // Lower engagement
    ],
    '02': [
        { start: '02-01', end: '02-14', impact: 0.1, name: 'Valentines Build' },
        { start: '02-14', end: '02-15', impact: 0.2, name: 'Valentines Day' },
    ],
    '03': [],
    '04': [
        { start: '04-15', end: '04-21', impact: 0.15, name: 'Easter Period' },
    ],
    '05': [
        { start: '05-01', end: '05-15', impact: 0.1, name: 'Mothers Day Build' },
    ],
    '06': [
        { start: '06-01', end: '06-20', impact: 0.08, name: 'Fathers Day Build' },
    ],
    '07': [
        { start: '07-01', end: '07-07', impact: 0.1, name: 'July 4th (US)' },
    ],
    '08': [
        { start: '08-15', end: '08-31', impact: 0.15, name: 'Back to School' },
    ],
    '09': [
        { start: '09-01', end: '09-10', impact: 0.12, name: 'Labor Day' },
    ],
    '10': [
        { start: '10-25', end: '10-31', impact: 0.15, name: 'Halloween' },
    ],
    '11': [
        { start: '11-01', end: '11-24', impact: 0.2, name: 'Pre-BFCM' },
        { start: '11-25', end: '11-30', impact: 0.35, name: 'Black Friday / Cyber Monday' },
    ],
    '12': [
        { start: '12-01', end: '12-20', impact: 0.25, name: 'Holiday Shopping' },
        { start: '12-21', end: '12-25', impact: 0.15, name: 'Last Minute Shopping' },
        { start: '12-26', end: '12-31', impact: -0.1, name: 'Post-Holiday Slump' },
    ],
};

// Day of week performance modifiers
const DAY_MODIFIERS: Record<number, number> = {
    0: -0.05,  // Sunday - lower business engagement
    1: 0.05,   // Monday - fresh start
    2: 0.08,   // Tuesday - peak engagement
    3: 0.1,    // Wednesday - highest engagement
    4: 0.08,   // Thursday - still strong
    5: -0.03,  // Friday - weekend mode
    6: -0.08,  // Saturday - lowest engagement
};

// Time of day modifiers (hour in 24h format)
const HOUR_MODIFIERS: Record<number, number> = {
    0: -0.2, 1: -0.25, 2: -0.25, 3: -0.2, 4: -0.15, 5: -0.1,
    6: 0, 7: 0.05, 8: 0.1, 9: 0.12, 10: 0.15, 11: 0.12,
    12: 0.1, 13: 0.08, 14: 0.1, 15: 0.08, 16: 0.05, 17: 0.1,
    18: 0.15, 19: 0.18, 20: 0.2, 21: 0.15, 22: 0.05, 23: -0.1,
};

// Monthly trend modifiers (general ad performance by month)
const MONTH_MODIFIERS: Record<number, number> = {
    1: -0.1,   // January - post-holiday budget cuts
    2: 0,      // February - normalizing
    3: 0.05,   // March - spring pickup
    4: 0.05,   // April
    5: 0.08,   // May - pre-summer
    6: -0.05,  // June - summer slump starts
    7: -0.1,   // July - vacation mode
    8: 0.05,   // August - back to school
    9: 0.1,    // September - Q4 prep
    10: 0.15,  // October - Q4 ramp
    11: 0.25,  // November - peak season
    12: 0.15,  // December - holiday shopping
};

/**
 * Check if date falls within a holiday period
 */
function getCurrentHoliday(date: Date): { name: string; impact: number } | null {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${month}-${day}`;

    const monthHolidays = HOLIDAYS[month] || [];

    for (const holiday of monthHolidays) {
        if (dateStr >= holiday.start && dateStr <= holiday.end) {
            return { name: holiday.name, impact: holiday.impact };
        }
    }

    return null;
}

/**
 * Get seasonality adjustment for a specific date
 */
export function getSeasonalityAdjustment(date: Date = new Date()): {
    totalAdjustment: number;
    factors: { name: string; adjustment: number }[];
} {
    const factors: { name: string; adjustment: number }[] = [];
    let totalAdjustment = 0;

    // Check holiday
    const holiday = getCurrentHoliday(date);
    if (holiday) {
        factors.push({ name: holiday.name, adjustment: holiday.impact });
        totalAdjustment += holiday.impact;
    }

    // Day of week
    const dayMod = DAY_MODIFIERS[date.getDay()];
    factors.push({ name: getDayName(date.getDay()), adjustment: dayMod });
    totalAdjustment += dayMod;

    // Time of day
    const hourMod = HOUR_MODIFIERS[date.getHours()];
    factors.push({ name: getTimeOfDayName(date.getHours()), adjustment: hourMod });
    totalAdjustment += hourMod;

    // Monthly trend
    const monthMod = MONTH_MODIFIERS[date.getMonth() + 1];
    factors.push({ name: getMonthName(date.getMonth()), adjustment: monthMod });
    totalAdjustment += monthMod;

    return {
        totalAdjustment: Math.round(totalAdjustment * 100) / 100,
        factors
    };
}

/**
 * Apply seasonality adjustment to a prediction score
 */
export function applySeasonalityAdjustment(baseScore: number, date: Date = new Date()): {
    adjustedScore: number;
    adjustment: number;
    factors: { name: string; adjustment: number }[];
} {
    const { totalAdjustment, factors } = getSeasonalityAdjustment(date);

    // Convert adjustment to score points (e.g., 0.1 = +10 points)
    const scoreAdjustment = Math.round(totalAdjustment * 100);

    // Apply adjustment but keep within 0-100 range
    const adjustedScore = Math.max(0, Math.min(100, baseScore + scoreAdjustment));

    return {
        adjustedScore,
        adjustment: scoreAdjustment,
        factors
    };
}

/**
 * Get best time to launch based on current seasonality
 */
export function getBestLaunchWindow(daysAhead: number = 7): {
    bestDate: Date;
    bestScore: number;
    worstDate: Date;
    worstScore: number;
    recommendations: string[];
}[] {
    const recommendations: string[] = [];
    const scores: { date: Date; score: number }[] = [];

    const now = new Date();

    for (let d = 0; d < daysAhead; d++) {
        const checkDate = new Date(now);
        checkDate.setDate(now.getDate() + d);

        // Check multiple times of day
        for (const hour of [9, 12, 15, 18, 21]) {
            checkDate.setHours(hour, 0, 0, 0);
            const { totalAdjustment } = getSeasonalityAdjustment(checkDate);
            scores.push({ date: new Date(checkDate), score: totalAdjustment });
        }
    }

    // Sort by score
    scores.sort((a, b) => b.score - a.score);

    const best = scores[0];
    const worst = scores[scores.length - 1];

    // Generate recommendations
    const holiday = getCurrentHoliday(new Date());
    if (holiday && holiday.impact > 0.1) {
        recommendations.push(`📈 Good time to launch! ${holiday.name} increases engagement by ${Math.round(holiday.impact * 100)}%`);
    } else if (holiday && holiday.impact < -0.1) {
        recommendations.push(`⚠️ Consider delaying - ${holiday.name} typically sees ${Math.round(Math.abs(holiday.impact) * 100)}% lower engagement`);
    }

    return [{
        bestDate: best.date,
        bestScore: Math.round(best.score * 100),
        worstDate: worst.date,
        worstScore: Math.round(worst.score * 100),
        recommendations
    }];
}

// Helper functions
function getDayName(day: number): string {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
}

function getTimeOfDayName(hour: number): string {
    if (hour < 6) return 'Late Night';
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    if (hour < 21) return 'Evening';
    return 'Night';
}

function getMonthName(month: number): string {
    return ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'][month];
}

/**
 * Check if we're in a peak advertising season
 */
export function isPeakSeason(): boolean {
    const month = new Date().getMonth() + 1;
    return month >= 10 && month <= 12; // Oct-Dec is peak
}

/**
 * Get upcoming important dates for advertising
 */
export function getUpcomingEvents(daysAhead: number = 30): { date: string; name: string; impact: number }[] {
    const events: { date: string; name: string; impact: number }[] = [];
    const now = new Date();

    for (let d = 0; d < daysAhead; d++) {
        const checkDate = new Date(now);
        checkDate.setDate(now.getDate() + d);

        const holiday = getCurrentHoliday(checkDate);
        if (holiday) {
            const dateStr = checkDate.toISOString().split('T')[0];
            // Avoid duplicates
            if (!events.find(e => e.name === holiday.name)) {
                events.push({
                    date: dateStr,
                    name: holiday.name,
                    impact: holiday.impact
                });
            }
        }
    }

    return events;
}

export default {
    getSeasonalityAdjustment,
    applySeasonalityAdjustment,
    getBestLaunchWindow,
    isPeakSeason,
    getUpcomingEvents
};
