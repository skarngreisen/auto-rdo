library(ggplot2)

d <- read.csv("curva_s_sanepar_sheet.csv", fileEncoding = "UTF-8", stringsAsFactors = FALSE)
d$dia_proj <- seq_len(nrow(d))
d$planejado <- as.numeric(d$planejado)
d$executado <- as.numeric(d$executado)

ultimo_prev <- max(which(!is.na(d$planejado)))
y_prev <- d$planejado[ultimo_prev]
y_max <- max(c(d$planejado, d$executado), na.rm = TRUE) * 1.05

p <- ggplot() +
  geom_line(data = d, aes(x = dia_proj, y = executado),
            color = "#27AE60", linewidth = 1.1) +
  geom_line(data = d, aes(x = dia_proj, y = planejado),
            color = "#E74C3C", linewidth = 0.6, linetype = "dashed", alpha = 0.8) +
  annotate("text", x = ultimo_prev + 2, y = y_prev + 15,
           label = "Previsto", color = "#E74C3C",
           size = 3.5, hjust = 0, family = "sans") +
  annotate("text", x = 50, y = max(d$executado, na.rm = TRUE) + 20,
           label = "Executado", color = "#27AE60",
           size = 3.5, hjust = 1, family = "sans") +
  scale_x_continuous(expand = c(0, 0), limits = c(0, 55), breaks = seq(0, 55, 10)) +
  scale_y_continuous(expand = c(0, 0), limits = c(0, 1050), breaks = seq(0, 1000, 200)) +
  labs(
    title = "SANEPAR",
    subtitle = "Curva S — Etapa de perfuração  |  Previsto × Executado",
    x = "Dia de perfuração", y = "Metros perfurados (cumulativo)",
    caption = "Inclui apenas a fase de avanço do poço (primeiro metro perfurado até a profundidade final).\nNão inclui outras etapas da construção (mobilização, cimentação, desenvolvimento, etc.).  |  Fonte: RDOs  |  Mai–Jun 2026"
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

svglite::svglite("graficos/curva_s_sanepar.svg", width = 9, height = 6, bg = "white")
print(p)
invisible(dev.off())
cat("✓ SANEPAR corrigido — Previsto em dia", ultimo_prev, sprintf("(%.0fm)\n", y_prev))
