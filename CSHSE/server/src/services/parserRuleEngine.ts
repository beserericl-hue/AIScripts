/**
 * parserRuleEngine — the realtime consultation layer (CR-073).
 *
 * At import start the server asks: "is there an ACTIVE parser rule the superuser
 * approved in Parser Train that should steer THIS institution's parse?" Today the
 * one steer the engine applies is a per-institution `forceFormat` override
 * (extract.forceFormat) — the smallest useful realtime lever, and the one the
 * Parser Train loop demonstrates end-to-end.
 *
 * DEFAULT-PRESERVING BY CONSTRUCTION: if the caller already passed an explicit
 * forceFormat, that wins; and with zero matching active rules the caller's value
 * is returned unchanged. The proven baseline (MCC/AACC/Kennesaw, and every real
 * institution) therefore parses EXACTLY as before — a rule only ever affects the
 * institution it is scoped to, and only when the SU has activated it.
 */
import { ParserRule } from '../models/ParserRule';

type Fmt = 'template' | 'self_study' | 'mcc_narrative' | null | undefined;

/**
 * Resolve the effective forceFormat for an import.
 * @param institutionId  the importing institution (rules are institution-scoped)
 * @param programLevel   associate|bachelors|masters (a rule may narrow to a level)
 * @param explicit       forceFormat the caller already chose (null = auto-detect)
 */
export async function resolveForceFormat(
  institutionId: string | undefined,
  programLevel: string | undefined,
  explicit: Fmt
): Promise<{ forceFormat: Fmt; appliedRuleId?: string }> {
  // An explicit caller choice is never overridden by a rule.
  if (explicit) return { forceFormat: explicit };
  if (!institutionId) return { forceFormat: explicit };

  try {
    const rules = await ParserRule.find({
      status: 'active',
      'scope.level': 'institution',
      'scope.institutionId': institutionId,
    })
      .sort({ confidence: -1, updatedAt: -1 })
      .lean();

    for (const r of rules as any[]) {
      const ff = r?.extract?.forceFormat;
      const lvl = r?.scope?.programLevel;
      if (lvl && programLevel && lvl !== programLevel) continue;
      if (ff === 'template' || ff === 'self_study' || ff === 'mcc_narrative') {
        // best-effort metric bump; never let it block the import
        ParserRule.updateOne({ _id: r._id }, { $inc: { 'metrics.appliedCount': 1 } }).catch(() => {});
        return { forceFormat: ff, appliedRuleId: r.ruleId };
      }
    }
  } catch (err) {
    console.error('[parserRuleEngine] resolveForceFormat failed (falling back to explicit):', err);
  }
  return { forceFormat: explicit };
}
