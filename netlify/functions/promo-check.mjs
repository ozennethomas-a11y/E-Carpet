import { findValidPromo, computeDiscountCents } from "./_promo.mjs";
import { checkAndRecord } from "./_rateLimit.mjs";

export default async (req, context) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const subtotalCents = Number(url.searchParams.get("subtotal") || 0);

  const limite = await checkAndRecord("promo-check", req, context, { max: 30, windowMs: 10 * 60 * 1000 });
  if (limite.limited) return Response.json({ valid: false, error: "trop de tentatives, réessayez plus tard" }, { status: 429 });

  const result = await findValidPromo(code);
  if (result.error) return Response.json({ valid: false, error: result.error });

  const discountCents = computeDiscountCents(result.row, subtotalCents);
  return Response.json({
    valid: true,
    code: result.row.code,
    type: result.row.type,
    value: result.row.value,
    discountCents,
  });
};

export const config = { path: "/api/promo-check" };
