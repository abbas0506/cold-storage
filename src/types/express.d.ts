// Extend Express Request interface with user property
import "express";

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: number;
                username: string;
                systemRole: "SUPER_ADMIN" | "SUBSCRIBER" | "USER";
            };
            /** Store-level role set by requireStoreAccess middleware */
            storeRole?: "ADMIN" | "EMPLOYEE";
        }
    }
}
