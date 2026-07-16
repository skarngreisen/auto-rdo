"""
Compila proposta.tex para PDF usando pdfLaTeX.
Requer MiKTeX ou TeX Live instalado no PATH.
"""

import subprocess
import sys
import os

TEX_FILE = "proposta.tex"
OUTPUT_DIR = "."

def run_latex():
    print(f"[1/2] Compilando {TEX_FILE}...")
    result = subprocess.run(
        ["pdflatex", "-interaction=nonstopmode", "-output-directory", OUTPUT_DIR, TEX_FILE],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        print("Erro na primeira compilação. Verifique o log:")
        # Tenta mostrar o final do log
        log_file = TEX_FILE.replace(".tex", ".log")
        if os.path.exists(log_file):
            with open(log_file, "r") as f:
                lines = f.readlines()
                for line in lines[-30:]:
                    print(line.rstrip())
        sys.exit(1)

    print("[2/2] Segunda passada (para referências cruzadas e sumário)...")
    result2 = subprocess.run(
        ["pdflatex", "-interaction=nonstopmode", "-output-directory", OUTPUT_DIR, TEX_FILE],
        capture_output=True,
        text=True,
    )

    if result2.returncode != 0:
        print("Erro na segunda compilação.")
        sys.exit(1)

    pdf_file = TEX_FILE.replace(".tex", ".pdf")
    if os.path.exists(pdf_file):
        print(f"\n[OK] PDF gerado com sucesso: {os.path.abspath(pdf_file)}")
    else:
        print("\n❌ PDF não foi gerado. Verifique o log.")

if __name__ == "__main__":
    run_latex()
