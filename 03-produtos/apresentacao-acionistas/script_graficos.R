# ============================================================
# Gráficos de Horas Paradas — Parc das Artes
# Apresentação para Acionistas — DH Perfuração de Poços
# ============================================================

library(ggplot2)

# ── 1. Leitura ──────────────────────────────────────────────

raw <- read.csv(
  "../../02-insumos/dados/paradas_com_confianca.csv",
  stringsAsFactors = FALSE, fileEncoding = "UTF-8"
)

# Colunas por índice (evitar problema de encoding):
# 1:Data  2:Projeto  3:Equipe  4:Equipamento
# 5:Horas Totais  6:Horas Trabalhadas  7:Horas Paradas
# 8:Parada DH_GEL  9:Parada Parc das artes  10:Parada Chuva
# 11:Parada Mecânica  12:Outros Motivos  13:Motivo/Justificativa
# 14:Responsável  15:Nº RDO  16:Centro de Custo  17:Observações
# 18:Cat_Diagnostico  19:Confianca_0_100  20:Nota_Confiabilidade  21:Revisar

col_data   <- 1
col_dh     <- 8
col_pa     <- 9
col_ch     <- 10
col_me     <- 11
col_hp     <- 7
col_mot    <- 13
col_cat    <- 18
col_conf   <- 19
col_nota   <- 20

# ── 2. Parse de horas ───────────────────────────────────────

parse_horas <- function(x) {
  x <- trimws(x)
  if (is.na(x) || x == "" || x == "00:00") return(0)
  parts <- as.numeric(strsplit(x, ":")[[1]])
  if (length(parts) == 3) return(parts[1] + parts[2]/60 + parts[3]/3600)
  if (length(parts) == 2) return(parts[1] + parts[2]/60)
  return(0)
}

# ── 3. Nomes ────────────────────────────────────────────────

cat_names <- c(
  "1" = "Materiais",
  "2" = "Manutencao",
  "3" = "Mao de obra",
  "4" = "Outros",
  "5" = "Cliente",
  "6" = "Chuva"
)

cores <- c("#E74C3C", "#E67E22", "#F1C40F", "#3498DB", "#9B59B6", "#2ECC71")

# ── 4. Distribuição ─────────────────────────────────────────

cat_horas  <- setNames(rep(0, 6), as.character(1:6))
nao_cat_h  <- 0
cat_rows   <- list()
nc_rows    <- list()

for (i in seq_len(nrow(raw))) {
  r   <- raw[i, ]
  diag <- trimws(r[[col_cat]])
  if (diag == "" || is.na(diag)) next
  
  cats <- strsplit(diag, "\\+")[[1]]
  
  hp_dh <- parse_horas(r[[col_dh]])
  hp_pa <- parse_horas(r[[col_pa]])
  hp_ch <- parse_horas(r[[col_ch]])
  hp_me <- parse_horas(r[[col_me]])
  hp_total <- parse_horas(r[[col_hp]])
  motiv <- r[[col_mot]]
  data  <- r[[col_data]]
  
  # ── Caso ambíguo: 1+4 (ambos em DH_GEL) ──
  if (setequal(cats, c("1", "4"))) {
    nao_cat_h <- nao_cat_h + hp_total
    nc_rows[[length(nc_rows) + 1]] <- c(
      data = data, horas = round(hp_total, 2),
      justificativa = motiv, cats = diag
    )
    next
  }
  
  # ── Caso 1+4+6 ──
  if ("6" %in% cats && setequal(setdiff(cats, "6"), c("1", "4"))) {
    cat_horas["6"] <- cat_horas["6"] + hp_ch
    nao_cat_h <- nao_cat_h + hp_dh
    if (hp_ch > 0) {
      cat_rows[[length(cat_rows) + 1]] <- c(
        data = data, horas = round(hp_ch, 2),
        justificativa = motiv, cat = "6"
      )
    }
    nc_rows[[length(nc_rows) + 1]] <- c(
      data = data, horas = round(hp_dh, 2),
      justificativa = motiv, cats = "1+4 (parte DH_GEL)"
    )
    next
  }
  
  # ── Caso geral ──
  # Mapeamento: ME→2, CH→6, PA→5, DH→1/3/4
  for (cstr in cats) {
    if (cstr == "2" && hp_me > 0) {
      cat_horas["2"] <- cat_horas["2"] + hp_me
      cat_rows[[length(cat_rows) + 1]] <- c(data=data, horas=round(hp_me,2), justificativa=motiv, cat="2")
    } else if (cstr == "5" && hp_pa > 0) {
      cat_horas["5"] <- cat_horas["5"] + hp_pa
      cat_rows[[length(cat_rows) + 1]] <- c(data=data, horas=round(hp_pa,2), justificativa=motiv, cat="5")
    } else if (cstr == "6" && hp_ch > 0) {
      cat_horas["6"] <- cat_horas["6"] + hp_ch
      cat_rows[[length(cat_rows) + 1]] <- c(data=data, horas=round(hp_ch,2), justificativa=motiv, cat="6")
    } else if (cstr %in% c("1", "3", "4") && hp_dh > 0) {
      cat_horas[cstr] <- cat_horas[cstr] + hp_dh
      cat_rows[[length(cat_rows) + 1]] <- c(data=data, horas=round(hp_dh,2), justificativa=motiv, cat=cstr)
    }
  }
}

# ── 5. Dataframe ────────────────────────────────────────────

df <- data.frame(
  cat  = names(cat_horas),
  horas = as.numeric(cat_horas),
  nome  = cat_names[names(cat_horas)],
  stringsAsFactors = FALSE
)
df$pct <- df$horas / sum(df$horas) * 100
df$label_pct <- paste0(df$nome, "\n", round(df$pct, 1), "%  (", round(df$horas, 1), "h)")
df$label_bar <- paste0(round(df$horas, 1), "h")
df$nome_ord <- reorder(df$nome, df$horas)
total_class <- sum(df$horas)
total_geral <- total_class + nao_cat_h

# ── 6. Pizza ────────────────────────────────────────────────

p1 <- ggplot(df, aes(x = "", y = horas, fill = cat)) +
  geom_col(width = 1, color = "white", linewidth = 0.5) +
  coord_polar("y", start = 0) +
  geom_text(
    aes(label = label_pct),
    position = position_stack(vjust = 0.5),
    size = 3.5, color = "white", fontface = "bold"
  ) +
  scale_fill_manual(values = cores, labels = cat_names) +
  labs(
    title = "Horas Paradas por Categoria — Parc das Artes",
    subtitle = paste0(
      "Total classificado: ", round(total_class, 1), "h  |  ",
      "Nao categorizado: ", round(nao_cat_h, 1), "h  |  ",
      "Total geral: ", round(total_geral, 1), "h"
    ),
    fill = "Categoria"
  ) +
  theme_void() +
  theme(
    plot.title    = element_text(hjust = 0.5, face = "bold", size = 14),
    plot.subtitle = element_text(hjust = 0.5, size = 9, color = "grey40"),
    legend.position = "bottom",
    legend.text   = element_text(size = 8)
  )

ggsave("graficos/pizza_horas_paradas.png", p1,
       width = 8, height = 6, dpi = 150, bg = "white")
cat("Pizza salva.\n")

# ── 7. Barras ───────────────────────────────────────────────

p2 <- ggplot(df, aes(x = nome_ord, y = horas, fill = cat)) +
  geom_col(width = 0.7, color = "white", linewidth = 0.3) +
  geom_text(
    aes(label = label_bar),
    hjust = -0.15, size = 4, fontface = "bold", color = "grey30"
  ) +
  scale_fill_manual(values = cores, guide = "none") +
  coord_flip() +
  labs(
    title    = "Horas Paradas — Parc das Artes",
    subtitle = paste0("Classificado: ", round(total_class,1), "h  |  Nao categorizado: ", round(nao_cat_h,1), "h"),
    x = NULL, y = "Horas Paradas"
  ) +
  expand_limits(y = max(df$horas) * 1.22) +
  theme_minimal(base_size = 12) +
  theme(
    plot.title    = element_text(face = "bold", size = 14),
    plot.subtitle = element_text(size = 9, color = "grey40"),
    panel.grid.major.y = element_blank(),
    panel.grid.minor   = element_blank()
  )

ggsave("graficos/barras_horas_paradas.png", p2,
       width = 8, height = 5, dpi = 150, bg = "white")
cat("Barras salva.\n")

# ── 8. CSVs por categoria ───────────────────────────────────

dir.create("csvs-categoria", showWarnings = FALSE)

cat_rows_df <- NULL
for (x in cat_rows) {
  cat_rows_df <- rbind(cat_rows_df, data.frame(
    dia = x["data"], horas = as.numeric(x["horas"]),
    justificativa = x["justificativa"], cat = x["cat"],
    stringsAsFactors = FALSE
  ))
}

for (c in as.character(1:6)) {
  sub <- cat_rows_df[cat_rows_df$cat == c, c("dia", "horas", "justificativa")]
  sub <- sub[order(sub$dia), , drop = FALSE]
  fn <- paste0("csvs-categoria/cat", c, "_", gsub("[ /]", "_", cat_names[c]), ".csv")
  write.csv(sub, fn, row.names = FALSE, fileEncoding = "UTF-8")
  cat(sprintf("CSV Cat %s: %d linhas → %s\n", c, nrow(sub), fn))
}

# Não categorizados
if (length(nc_rows) > 0) {
  nc_df <- NULL
  for (x in nc_rows) {
    nc_df <- rbind(nc_df, data.frame(
      dia = x["data"], horas = as.numeric(x["horas"]),
      justificativa = x["justificativa"], cats = x["cats"],
      stringsAsFactors = FALSE
    ))
  }
  write.csv(nc_df, "csvs-categoria/nao_categorizado.csv",
            row.names = FALSE, fileEncoding = "UTF-8")
  cat(sprintf("CSV Nao categorizado: %d linhas\n", nrow(nc_df)))
}

# ── 9. Resumo ───────────────────────────────────────────────

cat("\n========== TOTAIS POR CATEGORIA ==========\n")
for (i in seq_len(nrow(df))) {
  cat(sprintf("  Cat %s  %-25s : %6.1f h  (%5.1f%%)\n",
      df$cat[i], df$nome[i], df$horas[i], df$pct[i]))
}
cat(sprintf("  Nao categorizado               : %6.1f h\n", nao_cat_h))
cat(sprintf("  TOTAL GERAL                     : %6.1f h\n", total_geral))
cat("===========================================\n")
