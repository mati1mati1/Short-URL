exports.shorthands = undefined;

exports.up = async (pgm) => {
  const links = [];

  for (let i = 1; i <= 1000; i++) {
    const slug = `test${i}`;
    const target_url = `https://example.com/page${i}`;
    const created_at = new Date().toISOString();

    links.push({
      id: pgm.func("gen_random_uuid()"),
      slug,
      target_url,
      created_at,
      expires_at: null,
      is_active: true,
      created_ip_hash: null
    });
  }

  pgm.sql(`
    INSERT INTO links (id, slug, target_url, created_at, expires_at, is_active, created_ip_hash)
    VALUES
    ${links
      .map(
        (l, idx) =>
          `(${l.id}, 'test${idx + 1}', 'https://example.com/page${idx + 1}', now(), NULL, true, NULL)`
      )
      .join(",\n")}
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`DELETE FROM links WHERE slug LIKE 'test%'`);
};
