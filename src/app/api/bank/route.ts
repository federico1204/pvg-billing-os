import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [incomeRes, expensesRes] = await Promise.all([
    db.from("expenses").select("*").ilike("notes", "%Ingreso%").order("date", { ascending: false }),
    db.from("expenses").select("*").ilike("notes", "%Gasto%").order("date", { ascending: false }),
  ]);

  if (incomeRes.error) return NextResponse.json({ error: incomeRes.error.message }, { status: 500 });
  if (expensesRes.error) return NextResponse.json({ error: expensesRes.error.message }, { status: 500 });

  return NextResponse.json({
    income: incomeRes.data ?? [],
    expenses: expensesRes.data ?? [],
  });
}
