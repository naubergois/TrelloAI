import { NextResponse } from "next/server";

/** Cadastro público encerrado: só o administrador cria contas em /admin/usuarios. */
export async function POST() {
  return NextResponse.json(
    { error: "O cadastro é feito pelo administrador em Usuários." },
    { status: 403 },
  );
}
