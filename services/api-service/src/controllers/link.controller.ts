import type { Request, Response } from "express";
import * as service from "../services/link.service.js";
import { createLinkSchema, updateLinkSchema } from "../validation/link.schema.js";

const isValidSlug = (s: string) => !!s && s.length <= 16 && /^[A-Za-z0-9-_]+$/.test(s);


export async function create(req: Request, res: Response) {
  const parsed = createLinkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });

  const ip = (req.ip || "").toString();
  const created_ip_hash = parsed.data.created_ip_hash ?? (ip ? service.hashIp(ip) : undefined);

  try {
    const link = await service.createLink({...parsed.data, created_ip_hash });
    res.status(201).json(link);
  } catch (e: any) {
    if (e.code === "23505") return res.status(409).json({ message: "Slug already exists" });
    throw e;
  }
}

export async function getLinkBySlug(req: Request, res: Response) {
  const slug = String(req.params.slug || "").trim();
  if (!isValidSlug(slug)) return res.status(400).json({ error: "invalid slug" });

  const row = await service.getLinkBySlug(slug);
  if (!row) return res.status(404).json({ error: "not found" });

  return res.status(200).json(row);
}

export async function resolveLink(req: Request, res: Response) {
  const slug = String(req.params.slug || "").trim();
  if (!isValidSlug(slug)) return res.status(400).json({ error: "invalid slug" });

  const compact = await service.resolveLink(slug);
  if (!compact) return res.status(404).json({ error: "not found" });
  console.log(compact);
  res.setHeader("Cache-Control", "private, max-age=0, no-cache");
  console.log(`Redirecting ${slug} → ${compact.u}`);
  return res.redirect(302, compact.u);
}

export async function list(req: Request, res: Response) {
  const links = await service.listLinks();
  res.json(links);
}

export async function update(req: Request, res: Response) {
  const parsed = updateLinkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });

  const updated = await service.updateLink(req.params.slug, parsed.data);
  if (!updated) return res.status(404).json({ message: "Not found" });
  res.json(updated);
}

export async function remove(req: Request, res: Response) {
  const ok = await service.deleteBySlug(req.params.slug);
  if (!ok) return res.status(404).json({ message: "Not found" });
  res.status(204).send();
}
