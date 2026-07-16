library(ggplot2)
library(dplyr)

# ── Dados ──────────────────────────────────────────────────
d <- data.frame(
  nome  = c("Mecânica", "Chuva", "Outros"),
  pct   = c(72.92, 25, 2.08),
  stringsAsFactors = FALSE
)
d <- d[order(d$pct, decreasing = TRUE), ]
d$nome <- factor(d$nome, levels = d$nome)
d$ymax <- cumsum(d$pct)
d$ymin <- c(0, head(d$ymax, -1))
d$mid  <- (d$ymax + d$ymin) / 2

# Posições para labels externos (ângulo da fatia)
d$ang <- 90 - (d$mid / 100 * 360)
d$ang[d$ang < -90] <- d$ang[d$ang < -90] + 180  # evitar texto de cabeça pra baixo
d$hjust <- ifelse(d$ang < -90 | d$ang > 90, 1, 0)

# Coordenadas dos labels (empurrados pra fora)
r <- 1.8
d$x_lab <- r * sin(d$mid / 100 * 2 * pi)
d$y_lab <- r * cos(d$mid / 100 * 2 * pi)

# Pontos de ancoragem na borda da pizza
r_inner <- 1.05
d$x_anc <- r_inner * sin(d$mid / 100 * 2 * pi)
d$y_anc <- r_inner * cos(d$mid / 100 * 2 * pi)

# Labels
d$label <- paste0(d$nome, "\n", round(d$pct, 1), "%")

cores <- c("#E74C3C", "#3498DB", "#95A5A6")

# ── Gráfico ────────────────────────────────────────────────
p <- ggplot(d) +
  # Pizza
  geom_rect(aes(xmin = 0, xmax = 1, ymin = ymin, ymax = ymax, fill = nome),
            color = "white", linewidth = 1.2) +
  coord_polar("y", start = 0, clip = "off") +
  # Leader lines
  geom_segment(aes(x = r_inner, xend = 1.5, y = mid, yend = mid),
               color = "#333333", linewidth = 0.5) +
  geom_segment(aes(x = 1.5, xend = r, y = mid, yend = mid),
               color = "#333333", linewidth = 0.5) +
  # Labels externos
  geom_text(aes(x = r + 0.15, y = mid, label = label, hjust = hjust),
            size = 4.2, fontface = "bold", color = "#333333",
            lineheight = 1.2, family = "sans") +
  scale_fill_manual(values = cores) +
  labs(
    title = "SANEPAR: Horas paradas por causa raiz",
    caption = "Fonte: RDOs  |  Julho 2026"
  ) +
  theme_void() +
  theme(
    text = element_text(family = "sans"),
    plot.title = element_text(face = "bold", size = 18, hjust = 0.5,
                              margin = margin(b = 8)),
    plot.caption = element_text(size = 8, color = "#999999", hjust = 0.5,
                                margin = margin(t = 8)),
    legend.position = "none",
    plot.margin = margin(30, 80, 20, 80),
    plot.background = element_rect(fill = "white", color = "#DDDDDD", linewidth = 0.3)
  )

svglite::svglite("graficos/pizza_horas_paradas_sanepar.svg", width = 9, height = 6, bg = "white")
print(p)
invisible(dev.off())
cat("✓ SANEPAR pizza salva\n")
