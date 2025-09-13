import express from "express";
import axios, { AxiosError } from "axios";
import { API_BASE_URL, API_TIMEOUT_MS, PORT } from "./env.js";

const app = express();

app.get("/healthz", (_req, res) => res.status(200).send("ok"));


app.get("/:slug", async (req, res) => {
  const slug = (req.params.slug || "").trim();
  if (!slug || slug.length > 16) return res.status(400).send("invalid slug");

  try {
    const url = `${API_BASE_URL}/links/${encodeURIComponent(slug)}/resolve`;
    const r = await axios.get(url, {
      timeout: API_TIMEOUT_MS,
      maxRedirects: 0,     
      validateStatus: () => true 
    });
    console.log(`Fetched ${url} - status ${r.status}`);
    console.log(r.headers);
    console.log(r.data);
    if ((r.status === 302 || r.status === 301) && r.headers.location) {
      return res.redirect(302, r.headers.location);
    }

    if (r.status === 200 && r.headers["content-type"]?.includes("application/json")) {
      const u = (r.data && (r.data.u || r.data.target_url)) as string | undefined;
      if (u) return res.redirect(302, u);
    }

    if (r.status === 404) return res.status(404).send("not found");

    return res.status(502).send("bad gateway");
  } catch (e) {
    const err = e as AxiosError;
    if (err.response) {
      const status = err.response.status;
      if (status === 404) return res.status(404).send("not found");
      return res.status(502).send("bad gateway");
    }
    return res.status(502).send("bad gateway");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Redirect service listening on :${PORT} → API ${API_BASE_URL}`);
});
