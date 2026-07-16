d <- read.csv("sheet_completa.csv", stringsAsFactors = FALSE, fileEncoding = "UTF-8")

parse_h <- function(x) {
  if (length(x) == 0) return(0)
  x <- as.character(x)
  if (length(x) != 1 || is.na(x) || x == "NULL") return(0)
  x <- trimws(x)
  if (x == "" || x == "00:00" || x == "NA") return(0)
  p <- as.numeric(strsplit(x, ":")[[1]])
  if (any(is.na(p))) return(0)
  if (length(p) == 3) return(p[1] + p[2]/60 + p[3]/3600)
  if (length(p) == 2) return(p[1] + p[2]/60)
  return(0)
}

tubos <- c("11/03/2026","12/03/2026","13/03/2026","14/03/2026",
           "15/03/2026","16/03/2026","17/03/2026","18/03/2026")

G <- setNames(rep(0, 6),
  c("G1_Equip", "G2_Planej", "G3_MaoObra", "G4a_Tubos", "G4b_Cliente", "NaoClass"))

for (i in seq_len(nrow(d))) {
  hp <- parse_h(d[i, "Horas.Paradas"])
  if (hp == 0) next

  dt <- d[i, "Data"]
  cr <- trimws(d[i, "CausaRaiz"])
  hp_me <- parse_h(d[i, "Parada.MecÃ.nica"])
  hp_pa <- parse_h(d[i, "Parada.Parc.das.artes"])

  # Excluir tubos
  if (dt %in% tubos && grepl("Causa Raiz 4", cr, fixed = TRUE)) {
    G["G4a_Tubos"] <- G["G4a_Tubos"] + hp
    next
  }

  if (is.na(cr) || cr == "" || cr == "NA") {
    G["NaoClass"] <- G["NaoClass"] + hp
  } else if (cr == "Falta de Manutenção Preventiva") {
    G["G1_Equip"] <- G["G1_Equip"] + hp
  } else if (cr == "Falta de planejamento") {
    G["G2_Planej"] <- G["G2_Planej"] + hp
  } else if (cr == "Falta de mão de obra") {
    G["G3_MaoObra"] <- G["G3_MaoObra"] + hp
  } else if (cr == "Causa Raiz 4") {
    G["G4b_Cliente"] <- G["G4b_Cliente"] + hp
  } else if (cr == "Falta de Manutenção Preventiva / Falta de mão de obra") {
    G["G1_Equip"] <- G["G1_Equip"] + hp_me
    G["G3_MaoObra"] <- G["G3_MaoObra"] + (hp - hp_me)
  } else if (cr == "Causa Raiz 4 / Falta de planejamento") {
    G["G4b_Cliente"] <- G["G4b_Cliente"] + hp_pa
    G["G2_Planej"] <- G["G2_Planej"] + (hp - hp_pa)
  }
}

total_sem_tubos <- sum(G[c("G1_Equip","G2_Planej","G3_MaoObra","G4b_Cliente","NaoClass")])
nomes <- c(
  "G1_Equip"   = "Equipamento / Manutencao",
  "G2_Planej"  = "Planejamento / Materiais",
  "G3_MaoObra" = "Mao de obra",
  "G4a_Tubos"  = "Cliente: Tubos (faturamento direto)",
  "G4b_Cliente"= "Cliente: SAERP / Decisoes",
  "NaoClass"   = "Nao classificado"
)

cat("========== DISTRIBUICAO FINAL (SEM 192h TUBOS) ==========\n")
for (g in c("G1_Equip","G2_Planej","G3_MaoObra","G4b_Cliente","NaoClass")) {
  pct <- G[g] / total_sem_tubos * 100
  cat(sprintf("  %-42s : %6.1fh  (%5.1f%%)\n", nomes[g], G[g], pct))
}
cat(sprintf("\n  %-42s : %6.1fh\n", "TOTAL (sem tubos)", total_sem_tubos))
cat(sprintf("\n  %-42s : %6.1fh  (excluido: nao houve equipe parada)\n", nomes["G4a_Tubos"], G["G4a_Tubos"]))

cli <- G["G4a_Tubos"] + G["G4b_Cliente"]
cat(sprintf("\n  Se juntar G4a+G4b (Cliente unificado) : %6.1fh  (%5.1f%% do total geral)\n",
            cli, cli/(total_sem_tubos + G["G4a_Tubos"])*100))
