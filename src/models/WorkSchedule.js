import mongoose, { Schema } from "mongoose";

const workScheduleSchema = new Schema(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
    },
    startTime: {
      type: String,
      required: true,
      trim: true,
    },
    lunchStartTime: {
      type: String,
      trim: true,
      default: "",
    },
    lunchEndTime: {
      type: String,
      trim: true,
      default: "",
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
    },
    graceMinutes: {
      type: Number,
      default: 10,
      min: 0,
    },
    isWorkingDay: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

workScheduleSchema.index({ employee: 1, dayOfWeek: 1 }, { unique: true });

const WorkSchedule =
  mongoose.models.WorkSchedule ||
  mongoose.model("WorkSchedule", workScheduleSchema);

export default WorkSchedule;
