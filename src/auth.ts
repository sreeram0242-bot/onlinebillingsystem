import pkg from "jsonwebtoken";
const { sign, verify } = pkg;
import bcrypt from "bcryptjs";
const { compare, hash } = bcrypt;
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-change-me-in-production";

export async function hashPassword(password: string) {
  return await hash(password, 10);
}

export async function verifyPassword(password: string, hashed: string) {
  return await compare(password, hashed);
}

export function createToken(payload: any) {
  return sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string) {
  try {
    return verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}

export function setSessionCookie(token: string) {
  setCookie("session_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export function clearSessionCookie() {
  deleteCookie("session_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export function getSessionToken() {
  return getCookie("session_token");
}

export function getUserFromSession() {
  const token = getSessionToken();
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;
  return decoded;
}

export async function requireAuth() {
  const user = getUserFromSession();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function requireHotelOwner() {
  const user = getUserFromSession();
  if (!user) throw new Error("Not authenticated");
  if (user.role !== "HOTEL_OWNER" && user.role !== "SUPER_ADMIN") throw new Error("Unauthorized");
  if (user.role === "HOTEL_OWNER" && !user.hotelId) throw new Error("No hotel associated");
  return user;
}
