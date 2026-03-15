import { Router } from "express";
import {
    getStoreUsers,
    addStoreUser,
    updateStoreUser,
    removeStoreUser,
} from "../controllers/store-users.controller";

// mergeParams: true so storeId is available from parent router
const router = Router({ mergeParams: true });

router.get("/", getStoreUsers);
router.post("/", addStoreUser);
router.put("/:userId", updateStoreUser);
router.delete("/:userId", removeStoreUser);

export default router;
