export type ConditionOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "exists";

function isNumeric(value: string) {
  return /^-?\d+(\.\d+)?$/.test(value.trim());
}

function applyVars(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, raw: string) => {
    const key = raw.trim();
    if (key.startsWith("context.")) {
      return vars[key.slice("context.".length)] ?? vars[key] ?? "";
    }
    return vars[key] ?? "";
  });
}

export function evaluateCondition(options: {
  leftRaw: string;
  op: ConditionOp | string;
  rightRaw: string;
  vars: Record<string, string>;
}): { ok: boolean; left: string; right: string; route: "true" | "false" } {
  const left = applyVars(options.leftRaw || "", options.vars).trim();
  const right = applyVars(options.rightRaw || "", options.vars).trim();
  const op = (options.op || "eq") as ConditionOp;
  const numeric = isNumeric(left) && isNumeric(right);
  const ln = Number(left);
  const rn = Number(right);

  let ok = false;
  switch (op) {
    case "exists":
      ok = left.length > 0;
      break;
    case "contains":
      ok = left.toLowerCase().includes(right.toLowerCase());
      break;
    case "eq":
      ok = numeric ? ln === rn : left === right;
      break;
    case "neq":
      ok = numeric ? ln !== rn : left !== right;
      break;
    case "gt":
      ok = numeric ? ln > rn : left > right;
      break;
    case "gte":
      ok = numeric ? ln >= rn : left >= right;
      break;
    case "lt":
      ok = numeric ? ln < rn : left < right;
      break;
    case "lte":
      ok = numeric ? ln <= rn : left <= right;
      break;
    default:
      ok = left === right;
  }

  return { ok, left, right, route: ok ? "true" : "false" };
}
