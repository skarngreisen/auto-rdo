import csv

rows = list(csv.DictReader(open('DH/Sistema Controle Horas Paradas PARC DAS ARTES concluido.csv', encoding='cp1252')))
keys = list(rows[0].keys())
k_mot, k_hp, k_dh, k_pa, k_ch, k_me = keys[12], keys[6], keys[7], keys[8], keys[9], keys[10]

# Final classification incorporating all user rules:
# - Column mapping: DH=Cat1/3/4, PA=Cat5, CH=Cat6, ME=Cat2
# - DTS = Cat3, Instalacao eletrica = Cat2, Torrista/eletricista = Cat3
# - If PA has hours for "aguardando material", it's Cat5 (client-provided)
# - Mixed cats with columns separating = high confidence
# - Mixed cats all in DH_GEL = low confidence (can't split)

# (lin, cats_str, conf, note)
results = {}

for i, r in enumerate(rows, 1):
    hp = r.get(k_hp, '').strip()
    if not hp or hp == '00:00':
        continue
    
    mot = r.get(k_mot, '').strip()
    dh = r.get(k_dh, '').strip()
    pa = r.get(k_pa, '').strip()
    ch = r.get(k_ch, '').strip()
    me = r.get(k_me, '').strip()
    
    has_dh = bool(dh and dh != '00:00')
    has_pa = bool(pa and pa != '00:00')
    has_ch = bool(ch and ch != '00:00')
    has_me = bool(me and me != '00:00')
    mot_lower = mot.lower()
    
    # Determine categories
    cats = []
    
    # Check PA column first: if PA has hours, it's Cat 5
    if has_pa:
        cats.append(5)
    
    # Check ME column: Cat 2
    if has_me:
        cats.append(2)
    
    # Check CH column: Cat 6
    if has_ch:
        cats.append(6)
    
    # DH_GEL can be Cat 1, 3, or 4 - determine from justification text
    if has_dh:
        dh_cats = set()
        
        # Cat 1 keywords (materiais/insumos/equipamentos - internal DH responsibility)
        if any(w in mot_lower for w in ['aguardando material', 'tubos', 'aguardando concreto',
                                          'aguardando chegada', 'aguardando broca', 'aguardando bomba',
                                          'aguardando munck', 'aguardando jateador',
                                          'aguardando peça', 'aguardando peca', 'aguardando oxigenio',
                                          'acetileno', 'aguardando revestimento', 'aguardando equipamento',
                                          'aguardando caminh', 'aguardando compressor',
                                          'aguardando retirada da bomba', 'aguardando sonda']):
            dh_cats.add(1)
        
        # Cat 2 keywords (manutencao - could be in DH if not separated to ME)
        if any(w in mot_lower for w in ['manutenção', 'manutencao', 'manutençao', 'reparo',
                                          'arrumando', 'ajuste', 'troca da', 'troca do',
                                          'trocando', 'revisão', 'revisao', 'solda no', 'solda na',
                                          'defeito no', 'mau funcionamento', 'bomba gardner',
                                          'bomba duplex', 'swivel', 'underreamer', 'fole',
                                          'embreagem', 'gaxeta', 'kelly', 'mangueira', 'conexão',
                                          'conexao', 'bomba emsco', 'bomba centrifuga', 'catarina',
                                          'parafuso', 'instalação eletrica', 'instalacao eletrica',
                                          'fazendo instalação', 'fazendo instalacao', 'junta da bomba',
                                          'reforço da solda', 'reforco da solda',
                                          'verificação do fluido', 'verificacao do fluido',
                                          'testando e verificando catarina', 'desmontagem',
                                          'conferência da base', 'conferencia da base']):
            dh_cats.add(2)
        
        # Cat 3 keywords (falta de equipe)
        if any(w in mot_lower for w in ['falta de equipe', 'aguardando torrista',
                                          'aguardando eletricista', 'eletricista',
                                          'dtm', 'dts', 'sem atividade']):
            dh_cats.add(3)
        
        # Cat 4 keywords (atividades-meio / logistica)
        if any(w in mot_lower for w in ['deslocamento', 'descarregando', 'carregamento',
                                          'transporte', 'reunião', 'reuniao', 'organização',
                                          'organizacao', 'organizando', 'administrativo',
                                          'planejamento', 'medição', 'medicao',
                                          'cura de cimentação', 'cura da cimentacao',
                                          'limpeza do fundo', 'final de semana',
                                          'bombeamento', 'a serviço do projeto',
                                          'a servico do projeto', 'preparando materiais',
                                          'tirando medidas', 'permanecendo em espera',
                                          'cimentação do poço', 'cimentacao do poco',
                                          'nivelar terreno', 'teste de vazão', 'teste de vazao',
                                          'recuperação de nível', 'recuperacao de nivel']):
            dh_cats.add(4)
        
        # Cat 5 keywords in DH (when PA column not used but should be Cat 5)
        if any(w in mot_lower for w in ['saerp', 'geólogo', 'geologo', 'fiscais', 'fiscal',
                                          'aguardando decisão', 'aguardando decisao',
                                          'aguardando definição', 'aguardando definicao',
                                          'parc das artes', 'aguardando liberação',
                                          'aguardando liberacao']):
            dh_cats.add(5)
        
        # If nothing matched, default based on context
        if not dh_cats:
            if 'aguardando' in mot_lower:
                dh_cats.add(1)  # default: waiting for something = materials
            else:
                dh_cats.add(4)  # default: support activity
        
        cats.extend(dh_cats)
    
    # Remove duplicates
    cats = sorted(set(cats))
    cat_str = '+'.join(str(c) for c in cats)
    
    # Determine confidence
    n_cats = len(cats)
    all_in_134 = all(c in [1,3,4] for c in cats)
    
    # Column alignment check
    expected_dh = any(c in [1,3,4] for c in cats)
    expected_pa = 5 in cats
    expected_ch = 6 in cats
    expected_me = 2 in cats
    
    dh_ok = expected_dh == has_dh
    pa_ok = expected_pa == has_pa
    ch_ok = expected_ch == has_ch
    me_ok = expected_me == has_me
    col_align = sum([dh_ok, pa_ok, ch_ok, me_ok])
    
    if not cats:
        conf, note = 10, 'Nao classificavel'
    elif n_cats == 1:
        if col_align == 4:
            conf, note = 95, f'Cat {cats[0]} unica, colunas batem'
        elif cats[0] in [1,3,4] and has_dh and not has_pa and not has_ch and not has_me:
            conf, note = 60, f'Cat {cats[0]} unica, mas DH_GEL abriga 1/3/4; confirmar'
        else:
            conf, note = 85, f'Cat {cats[0]} unica'
    else:
        if col_align == 4:
            conf, note = 80, f'{n_cats} cats, colunas perfeitamente alinhadas'
        elif all_in_134 and has_dh and not has_pa and not has_ch and not has_me:
            conf, note = 35, f'{n_cats} cats em DH_GEL; nao separa'
        elif col_align >= 3:
            conf, note = 75, f'{n_cats} cats, colunas majoritariamente alinhadas'
        else:
            conf, note = 40, f'{n_cats} cats, colunas nao alinhadas'
    
    # Manual overrides: Cintia confirmed final classifications (cat_str, conf, note)
    overrides = {
        5: ('3', 100, 'Cintia: Falta de equipe (Cat 3)'),
        26: ('2+3', 80, 'DTS=Cat3(DH:8h30) + manut.mangueiras=Cat2(ME:2h). Colunas separam'),
        29: ('4', 100, 'Cintia: Administrativo (Cat 4)'),
        39: ('1', 100, 'Cintia: Falta de material (Cat 1)'),
        53: ('3', 100, 'Cintia: Falta de equipe (Cat 3)'),
        57: ('3', 100, 'Cintia: Falta de equipe (Cat 3)'),
        71: ('4', 100, 'Cintia: Administrativo (Cat 4)'),
        95: ('3', 70, 'Eletricista=Cat3 + DTM=Cat3'),
    }
    
    if i in overrides:
        cat_str, conf, note = overrides[i]
    
    results[i] = (cat_str, str(conf), note)

# Print summary
print("=" * 110)
print(f"{'Lin':>4s} | {'Data':>10s} | {'HP':>7s} | {'DH_GEL':>7s} | {'PA':>7s} | {'CH':>7s} | {'ME':>7s} | {'Cats':<10s} | {'Conf':>4s} | Nota")
print("=" * 110)

for i, r in enumerate(rows, 1):
    hp = r.get(k_hp, '').strip()
    if not hp or hp == '00:00':
        continue
    if i not in results:
        continue
    cs, conf, note = results[i]
    dh = r.get(k_dh, '').strip()
    pa = r.get(k_pa, '').strip()
    ch = r.get(k_ch, '').strip()
    me = r.get(k_me, '').strip()
    mot = r.get(k_mot, '').strip()[:70]
    flag = ' <<<' if int(conf) < 65 else ''
    print(f"L{i:03d} | {r.get('Data',''):>10s} | {hp:>7s} | {dh:>7s} | {pa:>7s} | {ch:>7s} | {me:>7s} | {cs:<10s} | {conf:>4s}% | {note[:60]}{flag}")

print("=" * 110)

low = [(lin, cs, c, n) for lin, (cs, c, n) in results.items() if int(c) < 65]
high = [(lin, cs, c, n) for lin, (cs, c, n) in results.items() if int(c) >= 65]
print(f"\nTotal com horas paradas: {len(results)}")
print(f"Alta confianca (>=65%): {len(high)}")
print(f"Baixa confianca (<65%): {len(low)}")

print("\n--- BAIXA CONFIANCA ---")
for lin, cs, c, n in low:
    r = rows[lin-1]
    print(f"L{lin:03d} | {r.get('Data','')} | HP:{r.get(k_hp,'')} | DH:{r.get(k_dh,'')} PA:{r.get(k_pa,'')} CH:{r.get(k_ch,'')} ME:{r.get(k_me,'')} | Cats:{cs} | Conf:{c}%")
    print(f"      MOT: {r.get(k_mot,'')[:100]}")
    print(f"      NOTA: {n}")
    print()

# Category distribution
from collections import Counter
cat_dist = Counter()
for cs, _, _ in results.values():
    for c in cs.split('+'):
        if c.isdigit():
            cat_dist[int(c)] += 1
print("--- DISTRIBUICAO ---")
names = {1:'Materiais/Insumos/Equip', 2:'Manutencao Corretiva', 3:'Falta Equipe/Mao Obra',
         4:'Atividades-Meio/Logistica', 5:'Aguardando Terceiros', 6:'Condicoes Climaticas'}
for c in sorted(cat_dist):
    print(f"  Cat {c} - {names[c]}: {cat_dist[c]} ocorrencias")

# Write CSV
out_fn = list(rows[0].keys()) + ['Cat_Diagnostico', 'Confianca_0_100', 'Nota_Confiabilidade', 'Revisar']
with open('paradas_com_confianca.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=out_fn)
    w.writeheader()
    for i, r in enumerate(rows, 1):
        nr = {k: r.get(k, '') for k in rows[0].keys()}
        if i in results:
            cs, conf, note = results[i]
            nr['Cat_Diagnostico'] = cs
            nr['Confianca_0_100'] = conf
            nr['Nota_Confiabilidade'] = note
            nr['Revisar'] = 'SIM' if int(conf) < 65 else ''
        else:
            nr['Cat_Diagnostico'] = ''
            nr['Confianca_0_100'] = ''
            nr['Nota_Confiabilidade'] = 'Sem horas paradas'
            nr['Revisar'] = ''
        w.writerow(nr)

print("\nCSV atualizado: paradas_com_confianca.csv")
