import mongoose, { Schema } from "mongoose";

const employeeSchema = new Schema(
  {
    biometricCode: {
      type: String,
      trim: true,
      default: "",
    },
    fullName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    salary: {
      type: Number,
      default: 0,
      min: 0,
    },
    branch: {
      type: String,
      enum: ["AMBATO", "SALCEDO"],
      default: "AMBATO",
    },
    department: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

employeeSchema.index(
  { biometricCode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      biometricCode: { $type: "string", $ne: "" },
    },
  },
);

const Employee =
  mongoose.models.Employee || mongoose.model("Employee", employeeSchema);

export default Employee;
