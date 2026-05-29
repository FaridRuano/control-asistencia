import mongoose, { Schema } from "mongoose";

const normalizedEmployeeSchema = new Schema(
  {
    biometricCode: { type: String, default: "" },
    fullName: { type: String, default: "" },
    branchCode: { type: String, default: "" },
    branchName: { type: String, default: "" },
    department: { type: String, default: "" },
    punchCount: { type: Number, default: 0 },
    punches: [
      {
        punchedAt: { type: Date, required: true },
        rawValue: { type: String, default: "" },
      },
    ],
  },
  { _id: false },
);

const attendanceUploadSchema = new Schema(
  {
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      trim: true,
      default: "",
    },
    fileSize: {
      type: Number,
      default: 0,
      min: 0,
    },
    originalFile: {
      type: Buffer,
      required: true,
    },
    branchCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    branchName: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    month: {
      type: Number,
      min: 1,
      max: 12,
      default: null,
    },
    year: {
      type: Number,
      min: 2000,
      default: null,
    },
    status: {
      type: String,
      enum: ["uploaded", "processing", "processed", "failed"],
      default: "uploaded",
    },
    totalEmployees: {
      type: Number,
      default: 0,
    },
    totalPunches: {
      type: Number,
      default: 0,
    },
    normalizedSnapshot: {
      summary: {
        totalEmployees: { type: Number, default: 0 },
        totalPunches: { type: Number, default: 0 },
        month: { type: Number, default: null },
        year: { type: Number, default: null },
      },
      employees: {
        type: [normalizedEmployeeSchema],
        default: [],
      },
      parserLogs: {
        type: [String],
        default: [],
      },
    },
    normalizedAt: {
      type: Date,
      default: null,
    },
    punchesPublishedAt: {
      type: Date,
      default: null,
    },
    publishedEmployees: {
      type: Number,
      default: 0,
    },
    publishedPunches: {
      type: Number,
      default: 0,
    },
    skippedDuplicatePunches: {
      type: Number,
      default: 0,
    },
    skippedUnmatchedEmployees: {
      type: Number,
      default: 0,
    },
    skippedUnmatchedPunches: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

const AttendanceUpload =
  mongoose.models.AttendanceUpload ||
  mongoose.model("AttendanceUpload", attendanceUploadSchema);

export default AttendanceUpload;
