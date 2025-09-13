import { Router } from "express";
import * as linkController from "../controllers/link.controller.js";

const router = Router();

router.post("/", linkController.create);
router.get("/",linkController.list);
router.patch("/:slug", linkController.update);
router.delete("/:slug",linkController.remove);
router.get("/:slug",linkController.getLinkBySlug);
router.get("/:slug/resolve",linkController.resolveLink);

export default router;
