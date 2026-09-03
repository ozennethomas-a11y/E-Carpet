import { boolean, integer, jsonb, numeric, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  priceCents: integer('price_cents').notNull(),
  currency: text('currency').notNull().default('eur'),
  stock: integer('stock').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  phone: text('phone'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  // Opt-out des emails marketing (Black Friday, Noël, promos...). false par
  // défaut : un client ayant déjà commandé peut recevoir des offres sur des
  // produits similaires sans consentement explicite préalable (article
  // L.34-5 du CPCE, "soft opt-in" clients existants), à condition de
  // toujours proposer un lien de désinscription — d'où ce champ.
  marketingOptOut: boolean('marketing_opt_out').notNull().default(false),
})

export const addresses = pgTable('addresses', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  label: text('label'),
  line1: text('line1').notNull(),
  line2: text('line2'),
  postalCode: text('postal_code').notNull(),
  city: text('city').notNull(),
  country: text('country').notNull().default('FR'),
})

// type : percent (value = 1-100) | fixed (value = centimes)
// source : null (créé manuellement) | avis_photo (récompense avis avec photo) | affilie (partenaire)
export const promoCodes = pgTable('promo_codes', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  type: text('type').notNull(),
  value: integer('value').notNull(),
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').notNull().default(0),
  expiresAt: timestamp('expires_at'),
  active: boolean('active').notNull().default(true),
  source: text('source'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// statut : en_attente_paiement | payee | expediee | livree | annulee | remboursee
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  // Numéro à 6 chiffres montré au client (factures, emails) : aléatoire et non
  // séquentiel, pour ne pas laisser deviner le volume de commandes.
  orderNumber: integer('order_number').notNull().unique(),
  customerId: integer('customer_id').references(() => customers.id),
  email: text('email').notNull(),
  status: text('status').notNull().default('en_attente_paiement'),
  totalCents: integer('total_cents').notNull(),
  currency: text('currency').notNull().default('eur'),
  shippingAddress: jsonb('shipping_address').notNull(),
  stripeSessionId: text('stripe_session_id'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  trackingNumber: text('tracking_number'),
  trackingCarrier: text('tracking_carrier'),
  shippedAt: timestamp('shipped_at'),
  packlinkDraftReference: text('packlink_draft_reference'),
  reviewRequestSentAt: timestamp('review_request_sent_at'),
  promoCodeId: integer('promo_code_id').references(() => promoCodes.id),
  discountCents: integer('discount_cents').notNull().default(0),
  affiliateId: integer('affiliate_id').references(() => affiliates.id),
  stripeFeeCents: integer('stripe_fee_cents'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  productId: integer('product_id').notNull().references(() => products.id),
  name: text('name').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  quantity: integer('quantity').notNull(),
})

// liens de connexion à usage unique envoyés par email (magic link)
export const loginTokens = pgTable('login_tokens', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Comptes du back-office : un par personne (mot de passe + TOTP propres à
// chacun), avec un indicateur "propriétaire" pour réserver certains écrans
// (ex. l'historique des connexions) au compte principal.
export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  totpSecret: text('totp_secret').notNull(),
  isOwner: boolean('is_owner').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const adminSessions = pgTable('admin_sessions', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id').notNull().references(() => admins.id),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Journal des connexions réussies au back-office, consultable uniquement par
// le propriétaire (admins.is_owner) pour savoir qui s'est connecté et quand.
export const adminLoginHistory = pgTable('admin_login_history', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id').notNull().references(() => admins.id),
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Clés Face ID / Touch ID (WebAuthn) enregistrées par appareil : une connexion
// biométrique par admin ne remplace pas mot de passe + TOTP, elle s'ajoute en
// option une fois activée sur un téléphone donné.
export const webauthnCredentials = pgTable('webauthn_credentials', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id').notNull().references(() => admins.id),
  credentialId: text('credential_id').notNull().unique(),
  publicKey: text('public_key').notNull(),
  counter: integer('counter').notNull().default(0),
  deviceName: text('device_name'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
})

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// paniers abandonnés, pour la relance marketing
export const carts = pgTable('carts', {
  id: serial('id').primaryKey(),
  token: text('token').notNull().unique(),
  email: text('email'),
  items: jsonb('items').notNull().default('[]'),
  reminderSentAt: timestamp('reminder_sent_at'),
  convertedAt: timestamp('converted_at'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// statut : en_attente | actif | refuse | suspendu
export const affiliates = pgTable('affiliates', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  social: text('social'),
  audience: text('audience'),
  message: text('message'),
  status: text('status').notNull().default('en_attente'),
  commissionPercent: integer('commission_percent').notNull().default(10),
  promoCodeId: integer('promo_code_id').references(() => promoCodes.id).unique(),
  campaignSlug: text('campaign_slug').unique(),
  stripeAccountId: text('stripe_account_id'),
  stripePayoutsEnabled: boolean('stripe_payouts_enabled').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const affiliateLoginTokens = pgTable('affiliate_login_tokens', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const affiliateSessions = pgTable('affiliate_sessions', {
  id: serial('id').primaryKey(),
  affiliateId: integer('affiliate_id').notNull().references(() => affiliates.id),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// statut : due | annulee | payee
export const affiliateCommissions = pgTable('affiliate_commissions', {
  id: serial('id').primaryKey(),
  affiliateId: integer('affiliate_id').notNull().references(() => affiliates.id),
  orderId: integer('order_id').notNull().references(() => orders.id).unique(),
  amountCents: integer('amount_cents').notNull(),
  status: text('status').notNull().default('due'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// statut : en_cours | effectue | echoue
export const affiliatePayouts = pgTable('affiliate_payouts', {
  id: serial('id').primaryKey(),
  affiliateId: integer('affiliate_id').notNull().references(() => affiliates.id),
  amountCents: integer('amount_cents').notNull(),
  stripeTransferId: text('stripe_transfer_id'),
  status: text('status').notNull().default('en_cours'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Historique du coût de revient d'un produit (change avec les tarifs
// fournisseurs) : pour une commande donnée, on utilise le coût dont
// effective_from est le plus récent sans dépasser la date de la commande.
export const productCosts = pgTable('product_costs', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id),
  unitCostCents: integer('unit_cost_cents').notNull(),
  effectiveFrom: timestamp('effective_from').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Décomposition du coût de revient par lot de fabrication (« Commande n°1 »,
// « Commande n°2 »...) — fabrication, transport, carton, audit... Chaque lot
// génère automatiquement une ligne product_costs (unitCostCents = somme des
// lignes / quantity) au moment de sa saisie, pour que le reste du site
// (finance.mjs, export Excel) continue à utiliser product_costs sans
// modification : cette table n'est que le détail justificatif derrière.
export const costBatches = pgTable('cost_batches', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id),
  label: text('label').notNull(),
  quantity: integer('quantity').notNull(),
  orderDate: timestamp('order_date').notNull(),
  productCostId: integer('product_cost_id').references(() => productCosts.id),
  // Mouvement de stock (entrée) généré automatiquement à la création du lot —
  // permet de l'annuler proprement si le lot est supprimé.
  stockMovementId: integer('stock_movement_id').references(() => stockMovements.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const costBatchLines = pgTable('cost_batch_lines', {
  id: serial('id').primaryKey(),
  batchId: integer('batch_id').notNull().references(() => costBatches.id),
  label: text('label').notNull(),
  amountCents: integer('amount_cents').notNull(),
})

// Dépenses hors vente, saisies manuellement (publicité, abonnements,
// conformité, transport...).
export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  category: text('category').notNull(),
  amountCents: integer('amount_cents').notNull(),
  expenseDate: timestamp('expense_date').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Journal des mouvements de stock, qui explique les variations de
// products.stock (déjà décrémenté automatiquement à chaque vente site par
// stripe-webhook.mjs). type : entree | sortie | initial (première saisie du
// stock réel par l'admin, sert de point de départ au journal).
// source : manuel | vente_site | vente_amazon | initial.
// orderId / externalRef permettent de dédupliquer : une commande site ou
// Amazon ne doit générer qu'une seule sortie, même si la synchronisation est
// relancée plusieurs fois.
export const stockMovements = pgTable('stock_movements', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id),
  type: text('type').notNull(),
  quantity: integer('quantity').notNull(),
  source: text('source').notNull().default('manuel'),
  unitCostCents: integer('unit_cost_cents'),
  movementDate: timestamp('movement_date').notNull().defaultNow(),
  note: text('note'),
  orderId: integer('order_id').references(() => orders.id),
  externalRef: text('external_ref'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Comptes réseaux sociaux connectés en OAuth, pour l'automatisation future des
// publications et publicités. Un seul compte connecté par réseau (unique).
// network : instagram | facebook | tiktok
// Les jetons sont chiffrés (AES-GCM, voir _socialCrypto.mjs) avant stockage :
// une fuite de la base ne doit pas exposer directement des accès valides.
export const socialAccounts = pgTable('social_accounts', {
  id: serial('id').primaryKey(),
  network: text('network').notNull().unique(),
  accountId: text('account_id'),
  accountName: text('account_name'),
  accessTokenEnc: text('access_token_enc').notNull(),
  refreshTokenEnc: text('refresh_token_enc'),
  expiresAt: timestamp('expires_at'),
  meta: jsonb('meta'),
  connectedAt: timestamp('connected_at').notNull().defaultNow(),
})

// Publications programmées : créées depuis l'admin, publiées plus tard par
// cron-social-publish.mjs. networks est un tableau JSON (ex: ["facebook","instagram"]).
// status : pending | published | failed. result stocke la réponse par réseau
// (même forme que { resultats } dans social-publish.mjs) une fois traité.
export const scheduledPosts = pgTable('scheduled_posts', {
  id: serial('id').primaryKey(),
  networks: jsonb('networks').notNull(),
  caption: text('caption').notNull().default(''),
  imageUrl: text('image_url'),
  videoUrl: text('video_url'),
  scheduledFor: timestamp('scheduled_for').notNull(),
  status: text('status').notNull().default('pending'),
  result: jsonb('result'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  publishedAt: timestamp('published_at'),
})

// Campagnes publicitaires créées depuis l'admin. Pour l'instant uniquement
// Meta (Facebook/Instagram, via l'API Marketing sur le compte publicitaire
// lié) — TikTok Ads nécessite une app "TikTok for Business Ads" distincte,
// non encore créée. network : facebook | instagram. status reflète le
// statut réel côté Meta (ACTIVE, PAUSED...), pas seulement notre intention.
export const socialCampaigns = pgTable('social_campaigns', {
  id: serial('id').primaryKey(),
  network: text('network').notNull(),
  externalId: text('external_id'),
  name: text('name').notNull(),
  objective: text('objective').notNull(),
  dailyBudgetCents: integer('daily_budget_cents').notNull(),
  postId: text('post_id'),
  status: text('status').notNull().default('pending'),
  error: text('error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Une ligne par envoi de campagne mailing (Black Friday, Noël...).
export const mailingCampaigns = pgTable('mailing_campaigns', {
  id: serial('id').primaryKey(),
  subject: text('subject').notNull(),
  recipientCount: integer('recipient_count').notNull().default(0),
  sentCount: integer('sent_count').notNull().default(0),
  sentAt: timestamp('sent_at').notNull().defaultNow(),
})

// Une ligne par destinataire d'une campagne, pour le suivi d'ouverture (pixel
// 1x1 chargé depuis mailing-pixel.mjs). openedAt reste null tant que le
// pixel n'a jamais été chargé.
export const mailingSends = pgTable('mailing_sends', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id').notNull().references(() => mailingCampaigns.id),
  email: text('email').notNull(),
  openedAt: timestamp('opened_at'),
})

// Abonnements aux notifications push "générales" du back-office (une ligne
// par appareil où un admin a activé les notifications) : nouvelle commande
// payée, etc. Libre : plusieurs appareils par admin, ajout/retrait sans
// restriction. Ne concerne PAS l'alerte de connexion, voir
// loginAlertDevices ci-dessous.
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id').notNull().references(() => admins.id),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  deviceName: text('device_name'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Appareil unique et verrouillé par admin, dédié exclusivement à l'alerte
// de sécurité "connexion à l'admin" — volontairement séparé de
// pushSubscriptions : une fois défini, ni ajout ni suppression possible
// depuis l'interface (voir lib/_push.mjs). Empêche qu'une session admin
// compromise redirige cette alerte précise vers un autre appareil, sans
// pour autant restreindre les notifications générales (commandes...).
export const loginAlertDevices = pgTable('login_alert_devices', {
  adminId: integer('admin_id').primaryKey().references(() => admins.id),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  deviceName: text('device_name'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Paramètres de l'onglet Pilotage : le solde de trésorerie et les hypothèses
// de réassort ne sont déductibles d'aucune autre table (le solde bancaire ne
// transite pas par le site, le délai fournisseur n'est pas mesuré). Une seule
// ligne, id = 1. Sans elle, Pilotage affiche « donnée insuffisante » partout
// où un runway serait nécessaire, plutôt qu'une projection inventée.
export const pilotageSettings = pgTable('pilotage_settings', {
  id: integer('id').primaryKey(),
  tresorerieCents: integer('tresorerie_cents'),
  tresorerieDate: timestamp('tresorerie_date'),
  delaiReassortJours: integer('delai_reassort_jours').notNull().default(60),
  couvertureCibleJours: integer('couverture_cible_jours').notNull().default(120),
  stockSecuriteJours: integer('stock_securite_jours').notNull().default(21),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// Suivi manuel des influenceurs contactés (distinct de la table `affiliates`,
// qui ne concerne que ceux ayant un compte actif sur l'espace partenaire).
// Sert de tableau éditable dans l'admin (Réseaux sociaux > Influenceurs),
// alimenté au départ depuis le suivi Notion externe du propriétaire.
export const influencerContacts = pgTable('influencer_contacts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  platform: text('platform'),
  followers: text('followers'),
  contact: text('contact'),
  offer: text('offer'),
  status: text('status').notNull().default('a_contacter'),
  publication: text('publication'),
  onSite: boolean('on_site').notNull().default(false),
  nextAction: text('next_action'),
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
