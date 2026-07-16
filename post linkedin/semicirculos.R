# semicirculos.R
# Entrada: nenhuma (dados gerados internamente)
# Saida: post linkedin/semicirculos.png
# Dois semicirculos de 180° lado a lado representando as 24h em Brasilia e Pequim,
# com gradiente dia/noite e arcos de destaque nos horarios de interesse.

library(ggplot2)
library(ggforce)
library(dplyr)

# ---------------------------------------------------------------------------
# 1. Construir dados: 24 segmentos de 1 hora × 2 cidades
# ---------------------------------------------------------------------------

horas   <- 0:23
cidades <- c("Brasilia (UTC-3)", "Pequim (UTC+8)")

df <- expand.grid(hora = horas, cidade = cidades, stringsAsFactors = FALSE) %>%
  as_tibble() %>%
  mutate(
    # Cada hora ocupa π/24 radianos do arco de 180° (π rad)
    start_angle = pi + hora * pi / 24,
    end_angle   = pi + (hora + 1) * pi / 24,

    # Periodo do dia
    periodo = case_when(
      hora >= 0  & hora < 6  ~ "noite_madrugada",
      hora >= 6  & hora < 18 ~ "dia",
      hora >= 18              ~ "noite_tarde"
    ),

    # Destaque: 22h-01h e 03h-07h (horario local em ambas as cidades)
    destaque = (hora >= 22 | hora == 0) | (hora >= 3 & hora <= 6),

    # Posicao x de cada semicirculo (lado a lado)
    x_pos = ifelse(grepl("Brasilia", cidade), 0, 3.2),

    # Raios do anel
    r0 = 0.55,
    r  = 1.00
  )

# ---------------------------------------------------------------------------
# 2. Cores e tema
# ---------------------------------------------------------------------------

cor_noite   <- "#1E3050"
cor_dia     <- "#F5A623"
cor_fundo   <- "#0D1117"
cor_destaque_borda <- "#00E5FF"   # ciano para os arcos de destaque
cor_anel_fundo     <- "#1A2335"   # anel de fundo para visibilidade noturna

# ---------------------------------------------------------------------------
# 3. Construir grafico
# ---------------------------------------------------------------------------

p <- ggplot(df) +

  # Anel de fundo: semicirculo completo para visibilidade dos segmentos noturnos
  geom_arc_bar(
    data = distinct(df, cidade, x_pos, r0, r),
    aes(
      x0    = x_pos,
      y0    = 0,
      r0    = r0,
      r     = r,
      start = pi,
      end   = 2 * pi
    ),
    fill = cor_anel_fundo,
    color = NA
  ) +

  # Camada base: todos os 24 segmentos de cada cidade
  geom_arc_bar(
    aes(
      x0    = x_pos,
      y0    = 0,
      r0    = r0,
      r     = r,
      start = start_angle,
      end   = end_angle,
      fill  = periodo
    ),
    color = cor_fundo,
    linewidth = 0.3
  ) +

  # Camada de destaque: borda externa nos arcos selecionados
  geom_arc_bar(
    data = filter(df, destaque),
    aes(
      x0    = x_pos,
      y0    = 0,
      r0    = 0.95,
      r     = 1.08,
      start = start_angle,
      end   = end_angle
    ),
    fill     = NA,
    color    = cor_destaque_borda,
    linewidth = 1.5
  ) +

  # Marcadores nas extremidades dos intervalos de destaque
  # Inicios: 22h e 3h (usa start_angle)
  geom_point(
    data = filter(df, hora %in% c(22, 3)),
    aes(
      x = x_pos + 1.12 * cos(start_angle),
      y = 1.12 * sin(start_angle)
    ),
    color = cor_destaque_borda,
    size  = 2.5
  ) +
  # Fins: 01h (fim da hora 0) e 07h (fim da hora 6) (usa end_angle)
  geom_point(
    data = filter(df, hora %in% c(0, 6)),
    aes(
      x = x_pos + 1.12 * cos(end_angle),
      y = 1.12 * sin(end_angle)
    ),
    color = cor_destaque_borda,
    size  = 2.5
  ) +

  # Escala de cores
  scale_fill_manual(
    values = c(
      "noite_madrugada" = cor_noite,
      "dia"              = cor_dia,
      "noite_tarde"      = cor_noite
    ),
    guide = "none"
  ) +

  # Coordenadas fixas para os arcos nao distorcerem
  coord_fixed() +

  # Tema limpo com fundo escuro
  theme_void() +
  theme(
    plot.background  = element_rect(fill = cor_fundo, color = NA),
    panel.background = element_rect(fill = cor_fundo, color = NA)
  )

# ---------------------------------------------------------------------------
# 4. Anotacoes: rotulos de cidade, horas e legenda de destaque
# ---------------------------------------------------------------------------

# Coordenadas para as anotacoes (calculadas manualmente a partir da geometria)
# Brasilia em x=0, Pequim em x=3.2, ambos arcos de π a 2π com r=1

# Rotulos das cidades (abaixo do arco)
p <- p +
  annotate("text", x = 0,    y = -1.50, label = "Brasilia\n(UTC-3)",
           size = 4.5, fontface = "bold", color = "white", lineheight = 0.9) +
  annotate("text", x = 3.2,  y = -1.50, label = "Pequim\n(UTC+8)",
           size = 4.5, fontface = "bold", color = "white", lineheight = 0.9)

# Ticks e rotulos de hora: 0h, 6h, 12h, 18h, 0h(24h)
ticks_horas <- data.frame(
  hora   = c(0, 6, 12, 18),
  label  = c("0h", "6h", "12h", "18h")
) %>%
  mutate(
    angle = pi + hora * pi / 24,
    # extremidade externa do tick
    x_tick_start = cos(angle),
    y_tick_start = sin(angle),
    x_tick_end   = 1.08 * cos(angle),
    y_tick_end   = 1.08 * sin(angle),
    # posicao do rotulo
    x_label = 1.22 * cos(angle),
    y_label = 1.22 * sin(angle)
  )

# Ticks para Brasilia (x_pos = 0)
p <- p +
  geom_segment(
    data = ticks_horas,
    aes(x = x_tick_start, y = y_tick_start,
        xend = x_tick_end, yend = y_tick_end),
    color = "gray60", linewidth = 0.4
  ) +
  annotate("text",
    x = ticks_horas$x_label, y = ticks_horas$y_label,
    label = ticks_horas$label,
    size = 2.8, color = "gray70"
  )

# Ticks para Pequim (x_pos = 3.2)
p <- p +
  geom_segment(
    data = ticks_horas,
    aes(x = 3.2 + x_tick_start, y = y_tick_start,
        xend = 3.2 + x_tick_end, yend = y_tick_end),
    color = "gray60", linewidth = 0.4
  ) +
  annotate("text",
    x = 3.2 + ticks_horas$x_label, y = ticks_horas$y_label,
    label = ticks_horas$label,
    size = 2.8, color = "gray70"
  )

# Rotulo extra: 0h(24h) na ponta direita de cada arco
p <- p +
  annotate("text", x =  1.00, y =  0.30, label = "0h",
           size = 3, color = "gray70") +
  annotate("text", x =  4.20, y =  0.30, label = "0h",
           size = 3, color = "gray70")

# Legenda visual do destaque
p <- p +
  annotate("text", x = 1.6, y = -1.80,
           label = "Destaque: 22h-01h e 03h-07h (horario local)",
           size = 3, color = cor_destaque_borda, fontface = "italic")

# ---------------------------------------------------------------------------
# 5. Exportar
# ---------------------------------------------------------------------------

ggsave("post linkedin/semicirculos.svg", p,
       width = 10, height = 5.5, bg = cor_fundo)

message("SVG salvo em post linkedin/semicirculos.svg")
