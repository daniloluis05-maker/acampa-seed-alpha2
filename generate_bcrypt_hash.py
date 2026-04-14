#!/usr/bin/env python3
"""
generate_bcrypt_hash.py
─────────────────────────────────────────────────────────────
Gera o hash bcrypt (custo 10) de uma senha para uso no banco
do Acampa Seed.

Como usar:
  pip install bcrypt
  python3 generate_bcrypt_hash.py

Cole o hash gerado no campo `password` do INSERT do admin
no arquivo supabase_setup.sql.
─────────────────────────────────────────────────────────────
"""

import getpass

try:
    import bcrypt
except ImportError:
    print("Instale o bcrypt primeiro:  pip install bcrypt")
    raise SystemExit(1)


def gerar_hash(senha: str) -> str:
    salt = bcrypt.gensalt(rounds=10)
    return bcrypt.hashpw(senha.encode("utf-8"), salt).decode("utf-8")


def verificar_hash(senha: str, hash_salvo: str) -> bool:
    return bcrypt.checkpw(senha.encode("utf-8"), hash_salvo.encode("utf-8"))


if __name__ == "__main__":
    print("=" * 60)
    print("  Gerador de hash bcrypt — Acampa Seed 2026")
    print("=" * 60)

    senha = getpass.getpass("Digite a senha desejada (oculta): ")
    if len(senha) < 6:
        print("❌ Senha muito curta (mínimo 6 caracteres).")
        raise SystemExit(1)

    confirmacao = getpass.getpass("Confirme a senha: ")
    if senha != confirmacao:
        print("❌ As senhas não coincidem.")
        raise SystemExit(1)

    print("\n⏳ Gerando hash (pode levar ~1s)...")
    hash_gerado = gerar_hash(senha)

    print("\n✅ Hash gerado com sucesso!\n")
    print("Cole este valor no campo `password` do INSERT do admin:")
    print()
    print(f"  '{hash_gerado}'")
    print()

    # Verificação imediata
    ok = verificar_hash(senha, hash_gerado)
    print(f"🔍 Verificação automática: {'✅ OK' if ok else '❌ FALHOU'}")
    print()
    print("Exemplo de uso no SQL:")
    print(f"""
  UPDATE users
  SET password = '{hash_gerado}'
  WHERE id = 'admin';
""")
