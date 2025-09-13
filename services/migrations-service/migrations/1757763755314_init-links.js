exports.up = (pgm) => {
  pgm.createExtension("pgcrypto", { ifNotExists: true });

  pgm.createTable("links", {
    id: { type: "uuid", primaryKey: true, notNull: true, default: pgm.func("gen_random_uuid()") },
    slug: { type: "varchar(16)", notNull: true, unique: true },
    target_url: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    expires_at: { type: "timestamptz" },
    is_active: { type: "boolean", notNull: true, default: true },
    created_ip_hash: { type: "char(64)" }
  });

  pgm.createIndex("links", "slug", { unique: true });
  pgm.createIndex("links", "expires_at");
};

exports.down = (pgm) => {
  pgm.dropTable("links");
  pgm.dropExtension("pgcrypto", { ifExists: true });
};
