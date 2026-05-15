import mongoose, { Schema } from "mongoose";

const auditLogSchema = new Schema(
  {
    actor: {
      type: String,
      required: true,
      trim: true,
      default: "admin",
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    entityType: {
      type: String,
      required: true,
      trim: true,
    },
    entityId: {
      type: String,
      trim: true,
      default: "",
    },
    entityLabel: {
      type: String,
      trim: true,
      default: "",
    },
    route: {
      type: String,
      trim: true,
      default: "",
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    happenedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

auditLogSchema.index({ entityType: 1, entityId: 1, happenedAt: -1 });
auditLogSchema.index({ action: 1, happenedAt: -1 });
auditLogSchema.index({ actor: 1, happenedAt: -1 });

const AuditLog =
  mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
