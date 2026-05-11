import mongoose, { Schema } from "mongoose";

const attendancePunchSchema = new Schema(
  {
    upload: {
      type: Schema.Types.ObjectId,
      ref: "AttendanceUpload",
      required: true,
    },
    employee: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    punchedAt: {
      type: Date,
      required: true,
    },
    rawValue: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

attendancePunchSchema.index({ employee: 1, punchedAt: 1 });

const AttendancePunch =
  mongoose.models.AttendancePunch ||
  mongoose.model("AttendancePunch", attendancePunchSchema);

export default AttendancePunch;
