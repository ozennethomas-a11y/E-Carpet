export const STRIPE_API = "https://api.stripe.com/v1";

export function stripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY || null;
}

// Stripe attend un encodage x-www-form-urlencoded avec des clés en notation
// crochets pour les tableaux/objets imbriqués (line_items[0][price]=...).
export function toForm(obj, form = new URLSearchParams(), prefix = "") {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        const itemKey = `${key}[${i}]`;
        if (item !== null && typeof item === "object") toForm(item, form, itemKey);
        else form.append(itemKey, String(item));
      });
    } else if (typeof v === "object") {
      toForm(v, form, key);
    } else {
      form.append(key, String(v));
    }
  }
  return form;
}

export async function stripeRequest(path, body, key, { method = "POST" } = {}) {
  const url = method === "GET" && body ? `${STRIPE_API}${path}?${toForm(body)}` : `${STRIPE_API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: method === "GET" ? undefined : toForm(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || "échec de la requête Stripe");
  return json;
}
