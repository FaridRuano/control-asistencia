import * as XLSX from "xlsx";
import {
  eachDayOfInterval,
  endOfMonth,
  isValid,
  parse,
  parseISO,
  set,
  startOfDay,
  startOfMonth,
} from "date-fns";

const MONTH_INDEXES = {
  enero: 1,
  feb: 2,
  febrero: 2,
  mar: 3,
  marzo: 3,
  abr: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  jul: 7,
  julio: 7,
  ago: 8,
  agosto: 8,
  sep: 9,
  sept: 9,
  septiembre: 9,
  oct: 10,
  octubre: 10,
  nov: 11,
  noviembre: 11,
  dic: 12,
  diciembre: 12,
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function sheetToMatrix(sheet) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
  const rows = [];

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const row = [];

    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = sheet[address];

      row.push({
        address,
        rowIndex,
        columnIndex,
        value: cell?.v ?? null,
        text: cell ? String(XLSX.utils.format_cell(cell) || "").trim() : "",
        type: cell?.t || null,
        format: cell?.z || "",
      });
    }

    rows.push(row);
  }

  return rows;
}

function findValueNextToLabel(row, labelMatcher) {
  for (let index = 0; index < row.length; index += 1) {
    const label = normalizeText(row[index].text);

    if (!labelMatcher(label)) {
      continue;
    }

    for (let offset = 1; offset <= 3; offset += 1) {
      const candidate = row[index + offset];
      const candidateText = candidate?.text?.trim();

      if (candidateText) {
        return candidateText;
      }
    }
  }

  return "";
}

function extractEmployeeMeta(blockRows) {
  const meta = {
    biometricCode: "",
    name: "",
    department: "",
  };

  for (const row of blockRows.slice(0, 5)) {
    if (!meta.biometricCode) {
      meta.biometricCode = findValueNextToLabel(
        row,
        (label) =>
          /^(id|codigo|code|emp id|employee id|no\.)$/.test(label) ||
          label.includes("biometric") ||
          label.includes("reloj"),
      );
    }

    if (!meta.name) {
      meta.name = findValueNextToLabel(
        row,
        (label) =>
          label === "nombre" ||
          label === "name" ||
          label.includes("employee name") ||
          label.includes("empleado"),
      );
    }

    if (!meta.department) {
      meta.department = findValueNextToLabel(
        row,
        (label) =>
          label === "departamento" ||
          label === "department" ||
          label.includes("area"),
      );
    }
  }

  if (!meta.biometricCode) {
    const rowText = blockRows
      .slice(0, 3)
      .flat()
      .map((cell) => cell.text)
      .join(" ");
    const codeMatch = rowText.match(/\b\d{3,}\b/);

    if (codeMatch) {
      meta.biometricCode = codeMatch[0];
    }
  }

  return meta;
}

function looksLikeEmployeeRow(row) {
  const text = row.map((cell) => normalizeText(cell.text)).filter(Boolean);
  const joined = text.join(" | ");

  const hasId = /(id|codigo|code|biometric|reloj)/.test(joined);
  const hasName = /(nombre|name|empleado|employee)/.test(joined);

  return hasId && hasName;
}

function inferPeriodContext(rows, sheetName, fileName) {
  const haystack = `${sheetName} ${fileName} ${rows
    .slice(0, 8)
    .flat()
    .map((cell) => cell.text)
    .join(" ")}`;

  const normalized = normalizeText(haystack);
  const yearMatch = normalized.match(/\b(20\d{2})\b/);
  const monthEntry = Object.entries(MONTH_INDEXES).find(([token]) =>
    normalized.includes(token),
  );

  return {
    year: yearMatch ? Number(yearMatch[1]) : null,
    month: monthEntry ? monthEntry[1] : null,
  };
}

function classifyCell(cell) {
  const text = cell.text?.trim();
  const value = cell.value;

  if (!text && value == null) {
    return { kind: "empty", rawText: "" };
  }

  if (value instanceof Date && isValid(value)) {
    const hasTime =
      value.getHours() !== 0 || value.getMinutes() !== 0 || value.getSeconds() !== 0;

    return {
      kind: hasTime ? "datetime" : "date",
      date: value,
      rawText: text,
    };
  }

  if (typeof value === "number") {
    const parsedCode = XLSX.SSF.parse_date_code(value);

    if (parsedCode) {
      const builtDate = new Date(
        parsedCode.y || 1899,
        Math.max((parsedCode.m || 1) - 1, 0),
        parsedCode.d || 1,
        parsedCode.H || 0,
        parsedCode.M || 0,
        Math.floor(parsedCode.S || 0),
      );
      const hasCalendarDate = parsedCode.y && parsedCode.y > 1900;
      const hasTime =
        (parsedCode.H || 0) > 0 || (parsedCode.M || 0) > 0 || (parsedCode.S || 0) > 0;

      if (hasCalendarDate && hasTime) {
        return { kind: "datetime", date: builtDate, rawText: text || String(value) };
      }

      if (hasCalendarDate) {
        return { kind: "date", date: startOfDay(builtDate), rawText: text || String(value) };
      }

      if (hasTime || value < 1) {
        return { kind: "time", time: text || formatExcelTime(value), rawText: text || String(value) };
      }
    }
  }

  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) {
    return { kind: "time", time: text.slice(0, 5), rawText: text };
  }

  const combinedDateTime = tryParseDateTime(text);

  if (combinedDateTime) {
    const hasTime =
      combinedDateTime.getHours() !== 0 ||
      combinedDateTime.getMinutes() !== 0 ||
      combinedDateTime.getSeconds() !== 0;

    return {
      kind: hasTime ? "datetime" : "date",
      date: hasTime ? combinedDateTime : startOfDay(combinedDateTime),
      rawText: text,
    };
  }

  return { kind: "text", rawText: text };
}

function formatExcelTime(serialValue) {
  const totalMinutes = Math.round(((serialValue % 1) * 24 * 60) % (24 * 60));
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function tryParseDateTime(value) {
  if (!value) {
    return null;
  }

  const formats = [
    "dd/MM/yyyy HH:mm:ss",
    "dd/MM/yyyy HH:mm",
    "MM/dd/yyyy HH:mm:ss",
    "MM/dd/yyyy HH:mm",
    "yyyy-MM-dd HH:mm:ss",
    "yyyy-MM-dd HH:mm",
    "dd-MM-yyyy HH:mm",
    "dd/MM/yyyy",
    "MM/dd/yyyy",
    "yyyy-MM-dd",
    "dd-MM-yyyy",
  ];

  for (const dateFormat of formats) {
    const parsed = parse(value, dateFormat, new Date());

    if (isValid(parsed)) {
      return parsed;
    }
  }

  const isoParsed = parseISO(value);
  return isValid(isoParsed) ? isoParsed : null;
}

function buildDayNumberAnchors(blockRows, period) {
  const anchors = new Map();

  if (!period.month || !period.year) {
    return anchors;
  }

  const validDays = eachDayOfInterval({
    start: startOfMonth(new Date(period.year, period.month - 1, 1)),
    end: endOfMonth(new Date(period.year, period.month - 1, 1)),
  }).map((date) => date.getDate());

  for (const row of blockRows) {
    for (const cell of row) {
      const numeric = Number(cell.text);

      if (!Number.isInteger(numeric) || !validDays.includes(numeric)) {
        continue;
      }

      if (!anchors.has(cell.columnIndex)) {
        anchors.set(cell.columnIndex, new Date(period.year, period.month - 1, numeric));
      }
    }
  }

  return anchors;
}

function extractPunchesFromBlock(blockRows, period, logs, employeeLabel) {
  const columnDateAnchors = new Map();
  const dayNumberAnchors = buildDayNumberAnchors(blockRows, period);
  const punches = [];
  const seenTimestamps = new Set();

  for (const row of blockRows) {
    for (const cell of row) {
      const classified = classifyCell(cell);

      if (classified.kind === "date") {
        if (!columnDateAnchors.has(cell.columnIndex)) {
          columnDateAnchors.set(cell.columnIndex, startOfDay(classified.date));
        }
        continue;
      }

      if (classified.kind === "datetime") {
        const stamp = classified.date.toISOString();

        if (!seenTimestamps.has(stamp)) {
          punches.push({
            punchedAt: classified.date,
            rawValue: classified.rawText || stamp,
          });
          seenTimestamps.add(stamp);
        }
      }
    }
  }

  for (const row of blockRows) {
    for (const cell of row) {
      const classified = classifyCell(cell);

      if (classified.kind !== "time") {
        continue;
      }

      const anchor =
        columnDateAnchors.get(cell.columnIndex) ||
        dayNumberAnchors.get(cell.columnIndex) ||
        columnDateAnchors.get(cell.columnIndex - 1) ||
        dayNumberAnchors.get(cell.columnIndex - 1) ||
        columnDateAnchors.get(cell.columnIndex + 1) ||
        dayNumberAnchors.get(cell.columnIndex + 1);

      if (!anchor) {
        logs.push(
          `No se encontró fecha ancla para la hora "${classified.time}" en ${employeeLabel} (${cell.address}).`,
        );
        continue;
      }

      const [hours, minutes] = classified.time.split(":").map(Number);
      const punchedAt = set(anchor, {
        hours,
        minutes,
        seconds: 0,
        milliseconds: 0,
      });
      const stamp = punchedAt.toISOString();

      if (!seenTimestamps.has(stamp)) {
        punches.push({
          punchedAt,
          rawValue: classified.rawText || classified.time,
        });
        seenTimestamps.add(stamp);
      }
    }
  }

  return punches.sort(
    (left, right) => left.punchedAt.getTime() - right.punchedAt.getTime(),
  );
}

export default function parseAttendanceFile({ buffer, fileName }) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    dense: false,
  });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = sheetToMatrix(sheet);
  const period = inferPeriodContext(rows, sheetName, fileName);
  const logs = [];
  const blocks = [];
  let currentBlock = [];

  rows.forEach((row, rowIndex) => {
    const isEmployeeRow = looksLikeEmployeeRow(row);

    if (isEmployeeRow && currentBlock.length) {
      blocks.push(currentBlock);
      currentBlock = [];
    }

    if (isEmployeeRow || currentBlock.length) {
      currentBlock.push(row);
    } else if (rowIndex === rows.length - 1 && currentBlock.length) {
      blocks.push(currentBlock);
      currentBlock = [];
    }
  });

  if (currentBlock.length) {
    blocks.push(currentBlock);
  }

  if (!blocks.length) {
    logs.push(
      "No se detectaron bloques de empleados con la heurística actual. Revisa el formato real del reporte para ajustar los labels.",
    );
  }

  const employees = blocks
    .map((blockRows, index) => {
      const metadata = extractEmployeeMeta(blockRows);
      const employeeLabel =
        metadata.name || metadata.biometricCode || `bloque ${index + 1}`;
      const punches = extractPunchesFromBlock(
        blockRows,
        period,
        logs,
        employeeLabel,
      );

      if (!metadata.biometricCode || !metadata.name) {
        logs.push(
          `El ${employeeLabel} no tiene metadata completa; se intentará guardar con los valores detectados.`,
        );
      }

      return {
        biometricCode: metadata.biometricCode || `UNMAPPED-${index + 1}`,
        name: metadata.name || `Empleado detectado ${index + 1}`,
        department: metadata.department || "",
        punches,
      };
    })
    .filter((employee) => employee.punches.length > 0 || employee.biometricCode);

  const totalPunches = employees.reduce(
    (sum, employee) => sum + employee.punches.length,
    0,
  );

  return {
    sheetName,
    month: period.month,
    year: period.year,
    employees,
    logs,
    totalPunches,
  };
}
