import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: "username and password required" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    // Optionally generate a token (simple placeholder)
    const token = "dummy-token"; // replace with JWT in production
    const response = NextResponse.json({ message: "Login successful", token }, { status: 200 });
    // Set auth cookie (httpOnly for security)
    response.cookies.set('auth-token', token, { httpOnly: true, path: '/', sameSite: 'lax' });
    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
