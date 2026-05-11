import mongoose, { Schema } from "mongoose";

const attendanceUploadSchema = new Schema(
  {
    fileName: {
      type: String,
      required: true,
      trim: true,
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
      enum: ["processing", "processed", "failed"],
      default: "processing",
    },
    totalEmployees: {
      type: Number,
      default: 0,
    },
    totalPunches: {
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
