# ============================================================
# Escrever abas por categoria na Google Sheet
# ============================================================

library(googlesheets4)

# ── 1. Auth ─────────────────────────────────────────────────
# Tenta credencial cacheada; se não tiver, pede interativo
gs4_auth(cache = TRUE, email = TRUE)

# ── 2. Ler CSV local e distribuir horas ─────────────────────

raw <- read.csv(
  "../../02-insumos/dados/paradas_com_confianca.csv",
  stringsAsFactors = FALSE, fileEncoding = "UTF-8"
)

parse_horas <- function(x) {
  x <- trimws(x)
  if (is.na(x) || x == "" || x == "00:00") return(0)
  parts <- as.numeric(strsplit(x, ":")[[1]])
  if (length(parts) == 3) return(parts[1] + parts[2]/60 + parts[3]/3600)
  if (length(parts) == 2) return(parts[1] + parts[2]/60)
  return(0)
}

col_data <- 1; col_dh <- 8; col_pa <- 9; col_ch <- 10; col_me <- 11
col_hp  <- 7; col_mot <- 13; col_cat <- 18

cat_nomes <- c("1"="Materiais","2"="Manutencao","3"="Mao de obra",
               "4"="Outros","5"="Cliente","6"="Chuva")

cat_rows   <- list()
nc_rows    <- list()

for (i in seq_len(nrow(raw))) {
  r    <- raw[i, ]
  diag <- trimws(r[[col_cat]])
  if (diag == "" || is.na(diag)) next

  cats  <- strsplit(diag, "\\+")[[1]]
  hp_dh <- parse_horas(r[[col_dh]])
  hp_pa <- parse_horas(r[[col_pa]])
  hp_ch <- parse_horas(r[[col_ch]])
  hp_me <- parse_horas(r[[col_me]])
  hp_total <- parse_horas(r[[col_hp]])
  motiv <- r[[col_mot]]
  data  <- r[[col_data]]

  if (setequal(cats, c("1", "4"))) {
    nc_rows[[length(nc_rows)+1]] <- c(data, round(hp_total,2), motiv, "1+4")
    next
  }
  if ("6" %in% cats && setequal(setdiff(cats,"6"), c("1","4"))) {
    if (hp_ch > 0) cat_rows[[length(cat_rows)+1]] <- c(data, round(hp_ch,2), motiv, "6")
    nc_rows[[length(nc_rows)+1]] <- c(data, round(hp_dh,2), motiv, "1+4 (parte DH)")
    next
  }

  for (cstr in cats) {
    if (cstr == "2" && hp_me > 0) {
      cat_rows[[length(cat_rows)+1]] <- c(data, round(hp_me,2), motiv, "2")
    } else if (cstr == "5" && hp_pa > 0) {
      cat_rows[[length(cat_rows)+1]] <- c(data, round(hp_pa,2), motiv, "5")
    } else if (cstr == "6" && hp_ch > 0) {
      cat_rows[[length(cat_rows)+1]] <- c(data, round(hp_ch,2), motiv, "6")
    } else if (cstr %in% c("1","3","4") && hp_dh > 0) {
      cat_rows[[length(cat_rows)+1]] <- c(data, round(hp_dh,2), motiv, cstr)
    }
  }
}

# Monta data.frames
make_df <- function(rows, cat_val) {
  if (length(rows) == 0) return(data.frame(dia=character(), horas=numeric(), justificativa=character()))
  df <- do.call(rbind, lapply(rows, function(x) {
    data.frame(dia=x[1], horas=as.numeric(x[2]), justificativa=x[3], stringsAsFactors=FALSE)
  }))
  df[order(df$dia), , drop=FALSE]
}

# ── 3. Conectar na planilha ─────────────────────────────────

ss_id <- "10dtKZ1KfPr8r7eR_QGFqq_imWeqE--zZxlXb3RyWHtw"
ss <- gs4_get(ss_id)
cat("Planilha:", ss$name, "\n")

# ── 4. Criar/sobrescrever abas ──────────────────────────────

# Função para escrever uma aba (cria se não existe, limpa e reescreve se existe)
write_tab <- function(ss_id, tab_name, df) {
  # Tenta deletar aba existente
  tryCatch({
    sheet_delete(ss_id, tab_name)
    Sys.sleep(1)
  }, error = function(e) {
    cat(sprintf("  Aba '%s' não existia, criando...\n", tab_name))
  })

  sheet_add(ss_id, tab_name)
  Sys.sleep(0.5)
  sheet_write(df, ss_id, tab_name)
  cat(sprintf("  ✓ %s: %d linhas\n", tab_name, nrow(df)))
}

for (c in as.character(1:6)) {
  sub <- make_df(cat_rows[unlist(lapply(cat_rows, function(x) x[4] == c))], c)
  nome <- cat_nomes[c]
  write_tab(ss_id, nome, sub)
}

# Não categorizado
nc_df <- make_df(nc_rows, NA)
if (nrow(nc_df) > 0) {
  write_tab(ss_id, "Nao categorizado", nc_df)
}

cat("\n✓ Todas as abas escritas com sucesso.\n")
