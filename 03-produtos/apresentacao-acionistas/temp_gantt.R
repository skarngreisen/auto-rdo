library(ggplot2)

# ── Dados ──────────────────────────────────────────────────
proj <- data.frame(
  nome = c(
    "FERROPORT ML 24010",
    "CITROSUCO PP 25059",
    "YAKULT MP 26005",
    "PARC DAS ARTES",
    "AEGEA PARA ML 26001",
    "CITROSUCO MH 25028",
    "MRV RESERVA ROMANA",
    "ARTESANO PP 25016",
    "AMBIPAR ML 25003",
    "HEINEKEN MC 25053",
    "DE CAFES MP 26014",
    "CARGIL BEBEDOURO ML 23008",
    "ÁGUAS DE GUARIROBA",
    "SANEPAR",
    "YAKULT LORENA MH 25015.02",
    "YAKULT MH 26008",
    "VILA EUROPA PP 25066",
    "GERDAU ARAÇARIGUAMA",
    "CEDAE",
    "ACELORMITTAL MP 24031"
  ),
  inicio_raw = c(
    "2/9/2026", "2/18/2026", "2/14/2026", "2/9/2026",
    "3/10/2026", "3/10/2026", "3/2/2026", "3/23/2026",
    "4/1/2026", "4/13/2026", "4/22/2026", "4/7/2026",
    "4/20/2026", "4/20/2026", "5/1/2026", "5/27/2026",
    "5/12/2026", "5/18/2026", "5/6/2026", "6/8/2026"
  ),
  fim_raw = c(
    "2/20/2026", "2/19/2026", "2/17/2026", "5/29/2026",
    "4/13/2026", "3/26/2026", "", "",
    "", "4/21/2026", "4/25/2026", "4/18/2026",
    "5/8/2026", "", "5/16/2026", "5/30/2026",
    "", "5/26/2026", "", "6/9/2026"
  ),
  stringsAsFactors = FALSE
)

proj$inicio <- as.Date(proj$inicio_raw, format = "%m/%d/%Y")
proj$fim    <- as.Date(proj$fim_raw, format = "%m/%d/%Y")

# Clip ao período visível
corte_inicio <- as.Date("2026-01-01")
corte_fim    <- as.Date("2026-07-02")
hoje <- corte_fim

proj$inicio_vis <- pmax(proj$inicio, corte_inicio)
proj$fim_vis    <- pmin(proj$fim, hoje, na.rm = TRUE)

# Flags
proj$aberto_esq <- proj$inicio < corte_inicio
proj$aberto_dir <- is.na(proj$fim) | proj$fim > hoje

# Status
proj$status <- ifelse(proj$aberto_dir, "Em andamento", "Finalizado")

# Reordenar por início
proj <- proj[order(proj$inicio, decreasing = TRUE), ]
proj$y <- seq_len(nrow(proj))

# Cores
proj$cor <- ifelse(proj$nome == "PARC DAS ARTES", "#E74C3C",
            ifelse(proj$nome == "SANEPAR", "#27AE60",
            ifelse(proj$aberto_dir, "#F39C12", "#5D6D7E")))

p <- ggplot(proj) +
  # Barras principais
  geom_segment(aes(x = inicio_vis, xend = fim_vis, y = y, yend = y, color = cor),
               linewidth = 6, lineend = "round") +
  # Seta esquerda (projetos que começaram antes de 2026)
  geom_segment(data = proj[proj$aberto_esq, ],
               aes(x = corte_inicio, xend = corte_inicio + 8, y = y, yend = y),
               color = "#5D6D7E", linewidth = 6, lineend = "round",
               arrow = arrow(length = unit(0.15, "cm"), type = "closed")) +
  # Seta direita (projetos em andamento)
  geom_segment(data = proj[proj$aberto_dir, ],
               aes(x = hoje - 8, xend = hoje, y = y, yend = y),
               color = "#F39C12", linewidth = 6, lineend = "round",
               arrow = arrow(length = unit(0.15, "cm"), type = "closed")) +
  scale_color_identity() +
  scale_x_date(
    limits = c(corte_inicio, corte_fim),
    breaks = seq(corte_inicio, corte_fim, by = "month"),
    date_labels = "%b",
    expand = c(0.02, 0)
  ) +
  scale_y_continuous(breaks = proj$y, labels = proj$nome, expand = c(0.02, 0)) +
  labs(
    title = "Projetos — 2026",
    subtitle = "Obras executadas e em andamento no período",
    x = NULL, y = NULL,
    caption = "◂ Projeto iniciado antes de 2026    ▸ Em andamento (além de 02/07/2026)"
  ) +
  theme_minimal(base_size = 11) +
  theme(
    text = element_text(family = "sans"),
    plot.title = element_text(face = "bold", size = 18, hjust = 0.5),
    plot.subtitle = element_text(size = 11, color = "#555555", hjust = 0.5, margin = margin(b = 16)),
    plot.caption = element_text(size = 8, color = "#999999", hjust = 0.5, margin = margin(t = 12)),
    panel.grid.major.y = element_line(color = "#EEEEEE", linewidth = 0.3),
    panel.grid.minor = element_blank(),
    panel.grid.major.x = element_line(color = "#DDDDDD", linewidth = 0.3),
    axis.text.y = element_text(size = 8, hjust = 1),
    axis.ticks.y = element_blank(),
    plot.margin = margin(20, 40, 20, 20),
    plot.background = element_rect(fill = "white", color = NA)
  )

svglite::svglite("graficos/cronograma_projetos_2026.svg", width = 14, height = 7.5, bg = "white")
print(p)
invisible(dev.off())
cat("✓ Cronograma salvo\n")
