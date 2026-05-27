import mongoose, { Schema } from "mongoose";

const operationalExceptionSchema = new Schema(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    employeeName: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    employeeDni: {
      type: String,
      trim: true,
      default: "",
    },
    branchName: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    areaName: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    roleName: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    type: {
      type: String,
      enum: ["absence", "sick_leave", "permission", "schedule_change", "replacement", "other"],
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    dateKey: {
      type: String,
      required: true,
      trim: true,
    },
    endDate: {
      type: Date,
      default: null,
    },
    endDateKey: {
      type: String,
      trim: true,
      default: "",
    },
    registeredBy: {
      type: String,
      trim: true,
      uppercase: true,
      required: true,
    },
    authorizedBy: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    resolution: {
      type: String,
      enum: ["pending", "discount_day", "paid_leave", "reschedule", "replacement", "no_action", "other"],
      default: "pending",
    },
    resolutionNotes: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["open", "resolved", "void"],
      default: "open",
    },
  },
  {
    timestamps: true,
  },
);

operationalExceptionSchema.index({ employee: 1, date: 1 });
operationalExceptionSchema.index({ date: 1, status: 1 });
operationalExceptionSchema.index({ type: 1, resolution: 1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.OperationalException) {
  delete mongoose.models.OperationalException;
}

const OperationalException =
  mongoose.models.OperationalException ||
  mongoose.model("OperationalException", operationalExceptionSchema);

export default OperationalException;
