# curva_s.R — Extrair metros perfurados cumulativos (diários)

d <- read.csv(
  "../../02-insumos/dados/Sistema Controle Horas Paradas PARC DAS ARTES concluido_perf.csv",
  sep = "\t", fileEncoding = "latin1", stringsAsFactors = FALSE, header = FALSE, skip = 3
)

# Preencher datas (forward fill manual)
last_date <- ""
for (i in seq_len(nrow(d))) {
  v <- trimws(d[i, 1])
  if (v != "") last_date <- v
  d[i, "data"] <- last_date
}

# Filtrar só linhas com Tipo de perfuração
d <- d[d[, 6] %in% c("Perfuração", "Reabertura"), ]

# Metros: Perfuração → V5, Reabertura → V9
d$metros <- ifelse(d[, 6] == "Perfuração",
                   as.numeric(d[, 5]),
                   as.numeric(d[, 9]))
d$metros[is.na(d$metros)] <- 0

# Excluir reabertura de 08/04 e 09/04
excluir <- d[, 6] == "Reabertura" & d$data %in% c("04/08/2026", "04/09/2026")
cat("Excluindo reabertura 08-09/04:", sum(excluir), "linhas,", sum(d$metros[excluir]), "metros\n")
d$metros[excluir] <- 0

# Somar por dia
datas_unicas <- unique(d$data)
metros_por_dia <- sapply(datas_unicas, function(dt) sum(d$metros[d$data == dt]))

# Calendário completo
data_min <- as.Date(datas_unicas[1], format = "%m/%d/%Y")
data_max <- as.Date(datas_unicas[length(datas_unicas)], format = "%m/%d/%Y")
todos_dias <- seq(data_min, data_max, by = "day")

df <- data.frame(
  dia = todos_dias,
  stringsAsFactors = FALSE
)
df$data_str <- format(df$dia, "%m/%d/%Y")
df$metros_dia <- 0

for (i in seq_len(nrow(df))) {
  m <- metros_por_dia[df$data_str[i]]
  if (!is.na(m)) df$metros_dia[i] <- m
}

df$metros_cum <- cumsum(df$metros_dia)

# Exportar
out <- df[, c("dia", "metros_cum")]
write.csv(out, "curva_s_executado.csv", row.names = FALSE)

cat(sprintf("Dias totais: %d\n", nrow(out)))
cat(sprintf("Total metros: %.2f\n", max(out$metros_cum)))
cat(sprintf("Dias com avanço: %d\n", sum(df$metros_dia > 0)))
cat(sprintf("Dias sem avanço: %d\n", sum(df$metros_dia == 0)))
cat("\nPrimeiros 15:\n")
print(head(out, 15))
cat("\nÚltimos 10:\n")
print(tail(out, 10))
