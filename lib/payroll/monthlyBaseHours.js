import { eachDayOfInterval, endOfMonth, format, startOfMonth } from "date-fns";

import Holiday from "@/models/Holiday";

function isWeekday(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function getMonthBoundaryKeys(monthKey) {
  return {
    from: `${monthKey}-01`,
    to: `${monthKey}-31`,
  };
}

export async function resolveMonthlyBaseHours({
  monthKey,
  year,
  monthIndex,
  dailyBaseHours = 8,
}) {
  const safeDailyBaseHours = Math.max(Number(dailyBaseHours) || 8, 1);
  const { from, to } = getMonthBoundaryKeys(monthKey);
  const holidays = await Holiday.find({
    dateKey: {
      $gte: from,
      $lte: to,
    },
  })
    .select({ dateKey: 1 })
    .lean();
  const holidayKeys = new Set(holidays.map((holiday) => holiday.dateKey));
  const days = eachDayOfInterval({
    start: startOfMonth(new Date(year, monthIndex, 1)),
    end: endOfMonth(new Date(year, monthIndex, 1)),
  });
  const laborableDays = days.filter((date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    return isWeekday(date) && !holidayKeys.has(dateKey);
  }).length;
  const hourlyDivisor = Math.max(laborableDays * safeDailyBaseHours, safeDailyBaseHours);

  return {
    laborableDays,
    dailyBaseHours: safeDailyBaseHours,
    hourlyDivisor,
    holidayDateKeys: [...holidayKeys].sort(),
  };
}
