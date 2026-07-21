import { createServerFn } from "@tanstack/react-start";

// Error utility
class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

export const loginAction = createServerFn({ method: "POST" })
  .validator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const { db } = await import("./db");
    const { verifyPassword, createToken, setSessionCookie } = await import("./auth");

    const user = await db.user.findUnique({ where: { email: data.email } });
    if (!user) throw new ActionError("Invalid credentials");

    const valid = await verifyPassword(data.password, user.passwordHash);
    if (!valid) throw new ActionError("Invalid credentials");

    if (user.status === "PENDING") throw new ActionError("Account pending approval");
    if (user.status === "PAUSED") throw new ActionError("Account paused by admin");

    const token = createToken({
      id: user.id,
      email: user.email,
      role: user.role,
      hotelId: user.hotelId,
    });
    setSessionCookie(token);

    return { success: true, role: user.role };
  });

export const logoutAction = createServerFn({ method: "POST" })
  .handler(async () => {
    const { clearSessionCookie } = await import("./auth");
    clearSessionCookie();
    return { success: true };
  });

export const registerAction = createServerFn({ method: "POST" })
  .validator((data: { name: string; email: string; password: string; hotelName: string }) => data)
  .handler(async ({ data }) => {
    const { db } = await import("./db");
    const { hashPassword } = await import("./auth");

    const exists = await db.user.findUnique({ where: { email: data.email } });
    if (exists) throw new ActionError("Email already in use");

    const hash = await hashPassword(data.password);
    
    const count = await db.user.count();
    const role = count === 0 ? "SUPER_ADMIN" : "HOTEL_OWNER";
    const status = count === 0 ? "ACTIVE" : "PENDING";
    const globalSettings = await db.globalSettings.findUnique({ where: { id: "global" } });
    const isFirstUser = count === 0;

    if (!isFirstUser && globalSettings && !globalSettings.allowRegistrations) {
      throw new ActionError("Registrations are currently paused");
    }

    const defaultGst = globalSettings?.defaultGst ?? 5.0;

    const hotel = await db.hotel.create({
      data: {
        name: data.hotelName,
        settings: {
          create: {
            gstPercentage: defaultGst
          }
        }
      }
    });

    const user = await db.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: hash,
        role,
        status,
        hotelId: hotel.id
      }
    });

    return { success: true };
  });

export const getSessionAction = createServerFn({ method: "GET" })
  .handler(async () => {
    const { getUserFromSession } = await import("./auth");
    return getUserFromSession();
  });
