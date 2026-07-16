library(ggplot2)

d1 <- read.csv("curva_s_pda_sheet.csv", fileEncoding = "UTF-8", stringsAsFactors = FALSE)
d1$exec <- as.numeric(d1[["Executado..m."]])
d1$prev <- as.numeric(d1[["Previsto..m."]])

# Remover platôs: só manter dias onde o executado AVANÇOU em relação ao dia anterior
d1$diff <- c(0, diff(d1$exec))
pda_real <- d1[d1$diff > 0.5 & d1$exec > 0 & !is.na(d1$exec), ]
pda_real$dia_util <- seq_len(nrow(pda_real))

cat("Dias úteis (avanço > 0.5m):", nrow(pda_real), "\n")
cat("Platôs removidos:", 56 - nrow(pda_real), "\n")

pda_prev <- data.frame(
  dia = seq_len(nrow(d1)),
  metros = d1$prev
)
pda_prev <- pda_prev[!is.na(pda_prev$metros) & pda_prev$metros > 0, ]

p1 <- ggplot() +
  geom_line(data = pda_real, aes(x = dia_util, y = exec),
            color = "#2C3E50", linewidth = 1.1) +
  geom_line(data = pda_prev, aes(x = dia, y = metros),
            color = "#E74C3C", linewidth = 0.6, linetype = "dashed", alpha = 0.8) +
  annotate("text", x = 17, y = 480, label = "Previsto\n(16 dias)", color = "#E74C3C",
           size = 3.5, hjust = 0, family = "sans", lineheight = 1.15) +
  annotate("text", x = nrow(pda_real) - 1, y = max(pda_real$exec) + 20,
           label = paste0("Executado sem paradas\n(", nrow(pda_real), " dias úteis)"),
           color = "#2C3E50", size = 3.2, hjust = 1, family = "sans", lineheight = 1.15) +
  scale_x_continuous(expand = c(0, 0), limits = c(0, 30), breaks = seq(0, 30, 5)) +
  scale_y_continuous(expand = c(0, 0), limits = c(0, 600), breaks = seq(0, 600, 100)) +
  labs(
    title = "Parc das Artes — Cenário \"E se?\"",
    subtitle = "Se não houvesse nenhuma parada  |  Performance pura de perfuração × Previsto",
    x = "Dia útil de perfuração (apenas dias com avanço > 0,5m)", y = "Metros perfurados (cumulativo)",
    caption = paste0("Foram removidos ", 56 - nrow(pda_real), " dias sem avanço significativo dos 56 dias totais.\nA curva mostra apenas dias em que houve penetração real.\nFonte: RDOs  |  Fev–Mai 2026")
  ) +
  theme_minimal(base_size = 12) +
  theme(
    text = element_text(family = "sans"),
    plot.title = element_text(face = "bold", size = 18, hjust = 0.5),
    plot.subtitle = element_text(size = 11, color = "#555555", hjust = 0.5, margin = margin(b = 12)),
    plot.caption = element_text(size = 7.5, color = "#999999", hjust = 0.5, margin = margin(t = 8), lineheight = 1.3),
    panel.grid.minor = element_blank(),
    panel.grid.major = element_line(color = "#EEEEEE", linewidth = 0.3),
    plot.margin = margin(20, 25, 20, 20),
    plot.background = element_rect(fill = "white", color = NA)
  )

svglite::svglite("graficos/curva_s_pda_e_se.svg", width = 9, height = 6, bg = "white")
print(p1)
invisible(dev.off())
cat("✓ PdA E se? corrigido —", nrow(pda_real), "dias úteis de", 56, "totais\n")
