import type { Request, Response } from "express";
import * as service from "../services/link.service.js";
import { logger } from "@short/observability";
import { createLinkSchema, updateLinkSchema } from "../validation/link.schema.js";

const isValidSlug = (s: string) => !!s && s.length <= 16 && /^[A-Za-z0-9-_]+$/.test(s);

function buildShortUrl(slug: string): string {
  const protocol = process.env.REDIRECT_PORTAL_PROTOCOL || "http";
  const host = process.env.REDIRECT_PORTAL_HOST || "localhost";
  const port = process.env.REDIRECT_PORT || "8080";

  return `${protocol}://${host}:${port}/${slug}`;
}

export async function create(req: Request, res: Response) {
  logger.info({ body: req.body, ip: req.ip }, "Creating new short link");
  
  const parsed = createLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn({ errors: parsed.error.flatten(), body: req.body }, "Link creation validation failed");
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  const ip = (req.ip || "").toString();
  const created_ip_hash = parsed.data.created_ip_hash ?? (ip ? service.hashIp(ip) : undefined);

  try {
    logger.info({ target_url: parsed.data.target_url }, "Attempting to create link");
    const link = await service.createLink({ ...parsed.data, created_ip_hash });
    logger.info({ slug: link.slug, short_url: buildShortUrl(link.slug), expires_at: link.expires_at, is_active: link.is_active }, "Successfully created short link");
    res.status(201).json(link);
  } catch (e: any) {
    if (e.code === "23505") {
      logger.warn({ target_url: parsed.data.target_url }, "Slug already exists");
      return res.status(409).json({ message: "Slug already exists" });
    }
    logger.error({ error: e.message, stack: e.stack }, "Failed to create link");
    throw e;
  }
}

export async function getLinkBySlug(req: Request, res: Response) {
  const slug = String(req.params.slug || "").trim();
  logger.info({ slug }, "Getting link by slug");
  
  if (!isValidSlug(slug)) {
    logger.warn({ slug }, "Invalid slug provided");
    return res.status(400).json({ error: "invalid slug" });
  }

  try {
    const row = await service.getLinkBySlug(slug);
    if (!row) {
      logger.info({ slug }, "Link not found");
      return res.status(404).json({ error: "not found" });
    }

    logger.info({ slug, link: row }, "Successfully retrieved link");
    return res.status(200).json(row);
  } catch (e: any) {
    logger.error({ error: e.message, slug }, "Failed to get link by slug");
    throw e;
  }
}

export async function resolveLink(req: Request, res: Response) {
  const slug = String(req.params.slug || "").trim();
  logger.info({ slug }, "Resolving link for redirect");
  
  if (!isValidSlug(slug)) {
    logger.warn({ slug }, "Invalid slug for resolve");
    return res.status(400).json({ error: "invalid slug" });
  }

  try {
    const compact = await service.resolveLink(slug);
    if (!compact) {
      logger.info({ slug }, "Link not found for resolve");
      return res.status(404).json({ error: "not found" });
    }
  
    logger.info({ compact }, "Compact link object");
    
    if(compact.expires_at && new Date(compact.expires_at) < new Date()) {
      logger.info({ slug, expires_at: compact.expires_at }, "Link has expired");
      return res.status(410).json({ error: "link expired" });
    }
    
    if (!compact.is_active) {
      logger.info({ slug }, "Link is inactive");
      return res.status(403).json({ error: "link inactive" });
    }
    
    res.setHeader("Cache-Control", "private, max-age=0, no-cache");
    logger.info({ slug, url: compact.u }, `Redirecting ${slug} → ${compact.u}`);
    return res.redirect(302, compact.u);
  } catch (e: any) {
    logger.error({ error: e.message, slug }, "Failed to resolve link");
    throw e;
  }
}

export async function list(req: Request, res: Response) {
  logger.info("Listing all links");
  
  try {
    const links = await service.listLinks();
    logger.info({ count: links.length }, "Successfully retrieved links list");
    res.json(links);
  } catch (e: any) {
    logger.error({ error: e.message }, "Failed to list links");
    throw e;
  }
}

export async function update(req: Request, res: Response) {
  const slug = req.params.slug;
  logger.info({ slug, body: req.body }, "Updating link");
  
  const parsed = updateLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn({ errors: parsed.error.flatten(), slug }, "Link update validation failed");
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  try {
    const updated = await service.updateLink(slug, parsed.data);
    if (!updated) {
      logger.info({ slug }, "Link not found for update");
      return res.status(404).json({ message: "Not found" });
    }
    
    logger.info({ slug, updated }, "Successfully updated link");
    res.json(updated);
  } catch (e: any) {
    logger.error({ error: e.message, slug }, "Failed to update link");
    throw e;
  }
}

export async function remove(req: Request, res: Response) {
  const slug = req.params.slug;
  logger.info({ slug }, "Removing link");
  
  try {
    const ok = await service.deleteBySlug(slug);
    if (!ok) {
      logger.info({ slug }, "Link not found for deletion");
      return res.status(404).json({ message: "Not found" });
    }
    
    logger.info({ slug }, "Successfully deleted link");
    res.status(204).send();
  } catch (e: any) {
    logger.error({ error: e.message, slug }, "Failed to delete link");
    throw e;
  }
}
