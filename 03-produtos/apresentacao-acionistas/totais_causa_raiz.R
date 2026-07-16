# ============================================================
# Totais por Causa Raiz (Grupos 1-4) — dados reais da sheet
# ============================================================

d <- read.csv("sheet_completa.csv", stringsAsFactors = FALSE, fileEncoding = "UTF-8")

parse_horas <- function(x) {
  if (length(x) == 0 || is.na(x[1])) return(0)
  x <- trimws(as.character(x))
  if (is.na(x) || x == "" || x == "00:00") return(0)
  parts <- as.numeric(strsplit(x, ":")[[1]])
  if (length(parts) == 3) return(parts[1] + parts[2]/60 + parts[3]/3600)
  if (length(parts) == 2) return(parts[1] + parts[2]/60)
  return(0)
}

# ── Mapeamento Causa Raiz → Grupo ───────────────────────────

map_cr <- function(cr) {
  cr <- trimws(cr)
  if (is.na(cr) || cr == "" || cr == "NA") return(NA_character_)
  if (cr == "Falta de Manutenção Preventiva") return("G1")
  if (cr == "Falta de planejamento") return("G2")
  if (cr == "Falta de mão de obra") return("G3")
  if (cr == "Causa Raiz 4") return("G4")
  if (cr == "Falta de Manutenção Preventiva / Falta de mão de obra") return("G1+G3")
  if (cr == "Causa Raiz 4 / Falta de planejamento") return("G4+G2")
  return(NA_character_)
}

# ── Cálculo ─────────────────────────────────────────────────

grupo_horas <- setNames(rep(0, 4), paste0("G", 1:4))
nao_class <- 0

for (i in seq_len(nrow(d))) {
  r <- d[i, ]
  hp_total <- parse_horas(r[["Horas.Paradas"]])
  if (hp_total == 0) next
  
  hp_me <- parse_horas(r[["Parada.Mecânica"]])
  hp_dh <- parse_horas(r[["Parada.DH_GEL"]])
  hp_pa <- parse_horas(r[["Parada.Parc.das.artes"]])
  hp_ch <- parse_horas(r[["Parada.Chuva"]])
  
  cr <- r[["CausaRaiz"]]
  grp <- map_cr(cr)
  
  if (is.na(grp)) {
    nao_class <- nao_class + hp_total
    next
  }
  
  if (grp == "G1+G3") {
    # Col K (Mecânica) → G1, restante → G3
    grupo_horas["G1"] <- grupo_horas["G1"] + hp_me
    grupo_horas["G3"] <- grupo_horas["G3"] + (hp_total - hp_me)
  } else if (grp == "G4+G2") {
    # PA → G4, DH → G2 (regra: col I → cliente, col H → planejamento)
    grupo_horas["G4"] <- grupo_horas["G4"] + hp_pa
    grupo_horas["G2"] <- grupo_horas["G2"] + (hp_total - hp_pa)
  } else {
    grupo_horas[grp] <- grupo_horas[grp] + hp_total
  }
}

total <- sum(grupo_horas) + nao_class

nomes <- c(
  "G1" = "Grupo 1 — Equipamentos quebrando (falta manut. preventiva)",
  "G2" = "Grupo 2 — Materiais/equip. indisponiveis (falta cronograma)",
  "G3" = "Grupo 3 — Mao de obra insuficiente / desmobilizacoes",
  "G4" = "Grupo 4 — Atrasos do cliente / pendencias SAERP"
)

cat("\n========== TOTAIS POR GRUPO DE CAUSA RAIZ ==========\n")
for (g in paste0("G", 1:4)) {
  pct <- grupo_horas[g] / total * 100
  cat(sprintf("  %-55s : %6.1f h  (%5.1f%%)\n", nomes[g], grupo_horas[g], pct))
}
cat(sprintf("  Nao classificado (sem Causa Raiz preenchida)   : %6.1f h  (%5.1f%%)\n",
            nao_class, nao_class/total*100))
cat(sprintf("  %-55s : %6.1f h  (%5.1f%%)\n", "TOTAL GERAL", total, 100))
cat("==========================================================\n")

# ── Listar não classificados ────────────────────────────────

cat("\nLinhas SEM Causa Raiz (com horas > 0):\n")
for (i in seq_len(nrow(d))) {
  r <- d[i, ]
  hp <- parse_horas(r[["Horas.Paradas"]])
  if (hp == 0) next
  cr <- map_cr(trimws(r[["CausaRaiz"]]))
  if (is.na(cr)) {
    cat(sprintf("  %s | %5.1fh | %s\n",
        r[["Data"]], hp, substr(r[["Motivo...Justificativa"]], 1, 70)))
  }
}
