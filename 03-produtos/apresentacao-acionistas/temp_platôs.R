d <- read.csv("curva_s_sanepar_sheet.csv", fileEncoding = "UTF-8", stringsAsFactors = FALSE)
d$exec <- as.numeric(d$executado)
d$dia_proj <- seq_len(nrow(d))
d$diff <- c(0, diff(d$exec))

# Dias sem avanço
parados <- d[d$diff == 0 & d$exec > 0, ]
cat("=== Dias sem avanço (platôs) ===\n")
cat(nrow(parados), "dias no total\n\n")
for (i in seq_len(nrow(parados))) {
  cat(sprintf("  Dia %2d | cum: %6.1f | diff: %.1f\n",
      parados$dia_proj[i], parados$exec[i], parados$diff[i]))
}

# Também mostrar os dias com repasse
cat("\n=== Confirmando: dias com repasse ===\n")
d_raw <- read.csv("../../02-insumos/referencia/Sistema Controle Horas Paradas SANEPAR - ANDAMENTO (1).csv",
                   sep = "\t", fileEncoding = "latin1", stringsAsFactors = FALSE, header = FALSE, skip = 3)
last <- ""
for (i in seq_len(nrow(d_raw))) {
  v <- trimws(d_raw[i, 1])
  if (v != "") last <- v
  d_raw[i, "data"] <- last
}
d_raw <- d_raw[trimws(d_raw[, 8]) == "Repassando", ]
cat("Datas de repasse:", paste(unique(d_raw$data), collapse = ", "), "\n")
