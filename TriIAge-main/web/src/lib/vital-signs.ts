import type { VitalSigns } from "./triage-types";

// Campos e faixas de referência dos sinais vitais (RF03, RF04). As faixas
// são provisórias e ficam no front até a API expor FaixaReferencia.

export type VitalField = {
  key: keyof VitalSigns;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  /** abaixo de low ou acima de high gera alerta */
  low?: number;
  high?: number;
};

export const VITAL_FIELDS: VitalField[] = [
  { key: "systolic_bp", label: "PA sistólica", unit: "mmHg", min: 40, max: 300, step: 1, low: 90, high: 180 },
  { key: "diastolic_bp", label: "PA diastólica", unit: "mmHg", min: 20, max: 200, step: 1, high: 120 },
  { key: "heart_rate", label: "Freq. cardíaca", unit: "bpm", min: 20, max: 250, step: 1, low: 50, high: 120 },
  { key: "respiratory_rate", label: "Freq. respiratória", unit: "irpm", min: 4, max: 80, step: 1, low: 10, high: 24 },
  { key: "temperature", label: "Temperatura", unit: "°C", min: 30, max: 45, step: 0.1, low: 35, high: 39 },
  { key: "oxygen_saturation", label: "SpO₂", unit: "%", min: 50, max: 100, step: 1, low: 90 },
];

export type VitalAlert = { key: keyof VitalSigns; message: string };

export function criticalAlerts(vitals: VitalSigns): VitalAlert[] {
  return VITAL_FIELDS.flatMap((field) => {
    const value = vitals[field.key];
    if (value === undefined) return [];
    const reading = `${field.label} ${value} ${field.unit}`;
    if (field.low !== undefined && value < field.low) {
      return [{ key: field.key, message: `${reading}: abaixo de ${field.low}` }];
    }
    if (field.high !== undefined && value > field.high) {
      return [{ key: field.key, message: `${reading}: acima de ${field.high}` }];
    }
    return [];
  });
}
