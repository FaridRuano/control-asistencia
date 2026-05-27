import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import connectToDatabase from "@/lib/db/mongodb";
import {
  DEFAULT_LABOR_RULE_CONFIG,
  LABOR_RULE_CONFIG_KEY,
  normalizeLaborRuleConfigPayload,
  serializeLaborRuleConfig,
} from "@/lib/planning/laborRules";
import LaborRuleConfig from "@/models/LaborRuleConfig";

export async function GET() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesion invalida o expirada." }, { status: 401 });
  }

  await connectToDatabase();

  const config = await LaborRuleConfig.findOneAndUpdate(
    { key: LABOR_RULE_CONFIG_KEY },
    {
      $setOnInsert: DEFAULT_LABOR_RULE_CONFIG,
      $unset: {
        mandatoryWeeklyRestDays: "",
        holidayWorkedMultiplier: "",
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).lean();

  return NextResponse.json({
    rules: serializeLaborRuleConfig(config),
    source: "saved",
  });
}

export async function PUT(request) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Sesion invalida o expirada." }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const body = await request.json();
    const payload = normalizeLaborRuleConfigPayload(body);
    const config = await LaborRuleConfig.findOneAndUpdate(
      { key: LABOR_RULE_CONFIG_KEY },
      {
        $set: payload,
        $unset: {
          mandatoryWeeklyRestDays: "",
          holidayWorkedMultiplier: "",
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    return NextResponse.json({
      message: "Reglas laborales guardadas correctamente.",
      rules: serializeLaborRuleConfig(config),
      source: "saved",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "No se pudieron guardar las reglas laborales." },
      { status: 400 },
    );
  }
}
